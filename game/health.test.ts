import test from "node:test";
import assert from "node:assert/strict";
import { createRunState, type RunState } from "./run-state.ts";
import { heldObjective, HP_MAX, HP_PER_POINT, hpAfterMatch, knockOut, matchHurts, reclaim, regen, rest, whoHolds } from "./health.ts";
import { parseRun } from "./save.ts";

const away = (over: Partial<RunState> = {}): RunState => ({ ...createRunState(), node: "goose", ...over });

test("a new run starts at full health", () => {
  assert.equal(createRunState().hp, HP_MAX);
});

test("every point conceded costs health, so a rematch straight after a loss isn't free", () => {
  assert.equal(hpAfterMatch(HP_MAX, 2, false), HP_MAX - 2 * HP_PER_POINT);
  const third = hpAfterMatch(hpAfterMatch(hpAfterMatch(HP_MAX, 2, false), 2, false), 2, false);
  assert.ok(third < HP_MAX / 2);
});

test("losing enough in a row takes you down", () => {
  let hp = HP_MAX;
  let losses = 0;
  while (hp > 0) {
    hp = hpAfterMatch(hp, 2, false);
    losses++;
  }
  assert.equal(losses, 3);
});

test("winning can leave you hurt, but never knocks you out", () => {
  assert.equal(hpAfterMatch(10, 1, true), 1);
  assert.equal(hpAfterMatch(10, 1, false), 0);
});

test("only fights away from home cost health", () => {
  assert.equal(matchHurts(away(), { cup: false, stage: null }), true);
  assert.equal(matchHurts(away(), { cup: false, stage: "recommendation" }), true);
  assert.equal(matchHurts(away({ node: "pinecone" }), { cup: false, stage: null }), false);
  assert.equal(matchHurts(away(), { cup: true, stage: null }), false);
  assert.equal(matchHurts(away(), { cup: false, stage: "tachiai" }), false);
});

test("you heal a little over time, and all the way at home", () => {
  assert.equal(regen(away({ hp: 40 })).hp, 41);
  const full = away();
  assert.equal(regen(full), full);
  assert.equal(rest(away({ hp: 3 })).hp, HP_MAX);
  assert.equal(rest(full), full);
});

test("going down sends you home, healed, and whoever beat you keeps half your money", () => {
  const { run, taken } = knockOut(away({ hp: 0, money: 101 }), "goose");
  assert.equal(run.node, "pinecone");
  assert.equal(run.hp, HP_MAX);
  assert.equal(taken, 50);
  assert.equal(run.money, 51);
  assert.equal(run.held.goose, 50);
});

test("nobody can take money you haven't got", () => {
  const { run, taken } = knockOut(away({ hp: 0, money: 0 }), "goose");
  assert.equal(taken, 0);
  assert.deepEqual(run.held, {});
});

test("going down to the same person twice adds up, and none of it is ever gone for good", () => {
  const once = knockOut(away({ money: 100 }), "goose").run;
  const twice = knockOut({ ...once, node: "goose" }, "goose").run;
  assert.equal(twice.held.goose, 75);
  assert.equal(twice.money, 25);
  const back = reclaim(twice, "goose");
  assert.equal(back.amount, 75);
  assert.equal(back.run.money, 100);
  assert.equal(back.run.held.goose, undefined);
});

test("beating someone who isn't holding anything changes nothing", () => {
  const run = away({ money: 30 });
  const back = reclaim(run, "heron");
  assert.equal(back.amount, 0);
  assert.equal(back.run, run);
});

test("your health and what's been taken survive a refresh, and older saves start healthy", () => {
  const run = away({ hp: 37, held: { goose: 12 }, visited: ["goose"], talked: { "hana:chat": 2 } });
  const saved = parseRun(JSON.parse(JSON.stringify(run)));
  assert.equal(saved?.hp, 37);
  assert.deepEqual(saved?.held, { goose: 12 });
  assert.deepEqual(saved?.visited, ["goose"]);
  assert.deepEqual(saved?.talked, { "hana:chat": 2 });
  const old = JSON.parse(JSON.stringify(run));
  delete old.hp;
  delete old.held;
  assert.equal(parseRun(old)?.hp, HP_MAX);
  assert.deepEqual(parseRun(old)?.held, {});
  assert.equal(parseRun({ ...old, hp: 9999 })?.hp, HP_MAX);
});

test("people and gangs both have a name to chase", () => {
  assert.equal(whoHolds("goose"), "Hana");
  assert.equal(whoHolds("market"), "the Alley Cats at Market Street");
});

test("the next thing to do says who's got your money", () => {
  assert.equal(heldObjective(away()), null);
  assert.equal(heldObjective(away({ held: { goose: 40 } })), "Get your 40 kensen back from Hana");
});
