import test from "node:test";
import assert from "node:assert/strict";
import { BACKDROP_GRIDS } from "../art/backdrops.ts";
import { WORLD_GRIDS } from "../art/world.ts";
import { DOJOS, MOMO, SPAR_PARTNERS } from "../world/dojos.ts";
import { DISTRICTS, GANGS } from "../world/map.ts";
import { ART_CAST, ART_PAGE_TITLES, CITY_SPRITES, sheetCell } from "./art-sheet.ts";

test("everyone you can fight is in the cast", () => {
  const names = ART_CAST.map((person) => person.name);
  for (const opponent of [...Object.values(DOJOS), ...Object.values(SPAR_PARTNERS), MOMO]) assert.ok(names.includes(opponent.rival), opponent.rival);
});

test("every city sprite gets shown", () => {
  for (const name of Object.keys(WORLD_GRIDS)) assert.ok(CITY_SPRITES.includes(name) || name === "tower", name);
});

test("every crest has a duel stage page", () => {
  for (const name of Object.keys(BACKDROP_GRIDS).filter((key) => key.startsWith("crest"))) {
    assert.ok(ART_PAGE_TITLES.includes(`Stage: ${name.slice("crest".length).toLowerCase()}`), name);
  }
});

test("every district and every street has a page", () => {
  for (const district of DISTRICTS) assert.ok(ART_PAGE_TITLES.includes(`City: ${district}`), district);
  for (const street of Object.keys(GANGS)) assert.ok(ART_PAGE_TITLES.includes(`Street: ${street}`), street);
});

test("the sheet's grids stay on the screen", () => {
  const last = sheetCell(CITY_SPRITES.length - 1);
  assert.ok(last.x + 16 <= 214, "clear of the tower");
  assert.ok(last.y + 24 <= 144, "above the bottom edge");
  assert.ok(ART_CAST.every((_, i) => sheetCell(i).y + 24 <= 144));
});
