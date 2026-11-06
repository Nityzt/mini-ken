import test from "node:test";
import assert from "node:assert/strict";
import { RANGE_MAX, RANGE_MIN, RING_MAX, RING_MIN, SWING_COST, TSUBA_BREAK, TSUBA_GAP, TSUBA_TICKS, TSUBA_WAKARE_GAP, ZANSHIN_HIKI } from "./constants.ts";
import { createDuel, distance, skipBow, ruleTick as step, type DuelState, type FighterInput } from "./rules.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const PUSH_A: FighterInput = { ...IDLE, move: 1 };
const PUSH_B: FighterInput = { ...IDLE, move: -1 };
const HOLD: FighterInput = { ...IDLE, block: true };

function fightAt(dist: number, options?: Parameters<typeof createDuel>[0]): DuelState {
  const duel = skipBow(createDuel(options));
  const mid = (RING_MIN + RING_MAX) / 2;
  duel.fighters[0].x = mid - dist / 2;
  duel.fighters[1].x = mid + dist / 2;
  return duel;
}

/** Both fighters locked together, as if they'd just walked in. */
function locked(): DuelState {
  const s = step(fightAt(TSUBA_GAP), IDLE, IDLE);
  assert.ok(s.lock, "should have locked");
  return s;
}

const has = (s: DuelState, type: string) => s.events.some((e) => e.type === type);

test("walking right up to someone locks you together", () => {
  const s = locked();
  assert.deepEqual(s.fighters.map((f) => f.stance), ["tsuba", "tsuba"]);
  assert.ok(has(s, "lock"));
});

test("a strike from too close ends in the lock, not a point", () => {
  let s = step(fightAt(RANGE_MIN - 1), { ...IDLE, attack: "men", stomp: true }, IDLE);
  for (let i = 0; i < 20 && !s.lock; i++) s = step(s, IDLE, IDLE);
  assert.ok(s.lock);
  assert.deepEqual(s.fighters.map((f) => f.points), [0, 0]);
});

test("a strike blocked from close carries on into the lock", () => {
  let s = fightAt(24);
  s = step(s, { ...IDLE, attack: "men", stomp: true }, HOLD);
  for (let i = 0; i < 20 && !s.lock; i++) s = step(s, { ...IDLE, stomp: true }, HOLD);
  assert.ok(s.lock);
  assert.equal(s.fighters[0].stance, "tsuba");
});

test("a strike blocked from further out doesn't", () => {
  let s = fightAt(40);
  s = step(s, { ...IDLE, attack: "men", stomp: true }, HOLD);
  for (let i = 0; i < 20; i++) s = step(s, { ...IDLE, stomp: true }, HOLD);
  assert.equal(s.lock, null);
  assert.notEqual(s.fighters[0].stance, "tsuba");
});

test("launching into someone is a body check, and starts ahead", () => {
  let s = fightAt(20);
  s = step(s, { ...IDLE, dash: 1 }, IDLE);
  for (let i = 0; i < 10 && !s.lock; i++) s = step(s, IDLE, IDLE);
  assert.ok(s.lock);
  assert.ok(s.lock.balance > 0);
  assert.ok(has(s, "taiatari"));
});

test("pushing a held guard shoves them off balance and wide open", () => {
  let s = locked();
  for (let i = 0; i < 300 && s.lock; i++) s = step(s, PUSH_A, HOLD);
  assert.equal(s.lock, null);
  assert.ok(has(s, "shove"));
  assert.equal(s.fighters[1].stance, "stumble");
  assert.equal(s.fighters[0].stance, "guard");
  const after = step(s, IDLE, IDLE);
  assert.ok(distance(after) > TSUBA_GAP, "they go back");
});

