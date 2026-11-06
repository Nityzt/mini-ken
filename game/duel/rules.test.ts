import test from "node:test";
import assert from "node:assert/strict";
import { createDuel, distance, exposedTargets, skipBow, skipClosing, step, type AttackKind, type DuelEvent, type DuelState, type Fighter, type FighterInput, type Stance } from "./rules.ts";
import { ABSORB_COST, BROKEN_TICKS, KI_AFTER_BREAK, KI_MAX, KI_RECOVERY, LOCK_DISTANCE, RECOVERY_TICKS, RING_MAX, RING_MIN, SWING_COST, WALK, STOMP_WINDOW, ZANSHIN_PASS, LAUNCH_COST, MIN_DISTANCE, KIAI_COOLDOWN, KIAI_COST, KIAI_PRESS, SEME_DRAIN, SEME_RANGE, SEME_TICKS, SHAKEN_KI_LOSS, SHAKEN_TICKS, CLOSING_TICKS, RETURN_SETTLE, RETURN_WALK } from "./constants.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const BLOCK: FighterInput = { move: 0, block: true, attack: null };
const attack = (a: AttackKind): FighterInput => ({ move: 0, block: false, attack: a, stomp: true });

const fighter = (stance: Stance, attackKind: AttackKind | null = null): Fighter => ({
  kamae: "chudan",
  x: 100, ki: 100, kiMax: 100, stance, stanceTicks: 5, attack: attackKind, points: 0, stompAge: 9999, launchTicks: 0, launchDir: 0, pressure: 0, kiaiTicks: 0, parryCooldown: 0, counterTicks: 0, hiki: false,
});

/** A duel in the fight phase with fighters this far apart. */
function fightAt(dist: number, options?: Parameters<typeof createDuel>[0]): DuelState {
  const duel = skipBow(createDuel(options));
  const mid = (RING_MIN + RING_MAX) / 2;
  duel.fighters[0].x = mid - dist / 2;
  duel.fighters[1].x = mid + dist / 2;
  return duel;
}

/** Steps until an event of one of these types appears, returning that state. */
function until(state: DuelState, a: FighterInput, b: FighterInput, types: DuelEvent["type"][]): DuelState {
  let s = state;
  for (let i = 0; i < 200; i++) {
    // Whoever just hit follows through, unless a test is checking what happens when they don't.
    const slide = (by: 0 | 1): FighterInput["move"] => (s.phase === "zanshin" && s.zanshin?.by === by ? (by === 0 ? 1 : -1) : 0);
    const nextA = i === 0 ? a : { ...a, attack: null, stomp: false, move: slide(0) || a.move };
    const nextB = i === 0 ? b : { ...b, attack: null, stomp: false, move: slide(1) || b.move };
    s = step(s, nextA, nextB);
    if (s.events.some((e) => types.includes(e.type))) return s;
  }
  throw new Error(`No ${types.join("/")} event within 200 ticks`);
}
const has = (s: DuelState, type: DuelEvent["type"]) => s.events.some((e) => e.type === type);

test("each stance exposes exactly the targets in the spec", () => {
  assert.deepEqual(exposedTargets(fighter("guard")), ["men", "kote", "do"]);
  assert.deepEqual(exposedTargets(fighter("block")), []);
  assert.deepEqual(exposedTargets(fighter("windup", "men")), ["kote"]);
  assert.deepEqual(exposedTargets(fighter("windup", "kote")), ["men"]);
  assert.deepEqual(exposedTargets(fighter("windup", "do")), ["men"]);
  assert.deepEqual(exposedTargets(fighter("windup", "bigMen")), ["do"]);
  assert.deepEqual(exposedTargets(fighter("windup", "quickMen")), ["kote"]);
  assert.deepEqual(exposedTargets(fighter("recovery")), ["men", "kote", "do"]);
  assert.deepEqual(exposedTargets(fighter("broken")), ["men", "kote", "do"]);
});

test("in range strike on an exposed target scores", () => {
  const s = until(fightAt(40), attack("men"), IDLE, ["clean", "blocked", "whiff", "lock"]);
  assert.ok(has(s, "clean"));
  assert.equal(s.fighters[0].points, 1);
  assert.equal(s.phase, "point");
  assert.deepEqual(s.lastScore, { by: 0, attack: "men", defenderStance: "guard" });
});

