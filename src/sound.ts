// Calm music and sound effects, all made in the browser with Web Audio:
// slow pentatonic chords under a few drifting bell notes, through a long
// reverb, and the clack of tiles, built from short bursts of noise and
// struck tones. Nothing is loaded, so the game ships no audio files, and
// nothing speaks.

type Ctx = { ac: AudioContext; out: GainNode; music: GainNode; sfx: GainNode; reverb: ConvolverNode };
let ctx: Ctx | null = null;

function audio(): Ctx | null {
  if (ctx) return ctx;
  const AC = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AC) return null;
  try {
    const ac = new AC();
    const out = ac.createGain();
    out.gain.value = 0.9;
    out.connect(ac.destination);
    const reverb = ac.createConvolver();
    reverb.buffer = impulse(ac, 3.2);
    const wet = ac.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(out);
    const music = ac.createGain();
    music.gain.value = 0;
    music.connect(out);
    music.connect(reverb);
    const sfx = ac.createGain();
    sfx.gain.value = 0.5;
    sfx.connect(out);
    sfx.connect(reverb);
    ctx = { ac, out, music, sfx, reverb };
    return ctx;
  } catch {
    return null;
  }
}

/** A soft room: decaying noise. */
function impulse(ac: AudioContext, seconds: number) {
  const length = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// D major pentatonic, which has no clashing notes, so any mix sounds calm.
const SCALE = [0, 2, 4, 7, 9];
const note = (degree: number, base = 62) =>
  base + 12 * Math.floor(degree / 5) + SCALE[((degree % 5) + 5) % 5];

function tone(
  dest: AudioNode,
  midi: number,
  when: number,
  { type = "sine", attack = 0.01, hold = 0, release = 1.2, gain = 0.2 }: {
    type?: OscillatorType;
    attack?: number;
    hold?: number;
    release?: number;
    gain?: number;
  } = {},
) {
  const c = ctx!;
  const osc = c.ac.createOscillator();
  const env = c.ac.createGain();
  osc.type = type;
  osc.frequency.value = hz(midi);
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(gain, when + attack);
  env.gain.setValueAtTime(gain, when + attack + hold);
  env.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  osc.connect(env).connect(dest);
  osc.start(when);
  osc.stop(when + attack + hold + release + 0.05);
}

// ---- Music ----

const CHORDS = [
  [0, 2, 4],
  [-2, 1, 3],
  [-1, 2, 5],
  [-3, 0, 2],
];
let musicTimer: ReturnType<typeof setInterval> | null = null;
let bar = 0;

function playBar() {
  const c = ctx;
  if (!c) return;
  const now = c.ac.currentTime + 0.05;
  const chord = CHORDS[bar % CHORDS.length];
  // A slow pad: each chord swells in and fades over the next.
  for (const d of chord) tone(c.music, note(d, 50), now, { type: "triangle", attack: 2.5, hold: 3, release: 4, gain: 0.05 });
  tone(c.music, note(chord[0], 38), now, { attack: 2, hold: 4, release: 3, gain: 0.07 });
  // A few bell notes drifting over it, never the same twice.
  const bells = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < bells; i++) {
    const at = now + 0.6 + Math.random() * 6.4;
    const d = chord[Math.floor(Math.random() * 3)] + 5 + Math.floor(Math.random() * 3);
    tone(c.music, note(d, 62), at, { attack: 0.01, release: 2.6, gain: 0.045 });
  }
  bar++;
}

export function setMusic(on: boolean) {
  const c = on ? audio() : ctx;
  if (!c) return;
  const t = c.ac.currentTime;
  c.music.gain.cancelScheduledValues(t);
  c.music.gain.setValueAtTime(c.music.gain.value, t);
  c.music.gain.linearRampToValueAtTime(on ? 1 : 0, t + (on ? 2 : 0.6));
  if (on && !musicTimer) {
    void c.ac.resume();
    playBar();
    musicTimer = setInterval(playBar, 7500);
  } else if (!on && musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

/** Browsers start audio only after a tap, so the game calls this on each one. */
export function wake() {
  if (ctx && ctx.ac.state === "suspended") void ctx.ac.resume();
}

// Hush while the page is hidden.
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.ac.suspend();
    else void ctx.ac.resume();
  });

// ---- Sound effects ----

let soundOn = true;
export const setSound = (on: boolean) => {
  soundOn = on;
};

