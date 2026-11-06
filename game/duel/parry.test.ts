import test from "node:test";
import assert from "node:assert/strict";
import { COUNTER_TICKS, COUNTER_WINDUP, DEFLECT_TICKS, PARRY_COOLDOWN, PARRY_WINDOW, RING_MAX, RING_MIN } from "./constants.ts";
import { createDuel, exposedTargets, skipBow, step, type DuelState, type FighterInput } from "./rules.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const TAP: FighterInput = { ...IDLE, block: true, parry: true };
const SWING: FighterInput = { ...IDLE, attack: "men", stomp: true };

function fightAt(dist: number, options?: Parameters<typeof createDuel>[0]): DuelState {
  const duel = skipBow(createDuel(options));
  const mid = (RING_MIN + RING_MAX) / 2;
  duel.fighters[0].x = mid - dist / 2;
  duel.fighters[1].x = mid + dist / 2;
  return duel;
}

/** Rival swings a men that lands this many ticks after the swing starts, and the player taps with `tapAt` ticks left. */
function swingAtPlayer(tapAt: number, windup = 30, options: Parameters<typeof createDuel>[0] = {}) {
  let s = fightAt(40, { windups: [{}, { men: windup }], ...options });
  s = step(s, IDLE, SWING);
  while (s.fighters[1].stance === "windup") {
    const left = s.fighters[1].stanceTicks;
    s = step(s, left === tapAt ? TAP : IDLE, { ...IDLE, stomp: left <= 3 });
    if (s.events.some((e) => e.type === "parry" || e.type === "hit" || e.type === "blocked")) return s;
  }
  return s;
}

test("a parry timed just before the strike lands deflects it", () => {
  const s = swingAtPlayer(5);
  assert.deepEqual(s.events.find((e) => e.type === "parry"), { type: "parry", by: 0 });
  assert.equal(s.phase, "fight");
  assert.equal(s.fighters[1].stance, "deflected");
  assert.equal(s.fighters[1].stanceTicks, DEFLECT_TICKS);
});

test("tapping too early does nothing to save you", () => {
  const s = swingAtPlayer(PARRY_WINDOW + 5);
  assert.ok(s.events.some((e) => e.type === "hit"));
});

test("a parried attacker is wide open, and the parry gives a quick answer", () => {
  let s = swingAtPlayer(5);
  assert.deepEqual(exposedTargets(s.fighters[1]), ["men", "kote", "do"]);
  assert.equal(s.fighters[0].counterTicks, COUNTER_TICKS);
  assert.equal(s.fighters[0].stance, "guard");
  s = step(s, SWING, IDLE);
  assert.equal(s.fighters[0].stance, "windup");
  assert.equal(s.fighters[0].stanceTicks, COUNTER_WINDUP - 1);
});

test("the quick answer goes away if you don't use it", () => {
  let s = swingAtPlayer(5);
  for (let i = 0; i <= COUNTER_TICKS; i++) s = step(s, IDLE, IDLE);
  s = step(s, SWING, IDLE);
  assert.ok(s.fighters[0].stanceTicks > COUNTER_WINDUP);
});

test("a parry costs no ki, where a held block pays for every strike", () => {
  const parried = swingAtPlayer(5);
  assert.ok(parried.fighters[0].ki >= 100);
  assert.ok(parried.fighters[1].ki < 100 - 14);
});

test("mashing the parry can't keep it up: there's a wait before the next one", () => {
  let s = fightAt(70);
  s = step(s, TAP, IDLE);
  assert.equal(s.fighters[0].stance, "parry");
  for (let i = 0; i < PARRY_WINDOW; i++) s = step(s, IDLE, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
  s = step(s, TAP, IDLE);
  assert.notEqual(s.fighters[0].stance, "parry", "still on cooldown");
  for (let i = 0; i < PARRY_COOLDOWN; i++) s = step(s, IDLE, IDLE);
  s = step(s, TAP, IDLE);
  assert.equal(s.fighters[0].stance, "parry");
});

test("nothing can be done mid-parry except wait for it", () => {
  let s = step(fightAt(70), TAP, IDLE);
  const x = s.fighters[0].x;
  s = step(s, { ...IDLE, move: 1, attack: "men" }, IDLE);
  assert.equal(s.fighters[0].stance, "parry");
  assert.equal(s.fighters[0].x, x);
});

test("holding the key on after the window just becomes a block, with no gap", () => {
  let s = step(fightAt(70), TAP, IDLE);
  for (let i = 0; i < PARRY_WINDOW; i++) {
    s = step(s, { ...IDLE, block: true }, IDLE);
    assert.ok(s.fighters[0].stance === "parry" || s.fighters[0].stance === "block", s.fighters[0].stance);
  }
  assert.equal(s.fighters[0].stance, "block");
});

test("a strike out of reach isn't parried, it just misses", () => {
  let s = fightAt(70, { windups: [{}, { men: 12 }] });
  s = step(s, IDLE, SWING);
  while (s.fighters[1].stance === "windup") s = step(s, s.fighters[1].stanceTicks === 4 ? TAP : IDLE, { ...IDLE, stomp: true });
  assert.equal(s.fighters[1].stance, "recovery");
});

test("lessons don't parry: the drills stay as they are", () => {
  let s = fightAt(40, { windups: [{}, { men: 12 }], basics: true });
  s = step(s, TAP, SWING);
  while (s.fighters[1].stance === "windup") s = step(s, TAP, { ...IDLE, stomp: true });
  assert.ok(!s.events.some((e) => e.type === "parry"));
  assert.ok(s.events.some((e) => e.type === "blocked"), "the tap was a plain block");
});