test("landing a strike announces the kiai", () => {
  const s = until(fightAt(40), attack("kote"), IDLE, ["hit"]);
  assert.deepEqual(s.events.find((e) => e.type === "kiai"), { type: "kiai", by: 0, target: "kote" });
});

test("too far whiffs: no point, striker recovers", () => {
  const s = until(fightAt(70), attack("men"), IDLE, ["whiff"]);
  assert.equal(s.fighters[0].points, 0);
  assert.equal(s.fighters[0].stance, "recovery");
  assert.equal(s.phase, "fight");
});

test("in a lesson, too close pushes apart: no point, distance 34, no recovery", () => {
  const s = until(fightAt(14, { basics: true }), attack("men"), IDLE, ["lock"]);
  assert.equal(s.fighters[0].points, 0);
  assert.equal(distance(s), LOCK_DISTANCE);
  assert.equal(s.fighters[0].stance, "guard");
});

test("wrong target during a tell is blocked, no point", () => {
  // The defender is winding up a long big men, which only exposes do.
  const s = until(fightAt(40), attack("men"), attack("bigMen"), ["blocked", "clean"]);
  assert.ok(has(s, "blocked"));
  assert.equal(s.fighters[0].points, 0);
  assert.equal(s.fighters[0].stance, "recovery");
});

test("right target during a tell scores", () => {
  const s = until(fightAt(40), attack("do"), attack("bigMen"), ["blocked", "clean"]);
  assert.ok(has(s, "clean"));
  assert.equal(s.lastScore?.defenderStance, "windup");
});

test("strike on a blocker scores nothing and costs the blocker 25 ki", () => {
  let s = step(fightAt(40), IDLE, BLOCK);
  const before = s.fighters[1].ki;
  s = until(s, attack("men"), BLOCK, ["blocked"]);
  assert.equal(s.fighters[0].points, 0);
  assert.equal(before - s.fighters[1].ki, ABSORB_COST);
});

test("running out of ki while blocking breaks the guard, and ki becomes 35", () => {
  let s = step(fightAt(40), IDLE, BLOCK);
  s.fighters[1].ki = ABSORB_COST;
  s = until(s, attack("men"), BLOCK, ["broken"]);
  assert.equal(s.fighters[1].stance, "broken");
  assert.equal(s.fighters[1].stanceTicks, BROKEN_TICKS);
  assert.equal(s.fighters[1].ki, KI_AFTER_BREAK);
});

test("no ki recovery while blocking; recovers in guard", () => {
  let s = fightAt(90);
  s.fighters[0].ki = 50;
  s.fighters[1].ki = 50;
  s = step(s, IDLE, BLOCK);
  s = step(s, IDLE, BLOCK);
  assert.equal(s.fighters[1].ki, 50);
  assert.equal(s.fighters[0].ki, 50 + KI_RECOVERY * 2);
});

test("ki never recovers above its maximum", () => {
  const s = step(fightAt(90), IDLE, IDLE);
  assert.equal(s.fighters[0].ki, KI_MAX);
});

test("swing costs 14 ki", () => {
  const s = step(fightAt(40), attack("men"), IDLE);
  assert.equal(KI_MAX - s.fighters[0].ki, SWING_COST);
});

test("low ki lengthens windup and recovery and slows walking", () => {
  const fresh = fightAt(70);
  const tired = fightAt(70);
  tired.fighters[0].ki = 10;
  const freshSwing = step(fresh, attack("men"), IDLE);
  const tiredSwing = step(tired, attack("men"), IDLE);
  assert.ok(tiredSwing.fighters[0].stanceTicks > freshSwing.fighters[0].stanceTicks);

  const freshDone = until(freshSwing, IDLE, IDLE, ["whiff"]);
  const tiredDone = until(tiredSwing, IDLE, IDLE, ["whiff"]);
  assert.equal(freshDone.fighters[0].stanceTicks, RECOVERY_TICKS);
  assert.ok(tiredDone.fighters[0].stanceTicks > RECOVERY_TICKS);

  const walk: FighterInput = { move: 1, block: false, attack: null };
  const freshStep = step(fightAt(90), walk, IDLE);
  const tiredStart = fightAt(90);
  tiredStart.fighters[0].ki = 10;
  const tiredStep = step(tiredStart, walk, IDLE);
  const moved = (d: DuelState) => d.fighters[0].x - fightAt(90).fighters[0].x;
  assert.ok(Math.abs(moved(freshStep) - WALK) < 1e-9);
  assert.ok(moved(tiredStep) < WALK);
});

