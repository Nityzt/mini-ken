import test from "node:test";
import assert from "node:assert/strict";
import { bannerColumn, DOJO_LOOKS, floorMarked, FLOOR_TILES, lookOf, PLACES, senseiColors, seniorColors, TEAM_COLORS } from "./looks.ts";
import { validateGrid } from "./sprite.ts";
import { TILE_GRIDS } from "./tiles.ts";
import { GOOSE_MAP, HALL_MAP, HERON_MAP, OTTER_MAP, RACCOON_MAP, RIVAL_MAP, CLUB_MAP } from "../scenes/levels.ts";
import { LOOKS } from "../shop.ts";
import { DOJOS, MOMO, SENSEI, SPAR_PARTNERS } from "../world/dojos.ts";

const HEX = /^#[0-9A-F]{6}$/i;

test("every place has a look of its own", () => {
  for (const key of ["floor", "wall", "view"] as const) {
    const kinds = new Set(PLACES.map((place) => lookOf(place)[key]));
    assert.ok(kinds.size >= 5, `${key}: only ${[...kinds].join()}`);
  }
  const signatures = PLACES.map((place) => JSON.stringify(lookOf(place).room));
  assert.equal(new Set(signatures).size, PLACES.length, "two places share a color scheme");
});

test("home keeps its warm wood, with nothing recolored", () => {
  assert.deepEqual(lookOf("pinecone").room, {});
  assert.equal(lookOf("pinecone").floor, "boards");
  assert.equal(lookOf("pinecone").view, "bamboo");
});

test("every color in a look is a real color", () => {
  for (const place of PLACES) {
    const look = lookOf(place);
    for (const color of [...Object.values(look.room), ...Object.values(look.window)]) assert.match(color, HEX, place);
    if (look.banner) for (const color of Object.values(look.banner)) assert.match(color, HEX, place);
  }
});

test("every floor and every decoration a look asks for has been drawn", () => {
  for (const place of PLACES) {
    const look = lookOf(place);
    const tile = TILE_GRIDS[FLOOR_TILES[look.floor]];
    assert.ok(tile, `${place} floor`);
    assert.deepEqual(validateGrid(tile), [], place);
    if (look.decor) assert.ok(TILE_GRIDS[look.decor.tile], `${place} decor ${look.decor.tile}`);
    if (look.mark) assert.ok(TILE_GRIDS[look.mark.tile], `${place} mark ${look.mark.tile}`);
  }
});

test("the hermit's hut has no dojo banner, and every dojo does", () => {
  assert.equal(lookOf("hut").banner, null);
  for (const place of PLACES) if (place !== "hut") assert.ok(lookOf(place).banner, place);
});

test("every dojo has a team color of its own, and the merch you can buy matches it", () => {
  const dojos = ["radish", "goose", "raccoon", "heron", "otter", "pinecone"] as const;
  assert.equal(new Set(dojos.map((id) => TEAM_COLORS[id]!.I)).size, dojos.length);
  assert.equal(new Set(dojos.map((id) => TEAM_COLORS[id]!.Z)).size, dojos.length, "each dojo's tare cloth should differ");
  const merch = { radish: "radishColors", goose: "gooseColors", raccoon: "raccoonColors", heron: "heronColors", otter: "otterColors" } as const;
  for (const [id, item] of Object.entries(merch)) assert.equal(TEAM_COLORS[id as keyof typeof merch]!.I, LOOKS[item]!.I, id);
});

test("seniors wear their dojo's armor, with trim that sets them apart", () => {
  for (const id of ["radish", "goose", "raccoon", "heron", "otter"] as const) {
    const team = TEAM_COLORS[id]!;
    const senior = DOJOS[id].colors;
    assert.equal(senior.I, team.I, id);
    assert.equal(senior.Z, team.Z, id);
    assert.notEqual(senior.i, team.i, id);
  }
});

test("the same colors always come back as the same object, or sprites would be rebuilt every frame", () => {
  const team = TEAM_COLORS.goose!;
  assert.equal(seniorColors(team), seniorColors(team));
});

test("the crest goes on a plain stretch of wall, near the middle of the room", () => {
  for (const rows of [CLUB_MAP, RIVAL_MAP, RACCOON_MAP, HERON_MAP, OTTER_MAP, GOOSE_MAP, HALL_MAP]) {
    const spot = bannerColumn(rows);
    assert.ok(spot, rows[1]);
    assert.equal(rows[spot.row][spot.col], "W", rows[spot.row]);
    assert.ok(Math.abs(spot.col - rows[0].length / 2) <= 4, rows[spot.row]);
  }
});

test("marks on the floor are few, and stay where they are", () => {
  let marked = 0;
  for (let col = 0; col < 16; col++) for (let row = 0; row < 9; row++) if (floorMarked(col, row, 11)) marked++;
  assert.ok(marked > 3 && marked < 30, String(marked));
  assert.equal(floorMarked(3, 4, 11), floorMarked(3, 4, 11));
});

test("nothing in DOJO_LOOKS is left out of PLACES", () => {
  assert.deepEqual(Object.keys(DOJO_LOOKS).sort(), [...PLACES].sort());
});

test("only the soggy dojo has anything lying on the court", () => {
  assert.deepEqual(PLACES.filter((place) => lookOf(place).markOnCourt), ["otter"]);
});

test("nobody senior at home wears the team green, so you can tell them from yourself in a match", () => {
  for (const opponent of Object.values(SPAR_PARTNERS)) assert.notEqual(opponent.colors.I, TEAM_COLORS.pinecone!.I, opponent.rival);
  assert.notEqual(MOMO.colors.I, TEAM_COLORS.pinecone!.I);
  assert.notEqual(SENSEI.colors.I, TEAM_COLORS.pinecone!.I);
});

test("a dojo's sensei wears its armor, with gold trim and the grey hair to go with it", () => {
  for (const id of ["radish", "goose", "raccoon", "heron", "otter"] as const) {
    const team = TEAM_COLORS[id]!;
    assert.equal(senseiColors(team).I, team.I, id);
    assert.notEqual(senseiColors(team).H, undefined, id);
    assert.notEqual(senseiColors(team), seniorColors(team), id);
    assert.equal(senseiColors(team), senseiColors(team), id);
  }
});
