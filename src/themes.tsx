// Tile faces. Every theme has 36 faces: four suits of nine. They are drawn
// here as SVG, our own designs, in strong colours on a light tile so they
// stay easy to tell apart, large or small.
import type { ReactNode } from "react";
import { GLYPHS } from "./glyphs";

export const FACE_COUNT = 36;

export type ThemeId = "classic" | "garden" | "sea" | "night";
export type Theme = {
  id: ThemeId;
  name: string;
  /** The level that opens it. */
  unlock: number;
  /**
   * A tile is two layers, like a real one: a pale front (`tile`, shaded to
   * `edge` down its side) on a coloured back. Then the table under the board.
   */
  tile: string;
  edge: string;
  back: string;
  table: [string, string];
};

export const THEMES: Theme[] = [
  { id: "classic", name: "Classic", unlock: 1, tile: "#fffcf4", edge: "#e6d8b8", back: "#1f9d76", table: ["#2d6a5a", "#12332b"] },
  { id: "garden", name: "Garden", unlock: 6, tile: "#fffdf6", edge: "#ddd0a8", back: "#b5673c", table: ["#5b7a4a", "#2c4126"] },
  { id: "sea", name: "Sea", unlock: 14, tile: "#f7fbff", edge: "#cfdbe6", back: "#2a78b0", table: ["#2a5d7c", "#112c40"] },
  { id: "night", name: "Starry Night", unlock: 24, tile: "#fbf9ff", edge: "#d6d0e6", back: "#5a4bb0", table: ["#3b3470", "#171433"] },
];
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const openThemes = (level: number) => THEMES.filter((t) => t.unlock <= level);

const INK = "#1d1d1f";
const RED = "#c8102e";
const GREEN = "#13795b";
const BLUE = "#1747a6";

// ---- Classic: dots, sticks, numerals and honours, in our own drawing ----

/** Where n pips sit, in a 0..1 box. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.5, 0.2], [0.5, 0.8]],
  3: [[0.18, 0.15], [0.5, 0.5], [0.82, 0.85]],
  4: [[0.22, 0.2], [0.78, 0.2], [0.22, 0.8], [0.78, 0.8]],
  5: [[0.2, 0.17], [0.8, 0.17], [0.5, 0.5], [0.2, 0.83], [0.8, 0.83]],
  6: [[0.25, 0.12], [0.75, 0.12], [0.25, 0.5], [0.75, 0.5], [0.25, 0.88], [0.75, 0.88]],
  7: [[0.15, 0.08], [0.5, 0.2], [0.85, 0.32], [0.25, 0.62], [0.75, 0.62], [0.25, 0.92], [0.75, 0.92]],
  8: [[0.25, 0.08], [0.75, 0.08], [0.25, 0.36], [0.75, 0.36], [0.25, 0.64], [0.75, 0.64], [0.25, 0.92], [0.75, 0.92]],
  9: [[0.15, 0.12], [0.5, 0.12], [0.85, 0.12], [0.15, 0.5], [0.5, 0.5], [0.85, 0.5], [0.15, 0.88], [0.5, 0.88], [0.85, 0.88]],
};
/** The pip area of a face (62 × 84): the whole face, with a margin. */
const AREA = { x: 11, y: 13, w: 40, h: 58 };
const at = ([u, v]: [number, number]) => [AREA.x + u * AREA.w, AREA.y + v * AREA.h];

function dots(n: number) {
  const r = n === 1 ? 15 : n <= 4 ? 8.5 : n <= 6 ? 7.5 : 6.4;
  const colors = [BLUE, GREEN, RED];
  return (
    <>
      {PIPS[n].map((p, i) => {
        const [x, y] = at(p);
        const c = n === 1 ? RED : colors[(i + n) % 3];
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={c} />
            <circle cx={x} cy={y} r={r * 0.62} fill="#fff" />
            <circle cx={x} cy={y} r={r * 0.34} fill={c} />
          </g>
        );
      })}
    </>
  );
}

function sticks(n: number) {
  const h = n <= 2 ? 22 : n <= 6 ? 18 : 13;
  const w = n <= 4 ? 7 : 6;
  if (n === 1)
    return (
      <>
        {/* A single tall reed with its leaves. */}
        <g transform="translate(0 -5)">
          <rect x="27" y="22" width="8" height="52" rx="4" fill={GREEN} />
          <rect x="26" y="38" width="10" height="3" fill="#fff" />
          <rect x="26" y="56" width="10" height="3" fill="#fff" />
          <path d="M31 30 C 20 26 14 32 12 40 C 22 38 27 36 31 30 Z" fill="#2fa36b" />
          <path d="M31 46 C 42 42 48 48 50 56 C 40 54 35 52 31 46 Z" fill="#2fa36b" />
          <circle cx="31" cy="20" r="4" fill={RED} />
        </g>
      </>
    );
  return (
    <>
      {PIPS[n].map((p, i) => {
        const [x, y] = at(p);
        const c = (n === 5 || n === 9) && i === 4 ? RED : n === 7 && i === 1 ? RED : GREEN;
        return (
          <g key={i}>
            <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill={c} />
            <rect x={x - w / 2 - 0.5} y={y - 1} width={w + 1} height="2" fill="#fff" />
          </g>
        );
      })}
    </>
  );
}

