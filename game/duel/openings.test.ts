import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK_DRAIN, KI_RECOVERY, OPENING_DRAIN, OPENING_MIN, OPENING_START_KI } from "./constants.ts";
import { ATTACKS, createDuel, distance, exposedTargets, openingTarget, ruleTick, skipBow, step, type AttackKind, type DuelState, type FighterInput, type Opening } from "./rules.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };

function inRange(gap = 40, options = {}): DuelState {
  const s = skipBow(createDuel(options));
  s.fighters[0].x = s.fighters[1].x - gap;
  return s;
}

const ticks = (s: DuelState, n: number, a: FighterInput, b: FighterInput = IDLE) => {
  for (let i = 0; i < n; i++) s = ruleTick(s, a, b);
  return s;
};

test("a strike with no opening does nothing", () => {
  const s = ruleTick(inRange(), { ...IDLE, attack: "men", stomp: true }, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
  assert.equal(s.fighters[0].attack, null);
  assert.equal(s.fighters[0].ki, s.fighters[0].kiMax, "and costs nothing");
});

test("any opening can lead to any strike", () => {
  for (const opening of ["raise", "wrist", "drop"] as Opening[]) {
    for (const attack of ["men", "kote", "do"] as AttackKind[]) {
      let s = ticks(inRange(), OPENING_MIN, { ...IDLE, opening });
      s = ruleTick(s, { ...IDLE, opening, attack }, IDLE);
      assert.equal(s.fighters[0].stance, "windup", `${opening} into ${attack}`);
      assert.equal(s.fighters[0].attack, attack);
    }
  }
});

test("each opening leaves only its own target exposed, until the strike's landed", () => {
  const shows: Record<Opening, string> = { raise: "do", wrist: "kote", drop: "men" };
  for (const opening of ["raise", "wrist", "drop"] as Opening[]) {
    let s = ruleTick(inRange(), { ...IDLE, opening }, IDLE);
    assert.equal(s.fighters[0].stance, "opening");
    assert.deepEqual(exposedTargets(s.fighters[0]), [shows[opening]]);
    s = ticks(s, OPENING_MIN, { ...IDLE, opening });
    s = ruleTick(s, { ...IDLE, opening, attack: "men" }, IDLE);
    assert.deepEqual(exposedTargets(s.fighters[0]), [shows[opening]], "the strike doesn't change it");
  }
});

test("a strike takes its usual time once it starts, however the opening was held", () => {
  let s = ticks(inRange(), OPENING_MIN, { ...IDLE, opening: "raise" });
  s = ruleTick(s, { ...IDLE, opening: "raise", attack: "men" }, IDLE);
  assert.equal(s.fighters[0].stanceTicks, ATTACKS.men.windup - 1);
});

test("an opening's windups override only applies to strikes with no opening", () => {
  let s = ticks(inRange(40, { windups: [{ men: 60 }, {}] }), OPENING_MIN, { ...IDLE, opening: "raise" });
  s = ruleTick(s, { ...IDLE, opening: "raise", attack: "men" }, IDLE);
  assert.equal(s.fighters[0].stanceTicks, ATTACKS.men.windup - 1);
});

test("a strike pressed too soon waits for the minimum, and fires even if the key's let go", () => {
  let s = ruleTick(inRange(), { ...IDLE, opening: "wrist", attack: "kote", stomp: true }, IDLE);
  assert.equal(s.fighters[0].stance, "opening");
  assert.equal(s.fighters[0].queued, "kote");
  for (let i = 1; i < OPENING_MIN; i++) {
    s = ruleTick(s, IDLE, IDLE);
    assert.equal(s.fighters[0].stance, "opening", `tick ${i}`);
  }
  s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.fighters[0].stance, "windup");
  assert.equal(s.fighters[0].attack, "kote");
});

test("a quick tap of opening, strike and stomp together still lands clean", () => {
  let s = ruleTick(inRange(), { ...IDLE, opening: "raise", attack: "do", stomp: true }, IDLE);
  for (let i = 0; i < 60 && s.phase === "fight"; i++) s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.phase, "zanshin");
});

