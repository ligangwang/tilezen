// One play of a board: the tiles left on it, the tiles waiting in the tray,
// the player's moves (for undo), and a plan that clears what's left, kept up
// to date so hints are instant. Each call returns a new session, so React can
// hold it as state.
//
// The tray: picking a free tile lifts it off the board into the tray, which
// holds up to TRAY tiles. Picking a tile whose twin is waiting there takes
// both away. Lifting a tile frees what it was blocking, so the tray is how a
// player digs for a twin that is buried; a full tray takes only a tile that
// matches one in it.
import {
  deal,
  geometry,
  isFree,
  lift,
  matches,
  planWorks,
  replan,
  reshuffle,
  solve,
  type Geometry,
  type Plan,
  type Slot,
} from "./board";
import type { Rng } from "./random";

/** How many tiles the tray holds. */
export const TRAY = 4;

type Step =
  /** A tile went into the tray. */
  | { kind: "hold"; slot: number; plan: Plan | null }
  /** `pair[1]` was picked and left with `pair[0]`, which sat at `at` in the tray. */
  | { kind: "match"; pair: [number, number]; at?: number; plan: Plan | null }
  | { kind: "shuffle"; faces: number[]; tray?: number[]; plan: Plan | null };

export type Session = {
  g: Geometry;
  faces: number[];
  /** The tiles on the board (a tile in the tray is not). */
  present: boolean[];
  /** The tiles waiting in the tray, oldest first. */
  tray: number[];
  /**
   * Pairs that clear the board and the tray from here, counting a tile in
   * the tray as free, or null when none was found. It is what hints follow.
   */
  plan: Plan | null;
  /** True when no tile can be picked: the tray is full and nothing free matches it. */
  deadEnd: boolean;
  history: Step[];
  rng: Rng;
  hints: number;
  undos: number;
  shuffles: number;
};

/** How long the search may look for a way through after an unplanned move. */
const BUDGET = 8000;

export function start(slots: Slot[], faceCount: number, seed: number): Session {
  const g = geometry(slots);
  const rng = { seed };
  const { faces, plan } = deal(g, faceCount, rng);
  return {
    g,
    faces,
    present: slots.map(() => true),
    tray: [],
    plan,
    deadEnd: false,
    history: [],
    rng,
    hints: 0,
    undos: 0,
    shuffles: 0,
  };
}

/** Tiles still to clear: on the board and in the tray. */
export const tilesLeft = (s: Session) => s.present.filter(Boolean).length + s.tray.length;
export const cleared = (s: Session) => tilesLeft(s) === 0;
export const free = (s: Session, i: number) => isFree(s.g, s.present, i);
/** Every pair of free tiles on the board with the same face. */
export const available = (s: Session) => matches(s.g, s.present, s.faces);
/** Whether the player has had any help: a calm clear has none. */
export const helped = (s: Session) => s.hints + s.undos + s.shuffles > 0;
/** Whether the tray has a tile with the face of tile `i`. */
export const twinInTray = (s: Session, i: number) => s.tray.find((j) => s.faces[j] === s.faces[i]);
/** Whether tile `i` can be picked now: free, and the tray takes it. */
export const canPick = (s: Session, i: number) =>
  free(s, i) && (s.tray.length < TRAY || twinInTray(s, i) !== undefined);

/** The board with the tray's tiles counted as free tiles of their own. */
function view(g: Geometry, present: boolean[], tray: number[]) {
  const p = present.slice();
  for (const j of tray) p[j] = true;
  return { g: lift(g, tray), present: p };
}

/** No tile can be picked: a full tray, and no free tile matches one in it. */
function noPick(g: Geometry, present: boolean[], faces: number[], tray: number[]) {
  if (tray.length < TRAY || !present.some(Boolean)) return false;
  const waiting = new Set(tray.map((j) => faces[j]));
  return !present.some((on, i) => on && waiting.has(faces[i]) && isFree(g, present, i));
}

/**
 * Picks the free tile `i`: it leaves with its twin if one waits in the tray,
 * otherwise it waits there itself. Null when it can't be picked (blocked, or
 * the tray is full of other faces).
 */
