// The rules of Tile Zen: which tiles are free, dealing a board that can
// always be finished, finding a hint, and shuffling into a board that can
// still be finished. No DOM here, so the tests run it in Node.
//
// A slot's x and y are in half-tile units: a tile covers x..x+2 and y..y+2,
// so a tile on the layer above can sit half a tile over. z is the layer.
import { below, shuffleInPlace, type Rng } from "./random";

export type Slot = { x: number; y: number; z: number };

/** What each slot touches, worked out once per layout. */
export type Geometry = {
  slots: Slot[];
  /** Slots on the layer above that cover part of this one. */
  above: number[][];
  /** Slots on the layer below that this one covers part of. */
  under: number[][];
  /** Slots on the same layer touching this one's left or right edge. */
  left: number[][];
  right: number[][];
};

export function geometry(slots: Slot[]): Geometry {
  const above: number[][] = slots.map(() => []);
  const under: number[][] = slots.map(() => []);
  const left: number[][] = slots.map(() => []);
  const right: number[][] = slots.map(() => []);
  slots.forEach((a, i) =>
    slots.forEach((b, j) => {
      if (i === j) return;
      const dx = b.x - a.x;
      const dy = Math.abs(b.y - a.y);
      if (b.z === a.z + 1 && Math.abs(dx) < 2 && dy < 2) above[i].push(j);
      if (b.z === a.z - 1 && Math.abs(dx) < 2 && dy < 2) under[i].push(j);
      if (b.z === a.z && dy < 2) {
        if (dx === -2) left[i].push(j);
        if (dx === 2) right[i].push(j);
      }
    }),
  );
  return { slots, above, under, left, right };
}

/** Whether the tile in slot `i` can be picked: nothing on it, and one side open. */
export function isFree(g: Geometry, present: boolean[], i: number): boolean {
  if (!present[i]) return false;
  if (g.above[i].some((j) => present[j])) return false;
  return !g.left[i].some((j) => present[j]) || !g.right[i].some((j) => present[j]);
}

export const freeSlots = (g: Geometry, present: boolean[]) =>
  present.flatMap((_, i) => (isFree(g, present, i) ? [i] : []));

/** Every pair of free tiles with the same face. */
export function matches(g: Geometry, present: boolean[], faces: number[]): [number, number][] {
  const byFace = new Map<number, number[]>();
  for (const i of freeSlots(g, present)) {
    const list = byFace.get(faces[i]) ?? [];
    list.push(i);
    byFace.set(faces[i], list);
  }
  const out: [number, number][] = [];
  for (const list of byFace.values())
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++) out.push([list[a], list[b]]);
  return out;
}

/** Pairs to take off, in order, that clear the board. */
export type Plan = [number, number][];
export type Placed = { faces: number[]; plan: Plan };

/**
 * Puts `pairs` (one face per pair) on the slots in `present`, so that the
 * board can be cleared. It plays the board with blank tiles: it takes two
 * free tiles off and gives them the next face, again and again. Played with
 * the faces on, taking the pairs off in the same order always works, since
 * each pair was free on exactly that board. Returns null when it paints
 * itself into a corner (two tiles left stacked), so the caller tries again.
 */
function placeOnce(
  g: Geometry,
  present: boolean[],
  pairs: number[],
  rng: Rng,
): Placed | null {
  const left = present.slice();
  const faces = present.map(() => -1);
  const taken: Plan = [];
  for (const face of pairs) {
    const free = freeSlots(g, left);
    if (free.length < 2) return null;
    // Favour the tops of tall stacks, so the stacks come down evenly and the
    // last tiles aren't stranded on top of each other.
    const weight = (i: number) => 1 + 3 * stackUnder(g, left, i) ** 2;
    const a = pick(free, weight, rng);
    const b = pick(
      free.filter((i) => i !== a),
      weight,
      rng,
    );
    faces[a] = faces[b] = face;
    left[a] = left[b] = false;
    taken.push([a, b]);
  }
  return { faces, plan: taken };
}

/** How many layers of tiles are still under slot `i`. */
function stackUnder(g: Geometry, present: boolean[], i: number): number {
  let best = 0;
  for (const j of g.under[i]) if (present[j]) best = Math.max(best, 1 + stackUnder(g, present, j));
  return best;
}

function pick(list: number[], weight: (i: number) => number, rng: Rng) {
  let total = 0;
  for (const i of list) total += weight(i);
  let r = (below(rng, 1_000_000) / 1_000_000) * total;
  for (const i of list) {
    r -= weight(i);
    if (r < 0) return i;
  }
  return list[list.length - 1];
}

export function place(
  g: Geometry,
  present: boolean[],
  pairs: number[],
  rng: Rng,
  tries = 200,
): Placed | null {
  for (let t = 0; t < tries; t++) {
    const placed = placeOnce(g, present, shuffleInPlace(rng, pairs.slice()), rng);
    if (placed) return placed;
  }
  return null;
}

/**
 * The faces for a new board: each face once as a pair while the theme has
 * enough of them, then some faces twice, so bigger boards have sets of four.
 */
export function chooseFaces(pairCount: number, faceCount: number, rng: Rng): number[] {
  const all = shuffleInPlace(rng, Array.from({ length: faceCount }, (_, i) => i));
  const out: number[] = [];
  for (let i = 0; i < pairCount; i++) out.push(all[i % faceCount]);
  return out;
}

