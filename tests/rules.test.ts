// Levels, coins, the daily puzzle, saves and badges.
import { test } from "node:test";
import assert from "node:assert/strict";
import game from "../game.json" with { type: "json" };
import { LAYOUTS } from "../src/engine/layouts";
import { badgesFor } from "../src/badges";
import { DAILY_COINS, FREE_LEVELS, coinsFor, dailyLayout, layoutFor, today } from "../src/levels";
import { empty, merge, parse, parsePrefs, DEFAULT_PREFS } from "../src/save";
import { THEMES } from "../src/themes";

test("each layout debuts on its own level, and a level only plays open layouts", () => {
  for (const l of LAYOUTS) assert.equal(layoutFor(l.unlock).id, l.id);
  for (let level = 1; level <= 300; level++) assert.ok(layoutFor(level).unlock <= level, `level ${level}`);
  // The first levels are short.
  for (let level = 1; level <= FREE_LEVELS; level++) assert.ok(layoutFor(level).slots.length <= 40);
  assert.equal(layoutFor(1).id, "pebble");
});

test("coins stay within what dingn lets a game pay at once", () => {
  for (const l of LAYOUTS)
    for (const calm of [true, false]) {
      const c = coinsFor(l.slots.length, calm);
      assert.ok(c >= 1 && c <= 10);
    }
  assert.ok(coinsFor(100, true) > coinsFor(14, true));
  assert.ok(coinsFor(40, true) > coinsFor(40, false));
  assert.ok(DAILY_COINS <= 10);
});

test("the daily puzzle is the same for a whole UTC day", () => {
  const day = today(new Date("2026-11-25T23:59:00Z"));
  assert.equal(day, "2026-11-25");
  assert.equal(dailyLayout(day).id, dailyLayout("2026-11-25").id);
  const seen = new Set(Array.from({ length: 30 }, (_, i) => dailyLayout(`2026-12-${String(i + 1).padStart(2, "0")}`).id));
  assert.ok(seen.size > 3);
});

test("saves survive junk and merge to the better of each", () => {
  assert.deepEqual(parse(null), empty());
  assert.deepEqual(parse({ cleared: -3, calm: "x", daily: { day: "nope" } } as never), empty());
  const a = { ...empty(), cleared: 8, calm: 2, daily: { day: "2026-11-24", paid: true } };
  const b = { ...empty(), cleared: 5, calm: 4, daily: { day: "2026-11-25", paid: false }, biggest: 60 };
  assert.deepEqual(merge(a, b), { cleared: 8, calm: 4, dailies: 0, daily: { day: "2026-11-25", paid: false }, biggest: 60 });
  assert.deepEqual(parse(JSON.parse(JSON.stringify(a))), a);
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.equal(parsePrefs({ large: true, theme: "sea" }).large, true);
  assert.equal(DEFAULT_PREFS.clock, false);
});

test("every badge the game gives is in game.json", () => {
  const ids = new Set(game.badges.map((b) => b.id));
  const all = badgesFor({ cleared: 1000, calm: 100, dailies: 100, daily: null, biggest: 144 });
  for (const id of all) assert.ok(ids.has(id), id);
  assert.equal(all.length, ids.size);
  assert.deepEqual(badgesFor(empty()), []);
  assert.ok(LAYOUTS.some((l) => l.slots.length >= 100), "a big-board badge needs a big board");
});

test("themes open in order, the first from the start", () => {
  assert.equal(THEMES[0].unlock, 1);
  const unlocks = THEMES.map((t) => t.unlock);
  assert.deepEqual(unlocks, [...unlocks].sort((a, b) => a - b));
});
