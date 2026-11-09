import test from "node:test";
import assert from "node:assert/strict";
import { playOut, versus, type StyleName } from "./balance-styles.ts";
import { createDuel, distance, ruleTick, skipBow, type DuelState, type FighterInput } from "./rules.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const SEEDS = 24;
const share = (r: { wins: number; losses: number }) => r.wins / (r.wins + r.losses || 1);
/** How `a` does against `b` over twice the matches, since a dozen more of them moves these figures a fair way. */
const pooled = (a: StyleName, b: StyleName) => {
  const one = versus(a, b, SEEDS);
  const other = versus(b, a, SEEDS);
  return { wins: one.wins + other.losses, losses: one.losses + other.wins };
};

test("nobody beats everybody", () => {
  const styles: StyleName[] = ["masher", "turtle", "runner", "reader", "baiter", "pressurer"];
  for (const a of styles) {
    const beaten = styles.filter((b) => b !== a && share(pooled(a, b)) > 0.55);
    assert.ok(beaten.length < styles.length - 1, `${a} beats ${beaten.join(", ")}`);
  }
});

test("mashing, hiding and doing nothing all lose to someone paying attention", () => {
  for (const style of ["masher", "turtle", "idle"] as StyleName[]) {
    const r = versus("reader", style, SEEDS);
    assert.ok(share(r) >= 0.65, `reader against ${style}: ${r.wins} to ${r.losses}`);
  }
});

test("running away and rushing back is no winning plan", () => {
  // It's a fair way to make a read harder, but it isn't better than paying attention, and plenty beats it.
  const r = pooled("runner", "reader");
  assert.ok(share(r) <= 0.5, `runner against reader: ${r.wins} to ${r.losses}`);
  for (const style of ["masher", "turtle", "baiter"] as StyleName[]) {
    const beat = versus(style, "runner", SEEDS);
    assert.ok(share(beat) >= 0.65, `${style} against runner: ${beat.wins} to ${beat.losses}`);
  }
});

test("baiting and reading are a fair fight", () => {
  const r = pooled("baiter", "reader");
  assert.ok(share(r) >= 0.3 && share(r) <= 0.7, `${r.wins} to ${r.losses}`);
});

test("bait alone isn't enough: someone who only ever counters is at best even with a reader, and loses to anyone who presses or baits back", () => {
  const reader = pooled("counterOnly", "reader");
  assert.ok(share(reader) <= 0.6, `counter-only against reader: ${reader.wins} to ${reader.losses}`);
  for (const style of ["baiter", "pressurer"] as StyleName[]) {
    const r = pooled("counterOnly", style);
    assert.ok(share(r) < 0.5, `counter-only against ${style}: ${r.wins} to ${r.losses}`);
  }
});

test("seme breaks someone hiding behind their guard", () => {
  const r = versus("pressurer", "turtle", SEEDS);
  assert.ok(share(r) >= 0.8, `${r.wins} to ${r.losses}`);
});

test("the clock is a backstop, not how matches end", () => {
  const pairs: [StyleName, StyleName][] = [["reader", "baiter"], ["reader", "pressurer"], ["baiter", "pressurer"], ["reader", "reader"], ["baiter", "baiter"]];
  for (const [a, b] of pairs) {
    const r = versus(a, b, SEEDS);
    assert.ok(r.onTime / r.matches < 0.25, `${a} against ${b}: ${r.onTime} of ${r.matches} on time`);
    assert.equal(r.unfinished, 0, `${a} against ${b}`);
    assert.ok(r.meanSeconds >= 12, `${a} against ${b}: ${r.meanSeconds.toFixed(0)}s`);
  }
});

test("anyone willing to strike always ends in a result", () => {
  const strikers: StyleName[] = ["masher", "runner", "reader", "baiter", "pressurer"];
  for (const a of strikers) for (const b of ["idle", "turtle", "counterOnly", "reader"] as StyleName[]) assert.equal(versus(a, b, 8).unfinished, 0, `${a} against ${b}`);
});

test("sitting on a lead doesn't reliably run out the clock", () => {
  // Reports the real figure for the owner, since this is also part of competitive kendo.
  let held = 0;
  const matches = 16;
  for (let seed = 1; seed <= matches; seed++) {
    const r = playOut("clockRunner", "reader", seed, (duel) => {
      duel.fighters[0].points = 1;
      duel.firstPoint = 0;
    });
    if (r.winner === 0) held++;
  }
  console.log(`a runner with the first point kept it to the clock ${held} of ${matches} times against the reader`);
  assert.ok(held / matches < 0.5, `${held} of ${matches}`);
});

