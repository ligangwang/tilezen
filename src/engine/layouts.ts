// Tile Zen's layouts, all our own shapes. Each layer is drawn as rows of
// text, one character a tile ("#" a tile, "." empty), and moved by `at`
// (in half tiles) so a layer can sit half a tile over the one below.
// Layouts open one by one as the player clears levels (`unlock`).
import type { Slot } from "./board";

type Layer = { at?: [number, number]; rows: string[] };
export type LayoutDef = {
  id: string;
  name: { en: string; zh: string };
  /** The level that first plays it, and opens it in Free play. */
  unlock: number;
  layers: Layer[];
};
export type Layout = LayoutDef & { slots: Slot[] };

const DEFS: LayoutDef[] = [
  {
    id: "pebble",
    name: { en: "Pebble", zh: "卵石" },
    unlock: 1,
    layers: [
      { rows: ["####", "####", "####"] },
      { at: [2, 2], rows: ["##"] },
    ],
  },
  {
    id: "stream",
    name: { en: "Stream", zh: "小溪" },
    unlock: 2,
    layers: [
      { rows: [".######.", "########", ".######."] },
      { at: [4, 2], rows: ["####"] },
    ],
  },
  {
    id: "lotus",
    name: { en: "Lotus", zh: "莲花" },
    unlock: 3,
    layers: [
      { rows: ["..##..", ".####.", "######", ".####.", "..##.."] },
      { at: [2, 2], rows: [".##.", "####", ".##."] },
      { at: [4, 4], rows: ["##"] },
    ],
  },
  {
    id: "bridge",
    name: { en: "Stone Bridge", zh: "石桥" },
    unlock: 5,
    layers: [
      { rows: ["########", "##....##", "########"] },
      { at: [2, 0], rows: ["######", "......", "######"] },
      { at: [4, 0], rows: ["####", "....", "####"] },
    ],
  },
  {
    id: "moongate",
    name: { en: "Moon Gate", zh: "月门" },
    unlock: 7,
    layers: [
      { rows: ["..####..", ".##..##.", "##....##", "##....##", ".##..##.", "..####.."] },
      { at: [1, 1], rows: [".#####.", "##...##", "#.....#", "##...##", ".#####."] },
    ],
  },
  {
    id: "lantern",
    name: { en: "Lantern", zh: "灯笼" },
    unlock: 9,
    layers: [
      { rows: [".####.", "######", "######", "######", ".####."] },
      { at: [2, 2], rows: [".##.", "####", "####", ".##."] },
      { at: [4, 4], rows: ["##", "##"] },
    ],
  },
  {
    id: "butterfly",
    name: { en: "Butterfly", zh: "蝴蝶" },
    unlock: 12,
    layers: [
      { rows: ["##....##", "###..###", "########", "###..###", "##....##"] },
      { at: [2, 2], rows: ["##..##", "######", "##..##"] },
      { at: [6, 4], rows: ["##"] },
    ],
  },
  {
    id: "cloud",
    name: { en: "Cloud", zh: "祥云" },
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
    name: { en: "Pagoda", zh: "宝塔" },
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
    name: { en: "Folding Fan", zh: "折扇" },
    unlock: 22,
    layers: [
      { rows: ["##.##.##.##", "##########.", ".#########.", "..#######..", "...#####...", "....###...."] },
      { at: [2, 2], rows: ["########", ".######.", "..####.."] },
      { at: [4, 2], rows: ["######"] },
    ],
  },
  {
    id: "mountain",
    name: { en: "Far Mountains", zh: "远山" },
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
    name: { en: "Twin Peaks", zh: "双峰" },
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
    name: { en: "Courtyard", zh: "庭院" },
    unlock: 35,
    layers: [
      { rows: ["##########", "##########", "##.####.##", "##.####.##", "##########", "##########"] },
      { at: [2, 2], rows: ["########", "#.####.#", "#.####.#", "########"] },
      { at: [6, 5], rows: ["####"] },
    ],
  },
  {
    id: "temple",
    name: { en: "Mountain Temple", zh: "古寺" },
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
