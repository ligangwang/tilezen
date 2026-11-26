// Motion that is only for show: a picked tile's flight to the tray, a
// matched pair rising as one card, and the petals and sparks drawn on a canvas over the
// board. None of it holds up play, and all of it is skipped for a player
// who asked their device for less motion.

/** How long a picked tile takes to lift and fly to the tray, and to rest there before a match. */
export const FLY_MS = 380;
export const REST_MS = 110;
/** How long a matched pair takes to rise, meet as one card, and go. */
export const MELD_MS = 1100;
/** When in the meld the pair meets: the moment for petals, points and the chime. */
export const MEET_AT = 0.34;

const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Fly `el`, already at its place in the tray, in from where its tile left
 * the board, as a hand would move it: lifted off the board first, carried
 * straight to its place, then set down with a small settle.
 */
export function fly(el: HTMLElement, from: DOMRect, fx?: Fx | null) {
  const to = el.getBoundingClientRect();
  if (typeof el.animate !== "function" || !to.width || calm()) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width;
  const LIFT = 0.16;
  const LAND = 0.84;
  const frames: Keyframe[] = [];
  const shadow = (k: number) => `drop-shadow(0 ${(4 + 14 * k).toFixed(1)}px ${(4 + 12 * k).toFixed(1)}px rgba(0,0,0,${(0.2 + 0.25 * k).toFixed(2)}))`;
  // Lifted where it lay: up a little, a little bigger, its shadow wider.
  frames.push({ offset: 0, transform: `translate(${dx}px, ${dy}px) scale(${scale})`, filter: shadow(0) });
  frames.push({ offset: LIFT, transform: `translate(${dx}px, ${dy - 10}px) scale(${scale * 1.12})`, filter: shadow(1) });
  // Carried straight to its place, quick in the middle and gentle at the ends.
  const steps = 8;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const e = ease(t);
    const x = dx * (1 - e);
    const y = (dy - 10) * (1 - e);
    const s = (scale + (1 - scale) * e) * (1.12 - 0.08 * e);
    frames.push({ offset: LIFT + (LAND - LIFT) * t, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`, filter: shadow(1 - 0.5 * t) });
  }
  // Set down: a touch low and wide, then still.
  frames.push({ offset: 0.92, transform: "translate(0, 2px) scale(1.04, 0.95)", filter: shadow(0.1) });
  frames.push({ offset: 1, transform: "none", filter: shadow(0) });
  el.style.zIndex = "400";
  const flight = el.animate(frames, { duration: FLY_MS, easing: "linear" });
  flight.onfinish = flight.oncancel = () => {
    el.style.zIndex = "";
  };
  // A faint trail of light behind it.
  fx?.follow(el, FLY_MS * LAND, FLY_MS * LIFT);
}

/**
 * A matched pair leaves the tray as one: copies of its two tiles rise
 * above it and grow, draw back a little, then rush together and collide:
 * they squash, bounce apart and settle touching, with a flash at the seam
 * and a ring of light, and the card they make lights up and fades. The tiles themselves can leave the tray at once. Returns where and
 * when (ms from now) they meet, or null when there is no motion to show.
 */
export function meld(layer: HTMLElement, a: HTMLElement, b: HTMLElement): { x: number; y: number; at: number } | null {
  if (typeof layer.animate !== "function" || calm()) return null;
  const box = layer.getBoundingClientRect();
  const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
  if (!ra.width) return null;
  const w = ra.width;
  const h = ra.height;
  const mid = (ra.left + rb.right) / 2;
  const card = document.createElement("div");
  card.className = "meld";
  Object.assign(card.style, { left: `${mid - w - box.left}px`, top: `${ra.top - box.top}px`, width: `${2 * w}px`, height: `${h}px` });
  const glow = document.createElement("div");
  glow.className = "meld-glow";
  card.append(glow);
  // Where they hit: a flash along the seam, and a ring that spreads from it.
  const flash = document.createElement("div");
  flash.className = "meld-flash";
  const ring = document.createElement("div");
  ring.className = "meld-ring";
  const tiles = [a, b].map((el, k) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.removeAttribute("data-tray");
    copy.removeAttribute("aria-label");
    copy.className = "tray-place held meld-tile";
    Object.assign(copy.style, {
      width: `${w}px`,
      height: `${h}px`,
      left: `${(k ? rb.left : ra.left) - (mid - w)}px`,
      // Each squashes against the side that takes the hit.
      transformOrigin: k ? "0% 50%" : "100% 50%",
    });
    card.append(copy);
    return copy;
  });
  card.append(flash, ring);
  layer.append(card);
  const rise = -h * 1.35;
  const grow = 1.45;
  const opts = { duration: MELD_MS, fill: "forwards" as const };
  card.animate(
    [
      { offset: 0, transform: "none", opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
      { offset: 0.24, transform: `translateY(${rise}px) scale(${grow})`, opacity: 1 },
      // The hit shakes the card they make, and it swells for a moment.
      { offset: MEET_AT, transform: `translateY(${rise}px) scale(${grow})`, opacity: 1 },
      { offset: MEET_AT + 0.02, transform: `translate(4px, ${rise - 2}px) scale(${grow * 1.08})`, opacity: 1 },
      { offset: MEET_AT + 0.05, transform: `translate(-4px, ${rise + 1}px) scale(${grow * 1.05})`, opacity: 1 },
      { offset: MEET_AT + 0.08, transform: `translate(2px, ${rise}px) scale(${grow * 1.02})`, opacity: 1 },
      { offset: MEET_AT + 0.11, transform: `translateY(${rise}px) scale(${grow})`, opacity: 1 },
      { offset: 0.8, transform: `translateY(${rise}px) scale(${grow})`, opacity: 1, easing: "ease-in" },
      { offset: 1, transform: `translateY(${rise - 18}px) scale(${grow * 1.12})`, opacity: 0 },
    ],
    opts,
  );
  // The two draw back, rush together faster and faster, and hit: each
  // squashes, bounces back, and comes to rest against the other.
  tiles.forEach((copy, k) => {
    const start = parseFloat(copy.style.left);
    const shift = k * w - start;
    const toward = k ? -1 : 1;
    const at = (x: number) => `translateX(${(shift + x * toward).toFixed(1)}px)`;
    copy.animate(
      [
        { offset: 0, transform: "none" },
        { offset: 0.2, transform: `translateX(${(-toward * w * 0.32).toFixed(1)}px)`, easing: "cubic-bezier(.6,0,1,.5)" },
        { offset: MEET_AT, transform: `${at(0)} scale(1.02, 0.98)` },
        { offset: MEET_AT + 0.035, transform: `${at(-w * 0.1)} scale(0.86, 1.06)`, easing: "ease-out" },
        { offset: MEET_AT + 0.09, transform: `${at(0)} scale(1.03, 0.98)`, easing: "ease-in" },
        { offset: MEET_AT + 0.13, transform: `${at(-w * 0.025)} scale(0.98, 1.01)` },
        { offset: MEET_AT + 0.18, transform: at(0) },
        { offset: 1, transform: at(0) },
      ],
      opts,
    );
  });
  flash.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: MEET_AT, opacity: 0, transform: "scaleX(0.4)" },
      { offset: MEET_AT + 0.015, opacity: 1, transform: "scaleX(1.6) scaleY(1.25)" },
      { offset: MEET_AT + 0.12, opacity: 0, transform: "scaleX(5) scaleY(1.1)" },
      { offset: 1, opacity: 0 },
    ],
    opts,
  );
  ring.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: MEET_AT, opacity: 0, transform: "translate(-50%, -50%) scale(0.2)" },
      { offset: MEET_AT + 0.02, opacity: 1, transform: "translate(-50%, -50%) scale(0.5)", easing: "cubic-bezier(.1,.7,.3,1)" },
      { offset: MEET_AT + 0.24, opacity: 0, transform: "translate(-50%, -50%) scale(2.4)" },
      { offset: 1, opacity: 0 },
    ],
    opts,
  );
  glow.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: MEET_AT - 0.04, opacity: 0 },
      { offset: MEET_AT + 0.06, opacity: 1, transform: "scale(1.08)" },
      { offset: 0.72, opacity: 0.9, transform: "scale(1)" },
      { offset: 1, opacity: 0, transform: "scale(1)" },
    ],
    opts,
  );
  setTimeout(() => card.remove(), MELD_MS + 50);
  return { x: mid, y: ra.top + h / 2 + rise, at: MELD_MS * MEET_AT };
}

/** A tile in the tray closes up a gap: it slides in from `dx` pixels away. */
export function slide(el: HTMLElement, dx: number) {
  if (typeof el.animate !== "function" || calm()) return;
  el.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 200, easing: "ease-out" });
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
  /** A faint trail of sparks behind `el` while it moves, for `ms` after `delay`. */
  follow(el: HTMLElement, ms: number, delay?: number): void;
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
      for (let k = 0; k < 36; k++) {
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
    follow(el, ms, delay = 0) {
      const box = () => canvas.getBoundingClientRect();
      const end = performance.now() + delay + ms;
      const start = performance.now() + delay;
      const step = (now: number) => {
        if (now > end || !el.isConnected) return;
        if (now >= start) {
          const r = el.getBoundingClientRect();
          const b = box();
          const more: Bit[] = [];
          for (let k = 0; k < 2; k++)
            more.push({
              x: r.left + r.width / 2 - b.left + rand(-r.width * 0.3, r.width * 0.3),
              y: r.top + r.height / 2 - b.top + rand(-r.height * 0.3, r.height * 0.3),
              vx: rand(-30, 30),
              vy: rand(-40, 10),
              turn: rand(0, 6),
              spin: rand(-4, 4),
              size: rand(2.5, 5),
              age: 0,
              life: rand(0.3, 0.55),
              color: pick(["#fff7d6", "#ffd76a", "#ffe9a8"]),
              petal: false,
            });
          add(more);
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
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
