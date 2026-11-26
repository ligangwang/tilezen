// What Tile Zen remembers: how far the player has got, calm clears, the
// daily puzzle, and the biggest board cleared. Saved on the device
// (sdk.storage) and, for a signed-in player, to their dingn account
// (sdk.progress). Settings are kept on the device only (see Prefs).
import type { DingnGame, Json } from "../sdk/dingn-sdk.js";

export type Saved = {
  /** The highest level cleared, 0 for none. */
  cleared: number;
  /** Levels cleared with no hint, undo or shuffle. */
  calm: number;
  /** Daily puzzles finished. */
  dailies: number;
  /** The last daily puzzle finished: its UTC day, and whether it paid. */
  daily: { day: string; paid: boolean } | null;
  /** The most tiles on a board the player has cleared. */
  biggest: number;
};
type Sdk = Pick<DingnGame, "storage" | "progress" | "player">;

export const empty = (): Saved => ({ cleared: 0, calm: 0, dailies: 0, daily: null, biggest: 0 });

const whole = (value: unknown, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
};
const isObject = (v: unknown): v is Record<string, Json> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Reads a saved value, ignoring anything that isn't the right shape. */
export function parse(value: Json): Saved {
  const saved = empty();
  if (!isObject(value)) return saved;
  saved.cleared = whole(value.cleared, 1e6);
  saved.calm = whole(value.calm, 1e6);
  saved.dailies = whole(value.dailies, 1e6);
  saved.biggest = whole(value.biggest, 1000);
  const d = value.daily;
  if (isObject(d) && typeof d.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.day))
    saved.daily = { day: d.day, paid: d.paid === true };
  return saved;
}

/** Combines two saves, keeping the better of each. */
export function merge(a: Saved, b: Saved): Saved {
  let daily = a.daily ?? b.daily;
  if (a.daily && b.daily)
    daily =
      a.daily.day !== b.daily.day
        ? a.daily.day > b.daily.day
          ? a.daily
          : b.daily
        : { day: a.daily.day, paid: a.daily.paid || b.daily.paid };
  return {
    cleared: Math.max(a.cleared, b.cleared),
    calm: Math.max(a.calm, b.calm),
    dailies: Math.max(a.dailies, b.dailies),
    daily,
    biggest: Math.max(a.biggest, b.biggest),
  };
}

const KEY = "tilezen";
export async function loadSaved(sdk: Sdk): Promise<Saved> {
  let device = empty();
  try {
    device = parse(await sdk.storage.get(KEY));
  } catch {}
  if (!sdk.player.signedIn) return device;
  try {
    return merge(parse(await sdk.progress.load()), device);
  } catch {
    return device;
  }
}
export async function store(sdk: Sdk, saved: Saved) {
  const value = saved as unknown as Json;
  await sdk.storage.set(KEY, value).catch(() => {});
  if (sdk.player.signedIn) await sdk.progress.save(value).catch(() => {});
}

/** Settings, kept on this device. */
export type Prefs = {
  sound: boolean;
  /** Bigger tiles: the board can scroll instead of shrinking to fit. */
  large: boolean;
  /** Show how long the board has taken. Off: no clock, no hurry. */
  clock: boolean;
  theme: string;
};
export const DEFAULT_PREFS: Prefs = {
  sound: true,
  large: false,
  clock: false,
  theme: "classic",
};
export function parsePrefs(value: Json): Prefs {
  const p = { ...DEFAULT_PREFS };
  if (!isObject(value)) return p;
  for (const key of ["sound", "large", "clock"] as const)
    if (typeof value[key] === "boolean") p[key] = value[key] as boolean;
  if (typeof value.theme === "string") p.theme = value.theme;
  return p;
}