export function pick(s: Session, i: number): Session | null {
  if (!canPick(s, i)) return null;
  const present = s.present.slice();
  present[i] = false;
  const twin = twinInTray(s, i);
  if (twin === undefined) {
    const tray = [...s.tray, i];
    // Lifting a tile only frees others, so the plan still clears the board.
    return {
      ...s,
      present,
      tray,
      deadEnd: noPick(s.g, present, s.faces, tray),
      history: [...s.history, { kind: "hold", slot: i, plan: s.plan }],
    };
  }
  const at = s.tray.indexOf(twin);
  const tray = s.tray.filter((j) => j !== twin);
  const v = view(s.g, present, tray);
  let plan = s.plan ? replan(v.g, v.present, s.faces, s.plan, [twin, i]) : null;
  if (!plan && v.present.some(Boolean)) {
    const found = solve(v.g, v.present, s.faces, BUDGET);
    if (found.kind === "solvable") plan = found.plan;
  }
  return {
    ...s,
    present,
    tray,
    plan: plan ?? null,
    deadEnd: noPick(s.g, present, s.faces, tray),
    history: [...s.history, { kind: "match", pair: [twin, i], at, plan: s.plan }],
  };
}

/** Takes two matching free tiles off, one pick after the other, or returns null if they can't go. */
export function take(s: Session, a: number, b: number): Session | null {
  if (a === b || s.faces[a] !== s.faces[b] || !free(s, a) || !free(s, b)) return null;
  const held = pick(s, a);
  return held && pick(held, b);
}

/** Takes back the last pick or shuffle. */
export function undo(s: Session, counted = true): Session {
  const last = s.history[s.history.length - 1];
  if (!last) return s;
  const history = s.history.slice(0, -1);
  const undos = s.undos + (counted ? 1 : 0);
  if (last.kind === "shuffle") {
    // The tiles the shuffle put back on the board go back into the tray.
    const tray = last.tray ?? [];
    const present = s.present.slice();
    for (const j of tray) present[j] = false;
    return { ...s, faces: last.faces, present, tray, plan: last.plan, deadEnd: noPick(s.g, present, last.faces, tray), history, undos };
  }
  const present = s.present.slice();
  let tray: number[];
  if (last.kind === "hold") {
    present[last.slot] = true;
    tray = s.tray.filter((j) => j !== last.slot);
  } else if (last.at === undefined) {
    // A pair taken straight off the board (a step from before the tray).
    present[last.pair[0]] = present[last.pair[1]] = true;
    tray = s.tray;
  } else {
    present[last.pair[1]] = true;
    tray = [...s.tray.slice(0, last.at), last.pair[0], ...s.tray.slice(last.at)];
  }
  // The plan before the move still works: the board is as it was then.
  return { ...s, present, tray, plan: last.plan, deadEnd: noPick(s.g, present, s.faces, tray), history, undos };
}

/**
 * Puts the tray's tiles back on the board and deals the tiles left again so
 * the board can be cleared. When no deal of them can (two tiles left stacked
 * one on the other), it steps back a move at a time until one can. `rewound`
 * says how many moves that took back.
 */
export function shuffle(s: Session): { session: Session; rewound: number } {
  let cur = s;
  let rewound = 0;
  for (;;) {
    const present = cur.present.slice();
    for (const j of cur.tray) present[j] = true;
    const placed = reshuffle(cur.g, present, cur.faces, cur.rng);
    if (placed) {
      const session: Session = {
        ...cur,
        faces: placed.faces,
        present,
        tray: [],
        plan: placed.plan,
        deadEnd: false,
        shuffles: cur.shuffles + 1,
        history: [...cur.history, { kind: "shuffle", faces: cur.faces, tray: cur.tray, plan: cur.plan }],
      };
      return { session, rewound };
    }
    if (!cur.history.length) return { session: cur, rewound };
    cur = undo(cur, false);
    rewound++;
  }
}

/**
 * Tiles to point out, the last of them the one to pick next: a tile in the
 * tray with its free twin, else the next step of the plan, else any pair
 * that matches. Null when there is nothing to suggest.
 */
export function hint(s: Session): number[] | null {
  // A twin of a waiting tile that can be picked now always helps: it empties a place.
  for (const j of s.tray) {
    // The twin the plan pairs it with, when that one is free; else any free twin.
    const step = s.plan?.find(([x, y]) => x === j || y === j);
    const planned = step ? (step[0] === j ? step[1] : step[0]) : -1;
    const twin =
      planned >= 0 && s.present[planned] && free(s, planned)
        ? planned
        : s.present.findIndex((on, i) => on && s.faces[i] === s.faces[j] && free(s, i));
    if (twin >= 0) return [j, twin];
  }
  if (s.tray.length >= TRAY) return null;
  const v = view(s.g, s.present, s.tray);
  const step = s.plan && s.plan.length && planWorks(v.g, v.present, s.faces, s.plan) ? s.plan[0] : available(s)[0];
  if (!step) return null;
  // Both are free on the board: either goes first.
  return step;
}
export const withHint = (s: Session): Session => ({ ...s, hints: s.hints + 1 });
