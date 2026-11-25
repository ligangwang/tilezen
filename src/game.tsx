// Tile Zen: the menu, the board with its toolbar, the result card, free
// play, tile themes and settings.
import { useEffect, useRef, useState } from "react";
import type { SignInReason } from "../sdk/dingn-sdk.js";
import { useDingn, useLocale } from "./dingn";
import { BoardView } from "./board-view";
import { LAYOUTS, openLayouts, type Layout } from "./engine/layouts";
import * as S from "./engine/session";
import { badgesFor, BIG_BOARD } from "./badges";
import { DAILY_COINS, FREE_LEVELS, OPEN_DEPTH, coinsFor, dailyLayout, daySeed, depthFor, layoutFor, levelSeed, today } from "./levels";
import { loadSaved, merge, store, type Prefs, type Saved } from "./save";
import { FACE_COUNT, THEMES, faceArt, faceLabel, openThemes, themeById, type Theme } from "./themes";
import * as sound from "./sound";

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
/** How long a matched pair takes to glide together and go (tilezen.css). */
const LEAVE_MS = 420;

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
  const [leaving, setLeaving] = useState<number[]>([]);
  // Tiles just taken out of the tray with their twins, lighting up as they go.
  const [trayLeaving, setTrayLeaving] = useState<{ id: number; face: number; at: number }[]>([]);
  // Matches in a row with no wrong tap and no help: only for the fun of it.
  const [streak, setStreak] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [now, setNow] = useState(Date.now());
  const unlocked = useRef(new Set<string>());

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
  // Music starts with the first tap (browsers allow audio only after one).
  const musicStarted = useRef(false);
  useEffect(() => {
    if (musicStarted.current) sound.setMusic(prefs.music);
  }, [prefs.music]);
  function tapped() {
    sound.wake();
    if (!musicStarted.current) {
      musicStarted.current = true;
      if (prefs.music) sound.setMusic(true);
    }
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

  function begin(mode: Mode, level: number, layout: Layout, seed: number) {
    const depth = mode === "level" ? depthFor(level) : OPEN_DEPTH;
    setRun({ mode, level, day, layout, session: S.start(layout.slots, FACE_COUNT, seed, depth), started: Date.now() });
    setHint(null);
    setLeaving([]);
    setTrayLeaving([]);
    setStreak(0);
    setResult(null);
    setNote("");
    setScreen("play");
  }
  const playLevel = (level: number) => begin("level", level, layoutFor(level), levelSeed(level));
  const playDaily = () => begin("daily", 0, dailyLayout(day), daySeed(day));
  const playFree = (layout: Layout) => begin("free", 0, layout, (Date.now() & 0x7fffffff) | 1);

  const locked = run?.mode === "level" && run.level > FREE_LEVELS && !signedIn;

  function update(session: S.Session) {
    setRun((r) => (r ? { ...r, session } : r));
  }

  function onTile(i: number) {
    tapped();
    if (!run || result) return;
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
    update(next);
    if (next.tray.length > s.tray.length) {
      // It waits in the tray for its twin.
      sound.play("select");
      return;
    }
    sound.play("match", streak);
    setStreak(streak + 1);
    // The tile and its twin in the tray light up and go; a quick player's pairs overlap.
    const twin = s.tray.find((j) => !next.tray.includes(j))!;
    const gone = { id: twin, face: s.faces[twin], at: s.tray.indexOf(twin) };
    setLeaving((l) => [...l, i]);
    setTrayLeaving((l) => [...l, gone]);
    setTimeout(() => {
      setLeaving((l) => l.filter((x) => x !== i));
      setTrayLeaving((l) => l.filter((x) => x !== gone));
    }, LEAVE_MS);
    // The last pair is seen leaving before the result covers the board.
    if (S.cleared(next)) setTimeout(() => void finish(run, next), LEAVE_MS);
  }

  function onHint() {
    tapped();
    if (!run || result) return;
    const pair = S.hint(run.session);
    if (!pair) return;
    sound.play("hint");
    setStreak(0);
    setHint(pair);
    update(S.withHint(run.session));
  }
  function onUndo() {
    tapped();
    if (!run || result || !run.session.history.length) return;
    setStreak(0);
    setHint(null);
    update(S.undo(run.session));
  }
  function onShuffle() {
    tapped();
    if (!run || result) return;
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
    setResult({ coins: null, worth, calm, seconds, opened });
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
    setResult((res) => (res ? { ...res, coins: paid } : res));
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
  };

  return (
    <div className={`tz${prefs.large ? " large" : ""}`} style={style} onPointerDown={tapped}>
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
        <div className="play">
          <header className="hud">
            <button type="button" className="hud-button" onClick={() => { setScreen("menu"); setRun(null); }} aria-label={t("Menu")}>
              ☰ <span className="hud-label">{t("Menu")}</span>
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
              ⚙ <span className="hud-label">{t("Settings")}</span>
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
                session={run.session}
                theme={theme}
                hint={hint}
                leaving={leaving}
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
                <button type="button" className="tool" onClick={onHint} disabled={!!result}>
                  <span className="tool-icon" aria-hidden="true">💡</span>
                  {t("Hint")}
                </button>
                <button type="button" className="tool" onClick={onUndo} disabled={!!result || !run.session.history.length}>
                  <span className="tool-icon" aria-hidden="true">↶</span>
                  {t("Undo")}
                </button>
                <button
                  type="button"
                  className={`tool${run.session.deadEnd ? " glow" : ""}`}
                  onClick={() => onShuffle()}
                  disabled={!!result}
                >
                  <span className="tool-icon" aria-hidden="true">⇄</span>
                  {t("Shuffle")}
                </button>
                {sdk.player.tester && run.mode === "level" && !result && (
                  <button type="button" className="tool" onClick={() => finish(run, run.session)}>
                    <span className="tool-icon" aria-hidden="true">⏭</span>
                    {t("Skip")}
                  </button>
                )}
              </footer>
            </>
          )}
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
                    ✦ {o}
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
    <div className="menu">
      <div className="logo" aria-hidden="true">
        <span className="mini-tile" style={{ background: theme.tile }}>
          <svg viewBox="0 0 62 84">{faceArt(theme.id, 0)}</svg>
        </span>
        <span className="mini-tile" style={{ background: theme.tile }}>
          <svg viewBox="0 0 62 84">{faceArt(theme.id, 31)}</svg>
        </span>
      </div>
      <h1>{t("Tile Zen")}</h1>
      <p className="tagline">{t("Match pairs of free tiles and clear the board, at your own pace.")}</p>
      <div className="menu-buttons">
        <button type="button" className="big primary" onClick={props.onLevel}>
          {t("Play level {0}", String(reached))}
        </button>
        <button type="button" className="big" onClick={props.onDaily}>
          {t("Daily puzzle")}
          {dailyDone && <span className="done"> ✓</span>}
        </button>
        <button type="button" className="big" onClick={props.onLayouts}>
          {t("Free play")}
        </button>
        <div className="row">
          <button type="button" className="big" onClick={props.onThemes}>
            {t("Tile themes")}
          </button>
          <button type="button" className="big" onClick={props.onSettings}>
            {t("Settings")}
          </button>
        </div>
      </div>
      <p className="stats">
        {t("Levels cleared: {0}", String(saved.cleared))} · {t("Layouts open: {0} of {1}", String(openLayouts(reached).length), String(LAYOUTS.length))}
      </p>
      <details className="how">
        <summary>{t("How to play")}</summary>
        <p>{t("Tap a tile to lift it into the tray, then tap its twin and both leave. A tile can be picked when nothing lies on top of it and its left or right side is open.")}</p>
        <p>{t("The tray holds up to four tiles, so you can lift a tile out of the way to reach one under it.")}</p>
        <p>{t("Every board can be cleared. Hints, undo and shuffle are always free, and there is no clock unless you turn it on.")}</p>
      </details>
    </div>
  );
}

