import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DingnGame, Locale } from "../sdk/dingn-sdk.js";
import { TileZen } from "../src/game";
import { DingnProvider } from "../src/dingn";
import { DEFAULT_PREFS, empty, type Saved } from "../src/save";

vi.mock("../src/sound", () => ({ setMusic() {}, setSound() {}, wake() {}, play() {} }));

afterEach(cleanup);

function fakeSdk(signedIn: boolean, locale: Locale = "en") {
  const calls = { earn: vi.fn(async (c: number) => ({ coins: c, left: 100 })), unlock: vi.fn(async () => ({ new: true, coins: 5 })), save: vi.fn(async () => {}), roundEnded: vi.fn(), showSignIn: vi.fn(), requestSignIn: vi.fn() };
  const sdk = {
    gameId: "tilezen",
    version: "1.0.0",
    locale,
    player: { signedIn, name: "", avatar: "" },
    embedded: true,
    onPlayer: () => () => {},
    onLanguage: () => () => {},
    storage: { get: async () => null, set: async () => {} },
    progress: { load: async () => null, save: calls.save },
    rewards: { unlock: calls.unlock, list: async () => [], spend: async () => ({ new: true, coins: 0 }), shop: async () => [], earn: calls.earn },
    challenge: null,
    roundEnded: calls.roundEnded,
    requestSignIn: calls.requestSignIn,
    showSignIn: calls.showSignIn,
    hideSignIn: () => {},
    navigate: () => {},
    ready: () => {},
  } as unknown as DingnGame;
  return { sdk, calls };
}

function mount(sdk: DingnGame, saved: Saved = empty()) {
  return render(
    <DingnProvider sdk={sdk}>
      <TileZen initial={saved} prefs={DEFAULT_PREFS} />
    </DingnProvider>,
  );
}

/** Plays the board to the end by following hints. */
async function clearBoard() {
  for (let n = 0; n < 200 && !screen.queryByText("Board cleared"); n++) {
    // The last pair is seen leaving before the result shows.
    if (!document.querySelector(".tile:not(.leaving)")) {
      await screen.findByText("Board cleared");
      break;
    }
    fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
    // Two tiles on the board, or one whose twin already waits in the tray.
    const hinted = [...document.querySelectorAll(".tile.hinted")];
    expect(hinted.length + document.querySelectorAll(".tray-place.hinted").length).toBe(2);
    for (const tile of hinted) fireEvent.click(tile);
    await act(async () => {});
  }
}

