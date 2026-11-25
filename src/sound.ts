// Calm music and soft sound effects, all made in the browser with Web Audio:
// slow pentatonic chords under a few drifting bell notes, through a long
// reverb. Nothing is loaded, so the game ships no audio files.

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

export type Sfx = "select" | "match" | "blocked" | "shuffle" | "hint" | "win";
export function play(sfx: Sfx) {
  if (!soundOn) return;
  const c = audio();
  if (!c) return;
  void c.ac.resume();
  const t = c.ac.currentTime + 0.01;
  switch (sfx) {
    case "select":
      tone(c.sfx, note(7), t, { release: 0.25, gain: 0.12 });
      break;
    case "match": {
      const d = 7 + Math.floor(Math.random() * 4);
      tone(c.sfx, note(d), t, { release: 1.4, gain: 0.16 });
      tone(c.sfx, note(d + 2), t + 0.09, { release: 1.6, gain: 0.13 });
      break;
    }
    case "blocked":
      tone(c.sfx, note(0, 45), t, { type: "triangle", release: 0.18, gain: 0.12 });
      break;
    case "hint":
      tone(c.sfx, note(9), t, { release: 0.9, gain: 0.1 });
      tone(c.sfx, note(11), t + 0.12, { release: 0.9, gain: 0.1 });
      break;
    case "shuffle":
      for (let i = 0; i < 5; i++) tone(c.sfx, note(4 + i), t + i * 0.05, { release: 0.3, gain: 0.06 });
      break;
    case "win":
      [5, 7, 9, 10, 12].forEach((d, i) => tone(c.sfx, note(d), t + i * 0.14, { release: 2.2, gain: 0.13 }));
      break;
  }
}
