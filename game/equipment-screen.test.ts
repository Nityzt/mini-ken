import test from "node:test";
import assert from "node:assert/strict";
import { cellsOf, confirmDoes, equipKiChange, packGroups, screenGroups, stepInventoryScreen, type ScreenKeys } from "./equipment-screen.ts";
import { equippedAt } from "./equipment.ts";
import { createRunState, type RunState } from "./run-state.ts";

const keys = (pressed: Partial<ScreenKeys> = {}): ScreenKeys => ({ up: false, down: false, left: false, right: false, confirm: false, ...pressed });
const fresh = createRunState();
/** Shinai, kote and tare earned, with spare variants for the shinai and kote, and a do bought before the do was earned. */
const kitted: RunState = {
  ...fresh,
  gi: true,
  ticket: 1,
  gear: { ...fresh.gear, shinai: true, kote: true, tare: true },
  owned: ["fineShinai", "gooseShinai", "deerKote", "heronDo", "gooseColors"],
  cups: ["pinecone"],
};

test("the screen opens with the five equipment slots, and only earned ones can be picked", () => {
  const [slots] = screenGroups(kitted);
  assert.deepEqual(slots.slots, ["slot:shinai", null, "slot:kote", null, "slot:tare"]);
  assert.deepEqual(screenGroups(fresh)[0].slots, [null, null, null, null, null]);
});

test("the pack holds everything not in a slot: items, spare gear, colors and trophies", () => {
  const groups = packGroups(kitted);
  assert.deepEqual(groups.map((g) => g.title), ["Items", "Gear", "Colors", "Trophies 1/7"]);
  assert.deepEqual(groups[0].slots, ["ticket", "gi"]);
  // Fine shinai is carried over Sensei's old one by default, so the old one and the goose shinai wait in the pack.
  assert.equal(equippedAt(kitted, "shinai"), "fineShinai");
  assert.deepEqual(groups[1].slots, ["shinai", "shop:gooseShinai", "kote", "shop:heronDo"]);
  assert.equal(equippedAt(kitted, "kote"), "deerKote");
  assert.deepEqual(groups[2].slots, ["shop:gooseColors"]);
});

test("a fresh run has an empty pack and nothing to pick", () => {
  assert.deepEqual(packGroups(fresh).map((g) => g.title), ["Trophies 0/7"]);
  assert.deepEqual(cellsOf(fresh), []);
  assert.equal(stepInventoryScreen(fresh, 0, keys({ right: true, confirm: true })).choice, 0);
});

test("the cursor walks the slots, then drops into the pack below and comes back up", () => {
  const cells = cellsOf(kitted);
  assert.deepEqual(cells.slice(0, 3), ["slot:shinai", "slot:kote", "slot:tare"]);
  const go = (from: number, pressed: Partial<ScreenKeys>) => stepInventoryScreen(kitted, from, keys(pressed)).choice;
  assert.equal(go(0, { right: true }), 1);
  assert.equal(go(2, { right: true }), 3, "on into the pack");
  assert.equal(go(0, { left: true }), 0, "nothing wraps");
  // The shinai slot sits over the pack's second column, which is the gi.
  assert.equal(cells[go(0, { down: true })], "gi");
  assert.equal(cells[go(3, { up: true })], "slot:shinai", "the ticket in the first column goes up to the nearest slot");
});

test("picking a spare piece equips it, and the one it replaces lands under the cursor", () => {
  const cells = cellsOf(kitted);
  const goose = cells.indexOf("shop:gooseShinai");
  assert.equal(confirmDoes(kitted, "shop:gooseShinai"), "equip");
  const step = stepInventoryScreen(kitted, goose, keys({ confirm: true }));
  assert.equal(equippedAt(step.run, "shinai"), "gooseShinai");
  assert.equal(step.run.wielded, "gooseShinai", "the shinai in your hand is the one that wears");
  assert.equal(cellsOf(step.run)[step.choice], "shop:fineShinai");
  assert.equal(step.action, null);
});

test("a piece for a slot you haven't earned can't be equipped", () => {
  const heron = cellsOf(kitted).indexOf("shop:heronDo");
  assert.equal(confirmDoes(kitted, "shop:heronDo"), null);
  const step = stepInventoryScreen(kitted, heron, keys({ confirm: true }));
  assert.equal(step.run, kitted);
  assert.equal(step.choice, heron);
});

test("picking a slot jumps to its spares, if there are any", () => {
  const cells = cellsOf(kitted);
  assert.equal(confirmDoes(kitted, "slot:shinai"), "swap");
  assert.equal(cells[stepInventoryScreen(kitted, 0, keys({ confirm: true })).choice], "shinai");
  assert.equal(cells[stepInventoryScreen(kitted, 1, keys({ confirm: true })).choice], "kote");
  assert.equal(confirmDoes(kitted, "slot:tare"), null, "only one tare");
  assert.equal(stepInventoryScreen(kitted, 2, keys({ confirm: true })).choice, 2);
});

test("the men slot puts it on or takes it off outside fights", () => {
  const withMen = { ...kitted, gear: { ...kitted.gear, men: true } };
  const at = cellsOf(withMen).indexOf("slot:men");
  assert.equal(confirmDoes(withMen, "slot:men"), "wear");
  const on = stepInventoryScreen(withMen, at, keys({ confirm: true })).run;
  assert.equal(on.menOn, true);
  assert.equal(confirmDoes(on, "slot:men"), "take-off");
  assert.equal(stepInventoryScreen(on, at, keys({ confirm: true })).run.menOn, false);
});

test("the ticket is used and colors go on from the pack", () => {
  const cells = cellsOf(kitted);
  assert.equal(stepInventoryScreen(kitted, cells.indexOf("ticket"), keys({ confirm: true })).action, "use-ticket");
  const worn = stepInventoryScreen(kitted, cells.indexOf("shop:gooseColors"), keys({ confirm: true })).run;
  assert.equal(worn.look, "gooseColors");
  assert.equal(confirmDoes(kitted, "gi"), null);
});

test("choices persist on the run, so the save keeps them", () => {
  const step = stepInventoryScreen(kitted, cellsOf(kitted).indexOf("kote"), keys({ confirm: true }));
  assert.equal(step.run.equipped?.kote, "kote");
  assert.equal(equippedAt(step.run, "kote"), "kote");
});

test("a spare's card says what equipping it would do to your ki, against what's in the slot", () => {
  // Fine shinai is in hand: Sensei's old one would cost 5, and the goose shinai would add 1.
  assert.equal(equipKiChange(kitted, "shinai"), -5);
  assert.equal(equipKiChange(kitted, "shop:gooseShinai"), 1);
  // Nothing to compare for what's already in a slot, a slot you haven't earned, or things that aren't gear.
  assert.equal(equipKiChange(kitted, "shop:fineShinai"), null);
  assert.equal(equipKiChange(kitted, "shop:heronDo"), null);
  assert.equal(equipKiChange(kitted, "ticket"), null);
});
