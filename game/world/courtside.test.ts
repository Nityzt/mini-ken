import test from "node:test";
import assert from "node:assert/strict";
import { courtside, seatLeft, seatTaken, type Courtside } from "./courtside.ts";
import { DOJOS, CANDIDATES, MEMBERS, SPAR_PARTNERS, opponentById, type DojoId, type OpponentId } from "./dojos.ts";
import { PLACES, TEAM_COLORS } from "../art/looks.ts";
import { CUPS } from "./tournament.ts";
import { STAGE_W } from "../core/scale.ts";

const named = (side: Courtside) => [...side.shinpan, ...side.seated].map((seat) => seat.who).filter((who) => who !== null);
const everyone: OpponentId[] = ["momo", "sensei", "renVisit", ...Object.keys(SPAR_PARTNERS), ...Object.keys(MEMBERS), ...Object.keys(DOJOS), ...Object.keys(CANDIDATES)] as OpponentId[];

test("whoever you're fighting isn't also watching, or holding a flag", () => {
  for (const place of PLACES) for (const opponent of everyone) assert.ok(!named(courtside(place, opponent)).includes(opponent), `${place} vs ${opponent}`);
});

test("nobody is in two places at once", () => {
  for (const place of PLACES) for (const opponent of [null, ...everyone]) {
    const people = named(courtside(place, opponent));
    assert.equal(new Set(people).size, people.length, `${place} vs ${opponent}`);
  }
});

test("at home, your own people run the match, and Sensei watches from the best seat", () => {
  const side = courtside("pinecone", "aki");
  assert.deepEqual(side.seated[0], { who: "sensei", colors: opponentById("sensei").colors, tier: "head" });
  assert.equal(side.shinpan[0].who, "momo");
  assert.ok(named(side).includes("bo"));
  assert.ok(named(side).includes("yui"));
});

test("if you're fighting Sensei, nobody's in Sensei's seat and Momo still has the flags", () => {
  const side = courtside("pinecone", "sensei");
  assert.ok(side.seated.every((seat) => seat.tier !== "head"));
  assert.equal(side.shinpan[0].who, "momo");
});

test("fighting Momo, the next senior takes the flags", () => {
  const side = courtside("pinecone", "momo");
  assert.equal(side.shinpan[0].who, "yui");
  assert.equal(side.seated[0].who, "sensei");
});

test("in a rival dojo, it's that dojo's people, with their sensei in the best seat", () => {
  for (const id of ["radish", "goose", "raccoon", "heron", "otter"] as DojoId[]) {
    const dojo = DOJOS[id];
    const side = courtside(id, dojo.helperIds.G);
    assert.equal(side.seated[0].who, dojo.sensei.id, id);
    assert.equal(side.seated[0].colors, dojo.sensei.colors, id);
    assert.equal(side.seated[0].tier, "head", id);
    assert.equal(side.shinpan[0].who, dojo.helperIds.E, id);
    assert.ok(side.crowd.includes(TEAM_COLORS[id]!), id);
    assert.equal(side.crowd.length, 1, id);
  }
});

test("when you fight a rival, their sensei is watching, and when you don't, the rival is around too", () => {
  for (const id of ["radish", "goose", "raccoon", "heron", "otter"] as DojoId[]) {
    const dojo = DOJOS[id];
    assert.equal(courtside(id, id).seated[0].who, dojo.sensei.id, id);
    assert.ok(named(courtside(id, dojo.helperIds.G)).includes(id), id);
  }
});

test("there are always three people with flags, even in a small dojo", () => {
  for (const place of PLACES) for (const opponent of [null, ...everyone]) {
    if (place !== "hut") assert.equal(courtside(place, opponent).shinpan.length, 3, `${place} vs ${opponent}`);
  }
});

test("a dojo's rank and file fill in as flag-holders in the team color", () => {
  const side = courtside("radish", "radish");
  assert.equal(side.shinpan[2].who, null);
  assert.equal(side.shinpan[2].colors, TEAM_COLORS.radish);
});

test("the grading panel judges at a grading, with the other candidates watching", () => {
  const side = courtside("hall", "asa");
  assert.ok(side.shinpan.every((seat) => seat.who === null && seat.tier === "head"));
  assert.ok(side.crowd.length > 1);
  assert.ok(!side.crowd.includes(CANDIDATES.asa.colors));
});

test("the Grand Taikai draws a crowd from every dojo", () => {
  assert.equal(courtside("arena", null).crowd.length >= 6, true);
});

test("nobody's at the hermit's hut", () => {
  const side = courtside("hut", null);
  assert.deepEqual(side, { shinpan: [], seated: [], crowd: [] });
});

test("everyone's match has a place, and it's where they belong", () => {
  assert.equal(opponentById("tetsu").crest, "goose");
  assert.equal(opponentById("shin").crest, "heron");
  assert.equal(opponentById("rio").crest, "raccoon");
  assert.equal(opponentById("sensei").crest, "pinecone");
  assert.equal(opponentById("asa").crest, "hall");
  assert.equal(CUPS.goose.crest, "goose");
  assert.equal(CUPS.grand.crest, "arena");
});

test("seats run outward from the middle, leaving room for the chief judge", () => {
  const middle = STAGE_W / 2;
  const first = [seatLeft(0), seatLeft(1)];
  assert.ok(first[0] < middle && first[1] > middle);
  for (const x of first) assert.ok(Math.abs(x + 7 - middle) > 20, String(x));
  for (let n = 2; n < 20; n++) assert.ok(Math.abs(seatLeft(n) - middle) > Math.abs(seatLeft(n - 2) - middle), String(n));
});

test("the row has a few gaps, so it doesn't read as a fence, and the named people always have a seat", () => {
  let taken = 0;
  for (let n = 0; n < 40; n++) if (seatTaken(n, 1)) taken++;
  assert.ok(taken > 25 && taken < 40, String(taken));
  for (let n = 0; n < 6; n++) assert.equal(seatTaken(n, 6), true);
});
