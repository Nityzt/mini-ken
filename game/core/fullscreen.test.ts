import test from "node:test";
import assert from "node:assert/strict";
import { escapeLock, pausesOnFullscreenExit, type FullscreenExit } from "./fullscreen.ts";

const exit = (over: Partial<FullscreenExit> = {}): FullscreenExit => ({
  fullscreen: false,
  byGame: false,
  paused: false,
  canPause: true,
  ...over,
});

test("the browser taking you out of fullscreen opens the menu, since that Esc never reached the game", () => {
  assert.equal(pausesOnFullscreenExit(exit()), true);
});

test("leaving with the game's own fullscreen key just leaves", () => {
  assert.equal(pausesOnFullscreenExit(exit({ byGame: true })), false);
});

test("going into fullscreen doesn't pause", () => {
  assert.equal(pausesOnFullscreenExit(exit({ fullscreen: true })), false);
});

test("an open menu stays open rather than toggling shut", () => {
  assert.equal(pausesOnFullscreenExit(exit({ paused: true })), false);
});

test("nothing opens where Esc couldn't have opened it either", () => {
  assert.equal(pausesOnFullscreenExit(exit({ canPause: false })), false);
});

test("Esc is held for the game in fullscreen and handed back outside it, where the browser can lock keys", () => {
  assert.equal(escapeLock(true, true), "lock");
  assert.equal(escapeLock(false, true), "unlock");
  assert.equal(escapeLock(true, false), null);
  assert.equal(escapeLock(false, false), null);
});
