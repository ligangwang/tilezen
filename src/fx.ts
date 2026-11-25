// Motion that is only for show: a picked tile's flight to the tray, a
// matched pair's pop, and the petals and sparks drawn on a canvas over the
// board. None of it holds up play, and all of it is skipped for a player
// who asked their device for less motion.

/** How long a tile takes to fly to the tray, and a matched pair to pop. */
export const FLY_MS = 300;
export const POP_MS = 340;

const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Fly `el`, already at its place in the tray, in from where its tile left
 * the board: along a shallow arc, lifted a little on the way.
 */
export function fly(el: HTMLElement, from: DOMRect) {
  const to = el.getBoundingClientRect();
  if (typeof el.animate !== "function" || !to.width || calm()) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width;
  // The arc's middle is pushed out to the side the tile came from.
  const bow = Math.min(90, Math.hypot(dx, dy) * 0.22) * (dx < 0 ? -1 : 1);
  const frames: Keyframe[] = [];
  const steps = 14;
  for (let k = 0; k <= steps; k++) {
    // Quick away, gentle in.
    const e = 1 - (1 - k / steps) ** 3;
    const x = (1 - e) * (1 - e) * dx + 2 * e * (1 - e) * (dx / 2 + bow);
    const y = (1 - e) * (1 - e) * dy + 2 * e * (1 - e) * (dy / 2);
    const s = scale + (1 - scale) * e + 0.16 * Math.sin(Math.PI * e);
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})` });
  }
  el.style.zIndex = "400";
  const flight = el.animate(frames, { duration: FLY_MS, easing: "linear" });
  flight.onfinish = flight.oncancel = () => {
    el.style.zIndex = "";
  };
}

/** A matched tile swells, brightens and goes, leaning `lean` (±1) into its twin. */
export function pop(el: HTMLElement, delay: number, lean: number) {
  if (typeof el.animate !== "function" || calm()) return;
  const meet = `translateX(${lean * 22}%)`;
  el.animate(
    [
      { transform: "none", opacity: 1, filter: "brightness(1)" },
      { transform: `${meet} scale(1.16)`, opacity: 1, filter: "brightness(1.2)", offset: 0.4 },
      { transform: `${meet} scale(1.5)`, opacity: 0, filter: "brightness(2)" },
    ],
    { duration: POP_MS, delay, easing: "ease-out", fill: "forwards" },
  );
}

type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  turn: number;
  spin: number;
  size: number;
  age: number;
  life: number;
  color: string;
  /** A petal, which falls and flutters, or a spark, which flies and fades. */
  petal: boolean;
};

export type Fx = {
  canvas: HTMLCanvasElement;
  /** Petals and sparks thrown out from a point (in window coordinates). */
  burst(x: number, y: number, colors: string[]): void;
  /** Petals drifting down the whole board, for a board cleared. */
  rain(colors: string[]): void;
  clear(): void;
};

/** The petals and sparks, drawn on `canvas`; null where they can't be. */
export function createFx(canvas: HTMLCanvasElement): Fx | null {
  if (calm() || !canvas.getBoundingClientRect().width || typeof requestAnimationFrame !== "function") return null;
  const pen = canvas.getContext("2d");
  if (!pen) return null;
  let bits: Bit[] = [];
  let frame = 0;
  let last = 0;

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = (colors: string[]) => colors[Math.floor(Math.random() * colors.length)];

  function draw(now: number) {
    const dt = Math.min(0.04, (now - last) / 1000 || 0.016);
    last = now;
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(box.width * ratio) || canvas.height !== Math.round(box.height * ratio)) {
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
    }
    pen!.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen!.clearRect(0, 0, box.width, box.height);
    bits = bits.filter((b) => (b.age += dt) < b.life && b.y < box.height + 30);
    for (const b of bits) {
      if (b.age < 0) continue;
      const left = 1 - b.age / b.life;
      b.vy += (b.petal ? 520 : 160) * dt;
      // Air slows a spark quickly; a petal reaches a slow fall and sways.
      const drag = b.petal ? 2.2 : 3.2;
      b.vx -= b.vx * drag * dt;
      b.vy -= b.vy * drag * dt;
      b.x += (b.vx + (b.petal ? Math.sin(b.age * 5 + b.turn) * 26 : 0)) * dt;
      b.y += b.vy * dt;
      b.turn += b.spin * dt;
      pen!.save();
      pen!.translate(b.x, b.y);
      pen!.rotate(b.turn);
      pen!.globalAlpha = Math.min(1, left * (b.petal ? 2.5 : 1.6));
      pen!.fillStyle = b.color;
      if (b.petal) {
        // A petal, seen turning over as it falls.
        pen!.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(b.age * 4 + b.spin)));
        pen!.beginPath();
        pen!.moveTo(0, -b.size);
        pen!.bezierCurveTo(b.size * 0.9, -b.size * 0.5, b.size * 0.7, b.size * 0.7, 0, b.size);
        pen!.bezierCurveTo(-b.size * 0.7, b.size * 0.7, -b.size * 0.9, -b.size * 0.5, 0, -b.size);
        pen!.fill();
      } else {
        // A four-pointed spark with a soft light around it.
        const r = b.size * (0.5 + 0.5 * left);
        pen!.shadowColor = b.color;
        pen!.shadowBlur = 8;
        pen!.beginPath();
        for (let k = 0; k < 8; k++) {
          const d = k % 2 ? r * 0.32 : r;
          pen!.lineTo(Math.cos((k * Math.PI) / 4) * d, Math.sin((k * Math.PI) / 4) * d);
        }
        pen!.closePath();
        pen!.fill();
      }
      pen!.restore();
    }
    frame = bits.length ? requestAnimationFrame(draw) : 0;
  }
  function add(more: Bit[]) {
    bits.push(...more);
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(draw);
    }
  }

  return {
    canvas,
    burst(x, y, colors) {
      const box = canvas.getBoundingClientRect();
      const more: Bit[] = [];
      for (let k = 0; k < 26; k++) {
        const petal = k % 2 === 0;
        const angle = rand(0, Math.PI * 2);
        const speed = petal ? rand(160, 420) : rand(220, 620);
        more.push({
          x: x - box.left,
          y: y - box.top,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (petal ? 220 : 60),
          turn: rand(0, 6),
          spin: rand(-6, 6),
          size: petal ? rand(5, 9) : rand(4, 8),
          age: 0,
          life: petal ? rand(0.9, 1.5) : rand(0.4, 0.75),
          // Sparks are light; petals take the theme's colours.
          color: petal ? pick(colors) : pick(["#fff7d6", "#ffd76a", "#ffffff"]),
          petal,
        });
      }
      add(more);
    },
    rain(colors) {
      const box = canvas.getBoundingClientRect();
      const more: Bit[] = [];
      for (let k = 0; k < 90; k++)
        more.push({
          x: rand(0, box.width),
          y: rand(-40, -10),
          vx: rand(-30, 30),
          vy: rand(20, 120),
          turn: rand(0, 6),
          spin: rand(-4, 4),
          size: rand(6, 11),
          // They start a few at a time.
          age: -rand(0, 1.6),
          life: rand(3.5, 5.5),
          color: pick(colors),
          petal: true,
        });
      add(more);
    },
    clear() {
      bits = [];
    },
  };
}
