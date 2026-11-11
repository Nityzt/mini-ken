import test from "node:test";
import assert from "node:assert/strict";
import { createBrawl, stepBrawl, type BrawlState, type BrawlSpec, HIT_DAMAGE } from "./brawl.ts";
import { BRAWL_KIAI_PRESS, BRAWL_RECOVERY_TICKS, BRAWL_SEME_TICKS, COWER_TICKS, KIAI_COOLDOWN, SEME_DRAIN, SEME_RANGE, ZANSHIN_PASS } from "./constants.ts";
import type { AttackKind, FighterInput, Target } from "./rules.ts";

// Only your side of a street fight lives here. What the gang does is the line drill's, in street.test.ts.
const IDLE: FighterInput = { move: 0, block: false, attack: null };
const MARKET: BrawlSpec[] = [{ kind: "fist", x: 200 }, { kind: "fist", x: 280 }, { kind: "fist", x: 360 }];

/** One bully in reach, offering `opening`. */
function facing(opening: Target | null, x = 80): BrawlState {
  const s = createBrawl({ bullies: [{ kind: "fist", x }], seed: 2 });
  s.bullies[0].opening = opening;
  return s;
}

function strike(s: BrawlState, attack: AttackKind, stomp = true): BrawlState {
  s = stepBrawl(s, { ...IDLE, attack, stomp });
  while (!s.zanshin && s.phase === "fight" && s.player.stance === "windup") s = stepBrawl(s, IDLE);
  return s;
}

test("it starts in full health and everyone standing, shut", () => {
  const s = createBrawl({ bullies: MARKET, seed: 1 });
  assert.equal(s.hp, 100);
  assert.equal(s.bullies.length, 3);
  assert.ok(s.bullies.every((b) => b.opening === null && b.state === "wait"));
  assert.equal(s.phase, "fight");
});

test("nobody moves on their own: the line drill runs them", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 70 }], seed: 1 });
  for (let i = 0; i < 600; i++) s = stepBrawl(s, IDLE);
  assert.equal(s.bullies[0].x, 70);
  assert.equal(s.hp, 100);
});

test("a clean hit on the open target staggers them and asks for the follow-through", () => {
  const s = strike(facing("do"), "do");
  assert.ok(s.zanshin);
  assert.equal(s.bullies[0].state, "stagger");
});

test("only the open target lands", () => {
  const s = strike(facing("do"), "men");
  assert.equal(s.zanshin, null);
  assert.ok(s.events.some((e) => e.type === "blocked"));
  assert.equal(strike(facing(null), "do").zanshin, null, "nothing's open while they're shut");
});

test("the follow-through carries you all the way past them", () => {
  let s = strike(facing("men"), "men");
  const x = s.bullies[0].x;
  while (s.zanshin) s = stepBrawl(s, { ...IDLE, move: 1 });
  assert.equal(s.bullies[0].state, "down");
  assert.equal(s.phase, "won");
  assert.ok(s.player.x >= x + ZANSHIN_PASS);
});

test("stopping short leaves them standing and you recovering", () => {
  let s = strike(facing("men"), "men");
  while (s.zanshin) s = stepBrawl(s, IDLE);
  assert.notEqual(s.bullies[0].state, "down");
  assert.ok(s.events.some((e) => e.type === "nozanshin"));
  assert.equal(s.player.stance, "recovery");
});

test("a strike with no stomp does nothing", () => {
  const s = strike(facing("men"), "men", false);
  assert.equal(s.zanshin, null);
  assert.equal(s.player.stance, "recovery");
});

test("you can turn and hit someone behind you", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 10 }], seed: 2, startX: 50 });
  s.bullies[0].opening = "men";
  s = stepBrawl(s, { ...IDLE, move: -1 });
  assert.equal(s.player.facing, -1);
  assert.ok(strike(s, "men").zanshin);
});

test("a launch closes distance fast", () => {
  const start = createBrawl({ bullies: [{ kind: "fist", x: 400 }], seed: 2 });
  let s = stepBrawl(start, { ...IDLE, dash: 1 });
  for (let i = 0; i < 20; i++) s = stepBrawl(s, IDLE);
  assert.ok(s.player.x - start.player.x >= 40);
});