test("ki never ends the match by itself", () => {
  let s = fightAt(70);
  s.fighters[0].ki = 0;
  s = until(s, attack("men"), IDLE, ["whiff"]);
  assert.equal(s.phase, "fight");
  assert.equal(s.winner, null);
  assert.equal(s.fighters[0].ki, 0);
});

test("in a lesson, simultaneous clean strikes are aiuchi: no points, both recover", () => {
  // Same length windups: kote strikes the men fighter's open wrist while men strikes the kote fighter's open head.
  const both = until(
    fightAt(40, { windups: [{ kote: 8 }, { men: 8 }], basics: true }),
    attack("kote"),
    attack("men"),
    ["aiuchi", "clean", "blocked"],
  );
  assert.ok(has(both, "aiuchi"));
  assert.deepEqual(both.fighters.map((f) => f.points), [0, 0]);
  assert.deepEqual(both.fighters.map((f) => f.stance), ["recovery", "recovery"]);
  assert.equal(both.phase, "fight");
});

function winPoint(state: DuelState): DuelState {
  let s = until(state, attack("men"), IDLE, ["clean"]);
  while (s.phase === "point" || s.phase === "closing") s = step(s, IDLE, IDLE);
  return s;
}

test("match ends at 2 points with the right winner", () => {
  let s = winPoint(fightAt(40));
  assert.equal(s.phase, "fight");
  assert.equal(s.winner, null);
  s.fighters[0].x = s.fighters[1].x - 40;
  s = winPoint(s);
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 0);
  assert.equal(s.fighters[0].points, 2);
});

test("positions reset after each point", () => {
  const start = createDuel().fighters.map((f) => f.x);
  const s = winPoint(fightAt(40));
  assert.deepEqual(s.fighters.map((f) => f.x), start);
  assert.deepEqual(s.fighters.map((f) => f.stance), ["guard", "guard"]);
});

test("fighters cannot pass each other or leave the ring", () => {
  let s = fightAt(30);
  for (let i = 0; i < 200; i++) s = step(s, { move: 1, block: false, attack: null }, { move: -1, block: false, attack: null });
  assert.ok(distance(s) > 0);
  let t = fightAt(30);
  for (let i = 0; i < 400; i++) t = step(t, { move: -1, block: false, attack: null }, { move: 1, block: false, attack: null });
  assert.equal(t.fighters[0].x, RING_MIN);
  assert.equal(t.fighters[1].x, RING_MAX);
});

test("no attack, walking or blocking starts during recovery", () => {
  let s = until(fightAt(70), attack("men"), IDLE, ["whiff"]);
  const x = s.fighters[0].x;
  const ticks = s.fighters[0].stanceTicks;
  s = step(s, { move: 1, block: true, attack: "kote" }, IDLE);
  assert.equal(s.fighters[0].stance, "recovery");
  assert.equal(s.fighters[0].x, x);
  assert.equal(s.fighters[0].stanceTicks, ticks - 1);
});

test("step is pure: input state deep-equals its earlier clone", () => {
  const s = fightAt(40);
  const clone = structuredClone(s);
  step(s, attack("men"), BLOCK);
  assert.deepEqual(s, clone);
});

test("same inputs replay to the same state", () => {
  const run = () => {
    let s = fightAt(60);
    for (let i = 0; i < 120; i++) {
      s = step(s, i % 40 === 0 ? attack("men") : { move: 1, block: false, attack: null }, i % 30 === 0 ? attack("kote") : IDLE);
    }
    return s;
  };
  assert.deepEqual(run(), run());
});

test("harmless strikes do not score", () => {
  const s = until(fightAt(40, { harmless: [false, true] }), IDLE, attack("men"), ["clean", "blocked"]);
  assert.equal(s.fighters[1].points, 0);
  assert.equal(s.phase, "fight");
  assert.equal(s.fighters[1].stance, "recovery");
});

test("a clean strike without fumikomi scores nothing and leaves the striker open", () => {
  const noStomp: FighterInput = { move: 0, block: false, attack: "men" };
  const s = until(fightAt(40), noStomp, IDLE, ["hit", "flat", "clean"]);
  assert.ok(has(s, "flat"));
  assert.equal(s.fighters[0].points, 0);
  assert.equal(s.phase, "fight");
  assert.equal(s.fighters[0].stance, "recovery");
});

