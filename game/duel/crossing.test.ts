import test from "node:test";
import assert from "node:assert/strict";
import { CROSS_CLEAN_WINDOW, CROSS_GAP, CROSS_SETTLE, CROSS_WRONG_WINDOW, RING_MAX, RING_MIN } from "./constants.ts";
import { createDuel, distance, faceDir, screenX, skipBow, startX, step, type AttackKind, type DuelState, type FighterInput } from "./rules.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const swing = (attack: AttackKind): FighterInput => ({ ...IDLE, attack, stomp: true });
const STOMP: FighterInput = { ...IDLE, stomp: true };

function fightAt(dist: number, options?: Parameters<typeof createDuel>[0], mid = (RING_MIN + RING_MAX) / 2): DuelState {
  const duel = skipBow(createDuel(options));
  duel.fighters[0].x = mid - dist / 2;
  duel.fighters[1].x = mid + dist / 2;
  return duel;
}
const has = (s: DuelState, type: string) => s.events.some((e) => e.type === type);

/** Fighter 1 swings a men with this long a windup. Fighter 0 swings this, starting so it lands with `left` ticks of theirs to go. */
function meet(attack: AttackKind, left: number, windup = 40): DuelState {
  const mine = 8;
  let s = fightAt(40, { windups: [{ [attack]: mine }, { men: windup }] });
  s = step(s, IDLE, swing("men"));
  for (let i = 0; i < 80 && s.phase === "fight" && s.fighters[1].stance === "windup"; i++) {
    const go = s.fighters[0].stance === "guard" && s.fighters[1].stanceTicks === left + mine;
    s = step(s, go ? swing(attack) : STOMP, STOMP);
    if (s.events.some((e) => ["cross", "hit", "blocked"].includes(e.type))) return s;
  }
  return s;
}
function crossed(): DuelState {
  let s = step(fightAt(40, { windups: [{ men: 8 }, { men: 8 }] }), swing("men"), swing("men"));
  for (let i = 0; i < 20 && s.phase === "fight"; i++) s = step(s, STOMP, STOMP);
  assert.equal(s.phase, "crossing");
  return s;
}
function afterCross(state = crossed()): DuelState {
  let s = state;
  for (let i = 0; i < 200 && s.phase !== "fight"; i++) s = step(s, IDLE, IDLE);
  return s;
}

test("both striking at once: nobody scores, and both carry on past each other", () => {
  const s = crossed();
  assert.ok(has(s, "cross"));
  assert.deepEqual(s.fighters.map((f) => f.points), [0, 0]);
  assert.equal(s.events.filter((e) => e.type === "kiai").length, 2);
});

test("a strike landing as theirs is about to is a crossing, even on an open target", () => {
  const s = meet("kote", CROSS_CLEAN_WINDOW);
  assert.ok(has(s, "cross"));
  assert.equal(s.phase, "crossing");
});

test("answering a tell in good time still scores", () => {
  const s = meet("kote", CROSS_CLEAN_WINDOW + 8);
  assert.ok(has(s, "hit"));
  assert.equal(s.phase, "zanshin");
});

test("the wrong target, when they're nearly there too, is a crossing rather than a block", () => {
  const s = meet("men", CROSS_WRONG_WINDOW);
  assert.ok(has(s, "cross"));
});

test("the wrong target, long before theirs arrives, is still blocked", () => {
  const s = meet("men", CROSS_WRONG_WINDOW + 8);
  assert.ok(has(s, "blocked"));
  assert.equal(s.phase, "fight");
});

test("both of them saying their strike out loud, even the one that hadn't landed yet", () => {
  const s = meet("kote", 2);
  assert.deepEqual(s.events.filter((e) => e.type === "kiai").map((e) => e.by).sort(), [0, 1]);
});

test("they walk through: nobody jumps, and no key does anything", () => {
  let s = crossed();
  let last = s.fighters.map((f) => screenX(s, f.x));
  const a = step(s, IDLE, IDLE);
  const b = step(s, { ...IDLE, move: -1, attack: "men", dash: -1 }, { ...IDLE, move: 1, attack: "men" });
  assert.deepEqual(a.fighters.map((f) => f.x), b.fighters.map((f) => f.x));
  while (s.phase !== "fight") {
    s = step(s, IDLE, IDLE);
    const now = s.fighters.map((f) => screenX(s, f.x));
    now.forEach((x, i) => assert.ok(Math.abs(x - last[i]) <= 3.01, `jumped ${x - last[i]}`));
    last = now;
  }
});

test("they end up on each other's side, facing each other, ready to go on", () => {
  const before = fightAt(40);
  const s = afterCross();
  assert.equal(s.phase, "fight");
  assert.equal(s.crossed, true);
  assert.deepEqual(s.fighters.map((f) => f.stance), ["guard", "guard"]);
  assert.ok(screenX(s, s.fighters[0].x) > screenX(s, s.fighters[1].x), "fighter 0 is now on the right");
  assert.equal(distance(s), CROSS_GAP);
  assert.equal(faceDir(s, 0), -1);
  assert.equal(faceDir(s, 1), 1);
  assert.equal(faceDir(before, 0), 1);
});

