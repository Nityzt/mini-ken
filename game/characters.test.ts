import test from "node:test";
import assert from "node:assert/strict";
import { measureText, wrapText } from "./art/font.ts";
import { STAGE_W } from "./core/scale.ts";
import { PALETTE, PINECONE_COLORS } from "./art/palette.ts";
import { colorOf } from "./art/sprite.ts";
import { CHARACTERS, characterById, DEFAULT_CHARACTER, playerColors, type CharacterId } from "./characters.ts";
import { LOOKS } from "./shop.ts";
import { DEFAULT_INSIGNIA } from "./insignia.ts";

const look = (over = {}) => ({ character: DEFAULT_CHARACTER, insignia: DEFAULT_INSIGNIA, gi: true, ...over });

test("there's a real choice of characters, each with their own name and look", () => {
  assert.ok(CHARACTERS.length >= 4);
  assert.equal(new Set(CHARACTERS.map((c) => c.name)).size, CHARACTERS.length);
  const looks = CHARACTERS.map((c) => JSON.stringify(playerColors(look({ character: c.id }))));
  assert.equal(new Set(looks).size, CHARACTERS.length);
});

test("names and blurbs fit on the select screen", () => {
  for (const c of CHARACTERS) {
    assert.ok(c.name.length <= 6, c.name);
    assert.ok(wrapText(c.blurb, STAGE_W - 24).length <= 2, c.blurb);
    assert.ok(measureText(c.name) < STAGE_W);
  }
});

test("an unknown character falls back to the first", () => {
  assert.equal(characterById("nobody"), CHARACTERS[0]);
});

test("the same look is the very same object, because sprites are cached by it", () => {
  assert.equal(playerColors(look()), playerColors(look()));
  assert.notEqual(playerColors(look({ gi: false })), playerColors(look()));
});

test("the insignia's colors reach the sprite", () => {
  const colors = playerColors(look({ insignia: { symbol: "pine", cloth: "gold", mark: "ink" } }));
  assert.ok(colors.Z && colors.z);
  assert.notEqual(colors.Z, colors.z);
  assert.notEqual(colors.Z, playerColors(look()).Z);
});

test("everyday clothes change once you've borrowed the gi", () => {
  assert.notEqual(playerColors(look({ gi: false })).W, playerColors(look({ gi: true })).W);
});

test("everyone starts out in their dojo's colors, whoever they are", () => {
  for (const c of CHARACTERS) {
    const colors = playerColors(look({ character: c.id }));
    assert.equal(colors.I, PINECONE_COLORS.I, c.id);
    assert.equal(colors.i, PINECONE_COLORS.i, c.id);
    assert.equal(colors.N, PINECONE_COLORS.N, c.id);
  }
});

test("each character still has armor of their own, and it's theirs to buy back", () => {
  assert.equal(new Set(CHARACTERS.map((c) => c.armor.I)).size, CHARACTERS.length);
  for (const c of CHARACTERS) assert.equal(playerColors(look({ character: c.id, look: "ownColors" })).I, c.armor.I, c.id);
});

test("buying another dojo's colors changes your armor, and only your armor", () => {
  const worn = playerColors(look({ character: "kai", look: "gooseColors" }));
  assert.equal(worn.I, LOOKS.gooseColors!.I);
  assert.equal(worn.S, characterById("kai").look.S);
  assert.equal(worn.H, characterById("kai").look.H);
});

test("your own tare design stays on, whatever you're wearing", () => {
  const insignia = { symbol: "pine", cloth: "gold", mark: "ink" } as const;
  assert.equal(playerColors(look({ insignia, look: "gooseColors" })).Z, playerColors(look({ insignia })).Z);
});

test("colors from a save that's since gone off sale just leave you in your dojo's", () => {
  assert.equal(playerColors(look({ look: "pineconeColors" })).I, PINECONE_COLORS.I);
});

test("everyone's men is their own, whatever colors it's in", () => {
  const details = (c: { id: CharacterId }, worn = "") => {
    const colors = playerColors(look({ character: c.id, look: worn }));
    return ["M", "T", "t", "A", "E", "U"].map((key) => colors[key] ?? "").join();
  };
  assert.equal(new Set(CHARACTERS.map((c) => details(c))).size, CHARACTERS.length);
  assert.equal(new Set(CHARACTERS.map((c) => playerColors(look({ character: c.id })).M)).size, CHARACTERS.length, "you can tell by the grille alone");
  assert.equal(new Set(CHARACTERS.map((c) => playerColors(look({ character: c.id })).T)).size, CHARACTERS.length, "and by the cords alone");
  for (const c of CHARACTERS) assert.equal(details(c, "gooseColors"), details(c), c.id);
});

test("a men's details never show on someone who doesn't set them", () => {
  const npc = { I: "#123456", w: "#ABCDEF", R: "#FEDCBA" };
  assert.equal(colorOf("A", npc), "#123456");
  assert.equal(colorOf("E", npc), "#123456");
  assert.equal(colorOf("U", npc), "#123456");
  assert.equal(colorOf("M", npc), "#ABCDEF");
  assert.equal(colorOf("T", npc), "#FEDCBA");
  assert.equal(colorOf("A"), PALETTE.I);
  assert.equal(colorOf("M"), PALETTE.w);
  assert.equal(colorOf("T"), PALETTE.R);
});
