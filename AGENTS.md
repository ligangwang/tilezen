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
- Every deal must stay clearable: deal with `deal()`/`reshuffle()` in
  `src/engine/tray.ts`, which return the picks that clear the board, never by
  shuffling faces at random. A deal buries twins up to `depth` tiles deep and
  always leaves one place in the tray spare. A new layout needs an even
  number of tiles, every raised tile resting on the layer below (a test
  checks), and an `unlock` level between its neighbours'.
- The tray (`TRAY` in `src/engine/session.ts`) holds four. A picked tile
  waits there until its twin is picked. Four different tiles waiting fail
  the board (`failed`): the player tries it again or takes the last tile
  back. So play, hints and plans keep to three waiting (`ROOM`).
- Every board has a score (`score` in `src/engine/session.ts`): pairs, more
  for pairs in a row, less for help, a bonus for a calm clear. Nothing is
  timed.
- Tile Zen is an original game: its name, layouts, tile drawings and sounds
  are our own. Don't copy names, art, layouts or sounds from other mahjong
  solitaire games.
- Keep it calm and kind: help (hints, undo, shuffle) stays free, no timer
  unless the player turns it on, nothing random is sold.
- The look is drawn, not loaded: tiles and buttons are CSS, icons are our
  own SVG (`src/icons.tsx`, no emoji), sounds are synthesized (`src/sound.ts`,
  no voices, no background music), motion is in `src/fx.ts` and respects reduced motion. Show the
  owner screenshots or a clip of a visual change before releasing it.
