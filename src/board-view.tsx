// The board on screen: one button per tile, stacked in layers. Tiles are
// sized to fit the space; with large tiles on they keep a bigger size and
// the board scrolls instead.
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Session } from "./engine/session";
import { isFree } from "./engine/board";
import { TILE_PICTURE, bitmap, faceLabel, madeBitmap, tileImage, type Theme } from "./themes";
import { useLocale } from "./dingn";

/** A tile's height over its width. */
const TALL = 1.36;
/** How much of a tile's width each layer lifts it up and to the left. */
const DEPTH = 0.18;
/** Large tiles are at least this wide, in CSS pixels. */
export const LARGE_MIN = 66;

type Props = {
  session: Session;
  theme: Theme;
  hint: number[] | null;
  /** A tile that was tapped while blocked, which wiggles. */
  shake: number | null;
  large: boolean;
  onTile: (i: number) => void;
};

export function BoardView(props: Props) {
  const { session, theme, hint, shake, large, onTile } = props;
  // One handler for every tile that keeps its identity, so a tile that
  // didn't change isn't drawn again (Tile is memoised).
  const latest = useRef(onTile);
  latest.current = onTile;
  const [tap] = useState(() => (i: number) => latest.current(i));
  const { t } = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ w: 360, h: 480 });
  // A new board is dealt onto the table, tile after tile.
  const [dealing, setDealing] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setDealing(false), 1100);
    return () => clearTimeout(id);
  }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSpace({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const label = (face: number) => {
    const [name, n] = faceLabel(theme.id, face);
    return n ? t(name, n) : t(name);
  };

  const slots = session.g.slots;
  const maxX = Math.max(...slots.map((s) => s.x)) + 2;
  const maxY = Math.max(...slots.map((s) => s.y)) + 2;
  const maxZ = Math.max(...slots.map((s) => s.z));
  const pad = 12;
  const fit = Math.min(
    (space.w - pad * 2) / (maxX / 2 + (maxZ + 1) * DEPTH),
    (space.h - pad * 2) / ((maxY / 2) * TALL + (maxZ + 1) * DEPTH),
  );
  const w = Math.floor(large ? Math.max(fit, LARGE_MIN) : Math.min(fit, 104));
  const h = w * TALL;
  const d = Math.max(3, w * DEPTH);
  const boardW = (maxX / 2) * w + (maxZ + 1) * d;
  const boardH = (maxY / 2) * h + (maxZ + 1) * d;
  const scrolls = boardW > space.w || boardH > space.h;

  // Bring a hinted tile into view when the board scrolls.
  useEffect(() => {
    if (!hint || !scrolls) return;
    box.current?.querySelector(`[data-tile="${hint[hint.length - 1]}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [hint, scrolls]);

  const at = (i: number) => ({
    left: (slots[i].x / 2) * w + (maxZ - slots[i].z) * d,
    top: (slots[i].y / 2) * h + (maxZ - slots[i].z) * d,
  });
  const order = slots
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => session.present[i])
    .sort((a, b) => a.s.z - b.s.z || a.s.y - b.s.y || a.s.x - b.s.x);

  return (
    <div className={`board-box${scrolls ? " scrolls" : ""}`} ref={box}>
      <div
        className={`board${dealing ? " dealing" : ""}`}
        style={{ width: boardW, height: boardH }}
      >
        {order.map(({ s, i }, n) => {
          const open = isFree(session.g, session.present, i);
          const cls = [
            "tile",
            s.z > 0 ? "raised" : "",
            open ? "free" : "blocked",
            hint && hint.includes(i) ? "hinted" : "",
            hint && hint[hint.length - 1] === i ? "pick-next" : "",
            shake === i ? "shake" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const { left, top } = at(i);
          return (
            <Tile
              key={i}
              i={i}
              cls={cls}
              label={label(session.faces[i]) + (open ? "" : `, ${t("blocked")}`)}
              theme={theme}
              face={session.faces[i]}
              left={left}
              top={top}
              w={w}
              h={h}
              d={d}
              z={s.z}
              n={n}
              onTile={tap}
            />
          );
        })}
      </div>
    </div>
  );
}

type TileProps = {
  i: number;
  cls: string;
  label: string;
  theme: Theme;
  face: number;
  left: number;
  top: number;
  w: number;
  h: number;
  d: number;
  z: number;
  n: number;
  onTile: (i: number) => void;
};

/** One tile on the board, drawn again only when something about it changes. */
const Tile = memo(function Tile({ i, cls, label, theme, face, left, top, w, h, d, z, n, onTile }: TileProps) {
  const style: CSSProperties & Record<string, string | number> = {
    left,
    top,
    width: w,
    height: h,
    zIndex: z * 10 + 1,
    "--n": n,
    "--d": `${d}px`,
    "--r": `${(w * 0.12).toFixed(1)}px`,
  };
  const { src, pw, ph } = useTilePicture(theme, face, w, h);
  return (
    <button type="button" data-tile={i} className={cls} aria-label={label} onClick={() => onTile(i)} style={style}>
      {/* The whole tile is one picture (themes.tsx), which phones show
          without redrawing; the ring above it only lights for a hint. */}
      <img className="pic" src={src} alt="" draggable={false} style={{ width: pw, height: ph }} />
      <span className="ring" />
    </button>
  );
});

/**
 * A tile's picture for a tile `w` x `h` on screen (its own box): the
 * picture's size (it runs past the box for the shadow) and its source.
 */
export function useTilePicture(theme: Theme, face: number, w: number, h: number) {
  const pw = (w * TILE_PICTURE.w) / 100;
  const ph = (h * TILE_PICTURE.h) / 136;
  const svg = tileImage(theme, face);
  // Usually made already, ahead of play (prepareTiles); if not, the
  // vector picture shows until its bitmap is ready.
  const [pic, setPic] = useState<{ svg: string; src: string }>(() => ({ svg, src: madeBitmap(svg) ?? svg }));
  useEffect(() => {
    const made = madeBitmap(svg);
    if (made) return setPic({ svg, src: made });
    let live = true;
    void bitmap(svg).then((src) => live && setPic({ svg, src }));
    return () => {
      live = false;
    };
  }, [svg]);
  return { src: pic.svg === svg ? pic.src : madeBitmap(svg) ?? svg, pw, ph };
}
