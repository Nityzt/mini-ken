import test from "node:test";
import assert from "node:assert/strict";
import { moveAndCollide, type TileMap } from "./collision.ts";

const map: TileMap = {
  tile: 16,
  solid: "#",
  rows: [
    "#####",
    "#...#",
    "#...#",
    "#...#",
    "#####",
  ],
};
const box = (x: number, y: number) => ({ x, y, w: 10, h: 10 });

test("moves freely in open space", () => {
  const r = moveAndCollide(box(20, 20), 2, 3, map);
  assert.deepEqual(r.box, box(22, 23));
  assert.equal(r.hitX, false);
  assert.equal(r.hitY, false);
});

test("stops flush against a wall on each axis", () => {
  const right = moveAndCollide(box(50, 20), 8, 0, map);
  assert.equal(right.box.x, 54);
  assert.equal(right.hitX, true);
  const left = moveAndCollide(box(18, 20), -8, 0, map);
  assert.equal(left.box.x, 16);
  const down = moveAndCollide(box(20, 50), 0, 8, map);
  assert.equal(down.box.y, 54);
  assert.equal(down.hitY, true);
  const up = moveAndCollide(box(20, 18), 0, -8, map);
  assert.equal(up.box.y, 16);
});

test("slides along a wall when moving diagonally", () => {
  const r = moveAndCollide(box(52, 20), 8, 3, map);
  assert.equal(r.box.x, 54);
  assert.equal(r.box.y, 23);
  assert.equal(r.hitX, true);
  assert.equal(r.hitY, false);
});

test("never ends inside a solid tile at speeds up to 8 px per tick", () => {
  for (let dx = -8; dx <= 8; dx += 1.5) {
    for (let dy = -8; dy <= 8; dy += 1.5) {
      let b = box(30, 30);
      for (let i = 0; i < 30; i++) b = moveAndCollide(b, dx, dy, map).box;
      assert.ok(b.x >= 16 && b.x + b.w <= 64, `x ${b.x} after ${dx},${dy}`);
      assert.ok(b.y >= 16 && b.y + b.h <= 64, `y ${b.y} after ${dx},${dy}`);
    }
  }
});

test("past the sides of a map is solid, but above and below are open", () => {
  const open: TileMap = { tile: 16, solid: "#", rows: ["..", ".."] };
  assert.equal(moveAndCollide(box(0, 0), -5, 0, open).box.x, 0);
  assert.equal(moveAndCollide(box(0, 20), 0, 40, open).box.y, 60);
});