const fight = (gap: number): DuelState => {
  const s = skipBow(createDuel());
  s.fighters[0].x = s.fighters[1].x - gap;
  return s;
};

test("the owner's first exchange: bait, parry, counter, parry, lock, hiki men", () => {
  let s = fight(44);
  const tick = (a: FighterInput, b: FighterInput) => (s = ruleTick(s, a, b));
  // A raises their shinai and holds it. B goes for the do that's showing.
  const raised: FighterInput = { ...IDLE, opening: "raise" };
  tick(raised, { ...IDLE, opening: "wrist", attack: "do", stomp: true });
  while (s.fighters[1].stance !== "windup") tick(raised, IDLE);
  // A was baiting: at the last moment it's a parry, not a men.
  while (s.fighters[1].stanceTicks > 5) tick(raised, { ...IDLE, stomp: true });
  tick({ ...IDLE, block: true, parry: true }, IDLE);
  while (s.fighters[1].stance === "windup") tick(IDLE, IDLE);
  assert.ok(s.events.some((e) => e.type === "parry" && e.by === 0));
  assert.equal(s.fighters[1].stance, "deflected");
  // A steps in a little and counters. B saw it coming.
  while (distance(s) > 40) tick({ ...IDLE, move: 1 }, IDLE);
  tick({ ...IDLE, attack: "men", stomp: true }, IDLE);
  assert.equal(s.fighters[0].countering, true);
  while (s.fighters[0].stanceTicks > 4) tick({ ...IDLE, stomp: true }, IDLE);
  tick(IDLE, { ...IDLE, block: true, parry: true });
  while (s.fighters[0].stance === "windup") tick(IDLE, IDLE);
  assert.ok(s.events.some((e) => e.type === "parry" && e.by === 1));
  // They're close, so they bind, and one of them wins it with hiki men.
  assert.ok(s.lock, "hilt to hilt");
  const start = s.lock!.ticks;
  tick({ ...IDLE, attack: "men" }, { ...IDLE, move: -1 });
  assert.ok(s.lock!.pulling[0], "hands drop");
  for (let i = 0; i < 100 && s.phase === "fight"; i++) tick({ ...IDLE, stomp: true }, s.lock ? { ...IDLE, move: -1 } : IDLE);
  assert.ok(start >= 0);
  assert.equal(s.phase, "zanshin");
  assert.equal(s.zanshin?.by, 0);
  for (let i = 0; i < 100 && s.phase === "zanshin"; i++) tick({ ...IDLE, move: s.zanshin!.dir }, IDLE);
  assert.equal(s.fighters[0].points, 1);
});

test("the owner's second exchange: a wrist shown, seme, seme back, a strike, and a parry", () => {
  let s = fight(44);
  const tick = (a: FighterInput, b: FighterInput) => (s = ruleTick(s, a, b));
  // A opens their wrist. B doesn't bite, and presses instead.
  tick({ ...IDLE, opening: "wrist" }, { ...IDLE, seme: true });
  assert.deepEqual([s.fighters[0].stance, s.fighters[1].stance], ["opening", "seme"]);
  for (let i = 0; i < 20; i++) tick({ ...IDLE, opening: "wrist" }, { ...IDLE, seme: true });
  assert.ok(s.fighters[0].pressure > 0);
  // A presses back, and neither gets anywhere.
  const pressure = s.fighters[0].pressure;
  for (let i = 0; i < 30; i++) tick({ ...IDLE, seme: true }, { ...IDLE, seme: true });
  assert.equal(s.fighters[0].pressure, pressure);
  // B attacks, and A parries.
  tick({ ...IDLE, seme: true }, { ...IDLE, opening: "drop", attack: "men", stomp: true });
  while (s.fighters[1].stance !== "windup") tick({ ...IDLE, seme: true }, IDLE);
  while (s.fighters[1].stanceTicks > 5) tick({ ...IDLE, seme: true }, { ...IDLE, stomp: true });
  tick({ ...IDLE, block: true, parry: true }, IDLE);
  while (s.fighters[1].stance === "windup") tick(IDLE, IDLE);
  assert.ok(s.events.some((e) => e.type === "parry" && e.by === 0));
  assert.equal(s.fighters[1].stance, "deflected");
});