test("a stomp too long before the strike lands doesn't count", () => {
  let s = fightAt(40);
  s = step(s, { ...IDLE, stomp: true }, IDLE);
  for (let i = 0; i < STOMP_WINDOW; i++) s = step(s, IDLE, IDLE);
  s = until(s, { move: 0, block: false, attack: "men" }, IDLE, ["hit", "flat"]);
  assert.ok(has(s, "flat"));
});

test("stomping just before the strike lands counts", () => {
  let s = step(fightAt(40), { move: 0, block: false, attack: "do" }, IDLE);
  for (let i = 0; i < 7; i++) s = step(s, IDLE, IDLE);
  s = step(s, { ...IDLE, stomp: true }, IDLE);
  s = until(s, IDLE, IDLE, ["hit", "flat"]);
  assert.ok(has(s, "hit"));
});

test("a stomp alone does nothing but announce itself", () => {
  const s = step(fightAt(40), { ...IDLE, stomp: true }, IDLE);
  assert.ok(has(s, "stomp"));
  assert.equal(s.fighters[0].stance, "guard");
  assert.equal(s.fighters[0].ki, KI_MAX);
});

test("blocks and misses don't care about the stomp", () => {
  const whiff = until(fightAt(70), { move: 0, block: false, attack: "men" }, IDLE, ["whiff", "flat"]);
  assert.ok(has(whiff, "whiff"));
  const blocked = until(step(fightAt(40), IDLE, BLOCK), { move: 0, block: false, attack: "men" }, BLOCK, ["blocked", "flat"]);
  assert.ok(has(blocked, "blocked"));
});

function hitThenDo(input: (tick: number) => FighterInput): DuelState {
  let s = step(fightAt(40), attack("men"), IDLE);
  while (s.phase === "fight") s = step(s, IDLE, IDLE);
  let t = 0;
  while (s.phase === "zanshin") s = step(s, input(t++), IDLE);
  return s;
}

test("a clean hit opens zanshin instead of scoring straight away", () => {
  const s = until(fightAt(40), attack("men"), IDLE, ["hit"]);
  assert.equal(s.phase, "zanshin");
  assert.equal(s.fighters[0].points, 0);
  assert.equal(s.zanshin?.by, 0);
});

test("sliding through in suriashi completes the point", () => {
  const s = hitThenDo(() => ({ ...IDLE, move: 1 }));
  assert.equal(s.phase, "point");
  assert.equal(s.fighters[0].points, 1);
  assert.ok(has(s, "clean"));
  assert.deepEqual(s.lastScore, { by: 0, attack: "men", defenderStance: "guard" });
});

test("the follow-through goes all the way past the opponent", () => {
  const s = hitThenDo(() => ({ ...IDLE, move: 1 }));
  assert.ok(s.fighters[0].x >= s.fighters[1].x + ZANSHIN_PASS, `stopped at ${s.fighters[0].x}, opponent at ${s.fighters[1].x}`);
});

test("sliding only as far as the opponent isn't enough", () => {
  let s = step(fightAt(40), attack("men"), IDLE);
  while (s.phase === "fight") s = step(s, IDLE, IDLE);
  while (s.phase === "zanshin" && s.fighters[0].x < s.fighters[1].x) s = step(s, { ...IDLE, move: 1 }, IDLE);
  assert.equal(s.phase, "zanshin", "still needs to go further");
  assert.equal(s.fighters[0].points, 0);
  while (s.phase === "zanshin") s = step(s, IDLE, IDLE);
  assert.equal(s.fighters[0].points, 0);
  assert.ok(has(s, "nozanshin"));
});

test("the opponent backed against the ring's edge still lets you finish", () => {
  let s = fightAt(40);
  s.fighters[1].x = RING_MAX;
  s.fighters[0].x = RING_MAX - 40;
  s = step(s, attack("men"), IDLE);
  while (s.phase === "fight") s = step(s, IDLE, IDLE);
  while (s.phase === "zanshin") s = step(s, { ...IDLE, move: 1 }, IDLE);
  assert.equal(s.fighters[0].points, 1);
});

test("stopping after the strike cancels the point and leaves the striker open", () => {
  const s = hitThenDo(() => IDLE);
  assert.equal(s.phase, "fight");
  assert.equal(s.fighters[0].points, 0);
  assert.ok(has(s, "nozanshin"));
  assert.equal(s.fighters[0].stance, "recovery");
});