test("letting go with nothing queued goes straight back to guard", () => {
  let s = ruleTick(inRange(), { ...IDLE, opening: "drop" }, IDLE);
  s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
  assert.equal(s.fighters[0].opening, null);
});

test("an opening cancels into a block, a parry or seme at any moment, and a queued strike goes with it", () => {
  const start = () => ruleTick(inRange(), { ...IDLE, opening: "raise", attack: "men" }, IDLE);
  assert.equal(ruleTick(start(), { ...IDLE, block: true }, IDLE).fighters[0].stance, "block");
  assert.equal(ruleTick(start(), { ...IDLE, opening: "raise", block: true }, IDLE).fighters[0].stance, "block");
  assert.equal(ruleTick(start(), { ...IDLE, opening: "raise", block: true, parry: true }, IDLE).fighters[0].stance, "parry");
  assert.equal(ruleTick(start(), { ...IDLE, opening: "raise", seme: true }, IDLE).fighters[0].stance, "seme");
  for (const s of [ruleTick(start(), { ...IDLE, block: true }, IDLE), ruleTick(start(), { ...IDLE, seme: true }, IDLE)]) assert.equal(s.fighters[0].queued, null);
});

test("seme cancels into an opening", () => {
  let s = ruleTick(inRange(), { ...IDLE, seme: true }, IDLE);
  assert.equal(s.fighters[0].stance, "seme");
  s = ruleTick(s, { ...IDLE, opening: "wrist" }, IDLE);
  assert.equal(s.fighters[0].stance, "opening");
});

test("switching openings restarts the minimum", () => {
  let s = ticks(inRange(), OPENING_MIN, { ...IDLE, opening: "raise" });
  s = ruleTick(s, { ...IDLE, opening: "drop", attack: "men" }, IDLE);
  assert.equal(s.fighters[0].stance, "opening");
  assert.equal(s.fighters[0].opening, "drop");
  assert.deepEqual(exposedTargets(s.fighters[0]), ["men"]);
});

test("you can walk and launch in an opening", () => {
  const walked = ruleTick(inRange(80), { ...IDLE, opening: "raise", move: 1 }, IDLE);
  assert.ok(distance(walked) < 80);
  const launched = ruleTick(ruleTick(inRange(80), { ...IDLE, opening: "raise" }, IDLE), { ...IDLE, opening: "raise", dash: 1 }, IDLE);
  assert.ok(launched.fighters[0].launchTicks > 0);
  assert.ok(launched.fighters[0].ki < launched.fighters[0].kiMax, "and launching costs ki");
});

test("holding an opening or a block drains ki slowly, even when nothing touches you", () => {
  const opened = ticks(inRange(), 20, { ...IDLE, opening: "raise" });
  assert.ok(Math.abs(opened.fighters[0].ki - (100 - 20 * OPENING_DRAIN)) < 1e-6);
  const blocked = ticks(inRange(), 20, { ...IDLE, block: true });
  assert.ok(Math.abs(blocked.fighters[0].ki - (100 - 20 * BLOCK_DRAIN)) < 1e-6);
  assert.ok(OPENING_DRAIN > BLOCK_DRAIN);
});

test("plain guard is the only place ki comes back, and walking in it counts", () => {
  const tired = (stance: FighterInput) => {
    const s = inRange(100);
    s.fighters[0].ki = 50;
    return ticks(s, 10, stance).fighters[0].ki;
  };
  assert.ok(Math.abs(tired(IDLE) - (50 + 10 * KI_RECOVERY)) < 1e-6);
  assert.ok(Math.abs(tired({ ...IDLE, move: -1 }) - (50 + 10 * KI_RECOVERY)) < 1e-6);
  assert.ok(tired({ ...IDLE, block: true }) < 50);
  assert.ok(tired({ ...IDLE, opening: "raise" }) < 50);
  assert.ok(tired({ ...IDLE, opening: "raise", move: -1 }) < 50);
});

test("a block that runs dry breaks", () => {
  const s = inRange();
  s.fighters[0].ki = BLOCK_DRAIN / 2;
  const next = ruleTick(s, { ...IDLE, block: true }, IDLE);
  assert.equal(next.fighters[0].stance, "broken");
  assert.ok(next.events.some((e) => e.type === "broken" && e.by === 0));
});

