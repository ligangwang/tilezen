// Motion that is only for show: a picked tile's flight to the tray, a
// matched pair rising as one card, and the petals and sparks drawn on a canvas over the
// board. None of it holds up play, and all of it is skipped for a player
// who asked their device for less motion.

/** How long a picked tile takes to lift and fly to the tray, and to rest there before a match. */
export const FLY_MS = 380;
export const REST_MS = 110;
/** How long a matched pair takes to rise, meet as one card, and go. */
export const MELD_MS = 1000;
/** When in the meld the pair meets: the moment for petals, points and the chime. */
export const MEET_AT = 0.36;

const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Fly `el`, already at its place in the tray, in from where its tile left
 * the board, as a hand would move it: lifted off the board first, carried
 * straight to its place, then set down with a small settle.
 */
export function fly(el: HTMLElement, from: DOMRect, fx?: Fx | null) {
  const to = el.getBoundingClientRect();
  if (typeof el.animate !== "function" || !to.width) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width;
  // A player who asked for less motion still sees where the tile went: a
  // short, plain glide, with no lift, settle or trail.
  if (calm()) {
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: "none" }], { duration: 160, easing: "ease-out" });
    return;
  }
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
 * A matched pair leaves the tray with a bang: copies of its two tiles rise
 * above it and grow, draw back, then rush together and collide, and at the
 * hit they burst: each breaks into shards that fly apart and fall, while a
 * flash of light, a shock ring and sparks go off where they met. The tiles
 * themselves can leave the tray at once. Returns where and when (ms from
 * now) they hit, or null when there is no motion to show.
 */
