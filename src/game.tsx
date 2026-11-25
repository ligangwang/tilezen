// Tile Zen: the menu, the board with its toolbar, the result card, free
// play, tile themes and settings.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SignInReason } from "../sdk/dingn-sdk.js";
import { useDingn, useLocale } from "./dingn";
import { BoardView } from "./board-view";
import { LAYOUTS, openLayouts, type Layout } from "./engine/layouts";
import * as S from "./engine/session";
import { badgesFor, BIG_BOARD } from "./badges";
import { DAILY_COINS, FREE_LEVELS, OPEN_DEPTH, coinsFor, dailyLayout, daySeed, depthFor, layoutFor, levelSeed, today } from "./levels";
import { loadSaved, merge, store, type Prefs, type Saved } from "./save";
import { FACE_COUNT, THEMES, TileDefs, faceArt, faceLabel, openThemes, themeById, type Theme } from "./themes";
import * as sound from "./sound";
import { Icon } from "./icons";
import { FLY_MS, POP_MS, REST_MS, createFx, fly, pop, slide, type Fx } from "./fx";

type Mode = "level" | "daily" | "free";
type Run = {
  mode: Mode;
  level: number;
  day: string;
  layout: Layout;
  session: S.Session;
  started: number;
};
type Result = {
  /** Coins dingn paid, null when nothing was asked for (or signed out). */
  coins: number | null;
  /** Coins the board was worth. */
  worth: number;
  calm: boolean;
  seconds: number;
  /** What clearing this level opened: layouts and themes. */
  opened: string[];
};
type Screen = "menu" | "play" | "layouts" | "themes";
/** How long a matched tile takes to fly to the tray, and the pair to meet and pop. */
const LEAVE_MS = FLY_MS + REST_MS + POP_MS;
/**
 * A matched tile on its way out, still shown in the tray: at place `slot`,
 * or with `slot` null (the tray was full) half over its twin at place `at`.
 */
type Leaving = { id: number; face: number; slot: number | null; at: number };
/** The colours of the petals a theme throws. */
const petals = (theme: Theme) => [theme.back, "#ff9db5", "#ffd76a", "#fff7e0"];