test("an opening that runs dry drops into guard, queued strike and all", () => {
  let s = ruleTick(inRange(), { ...IDLE, opening: "raise", attack: "men" }, IDLE);
  s.fighters[0].ki = OPENING_DRAIN / 2;
  s = ruleTick(s, { ...IDLE, opening: "raise" }, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
  assert.equal(s.fighters[0].queued, null);
});

test("an opening needs a little ki to start", () => {
  const s = inRange();
  s.fighters[0].ki = OPENING_START_KI - 1;
  assert.equal(ruleTick(s, { ...IDLE, opening: "raise" }, IDLE).fighters[0].stance, "guard");
});

test("a steady guard doesn't drain, for fights with a script to keep", () => {
  const s = ticks(inRange(40, { steadyGuard: [true, false] }), 200, { ...IDLE, block: true });
  assert.equal(s.fighters[0].ki, 100);
});

test("hitting what an opening shows scores, and hitting anything else doesn't", () => {
  const strikeAgainst = (attack: AttackKind) => {
    let s = ticks(inRange(), OPENING_MIN, { ...IDLE, opening: "wrist" }, { ...IDLE, opening: "raise" });
    s = ruleTick(s, { ...IDLE, opening: "wrist", attack, stomp: true }, { ...IDLE, opening: "raise" });
    for (let i = 0; i < 20 && s.phase === "fight"; i++) s = ruleTick(s, { ...IDLE, opening: "wrist" }, { ...IDLE, opening: "raise" });
    return s.phase;
  };
  assert.equal(strikeAgainst("do"), "zanshin");
  assert.equal(strikeAgainst("men"), "fight");
});

test("a parry's counter and a hiki strike need no opening", () => {
  const s = inRange();
  s.fighters[0].counterTicks = 10;
  assert.equal(ruleTick(s, { ...IDLE, attack: "men" }, IDLE).fighters[0].stance, "windup");
  const locked = inRange(18);
  locked.lock = { ticks: 0, balance: 0, pushing: [false, false], guarding: [false, false], pulling: [null, null] };
  locked.fighters[0].stance = "tsuba";
  locked.fighters[1].stance = "tsuba";
  assert.ok(ruleTick(locked, { ...IDLE, attack: "men" }, IDLE).lock?.pulling[0]);
});

test("a hard stance only shows what it can leave open", () => {
  assert.equal(openingTarget("drop", "jodan"), "kote");
  assert.equal(openingTarget("raise", "jodan"), "do");
  for (const opening of ["raise", "wrist", "drop"] as Opening[]) assert.equal(openingTarget(opening, "nito"), "do");
});

test("direct fighters strike straight from guard, as scripted partners do", () => {
  const s = ruleTick(inRange(40, { direct: [true, false] }), { ...IDLE, attack: "men" }, IDLE);
  assert.equal(s.fighters[0].stance, "windup");
});

test("a strike pressed as the opening key comes up still goes", () => {
  let s = ticks(inRange(), OPENING_MIN, { ...IDLE, opening: "raise" });
  s = ruleTick(s, { ...IDLE, attack: "men" }, IDLE);
  assert.equal(s.fighters[0].stance, "windup");
  assert.equal(s.fighters[0].attack, "men");
});

test("an opening and a strike tapped during a freeze aren't lost", () => {
  let s = inRange();
  s.freeze = 6;
  s = step(s, { ...IDLE, opening: "raise", attack: "men" }, IDLE);
  for (let i = 0; i < 12 && s.fighters[0].stance === "guard"; i++) s = step(s, IDLE, IDLE);
  assert.equal(s.fighters[0].stance, "opening");
  assert.equal(s.fighters[0].queued, "men");
});

test("an opening let go during a freeze with no strike doesn't come back afterwards", () => {
  let s = inRange();
  s.freeze = 6;
  s = step(s, { ...IDLE, opening: "raise" }, IDLE);
  for (let i = 0; i < 12; i++) s = step(s, IDLE, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
});