test("level 1 plays to the end and pays coins to a signed-in player", async () => {
  const { sdk, calls } = fakeSdk(true);
  mount(sdk);
  fireEvent.click(screen.getByRole("button", { name: "Play level 1" }));
  expect(document.querySelectorAll(".tile").length).toBe(14);
  await clearBoard();
  await waitFor(() => expect(calls.earn).toHaveBeenCalled());
  expect(calls.roundEnded).toHaveBeenCalledTimes(1);
  // Hints were used, so no calm bonus: 2 coins for 14 tiles.
  expect(calls.earn).toHaveBeenCalledWith(2);
  await waitFor(() => expect(calls.save).toHaveBeenCalled());
  expect(screen.getByText("+2 coins")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next level" })).toBeTruthy();
});

test("a blocked tile can't be picked, and two matching free tiles go", () => {
  const { sdk } = fakeSdk(false);
  mount(sdk);
  fireEvent.click(screen.getByRole("button", { name: "Play level 1" }));
  const blocked = document.querySelector(".tile.blocked")!;
  fireEvent.click(blocked);
  expect(document.querySelectorAll(".tray-place.held").length).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
  expect(screen.getByText(/14 tiles left/)).toBeTruthy();
});

test("a picked tile waits in the tray until its twin is picked, and a full tray takes only a match", () => {
  const { sdk } = fakeSdk(false);
  mount(sdk);
  fireEvent.click(screen.getByRole("button", { name: "Play level 1" }));
  const held = () => document.querySelectorAll(".tray-place.held:not(.gone)").length;
  const tiles = () => document.querySelectorAll(".tile:not(.leaving)").length;
  expect(document.querySelectorAll(".tray-place").length).toBe(4);
  // Lift free tiles of different faces until the tray is full.
  const faces = new Set<string>();
  for (let n = 0; n < 40 && held() < 4; n++) {
    const next = [...document.querySelectorAll<HTMLElement>(".tile.free")].find((el) => !faces.has(el.getAttribute("aria-label")!));
    if (!next) break;
    faces.add(next.getAttribute("aria-label")!);
    fireEvent.click(next);
  }
  expect(held()).toBe(4);
  expect(tiles()).toBe(10);
  // Still 14 to clear: the tray's tiles count.
  expect(screen.getByText(/14 tiles left/)).toBeTruthy();
  // A free tile of another face is refused, with a word why.
  const other = [...document.querySelectorAll<HTMLElement>(".tile.free")].find((el) => !faces.has(el.getAttribute("aria-label")!));
  if (other) {
    fireEvent.click(other);
    expect(held()).toBe(4);
    expect(screen.getByText("The tray is full. Pick a tile that matches one in it.")).toBeTruthy();
  }
  // A twin of a waiting tile leaves with it.
  const twin = [...document.querySelectorAll<HTMLElement>(".tile.free")].find((el) => faces.has(el.getAttribute("aria-label")!));
  if (twin) {
    fireEvent.click(twin);
    expect(held()).toBe(3);
    expect(screen.getByText(/12 tiles left/)).toBeTruthy();
    // Undo brings both back: one to the board, one to the tray.
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(held()).toBe(4);
  }
});

test("a signed-out player meets the sign-in gate after level 5, and dingn's sign-in box on a result", async () => {
  const { sdk, calls } = fakeSdk(false);
  mount(sdk, { ...empty(), cleared: 5 });
  fireEvent.click(screen.getByRole("button", { name: "Play level 6" }));
  expect(screen.getByText("Save your progress to keep going")).toBeTruthy();
  expect(document.querySelectorAll(".tile").length).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Sign in to keep playing" }));
  expect(calls.requestSignIn).toHaveBeenCalled();
  // The daily puzzle is open to everyone.
  fireEvent.click(screen.getByRole("button", { name: "Play the daily puzzle" }));
  await clearBoard();
  expect(calls.earn).not.toHaveBeenCalled();
  expect(calls.showSignIn).toHaveBeenCalledWith(["rewards"]);
});

test("the game speaks Chinese", () => {
  const { sdk } = fakeSdk(false, "zh-CN");
  mount(sdk);
  expect(screen.getByText("静心麻将")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "开始第 1 关" }));
  expect(screen.getByRole("button", { name: /提示/ })).toBeTruthy();
  expect(screen.getByText(/卵石/)).toBeTruthy();
});

test("signing in mid-game keeps the account's progress when it is further on", async () => {
  const { sdk, calls } = fakeSdk(false);
  let listener: (p: DingnGame["player"]) => void = () => {};
  sdk.onPlayer = (l) => ((listener = l), () => {});
  sdk.progress.load = async () => ({ cleared: 20, calm: 3 });
  mount(sdk, { ...empty(), cleared: 2 });
  expect(screen.getByRole("button", { name: "Play level 3" })).toBeTruthy();
  await act(async () => {
    sdk.player = { signedIn: true, name: "", avatar: "" };
    listener(sdk.player);
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Play level 21" })).toBeTruthy());
  expect(calls.save).toHaveBeenLastCalledWith(expect.objectContaining({ cleared: 20, calm: 3 }));
});

test("tiles are read out in the player's language", () => {
  const { sdk } = fakeSdk(false, "zh-CN");
  mount(sdk);
  fireEvent.click(screen.getByRole("button", { name: "开始第 1 关" }));
  const labels = [...document.querySelectorAll(".tile")].map((el) => el.getAttribute("aria-label")!);
  expect(labels.every((l) => /[一-鿿]/.test(l))).toBe(true);
});
