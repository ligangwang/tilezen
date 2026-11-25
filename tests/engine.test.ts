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

const works = (s: S.Session) => !!s.plan && orderWorks(s.g, s.present, s.faces, s.tray, s.plan, S.ROOM);

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

test("the tray holds four tiles: a twin leaves with its mate, and four different tiles fail the board", () => {
  const start = S.start(LAYOUTS.find((x) => x.id === "mountain")!.slots, FACE_COUNT, 3, 3);
  assert.equal(S.TRAY, 4);
  assert.equal(S.ROOM, 3);
  // Lift free tiles of different faces until one place is left.
  let s = start;
  const stranger = () => s.present.findIndex((on, k) => on && S.free(s, k) && S.twinInTray(s, k) === undefined);
  while (s.tray.length < S.ROOM) {
    const i = stranger();
    assert.ok(i >= 0);
    assert.equal(S.fills(s, i), false);
    const before = s.present.filter((_, k) => S.free(s, k)).length;
    s = S.pick(s, i)!;
    // The tile left the board, and nothing it touched got more blocked.
    assert.equal(s.present[i], false);
    assert.ok(s.present.filter((_, k) => S.free(s, k)).length >= before - 1);
    assert.equal(S.failed(s), false);
  }
  assert.equal(S.tilesLeft(s), S.tilesLeft(start));
  // A twin of a waiting tile is taken with its mate.
  const twin = s.present.findIndex((on, k) => on && S.free(s, k) && S.twinInTray(s, k) !== undefined);
  if (twin >= 0) {
    assert.equal(S.fills(s, twin), false);
    const after = S.pick(s, twin)!;
    assert.equal(after.tray.length, S.ROOM - 1);
    assert.equal(S.tilesLeft(after), S.tilesLeft(s) - 2);
    assert.deepEqual(S.undo(after).tray, s.tray);
  } else assert.ok(s.deadEnd, "one place left and no twin free is a dead end");
  // A fourth different tile fills the tray: the board is failed, and takes no more picks.
  const fourth = stranger();
  assert.ok(fourth >= 0);
  assert.ok(S.fills(s, fourth));
  const full = S.pick(s, fourth)!;
  assert.ok(S.failed(full));
  assert.equal(full.plan, null);
  assert.equal(S.hint(full), null);
  assert.ok(full.present.every((_, k) => !S.canPick(full, k)));
  assert.equal(S.pick(full, full.present.findIndex((on, k) => on && S.free(full, k))), null);
  // Undo takes the fourth tile back, and play goes on.
  const back = S.undo(full);
  assert.equal(S.failed(back), false);
  assert.deepEqual(back.tray, s.tray);
  assert.deepEqual(back.present, s.present);
});

test("random play that never fills the tray keeps a way through, and one place left with no twin is the dead end", () => {
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
        assert.equal(s.tray.length, S.ROOM);
        assert.equal(S.hint(s), null);
        assert.equal(solve(s.g, s.present, s.faces, s.tray, S.ROOM), null);
        s = S.shuffle(s).session;
        assert.equal(s.deadEnd, false);
        assert.ok(works(s));
        continue;
      }
      // Mostly random picks, so the tray fills with tiles the plan didn't want.
      // A hint never fills the tray, and neither does this player.
      const pickable = s.present.flatMap((_, i) => (S.canPick(s, i) && !S.fills(s, i) ? [i] : []));
      assert.ok(pickable.length > 0, "not a dead end, so something can be picked");
      const tip = S.hint(s);
      const i = tip && below(rng, 2) === 0 ? tip[tip.length - 1] : pickable[below(rng, pickable.length)];
      assert.equal(S.fills(s, i), false, "a hint must not fill the tray");
      s = S.pick(s, i)!;
      assert.equal(S.failed(s), false);
      picks++;
      if (s.plan) planned++;
    }
  }
  assert.ok(deadEnds > 0, "expected random play to fill the tray somewhere");
  // The game nearly always still knows a way through after a stray pick.
  assert.ok(planned > picks * 0.7, `a plan after only ${planned} of ${picks} picks`);
});

test("the score: pairs worth more in a row, help takes points off, a calm clear adds a fifth", () => {
  let s = S.start(LAYOUTS[0].slots, 36, 7);
  assert.equal(S.score(s), 0);
  // Follow the plan to the end: every pair is one more in a row.
  let pairs = 0;
  let expected = 0;
  while (!S.cleared(s)) {
    const before = s.points;
    s = S.pick(s, s.plan![0])!;
    if (s.points > before) {
      assert.equal(s.points - before, S.PAIR_POINTS + S.STREAK_STEP * Math.min(pairs, S.STREAK_MOST));
      expected += s.points - before;
      pairs++;
    }
  }
  assert.equal(pairs, LAYOUTS[0].slots.length / 2);
  assert.equal(S.score(s), expected + Math.round(expected * S.CALM_BONUS));

  // With help: no calm bonus, the costs come off, and never below nothing.
  let h = S.withHint(S.start(LAYOUTS[0].slots, 36, 7));
  assert.equal(S.score(h), 0);
  h = S.pick(S.pick(h, h.plan![0])!, h.plan![1])!;
  while (h.points === 0) h = S.pick(h, h.plan![0])!;
  assert.equal(h.points, S.PAIR_POINTS);
  assert.equal(S.score(h), S.PAIR_POINTS - S.HELP_COST.hint);
  assert.equal(S.calmBonus(h), 0);
  // Taking a pair back gives back its points and costs an undo.
  const back = S.undo(h);
  assert.equal(back.points, 0);
  assert.equal(back.streak, 0);
  assert.equal(S.helpCost(back), S.HELP_COST.hint + S.HELP_COST.undo);
  // A wrong tap ends the streak without costing points.
  assert.equal(S.miss(h).streak, 0);
  assert.equal(S.miss(h).points, h.points);
});