/** A board that can be cleared: the face in each slot, and a way through. */
export function deal(g: Geometry, faceCount: number, rng: Rng): Placed {
  const n = g.slots.length;
  if (n % 2) throw new Error("a layout needs an even number of tiles");
  const present = new Array(n).fill(true);
  const placed = place(g, present, chooseFaces(n / 2, faceCount, rng), rng, 1000);
  if (!placed) throw new Error("this layout can't be dealt");
  return placed;
}

/**
 * The remaining tiles' faces dealt again so the board can still be cleared,
 * or null when no deal can (such as the last two tiles stacked one on the
 * other).
 */
export function reshuffle(
  g: Geometry,
  present: boolean[],
  faces: number[],
  rng: Rng,
): Placed | null {
  const counts = new Map<number, number>();
  present.forEach((p, i) => p && counts.set(faces[i], (counts.get(faces[i]) ?? 0) + 1));
  const pairs: number[] = [];
  for (const [face, count] of counts) for (let k = 0; k < count / 2; k++) pairs.push(face);
  const placed = place(g, present, pairs, rng, 300);
  if (!placed) return null;
  return {
    faces: faces.map((f, i) => (present[i] ? placed.faces[i] : f)),
    plan: placed.plan,
  };
}

/** Whether playing `plan` from this board clears it. */
export function planWorks(
  g: Geometry,
  present: boolean[],
  faces: number[],
  plan: Plan,
): boolean {
  const p = present.slice();
  for (const [a, b] of plan) {
    if (a === b || faces[a] !== faces[b] || !isFree(g, p, a) || !isFree(g, p, b)) return false;
    p[a] = p[b] = false;
  }
  return !p.some(Boolean);
}

/**
 * The plan after the player took `pair` off, if a small change to it still
 * clears the board. Taking a planned pair always keeps the plan good (fewer
 * tiles only ever free others). Pairing across two planned pairs of the same
 * face leaves their other two tiles to pair up, which we try at each step
 * between the two.
 */
export function replan(
  g: Geometry,
  present: boolean[],
  faces: number[],
  plan: Plan,
  pair: [number, number],
): Plan | null {
  const [a, b] = pair;
  const at = (t: number) => plan.findIndex(([x, y]) => x === t || y === t);
  const i = at(a);
  const j = at(b);
  if (i < 0 || j < 0) return null;
  if (i === j) return plan.filter((_, k) => k !== i);
  const other = (k: number, t: number) => (plan[k][0] === t ? plan[k][1] : plan[k][0]);
  const rest: [number, number] = [other(i, a), other(j, b)];
  const without = plan.filter((_, k) => k !== i && k !== j);
  for (let k = 0; k <= without.length; k++) {
    const tryPlan = [...without.slice(0, k), rest, ...without.slice(k)];
    if (planWorks(g, present, faces, tryPlan)) return tryPlan;
  }
  return null;
}

export type Solution =
  /** The board can be cleared, this way. */
  | { kind: "solvable"; plan: Plan }
  /** Nothing on the board can be cleared from here. */
  | { kind: "stuck" }
  /** Too big to be sure in time: here is a pair that at least matches. */
  | { kind: "unsure"; pair: [number, number] }
  | { kind: "cleared" };

/**
 * Looks for a way to clear the board. A pair whose face has no other tiles
 * left, or all four tiles of a face lying free, can never be a mistake, so
 * those are taken without searching; the search only branches where a face
 * has three or four tiles and some are blocked.
 */
export function solve(
  g: Geometry,
  present: boolean[],
  faces: number[],
  budget = 20000,
): Solution {
  if (!present.some(Boolean)) return { kind: "cleared" };
  const failed = new Set<string>();
  let nodes = 0;
  let outOfTime = false;
  const remainingOf = (p: boolean[], face: number) => {
    let n = 0;
    p.forEach((on, i) => on && faces[i] === face && n++);
    return n;
  };
  function search(p: boolean[]): [number, number][] | null {
    if (!p.some(Boolean)) return [];
    if (++nodes > budget) {
      outOfTime = true;
      return null;
    }
    const key = p.map((on) => (on ? 1 : 0)).join("");
    if (failed.has(key)) return null;
    const options = matches(g, p, faces);
    // A safe pair: take it and carry on.
    for (const [a, b] of options) {
      const rest = remainingOf(p, faces[a]);
      const freeOfFace = options.filter(
        ([x, y]) => faces[x] === faces[a] && (x === a || y === a),
      ).length;
      if (rest === 2 || (rest === 4 && freeOfFace === 3)) {
        const q = p.slice();
        q[a] = q[b] = false;
        const after = search(q);
        if (after) return [[a, b], ...after];
        if (!outOfTime) failed.add(key);
        return null;
      }
    }
    // Otherwise try each pair, the ones that free the most tiles first.
    const scored = options
      .map((pair) => ({ pair, gain: unlocks(g, p, pair) }))
      .sort((a, b) => b.gain - a.gain);
    for (const { pair } of scored) {
      const q = p.slice();
      q[pair[0]] = q[pair[1]] = false;
      const after = search(q);
      if (after) return [pair, ...after];
      if (outOfTime) return null;
    }
    failed.add(key);
    return null;
  }
  const path = search(present.slice());
  if (path && path.length) return { kind: "solvable", plan: path };
  const options = matches(g, present, faces);
  if (outOfTime && options.length) return { kind: "unsure", pair: options[0] };
  return { kind: "stuck" };
}

/** How many tiles removing `pair` would set free. */
function unlocks(g: Geometry, present: boolean[], pair: [number, number]) {
  const q = present.slice();
  q[pair[0]] = q[pair[1]] = false;
  let n = 0;
  q.forEach((on, i) => on && !isFree(g, present, i) && isFree(g, q, i) && n++);
  return n;
}
