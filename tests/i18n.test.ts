// Tile Zen's languages: the Chinese pack says everything the game shows,
// with the same placeholders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import game from "../game.json" with { type: "json" };
import { LANGUAGES, PACKS, translate } from "../src/i18n";
import { FACE_NAMES, THEMES } from "../src/themes";
import { LAYOUTS } from "../src/engine/layouts";

const holes = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join();

test("game.json lists every language there is a pack for, with a title and description in each", () => {
  const files = readdirSync(new URL("../src/locales/", import.meta.url)).map((f) => f.replace(/\.json$/, ""));
  assert.deepEqual(Object.keys(PACKS).sort(), files.sort());
  assert.deepEqual(game.languages, LANGUAGES);
  for (const field of ["en", "zh"] as const) {
    assert.ok(game.title[field].trim());
    assert.ok(game.description[field].length <= 300);
  }
  assert.equal(game.category, "puzzle");
});

test("every string the game shows has a translation with the same placeholders", () => {
  const shown = new Set<string>([...THEMES.map((t) => t.name), ...FACE_NAMES]);
  for (const file of ["../src/game.tsx", "../src/board-view.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const m of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) shown.add(m[1]);
  }
  assert.ok(shown.size > 40, `only ${shown.size} strings found`);
  for (const [locale, pack] of Object.entries(PACKS)) {
    for (const text of shown) assert.ok(Object.hasOwn(pack, text), `no ${locale} for "${text}"`);
    for (const [en, value] of Object.entries(pack)) {
      assert.ok(shown.has(en), `${locale} has "${en}", which the game never shows`);
      assert.equal(holes(value), holes(en), `${locale}: "${en}"`);
    }
  }
});

test("every layout has a name in both languages", () => {
  for (const l of LAYOUTS) {
    assert.ok(l.name.en.trim());
    assert.match(l.name.zh, /[一-鿿]/);
  }
});

test("translate fills patterns and falls back to English", () => {
  assert.equal(translate("Hint", "zh-CN"), "提示");
  assert.equal(translate("Level 12", "zh-CN"), "第 12 关");
  assert.equal(translate("Dots 3", "zh-CN"), "3 筒");
  assert.equal(translate("Hint", "en"), "Hint");
  assert.equal(translate("Hint", "es"), "Hint");
});
