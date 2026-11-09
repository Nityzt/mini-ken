import test from "node:test";
import assert from "node:assert/strict";
import { createDuel, screenX } from "../duel/rules.ts";
import { createDuelView, createPlayerControl, hudRange } from "../scenes/duel.ts";
import type { Input } from "../core/input.ts";
import { onlineFlipped, onlineRenderView, onlineViewDuel } from "./presentation.ts";

test("both clients see the same sides, switching after each scored point", () => {
  const state = createDuel();
  assert.equal(onlineFlipped(state), false);
  state.fighters[0].points = 1;
  assert.equal(onlineFlipped(state), true);
  const view = onlineViewDuel(state);
  assert.equal(view.crossed, !state.crossed);
  assert.equal(state.crossed, false);
  assert.equal(view.fighters, state.fighters);
  assert.ok(screenX(view, view.fighters[0].x) > screenX(view, view.fighters[1].x));
  state.fighters[1].points = 1;
  assert.equal(onlineFlipped(state), false);
});

test("rotated controls and transient effects match the displayed court", () => {
  const state = createDuel();
  state.fighters[0].points = 1;
  const input = { isDown: (action: string) => action === "right", wasPressed: () => false } as unknown as Input;
  const control = createPlayerControl();
  assert.equal(control(input, state.fighters[0], true, onlineViewDuel(state).crossed).move, -1);
  const view = createDuelView(state);
  view.fx.push({ kind: "stomp", x: 60, y: 10, dir: 1, age: 0 });
  const displayed = onlineRenderView(view);
  assert.equal(displayed.fx[0].x, 196);
  assert.equal(displayed.fx[0].dir, -1);
  assert.equal(view.fx[0].x, 60);
});

test("crossing during a bout combines with the point-based rotation", () => {
  const state = createDuel();
  state.crossed = true;
  state.fighters[0].points = 1;
  assert.equal(onlineViewDuel(state).crossed, false);
});

test("range remains correct when the displayed sides swap", () => {
  const state = createDuel();
  state.fighters[0].points = 1;
  assert.equal(hudRange(onlineViewDuel(state)), "Too far");
  state.fighters[0].x = state.fighters[1].x - 30;
  assert.equal(hudRange(onlineViewDuel(state)), "In range");
});
