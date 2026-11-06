import test from "node:test";
import assert from "node:assert/strict";
import { validateGrid } from "./sprite.ts";
import { GEAR_OVERLAYS, KENDOKA_GRIDS, KENDOKA_HEIGHT, KENDOKA_WIDTH } from "./kendoka.ts";
import { DUEL_GRIDS } from "./duel-sprites.ts";
import { TILE_GRIDS } from "./tiles.ts";
import { BACKDROP_GRIDS } from "./backdrops.ts";
import { WORLD_GRIDS } from "./world.ts";

test("validateGrid reports uneven rows", () => {
  assert.equal(validateGrid(["KK", "K"]).length, 1);
});

test("validateGrid reports unknown palette keys", () => {
  assert.equal(validateGrid(["K?"]).length, 1);
});

test("every sprite grid is rectangular and uses palette keys only", () => {
  const all = { ...KENDOKA_GRIDS, ...DUEL_GRIDS, ...TILE_GRIDS, ...BACKDROP_GRIDS, ...WORLD_GRIDS };
  assert.ok(Object.keys(all).length > 20);
  for (const [name, grid] of Object.entries(all)) {
    assert.deepEqual(validateGrid(grid), [], name);
  }
});

test("every mix of armor has a fighter sprite", () => {
  for (const name of ["duelHead", "duelHeadBare", "duelChestDo", "duelChestGi", "duelWaistTare", "duelWaistPlain"]) {
    assert.ok(DUEL_GRIDS[name], name);
  }
  assert.equal(DUEL_GRIDS.duelHeadBare.length, DUEL_GRIDS.duelHead.length);
  assert.equal(DUEL_GRIDS.duelChestGi.length, DUEL_GRIDS.duelChestDo.length);
  assert.equal(DUEL_GRIDS.duelWaistPlain.length, DUEL_GRIDS.duelWaistTare.length);
});

test("the world has its tower", () => {
  assert.ok(WORLD_GRIDS.tower.length >= 40);
});

test("gear overlays match their base sprite size", () => {
  const facings = Object.values(GEAR_OVERLAYS);
  assert.equal(facings.length, 5);
  for (const overlay of facings) {
    for (const grid of Object.values(overlay)) {
      assert.equal(grid.length, KENDOKA_HEIGHT);
      for (const row of grid) assert.equal(row.length, KENDOKA_WIDTH);
    }
  }
});
