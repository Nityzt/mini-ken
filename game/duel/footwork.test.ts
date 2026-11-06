import test from "node:test";
import assert from "node:assert/strict";
import { createDashDetector, DOUBLE_TAP_TICKS, legsFor } from "./footwork.ts";

const feed = (taps: ("left" | "right" | null)[]) => {
  const detect = createDashDetector();
  return taps.map((t) => detect(t === "left", t === "right"));
};

test("double-tapping right launches forward", () => {
  assert.deepEqual(feed(["right", null, null, "right"]), [0, 0, 0, 1]);
});

test("double-tapping left launches backward", () => {
  assert.deepEqual(feed(["left", null, "left"]), [0, 0, -1]);
});

test("one tap is only a step", () => {
  assert.deepEqual(feed(["right", null, null, null]), [0, 0, 0, 0]);
});

test("slow taps don't launch", () => {
  const taps: ("right" | null)[] = ["right", ...Array<null>(DOUBLE_TAP_TICKS + 1).fill(null), "right"];
  assert.equal(feed(taps).at(-1), 0);
});

test("left then right doesn't launch", () => {
  assert.deepEqual(feed(["left", null, "right"]), [0, 0, 0]);
});

test("a third tap needs its own pair", () => {
  assert.deepEqual(feed(["right", null, "right", null, "right"]), [0, 0, 1, 0, 0]);
});

test("standing still keeps the feet in stance", () => {
  assert.equal(legsFor(0, false), "stand");
  assert.equal(legsFor(37, false), "stand");
});

test("each step opens the feet, then the rear foot draws up without crossing", () => {
  const seen = new Set<string>();
  for (let tick = 0; tick < 40; tick++) seen.add(legsFor(tick, true));
  assert.deepEqual([...seen].sort(), ["close", "step"]);
});
