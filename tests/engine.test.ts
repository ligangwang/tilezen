// The rules: free tiles, the tray, deals that can always be cleared with it,
// hints and shuffles, on every layout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { geometry, isFree } from "../src/engine/board";
import { deal, orderWorks, solve } from "../src/engine/tray";
import { LAYOUTS } from "../src/engine/layouts";
import { below } from "../src/engine/random";
import * as S from "../src/engine/session";
import { FACE_COUNT } from "../src/themes";

test("a tile is free with nothing on top and one side open", () => {
  // Three in a row, and one on top of the middle and right ones.
  const g = geometry([
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 3, y: 0, z: 1 },
  ]);
  const all = [true, true, true, true];
  assert.deepEqual([0, 1, 2, 3].map((i) => isFree(g, all, i)), [true, false, false, true]);
  const noTop = [true, true, true, false];
  assert.deepEqual([0, 1, 2].map((i) => isFree(g, noTop, i)), [true, false, true]);
});

test("every layout has an even number of tiles, no two overlapping on a layer", () => {
  const ids = new Set<string>();
  for (const l of LAYOUTS) {
    assert.ok(!ids.has(l.id), l.id);
    ids.add(l.id);
    assert.equal(l.slots.length % 2, 0, l.id);
    for (const a of l.slots)
      for (const b of l.slots)
        if (a !== b && a.z === b.z) assert.ok(Math.abs(a.x - b.x) >= 2 || Math.abs(a.y - b.y) >= 2, `${l.id} overlaps`);
    // Layers stand on the one below.
    for (const a of l.slots) if (a.z > 0) assert.ok(l.slots.some((b) => b.z === a.z - 1 && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2), `${l.id} floats`);
  }
  const unlocks = LAYOUTS.map((l) => l.unlock);
  assert.deepEqual(unlocks, [...unlocks].sort((a, b) => a - b));
  assert.equal(unlocks[0], 1);
});

const works = (s: S.Session) => !!s.plan && orderWorks(s.g, s.present, s.faces, s.tray, s.plan, S.TRAY);

test("every deal of every layout comes with picks that clear it, using the tray as deep as asked", () => {
  for (const l of LAYOUTS) {
    const g = geometry(l.slots);
    const all = l.slots.map(() => true);
    for (const depth of [1, 2, 3]) {
      let deepest = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const { faces, order } = deal(g, FACE_COUNT, { seed }, depth, S.TRAY);
        const counts = new Map<number, number>();
        for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
        for (const c of counts.values()) assert.equal(c % 2, 0);
        assert.equal(order.length, l.slots.length);
        assert.ok(orderWorks(g, all, faces, [], order, S.TRAY), `${l.id} depth ${depth} seed ${seed}`);
        // It never needs more places than the depth, so one is always spare.
        assert.ok(orderWorks(g, all, faces, [], order, depth), `${l.id} needs more than ${depth}`);
        if (!orderWorks(g, all, faces, [], order, depth - 1)) deepest = depth;
      }
      // A deeper deal really does bury twins: it can't be played with fewer places.
      if (depth > 1 && l.slots.length >= 20) assert.equal(deepest, depth, `${l.id} at depth ${depth} is no deeper`);
    }
  }
});

test("a stack of tiles straight on top of each other can be dealt and cleared", () => {
  const well = LAYOUTS.find((l) => l.id === "well")!;
  // Two thirds of it is covered at the start.
  const s0 = S.start(well.slots, FACE_COUNT, 1, 2);
  assert.ok(s0.present.filter((_, i) => !S.free(s0, i)).length >= (well.slots.length * 2) / 3);
  let s = s0;
  while (!S.cleared(s)) {
    const tip = S.hint(s)!;
    s = S.pick(s, tip[tip.length - 1])!;
  }
  assert.equal(S.helped(s), false);
});

test("following hints always clears the board, on every layout and at every depth", () => {
  for (const l of LAYOUTS)
    for (const depth of [1, 2, 3]) {
      let s = S.start(l.slots, FACE_COUNT, 7, depth);
      for (let n = 0; !S.cleared(s); n++) {
        assert.ok(n <= l.slots.length, `${l.id} takes too long`);
        const tip = S.hint(s);
        assert.ok(tip, `${l.id} depth ${depth}: no hint`);
        const i = tip[tip.length - 1];
        assert.ok(S.canPick(s, i), `${l.id}: the hinted tile can't be picked`);
        s = S.pick(s, i)!;
        assert.ok(s.tray.length <= depth);
        assert.ok(!s.deadEnd);
      }
    }
});

test("a pick is refused for a blocked tile, and take needs two free tiles of one face", () => {
  const s = S.start(LAYOUTS[0].slots, FACE_COUNT, 1);
  const blocked = s.present.findIndex((_, i) => !S.free(s, i));
  const free = s.present.findIndex((_, i) => S.free(s, i));
  assert.equal(S.pick(s, blocked), null);
  const twin = s.faces.findIndex((f, i) => i !== blocked && f === s.faces[blocked]);
  assert.equal(S.take(s, blocked, twin), null);
  const other = s.present.findIndex((_, i) => i !== free && S.free(s, i) && s.faces[i] !== s.faces[free]);
  if (other >= 0) assert.equal(S.take(s, free, other), null);
});

