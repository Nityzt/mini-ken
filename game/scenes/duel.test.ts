import test from "node:test";
import assert from "node:assert/strict";
import { measureText } from "../art/font.ts";
import { STAGE_W } from "../core/scale.ts";
import { createDuel, skipBow, startX, step, type DuelEvent, type FighterInput } from "../duel/rules.ts";
import { CALL_HAJIME, CALL_NIHONME, CALL_SHOBU, CLOSING_LINE } from "./content.ts";
import { applyEvents, createDuelView, createPlayerControl, helpLine, lockHelp, refereeCall, tickView } from "./duel.ts";
import type { Input } from "../core/input.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };

test("the lock's controls and the closing line fit on one row of the narrowest screen", () => {
  for (const line of [lockHelp(true), lockHelp(false)]) assert.ok(measureText(line) <= STAGE_W - 8, line);
  assert.ok(measureText(CLOSING_LINE) <= STAGE_W - 8, `${measureText(CLOSING_LINE)}`);
});

test("the referee calls hajime to begin, nihon-me after one point, and shobu at one all", () => {
  const duel = createDuel();
  assert.equal(refereeCall(duel, "bow"), CALL_HAJIME);
  assert.equal(refereeCall(duel, "wakare"), CALL_HAJIME);
  duel.fighters[0].points = 1;
  assert.equal(refereeCall(duel, "point"), CALL_NIHONME);
  duel.fighters[1].points = 1;
  assert.equal(refereeCall(duel, "point"), CALL_SHOBU);
  assert.equal(refereeCall(duel, "zanshin"), null);
});

test("words said at the same moment are stacked, not printed on top of each other", () => {
  const view = createDuelView(skipBow(createDuel()));
  const events: DuelEvent[] = [{ type: "parry", by: 0 }, { type: "kiai", by: 0, target: "men" }, { type: "blocked", by: 0 }];
  applyEvents(view, events, true);
  const heights = view.floaters.map((f) => f.y);
  assert.equal(new Set(heights).size, heights.length, heights.join());
});

test("words far enough apart can share a height", () => {
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type: "kiai", by: 0, target: "men" }, { type: "kiai", by: 1, target: "kote" }], true);
  assert.equal(view.floaters[0].y, view.floaters[1].y);
});

test("a pose change remembers where it came from, so it can be blended", () => {
  const duel = skipBow(createDuel());
  const view = createDuelView(duel);
  tickView(view);
  view.duel = step(view.duel, { ...IDLE, block: true }, IDLE);
  tickView(view);
  assert.equal(view.poses[0].now, "block");
  assert.equal(view.poses[0].was, "guard");
  assert.equal(view.poses[0].age, 0);
  tickView(view);
  assert.equal(view.poses[0].age, 1);
});

test("a call shows once as the fight begins", () => {
  const view = createDuelView(createDuel());
  view.duel = skipBow(view.duel);
  tickView(view);
  assert.deepEqual(view.floaters.map((f) => f.text), [CALL_HAJIME]);
  tickView(view);
  assert.equal(view.floaters.length, 1);
});

test("the flags come down when the closing ceremony starts", () => {
  const view = createDuelView(skipBow(createDuel()));
  view.flags = "red";
  view.duel = { ...view.duel, phase: "closing", phaseTicks: 100 };
  tickView(view);
  assert.equal(view.flags, null);
});

test("a hit leaves the one who took it reacting and knocked back, and it wears off", () => {
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type: "hit", by: 0, target: "men" }], true);
  assert.equal(view.reaction[1]?.pose, "hit");
  assert.ok(view.knock[1] > 0);
  for (let i = 0; i < 40; i++) tickView(view);
  assert.equal(view.reaction[1], null);
  assert.equal(view.knock[1], 0);
});

test("once it's over, the fighters keep walking off", () => {
  const view = createDuelView(skipBow(createDuel()));
  view.duel = { ...view.duel, phase: "over" };
  tickView(view);
  tickView(view);
  assert.equal(view.overTicks, 2);
  assert.equal(view.duel.fighters[0].x, startX(0));
});

const keys = (down: string[]): Input => ({ isDown: (a: string) => down.includes(a), wasPressed: (a: string) => down.includes(a), endTick() {}, clear() {}, dispose() {} }) as unknown as Input;

test("keys mean left and right on the screen, so they swap in the rules once you've crossed", () => {
  const me = { stance: "guard" as const };
  assert.equal(createPlayerControl()(keys(["right"]), me, true, false).move, 1);
  assert.equal(createPlayerControl()(keys(["right"]), me, true, true).move, -1);
  assert.equal(createPlayerControl()(keys(["left"]), me, true, true).move, 1);
  assert.equal(createPlayerControl()(keys([]), me, true, true).move, 0);
});

test("the lock's keys swap when you're on the other side", () => {
  assert.ok(lockHelp(true).startsWith("D push"));
  assert.ok(lockHelp(false).startsWith("A push"));
});

test("every help line fits, the crossing one included", () => {
  for (let tick = 0; tick < 2000; tick += 100) assert.ok(measureText(helpLine(tick)) <= STAGE_W + 4, helpLine(tick));
});

test("once crossed, things said appear where the fighters really are on the screen", () => {
  const view = createDuelView(skipBow(createDuel()));
  const { x } = view.duel.fighters[0];
  view.duel = { ...view.duel, crossed: true };
  applyEvents(view, [{ type: "kiai", by: 0, target: "men" }], true);
  assert.equal(view.floaters[0].x, 256 - x);
});