export function meld(layer: HTMLElement, a: HTMLElement, b: HTMLElement, fx?: Fx | null): { x: number; y: number; at: number } | null {
  if (typeof layer.animate !== "function") return null;
  if (calm()) {
    // Less motion: the pair simply fades where it was.
    for (const el of [a, b]) {
      const copy = el.cloneNode(true) as HTMLElement;
      const r = el.getBoundingClientRect();
      const box = layer.getBoundingClientRect();
      copy.removeAttribute("data-tray");
      copy.className = "tray-place held meld-tile";
      Object.assign(copy.style, { position: "absolute", left: `${r.left - box.left}px`, top: `${r.top - box.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      layer.append(copy);
      copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" });
      setTimeout(() => copy.remove(), 300);
    }
    return null;
  }
  const box = layer.getBoundingClientRect();
  const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
  if (!ra.width) return null;
  const w = ra.width;
  const h = ra.height;
  const mid = (ra.left + rb.right) / 2;
  const card = document.createElement("div");
  card.className = "meld";
  Object.assign(card.style, { left: `${mid - w - box.left}px`, top: `${ra.top - box.top}px`, width: `${2 * w}px`, height: `${h}px` });
  const copyOf = (el: HTMLElement) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.removeAttribute("data-tray");
    copy.removeAttribute("aria-label");
    copy.className = "tray-place held meld-tile";
    Object.assign(copy.style, { width: `${w}px`, height: `${h}px` });
    return copy;
  };
  // The tile's colours, for the chips drawn on the canvas.
  const style = getComputedStyle(a);
  const chipColors = [style.getPropertyValue("--tile").trim() || "#fffcf4", style.getPropertyValue("--edge").trim() || "#e6d8b8"];
  const back = style.getPropertyValue("--back").trim() || "#1f9d76";
  const chips: Chip[] = [];
  // Where a point of the card (in px, before it rose) is in the window at the hit.
  const cy = ra.top + h / 2;
  const toWindow = (x: number, y: number): [number, number] => [mid + (x - w) * 1.4, cy + -h * 1.35 + (y - h / 2) * 1.4];
  const tiles = [a, b].map((el, k) => {
    const copy = copyOf(el);
    Object.assign(copy.style, {
      left: `${(k ? rb.left : ra.left) - (mid - w)}px`,
      transformOrigin: k ? "0% 50%" : "100% 50%",
    });
    card.append(copy);
    return copy;
  });
  // The light of the hit: a burst, a flash along the seam, a shock ring.
  const light = ["meld-blast", "meld-flash", "meld-ring"].map((name) => {
    const el = document.createElement("div");
    el.className = name;
    return el;
  });
  layer.append(card);
  const rise = -h * 1.35;
  const grow = 1.4;
  const opts = { duration: MELD_MS, fill: "forwards" as const };
  const hit = MEET_AT;
  card.animate(
    [
      { offset: 0, transform: "none", easing: "cubic-bezier(.2,.8,.3,1)" },
      { offset: 0.24, transform: `translateY(${rise}px) scale(${grow})` },
      // The hit jolts the air where they met.
      { offset: hit, transform: `translateY(${rise}px) scale(${grow})` },
      { offset: hit + 0.02, transform: `translate(6px, ${rise - 3}px) scale(${grow})` },
      { offset: hit + 0.05, transform: `translate(-5px, ${rise + 2}px) scale(${grow})` },
      { offset: hit + 0.08, transform: `translate(3px, ${rise}px) scale(${grow})` },
      { offset: hit + 0.11, transform: `translateY(${rise}px) scale(${grow})` },
      { offset: 1, transform: `translateY(${rise}px) scale(${grow})` },
    ],
    opts,
  );
  // The two draw back, then rush together faster and faster; at the hit
  // they squash for an instant and are gone, into shards.
  tiles.forEach((copy, k) => {
    const start = parseFloat(copy.style.left);
    const shift = k * w - start;
    const toward = k ? -1 : 1;
    copy.animate(
      [
        { offset: 0, transform: "none", opacity: 1 },
        { offset: 0.2, transform: `translateX(${(-toward * w * 0.32).toFixed(1)}px)`, opacity: 1, easing: "cubic-bezier(.6,0,1,.5)" },
        { offset: hit - 0.01, transform: `translateX(${shift}px) scale(0.9, 1.05)`, opacity: 1 },
        { offset: hit, transform: `translateX(${shift}px) scale(0.9, 1.05)`, opacity: 0 },
        { offset: 1, transform: `translateX(${shift}px)`, opacity: 0 },
      ],
      opts,
    );
  });
  // Each tile breaks into pieces that fan out from the point of the hit.
  for (const k of [0, 1]) {
    const el = k ? b : a;
    const side = (x: number) => (k ? 100 - x : x);
    const j = () => (Math.random() - 0.5) * 14;
    // The point of the hit, on the tile's inner edge, and its outline around it.
    const p: [number, number] = [side(94), 50 + j() / 2];
    // Many points around the outline, unevenly spaced, so the pieces are
    // many, small and jagged.
    const rim: [number, number][] = [[side(100), 0]];
    const steps = (from: number, to: number, n: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 1)) / (n + 1));
    for (const x of steps(100, 0, 11)) rim.push([side(x + j() / 3), 0]);
    rim.push([side(0), 0]);
    for (const y of steps(0, 100, 13)) rim.push([side(0), y + j() / 3]);
    rim.push([side(0), 100]);
    for (const x of steps(0, 100, 11)) rim.push([side(x + j() / 3), 100]);
    rim.push([side(100), 100]);
    // Each wedge from the point of the hit breaks across three times, so
    // there are shards of every size, the smallest at the outer edge.
    const pieces: [number, number][][] = [];
    for (let n = 0; n < rim.length - 1; n++) {
      const q = rim[n];
      const r = rim[n + 1];
      const f1 = 0.22 + Math.random() * 0.12;
      const f2 = 0.5 + Math.random() * 0.12;
      const f3 = 0.75 + Math.random() * 0.1;
      const at = (u: [number, number], f: number): [number, number] => [p[0] + (u[0] - p[0]) * f, p[1] + (u[1] - p[1]) * f];
      pieces.push(
        [p, at(q, f1), at(r, f1)],
        [at(q, f1), at(q, f2), at(r, f2), at(r, f1)],
        [at(q, f2), at(q, f3), at(r, f3), at(r, f2)],
        [at(q, f3), q, r, at(r, f3)],
      );
    }
    for (const [index, piece] of pieces.entries()) {
      const mx = piece.reduce((t, u) => t + u[0], 0) / piece.length;
      const my = piece.reduce((t, u) => t + u[1], 0) / piece.length;
      const cx = mx - p[0];
      const cy = my - p[1];
      const len = Math.hypot(cx, cy) || 1;
      // A few pieces nearest the hit carry the drawing and
      // move as copies of the tile; all the rest are chips drawn on the
      // canvas, which is far cheaper.
      if (index % 12 !== 0) {
        const pts = piece.map(([x, y]) => toWindow(k * w + (x / 100) * w, (y / 100) * h));
        const ox = pts.reduce((t, u) => t + u[0], 0) / pts.length;
        const oy = pts.reduce((t, u) => t + u[1], 0) / pts.length;
        const speed = w * 1.4 * (2.4 + Math.random() * 2.6 + (len / 100) * 2.2);
        chips.push({
          x: ox,
          y: oy,
          pts: pts.map(([x, y]) => [x - ox, y - oy]),
          vx: (cx / len) * speed,
          vy: (cy / len) * speed * 0.8 - 140,
          spin: (Math.random() - 0.5) * 14,
          color: Math.random() < 0.12 ? back : chipColors[index % 4 < 2 ? 0 : Math.round(Math.random())],
        });
        continue;
      }
      const shard = copyOf(el);
      shard.classList.add("meld-shard");
      shard.style.left = `${k * w}px`;
      shard.style.clipPath = `polygon(${piece.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(", ")})`;
      card.append(shard);
      // Away from the hit, through the shard's middle, then falling; the
      // pieces from the outer edge fly furthest.
      const far = w * (0.3 + Math.random() * 0.6 + (len / 100) * 0.6);
      const dx = (cx / len) * far;
      const dy = (cy / len) * far * 0.8;
      const spin = (Math.random() - 0.5) * 360;
      shard.style.transformOrigin = `${mx.toFixed(1)}% ${my.toFixed(1)}%`;
      shard.animate(
        [
          { offset: 0, opacity: 0, transform: "none" },
          { offset: hit - 0.001, opacity: 0, transform: "none" },
          { offset: hit, opacity: 1, transform: "none", easing: "cubic-bezier(.1,.8,.4,1)" },
          { offset: hit + 0.25, opacity: 1, transform: `translate(${(dx * 0.75).toFixed(1)}px, ${(dy * 0.75).toFixed(1)}px) rotate(${(spin * 0.6).toFixed(0)}deg) scale(0.95)`, easing: "ease-in" },
          { offset: 0.92, opacity: 0, transform: `translate(${dx.toFixed(1)}px, ${(dy + h * 1.2).toFixed(1)}px) rotate(${spin.toFixed(0)}deg) scale(0.8)` },
          { offset: 1, opacity: 0, transform: `translate(${dx.toFixed(1)}px, ${(dy + h * 0.9).toFixed(1)}px)` },
        ],
        opts,
      );
    }
  }
  fx?.shards(chips, MELD_MS * hit);
  card.append(...light);
  const [blast, flash, ring] = light;
  blast.animate(
    [
      { offset: 0, opacity: 0, transform: "translate(-50%, -50%) scale(0.1)" },
      { offset: hit - 0.001, opacity: 0, transform: "translate(-50%, -50%) scale(0.1)" },
      { offset: hit + 0.02, opacity: 1, transform: "translate(-50%, -50%) scale(0.9)", easing: "ease-out" },
      { offset: hit + 0.2, opacity: 0, transform: "translate(-50%, -50%) scale(2)" },
      { offset: 1, opacity: 0, transform: "translate(-50%, -50%) scale(2)" },
    ],
    opts,
  );
  flash.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: hit - 0.001, opacity: 0, transform: "scaleX(0.4)" },
      { offset: hit + 0.01, opacity: 1, transform: "scaleX(2) scaleY(1.4)" },
      { offset: hit + 0.1, opacity: 0, transform: "scaleX(7) scaleY(1.1)" },
      { offset: 1, opacity: 0 },
    ],
    opts,
  );
  ring.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: hit - 0.001, opacity: 0, transform: "translate(-50%, -50%) scale(0.2)" },
      { offset: hit + 0.015, opacity: 1, transform: "translate(-50%, -50%) scale(0.5)", easing: "cubic-bezier(.1,.7,.3,1)" },
      { offset: hit + 0.28, opacity: 0, transform: "translate(-50%, -50%) scale(3.2)" },
      { offset: 1, opacity: 0 },
    ],
    opts,
  );
  setTimeout(() => card.remove(), MELD_MS + 50);
  return { x: mid, y: ra.top + h / 2 + rise, at: MELD_MS * hit };
}

/** The table jolts, briefly, from a hit. */
export function jolt(el: HTMLElement | null | undefined) {
  if (!el || typeof el.animate !== "function" || calm()) return;
  el.animate(
    [
      { transform: "none" },
      { transform: "translate(4px, -3px)" },
      { transform: "translate(-4px, 2px)" },
      { transform: "translate(2px, 1px)" },
      { transform: "none" },
    ],
    { duration: 220, easing: "ease-out" },
  );
}

/** A tile in the tray closes up a gap: it slides in from `dx` pixels away. */
export function slide(el: HTMLElement, dx: number) {
  if (typeof el.animate !== "function" || calm()) return;
  el.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 200, easing: "ease-out" });
}

/** A chip of a broken tile, for the canvas: its outline around its middle (window px). */
export type Chip = { x: number; y: number; pts: [number, number][]; vx: number; vy: number; spin: number; color: string };

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
  /** A chip of tile instead: its outline. */
  pts?: [number, number][];
};

export type Fx = {
  canvas: HTMLCanvasElement;
  /** Petals and sparks thrown out from a point (in window coordinates); `blast` throws more, faster. */
  burst(x: number, y: number, colors: string[], blast?: boolean): void;
  /** Chips of a broken tile flying apart and falling, after `delay` ms. */
  shards(chips: Chip[], delay: number): void;
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
      b.vy += (b.pts ? 1300 : b.petal ? 520 : 160) * dt;
      // Air slows a spark quickly; a petal reaches a slow fall and sways; a
      // chip is heavy and falls.
      const drag = b.pts ? 1.6 : b.petal ? 2.2 : 3.2;
      b.vx -= b.vx * drag * dt;
      b.vy -= b.vy * drag * dt;
      b.x += (b.vx + (b.petal ? Math.sin(b.age * 5 + b.turn) * 26 : 0)) * dt;
      b.y += b.vy * dt;
      b.turn += b.spin * dt;
      pen!.save();
      pen!.translate(b.x, b.y);
      pen!.rotate(b.turn);
      pen!.globalAlpha = Math.min(1, left * (b.petal || b.pts ? 2.5 : 1.6));
      pen!.fillStyle = b.color;
      if (b.pts) {
        pen!.beginPath();
        for (const [x, y] of b.pts) pen!.lineTo(x, y);
        pen!.closePath();
        pen!.fill();
      } else if (b.petal) {
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
        // A soft light around it, while there are few enough to afford it.
        if (bits.length < 80) {
          pen!.shadowColor = b.color;
          pen!.shadowBlur = 8;
        }
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
    burst(x, y, colors, blast = false) {
      const box = canvas.getBoundingClientRect();
      const more: Bit[] = [];
      for (let k = 0; k < (blast ? 90 : 36); k++) {
        const petal = blast ? k % 3 === 0 : k % 2 === 0;
        const angle = rand(0, Math.PI * 2);
        const speed = petal ? rand(160, 420) * (blast ? 1.4 : 1) : rand(220, 620) * (blast ? 1.8 : 1);
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
          // In a blast, chips of the tiles fly with the sparks.
          color: petal ? pick(colors) : pick(blast ? ["#fff7d6", "#ffd76a", "#ffffff", "#f3e6c8", "#f3e6c8"] : ["#fff7d6", "#ffd76a", "#ffffff"]),
          petal,
        });
      }
      add(more);
    },
    shards(chips, delay) {
      setTimeout(() => {
        const b = canvas.getBoundingClientRect();
        add(
          chips.map((c) => ({
            x: c.x - b.left,
            y: c.y - b.top,
            vx: c.vx,
            vy: c.vy,
            turn: 0,
            spin: c.spin,
            size: 0,
            age: 0,
            life: rand(0.8, 1.2),
            color: c.color,
            petal: false,
            pts: c.pts,
          })),
        );
      }, delay);
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
