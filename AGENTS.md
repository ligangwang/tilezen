# AGENTS.md

Notes for AI coding agents working on Tile Zen (静心麻将).

- This is a dingn game published like any outside developer's game: the
  dingn website (repo `ligangwang/dingn`) runs it in a sandboxed frame and the
  game talks to it only through the SDK in `sdk/`. Don't import from the
  dingn repo. Refresh `sdk/` with `npm run update-sdk`.
- Run `npm test` before committing. `npm run pack` builds the upload zip.
- Merging to `main` publishes on dingn (`.github/workflows/release.yml`)
  when `version` in `game.json` is new.
- Bump `version` in `game.json` for every release; dingn refuses a version it
  already has.
- Save with `sdk.storage` / `sdk.progress`, never `localStorage` or cookies,
  which the sandbox blocks. Keep every URL relative (`base: "./"`).
- UI strings go through `t()` in English, with translations in
  `src/locales/zh-CN.json` (a test checks every shown string has one).
- `src/engine/` is the rules. Keep it free of the DOM so the tests run it in
  Node, and deterministic (the seeded generator in `random.ts`), so a level
  and the daily puzzle deal the same board for everyone.
- Every deal must stay clearable: deal with `deal()`/`reshuffle()`, which
  return a plan, never by shuffling faces at random. A new layout needs an
  even number of tiles, every raised tile resting on the layer below (a test
  checks), and an `unlock` level after the last one.
- Tile Zen is an original game: its name, layouts, tile drawings and music
  are our own. Don't copy names, art, layouts or sounds from other mahjong
  solitaire games.
- Keep it calm and kind: help (hints, undo, shuffle) stays free, no timer
  unless the player turns it on, nothing random is sold.
