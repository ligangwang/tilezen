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
- When the owner says "release": merge the pull request, wait for the upload
  (`https://dingn.com/api/games/tilezen?v=<version>` answers with it), approve
  it, and check `https://dingn.com/api/games/tilezen` shows it live. Approve
  with `POST https://dingn.com/api/admin/games/update` and the JSON body
  `{"id":"tilezen","action":"set-live","version":"<version>"}`. The owner's
  review key is saved on their cloud environment and added to requests to
  dingn.com there; never ask for it in chat or write it down.
- Save with `sdk.storage` / `sdk.progress`, never `localStorage` or cookies,
  which the sandbox blocks. Keep every URL relative (`base: "./"`).
- The game speaks every dingn language: English, zh-CN, es, pt-BR, id, ja
  and ko. UI strings go through `t()` in English, with a translation in
  every `src/locales/<lang>.json` (a test checks each shown string has one,
  with the same `{0}` placeholders). Layout names are translated the same
  way. `game.json` carries the title, description and badge titles in each
  language too (Chinese under `zh`). A new string needs all six.
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
- A challenge is a score on a level or a day's puzzle, which must deal the
  same board for whoever opens its link: don't change `levelSeed`, `daySeed`,
  `layoutFor`, `dailyLayout`, `depthFor` or the deal without thinking of the
  open challenges, and raise `SCORE_RULES` in `src/game.tsx` when the
  scoring changes.
- Blocked tiles look like any other: no shading and no hover cue. Telling
  which tile can be picked is part of the game.
- Tile Zen is an original game: its name, layouts, tile drawings and sounds
  are our own. Don't copy names, art, layouts or sounds from other mahjong
  solitaire games.
- Keep it calm and kind: help (hints, undo, shuffle) stays free, no timer
  unless the player turns it on, nothing random is sold.
- The look is drawn, not loaded: tiles and buttons are CSS, icons are our
  own SVG (`src/icons.tsx`, no emoji), sounds are synthesized (`src/sound.ts`,
  no voices, no background music), motion is in `src/fx.ts` and respects reduced motion. Show the
  owner screenshots or a clip of a visual change before releasing it.
