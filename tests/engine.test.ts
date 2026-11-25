// The rules: free tiles, deals that can always be cleared, plans, hints and
// shuffles, on every layout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deal, geometry, isFree, matches, planWorks, solve } from "../src/engine/board";
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

test("every deal of every layout comes with a plan that clears it", () => {
  for (const l of LAYOUTS) {
    const g = geometry(l.slots);
    for (let seed = 1; seed <= 15; seed++) {
      const { faces, plan } = deal(g, FACE_COUNT, { seed });
      const counts = new Map<number, number>();
      for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
      for (const c of counts.values()) assert.equal(c % 2, 0);
      assert.ok(planWorks(g, l.slots.map(() => true), faces, plan), `${l.id} seed ${seed}`);
    }
  }
});

test("boards up to 72 tiles use each face once, so no move is ever a mistake", () => {
  for (const l of LAYOUTS.filter((l) => l.slots.length <= 72)) {
    const g = geometry(l.slots);
    const { faces } = deal(g, FACE_COUNT, { seed: 3 });
    assert.equal(new Set(faces).size, faces.length / 2, l.id);
    // Play random matches: it always clears.
    for (let seed = 1; seed <= 10; seed++) {
      let s = S.start(l.slots, FACE_COUNT, seed);
      const rng = { seed: seed * 31 };
      while (!S.cleared(s)) {
        const m = S.available(s);
        assert.ok(m.length, `${l.id} got stuck`);
        const [a, b] = m[below(rng, m.length)];
        s = S.take(s, a, b)!;
        assert.ok(!s.deadEnd);
      }
    }
  }
});

test("following hints always clears the board, on every layout", () => {
  for (const l of LAYOUTS) {
    let s = S.start(l.slots, FACE_COUNT, 7);
    while (!S.cleared(s)) {
      const pair = S.hint(s);
      assert.ok(pair, l.id);
      s = S.take(s, pair[0], pair[1])!;
      assert.ok(s, l.id);
    }
  }
});

test("take refuses blocked tiles and different faces", () => {
  const s = S.start(LAYOUTS[0].slots, FACE_COUNT, 1);
  const blocked = s.present.findIndex((_, i) => !S.free(s, i));
  const free = s.present.findIndex((_, i) => S.free(s, i));
  const twin = s.faces.findIndex((f, i) => i !== blocked && f === s.faces[blocked]);
  assert.equal(S.take(s, blocked, twin), null);
  const other = s.present.findIndex((_, i) => i !== free && S.free(s, i) && s.faces[i] !== s.faces[free]);
  if (other >= 0) assert.equal(S.take(s, free, other), null);
});

test("undo puts the last pair back, and shuffle can be undone", () => {
  const start = S.start(LAYOUTS[3].slots, FACE_COUNT, 5);
  const [a, b] = S.hint(start)!;
  const after = S.take(start, a, b)!;
  assert.equal(S.tilesLeft(after), S.tilesLeft(start) - 2);
  const back = S.undo(after);
  assert.deepEqual(back.present, start.present);
  assert.equal(back.undos, 1);
  assert.ok(S.helped(back));
  const { session: shuffled } = S.shuffle(after);
  assert.equal(shuffled.shuffles, 1);
  assert.ok(planWorks(shuffled.g, shuffled.present, shuffled.faces, shuffled.plan!));
  assert.deepEqual(S.undo(shuffled).faces, after.faces);
});

test("a dead end is spotted, and a shuffle always leads to a board that can be cleared", () => {
  // Big boards have four of some faces, so random play can paint itself into a corner.
  const l = LAYOUTS.find((x) => x.id === "mountain")!;
  let deadEnds = 0;
  for (let seed = 1; seed <= 12; seed++) {
    let s = S.start(l.slots, FACE_COUNT, seed);
    const rng = { seed };
    while (!S.cleared(s)) {
      const m = S.available(s);
      if (s.deadEnd || !m.length) {
        deadEnds++;
        assert.equal(solve(s.g, s.present, s.faces).kind === "solvable", false);
        s = S.shuffle(s).session;
        assert.ok(s.plan && planWorks(s.g, s.present, s.faces, s.plan));
        continue;
      }
      const [a, b] = m[below(rng, m.length)];
      s = S.take(s, a, b)!;
    }
  }
  assert.ok(deadEnds > 0, "expected random play to hit a dead end somewhere");
});

test("two tiles stacked with nothing else: shuffle steps back until it can", () => {
  const slots = [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 6, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 6, y: 0, z: 1 },
  ];
  let s = S.start(slots, 1, 1);
  // With one face, take the two top tiles... then the two in the middle,
  // leaving two tiles that are both free; instead force a stuck state by hand.
  s = { ...s, present: [true, false, false, false, true, false], plan: null };
  assert.equal(matches(s.g, s.present, s.faces).length, 0);
  s = { ...s, history: [{ kind: "match", pair: [1, 2], plan: null }, { kind: "match", pair: [3, 5], plan: null }] as S.Session["history"] };
  const { session, rewound } = S.shuffle(s);
  assert.ok(rewound >= 1);
  assert.ok(session.plan && planWorks(session.g, session.present, session.faces, session.plan));
});