export function TileZen({ initial, prefs: initialPrefs }: { initial: Saved; prefs: Prefs }) {
  const sdk = useDingn();
  const { t, locale } = useLocale();
  const zh = locale.startsWith("zh");
  const layoutName = (l: Layout) => (zh ? l.name.zh : l.name.en);
  const signedIn = sdk.player.signedIn;

  const [saved, setSavedState] = useState(initial);
  // The latest save, so a late answer from dingn never writes an old one.
  const savedRef = useRef(initial);
  function commit(next: Saved) {
    savedRef.current = next;
    setSavedState(next);
    void store(sdk, next);
  }
  const [prefs, setPrefs] = useState(initialPrefs);
  const [screen, setScreen] = useState<Screen>("menu");
  const [settings, setSettings] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [hint, setHint] = useState<number[] | null>(null);
  // Matched pairs on their way out: they keep their places in the tray
  // until they have met and popped.
  const [trayLeaving, setTrayLeaving] = useState<Leaving[]>([]);
  // Where each tile just picked left the board, until it has been flown in.
  const flights = useRef(new Map<number, DOMRect>());
  const playEl = useRef<HTMLDivElement>(null);
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const fx = useRef<Fx | null>(null);
  function effects() {
    if (fx.current?.canvas !== fxCanvas.current) fx.current = fxCanvas.current && createFx(fxCanvas.current);
    return fx.current;
  }
  // Where each tile in the tray was drawn last, to slide it when it moves up.
  const places = useRef(new Map<string, number>());
  // Once the tray is drawn with a picked tile in it, fly the tile there;
  // and when a pair has gone, slide the tiles after it into the gap.
  useLayoutEffect(() => {
    const root = playEl.current;
    const now = new Map<string, number>();
    for (const el of root?.querySelectorAll<HTMLElement>("[data-tray]") ?? []) {
      const id = el.dataset.tray!;
      now.set(id, el.offsetLeft);
      const from = flights.current.get(Number(id));
      const was = places.current.get(id);
      if (from) fly(el, from);
      else if (was !== undefined && was !== el.offsetLeft) slide(el, was - el.offsetLeft);
    }
    places.current = now;
    flights.current.clear();
  });
  // Matches in a row with no wrong tap and no help: only for the fun of it.
  const [streak, setStreak] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [now, setNow] = useState(Date.now());
  const unlocked = useRef(new Set<string>());
  // When the run on screen started: a result is shown only for that run.
  const current = useRef(0);

  const reached = saved.cleared + 1;
  const theme = themeById(openThemes(reached).some((th) => th.id === prefs.theme) ? prefs.theme : "classic");
  const day = today();
  const dailyDone = saved.daily?.day === day;

  // Settings live on this device.
  function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void sdk.storage.set("prefs", next).catch(() => {});
  }
  useEffect(() => sound.setSound(prefs.sound), [prefs.sound]);
  function tapped(e?: React.PointerEvent) {
    sound.wake();
    // Every button answers with a tick; a tile has its own sound.
    if ((e?.target as Element | undefined)?.closest?.("button:not(.tile):not(:disabled), .toggle")) sound.play("tap");
  }

  // When the player signs in mid-game, combine their account's save with
  // this device's, keeping the better of each, and save that to both.
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void loadSaved(sdk).then((account) => {
      if (active) commit(merge(account, savedRef.current));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // The clock, only when it's shown.
  useEffect(() => {
    if (!prefs.clock || screen !== "play" || result) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [prefs.clock, screen, result]);

  // A note fades after a few seconds.
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 4000);
    return () => clearTimeout(id);
  }, [note]);

  function begin(mode: Mode, level: number, layout: Layout, seed: number, on = day) {
    const depth = mode === "level" ? depthFor(level) : OPEN_DEPTH;
    const started = Date.now();
    current.current = started;
    setRun({ mode, level, day: on, layout, session: S.start(layout.slots, FACE_COUNT, seed, depth), started });
    setHint(null);
    flights.current.clear();
    fx.current?.clear();
    setTrayLeaving([]);
    setStreak(0);
    setResult(null);
    setNote("");
    setScreen("play");
    sound.play("deal");
  }
  const playLevel = (level: number) => begin("level", level, layoutFor(level), levelSeed(level));
  // Today as it is now: the menu may have been open since yesterday.
  const playDaily = () => {
    const on = today();
    begin("daily", 0, dailyLayout(on), daySeed(on), on);
  };
  const playFree = (layout: Layout) => begin("free", 0, layout, (Date.now() & 0x7fffffff) | 1);

  const locked = run?.mode === "level" && run.level > FREE_LEVELS && !signedIn;
  // A cleared board takes no more taps or help while its last pair leaves
  // and the result comes up, so it is finished (and paid) once.
  const done = !!result || (!!run && S.cleared(run.session));

  function update(session: S.Session) {
    setRun((r) => (r ? { ...r, session } : r));
  }

  function onTile(i: number) {
    tapped();
    if (!run || result || S.cleared(run.session)) return;
    const s = run.session;
    if (!S.free(s, i)) {
      sound.play("blocked");
      setStreak(0);
      setShake(i);
      setTimeout(() => setShake((v) => (v === i ? null : v)), 400);
      return;
    }
    const next = S.pick(s, i);
    if (!next) {
      // Free, but the tray is full of other tiles.
      sound.play("blocked");
      setStreak(0);
      setShake(i);
      setTimeout(() => setShake((v) => (v === i ? null : v)), 400);
      setNote(t("The tray is full. Pick a tile that matches one in it."));
      return;
    }
    setHint(null);
    // The tile flies from here to the tray.
    const from = playEl.current?.querySelector(`[data-tile="${i}"]`)?.getBoundingClientRect();
    if (from) flights.current.set(i, from);
    update(next);
    sound.play("select");
    const started = run.started;
    if (next.tray.length > s.tray.length) {
      // It waits in the tray for its twin.
      setTimeout(() => current.current === started && sound.play("land"), FLY_MS);
      return;
    }
    setStreak(streak + 1);
    // It takes the next place in the tray like any tile, rests a moment,
    // then slides to meet its twin and the pair pops in a puff of petals.
    // A quick player's pairs overlap.
    const twin = s.tray.find((j) => !next.tray.includes(j))!;
    const at = s.tray.indexOf(twin);
    const pair: Leaving[] = [
      { id: twin, face: s.faces[twin], slot: at, at },
      { id: i, face: s.faces[i], slot: s.tray.length < S.TRAY ? s.tray.length : null, at },
    ];
    setTrayLeaving((l) => [...l, ...pair]);
    setTimeout(() => current.current === started && sound.play("land"), FLY_MS);
    setTimeout(() => {
      if (current.current !== started) return;
      sound.play("match", streak);
      const [a, b] = [twin, i].map((id) => playEl.current?.querySelector<HTMLElement>(`[data-tray="${id}"]`));
      const [ra, rb] = [a, b].map((el) => el?.getBoundingClientRect());
      if (!a || !b || !ra?.width || !rb) return;
      const gap = rb.left - ra.left;
      pop(a, gap / 2);
      pop(b, -gap / 2);
      effects()?.burst(ra.left + gap / 2 + ra.width / 2, ra.top + ra.height / 2, petals(theme));
    }, FLY_MS + REST_MS);
    setTimeout(() => setTrayLeaving((l) => l.filter((x) => !pair.includes(x))), LEAVE_MS);
    // The last pair is seen leaving before the result covers the board.
    if (S.cleared(next)) setTimeout(() => void finish(run, next), LEAVE_MS);
  }

  function onHint() {
    tapped();
    if (!run || result || S.cleared(run.session)) return;
    const pair = S.hint(run.session);
    if (!pair) return;
    sound.play("hint");
    setStreak(0);
    setHint(pair);
    update(S.withHint(run.session));
  }
  function onUndo() {
    tapped();
    if (!run || result || S.cleared(run.session) || !run.session.history.length) return;
    sound.play("undo");
    setStreak(0);
    setHint(null);
    update(S.undo(run.session));
  }
  function onShuffle() {
    tapped();
    if (!run || result || S.cleared(run.session)) return;
    const { session, rewound } = S.shuffle(run.session);
    sound.play("shuffle");
    setStreak(0);
    setHint(null);
    update(session);
    if (rewound) setNote(t("Stepped back {0} moves so the tiles could be shuffled.", String(rewound)));
  }
  async function finish(r: Run, session: S.Session) {
    sdk.roundEnded();
    sound.play("win");
    const tiles = r.layout.slots.length;
    const calm = !S.helped(session);
    const seconds = Math.round((Date.now() - r.started) / 1000);
    const saved = savedRef.current;
    const next: Saved = { ...saved, biggest: Math.max(saved.biggest, tiles) };
    let worth = 0;
    const opened: string[] = [];
    if (r.mode === "level") {
      worth = coinsFor(tiles, calm);
      if (calm) next.calm = saved.calm + 1;
      if (r.level > saved.cleared) {
        next.cleared = r.level;
        for (const l of LAYOUTS) if (l.unlock === r.level + 1) opened.push(t("New layout: {0}", layoutName(l)));
        for (const th of THEMES) if (th.unlock === r.level + 1) opened.push(t("New tile theme: {0}", t(th.name)));
      }
    } else if (r.mode === "daily") {
      const first = saved.daily?.day !== r.day;
      if (first) next.dailies = saved.dailies + 1;
      if (calm) next.calm = saved.calm + 1;
      next.daily = { day: r.day, paid: !first && !!saved.daily?.paid };
      worth = next.daily.paid ? 0 : DAILY_COINS;
    } else if (calm) next.calm = saved.calm + 1;
    // Left for the menu or another board meanwhile: it still counts, unseen.
    const shown = current.current === r.started;
    if (shown) {
      setResult({ coins: null, worth, calm, seconds, opened });
      effects()?.rain(petals(theme));
    }
    // Progress is saved at once; coins are paid after, on their own.
    commit(next);
    if (!signedIn) return;
    // Coins go to the player's dingn account (and on into their kingdom).
    let paid: number | null = null;
    if (worth > 0) {
      try {
        paid = (await sdk.rewards.earn(worth)).coins;
        const latest = savedRef.current;
        if (r.mode === "daily" && latest.daily?.day === r.day) commit({ ...latest, daily: { day: r.day, paid: true } });
      } catch {}
    }
    if (current.current === r.started) setResult((res) => (res ? { ...res, coins: paid } : res));
    for (const id of badgesFor(next)) {
      if (unlocked.current.has(id)) continue;
      unlocked.current.add(id);
      void sdk.rewards.unlock(id).catch(() => unlocked.current.delete(id));
    }
  }

  // All sign-in prompts on a result are dingn's: the game only says when.
  const signInReasons: SignInReason[] =
    !signedIn && result && run?.mode !== "free" ? (run?.mode === "level" ? ["rewards", "progress"] : ["rewards"]) : [];
  const signInKey = signInReasons.join(",");
  useEffect(() => {
    if (!signInKey || !sdk.showSignIn) return;
    sdk.showSignIn(signInKey.split(",") as SignInReason[]);
    return () => sdk.hideSignIn?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signInKey]);

  const style = {
    ["--table-a" as string]: theme.table[0],
    ["--table-b" as string]: theme.table[1],
    ...tileColors(theme),
  };

  return (
    <div className={`tz${prefs.large ? " large" : ""}`} style={style} onPointerDown={tapped}>
      <TileDefs />
      {screen === "menu" && (
        <Menu
          reached={reached}
          saved={saved}
          dailyDone={dailyDone}
          onLevel={() => playLevel(reached)}
          onDaily={playDaily}
          onLayouts={() => setScreen("layouts")}
          onThemes={() => setScreen("themes")}
          onSettings={() => setSettings(true)}
          theme={theme}
        />
      )}
      {screen === "layouts" && (
        <Picker title={t("Free play")} sub={t("Play any layout you have opened, as often as you like. Free play pays no coins.")} onBack={() => setScreen("menu")}>
          {LAYOUTS.map((l) => {
            const open = l.unlock <= reached;
            return (
              <button key={l.id} type="button" className="card" disabled={!open} onClick={() => playFree(l)}>
                <LayoutThumb layout={l} />
                <strong>{layoutName(l)}</strong>
                <span>{open ? t("{0} tiles", String(l.slots.length)) : t("Opens at level {0}", String(l.unlock))}</span>
              </button>
            );
          })}
        </Picker>
      )}
      {screen === "themes" && (
        <Picker title={t("Tile themes")} sub={t("New themes open as you clear levels.")} onBack={() => setScreen("menu")}>
          {THEMES.map((th) => {
            const open = th.unlock <= reached;
            return (
              <button
                key={th.id}
                type="button"
                className={`card theme-card${th.id === theme.id ? " chosen" : ""}`}
                disabled={!open}
                aria-pressed={th.id === theme.id}
                onClick={() => setPref("theme", th.id)}
              >
                <ThemeSample theme={th} />
                <strong>{t(th.name)}</strong>
                <span>{!open ? t("Opens at level {0}", String(th.unlock)) : th.id === theme.id ? t("In use") : t("Use this theme")}</span>
              </button>
            );
          })}
        </Picker>
      )}
      {screen === "play" && run && (
        <div className="play" ref={playEl}>
          <header className="hud">
            <button type="button" className="hud-button" onClick={() => { current.current = 0; setScreen("menu"); setRun(null); }} aria-label={t("Menu")}>
              <Icon name="home" />
              <span className="hud-label">{t("Menu")}</span>
            </button>
            <div className="hud-title">
              <strong>
                {run.mode === "level" ? t("Level {0}", String(run.level)) : run.mode === "daily" ? t("Daily puzzle") : t("Free play")}
              </strong>
              <span>
                {layoutName(run.layout)} · {t("{0} tiles left", String(S.tilesLeft(run.session)))}
                {prefs.clock && !locked && ` · ${clock(Math.round(((result ? run.started + result.seconds * 1000 : now) - run.started) / 1000))}`}
              </span>
            </div>
            <button type="button" className="hud-button" onClick={() => setSettings(true)} aria-label={t("Settings")}>
              <Icon name="gear" />
              <span className="hud-label">{t("Settings")}</span>
            </button>
          </header>
          {/* How much of the board is cleared. */}
          <div className="progress" aria-hidden="true">
            {/* A new board starts the bar empty, without sliding back. */}
            <i key={run.started} style={{ width: `${100 - (100 * S.tilesLeft(run.session)) / run.layout.slots.length}%` }} />
          </div>
          {locked ? (
            <div className="overlay gate">
              <div className="panel">
                <p className="eyebrow">{t("Level {0}", String(run.level))}</p>
                <h2>{t("Save your progress to keep going")}</h2>
                <p>
                  {t(
                    "You've cleared the first {0} levels. Sign in for free to play level {1} and beyond, and pick up where you left off on any device.",
                    String(FREE_LEVELS),
                    String(FREE_LEVELS + 1),
                  )}
                </p>
                <div className="actions">
                  <button type="button" className="big primary" onClick={() => sdk.requestSignIn()}>
                    {t("Sign in to keep playing")}
                  </button>
                  <button type="button" className="big" onClick={playDaily}>
                    {t("Play the daily puzzle")}
                  </button>
                  <button type="button" className="big" onClick={() => setScreen("layouts")}>
                    {t("Free play")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <BoardView
                key={run.started}
                session={run.session}
                theme={theme}
                hint={hint}
                shake={shake}
                dim={prefs.dim}
                large={prefs.large}
                onTile={onTile}
              />
              {!result && run.session.deadEnd && (
                <div className="stuck" role="status">
                  <strong>{t("The tray is full and no free tile matches it.")}</strong>
                  <span>{t("Shuffle the tiles, free, or undo a move.")}</span>
                </div>
              )}
              {!result && streak >= 3 && (
                <div className="streak" key={streak} role="status">
                  {t("{0} in a row", String(streak))}
                </div>
              )}
              {note && (
                <div className="note" role="status">
                  {note}
                </div>
              )}
              <Tray session={run.session} theme={theme} hint={hint} leaving={trayLeaving} />
              <footer className="toolbar">
                <button type="button" className="tool" onClick={onHint} disabled={done}>
                  <span className="tool-icon"><Icon name="hint" size={26} /></span>
                  {t("Hint")}
                </button>
                <button type="button" className="tool" onClick={onUndo} disabled={done || !run.session.history.length}>
                  <span className="tool-icon"><Icon name="undo" size={26} /></span>
                  {t("Undo")}
                </button>
                <button
                  type="button"
                  className={`tool${run.session.deadEnd ? " glow" : ""}`}
                  onClick={() => onShuffle()}
                  disabled={done}
                >
                  <span className="tool-icon"><Icon name="shuffle" size={26} /></span>
                  {t("Shuffle")}
                </button>
                {sdk.player.tester && run.mode === "level" && !result && (
                  <button type="button" className="tool" onClick={() => finish(run, run.session)}>
                    <span className="tool-icon"><Icon name="skip" size={26} /></span>
                    {t("Skip")}
                  </button>
                )}
              </footer>
            </>
          )}
          <canvas className="fx" ref={fxCanvas} aria-hidden="true" />
          {result && (
            <div className="overlay result">
              <div className="panel">
                <p className="eyebrow">
                  {run.mode === "level" ? t("Level {0}", String(run.level)) : run.mode === "daily" ? t("Daily puzzle") : t("Free play")}
                </p>
                <h2>{t("Board cleared")}</h2>
                {result.calm && <p className="calm">{t("A calm clear: no hints, undos or shuffles.")}</p>}
                <p className="facts">
                  {t("{0} tiles", String(run.layout.slots.length))} · {clock(result.seconds)}
                </p>
                {result.worth > 0 && signedIn && (
                  <p className="coins">
                    <img src="./coin.svg" alt="" width="26" height="26" />
                    {result.coins === null ? t("+{0} coins", String(result.worth)) : t("+{0} coins", String(result.coins))}
                  </p>
                )}
                {run.mode === "daily" && result.worth === 0 && <p>{t("Today's puzzle has already paid its coins. Come back tomorrow for a new one.")}</p>}
                {result.opened.map((o) => (
                  <p key={o} className="opened">
                    {o}
                  </p>
                ))}
                <div className="actions">
                  {run.mode === "level" && (
                    <button type="button" className="big primary" onClick={() => playLevel(run.level + 1)}>
                      {t("Next level")}
                    </button>
                  )}
                  {run.mode === "free" && (
                    <button type="button" className="big primary" onClick={() => playFree(run.layout)}>
                      {t("Play again")}
                    </button>
                  )}
                  <button type="button" className="big" onClick={() => { setScreen("menu"); setRun(null); setResult(null); }}>
                    {t("Menu")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {settings && <Settings prefs={prefs} setPref={setPref} onClose={() => setSettings(false)} />}
    </div>
  );
}

/** A theme's tile colours, for the tiles drawn inside the element. */
const tileColors = (theme: Theme) => ({
  ["--tile" as string]: theme.tile,
  ["--edge" as string]: theme.edge,
  ["--back" as string]: theme.back,
});

/** A small tile that is only for show: the logo and the theme samples. */
function MiniTile({ theme, face }: { theme: Theme; face: number }) {
  return (
    <span className="mini-tile">
      <span className="side" />
      <span className="face">
        <svg viewBox="0 0 62 84">{faceArt(theme.id, face)}</svg>
      </span>
    </span>
  );
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function Menu(props: {
  reached: number;
  saved: Saved;
  dailyDone: boolean;
  theme: Theme;
  onLevel: () => void;
  onDaily: () => void;
  onLayouts: () => void;
  onThemes: () => void;
  onSettings: () => void;
}) {
  const { t } = useLocale();
  const { reached, saved, dailyDone, theme } = props;
  return (
    <div className="menu-wrap">
      <div className="menu">
        <div className="logo" aria-hidden="true">
          {[0, 31, 27].map((face) => (
            <MiniTile key={face} theme={theme} face={face} />
          ))}
        </div>
        <h1>{t("Tile Zen")}</h1>
        <p className="tagline">{t("Match pairs of free tiles and clear the board, at your own pace.")}</p>
        <div className="menu-buttons">
          <button type="button" className="big primary" onClick={props.onLevel}>
            <span className="menu-icon"><Icon name="play" size={22} /></span>
            {t("Play level {0}", String(reached))}
          </button>
          <div className="row">
            <button type="button" className="big" onClick={props.onDaily}>
              <span className="menu-icon"><Icon name="sun" size={26} /></span>
              {t("Daily puzzle")}
              {dailyDone && <span className="done"><Icon name="check" size={18} /></span>}
            </button>
            <button type="button" className="big" onClick={props.onLayouts}>
              <span className="menu-icon"><Icon name="layers" size={26} /></span>
              {t("Free play")}
            </button>
          </div>
          <div className="row">
            <button type="button" className="big quiet" onClick={props.onThemes}>
              <span className="menu-icon"><Icon name="palette" size={20} /></span>
              {t("Tile themes")}
            </button>
            <button type="button" className="big quiet" onClick={props.onSettings}>
              <span className="menu-icon"><Icon name="gear" size={20} /></span>
              {t("Settings")}
            </button>
          </div>
        </div>
        <p className="stats">
          <span>{t("Levels cleared: {0}", String(saved.cleared))}</span>
          <span>{t("Layouts open: {0} of {1}", String(openLayouts(reached).length), String(LAYOUTS.length))}</span>
        </p>
        <details className="how">
          <summary>{t("How to play")}</summary>
          <p>{t("Tap a tile to lift it into the tray, then tap its twin and both leave. A tile can be picked when nothing lies on top of it and its left or right side is open.")}</p>
          <p>{t("The tray holds up to four tiles, so you can lift a tile out of the way to reach one under it.")}</p>
          <p>{t("Every board can be cleared. Hints, undo and shuffle are always free, and there is no clock unless you turn it on.")}</p>
        </details>
      </div>
    </div>
  );
}

function Picker({ title, sub, onBack, children }: { title: string; sub: string; onBack: () => void; children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="picker">
      <header className="picker-head">
        <button type="button" className="hud-button" onClick={onBack}>
          <Icon name="back" />
          <span>{t("Back")}</span>
        </button>
        <h2>{title}</h2>
      </header>
      <p className="picker-sub">{sub}</p>
      <div className="cards">{children}</div>
    </div>
  );
}

function LayoutThumb({ layout }: { layout: Layout }) {
  const maxX = Math.max(...layout.slots.map((s) => s.x)) + 2;
  const maxY = Math.max(...layout.slots.map((s) => s.y)) + 2;
  return (
    <svg className="thumb" viewBox={`-1 -1 ${maxX + 2} ${maxY * 1.36 + 2}`} aria-hidden="true">
      {layout.slots.map((s, i) => (
        <rect
          key={i}
          x={s.x - s.z * 0.25}
          y={s.y * 1.36 - s.z * 0.25}
          width="1.85"
          height="2.55"
          rx="0.3"
          fill={["#fffaf0", "#f3e3bf", "#e8cf98", "#ddb978", "#cf9f58"][s.z] ?? "#cf9f58"}
          stroke="#6b5530"
          strokeWidth="0.12"
        />
      ))}
    </svg>
  );
}

function ThemeSample({ theme }: { theme: Theme }) {
  return (
    <span className="sample" style={{ background: `linear-gradient(160deg, ${theme.table[0]}, ${theme.table[1]})`, ...tileColors(theme) }}>
      {[4, 13, 22, 30].map((f) => (
        <MiniTile key={f} theme={theme} face={f} />
      ))}
    </span>
  );
}

function Settings({ prefs, setPref, onClose }: { prefs: Prefs; setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void; onClose: () => void }) {
  const { t } = useLocale();
  const rows: [keyof Prefs, string, string][] = [
    ["large", t("Large tiles"), t("Bigger tiles and symbols. Big boards scroll.")],
    ["dim", t("Shade blocked tiles"), t("Tiles you can't take yet are shaded.")],
    ["sound", t("Sound effects"), ""],
    ["clock", t("Show the clock"), t("Off by default: take all the time you like.")],
  ];
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("Settings")} onClick={onClose}>
      <div className="panel settings" onClick={(e) => e.stopPropagation()}>
        <h2>{t("Settings")}</h2>
        {rows.map(([key, label, help]) => (
          <label key={key} className="toggle">
            <span>
              <strong>{label}</strong>
              {help && <small>{help}</small>}
            </span>
            <input type="checkbox" checked={prefs[key] as boolean} onChange={(e) => setPref(key, e.target.checked as never)} />
          </label>
        ))}
        <button type="button" className="big primary" onClick={onClose}>
          {t("Done")}
        </button>
      </div>
    </div>
  );
}

/**
 * The tray under the board: the tiles the player picked whose twins are
 * still to come, with an empty place for each tile it can still take. A
 * tile taken out with its twin lights up over its place as it goes.
 */
function Tray({
  session,
  theme,
  hint,
  leaving,
}: {
  session: S.Session;
  theme: Theme;
  hint: number[] | null;
  leaving: Leaving[];
}) {
  const { t } = useLocale();
  const label = (face: number) => {
    const [name, n] = faceLabel(theme.id, face);
    return n ? t(name, n) : t(name);
  };
  const face = (f: number) => (
    <>
      <span className="side" />
      <span className="face">
        <svg viewBox="0 0 62 84" aria-hidden="true">
          {faceArt(theme.id, f)}
        </svg>
      </span>
    </>
  );
  // The places in order: the tiles waiting, with each matched tile still
  // in the place it had until its pair has gone.
  const places: ({ id: number; gone?: Leaving })[] = session.tray.map((id) => ({ id }));
  for (const g of [...leaving].sort((x, y) => (x.slot ?? 0) - (y.slot ?? 0)))
    if (g.slot !== null) places.splice(Math.min(g.slot, places.length), 0, { id: g.id, gone: g });
  const over = leaving.filter((g) => g.slot === null);
  return (
    <ul
      className={`tray${session.tray.length >= S.TRAY ? " full" : ""}`}
      aria-label={t("Tray: {0} of {1} places taken", String(session.tray.length), String(S.TRAY))}
    >
      {places.map(({ id, gone }) =>
        gone ? (
          <li key={id} className="tray-place held gone" data-tray={id} aria-hidden="true">
            {face(gone.face)}
          </li>
        ) : (
          <li key={id} className={`tray-place held${hint?.includes(id) ? " hinted" : ""}`} data-tray={id} aria-label={label(session.faces[id])}>
            {face(session.faces[id])}
          </li>
        ),
      )}
      {Array.from({ length: Math.max(0, S.TRAY - places.length) }, (_, k) => (
        <li key={`empty-${k}`} className="tray-place" aria-hidden="true" />
      ))}
      {over.map((g) => (
        <li key={g.id} className="tray-place held gone over" data-tray={g.id} aria-hidden="true" style={{ ["--at" as string]: g.at }}>
          {face(g.face)}
        </li>
      ))}
    </ul>
  );
}
