// Dealing and solving for play with a tray. A tile that is picked waits in
// the tray until its twin is picked, and while it waits it blocks nothing,
// so a board no longer needs both tiles of a pair free at once: a twin can
// lie under other tiles, which are lifted into the tray to reach it. That
// lets a board have many more covered tiles than one played pair by pair.
//
// A way through such a board is an order of picks, not a list of pairs.
import { freeSlots, isFree, type Geometry } from "./board";
import { below, shuffleInPlace, type Rng } from "./random";

/** Tiles to pick, in order, that clear the board and the tray. */
export type Order = number[];
export type Dealt = { faces: number[]; order: Order };

/** Whether picking `order` from this board and tray, with `cap` places, clears both. */
export function orderWorks(
  g: Geometry,
  present: boolean[],
  faces: number[],
  tray: number[],
  order: Order,
  cap: number,
): boolean {
  const p = present.slice();
  const waiting = tray.slice();
  for (const i of order) {
    if (!isFree(g, p, i)) return false;
    p[i] = false;
    const twin = waiting.findIndex((j) => faces[j] === faces[i]);
    if (twin >= 0) waiting.splice(twin, 1);
    else if (waiting.length >= cap) return false;
    else waiting.push(i);
  }
  return !waiting.length && !p.some(Boolean);
}

/** How many layers of tiles are still under slot `i`. */
function stackUnder(g: Geometry, present: boolean[], i: number): number {
  let best = 0;
  for (const j of g.under[i]) if (present[j]) best = Math.max(best, 1 + stackUnder(g, present, j));
  return best;
}

function weighted(list: number[], weight: (i: number) => number, rng: Rng) {
  let total = 0;
  for (const i of list) total += weight(i);
  let r = (below(rng, 1_000_000) / 1_000_000) * total;
  for (const i of list) {
    r -= weight(i);
    if (r < 0) return i;
  }
  return list[list.length - 1];
}

/**
 * Puts `pairs` (one face per pair) on the slots in `present` by playing the
 * board with blank tiles and a tray: each pick is a free tile, which either
 * opens a pair (it takes the next face and waits) or closes one (it takes
 * the face of a tile that is waiting, and both go). At most `depth` tiles
 * wait at once, so playing the picks back needs `depth` places in the tray.
 * A tile that waits longer has its twin further down, so a higher `depth`
 * buries twins deeper.
 */
function placeOnce(g: Geometry, present: boolean[], pairs: number[], rng: Rng, depth: number): Dealt {
  const left = present.slice();
  const faces = present.map(() => -1);
  const order: Order = [];
  const waiting: number[] = [];
  const queue = pairs.slice();
  let remaining = left.filter(Boolean).length;
  while (remaining > 0) {
    const free = freeSlots(g, left);
    // Tall stacks come down first, so what waits is from the top and what
    // closes it is from further down.
    const t = weighted(free, (i) => 1 + 3 * stackUnder(g, left, i) ** 2, rng);
    left[t] = false;
    remaining--;
    order.push(t);
    // Every waiting tile still needs a tile from the board to close it.
    const mayOpen = waiting.length < depth && remaining >= waiting.length + 1;
    if (!waiting.length || (mayOpen && below(rng, 100) < 65)) {
      // A face nothing waiting has, so the new tile waits instead of matching.
      let at = queue.findIndex((f) => !waiting.some((j) => faces[j] === f));
      if (at < 0) at = 0;
      faces[t] = queue.splice(at, 1)[0];
      waiting.push(t);
    } else {
      // Mostly the one that has waited longest.
      const at = below(rng, 100) < 60 ? 0 : below(rng, waiting.length);
      faces[t] = faces[waiting.splice(at, 1)[0]];
    }
  }
  return { faces, order };
}

/** The deepest a deal may bury twins: one place in the tray is always spare. */
export const MAX_DEPTH = 3;

