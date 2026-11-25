// A small seeded random generator (mulberry32), so a board, its refills and
// the daily board are the same for everyone who makes the same moves.

export type Rng = { seed: number };

/** A number in [0, 1) from the generator, which it advances. */
export function next(rng: Rng): number {
  let t = (rng.seed = (rng.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A whole number in [0, n). */
export const below = (rng: Rng, n: number) => Math.floor(next(rng) * n);

/** A 32-bit seed from text (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

export function shuffleInPlace<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = below(rng, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
