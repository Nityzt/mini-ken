import test from "node:test";
import assert from "node:assert/strict";
import { MATCH_TICKS } from "./constants.ts";
import { ruleTick, skipBow, startX, type DuelOptions, type DuelState, type FighterInput } from "./rules.ts";
import { directDuel } from "./test-support.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };

function nearTheEnd(points: [number, number], firstPoint: 0 | 1 | null, options: DuelOptions = {}): DuelState {
  const s = skipBow(directDuel(options));
  s.fighters[0].points = points[0];
  s.fighters[1].points = points[1];
  s.firstPoint = firstPoint;
  s.clock = 1;
  return s;
}

test("a match has two minutes, counted only while fighting", () => {
  assert.equal(MATCH_TICKS * 25, 120_000);
  let s = directDuel();
  assert.equal(s.clock, MATCH_TICKS);
  s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.clock, MATCH_TICKS, "not during the bow");
  s = skipBow(s);
  s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.clock, MATCH_TICKS - 1);
  for (const phase of ["zanshin", "point", "wakare", "crossing", "turning"] as const) {
    const paused = skipBow(directDuel());
    paused.phase = phase;
    paused.phaseTicks = 50;
    if (phase === "zanshin") paused.zanshin = { by: 0, attack: "men", target: "men", defenderStance: "guard", traveled: 0, needed: 500, left: 50, dir: 1 };
    if (phase === "crossing") paused.crossTo = [100, 50];
    assert.equal(ruleTick(paused, IDLE, IDLE).clock, MATCH_TICKS, phase);
  }
});

test("a lock uses up the clock", () => {
  const s = skipBow(directDuel());
  s.lock = { ticks: 0, balance: 0, pushing: [false, false], guarding: [false, false], pulling: [null, null] };
  s.fighters[0].stance = "tsuba";
  s.fighters[1].stance = "tsuba";
  assert.equal(ruleTick(s, IDLE, IDLE).clock, MATCH_TICKS - 1);
});

test("on time, whoever has a point wins", () => {
  const s = ruleTick(nearTheEnd([0, 1], 1), IDLE, IDLE);
  assert.equal(s.winner, 1);
  assert.equal(s.phase, "point");
  assert.ok(s.events.some((e) => e.type === "time"));
});

test("on time with a point each, whoever scored first wins", () => {
  assert.equal(ruleTick(nearTheEnd([1, 1], 0), IDLE, IDLE).winner, 0);
  assert.equal(ruleTick(nearTheEnd([1, 1], 1), IDLE, IDLE).winner, 1);
});

test("the first point is what's remembered", () => {
  const s = skipBow(directDuel());
  s.phase = "zanshin";
  s.zanshin = { by: 1, attack: "men", target: "men", defenderStance: "guard", traveled: 0, needed: 3, left: 50, dir: -1 };
  let next = ruleTick(s, IDLE, { ...IDLE, move: -1 });
  assert.equal(next.firstPoint, 1);
  next.phase = "zanshin";
  next.zanshin = { by: 0, attack: "men", target: "men", defenderStance: "guard", traveled: 0, needed: 3, left: 50, dir: 1 };
  next = ruleTick(next, { ...IDLE, move: 1 }, IDLE);
  assert.equal(next.firstPoint, 1);
});

test("on time with no points, they go again from their lines, and the next point wins", () => {
  let s = ruleTick(nearTheEnd([0, 0], null), IDLE, IDLE);
  assert.equal(s.winner, null);
  assert.equal(s.encho, true);
  assert.equal(s.clock, null);
  assert.ok(s.events.some((e) => e.type === "encho"));
  for (let i = 0; i < 300 && s.phase === "point"; i++) s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.phase, "fight");
  assert.equal(s.fighters[0].x, startX(0));
  s.phase = "zanshin";
  s.zanshin = { by: 0, attack: "men", target: "men", defenderStance: "guard", traveled: 0, needed: 3, left: 50, dir: 1 };
  s = ruleTick(s, { ...IDLE, move: 1 }, IDLE);
  assert.equal(s.winner, 0);
});

test("a strike already going when time runs out still lands, and decides it", () => {
  let s = nearTheEnd([0, 0], null);
  s.fighters[0].x = s.fighters[1].x - 40;
  s.fighters[0].stance = "windup";
  s.fighters[0].attack = "men";
  s.fighters[0].stanceTicks = 5;
  s.fighters[0].stompAge = 0;
  for (let i = 0; i < 4; i++) {
    s = ruleTick(s, IDLE, IDLE);
    assert.equal(s.encho, false, `tick ${i}`);
    assert.equal(s.phase, "fight");
  }
  s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.phase, "zanshin");
  for (let i = 0; i < 100 && s.phase === "zanshin"; i++) s = ruleTick(s, { ...IDLE, move: 1 }, IDLE);
  assert.equal(s.fighters[0].points, 1);
  assert.equal(s.winner, 0, "and the zanshin finishes before the result");
});

test("a stopped-short point doesn't count on time", () => {
  let s = nearTheEnd([0, 0], null);
  s.phase = "zanshin";
  s.zanshin = { by: 0, attack: "men", target: "men", defenderStance: "guard", traveled: 0, needed: 500, left: 1, dir: 1 };
  s.clock = 0;
  s = ruleTick(s, IDLE, IDLE);
  assert.equal(s.fighters[0].points, 0);
  assert.equal(s.encho, true, "so nobody has a point, and they go again");
});

test("someone pulling back in a lock gets to finish", () => {
  const s = nearTheEnd([0, 0], null);
  s.lock = { ticks: 0, balance: 0, pushing: [false, false], guarding: [false, false], pulling: [{ attack: "men", ticks: 5, total: 14 }, null] };
  s.fighters[0].stance = "tsuba";
  s.fighters[1].stance = "tsuba";
  assert.equal(ruleTick(s, IDLE, IDLE).encho, false);
});

test("a lock ends when time does", () => {
  const s = nearTheEnd([1, 0], 0);
  s.lock = { ticks: 0, balance: 0, pushing: [false, false], guarding: [false, false], pulling: [null, null] };
  s.fighters[0].stance = "tsuba";
  s.fighters[1].stance = "tsuba";
  const next = ruleTick(s, IDLE, IDLE);
  assert.equal(next.winner, 0);
  assert.equal(next.lock, null);
  assert.equal(next.fighters[1].stance, "guard");
});

test("a scripted fight has no clock", () => {
  const s = skipBow(directDuel({ noClock: true }));
  assert.equal(s.clock, null);
  assert.equal(ruleTick(s, IDLE, IDLE).clock, null);
});

test("sides are put back when time ends a match after a crossing", () => {
  const s = nearTheEnd([1, 0], 0);
  s.crossed = true;
  assert.equal(ruleTick(s, IDLE, IDLE).crossed, false);
});
