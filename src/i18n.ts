// Tile Zen in every language it speaks. English is the source: the code
// passes English text to t(), and each other language has a pack in
// src/locales/<lang>.json mapping that English to its translation. The same
// rules as the website's translations: exact strings first, then patterns
// such as "Level {0}", the longest literal text first.
import zhCN from "./locales/zh-CN.json";
import type { Locale } from "../sdk/dingn-sdk.js";

/** Each language's pack, by dingn's language code. English needs none. */
export const PACKS: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
};

/** Every language Tile Zen speaks, English first (game.json `languages`). */
export const LANGUAGES = ["en", ...Object.keys(PACKS)];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Catalog = {
  exact: Record<string, string>;
  patterns: { re: RegExp; value: string }[];
};

function compile(pack: Record<string, string>): Catalog {
  const patterns = Object.entries(pack)
    .filter(([key]) => /\{\d+\}/.test(key))
    .sort(
      ([a], [b]) =>
        b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length,
    )
    .map(([key, value]) => ({
      re: new RegExp(
        "^" +
          key
            .split(/\{\d+\}/)
            .map(escape)
            .join("(.*?)") +
          "$",
      ),
      value,
    }));
  return { exact: pack, patterns };
}

const catalogs = new Map<string, Catalog>(
  Object.entries(PACKS).map(([locale, pack]) => [locale, compile(pack)]),
);

/**
 * `text` in `locale`. English, a language without a pack, or text the pack
 * lacks gives the English back, never another language's text.
 */
export function translate(text: string, locale: Locale): string {
  const catalog = catalogs.get(locale);
  if (!catalog || !text) return text;
  const key = text.replace(/\s+/g, " ").trim();
  if (Object.hasOwn(catalog.exact, key)) return catalog.exact[key];
  for (const { re, value } of catalog.patterns) {
    const match = key.match(re);
    if (match)
      return value.replace(/\{(\d+)\}/g, (_, n) => match[Number(n) + 1] ?? "");
  }
  return text;
}
