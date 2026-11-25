// One play of a board: the tiles left on it, the tiles waiting in the tray,
// the player's moves (for undo), and picks that clear what's left, kept up
// to date so hints are instant. Each call returns a new session, so React can
// hold it as state.
//
// The tray: picking a free tile lifts it off the board into the tray, which
// holds up to TRAY tiles. Picking a tile whose twin is waiting there takes
// both away. Lifting a tile frees what it was blocking, so the tray is how a
// player digs for a twin that is buried; a full tray takes only a tile that
// matches one in it. Boards are dealt to need it (tray.ts).
import { geometry, isFree, matches, type Geometry, type Slot } from "./board";
import { deal, orderWorks, reshuffle, solve, type Order } from "./tray";
import type { Rng } from "./random";

/** How many tiles the tray holds. */
export const TRAY = 4;

type Step =
  /** A tile went into the tray. */
  | { kind: "hold"; slot: number; plan: Order | null }
  /** `pair[1]` was picked and left with `pair[0]`, which sat at `at` in the tray. */
  | { kind: "match"; pair: [number, number]; at: number; plan: Order | null; gain: number }
  | { kind: "shuffle"; faces: number[]; tray: number[]; plan: Order | null };

export type Session = {
  g: Geometry;
  faces: number[];
  /** The tiles on the board (a tile in the tray is not). */
  present: boolean[];
  /** The tiles waiting in the tray, oldest first. */
  tray: number[];
  /** How many tiles the deal makes wait at once: how deep twins are buried. */
  depth: number;
  /** Picks that clear the board and the tray from here, or null when none was found. */
  plan: Order | null;
  /** True when no tile can be picked: the tray is full and nothing free matches it. */
  deadEnd: boolean;
  history: Step[];
  rng: Rng;
  hints: number;
  undos: number;
  shuffles: number;
  /** Points earned by the pairs cleared (see `score` for what help takes off). */
  points: number;
  /** Pairs cleared in a row with no wrong tap and no help. */
  streak: number;
};

/** A pair's points, and how much more each pair in a row before it adds, up to double. */
export const PAIR_POINTS = 100;
export const STREAK_STEP = 10;
export const STREAK_MOST = 10;
/**
 * What each help takes off the score. Help stays free to use, and costs
 * less than a pair earns, so a player who leans on it still scores.
 */
export const HELP_COST = { hint: 40, undo: 30, shuffle: 150 };
/** A calm clear, with no help at all, is worth this much more of its points. */
export const CALM_BONUS = 0.2;

/** How long the search may look for a way through after an unplanned pick. */
const BUDGET = 6000;

