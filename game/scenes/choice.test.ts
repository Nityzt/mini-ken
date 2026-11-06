import test from "node:test";
import assert from "node:assert/strict";
import { createChoice, stepChoice, visibleRows } from "./choice.ts";

const options = [{ id: "line", label: "Line drill" }, { id: "grade", label: "Ask to grade" }, { id: "leave", label: "Never mind" }];
const none = { up: false, down: false, confirm: false, cancel: false };

test("arrows move and wrap, and nothing's picked until you confirm", () => {
  let choice = createChoice(options);
  let step = stepChoice(choice, { ...none, down: true });
  assert.equal(step.choice.at, 1);
  assert.equal(step.picked, null);
  step = stepChoice(createChoice(options), { ...none, up: true });
  assert.equal(step.choice.at, 2);
  choice = stepChoice(createChoice(options), { ...none, down: true }).choice;
  assert.equal(stepChoice(choice, { ...none, confirm: true }).picked, "grade");
});

test("X backs out, as if you'd picked nothing", () => {
  const step = stepChoice(createChoice(options), { ...none, cancel: true });
  assert.equal(step.closed, true);
  assert.equal(step.picked, null);
});

test("a long list shows a window around the selected row", () => {
  assert.deepEqual(visibleRows(3, 0), { first: 0, count: 3 });
  assert.deepEqual(visibleRows(12, 0), { first: 0, count: 6 });
  assert.deepEqual(visibleRows(12, 5), { first: 0, count: 6 });
  assert.deepEqual(visibleRows(12, 6), { first: 1, count: 6 });
  assert.deepEqual(visibleRows(12, 11), { first: 6, count: 6 });
});
