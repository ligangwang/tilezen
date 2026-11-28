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
  assert.equal(game.category, "casual");
});

test("every string the game shows has a translation with the same placeholders", () => {
  const shown = new Set<string>([...THEMES.map((t) => t.name), ...FACE_NAMES, ...LAYOUTS.map((l) => l.name)]);
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

test("the game speaks every language dingn has", () => {
  assert.deepEqual([...LANGUAGES].sort(), ["de", "en", "es", "fil", "fr", "hi", "id", "ja", "ko", "ms", "pt-BR", "th", "vi", "zh-CN", "zh-TW"]);
  // game.json names the game, describes it and titles each badge in all of
  // them (Chinese under "zh", as dingn's listings have it).
  const fields = LANGUAGES.map((l) => (l === "zh-CN" ? "zh" : l));
  for (const text of [game.title, game.description, ...game.badges.map((b) => b.title)] as Record<string, string>[])
    assert.deepEqual(Object.keys(text).sort(), [...fields].sort());
  for (const f of fields) assert.ok(game.description[f as "en"].length <= 300, `${f} description is too long`);
  // A layout's name is not left in English.
  for (const l of LAYOUTS) for (const locale of Object.keys(PACKS)) assert.ok(translate(l.name, locale), `${locale}: ${l.name}`);
});

test("translate fills patterns and falls back to English", () => {
  assert.equal(translate("Hint", "zh-CN"), "提示");
  assert.equal(translate("Level 12", "zh-CN"), "第 12 关");
  assert.equal(translate("Dots 3", "zh-CN"), "3 筒");
  assert.equal(translate("Hint", "en"), "Hint");
  assert.equal(translate("Hint", "es"), "Pista");
  assert.equal(translate("Level 12", "ja"), "レベル 12");
  assert.equal(translate("Place 2 of 9", "ko"), "9명 중 2위");
  assert.equal(translate("Hint", "zh-TW"), "提示");
  assert.equal(translate("Level 12", "zh-TW"), "第 12 關");
  assert.equal(translate("Level 12", "th"), "เลเวล 12");
  assert.equal(translate("Level 12", "ms"), "Tahap 12");
  assert.equal(translate("Place 2 of 9", "hi"), "9 में से 2वाँ स्थान");
  assert.equal(translate("Score to beat: 40", "fr"), "Score à battre\u00a0: 40");
  assert.equal(translate("Hint", "it"), "Hint");
});

test("each new script's pack is written in it", () => {
  const values = (locale: string) => Object.entries(PACKS[locale]).filter(([en]) => en !== "Tile Zen").map(([, v]) => v);
  for (const v of values("th")) assert.match(v, /[\u0E00-\u0E7F]/, `th: ${v}`);
  for (const v of values("hi")) assert.match(v, /[\u0900-\u097F]/, `hi: ${v}`);
  // Traditional Chinese, not the Simplified pack's characters.
  for (const v of values("zh-TW")) {
    assert.match(v, /\p{Script=Han}/u, `zh-TW: ${v}`);
    assert.doesNotMatch(v, /[关设录张东发条万盘战绩链复图选这续轮页]/, `zh-TW: ${v}`);
  }
});