const SEME: FighterInput = { ...IDLE, seme: true };

test("holding seme plants you and drains ki", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 400 }], seed: 2 });
  const x = s.player.x;
  const ki = s.player.ki;
  for (let i = 0; i < 10; i++) s = stepBrawl(s, { ...SEME, move: 1 });
  assert.equal(s.player.x, x);
  assert.equal(s.player.stance, "seme");
  assert.ok(Math.abs(s.player.ki - (ki - 10 * SEME_DRAIN)) < 1e-9);
});

function chargedUp(bullies: BrawlSpec[]): BrawlState {
  let s = createBrawl({ bullies, seed: 2, kiMax: 500 });
  for (let i = 0; i < BRAWL_SEME_TICKS; i++) s = stepBrawl(s, SEME);
  return s;
}

test("enough pressure makes everyone nearby cower at once", () => {
  const s = chargedUp([{ kind: "fist", x: 70 }, { kind: "stick", x: 100 }, { kind: "fist", x: 40 + SEME_RANGE + 60 }]);
  assert.equal(s.bullies[0].state, "cower");
  assert.equal(s.bullies[1].state, "cower");
  assert.notEqual(s.bullies[2].state, "cower");
  assert.equal(s.bullies[0].ticks, COWER_TICKS);
  assert.equal(s.pressure, 0);
  assert.ok(s.events.some((e) => e.type === "cower"));
});

test("a cowering bully is open everywhere", () => {
  assert.ok(strike(chargedUp([{ kind: "fist", x: 76 }]), "men").zanshin);
  assert.ok(strike(chargedUp([{ kind: "fist", x: 76 }]), "kote").zanshin);
});

test("no one in range means no pressure", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 900 }], seed: 2 });
  for (let i = 0; i < 20; i++) s = stepBrawl(s, SEME);
  assert.equal(s.pressure, 0);
});

test("a kiai jumps the pressure on everyone close", () => {
  let s = createBrawl({ bullies: MARKET, seed: 1 });
  s.bullies[0].x = s.player.x + 40;
  s = stepBrawl(s, SEME);
  const before = s.pressure;
  s = stepBrawl(s, { ...SEME, stomp: true });
  assert.ok(s.events.some((e) => e.type === "shout"));
  assert.equal(s.pressure, before + BRAWL_KIAI_PRESS + 1);
  s = stepBrawl(s, { ...SEME, stomp: true });
  assert.equal(s.events.some((e) => e.type === "shout"), false, "not again so soon");
  for (let i = 0; i < KIAI_COOLDOWN; i++) s.player.kiaiTicks = Math.max(0, s.player.kiaiTicks - 1);
  s = stepBrawl(s, { ...SEME, stomp: true });
  assert.ok(s.events.some((e) => e.type === "shout"));
});

test("walking back off the start of the street ends the fight without a win", () => {
  let s = createBrawl({ bullies: MARKET, seed: 2 });
  for (let i = 0; i < 400 && s.phase === "fight"; i++) s = stepBrawl(s, { ...IDLE, move: -1 });
  assert.equal(s.phase, "fled");
});

test("the far end of the street is a wall", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 900 }], seed: 2, startX: 880 });
  for (let i = 0; i < 300; i++) s = stepBrawl(s, { ...IDLE, move: 1 });
  assert.ok(s.player.x <= s.worldEnd);
});

test("stepBrawl is pure", () => {
  const s = createBrawl({ bullies: MARKET, seed: 5 });
  const clone = structuredClone(s);
  stepBrawl(s, { ...IDLE, move: 1, attack: "men", stomp: true });
  assert.deepEqual(s, clone);
});

test("a stick hurts more than a fist, and it takes several hits to go down from full health", () => {
  assert.ok(HIT_DAMAGE.stick > HIT_DAMAGE.fist);
  assert.ok(100 / HIT_DAMAGE.stick >= 4);
});

test("you bring your health into a fight", () => {
  assert.equal(createBrawl({ bullies: MARKET, seed: 1, hp: 10 }).hp, 10);
});

test("a failed strike in a street fight costs what it always has", () => {
  assert.equal(BRAWL_RECOVERY_TICKS, 26);
});
