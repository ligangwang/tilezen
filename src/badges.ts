// Which badges a finished board has earned. The badges themselves (tier,
// icon, title) are listed in game.json; dingn pays their coins.
import type { Saved } from "./save";

export const LEVEL_BADGES = [5, 10, 25, 50, 100, 250];
/** Tiles on a board that counts as a big one. */
export const BIG_BOARD = 100;

/** Badge ids the save has earned, so a badge missed earlier is given later. */
export function badgesFor(saved: Saved): string[] {
  const ids = LEVEL_BADGES.filter((n) => saved.cleared >= n).map((n) => `level-${n}`);
  if (saved.calm >= 1) ids.push("calm");
  if (saved.calm >= 25) ids.push("calm-25");
  if (saved.biggest >= BIG_BOARD) ids.push("big-board");
  if (saved.dailies >= 1) ids.push("daily");
  if (saved.dailies >= 7) ids.push("daily-7");
  return ids;
}
