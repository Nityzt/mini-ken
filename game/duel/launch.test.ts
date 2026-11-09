import test from "node:test";
import assert from "node:assert/strict";
import { KI_RECOVERY, LAUNCH_COST, LAUNCH_STRIKE_EXTRA, LAUNCH_STRIKE_GRACE, LAUNCH_TICKS, SWING_COST } from "./constants.ts";
import { ATTACKS, createDuel, distance, exposedTargets, exposes, ruleTick, skipBow, type DuelState, type FighterInput } from "./rules.ts";

// Issue #14: a launch followed straight by a strike is one move, with no opening in between.

const IDLE: FighterInput = { move: 0, block: false, attack: null };
/** Where the launch lesson starts, and about where a real match starts too. */
const LAUNCH_GAP = 84;

function apart(gap: number): DuelState {
  const s = skipBow(createDuel());
  s.fighters[0].x = s.fighters[1].x - gap;
  return s;
}

const ticks = (s: DuelState, n: number, a: FighterInput, b: FighterInput = IDLE) => {
  for (let i = 0; i < n; i++) s = ruleTick(s, a, b);
  return s;
};

test("a strike pressed during a launch toward them starts at once, with no opening", () => {
  let s = ruleTick(apart(LAUNCH_GAP), { ...IDLE, dash: 1 }, IDLE);
  s = ruleTick(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  assert.equal(s.fighters[0].stance, "windup");
  assert.equal(s.fighters[0].attack, "men");
  assert.equal(s.fighters[0].opening, null);
  assert.ok(!s.events.some((e) => e.type === "noopening"));
});

test("launch, then strike and stomp, then slide through scores from launching distance", () => {
  let s = ruleTick(apart(LAUNCH_GAP), { ...IDLE, dash: 1 }, IDLE);
  s = ticks(s, 3, IDLE);
  s = ruleTick(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  for (let i = 0; i < 60 && s.phase === "fight"; i++) s = ruleTick(s, { ...IDLE, stomp: s.fighters[0].stanceTicks <= 3 }, IDLE);
  assert.equal(s.phase, "zanshin");
  for (let i = 0; i < 100 && s.phase === "zanshin"; i++) s = ruleTick(s, { ...IDLE, move: s.zanshin!.dir }, IDLE);
  assert.equal(s.fighters[0].points, 1);
});

test("it still works a moment after landing, but not long after", () => {
  const late = (wait: number) => {
    let s = ruleTick(apart(LAUNCH_GAP + 40), { ...IDLE, dash: 1 }, IDLE);
    s = ticks(s, wait, IDLE);
    return ruleTick(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  };
  assert.equal(late(LAUNCH_TICKS + LAUNCH_STRIKE_GRACE - 2).fighters[0].stance, "windup");
  const tooLate = late(LAUNCH_TICKS + LAUNCH_STRIKE_GRACE);
  assert.equal(tooLate.fighters[0].stance, "guard");
  assert.ok(tooLate.events.some((e) => e.type === "noopening"));
});

test("launching away doesn't give a strike without an opening", () => {
  let s = ruleTick(apart(60), { ...IDLE, dash: -1 }, IDLE);
  s = ruleTick(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
});

test("a launch strike shows what that strike always shows, not a chosen opening", () => {
  let s = ruleTick(apart(LAUNCH_GAP), { ...IDLE, dash: 1 }, IDLE);
  s = ruleTick(s, { ...IDLE, attack: "kote", stomp: true }, IDLE);
  assert.deepEqual(exposedTargets(s.fighters[0]), [exposes("kote", "chudan")]);
});

test("it costs the launch and the swing, and takes a little longer than the strike usually would", () => {
  let s = ruleTick(apart(LAUNCH_GAP), { ...IDLE, dash: 1 }, IDLE);
  s = ruleTick(s, { ...IDLE, attack: "men", stomp: true }, IDLE);
  // The launch's own tick is still plain guard, so it gets that tick's recovery.
  assert.equal(s.fighters[0].ki, 100 - LAUNCH_COST + KI_RECOVERY - SWING_COST);
  assert.equal(s.fighters[0].stanceTicks, ATTACKS.men.windup + LAUNCH_STRIKE_EXTRA - 1);
});

test("holding an opening through the launch doesn't make the strike wait for the opening's minimum", () => {
  let s = ruleTick(apart(LAUNCH_GAP), { ...IDLE, dash: 1, opening: "drop" }, IDLE);
  s = ruleTick(s, { ...IDLE, opening: "drop", attack: "men", stomp: true }, IDLE);
  assert.equal(s.fighters[0].stance, "windup");
  assert.deepEqual(exposedTargets(s.fighters[0]), ["men"], "and it shows what that opening showed");
});

test("someone blocking as the launch comes in still stops it", () => {
  let s = ruleTick(apart(LAUNCH_GAP), { ...IDLE, dash: 1 }, { ...IDLE, block: true });
  s = ruleTick(s, { ...IDLE, attack: "men", stomp: true }, { ...IDLE, block: true });
  for (let i = 0; i < 60 && s.phase === "fight" && !s.events.some((e) => e.type === "blocked" || e.type === "lock"); i++) s = ruleTick(s, { ...IDLE, stomp: true }, { ...IDLE, block: true });
  assert.equal(s.phase, "fight");
  assert.equal(s.fighters[1].points + s.fighters[0].points, 0);
  assert.ok(distance(s) > 0);
});