test("after being shoved, they can be hit from where they land", () => {
  let s = locked();
  for (let i = 0; i < 300 && s.lock; i++) s = step(s, PUSH_A, HOLD);
  s = step(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  for (let i = 0; i < 20 && s.phase === "fight"; i++) s = step(s, { ...IDLE, stomp: true }, IDLE);
  assert.equal(s.phase, "zanshin");
});

test("two pushing evenly get nowhere", () => {
  let s = locked();
  for (let i = 0; i < 60; i++) s = step(s, PUSH_A, PUSH_B);
  assert.ok(s.lock);
  assert.ok(Math.abs(s.lock.balance) < TSUBA_BREAK / 2);
});

test("whoever has less ki loses the shove", () => {
  let s = locked();
  s.fighters[0].ki = 10;
  for (let i = 0; i < 40; i++) s = step(s, PUSH_A, PUSH_B);
  assert.ok(s.lock);
  assert.ok(s.lock.balance < 0);
});

/** Starts a hiki strike with a stomp, and has both sides do this until it lands. */
function pullAgainst(them: FighterInput): DuelState {
  let s = locked();
  s = step(s, { ...IDLE, attack: "men", stomp: true }, them);
  for (let i = 0; i < 60 && s.phase === "fight" && !s.events.some((e) => e.type === "kiai"); i++) s = step(s, IDLE, them);
  return s;
}

test("hiki: pulling back on someone who's pushing catches them leaning, and scores", () => {
  const s = pullAgainst(PUSH_B);
  assert.equal(s.phase, "zanshin");
  assert.equal(s.zanshin?.by, 0);
  assert.equal(s.lastScore, null);
  assert.equal(s.fighters[1].stance, "stumble");
});

test("hiki: pulling back on a held guard is blocked, and leaves you open", () => {
  const s = pullAgainst(HOLD);
  assert.equal(s.phase, "fight");
  assert.ok(has(s, "blocked"));
  assert.equal(s.fighters[0].stance, "recovery");
  assert.equal(s.lock, null);
});

test("hiki: a strike pulled back lands from a real distance", () => {
  const s = pullAgainst(HOLD);
  assert.ok(distance(s) >= RANGE_MIN && distance(s) <= RANGE_MAX, `${distance(s)}`);
});

test("hiki has a tell: you stay locked and visibly pull first", () => {
  let s = locked();
  s = step(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  assert.ok(s.lock);
  assert.equal(s.lock.pulling[0]?.attack, "men");
  assert.equal(s.fighters[0].ki, 100 - SWING_COST);
});

test("seeing the tell, there's time to stop pushing and hold", () => {
  let s = locked();
  s = step(s, { ...IDLE, attack: "men", stomp: true }, PUSH_B);
  s = step(s, IDLE, PUSH_B);
  for (let i = 0; i < 60 && s.phase === "fight" && !s.events.some((e) => e.type === "kiai"); i++) s = step(s, IDLE, HOLD);
  assert.equal(s.phase, "fight");
  assert.ok(has(s, "blocked"));
});

test("a stomp any time during the pull counts for the strike", () => {
  let s = locked();
  s = step(s, { ...IDLE, attack: "men" }, IDLE);
  s = step(s, IDLE, IDLE);
  s = step(s, { ...IDLE, stomp: true }, IDLE);
  for (let i = 0; i < 40 && s.phase === "fight" && !s.events.some((e) => e.type === "kiai"); i++) s = step(s, IDLE, IDLE);
  assert.equal(s.phase, "zanshin");
});

test("no stomp at all, no point", () => {
  let s = locked();
  s = step(s, { ...IDLE, attack: "men" }, IDLE);
  for (let i = 0; i < 40 && s.phase === "fight" && !s.events.some((e) => e.type === "kiai"); i++) s = step(s, IDLE, IDLE);
  assert.equal(s.phase, "fight");
  assert.ok(has(s, "flat"));
});

test("zanshin after a hiki strike goes backwards, the way you're already going", () => {
  let s = pullAgainst(PUSH_B);
  assert.equal(s.zanshin?.dir, -1);
  assert.equal(s.zanshin?.needed, ZANSHIN_HIKI);
  const start = s.fighters[0].x;
  while (s.phase === "zanshin") s = step(s, { ...IDLE, move: -1 }, IDLE);
  assert.equal(s.phase, "point");
  assert.ok(s.fighters[0].x <= start);
  assert.equal(s.fighters[0].points, 1);
});

test("stepping out breaks the lock, with nobody hurt", () => {
  let s = locked();
  s = step(s, { ...IDLE, move: -1 }, IDLE);
  assert.equal(s.lock, null);
  assert.deepEqual(s.fighters.map((f) => f.stance), ["guard", "guard"]);
  assert.ok(distance(s) > TSUBA_GAP);
});

test("a stalled lock is called: wakare, and both walk apart to fight on", () => {
  let s = locked();
  for (let i = 0; i <= TSUBA_TICKS && s.lock; i++) s = step(s, HOLD, HOLD);
  assert.equal(s.lock, null);
  assert.equal(s.phase, "wakare");
  assert.ok(has(s, "wakare"));
  let last = distance(s);
  while (s.phase === "wakare") {
    s = step(s, IDLE, IDLE);
    assert.ok(distance(s) - last <= 4, "walks, doesn't jump");
    last = distance(s);
  }
  assert.equal(s.phase, "fight");
  assert.ok(distance(s) >= TSUBA_WAKARE_GAP);
  assert.deepEqual(s.fighters.map((f) => f.stance), ["guard", "guard"]);
});

test("nobody's ki comes back while locked", () => {
  let s = locked();
  s.fighters[0].ki = 50;
  for (let i = 0; i < 30; i++) s = step(s, HOLD, HOLD);
  assert.equal(s.fighters[0].ki, 50);
});

test("nobody gets pushed out of the ring", () => {
  let s = locked();
  for (let i = 0; i < 400 && s.lock; i++) {
    s = step(s, PUSH_A, HOLD);
    assert.ok(s.fighters[1].x <= RING_MAX && s.fighters[0].x >= RING_MIN);
  }
});

test("in a lesson nothing locks: close strikes push apart as they always did", () => {
  let s = fightAt(14, { basics: true });
  s = step(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  for (let i = 0; i < 20; i++) {
    s = step(s, IDLE, IDLE);
    assert.equal(s.lock, null);
  }
  assert.ok(distance(s) > 14);
});

test("a strong presence doesn't stop at close quarters: it can make you flinch out of a lock", () => {
  let s = step(fightAt(TSUBA_GAP, { presence: [0, 2] }), IDLE, IDLE);
  assert.ok(s.lock);
  const start = s.fighters[0].pressure;
  s = step(s, HOLD, HOLD);
  assert.ok(s.fighters[0].pressure > start);
  for (let i = 0; i < 400 && s.lock; i++) s = step(s, HOLD, HOLD);
  assert.equal(s.lock, null);
  assert.equal(s.phase, "fight", "a flinch comes before the referee gets to call it");
  assert.equal(s.fighters[0].stance, "shaken");
  assert.equal(s.fighters[1].stance, "guard");
});

test("without a presence, nobody's pressure builds in a lock", () => {
  let s = locked();
  for (let i = 0; i < 60; i++) s = step(s, HOLD, HOLD);
  assert.equal(s.fighters[0].pressure, 0);
});