test("sliding backward isn't zanshin", () => {
  assert.equal(hitThenDo(() => ({ ...IDLE, move: -1 })).fighters[0].points, 0);
});

test("a brief slide isn't enough", () => {
  const s = hitThenDo((t) => ({ ...IDLE, move: t < 6 ? 1 : 0 }));
  assert.equal(s.fighters[0].points, 0);
});

test("the rival's follow-through runs the other way", () => {
  const s = until(fightAt(40), IDLE, attack("men"), ["clean"]);
  assert.equal(s.fighters[1].points, 1);
});

test("fighters stay in the ring after a cancelled point", () => {
  const s = hitThenDo((t) => ({ ...IDLE, move: t < 10 ? 1 : 0 }));
  assert.ok(s.fighters[1].x - s.fighters[0].x >= MIN_DISTANCE);
  assert.ok(s.fighters[0].x >= RING_MIN && s.fighters[1].x <= RING_MAX);
});

test("a launch covers real ground and costs ki", () => {
  const start = fightAt(120);
  const x = start.fighters[0].x;
  let s = step(start, { ...IDLE, dash: 1 }, IDLE);
  assert.ok(s.fighters[0].ki <= KI_MAX - LAUNCH_COST + KI_RECOVERY);
  for (let i = 0; i < 30; i++) s = step(s, IDLE, IDLE);
  assert.ok(s.fighters[0].x - x >= 40, `moved ${s.fighters[0].x - x}`);
});

test("a launch goes further than walking the same time", () => {
  let walked = fightAt(120);
  let launched = step(fightAt(120), { ...IDLE, dash: 1 }, IDLE);
  for (let i = 0; i < 10; i++) {
    walked = step(walked, { ...IDLE, move: 1 }, IDLE);
    launched = step(launched, IDLE, IDLE);
  }
  assert.ok(launched.fighters[0].x > walked.fighters[0].x);
});

test("a long launch with a strike lands from outside normal range", () => {
  let s = step(fightAt(80), { ...IDLE, dash: 1 }, IDLE);
  s = step(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  s = until(s, IDLE, IDLE, ["hit", "whiff", "flat"]);
  assert.ok(has(s, "hit"));
});

test("the launch can also go backward", () => {
  const start = fightAt(60);
  let s = step(start, { ...IDLE, dash: -1 }, IDLE);
  for (let i = 0; i < 30; i++) s = step(s, IDLE, IDLE);
  assert.ok(s.fighters[0].x < start.fighters[0].x - 30);
});

test("you can't launch during recovery or while blocking", () => {
  const recovering = until(fightAt(70), attack("men"), IDLE, ["whiff"]);
  assert.equal(step(recovering, { ...IDLE, dash: 1 }, IDLE).fighters[0].launchTicks, 0);
  const blocking = step(fightAt(70), { ...IDLE, block: true }, IDLE);
  assert.equal(step(blocking, { ...IDLE, block: true, dash: 1 }, IDLE).fighters[0].launchTicks, 0);
});

test("a launch can't push through the opponent", () => {
  let s = step(fightAt(20), { ...IDLE, dash: 1 }, IDLE);
  for (let i = 0; i < 30; i++) s = step(s, IDLE, IDLE);
  assert.ok(distance(s) >= MIN_DISTANCE);
});

test("the launch ends at the next point", () => {
  const s = winPoint(step(fightAt(40), attack("men"), IDLE));
  assert.equal(s.fighters[0].launchTicks, 0);
});

const SEME: FighterInput = { ...IDLE, seme: true };
function holdSeme(state: DuelState, ticks: number, defender: FighterInput = IDLE): DuelState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, SEME, defender);
  return s;
}
const ready = () => {
  const s = fightAt(40);
  s.fighters[0].ki = s.fighters[0].kiMax = 400;
  return s;
};

test("holding seme drains ki instead of recovering it", () => {
  const s = holdSeme(fightAt(60), 10);
  assert.equal(s.fighters[0].stance, "seme");
  assert.ok(Math.abs(s.fighters[0].ki - (KI_MAX - SEME_DRAIN * 10)) < 1e-9);
});

