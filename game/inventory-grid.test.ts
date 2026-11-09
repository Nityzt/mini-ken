import test from "node:test";
import assert from "node:assert/strict";
import { layoutGrid, moveInGrid } from "./inventory-grid.ts";

// Items: 2 held. Gear: 6 slots, 1st/3rd/4th held. Colours: 8 held, so a second row.
const full = (n: number) => Array<boolean>(n).fill(true);
const cells = layoutGrid([2, 6, 8], [full(2), [true, false, true, true, false, false], full(8)]);

test("each group starts on a row of its own, and long ones wrap", () => {
  assert.deepEqual(cells.filter((c) => c.group === 0).map((c) => [c.row, c.col]), [[0, 0], [0, 1]]);
  assert.deepEqual(cells.filter((c) => c.group === 1).map((c) => c.row), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(cells.filter((c) => c.group === 2).map((c) => c.row), [2, 2, 2, 2, 2, 2, 3, 3]);
});

test("only slots you can pick are numbered, in reading order", () => {
  assert.deepEqual(cells.filter((c) => c.index !== null).map((c) => c.index), Array.from({ length: 2 + 3 + 8 }, (_, i) => i));
  assert.equal(cells.filter((c) => c.group === 1)[1].index, null);
});

test("left and right walk the picks and stop at the ends", () => {
  assert.equal(moveInGrid(cells, 0, 1, 0), 1);
  assert.equal(moveInGrid(cells, 1, 1, 0), 2, "crosses into the next group");
  assert.equal(moveInGrid(cells, 0, -1, 0), 0);
  assert.equal(moveInGrid(cells, 12, 1, 0), 12);
});

test("up and down keep to the same column, or the nearest one", () => {
  assert.equal(moveInGrid(cells, 1, 0, 1), 2, "col 1 in Gear is a gap; cols 0 and 2 tie, and the lower wins");
  assert.equal(moveInGrid(cells, 4, 0, 1), 8, "gear col 3 to colours col 3");
  assert.equal(moveInGrid(cells, 8, 0, -1), 4);
  assert.equal(moveInGrid(cells, 10, 0, 1), 12, "colours col 5 down to the second row's last col 1");
  assert.equal(moveInGrid(cells, 0, 0, -1), 0, "nothing above the top");
  assert.equal(moveInGrid(cells, 12, 0, 1), 12, "nothing below the bottom");
});

test("an empty inventory doesn't break", () => {
  const none = layoutGrid([], []);
  assert.equal(moveInGrid(none, 0, 1, 1), 0);
});

test("a group can start a few columns in, and up and down line up with it", () => {
  const offset = layoutGrid([5, 6], [full(5), full(6)], 6, [1]);
  assert.deepEqual(offset.filter((c) => c.group === 0).map((c) => c.col), [1, 2, 3, 4, 5]);
  assert.equal(moveInGrid(offset, 0, 0, 1), 6, "the first slot sits over the second column");
  assert.equal(moveInGrid(offset, 5, 0, -1), 0, "the first column goes up to the nearest");
});