export function place(
  g: Geometry,
  present: boolean[],
  pairs: number[],
  rng: Rng,
  depth: number,
  cap: number,
): Dealt | null {
  const d = Math.max(1, Math.min(depth, MAX_DEPTH, cap - 1));
  for (let n = 0; n < 200; n++) {
    const dealt = placeOnce(g, present, shuffleInPlace(rng, pairs.slice()), rng, d);
    // Sets of four can pair up another way round: keep a deal only if its
    // picks clear the board as dealt.
    if (orderWorks(g, present, dealt.faces, [], dealt.order, cap)) return dealt;
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

/** A board that can be cleared with the tray: the face in each slot, and the picks. */
export function deal(g: Geometry, faceCount: number, rng: Rng, depth: number, cap: number): Dealt {
  const n = g.slots.length;
  if (n % 2) throw new Error("a layout needs an even number of tiles");
  const dealt = place(g, new Array(n).fill(true), chooseFaces(n / 2, faceCount, rng), rng, depth, cap);
  if (!dealt) throw new Error("this layout can't be dealt");
  return dealt;
}

/** The tiles left dealt again, so the board can still be cleared with the tray. */
export function reshuffle(
  g: Geometry,
  present: boolean[],
  faces: number[],
  rng: Rng,
  depth: number,
  cap: number,
): Dealt | null {
  const counts = new Map<number, number>();
  present.forEach((on, i) => on && counts.set(faces[i], (counts.get(faces[i]) ?? 0) + 1));
  const pairs: number[] = [];
  for (const [face, n] of counts) {
    if (n % 2) return null;
    for (let k = 0; k < n / 2; k++) pairs.push(face);
  }
  const dealt = place(g, present, pairs, rng, depth, cap);
  return dealt && { faces: faces.map((f, i) => (present[i] ? dealt.faces[i] : f)), order: dealt.order };
}

/**
 * Looks for picks that clear the board and the tray from here, within
 * `budget` steps; null when it finds none in time. A free tile whose twin
 * waits in the tray is always taken first (it empties a place); otherwise
 * it tries the free tiles, those whose twin is free too first, then those
 * that uncover the most.
 */
export function solve(
  g: Geometry,
  present: boolean[],
  faces: number[],
  tray: number[],
  cap: number,
  budget = 6000,
): Order | null {
  const failed = new Set<string>();
  let nodes = 0;
  let outOfTime = false;
  function search(p: boolean[], waiting: number[]): Order | null {
    if (!waiting.length && !p.some(Boolean)) return [];
    if (++nodes > budget) {
      outOfTime = true;
      return null;
    }
    const key = p.map((on) => (on ? 1 : 0)).join("") + waiting.slice().sort((a, b) => a - b).join(",");
    if (failed.has(key)) return null;
    const free = freeSlots(g, p);
    const step = (t: number): Order | null => {
      const q = p.slice();
      q[t] = false;
      const twin = waiting.findIndex((j) => faces[j] === faces[t]);
      const next = twin >= 0 ? waiting.filter((_, k) => k !== twin) : [...waiting, t];
      const rest = search(q, next);
      return rest && [t, ...rest];
    };
    const closing = free.find((t) => waiting.some((j) => faces[j] === faces[t]));
    if (closing !== undefined) {
      const found = step(closing);
      if (!found && !outOfTime) failed.add(key);
      return found;
    }
    if (waiting.length < cap) {
      const scored = free
        .map((t) => {
          const q = p.slice();
          q[t] = false;
          let gain = 0;
          q.forEach((on, i) => on && !isFree(g, p, i) && isFree(g, q, i) && gain++);
          const twinFree = free.some((u) => u !== t && faces[u] === faces[t]);
          return { t, score: (twinFree ? 100 : 0) + gain };
        })
        .sort((a, b) => b.score - a.score);
      for (const { t } of scored) {
        const found = step(t);
        if (found) return found;
        if (outOfTime) return null;
      }
    }
    failed.add(key);
    return null;
  }
  return search(present.slice(), tray.slice());
}