test("letting go ends seme straight away", () => {
  const s = step(holdSeme(fightAt(60), 10), IDLE, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
});

test("seme plants your feet", () => {
  const start = fightAt(60);
  const s = step(step(start, SEME, IDLE), { ...SEME, move: 1 }, IDLE);
  assert.equal(s.fighters[0].x, start.fighters[0].x);
});

test("running out of ki ends seme", () => {
  const start = fightAt(60);
  start.fighters[0].ki = SEME_DRAIN * 3;
  const s = holdSeme(start, 6);
  assert.notEqual(s.fighters[0].stance, "seme");
  assert.equal(s.fighters[0].ki >= 0, true);
});

test("you can't start seme with no ki", () => {
  const start = fightAt(60);
  start.fighters[0].ki = 0;
  assert.equal(step(start, SEME, IDLE).fighters[0].stance, "guard");
});

test("a seme fighter is wide open", () => {
  assert.deepEqual(exposedTargets(fighter("seme")), ["men", "kote", "do"]);
});

test("a strike or block cancels seme", () => {
  const charged = holdSeme(fightAt(40), 5);
  assert.equal(step(charged, { ...SEME, attack: "men", stomp: true }, IDLE).fighters[0].stance, "windup");
  assert.equal(step(charged, { ...SEME, block: true }, IDLE).fighters[0].stance, "block");
});

test("pressure builds on the opponent, in range only", () => {
  assert.equal(holdSeme(fightAt(60), 10).fighters[1].pressure, 10);
  assert.equal(holdSeme(fightAt(SEME_RANGE + 20), 10).fighters[1].pressure, 0);
});

test("pressure fades after you let go", () => {
  const s = step(holdSeme(fightAt(60), 10), IDLE, IDLE);
  assert.ok(s.fighters[1].pressure < 10);
});

test("enough pressure makes the opponent flinch", () => {
  const s = holdSeme(ready(), SEME_TICKS);
  assert.equal(s.fighters[1].stance, "shaken");
  assert.equal(s.fighters[1].stanceTicks, SHAKEN_TICKS);
  assert.equal(s.fighters[1].pressure, 0);
  assert.ok(has(s, "shaken"));
  assert.equal(s.fighters[1].ki, KI_MAX - SHAKEN_KI_LOSS);
});

test("a flinch cancels the opponent's attack and leaves them open", () => {
  const start = ready();
  let s = holdSeme(start, SEME_TICKS - 5);
  s = step(s, SEME, attack("bigMen"));
  s = holdSeme(s, 4);
  assert.equal(s.fighters[1].stance, "shaken");
  assert.equal(s.fighters[1].attack, null);
  assert.deepEqual(exposedTargets(s.fighters[1]), ["men", "kote", "do"]);
});

test("a flinch ends, and the opponent recovers", () => {
  let s = holdSeme(ready(), SEME_TICKS);
  for (let i = 0; i < SHAKEN_TICKS + 2; i++) s = step(s, IDLE, IDLE);
  assert.equal(s.fighters[1].stance, "guard");
});

test("a full bar alone can only just pay for one flinch", () => {
  assert.ok(KI_MAX / SEME_DRAIN >= SEME_TICKS);
  assert.ok(KI_MAX / SEME_DRAIN < SEME_TICKS * 2);
});

test("a flinching fighter takes the full combo", () => {
  let s = holdSeme(ready(), SEME_TICKS);
  s = until(s, attack("do"), IDLE, ["clean"]);
  assert.equal(s.fighters[0].points, 1);
  assert.equal(s.lastScore?.defenderStance, "shaken");
});

test("a strike lands on a fighter powering up", () => {
  const s = until(step(fightAt(40), IDLE, SEME), attack("men"), SEME, ["clean"]);
  assert.equal(s.fighters[0].points, 1);
  assert.equal(s.lastScore?.defenderStance, "seme");
});

test("pressure clears between points", () => {
  let s = holdSeme(ready(), 10);
  s = winPoint(s);
  assert.equal(s.fighters[1].pressure, 0);
});

test("skipBow moves straight to fight", () => {
  assert.equal(createDuel().phase, "bow");
  assert.equal(skipBow(createDuel()).phase, "fight");
});

test("the bow ends by itself", () => {
  let s = createDuel();
  for (let i = 0; i < 200 && s.phase === "bow"; i++) s = step(s, IDLE, IDLE);
  assert.equal(s.phase, "fight");
});

test("kiMax option sets starting ki", () => {
  const s = createDuel({ kiMax: [125, 100] });
  assert.equal(s.fighters[0].ki, 125);
  assert.equal(s.fighters[0].kiMax, 125);
  assert.equal(s.fighters[1].ki, 100);
});

test("a fighter's custom windup replaces the default length", () => {
  let s = fightAt(70, { windups: [{ men: 30 }, {}] });
  let ticks = 0;
  do {
    s = step(s, ticks === 0 ? attack("men") : IDLE, IDLE);
    ticks++;
  } while (!has(s, "whiff") && ticks < 100);
  assert.equal(ticks, 30);
});

test("a commanding presence makes you flinch without spending ki", () => {
  let d = fightAt(40, { presence: [0, 3] });
  const ki = d.fighters[1].ki;
  let flinched = -1;
  for (let t = 0; t < 120 && flinched < 0; t++) {
    d = step(d, IDLE, BLOCK);
    if (d.events.some((e) => e.type === "shaken" && e.by === 0)) flinched = t;
  }
  assert.ok(flinched > 0 && flinched < 90, `flinched at ${flinched}`);
  assert.equal(d.fighters[1].ki, ki);
  assert.equal(d.fighters[0].stance, "shaken");
});

test("holding seme pushes back against a presence", () => {
  let d = fightAt(40, { presence: [0, 3] });
  for (let t = 0; t < 100; t++) d = step(d, { ...IDLE, seme: true }, BLOCK);
  assert.equal(d.fighters[0].stance, "seme");
  assert.equal(d.fighters[0].pressure, 0);
  assert.equal(d.fighters[1].pressure, 100);
});

test("a presence doesn't reach across the whole dojo", () => {
  let d = fightAt(SEME_RANGE + 20, { presence: [0, 3] });
  for (let t = 0; t < 120; t++) d = step(d, IDLE, IDLE);
  assert.equal(d.fighters[0].pressure, 0);
});

test("a flinching fighter stops pressing", () => {
  let d = fightAt(40, { presence: [0, 3] });
  d.fighters[1].stance = "shaken";
  d.fighters[1].stanceTicks = 30;
  for (let t = 0; t < 20; t++) d = step(d, IDLE, IDLE);
  assert.equal(d.fighters[0].pressure, 0);
});

// Kiai: the spirit shout, while holding seme.
const SHOUT: FighterInput = { ...IDLE, seme: true, stomp: true };

function holdingSeme(ticks = 5): DuelState {
  let s = fightAt(40);
  for (let i = 0; i < ticks; i++) s = step(s, { ...IDLE, seme: true }, IDLE);
  return s;
}

test("stomping during seme shouts, for a jump in pressure and a cost in ki", () => {
  const before = holdingSeme();
  const after = step(before, SHOUT, IDLE);
  assert.ok(after.events.some((e) => e.type === "shout" && e.by === 0));
  assert.ok(Math.abs(after.fighters[1].pressure - (before.fighters[1].pressure + KIAI_PRESS + 1)) < 1e-9);
  assert.ok(Math.abs(after.fighters[0].ki - (before.fighters[0].ki - KIAI_COST - SEME_DRAIN)) < 1e-9);
});

test("a shout makes the opponent flinch sooner than just holding", () => {
  const ticksToFlinch = (shout: boolean) => {
    let s = fightAt(40);
    for (let t = 1; t < 400; t++) {
      s = step(s, shout && t % 10 === 0 ? SHOUT : { ...IDLE, seme: true }, IDLE);
      if (s.events.some((e) => e.type === "shaken" && e.by === 1)) return t;
    }
    return Infinity;
  };
  assert.ok(ticksToFlinch(true) < ticksToFlinch(false) - 30);
});

test("you can't shout again until you've got your breath back", () => {
  let s = step(holdingSeme(), SHOUT, IDLE);
  s = step(s, SHOUT, IDLE);
  assert.equal(s.events.some((e) => e.type === "shout"), false);
  for (let i = 0; i < KIAI_COOLDOWN; i++) s = step(s, { ...IDLE, seme: true }, IDLE);
  s = step(s, SHOUT, IDLE);
  assert.ok(s.events.some((e) => e.type === "shout"));
});

test("you can't shout with too little ki", () => {
  const start = holdingSeme();
  start.fighters[0].ki = KIAI_COST - 1;
  assert.equal(step(start, SHOUT, IDLE).events.some((e) => e.type === "shout"), false);
});

test("a stomp outside seme is just a stomp", () => {
  const s = step(fightAt(40), { ...IDLE, stomp: true }, IDLE);
  assert.equal(s.events.some((e) => e.type === "shout"), false);
  assert.equal(s.fighters[1].pressure, 0);
});

test("striking out of seme with a stomp doesn't also shout", () => {
  const s = step(holdingSeme(), attack("men"), IDLE);
  assert.equal(s.events.some((e) => e.type === "shout"), false);
  assert.equal(s.fighters[0].stance, "windup");
});

test("a shout from too far away reaches nobody", () => {
  let s = fightAt(SEME_RANGE + 20);
  s = step(s, { ...IDLE, seme: true }, IDLE);
  s = step(s, SHOUT, IDLE);
  assert.equal(s.fighters[1].pressure, 0);
});

const homes = createDuel().fighters.map((f) => f.x);
const scored = (state: DuelState = fightAt(40)) => until(state, attack("men"), IDLE, ["clean"]);

test("after a point both walk back to their lines, with no jump", () => {
  let s = scored();
  assert.equal(s.phase, "point");
  let last = s.fighters.map((f) => f.x);
  let moved = false;
  while (s.phase === "point") {
    s = step(s, IDLE, IDLE);
    s.fighters.forEach((f, i) => {
      assert.ok(Math.abs(f.x - last[i]) <= RETURN_WALK + 0.001, `jumped ${f.x - last[i]}`);
      if (f.x !== last[i]) moved = true;
    });
    last = s.fighters.map((f) => f.x);
  }
  assert.ok(moved);
  assert.equal(s.phase, "fight");
  assert.deepEqual(s.fighters.map((f) => f.x), homes);
});

test("the walk back takes about as long as the walk, and no longer", () => {
  let s = scored();
  const farthest = Math.max(...s.fighters.map((f, i) => Math.abs(f.x - homes[i])));
  let ticks = 0;
  while (s.phase === "point") {
    s = step(s, IDLE, IDLE);
    ticks++;
  }
  assert.ok(ticks <= Math.ceil(farthest / RETURN_WALK) + RETURN_SETTLE + 1, `${ticks} ticks for ${farthest}`);
});

test("ki comes back on the walk, full by the time you're there", () => {
  let s = fightAt(40);
  s.fighters[1].ki = 20;
  s = scored(s);
  const start = s.fighters[1].ki;
  s = step(step(s, IDLE, IDLE), IDLE, IDLE);
  assert.ok(s.fighters[1].ki > start);
  while (s.phase === "point") s = step(s, IDLE, IDLE);
  assert.equal(s.fighters[1].ki, s.fighters[1].kiMax);
});

test("no input moves anyone on the walk back", () => {
  let s = scored();
  const a = step(s, IDLE, IDLE);
  const b = step(s, { ...IDLE, move: 1, attack: "men", stomp: true, dash: 1 }, { ...IDLE, move: -1, attack: "men" });
  assert.deepEqual(a.fighters.map((f) => f.x), b.fighters.map((f) => f.x));
});

function toClosing(): DuelState {
  let s = winPoint(fightAt(40));
  s.fighters[0].x = s.fighters[1].x - 40;
  s = until(s, attack("men"), IDLE, ["clean"]);
  return s;
}

test("the winner's known as soon as the last point's scored", () => {
  assert.equal(toClosing().winner, 0);
});

test("the last point also walks back, then closes with a ceremony before it's over", () => {
  let s = toClosing();
  while (s.phase === "point") s = step(s, IDLE, IDLE);
  assert.equal(s.phase, "closing");
  assert.equal(s.phaseTicks, CLOSING_TICKS);
  assert.deepEqual(s.fighters.map((f) => f.x), homes);
  for (let i = 0; i < CLOSING_TICKS - 1; i++) {
    s = step(s, IDLE, IDLE);
    assert.equal(s.phase, "closing");
  }
  s = step(s, IDLE, IDLE);
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 0);
});

test("the closing ceremony can be skipped, but nothing else can be", () => {
  let s = toClosing();
  assert.equal(skipClosing(s).phase, "point");
  while (s.phase === "point") s = step(s, IDLE, IDLE);
  assert.equal(skipClosing(s).phase, "over");
  assert.equal(skipClosing(createDuel()).phase, "bow");
});