/** A second of hiss, the raw stuff of every knock and rustle. */
let hiss: AudioBuffer | null = null;
function noise(
  dest: AudioNode,
  when: number,
  { freq, q = 1, attack = 0.001, decay, gain, sweep = 1 }: { freq: number; q?: number; attack?: number; decay: number; gain: number; sweep?: number },
) {
  const c = ctx!;
  if (!hiss) {
    hiss = c.ac.createBuffer(1, c.ac.sampleRate, c.ac.sampleRate);
    const data = hiss.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = c.ac.createBufferSource();
  src.buffer = hiss;
  const band = c.ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = q;
  band.frequency.setValueAtTime(freq, when);
  if (sweep !== 1) band.frequency.exponentialRampToValueAtTime(freq * sweep, when + attack + decay);
  const env = c.ac.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(gain, when + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  src.connect(band).connect(env).connect(dest);
  src.start(when, Math.random() * 0.5);
  src.stop(when + attack + decay + 0.05);
}
/** A struck tone at `freq` hertz that dies away quickly, like a tap on bone. */
function knock(dest: AudioNode, when: number, freq: number, decay: number, gain: number) {
  const c = ctx!;
  const osc = c.ac.createOscillator();
  const env = c.ac.createGain();
  osc.frequency.setValueAtTime(freq * 1.25, when);
  osc.frequency.exponentialRampToValueAtTime(freq, when + 0.012);
  env.gain.setValueAtTime(gain, when);
  env.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  osc.connect(env).connect(dest);
  osc.start(when);
  osc.stop(when + decay + 0.02);
}
/**
 * One tile meeting another: the sharp tick of the touch, the ring of the
 * tile and the thump of the table under it. `pitch` is a small tile's
 * higher, a heavy landing's lower.
 */
function clack(dest: AudioNode, when: number, pitch = 1, gain = 1) {
  noise(dest, when, { freq: 3400 * pitch, q: 1.2, decay: 0.022, gain: 0.5 * gain });
  knock(dest, when, 1450 * pitch, 0.045, 0.16 * gain);
  knock(dest, when, 2380 * pitch, 0.03, 0.07 * gain);
  knock(dest, when, 210 * pitch, 0.07, 0.22 * gain);
}
/** A small bell: a note with a glassy overtone above it. */
function bell(dest: AudioNode, midi: number, when: number, gain: number, release = 1.4) {
  tone(dest, midi, when, { attack: 0.004, release, gain });
  tone(dest, midi + 12, when, { attack: 0.004, release: release * 0.5, gain: gain * 0.35 });
  tone(dest, midi + 28.1, when, { attack: 0.002, release: release * 0.22, gain: gain * 0.18 });
}
/** A scatter of tiny high bells, like light on water. */
function glitter(dest: AudioNode, when: number, count: number, over: number, gain: number) {
  for (let i = 0; i < count; i++)
    tone(dest, note(10 + Math.floor(Math.random() * 8), 74), when + Math.random() * over, { attack: 0.003, release: 0.5, gain: gain * (0.5 + Math.random() * 0.5) });
}
/** Many tiles knocking together. */
function rattle(dest: AudioNode, when: number, count: number, over: number, gain: number) {
  for (let i = 0; i < count; i++) clack(dest, when + (i / count) * over + Math.random() * 0.03, 0.8 + Math.random() * 0.6, gain * (0.5 + Math.random() * 0.5));
}

export type Sfx = "tap" | "select" | "land" | "match" | "blocked" | "shuffle" | "deal" | "undo" | "hint" | "win";
/** `step` raises a match's notes a little with each one in a row. */
export function play(sfx: Sfx, step = 0) {
  if (!soundOn) return;
  const c = audio();
  if (!c) return;
  void c.ac.resume();
  const t = c.ac.currentTime + 0.01;
  switch (sfx) {
    case "tap":
      // A button: a soft, rounded tick.
      noise(c.sfx, t, { freq: 1800, q: 0.8, decay: 0.02, gain: 0.16 });
      knock(c.sfx, t, 620, 0.05, 0.1);
      break;
    case "select":
      // A tile lifted off the board, and the air it moves through.
      clack(c.sfx, t, 1.25, 0.55);
      noise(c.sfx, t + 0.03, { freq: 900, q: 0.7, attack: 0.1, decay: 0.16, gain: 0.05, sweep: 2.4 });
      break;
    case "land":
      // Set down in the tray, on wood.
      clack(c.sfx, t, 0.82, 0.8);
      knock(c.sfx, t, 130, 0.11, 0.2);
      break;
    case "match": {
      // The pair knock together, ring, and scatter.
      const d = 5 + Math.min(step, 7);
      clack(c.sfx, t, 1, 0.9);
      clack(c.sfx, t + 0.035, 1.12, 0.6);
      bell(c.sfx, note(d), t + 0.02, 0.15);
      bell(c.sfx, note(d + 2), t + 0.11, 0.12, 1.6);
      glitter(c.sfx, t + 0.08, 5, 0.35, 0.035);
      noise(c.sfx, t + 0.02, { freq: 5200, q: 0.6, attack: 0.02, decay: 0.3, gain: 0.035, sweep: 1.6 });
      break;
    }
    case "blocked":
      // A dull knock: this one will not move.
      knock(c.sfx, t, 150, 0.09, 0.3);
      noise(c.sfx, t, { freq: 700, q: 1, decay: 0.03, gain: 0.22 });
      knock(c.sfx, t + 0.07, 135, 0.08, 0.18);
      break;
    case "hint":
      bell(c.sfx, note(9), t, 0.09, 0.9);
      bell(c.sfx, note(11), t + 0.12, 0.09, 1.1);
      glitter(c.sfx, t + 0.1, 3, 0.25, 0.025);
      break;
    case "undo":
      // The tile drawn back, and put where it was.
      noise(c.sfx, t, { freq: 2200, q: 0.7, attack: 0.09, decay: 0.08, gain: 0.05, sweep: 0.4 });
      clack(c.sfx, t + 0.13, 0.95, 0.6);
      break;
    case "shuffle":
      // Tiles washed across the table.
      rattle(c.sfx, t, 16, 0.5, 0.5);
      noise(c.sfx, t, { freq: 1500, q: 0.5, attack: 0.2, decay: 0.35, gain: 0.05, sweep: 1.8 });
      break;
    case "deal":
      // A new board laid out, tile after tile.
      rattle(c.sfx, t, 14, 0.7, 0.3);
      break;
    case "win":
      [5, 7, 9, 10, 12].forEach((d, i) => bell(c.sfx, note(d), t + i * 0.13, 0.12, 2.4));
      tone(c.sfx, note(0, 50), t, { attack: 0.02, release: 3, gain: 0.12 });
      tone(c.sfx, note(2, 50), t + 0.65, { type: "triangle", attack: 0.3, release: 2.6, gain: 0.05 });
      glitter(c.sfx, t + 0.5, 22, 1.8, 0.035);
      break;
  }
}
