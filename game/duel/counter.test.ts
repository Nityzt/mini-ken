import test from "node:test";
import assert from "node:assert/strict";
import { COUNTER_WINDUP, DEFLECT_TICKS, KIAI_PRESS, REPARRY_MISS, REPARRY_WINDOW } from "./constants.ts";
import { distance, ruleTick, skipBow, type DuelState, type FighterInput } from "./rules.ts";
import { directDuel } from "./test-support.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };

function atGap(gap: number): DuelState {
  const s = skipBow(directDuel());
  s.fighters[0].x = s.fighters[1].x - gap;
  return s;
}

/** Fighter 1 strikes, fighter 0 parries, and fighter 0 has its counter on offer. */
function parried(gap = 44): DuelState {
  let s = ruleTick(atGap(gap), IDLE, { ...IDLE, attack: "men", stomp: true });
  while (s.fighters[1].stanceTicks > 5) s = ruleTick(s, IDLE, { ...IDLE, stomp: true });
  s = ruleTick(s, { ...IDLE, block: true, parry: true }, IDLE);
  while (s.fighters[1].stance === "windup") s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.fighters[1].stance, "deflected");
  assert.ok(s.fighters[0].counterTicks > 0);
  return s;
}

/** Runs the counter until it's this far off, then taps. */
function counterThenTap(ticksLeftAtTap: number | null, gap = 44): DuelState {
  let s = ruleTick(parried(gap), { ...IDLE, attack: "men", stomp: true }, IDLE);
  assert.equal(s.fighters[0].countering, true);
  for (let i = 0; i < 40 && s.fighters[0].stance === "windup"; i++) {
    const tap = s.fighters[0].stanceTicks === ticksLeftAtTap;
    s = ruleTick(s, IDLE, tap ? { ...IDLE, block: true, parry: true } : IDLE);
  }
  return s;
}

test("a counter can be parried in its last few ticks, and no sooner", () => {
  assert.ok(REPARRY_WINDOW - 1 < COUNTER_WINDUP, "too short to react to");
  assert.ok(counterThenTap(REPARRY_WINDOW - 1).events.some((e) => e.type === "parry" && e.by === 1));
  assert.ok(counterThenTap(REPARRY_WINDOW).events.some((e) => e.type === "hit" && e.by === 0), "a moment too soon and it lands");
  assert.ok(counterThenTap(null).events.some((e) => e.type === "hit" && e.by === 0));
});

test("after a second parry nobody gets a counter or any ki, and both are back in guard", () => {
  const before = counterThenTap(null);
  void before;
  const s = counterThenTap(REPARRY_WINDOW - 1);
  assert.equal(s.phase, "fight");
  assert.equal(s.fighters[0].stance, "guard");
  assert.equal(s.fighters[1].stance, "guard");
  assert.equal(s.fighters[0].counterTicks, 0);
  assert.equal(s.fighters[1].counterTicks, 0);
  assert.equal(s.lock, null);
  assert.ok(distance(s) > 32);
});

test("a second parry up close binds", () => {
  const s = counterThenTap(REPARRY_WINDOW - 1, 36);
  assert.ok(s.lock);
  assert.ok(s.events.some((e) => e.type === "parry" && e.by === 1));
});

test("a first parry only binds from very close", () => {
  let s = ruleTick(atGap(21), IDLE, { ...IDLE, attack: "men", stomp: true });
  while (s.fighters[1].stanceTicks > 5) s = ruleTick(s, IDLE, { ...IDLE, stomp: true });
  s = ruleTick(s, { ...IDLE, block: true, parry: true }, IDLE);
  while (s.fighters[1].stance === "windup") s = ruleTick(s, IDLE, IDLE);
  assert.ok(s.lock);
  assert.equal(parried(27).lock, null);
});

test("a counter drives forward", () => {
  const start = parried();
  let s = ruleTick(start, { ...IDLE, attack: "men", stomp: true }, IDLE);
  s = ruleTick(s, IDLE, IDLE);
  assert.equal(start.fighters[0].x + 8, s.fighters[0].x);
});

test("there's one try at it, and missing leaves you stuck for longer", () => {
  let s = parried();
  const stuck = s.fighters[1].stanceTicks;
  assert.ok(stuck <= DEFLECT_TICKS);
  s = ruleTick(s, IDLE, { ...IDLE, block: true, parry: true });
  assert.equal(s.fighters[1].reparryUsed, true);
  for (let i = 0; i < REPARRY_WINDOW; i++) s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.fighters[1].stanceTicks, stuck - 1 - REPARRY_WINDOW + REPARRY_MISS);
  const again = ruleTick(s, IDLE, { ...IDLE, block: true, parry: true });
  assert.equal(again.fighters[1].reparryTicks, 0, "and no second try");
});

test("only a counter can be parried while stuck", () => {
  let s = parried();
  s.fighters[0].counterTicks = 0;
  s = ruleTick(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  assert.equal(s.fighters[0].countering, false);
  while (s.fighters[0].stanceTicks > 2) s = ruleTick(s, IDLE, IDLE);
  s = ruleTick(s, IDLE, { ...IDLE, block: true, parry: true });
  while (s.fighters[0].stance === "windup") s = ruleTick(s, IDLE, IDLE);
  assert.ok(s.events.some((e) => e.type === "hit" && e.by === 0));
});

test("two fighters holding seme build nothing on each other, and a kiai adds nothing", () => {
  const both: FighterInput = { ...IDLE, seme: true };
  let s = atGap(60);
  s.fighters[0].pressure = 20;
  s.fighters[1].pressure = 30;
  for (let i = 0; i < 100; i++) s = ruleTick(s, both, both);
  assert.equal(s.fighters[0].pressure, 20);
  assert.equal(s.fighters[1].pressure, 30);
  s = ruleTick(s, { ...both, stomp: true }, both);
  assert.ok(s.events.some((e) => e.type === "shout"));
  assert.equal(s.fighters[1].pressure, 30);
  assert.ok(KIAI_PRESS > 0);
  const one = ruleTick(s, both, IDLE);
  assert.equal(one.fighters[1].pressure, 31, "one letting go and it's back on");
});

test("a counter from just outside the bind still has room to land", () => {
  let next = ruleTick(parried(27), { ...IDLE, attack: "men", stomp: true }, IDLE);
  for (let i = 0; i < 10 && next.fighters[0].stance === "windup"; i++) next = ruleTick(next, IDLE, IDLE);
  assert.equal(next.phase, "zanshin");
});
