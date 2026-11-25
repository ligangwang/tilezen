// Which board each level plays, the daily puzzle, and what they pay.
import { hashSeed, next, type Rng } from "./engine/random";
import { LAYOUTS, openLayouts, type Layout } from "./engine/layouts";

/** Levels a signed-out player can play; after that dingn's sign-in opens the rest. */
export const FREE_LEVELS = 5;
/** Coins the daily puzzle pays, once a day. */
export const DAILY_COINS = 10;

export const levelSeed = (level: number) => hashSeed(`tilezen-level-${level}`);
export const daySeed = (day: string) => hashSeed(`tilezen-daily-${day}`);

/**
 * The layout of a level. A layout first appears on the level that opens it;
 * otherwise the level picks one of the open layouts, leaning towards the
 * newer ones, and every tenth level plays the biggest open layout.
 */
export function layoutFor(level: number): Layout {
  const debut = LAYOUTS.find((l) => l.unlock === level);
  if (debut) return debut;
  const open = openLayouts(level);
  if (level % 10 === 0) return open[open.length - 1];
  const rng: Rng = { seed: levelSeed(level) ^ 0x5bd1e995 };
  const weights = open.map((_, i) => (i + 1) ** 2);
  let r = next(rng) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < open.length; i++) {
    r -= weights[i];
    if (r < 0) return open[i];
  }
  return open[open.length - 1];
}

/** The daily puzzle's layout: a mid-sized board, the same for everyone. */
export function dailyLayout(day: string): Layout {
  const pool = LAYOUTS.filter((l) => l.slots.length >= 40 && l.slots.length <= 90);
  const rng: Rng = { seed: daySeed(day) };
  return pool[Math.floor(next(rng) * pool.length)];
}

/**
 * How many tiles a level's deal makes wait in the tray at once, which is how
 * deep it buries twins: one at first (a twin is always within reach), then
 * two, then three, always leaving a place in the tray to spare.
 */
export const depthFor = (level: number) => (level <= 3 ? 1 : level <= 12 ? 2 : 3);
/** The daily puzzle and free play bury twins two deep. */
export const OPEN_DEPTH = 2;

/** Coins a cleared level pays: more for bigger boards, one more for no help. */
export const coinsFor = (tiles: number, calm: boolean) =>
  Math.min(10, 2 + Math.floor(tiles / 30) + (calm ? 1 : 0));

/** Today in UTC, as YYYY-MM-DD: the daily puzzle changes at midnight UTC. */
export const today = (now = new Date()) => now.toISOString().slice(0, 10);
