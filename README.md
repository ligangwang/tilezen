# Tile Zen (静心麻将)

A calm tile-matching solitaire for [dingn](https://dingn.com): match pairs of
free tiles to clear the board. Play it at <https://dingn.com/play/tilezen/>.

A picked tile lifts into a tray that holds four; picking its twin takes both
away. Lifting a tile frees what it was blocking, so the tray is how a player
reaches a twin that is buried. Four different tiles waiting fill the tray,
and the board is failed: the player tries it again, or takes the last tile
back.

- **Rules**: tap a tile to lift it into the tray, then tap its twin and both
  leave. A tile can be picked when nothing lies on top of it and its left or
  right side is open.
- **Every deal can be cleared, and needs the tray.** A board is dealt by
  playing it with blank tiles and a tray: each pick either opens a pair (the
  tile takes a face and waits) or closes one, so the deal comes with the
  picks that clear it (`src/engine/tray.ts`). A twin can lie under other
  tiles, which is why boards can have far more covered tiles than a game
  played pair by pair. Early levels keep twins within reach; later ones bury
  them two, then three tiles deep, always leaving a place in the tray spare.
  The tray's rim lights when one place is left, and the game says when no
  free tile matches the tiles waiting, so the next pick would fail the board.
- **Free help**: hints, undo and shuffle are always free and unlimited. A
  hint is the next pick of a way through that the game keeps up to date as
  you play, with its twin pointed out. A shuffle puts the tray back and deals
  the tiles left so the board can be cleared again.
- **Tiles like real ones**: thick two-layer tiles (a pale front on a
  coloured back) with rounded, polished edges and symbols carved into them
  (`src/tilezen.css`, the `tz-carve` filter in `src/themes.tsx`). The
  characters are outlines in `src/glyphs.ts` (from Noto Serif TC, SIL Open
  Font License), so every device draws them alike. A picked tile flies to
  the tray and takes a place there; a matched pair then slides together and
  pops in a puff of petals, a new board is dealt
  tile by tile and a cleared one rains petals (`src/fx.ts`); all of it is
  skipped for players who ask their device for less motion.
- **Big, clear tiles**: strong colours on polished light tiles, blocked
  tiles shaded, and a **Large tiles** setting
  for phones and older players (the board scrolls instead of shrinking).
- **No hurry**: no timer unless the player turns on the clock. The only
  sounds are the tiles', made with Web Audio: clacks, a wooden tray, bells on
  a match. No background music, no voices, no audio files.
- **Score**: every board keeps a score, shown under the title as it grows.
  A pair is worth 100 points, and 10 more for each pair cleared in a row
  before it (up to double); a wrong tap or any help ends the row. A hint
  takes 40 points off, an undo 30 and a shuffle 150, never below nothing,
  and a calm clear (no help at all) adds a fifth. The result card shows
  what the score is made of. The rules are in `src/engine/session.ts`
  (`score`); nothing is timed.
- **Levels**: endless short levels on 16 layouts of our own (Pebble, Stream,
  Lotus, Old Well, Stone Bridge, Moon Gate, Drum Tower, Lantern, Butterfly, Cloud, Pagoda, Folding
  Fan, Far Mountains, Twin Peaks, Courtyard, Mountain Temple), from 14 to 120
  tiles. Each layout debuts on its own level and then opens in **Free play**;
  every 10th level plays the biggest open layout.
- **Tile themes**: Classic (dots, sticks, numerals and honours), Garden, Sea
  and Starry Night, opening at levels 1, 6, 14 and 24.
- **Daily puzzle**: one board a UTC day, the same for everyone, open to
  signed-out players too.
- **Sign in**: levels 1 to 5 are open to everyone; level 6 and on need a free
  dingn account (dingn's own sign-in).
- English and Chinese (`src/locales/zh-CN.json`).

## Coins and badges

- A cleared level pays 2 coins plus 1 for every 30 tiles, plus 1 for a
  **calm clear** (no hint, undo or shuffle), up to 10 (`coinsFor` in
  `src/levels.ts`), through `sdk.rewards.earn`. dingn passes coins on to the
  player's kingdom and caps what a game pays each day.
- The daily puzzle pays 10 coins once a day. Free play pays nothing.
- 11 badges in `game.json` (levels 5 to 250, calm clears, a 100-tile board,
  daily puzzles) pay what dingn gives their tier.

## Develop

```sh
npm install
npm run dev     # http://localhost:5173/  (?cleared=20&signedin&lang=zh-CN to try later levels)
npm test        # typecheck, rules tests, component tests
```

To play it inside dingn while developing, open the
[playground](https://dingn.com/developers/playground/) and load
`http://localhost:5173/`.

## What's where

- `src/engine/board.ts`: what each tile touches, and which tiles are free.
- `src/engine/tray.ts`: dealing for the tray, the solver and reshuffles.
- `src/engine/session.ts`: one play of a board: moves, undo, hints, shuffles.
- `src/engine/layouts.ts`: the layouts, drawn as rows of text per layer.
- `src/levels.ts`: which layout each level plays, the daily puzzle, coins.
- `src/themes.tsx`: the tile faces, drawn as SVG.
- `src/board-view.tsx`, `src/game.tsx`: the board, menu, result and settings.
- `src/save.ts`: what's saved, on the device and to the player's account.
- `src/sound.ts`: sound effects.

## Release a new version

1. In a pull request, raise `version` in `game.json`.
2. Merge it to `main`. The **Build and publish** Action tests the game,
   builds `release/tilezen-<version>.zip` and uploads it to dingn with the
   `DINGN_UPLOAD_KEY` secret.
3. The new version waits in dingn's review queue and goes live once it is
   approved.

### The upload key

Create a key on <https://dingn.com/developers/games/> (signed in as the
account that owns the game), then add it to this repository under
**Settings → Secrets and variables → Actions** as `DINGN_UPLOAD_KEY`.

## Credits

Written by Ligang Wang. Built with [React](https://react.dev/). Every tile,
layout and sound is our own, drawn or synthesised in code; the coin picture
is dingn's. The game ships no third-party assets.
