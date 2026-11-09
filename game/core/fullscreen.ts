/**
 * Esc in fullscreen. Browsers keep Esc to leave fullscreen, so the page never sees that press
 * and the menu would take a second one. Two ways round it:
 * - Where the Keyboard Lock API exists (Chromium), Esc is locked to the page while fullscreen.
 *   It then opens the menu like anywhere else, and holding it leaves fullscreen.
 * - Everywhere else, the browser leaving fullscreen on its own counts as that Esc, and opens the menu.
 */

export type FullscreenExit = {
  /** Whether the page is fullscreen now, after the change. */
  fullscreen: boolean;
  /** Whether the game's own fullscreen key asked for this, rather than the browser. */
  byGame: boolean;
  paused: boolean;
  /** Whether pressing pause would have opened the menu right now (no form open, not typing, a scene that pauses). */
  canPause: boolean;
};

/** Opens the menu, never closes it: an Esc that left fullscreen while the menu was up shouldn't shut it. */
export function pausesOnFullscreenExit(change: FullscreenExit): boolean {
  return !change.fullscreen && !change.byGame && !change.paused && change.canPause;
}

/** What to do with the Esc key lock after a fullscreen change, given whether the browser can lock keys. */
export function escapeLock(fullscreen: boolean, supported: boolean): "lock" | "unlock" | null {
  if (!supported) return null;
  return fullscreen ? "lock" : "unlock";
}

type KeyboardLock = { lock(keys?: string[]): Promise<void>; unlock(): void };

/** The browser's Keyboard Lock, where there is one. It isn't in every TypeScript DOM library yet. */
export function keyboardLock(): KeyboardLock | null {
  const keyboard = (navigator as Navigator & { keyboard?: Partial<KeyboardLock> }).keyboard;
  return typeof keyboard?.lock === "function" && typeof keyboard.unlock === "function" ? (keyboard as KeyboardLock) : null;
}