function Picker({ title, sub, onBack, children }: { title: string; sub: string; onBack: () => void; children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="picker">
      <header className="picker-head">
        <button type="button" className="hud-button" onClick={onBack}>
          ← {t("Back")}
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
    <span className="sample" style={{ background: `linear-gradient(160deg, ${theme.table[0]}, ${theme.table[1]})` }}>
      {[4, 13, 22, 30].map((f) => (
        <span key={f} className="mini-tile" style={{ background: theme.tile }}>
          <svg viewBox="0 0 62 84">{faceArt(theme.id, f)}</svg>
        </span>
      ))}
    </span>
  );
}

function Settings({ prefs, setPref, onClose }: { prefs: Prefs; setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void; onClose: () => void }) {
  const { t } = useLocale();
  const rows: [keyof Prefs, string, string][] = [
    ["large", t("Large tiles"), t("Bigger tiles and symbols. Big boards scroll.")],
    ["dim", t("Shade blocked tiles"), t("Tiles you can't take yet are shaded.")],
    ["music", t("Calm music"), ""],
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
  leaving: { id: number; face: number; at: number }[];
}) {
  const { t } = useLocale();
  const label = (face: number) => {
    const [name, n] = faceLabel(theme.id, face);
    return n ? t(name, n) : t(name);
  };
  const face = (f: number) => (
    <span className="face">
      <svg viewBox="0 0 62 84" aria-hidden="true">
        {faceArt(theme.id, f)}
      </svg>
    </span>
  );
  return (
    <ul
      className={`tray${session.tray.length >= S.TRAY ? " full" : ""}`}
      aria-label={t("Tray: {0} of {1} places taken", String(session.tray.length), String(S.TRAY))}
      style={{ ["--tile" as string]: theme.tile, ["--edge" as string]: theme.edge }}
    >
      {Array.from({ length: S.TRAY }, (_, k) => {
        const i = session.tray[k];
        return i === undefined ? (
          <li key={`empty-${k}`} className="tray-place" aria-hidden="true" />
        ) : (
          <li key={i} className={`tray-place held${hint?.includes(i) ? " hinted" : ""}`} data-tray={i} aria-label={label(session.faces[i])}>
            {face(session.faces[i])}
          </li>
        );
      })}
      {leaving.map((g) => (
        <li key={`gone-${g.id}`} className="tray-place held gone" aria-hidden="true" style={{ ["--at" as string]: g.at }}>
          {face(g.face)}
        </li>
      ))}
    </ul>
  );
}