/**
 * A tile character, its outline centred on x, y and `size` tall an em. The
 * thin strokes are filled out a little so they hold at small sizes.
 */
function han(ch: string, x: number, y: number, size: number, fill: string) {
  const [d, w, h] = GLYPHS[ch];
  const k = size / 100;
  return (
    <path
      d={d}
      transform={`translate(${x - (w * k) / 2} ${y - (h * k) / 2}) scale(${k})`}
      fill={fill}
      stroke={fill}
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
  );
}

const NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
function numeral(n: number) {
  return (
    <>
      {han(NUMERALS[n - 1], 31, 24, 31, BLUE)}
      {han("萬", 31, 59, 33, RED)}
    </>
  );
}

const HONOURS: [string, string][] = [
  ["東", INK],
  ["南", INK],
  ["西", INK],
  ["北", INK],
  ["中", RED],
  ["發", GREEN],
  ["", BLUE],
  ["春", "#a3317a"],
  ["秋", "#c25e00"],
];
function honour(n: number) {
  const [ch, color] = HONOURS[n - 1];
  if (!ch)
    return (
      // The blank honour: a framed panel.
      <g fill="none" stroke={BLUE} strokeWidth="4">
        <rect x="14" y="16" width="34" height="54" rx="3" />
        <rect x="21" y="23" width="20" height="40" rx="2" strokeWidth="2.5" />
      </g>
    );
  return han(ch, 31, 42, 46, color);
}

// ---- Picture themes: a suit's picture, drawn once for each of its number ----

