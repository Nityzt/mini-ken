import test from "node:test";
import assert from "node:assert/strict";
import type { Action, Input } from "../core/input.ts";
import { createDialogue } from "./dialogue.ts";

const pressing = (action?: Action): Input => ({
  isDown: () => false,
  wasPressed: (a) => a === action,
  endTick() {},
  clear() {},
  dispose() {},
});

test("E pages through to the end, then runs what comes next", () => {
  const d = createDialogue();
  let next = 0;
  d.open(["One."], () => next++);
  d.update(pressing("confirm")); // finishes the typing
  assert.equal(next, 0);
  d.update(pressing("confirm"));
  assert.equal(next, 1);
  assert.equal(d.active, false);
});

test("X closes the dialogue at once, on any page", () => {
  const d = createDialogue();
  d.open(["One.", "Two.", "Three."]);
  d.update(pressing("cancel"));
  assert.equal(d.active, false);
});

test("X backs out of whatever the dialogue was leading to", () => {
  const d = createDialogue();
  let fights = 0;
  d.open(["Rei!"], () => fights++);
  d.update(pressing("cancel"));
  assert.equal(fights, 0);
  assert.equal(d.active, false);
});

test("a dialogue that must lead somewhere still goes there on X", () => {
  const d = createDialogue();
  let left = 0;
  const leave = () => left++;
  d.open(["Well done."], leave, leave);
  d.update(pressing("cancel"));
  assert.equal(left, 1);
});

test("the prompt says backing out when X would skip something", () => {
  const d = createDialogue();
  d.open(["Rei!"], () => {});
  assert.equal(d.cancelHint, "X back out");
  const leave = () => {};
  d.open(["Well done."], leave, leave);
  assert.equal(d.cancelHint, "X skip");
  d.open(["Hello."]);
  assert.equal(d.cancelHint, "X skip");
});

test("X does nothing when no dialogue is open", () => {
  const d = createDialogue();
  d.update(pressing("cancel"));
  assert.equal(d.active, false);
});