test("they turn for a moment before anyone can act", () => {
  let s = crossed();
  while (s.phase === "crossing") s = step(s, IDLE, IDLE);
  assert.equal(s.phase, "turning");
  assert.equal(s.phaseTicks, CROSS_SETTLE);
});

test("it can happen again and again, and two crossings put them back", () => {
  let s = afterCross();
  s.fighters[0].x = 110;
  s.fighters[1].x = 150;
  s = step({ ...s, options: { windups: [{ men: 8 }, { men: 8 }] } }, swing("men"), swing("men"));
  for (let i = 0; i < 20 && s.phase === "fight"; i++) s = step(s, STOMP, STOMP);
  assert.equal(s.phase, "crossing");
  s = afterCross(s);
  assert.equal(s.crossed, false);
  assert.ok(s.fighters[0].x < s.fighters[1].x);
});

test("at the edge of the ring, they still get past and nobody leaves it", () => {
  let s = step(fightAt(40, { windups: [{ men: 8 }, { men: 8 }] }, RING_MIN + 20), swing("men"), swing("men"));
  for (let i = 0; i < 20 && s.phase === "fight"; i++) s = step(s, STOMP, STOMP);
  assert.equal(s.phase, "crossing");
  while (s.phase !== "fight") {
    s = step(s, IDLE, IDLE);
    for (const f of s.fighters) assert.ok(f.x >= RING_MIN && f.x <= RING_MAX, `${f.x}`);
  }
  assert.equal(distance(s), CROSS_GAP);
});

test("from their new side the rules are the same: a strike scores, and zanshin carries on", () => {
  let s = afterCross();
  const gap = 40;
  const mid = (s.fighters[0].x + s.fighters[1].x) / 2;
  s.fighters[0].x = mid - gap / 2;
  s.fighters[1].x = mid + gap / 2;
  s = step(s, swing("men"), IDLE);
  for (let i = 0; i < 20 && s.phase === "fight"; i++) s = step(s, STOMP, IDLE);
  assert.equal(s.phase, "zanshin");
  assert.equal(s.crossed, true);
});

test("a point sends both back to their own lines, walking, however many times they've crossed", () => {
  let s = afterCross();
  const gap = 40;
  const mid = (s.fighters[0].x + s.fighters[1].x) / 2;
  s.fighters[0].x = mid - gap / 2;
  s.fighters[1].x = mid + gap / 2;
  s = step(s, swing("men"), IDLE);
  for (let i = 0; i < 20 && s.phase === "fight"; i++) s = step(s, STOMP, IDLE);
  while (s.phase === "zanshin") {
    const before = s.fighters.map((f) => screenX(s, f.x));
    s = step(s, { ...IDLE, move: s.zanshin!.dir }, IDLE);
    if (s.phase === "point") {
      assert.equal(s.crossed, false);
      s.fighters.forEach((f, i) => assert.ok(Math.abs(screenX(s, f.x) - before[i]) <= 3.01, "no jump as the sides are sorted out"));
    }
  }
  while (s.phase === "point") s = step(s, IDLE, IDLE);
  assert.equal(s.phase, "fight");
  assert.equal(s.crossed, false);
  assert.equal(s.fighters[0].x, startX(0));
  assert.equal(s.fighters[1].x, startX(1));
});

test("a pulled-back strike doesn't cross: it's going the other way", () => {
  let s = step(fightAt(18, { windups: [{}, { men: 8 }] }), IDLE, IDLE);
  assert.ok(s.lock);
  s = step(s, swing("men"), swing("men"));
  for (let i = 0; i < 40 && s.phase === "fight" && !s.events.some((e) => e.type === "kiai"); i++) s = step(s, STOMP, STOMP);
  assert.notEqual(s.phase, "crossing");
});

test("too close or out of reach is never a crossing", () => {
  let far = step(fightAt(80, { windups: [{ men: 8 }, { men: 8 }] }), swing("men"), swing("men"));
  for (let i = 0; i < 20 && far.fighters[0].stance === "windup"; i++) far = step(far, STOMP, STOMP);
  assert.equal(far.phase, "fight");
  assert.ok(has(far, "whiff"));
});

test("lessons don't cross: both just recover", () => {
  let s = step(fightAt(40, { basics: true, windups: [{ men: 8 }, { men: 8 }] }), swing("men"), swing("men"));
  for (let i = 0; i < 20 && s.fighters[0].stance === "windup"; i++) s = step(s, STOMP, STOMP);
  assert.equal(s.phase, "fight");
  assert.equal(s.crossed, false);
});
