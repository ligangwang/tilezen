// One play of a board: the tiles left, the player's moves (for undo), and a
// plan that clears what's left, kept up to date so hints are instant and the
// game can tell a dead end the moment it happens. Each call returns a new
// session, so React can hold it as state.
import {
  deal,
  geometry,
  isFree,
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

type Step =
  | { kind: "match"; pair: [number, number]; plan: Plan | null }
  | { kind: "shuffle"; faces: number[]; plan: Plan | null };

export type Session = {
  g: Geometry;
  faces: number[];
  present: boolean[];
  /** A way to clear the board from here, or null when there is none (or none found). */
  plan: Plan | null;
  /** True when the board can't be cleared from here any more. */
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
    plan,
    deadEnd: false,
    history: [],
    rng,
    hints: 0,
    undos: 0,
    shuffles: 0,
  };
}

export const tilesLeft = (s: Session) => s.present.filter(Boolean).length;
export const cleared = (s: Session) => tilesLeft(s) === 0;
export const free = (s: Session, i: number) => isFree(s.g, s.present, i);
export const available = (s: Session) => matches(s.g, s.present, s.faces);
/** Whether the player has had any help: a calm clear has none. */
export const helped = (s: Session) => s.hints + s.undos + s.shuffles > 0;

/** Takes two matching free tiles off, or returns null if they can't go. */
export function take(s: Session, a: number, b: number): Session | null {
  if (a === b || s.faces[a] !== s.faces[b] || !free(s, a) || !free(s, b)) return null;
  const present = s.present.slice();
  present[a] = present[b] = false;
  let plan = s.plan ? replan(s.g, present, s.faces, s.plan, [a, b]) : null;
  let deadEnd = false;
  if (!plan && present.some(Boolean)) {
    const found = solve(s.g, present, s.faces, BUDGET);
    if (found.kind === "solvable") plan = found.plan;
    deadEnd = found.kind === "stuck";
  }
  return {
    ...s,
    present,
    plan: plan ?? null,
    deadEnd,
    history: [...s.history, { kind: "match", pair: [a, b], plan: s.plan }],
  };
}

/** Takes back the last move or shuffle. */
export function undo(s: Session, counted = true): Session {
  const last = s.history[s.history.length - 1];
  if (!last) return s;
  const history = s.history.slice(0, -1);
  const undos = s.undos + (counted ? 1 : 0);
  if (last.kind === "shuffle")
    return { ...s, faces: last.faces, plan: last.plan, deadEnd: !last.plan && isStuck(s, s.present, last.faces), history, undos };
  const present = s.present.slice();
  present[last.pair[0]] = present[last.pair[1]] = true;
  // The plan before the move still works: the board is as it was then.
  return { ...s, present, plan: last.plan, deadEnd: !last.plan && isStuck(s, present, s.faces), history, undos };
}

function isStuck(s: Session, present: boolean[], faces: number[]) {
  return solve(s.g, present, faces, BUDGET).kind === "stuck";
}

/**
 * Deals the tiles left again so the board can be cleared. When no deal of
 * them can (two tiles left stacked one on the other), it steps back a move
 * at a time until one can. `rewound` says how many moves that took back.
 */
export function shuffle(s: Session): { session: Session; rewound: number } {
  let cur = s;
  let rewound = 0;
  for (;;) {
    const placed = reshuffle(cur.g, cur.present, cur.faces, cur.rng);
    if (placed) {
      const session: Session = {
        ...cur,
        faces: placed.faces,
        plan: placed.plan,
        deadEnd: false,
        shuffles: cur.shuffles + 1,
        history: [...cur.history, { kind: "shuffle", faces: cur.faces, plan: cur.plan }],
      };
      return { session, rewound };
    }
    if (!cur.history.length) return { session: cur, rewound };
    cur = undo(cur, false);
    rewound++;
  }
}

/** A pair to suggest: the next step of the plan, or any match if there's no plan. */
export function hint(s: Session): [number, number] | null {
  if (s.plan && s.plan.length && planWorks(s.g, s.present, s.faces, s.plan)) return s.plan[0];
  return available(s)[0] ?? null;
}
export const withHint = (s: Session): Session => ({ ...s, hints: s.hints + 1 });
