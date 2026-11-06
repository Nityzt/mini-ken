import test from "node:test";
import assert from "node:assert/strict";
import { ticksToRun } from "./loop.ts";

test("runs one tick per 16.67ms", () => {
  assert.equal(ticksToRun(0, 1000 / 60 + 0.01).ticks, 1);
});

test("keeps the remainder for the next frame", () => {
  const r = ticksToRun(0, 10);
  assert.equal(r.ticks, 0);
  assert.equal(r.accumulatorMs, 10);
});

test("a long gap never fast-forwards", () => {
  const r = ticksToRun(0, 60_000);
  assert.equal(r.ticks, 5);
  assert.equal(r.accumulatorMs, 0);
});
