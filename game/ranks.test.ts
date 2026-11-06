import test from "node:test";
import assert from "node:assert/strict";
import { FULL_GEAR } from "./art/kendoka.ts";
import { danLabel, impliedDan, kyuOf, levelKi, levelOf, MAX_DAN, personDan, presenceOf, rankLabel, xpToNextLevel } from "./ranks.ts";
import { createRunState, gainXp, playerKiMax, recordCup, recordGangWin, recordLinePass, recordLoss, recordWin, type RunState } from "./run-state.ts";

const start = createRunState();
const withGear = (pieces: (keyof typeof FULL_GEAR)[]): RunState => ({ ...start, gear: { ...start.gear, ...Object.fromEntries(pieces.map((p) => [p, true])) } });

test("you start at 6th kyu", () => {
  assert.equal(kyuOf(start), 6);
  assert.equal(rankLabel(start), "6th kyu");
});

test("each armor piece you earn is a step up the kyu ranks, and the shinai isn't one", () => {
  assert.equal(kyuOf(withGear(["shinai"])), 6);
  assert.equal(kyuOf(withGear(["shinai", "tare"])), 5);
  assert.equal(kyuOf(withGear(["shinai", "tare", "do"])), 4);
  assert.equal(kyuOf(withGear(["shinai", "tare", "do", "men"])), 3);
  assert.equal(kyuOf(withGear(["shinai", "tare", "do", "men", "kote"])), 2);
});

test("beating a senpai makes you 1st kyu", () => {
  const armored = withGear(["shinai", "tare", "do", "men", "kote"]);
  assert.equal(rankLabel({ ...armored, beaten: ["bo"] }), "1st kyu");
  assert.equal(rankLabel({ ...armored, beaten: ["raccoon"] }), "2nd kyu");
});

test("a dan outranks everything before it", () => {
  assert.equal(rankLabel({ ...start, dan: 1 }), "1st dan");
  assert.equal(rankLabel({ ...start, dan: 2 }), "2nd dan");
  assert.equal(rankLabel({ ...start, dan: MAX_DAN }), "3rd dan");
  assert.equal(danLabel(6), "6th dan");
});

test("saves from before grading existed keep what they've already earned", () => {
  assert.equal(impliedDan({ ...start, beaten: ["raccoon"] }), 0);
  assert.equal(impliedDan({ ...start, beaten: ["goose"] }), 1);
  assert.equal(impliedDan({ ...start, beaten: ["goose", "heron"] }), 2);
  assert.equal(impliedDan({ ...start, beaten: ["radish"] }), 3);
  assert.equal(impliedDan({ ...start, cups: ["raccoon"] }), 1);
});

test("the people at the top outrank the senpai, and only serious rank carries a presence", () => {
  assert.ok(personDan("sensei") > personDan("aki"));
  assert.ok(personDan("examiner") > personDan("sensei"));
  assert.equal(presenceOf(personDan("aki")), 0);
  assert.ok(presenceOf(personDan("momo")) > 0);
  assert.ok(presenceOf(personDan("examiner")) > presenceOf(personDan("radish")));
  assert.ok(presenceOf(8) <= 1);
});

test("levels get further apart, and each one is worth 1 ki", () => {
  assert.equal(levelOf(0), 1);
  assert.equal(levelOf(49), 1);
  assert.equal(levelOf(50), 2);
  assert.equal(levelOf(149), 2);
  assert.equal(levelOf(150), 3);
  assert.equal(levelKi(0), 0);
  assert.equal(levelKi(150), 2);
  assert.equal(xpToNextLevel(120), 30);
});

test("levels show up in your ki", () => {
  assert.equal(playerKiMax({ ...start, xp: 150 }) - playerKiMax(start), 2);
});

test("all practice counts: wins, losses, the line drill, street fights and cups, even repeats", () => {
  const won = recordWin({ ...start, node: "raccoon" });
  assert.ok(won.xp > 0);
  assert.ok(recordWin(won).xp > won.xp, "a repeat win still counts");
  assert.ok(recordLoss({ ...start, node: "raccoon" }).xp > 0);
  assert.ok(recordLoss(start).xp < won.xp, "a loss teaches less than a win");
  assert.ok(recordLinePass(start).xp > 0);
  const fought = recordGangWin(start, "market");
  assert.ok(recordGangWin(fought, "market").xp > fought.xp);
  assert.equal(recordGangWin(fought, "market").bonusKi, fought.bonusKi, "only the first pays ki");
  const cup = recordCup(start, "pinecone");
  assert.ok(recordCup(cup, "pinecone").xp > cup.xp);
  assert.equal(recordCup(cup, "pinecone").bonusKi, cup.bonusKi, "only the first pays ki");
});

test("gaining xp adds up and changes nothing else", () => {
  assert.deepEqual(gainXp({ ...start, xp: 10 }, 5), { ...start, xp: 15 });
});
