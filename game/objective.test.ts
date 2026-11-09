import test from "node:test";
import assert from "node:assert/strict";
import { measureText } from "./art/font.ts";
import { FULL_GEAR } from "./art/kendoka.ts";
import { STAGE_W } from "./core/scale.ts";
import { currentObjective } from "./objective.ts";
import { LADDER } from "./progress.ts";
import { createRunState, type RunState } from "./run-state.ts";

const start = createRunState();

test("the first day tells you what to do next, step by step", () => {
  assert.match(currentObjective(start), /Momo/);
  assert.match(currentObjective({ ...start, metSenpai: true }), /gi/);
  assert.match(currentObjective({ ...start, metSenpai: true, gi: true }), /Sensei/);
  const drilling: RunState = { ...start, metSenpai: true, gi: true, gear: { ...start.gear, shinai: true } };
  assert.match(currentObjective(drilling), /drill/);
  const tested: RunState = { ...drilling, senseiRounds: 1, gear: { ...drilling.gear, tare: true } };
  assert.match(currentObjective(tested), /senpai/);
  const nextLesson: RunState = { ...tested, gear: { ...tested.gear, do: true } };
  assert.match(currentObjective(nextLesson), /Sensei/);
});

test("once you're armored and Ren's had their one point, it follows the ladder", () => {
  const run: RunState = { ...start, metSenpai: true, gi: true, senseiRounds: 3, trained: true, gear: FULL_GEAR, gaze: true };
  assert.match(currentObjective(run), /city/i);
});

test("with everything open, it points at the Grand Taikai, and then there's nothing left to chase", () => {
  const everything: RunState = {
    ...start, metSenpai: true, gi: true, senseiRounds: 3, trained: true, gear: FULL_GEAR, seme: true, linePasses: 3, bonusKi: 200, dan: 3, shinaiQuest: "returned",
    beaten: ["aki", "raccoon", "goose", "heron", "otter", "radish"],
  };
  assert.match(currentObjective(everything), /Grand Taikai/);
  assert.equal(currentObjective({ ...everything, champion: true }), "");
});

test("it walks you through a grading: ask, then use the ticket", () => {
  const run: RunState = { ...start, metSenpai: true, gi: true, senseiRounds: 3, trained: true, gear: FULL_GEAR, gaze: true, linePasses: 3, waza: true, beaten: ["raccoon"] };
  assert.match(currentObjective(run), /grad/i);
  assert.match(currentObjective({ ...run, ticket: 1, money: 500 }), /ticket/i);
  assert.match(currentObjective({ ...run, ticket: 1 }), /kensen/);
  assert.ok(measureText(currentObjective({ ...run, ticket: 1, money: 500 })) <= STAGE_W - 14);
  assert.ok(measureText(currentObjective({ ...run, ticket: 3, dan: 2, money: 199 })) <= STAGE_W - 14);
  assert.ok(measureText(currentObjective({ ...run, dan: 2, beaten: ["raccoon", "goose", "heron", "otter"] })) <= STAGE_W - 14);
});

test("it always fits on one line", () => {
  const run: RunState = { ...start, metSenpai: true, gi: true, senseiRounds: 3, trained: true, gear: FULL_GEAR };
  for (const beaten of [[], ["aki"], ["aki", "raccoon"], ["aki", "raccoon", "goose"]] as RunState["beaten"][]) {
    for (const bonusKi of [0, 30, 60, 90]) {
      assert.ok(measureText(currentObjective({ ...run, beaten, bonusKi })) <= STAGE_W - 14, currentObjective({ ...run, beaten, bonusKi }));
    }
  }
  assert.ok(LADDER.length > 0);
});