test("undo takes back one pick at a time, and a shuffle can be undone", () => {
  const start = S.start(LAYOUTS[3].slots, FACE_COUNT, 5);
  const a = S.hint(start)!.at(-1)!;
  const held = S.pick(start, a)!;
  assert.deepEqual(held.tray, [a]);
  assert.equal(S.tilesLeft(held), S.tilesLeft(start));
  const b = S.hint(held)!.at(-1)!;
  const after = S.pick(held, b)!;
  // With the tray one deep, the next pick is its twin.
  assert.equal(after.faces[a], after.faces[b]);
  assert.equal(S.tilesLeft(after), S.tilesLeft(start) - 2);
  assert.deepEqual(after.tray, []);
  const half = S.undo(after);
  assert.deepEqual(half.tray, [a]);
  assert.deepEqual(half.plan, held.plan);
  const back = S.undo(half);
  assert.deepEqual(back.present, start.present);
  assert.deepEqual(back.tray, []);
  assert.equal(back.undos, 2);
  assert.ok(S.helped(back));
  const { session: shuffled, rewound } = S.shuffle(held);
  assert.equal(rewound, 0);
  assert.equal(shuffled.shuffles, 1);
  assert.deepEqual(shuffled.tray, []);
  assert.equal(S.tilesLeft(shuffled), S.tilesLeft(held));
  assert.ok(works(shuffled));
  const undone = S.undo(shuffled);
  assert.deepEqual(undone.faces, held.faces);
  assert.deepEqual(undone.tray, held.tray);
  assert.deepEqual(undone.present, held.present);
});

test("the tray holds four tiles, takes only a match when full, and frees what a lifted tile blocked", () => {
  const start = S.start(LAYOUTS.find((x) => x.id === "mountain")!.slots, FACE_COUNT, 3, 3);
  assert.equal(S.TRAY, 4);
  // Lift free tiles of different faces until the tray is full.
  let s = start;
  while (s.tray.length < S.TRAY) {
    const i = s.present.findIndex((on, k) => on && S.free(s, k) && S.twinInTray(s, k) === undefined);
    assert.ok(i >= 0);
    const before = s.present.filter((_, k) => S.free(s, k)).length;
    s = S.pick(s, i)!;
    // The tile left the board, and nothing it touched got more blocked.
    assert.equal(s.present[i], false);
    assert.ok(s.present.filter((_, k) => S.free(s, k)).length >= before - 1);
  }
  assert.equal(S.tilesLeft(s), S.tilesLeft(start));
  // Full: a tile of another face is refused, a twin is taken with its mate.
  const stranger = s.present.findIndex((on, k) => on && S.free(s, k) && S.twinInTray(s, k) === undefined);
  if (stranger >= 0) assert.equal(S.pick(s, stranger), null);
  const twin = s.present.findIndex((on, k) => on && S.free(s, k) && S.twinInTray(s, k) !== undefined);
  if (twin >= 0) {
    const after = S.pick(s, twin)!;
    assert.equal(after.tray.length, S.TRAY - 1);
    assert.equal(S.tilesLeft(after), S.tilesLeft(s) - 2);
    assert.deepEqual(S.undo(after).tray, s.tray);
  } else assert.ok(s.deadEnd, "a full tray with no twin free is a dead end");
});

test("random play keeps a way through where there is one, and a full tray with no twin is the dead end", () => {
  const l = LAYOUTS.find((x) => x.id === "mountain")!;
  let deadEnds = 0;
  let planned = 0;
  let picks = 0;
  for (let seed = 1; seed <= 10; seed++) {
    let s = S.start(l.slots, FACE_COUNT, seed, 3);
    const rng = { seed };
    for (let n = 0; !S.cleared(s); n++) {
      assert.ok(n < 3000, "the play should end");
      if (s.plan) assert.ok(works(s), "a kept plan must clear the board");
      if (s.deadEnd) {
        deadEnds++;
        assert.equal(s.tray.length, S.TRAY);
        assert.equal(S.hint(s), null);
        assert.equal(solve(s.g, s.present, s.faces, s.tray, S.TRAY), null);
        s = S.shuffle(s).session;
        assert.equal(s.deadEnd, false);
        assert.ok(works(s));
        continue;
      }
      // Mostly random picks, so the tray fills with tiles the plan didn't want.
      const pickable = s.present.flatMap((_, i) => (S.canPick(s, i) ? [i] : []));
      assert.ok(pickable.length > 0, "not a dead end, so something can be picked");
      const tip = S.hint(s);
      const i = tip && below(rng, 2) === 0 ? tip[tip.length - 1] : pickable[below(rng, pickable.length)];
      s = S.pick(s, i)!;
      picks++;
      if (s.plan) planned++;
    }
  }
  assert.ok(deadEnds > 0, "expected random play to fill the tray somewhere");
  // The game nearly always still knows a way through after a stray pick.
  assert.ok(planned > picks * 0.7, `a plan after only ${planned} of ${picks} picks`);
});
