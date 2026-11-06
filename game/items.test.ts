import test from "node:test";
import assert from "node:assert/strict";
import { wrapText } from "./art/font.ts";
import { STAGE_W } from "./core/scale.ts";
import { ALL_ITEMS, createReveal, inventoryOf, isUsable, isWearable, itemInfo, itemsGained, REVEAL_MIN_TICKS, revealBounce, stepReveal, itemIconColors } from "./items.ts";
import { LOOKS } from "./shop.ts";
import { createRunState, recordCup } from "./run-state.ts";

const pick = ({ done, use }: { done: boolean; use: boolean }) => ({ done, use });

test("every gear piece you gain is noticed", () => {
  const before = createRunState();
  assert.deepEqual(itemsGained(before, { ...before, gear: { ...before.gear, tare: true } }), ["tare", "rank:5th kyu"]);
  assert.deepEqual(itemsGained(before, { ...before, gi: true }), ["gi"]);
  assert.deepEqual(itemsGained(before, { ...before, hasTsuba: true }), ["tsuba"]);
  assert.deepEqual(itemsGained(before, { ...before, seme: true }), ["seme"]);
});

test("a dan gets its moment too, and says what you've become", () => {
  const before = createRunState();
  assert.deepEqual(itemsGained(before, { ...before, dan: 1 }), ["rank:1st dan"]);
  assert.equal(itemInfo("rank:1st dan").name, "1st dan");
});

test("a ticket gets a card, and it can only be used, not just dismissed, on that card", () => {
  const before = createRunState();
  assert.deepEqual(itemsGained(before, { ...before, ticket: 1 }), ["ticket"]);
  assert.equal(isUsable("ticket"), true);
  assert.equal(isUsable("tare"), false);
  const ready = { ...createReveal("ticket"), tick: REVEAL_MIN_TICKS };
  assert.deepEqual(pick(stepReveal(ready, true, false)), { done: true, use: true });
  assert.deepEqual(pick(stepReveal(ready, false, true)), { done: true, use: false });
  assert.deepEqual(pick(stepReveal({ ...ready, tick: 0 }, true, true)), { done: false, use: false });
  assert.deepEqual(pick(stepReveal({ ...createReveal("tare"), tick: REVEAL_MIN_TICKS }, false, true)), { done: false, use: false });
  assert.deepEqual(pick(stepReveal({ ...createReveal("tare"), tick: REVEAL_MIN_TICKS }, true, false)), { done: true, use: false });
});

test("the inventory holds what you've earned, with anything usable first", () => {
  const run = createRunState();
  assert.deepEqual(inventoryOf(run), []);
  const later = { ...run, gi: true, gear: { ...run.gear, shinai: true, tare: true }, hasTsuba: true, cups: ["pinecone" as const], ticket: 1 };
  const held = inventoryOf(later);
  assert.equal(held[0], "ticket");
  for (const item of ["gi", "shinai", "tare", "tsuba", "cup:pinecone"]) assert.ok(held.includes(item as never), item);
  assert.equal(inventoryOf({ ...later, dan: 1 }).includes("ticket"), false, "a ticket for a rank you already have is no use");
});

test("anything you buy gets a card and goes in the inventory, and only colors can be worn", () => {
  const before = createRunState();
  const after = { ...before, owned: ["fineShinai", "gooseColors"] };
  assert.deepEqual(itemsGained(before, after), ["shop:fineShinai", "shop:gooseColors"]);
  assert.ok(inventoryOf(after).includes("shop:fineShinai"));
  assert.equal(isWearable("shop:gooseColors"), true);
  assert.equal(isWearable("shop:fineShinai"), false);
  assert.equal(isWearable("gi"), false);
  assert.equal(isUsable("shop:gooseColors"), false, "wearing isn't the same as using a ticket");
});

test("nothing is noticed twice, or when nothing changed", () => {
  const run = { ...createRunState(), gi: true };
  assert.deepEqual(itemsGained(run, run), []);
  assert.deepEqual(itemsGained(run, { ...run, bonusKi: 10 }), []);
});

test("a cup win is a trophy", () => {
  const run = createRunState();
  assert.deepEqual(itemsGained(run, recordCup(run, "pinecone")), ["cup:pinecone"]);
});

test("a cup that raises your rank gets both cards, trophy first", () => {
  const run = createRunState();
  assert.deepEqual(itemsGained(run, recordCup(run, "raccoon")), ["cup:raccoon", "rank:1st dan"]);
});

test("everything has a name and a line that fits on the card", () => {
  for (const id of ALL_ITEMS) {
    const info = itemInfo(id);
    assert.ok(info.name.length > 0, id);
    assert.ok(wrapText(info.line, STAGE_W - 24).length <= 2, `${id}: ${info.line}`);
    assert.ok(info.title.length * 12 <= STAGE_W, id);
  }
});

test("a reveal can't be dismissed by the press that's still happening", () => {
  let reveal = createReveal("tare");
  for (let i = 0; i < REVEAL_MIN_TICKS - 1; i++) {
    const step = stepReveal(reveal, true);
    assert.equal(step.done, false);
    reveal = step.reveal;
  }
  assert.equal(stepReveal(reveal, false).done, false);
  assert.equal(stepReveal(stepReveal(reveal, false).reveal, true).done, true);
});

test("the item falls in, bounces, and comes to rest", () => {
  assert.ok(revealBounce(0, false) < -20, "starts up high");
  for (let tick = 0; tick < 200; tick++) assert.ok(revealBounce(tick, false) <= 0, `never sinks through the floor at ${tick}`);
  let lows = 0;
  for (let tick = 1; tick < 90; tick++) if (revealBounce(tick, false) === 0 && revealBounce(tick - 1, false) < 0) lows++;
  assert.ok(lows >= 2, `bounces more than once, got ${lows}`);
  assert.equal(revealBounce(120, false), 0);
});

test("with reduced motion it simply sits still", () => {
  for (const tick of [0, 5, 20, 100]) assert.equal(revealBounce(tick, true), 0);
});

test("colors you can buy show their own colors on the card, and nothing else is tinted", () => {
  assert.equal(itemIconColors("shop:gooseColors"), LOOKS.gooseColors);
  assert.equal(itemIconColors("shop:fineShinai"), undefined);
  assert.equal(itemIconColors("do"), undefined);
  assert.equal(itemIconColors("rank:1st dan"), undefined);
});

test("a letter gets its moment, sits in your inventory, and can't be used", () => {
  const before = createRunState();
  const after = { ...before, letter: 1, letterFrom: "Rio" };
  assert.deepEqual(itemsGained(before, after), ["letter"]);
  assert.ok(inventoryOf(after).includes("letter"));
  assert.ok(!inventoryOf({ ...after, dan: 1 }).includes("letter"), "it's no use once you've got the rank");
  assert.equal(isUsable("letter"), false);
  assert.ok(ALL_ITEMS.includes("letter"));
  assert.equal(itemInfo("letter").name, "Letter of recommendation");
});
