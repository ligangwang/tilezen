// The rules of Tile Zen's board: what each tile touches and which tiles are
// free. Dealing and solving are in tray.ts. No DOM here, so the tests run it
// in Node.
//
// A slot's x and y are in half-tile units: a tile covers x..x+2 and y..y+2,
// so a tile on the layer above can sit half a tile over. z is the layer.

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
