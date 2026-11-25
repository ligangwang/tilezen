import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DingnGame, Locale } from "../sdk/dingn-sdk.js";
import { TileZen } from "../src/game";
import { DingnProvider } from "../src/dingn";
import { DEFAULT_PREFS, empty, type Saved } from "../src/save";

vi.mock("../src/sound", () => ({ setSound() {}, wake() {}, play() {} }));

afterEach(cleanup);

function fakeSdk(signedIn: boolean, locale: Locale = "en") {
  const calls = { earn: vi.fn(async (c: number) => ({ coins: c, left: 100 })), unlock: vi.fn(async () => ({ new: true, coins: 5 })), save: vi.fn(async () => {}), roundEnded: vi.fn(), showSignIn: vi.fn(), requestSignIn: vi.fn(), challengeStanding: vi.fn(async () => null), challengeLink: vi.fn(async () => "https://dingn.com/c/abc"), challengeResult: vi.fn(async (score: number) => ({ beat: false, posted: true, best: score, rank: 2, players: 3 })) };
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
    challengeStanding: calls.challengeStanding,
    challengeLink: calls.challengeLink,
    challengeResult: calls.challengeResult,
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
    // The tile to pick, with its twin pointed out too (on the board or in the tray).
    const next = document.querySelectorAll(".tile.pick-next");
    expect(next.length).toBe(1);
    expect(document.querySelectorAll(".tile.hinted, .tray-place.hinted").length).toBe(2);
    fireEvent.click(next[0]);
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

test("a picked tile waits in the tray until its twin is picked, and four different tiles fail the board", async () => {
  const { sdk } = fakeSdk(false);
  mount(sdk);
  fireEvent.click(screen.getByRole("button", { name: "Play level 1" }));
  const held = () => document.querySelectorAll(".tray-place.held:not(.gone)").length;
  const tiles = () => document.querySelectorAll(".tile:not(.leaving)").length;
  expect(document.querySelectorAll(".tray-place").length).toBe(4);
  // Lift free tiles of different faces until one place is left.
  const faces = new Set<string>();
  const stranger = () => [...document.querySelectorAll<HTMLElement>(".tile.free")].find((el) => !faces.has(el.getAttribute("aria-label")!));
  for (let n = 0; n < 40 && held() < 3; n++) {
    const next = stranger()!;
    faces.add(next.getAttribute("aria-label")!);
    fireEvent.click(next);
  }
  expect(held()).toBe(3);
  expect(tiles()).toBe(11);
  // Still 14 to clear: the tray's tiles count.
  expect(screen.getByText(/14 tiles left/)).toBeTruthy();
  // A twin of a waiting tile leaves with it, and undo brings both back.
  const twin = [...document.querySelectorAll<HTMLElement>(".tile.free")].find((el) => faces.has(el.getAttribute("aria-label")!));
  if (twin) {
    fireEvent.click(twin);
    expect(held()).toBe(2);
    expect(screen.getByText(/12 tiles left/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(held()).toBe(3);
  }
  // A fourth different tile fills the tray: the board is lost, and says so.
  fireEvent.click(stranger()!);
  expect(held()).toBe(4);
  expect(await screen.findByText("The tray is full", {}, { timeout: 3000 })).toBeTruthy();
  // No tile can be picked now.
  fireEvent.click(document.querySelector<HTMLElement>(".tile.free")!);
  expect(held()).toBe(4);
  // Taking the last tile back carries on from where it was.
  fireEvent.click(screen.getByRole("button", { name: "Take the last tile back" }));
  expect(held()).toBe(3);
  expect(screen.queryByText("The tray is full")).toBeNull();
  // Fail again, and try again: the same board, whole.
  fireEvent.click(stranger()!);
  fireEvent.click(await screen.findByRole("button", { name: "Try again" }, { timeout: 3000 }));
  expect(held()).toBe(0);
  expect(screen.getByText(/14 tiles left/)).toBeTruthy();
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
  // The day's board can be a big one, which takes a while to play here.
}, 30000);

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

test("the last pair can't be undone into a second win while it leaves", async () => {
  const { sdk, calls } = fakeSdk(true);
  mount(sdk);
  fireEvent.click(screen.getByRole("button", { name: "Play level 1" }));
  // Play to the last tile, then tap it and at once try to take it back.
  for (let n = 0; n < 200 && document.querySelectorAll(".tile:not(.leaving)").length > 1; n++) {
    fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
    fireEvent.click(document.querySelector(".tile.pick-next")!);
  }
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  fireEvent.click(document.querySelector(".tile.pick-next")!);
  const undo = screen.getByRole("button", { name: /Undo/ }) as HTMLButtonElement;
  expect(undo.disabled).toBe(true);
  fireEvent.click(undo);
  expect(document.querySelectorAll(".tile:not(.leaving)").length).toBe(0);
  await screen.findByText("Board cleared");
  await waitFor(() => expect(calls.earn).toHaveBeenCalled());
  expect(calls.earn).toHaveBeenCalledTimes(1);
  expect(calls.roundEnded).toHaveBeenCalledTimes(1);
});

test("a cleared level offers a challenge, and a challenge link opens its board and reports the result", async () => {
  const { sdk, calls } = fakeSdk(true);
  const { unmount } = mount(sdk);
  fireEvent.click(screen.getByRole("button", { name: "Play level 1" }));
  await clearBoard();
  // The board has no challenge yet, so the player can make one of their score.
  const offer = await screen.findByRole("button", { name: "Challenge anyone" });
  const asked = calls.challengeStanding.mock.calls[0] as unknown as [{ mode: string; seed: string; score: number; unit: string }];
  expect(asked[0]).toMatchObject({ mode: "level", seed: "1", unit: "points" });
  expect(asked[0].score).toBeGreaterThan(0);
  fireEvent.click(offer);
  expect(await screen.findByDisplayValue("https://dingn.com/c/abc")).toBeTruthy();
  expect(calls.challengeLink).toHaveBeenCalledWith(asked[0]);
  unmount();

  // A friend follows the link: the game starts on that board, with the score to beat.
  const friend = fakeSdk(false);
  (friend.sdk as { challenge: unknown }).challenge = { mode: "level", seed: "1", score: 99999, unit: "points" };
  mount(friend.sdk);
  expect(document.querySelectorAll(".tile").length).toBe(14);
  expect(screen.getByText("Score to beat: 99,999")).toBeTruthy();
  await clearBoard();
  expect(await screen.findByText("The challenge stands.")).toBeTruthy();
  expect(friend.calls.challengeResult).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Place 2 of 3/)).toBeTruthy();
  expect(friend.calls.showSignIn).toHaveBeenCalledWith(["score", "rewards", "progress"]);
}, 30000);
