import test from "node:test";
import assert from "node:assert/strict";
import { COUNTER_TICKS, COUNTER_WINDUP, DEFLECT_TICKS, PARRY_COOLDOWN, PARRY_WINDOW, RING_MAX, RING_MIN } from "./constants.ts";
import { parryShine } from "./poses.ts";
import { rivalConfig, type RivalStyle } from "./rival.ts";
import { createDuel, exposedTargets, skipBow, ruleTick as step, type AttackKind, type DuelState, type FighterInput } from "./rules.ts";

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

// The shine on their tip is how anyone gets to parry on reaction, so these play out the fight from what the player can see.
const REAL_STYLES: RivalStyle[] = ["steady", "fierce", "sneaky", "patient", "relentless", "master", "sensei", "fury", "torrent", "shadow", "iron", "jodan", "nito", "restless", "wall", "exact"];

/** Waits for the shine, reacts this many ticks after seeing it, and returns whatever happened. */
function reactToShine(reaction: number, attack: AttackKind, windup: number): DuelState {
  let s = fightAt(40, { windups: [{}, { [attack]: windup }] });
  s = step(s, IDLE, { ...IDLE, attack, stomp: true });
  let seen = 0;
  while (s.fighters[1].stance === "windup") {
    if (parryShine(s, 1) > 0) seen++;
    s = step(s, seen === reaction ? TAP : IDLE, { ...IDLE, stomp: s.fighters[1].stanceTicks <= 3 });
    if (s.events.some((e) => e.type === "parry" || e.type === "hit" || e.type === "blocked")) return s;
  }
  return s;
}

test("anyone reacting to the shine in good time parries every rival's every strike", () => {
  for (const style of REAL_STYLES) {
    const { tell } = rivalConfig(0, style);
    for (const attack of ["men", "kote", "bigMen"] as const) {
      // Seeing it on the first tick counts as a reaction of one. A tick is 25ms at the duel's tempo, so 9 to 17 is 225 to 425ms.
      for (let reaction = 9; reaction <= 17; reaction++) {
        const s = reactToShine(reaction, attack, tell[attack]);
        assert.ok(s.events.some((e) => e.type === "parry"), `${style} ${attack} reacting after ${reaction} ticks`);
      }
    }
  }
});

test("reacting far too late to the shine gets hit", () => {
  assert.ok(reactToShine(24, "men", 30).events.some((e) => e.type === "hit"));
});

test("the shine reaches full brightness on the first tick a tap would work", () => {
  let s = fightAt(40, { windups: [{}, { men: 30 }] });
  s = step(s, IDLE, SWING);
  let last = 0;
  while (s.fighters[1].stance === "windup") {
    const left = s.fighters[1].stanceTicks;
    const shine = parryShine(s, 1);
    assert.ok(shine >= last, "it never dims on the way in");
    last = shine;
    const works = swingAtPlayer(left).events.some((e) => e.type === "parry");
    assert.equal(shine === 1, works, `${left} ticks left`);
    s = step(s, IDLE, { ...IDLE, stomp: left <= 3 });
  }
});

test("nothing shines unless a strike is coming that could be parried", () => {
  const standing = fightAt(40);
  assert.equal(parryShine(standing, 1), 0);

  // Long before it lands, it's only the tell.
  const early = step(fightAt(40, { windups: [{}, { men: 40 }] }), IDLE, SWING);
  assert.equal(parryShine(early, 1), 0);

  // A pull out of a lock is answered by holding, and a basic lesson has no parry to teach.
  const pulling = step(fightAt(40, { windups: [{}, { men: 8 }] }), IDLE, SWING);
  pulling.fighters[1].hiki = true;
  assert.equal(parryShine(pulling, 1), 0);
  assert.equal(parryShine(step(fightAt(40, { basics: true, windups: [{}, { men: 8 }] }), IDLE, SWING), 1), 0);

  const paused = step(fightAt(40, { windups: [{}, { men: 8 }] }), IDLE, SWING);
  paused.phase = "point";
  assert.equal(parryShine(paused, 1), 0);
});
