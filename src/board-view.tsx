// The board on screen: one button per tile, stacked in layers. Tiles are
// sized to fit the space; with large tiles on they keep a bigger size and
// the board scrolls instead.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Session } from "./engine/session";
import { isFree } from "./engine/board";
import { faceArt, faceLabel, type Theme } from "./themes";
import { useLocale } from "./dingn";

/** A tile's height over its width. */
const TALL = 1.36;
/** How much of a tile's width each layer lifts it up and to the left. */
const DEPTH = 0.11;
/** Large tiles are at least this wide, in CSS pixels. */
export const LARGE_MIN = 66;

type Props = {
  session: Session;
  theme: Theme;
  selected: number | null;
  hint: [number, number] | null;
  /** Tiles just taken off, fading out. */
  leaving: number[];
  /** A tile that was tapped while blocked, which wiggles. */
  shake: number | null;
  dim: boolean;
  large: boolean;
  onTile: (i: number) => void;
};

export function BoardView(props: Props) {
  const { session, theme, selected, hint, leaving, shake, dim, large, onTile } = props;
  const { t } = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ w: 360, h: 480 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSpace({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

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
    box.current?.querySelector(`[data-tile="${hint[0]}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [hint, scrolls]);

  const order = slots
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => session.present[i] || leaving.includes(i))
    .sort((a, b) => a.s.z - b.s.z || a.s.y - b.s.y || a.s.x - b.s.x);

  return (
    <div className={`board-box${scrolls ? " scrolls" : ""}`} ref={box}>
      <div
        className="board"
        style={{ width: boardW, height: boardH, ["--tile" as string]: theme.tile, ["--edge" as string]: theme.edge }}
      >
        {order.map(({ s, i }) => {
          const gone = !session.present[i];
          const open = !gone && isFree(session.g, session.present, i);
          const cls = [
            "tile",
            s.z > 0 ? "raised" : "",
            open ? "free" : "blocked",
            dim && !open && !gone ? "dim" : "",
            selected === i ? "selected" : "",
            hint && hint.includes(i) ? "hinted" : "",
            gone ? "leaving" : "",
            shake === i ? "shake" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={i}
              type="button"
              data-tile={i}
              className={cls}
              aria-label={faceLabel(theme.id, session.faces[i]) + (open ? "" : `, ${t("blocked")}`)}
              aria-pressed={selected === i}
              disabled={gone}
              onClick={() => onTile(i)}
              style={{
                left: (s.x / 2) * w + (maxZ - s.z) * d,
                top: (s.y / 2) * h + (maxZ - s.z) * d,
                width: w,
                height: h,
                zIndex: s.z * 10 + 1,
                ["--d" as string]: `${d}px`,
              }}
            >
              <span className="face">
                <svg viewBox="0 0 62 84" aria-hidden="true">
                  {faceArt(theme.id, session.faces[i])}
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
