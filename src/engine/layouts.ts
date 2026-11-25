// Tile Zen's layouts, all our own shapes. Each layer is drawn as rows of
// text, one character a tile ("#" a tile, "." empty), and moved by `at`
// (in half tiles) so a layer can sit half a tile over the one below.
// Layouts open one by one as the player clears levels (`unlock`).
import type { Slot } from "./board";

type Layer = { at?: [number, number]; rows: string[] };
export type LayoutDef = {
  id: string;
  /** In English: the game's language packs have it in the others. */
  name: string;
  /** The level that first plays it, and opens it in Free play. */
  unlock: number;
  layers: Layer[];
};
export type Layout = LayoutDef & { slots: Slot[] };

const DEFS: LayoutDef[] = [
  {
    id: "pebble",
    name: "Pebble",
    unlock: 1,
    layers: [
      { rows: ["####", "####", "####"] },
      { at: [2, 2], rows: ["##"] },
    ],
  },
  {
    id: "stream",
    name: "Stream",
    unlock: 2,
    layers: [
      { rows: [".######.", "########", ".######."] },
      { at: [4, 2], rows: ["####"] },
    ],
  },
  {
    id: "lotus",
    name: "Lotus",
    unlock: 3,
    layers: [
      { rows: ["..##..", ".####.", "######", ".####.", "..##.."] },
      { at: [2, 2], rows: [".##.", "####", ".##."] },
      { at: [4, 4], rows: ["##"] },
    ],
  },
  {
    // Three layers straight on top of each other: most of it is covered,
    // which a tray makes playable.
    id: "well",
    name: "Old Well",
    unlock: 4,
    layers: [
      { rows: ["####", "####"] },
      { rows: ["####", "####"] },
      { rows: ["####", "####"] },
    ],
  },
  {
    id: "bridge",
    name: "Stone Bridge",
    unlock: 5,
    layers: [
      { rows: ["########", "##....##", "########"] },
      { at: [2, 0], rows: ["######", "......", "######"] },
      { at: [4, 0], rows: ["####", "....", "####"] },
    ],
  },
  {
    id: "moongate",
    name: "Moon Gate",
    unlock: 7,
    layers: [
      { rows: ["..####..", ".##..##.", "##....##", "##....##", ".##..##.", "..####.."] },
      { at: [1, 1], rows: [".#####.", "##...##", "#.....#", "##...##", ".#####."] },
    ],
  },
  {
    id: "tower",
    name: "Drum Tower",
    unlock: 8,
    layers: [
      { rows: ["####", "####", "####"] },
      { rows: ["####", "####", "####"] },
      { rows: ["####", "####", "####"] },
      { at: [2, 2], rows: ["##", "##"] },
    ],
  },
  {
    id: "lantern",
    name: "Lantern",
    unlock: 9,
    layers: [
      { rows: [".####.", "######", "######", "######", ".####."] },
      { at: [2, 2], rows: [".##.", "####", "####", ".##."] },
      { at: [4, 4], rows: ["##", "##"] },
    ],
  },
  {
    id: "butterfly",
    name: "Butterfly",
    unlock: 12,
    layers: [
      { rows: ["##....##", "###..###", "########", "###..###", "##....##"] },
      { at: [2, 2], rows: ["##..##", "######", "##..##"] },
      { at: [6, 4], rows: ["##"] },
    ],
  },
  {
    id: "cloud",
    name: "Cloud",
    unlock: 15,
    layers: [
      { rows: ["..####..", ".######.", "########", "########", ".######.", "..####.."] },
      { at: [2, 2], rows: [".####.", "######", "######", ".####."] },
      { at: [4, 4], rows: ["####", "####"] },
      { at: [6, 6], rows: ["##"] },
    ],
  },
  {
    id: "pagoda",
    name: "Pagoda",
    unlock: 18,
    layers: [
      { rows: ["########", "########", "########", "########"] },
      { at: [2, 1], rows: ["######", "######", "######"] },
      { at: [4, 2], rows: ["####", "####"] },
      { at: [6, 3], rows: ["##"] },
    ],
  },
  {
    id: "fan",
    name: "Folding Fan",
    unlock: 22,
    layers: [
      { rows: ["##.##.##.##", "##########.", ".#########.", "..#######..", "...#####...", "....###...."] },
      { at: [2, 2], rows: ["########", ".######.", "..####.."] },
      { at: [4, 2], rows: ["######"] },
    ],
  },
  {
    id: "mountain",
    name: "Far Mountains",
    unlock: 26,
    layers: [
      { rows: ["########", "########", "########", "########", "########"] },
      { at: [2, 1], rows: ["######", "######", "######", "######"] },
      { at: [4, 2], rows: ["####", "####", "####"] },
      { at: [6, 3], rows: ["##", "##"] },
    ],
  },
  {
    id: "twinpeaks",
    name: "Twin Peaks",
    unlock: 30,
    layers: [
      { rows: ["####..####", "####..####", "##########", "##########", "####..####", "####..####"] },
      { at: [1, 1], rows: ["###..###", "###..###", "###..###", "###..###", "###..###"] },
      { at: [2, 2], rows: ["##....##", "##....##", "##....##", "##....##"] },
      { at: [3, 3], rows: ["#......#", "#......#", "#......#"] },
    ],
  },
  {
    id: "courtyard",
    name: "Courtyard",
    unlock: 35,
    layers: [
      { rows: ["##########", "##########", "##.####.##", "##.####.##", "##########", "##########"] },
      { at: [2, 2], rows: ["########", "#.####.#", "#.####.#", "########"] },
      { at: [6, 5], rows: ["####"] },
    ],
  },
  {
    id: "temple",
    name: "Mountain Temple",
    unlock: 40,
    layers: [
      { rows: ["##########", "##########", "##########", "##########", "##########", "##########"] },
      { at: [2, 2], rows: ["########", "########", "########", "########"] },
      { at: [4, 4], rows: ["######", "######", "######"] },
      { at: [6, 6], rows: ["####", "####"] },
      { at: [8, 7], rows: ["##"] },
    ],
  },
];

function slotsOf(def: LayoutDef): Slot[] {
  const slots: Slot[] = [];
  def.layers.forEach((layer, z) => {
    const [ax, ay] = layer.at ?? [0, 0];
    layer.rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === "#") slots.push({ x: ax + c * 2, y: ay + r * 2, z });
      }),
    );
  });
  return slots;
}

export const LAYOUTS: Layout[] = DEFS.map((def) => ({ ...def, slots: slotsOf(def) }));

export const layoutById = (id: string) => LAYOUTS.find((l) => l.id === id);

/** Layouts open at `level` (the highest level reached). */
export const openLayouts = (level: number) => LAYOUTS.filter((l) => l.unlock <= level);