export function start(slots: Slot[], faceCount: number, seed: number, depth = 1): Session {
  const g = geometry(slots);
  const rng = { seed };
  const { faces, order } = deal(g, faceCount, rng, depth, TRAY);
  return {
    g,
    faces,
    present: slots.map(() => true),
    tray: [],
    depth,
    plan: order,
    deadEnd: false,
    history: [],
    rng,
    hints: 0,
    undos: 0,
    shuffles: 0,
    points: 0,
    streak: 0,
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

/** What the help used so far takes off the score. */
export const helpCost = (s: Session) =>
  s.hints * HELP_COST.hint + s.undos * HELP_COST.undo + s.shuffles * HELP_COST.shuffle;
/** The bonus for a board cleared with no help; nothing until then. */
export const calmBonus = (s: Session) => (cleared(s) && !helped(s) ? Math.round(s.points * CALM_BONUS) : 0);
/**
 * The score: the pairs' points, less what help cost, plus the calm bonus
 * once the board is cleared. Never below nothing.
 */
export const score = (s: Session) => Math.max(0, s.points - helpCost(s)) + calmBonus(s);
/** A wrong tap (a blocked tile, or one the full tray can't take) ends the streak. */
export const miss = (s: Session): Session => (s.streak ? { ...s, streak: 0 } : s);
/** The tile in the tray with the face of tile `i`, if there is one. */
export const twinInTray = (s: Session, i: number) => s.tray.find((j) => s.faces[j] === s.faces[i]);
/** Whether tile `i` can be picked now: free, and the tray takes it. */
export const canPick = (s: Session, i: number) =>
  free(s, i) && (s.tray.length < TRAY || twinInTray(s, i) !== undefined);

/** No tile can be picked: a full tray, and no free tile matches one in it. */
function noPick(g: Geometry, present: boolean[], faces: number[], tray: number[]) {
  if (tray.length < TRAY || !present.some(Boolean)) return false;
  const waiting = new Set(tray.map((j) => faces[j]));
  return !present.some((on, i) => on && waiting.has(faces[i]) && isFree(g, present, i));
}

/**
 * The picks that clear the board after the player picked `i`: the plan
 * without it when that still works (the planned pick always does, and most
 * others only come early), otherwise a fresh search.
 */
function planAfter(s: Session, i: number, present: boolean[], tray: number[]): Order | null {
  if (!present.some(Boolean) && !tray.length) return [];
  if (s.plan) {
    if (s.plan[0] === i) return s.plan.slice(1);
    const rest = s.plan.filter((t) => t !== i);
    if (rest.length === s.plan.length - 1 && orderWorks(s.g, present, s.faces, tray, rest, TRAY)) return rest;
  }
  return solve(s.g, present, s.faces, tray, TRAY, BUDGET);
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
  const tray = twin === undefined ? [...s.tray, i] : s.tray.filter((j) => j !== twin);
  // Each pair in a row is worth a little more than the one before.
  const gain = twin === undefined ? 0 : PAIR_POINTS + STREAK_STEP * Math.min(s.streak, STREAK_MOST);
  const step: Step =
    twin === undefined
      ? { kind: "hold", slot: i, plan: s.plan }
      : { kind: "match", pair: [twin, i], at: s.tray.indexOf(twin), plan: s.plan, gain };
  return {
    ...s,
    present,
    tray,
    points: s.points + gain,
    streak: twin === undefined ? s.streak : s.streak + 1,
    plan: planAfter(s, i, present, tray),
    deadEnd: noPick(s.g, present, s.faces, tray),
    history: [...s.history, step],
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
  const present = s.present.slice();
  let tray: number[];
  let faces = s.faces;
  if (last.kind === "shuffle") {
    // The tiles the shuffle put back on the board go back into the tray.
    tray = last.tray;
    faces = last.faces;
    for (const j of tray) present[j] = false;
  } else if (last.kind === "hold") {
    present[last.slot] = true;
    tray = s.tray.filter((j) => j !== last.slot);
  } else {
    present[last.pair[1]] = true;
    tray = [...s.tray.slice(0, last.at), last.pair[0], ...s.tray.slice(last.at)];
  }
  // A pair taken back gives back its points, and the streak starts again.
  const points = s.points - (last.kind === "match" ? last.gain : 0);
  // The plan before the move still works: the board is as it was then.
  return { ...s, faces, present, tray, plan: last.plan, deadEnd: noPick(s.g, present, faces, tray), history, undos, points, streak: 0 };
}

/**
 * Puts the tray's tiles back on the board and deals the tiles left again so
 * the board can be cleared. `rewound` says how many moves it had to take
 * back first (none, with a tray: any tiles left can be dealt).
 */
export function shuffle(s: Session): { session: Session; rewound: number } {
  let cur = s;
  let rewound = 0;
  for (;;) {
    const present = cur.present.slice();
    for (const j of cur.tray) present[j] = true;
    const dealt = reshuffle(cur.g, present, cur.faces, cur.rng, cur.depth, TRAY);
    if (dealt) {
      const session: Session = {
        ...cur,
        faces: dealt.faces,
        present,
        tray: [],
        plan: dealt.order,
        deadEnd: false,
        shuffles: cur.shuffles + 1,
        streak: 0,
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
 * Tiles to point out, the last of them the one to pick next, the others its
 * twin (in the tray, or on the board even when it is still covered, so the
 * player sees what the pick is for). It follows the plan; without one it
 * takes a free twin of a waiting tile, then any pair that is free. Null when
 * there is nothing to suggest.
 */
export function hint(s: Session): number[] | null {
  const twinOf = (i: number) => {
    const waiting = twinInTray(s, i);
    if (waiting !== undefined) return waiting;
    // Its partner in the plan: the pick this one closes, or the one that closes it.
    const planned = s.plan?.find((t) => t !== i && s.faces[t] === s.faces[i] && s.present[t]);
    return planned ?? s.present.findIndex((on, t) => on && t !== i && s.faces[t] === s.faces[i]);
  };
  const point = (i: number) => {
    const twin = twinOf(i);
    return twin >= 0 ? [twin, i] : [i];
  };
  if (s.plan?.length && canPick(s, s.plan[0])) return point(s.plan[0]);
  for (const j of s.tray) {
    const twin = s.present.findIndex((on, i) => on && s.faces[i] === s.faces[j] && free(s, i));
    if (twin >= 0) return [j, twin];
  }
  if (s.tray.length >= TRAY) return null;
  const pair = available(s)[0];
  return pair ? [pair[1], pair[0]] : null;
}
export const withHint = (s: Session): Session => ({ ...s, hints: s.hints + 1, streak: 0 });