type Icon = (color: string) => ReactNode;
const ICONS: Record<string, Icon> = {
  blossom: (c) => (
    <g fill={c}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="20" cy="9" rx="7" ry="9" transform={`rotate(${a} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="5.5" fill="#f5c400" />
    </g>
  ),
  leaf: (c) => (
    <g>
      <path d="M6 34 C 6 14 18 4 36 4 C 36 22 26 34 6 34 Z" fill={c} />
      <path d="M8 32 L 30 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  sun: (c) => (
    <g fill={c} stroke={c} strokeWidth="3.5" strokeLinecap="round">
      <circle cx="20" cy="20" r="9" stroke="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="20" y1="2" x2="20" y2="7" transform={`rotate(${a} 20 20)`} />
      ))}
    </g>
  ),
  drop: (c) => (
    <g>
      <path d="M20 2 C 26 12 33 19 33 26 A 13 13 0 0 1 7 26 C 7 19 14 12 20 2 Z" fill={c} />
      <path d="M13 26 A 7 7 0 0 0 19 33" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  fish: (c) => (
    <g fill={c}>
      <ellipse cx="17" cy="20" rx="14" ry="9" />
      <path d="M28 20 L 39 11 L 39 29 Z" />
      <circle cx="10" cy="18" r="2.4" fill="#fff" />
    </g>
  ),
  shell: (c) => (
    <g>
      <path d="M20 36 L 3 16 A 18 14 0 0 1 37 16 Z" fill={c} />
      {[-12, -6, 0, 6, 12].map((dx) => (
        <line key={dx} x1="20" y1="34" x2={20 + dx * 1.4} y2="7" stroke="#fff" strokeWidth="1.8" />
      ))}
    </g>
  ),
  starfish: (c) => (
    <path
      d="M20 2 L 25 15 L 38 15 L 27.5 23.5 L 31.5 37 L 20 29 L 8.5 37 L 12.5 23.5 L 2 15 L 15 15 Z"
      fill={c}
      stroke={c}
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  ),
  wave: (c) => (
    <g fill="none" stroke={c} strokeWidth="5" strokeLinecap="round">
      <path d="M3 14 Q 11 6 19 14 T 37 14" />
      <path d="M3 27 Q 11 19 19 27 T 37 27" />
    </g>
  ),
  moon: (c) => <path d="M26 3 A 17 17 0 1 0 37 28 A 13 13 0 1 1 26 3 Z" fill={c} />,
  star: (c) => (
    <path
      d="M20 2 L 24.5 14 L 37 14.5 L 27 22.5 L 30.5 35 L 20 27.5 L 9.5 35 L 13 22.5 L 3 14.5 L 15.5 14 Z"
      fill={c}
    />
  ),
  lantern: (c) => (
    <g>
      <rect x="15" y="2" width="10" height="5" rx="1.5" fill="#3a3a3a" />
      <ellipse cx="20" cy="20" rx="14" ry="13" fill={c} />
      <path d="M20 7 V 33 M 12 9.5 Q 6 20 12 30.5 M 28 9.5 Q 34 20 28 30.5" stroke="#ffd36b" strokeWidth="1.8" fill="none" />
      <rect x="15" y="33" width="10" height="4" rx="1.5" fill="#3a3a3a" />
    </g>
  ),
  cloud: (c) => (
    <g fill={c}>
      <circle cx="13" cy="22" r="8" />
      <circle cx="22" cy="16" r="10" />
      <circle cx="30" cy="23" r="7" />
      <rect x="9" y="22" width="24" height="9" rx="4.5" />
    </g>
  ),
};

const PICTURE_SUITS: Record<Exclude<ThemeId, "classic">, [string, string][]> = {
  garden: [["blossom", "#c2185b"], ["leaf", "#2e7d32"], ["sun", "#e65100"], ["drop", "#1565c0"]],
  sea: [["fish", "#1565c0"], ["shell", "#ad1457"], ["starfish", "#ef6c00"], ["wave", "#00838f"]],
  night: [["moon", "#5e35b1"], ["star", "#e09100"], ["lantern", "#c62828"], ["cloud", "#455a64"]],
};

/**
 * A numbered face of a picture theme: the suit's picture as many times as
 * the number, laid out like the classic dots, so no tile carries a digit.
 * The icons are drawn in a 40 × 40 box.
 */
function picture(theme: Exclude<ThemeId, "classic">, suit: number, n: number) {
  const [icon, color] = PICTURE_SUITS[theme][suit];
  const size = n === 1 ? 1 : n <= 4 ? 0.52 : n <= 6 ? 0.44 : 0.33;
  return (
    <>
      {PIPS[n].map((p, i) => {
        const [x, y] = at(p);
        return (
          <g key={i} transform={`translate(${x - 20 * size} ${y - 20 * size}) scale(${size})`}>
            {ICONS[icon](color)}
          </g>
        );
      })}
    </>
  );
}

/** The drawing on one tile, in a 62 × 84 box. */
export function faceArt(theme: ThemeId, face: number): ReactNode {
  // Drawn once and kept: handing React the very same drawing again lets it
  // skip the tile's whole picture when the board changes.
  const key = `${theme}:${face}`;
  let art = drawn.get(key);
  if (!art) {
    const suit = Math.floor(face / 9);
    const n = (face % 9) + 1;
    art = <g filter="url(#tz-carve)">{theme === "classic" ? [dots, sticks, numeral, honour][suit](n) : picture(theme, suit, n)}</g>;
    drawn.set(key, art);
  }
  return art;
}
const drawn = new Map<string, ReactNode>();

/**
 * What the tile drawings share, to put on the page once: the filter that
 * carves a drawing into its tile. Light comes from the top left, so each
 * shape gets a shaded inner edge there and a bright lip along its far side,
 * like paint in a cut groove.
 */
export function TileDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="tz-carve" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feOffset in="SourceAlpha" dx="0.7" dy="0.9" result="lipShape" />
          <feFlood floodColor="#fff" />
          <feComposite in2="lipShape" operator="in" result="lip" />
          <feOffset in="SourceAlpha" dx="1" dy="1.3" />
          <feGaussianBlur stdDeviation="0.55" result="lit" />
          <feComposite in="SourceAlpha" in2="lit" operator="out" result="shadeShape" />
          <feFlood floodColor="#000" floodOpacity="0.5" />
          <feComposite in2="shadeShape" operator="in" result="shade" />
          <feMerge>
            <feMergeNode in="lip" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shade" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

const HONOUR_NAMES = ["East", "South", "West", "North", "Red", "Green", "White", "Spring", "Autumn"];
const SUIT_NAMES: Record<string, string> = {
  dots: "Dots {0}",
  sticks: "Sticks {0}",
  numerals: "Numerals {0}",
  blossom: "Blossom {0}",
  leaf: "Leaf {0}",
  sun: "Sun {0}",
  drop: "Raindrop {0}",
  fish: "Fish {0}",
  shell: "Shell {0}",
  starfish: "Starfish {0}",
  wave: "Wave {0}",
  moon: "Moon {0}",
  star: "Star {0}",
  lantern: "Lantern {0}",
  cloud: "Cloud {0}",
};
/** Every English name a tile can be read out with, for the translation packs. */
export const FACE_NAMES = [...HONOUR_NAMES, ...Object.values(SUIT_NAMES)];

/**
 * A short spoken name for a face, for screen readers: English text and its
 * number, to pass through t().
 */
export function faceLabel(theme: ThemeId, face: number): [string, string?] {
  const suit = Math.floor(face / 9);
  const n = String((face % 9) + 1);
  if (theme === "classic") {
    if (suit === 3) return [HONOUR_NAMES[Number(n) - 1]];
    return [SUIT_NAMES[["dots", "sticks", "numerals"][suit]], n];
  }
  return [SUIT_NAMES[PICTURE_SUITS[theme][suit][0]], n];
}
