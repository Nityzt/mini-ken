import { gradingOutcome, gradingReady } from "./grading.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { goalRow, isOpen, LADDER, ladderWindow, LINE_PASSES_TO_UNLOCK, lockedLine, lockFor, needs, needsSentence, newlyOpened, nextGoal, shortNeeds, standingLine, techniques, unmet, type UnlockId } from "./progress.ts";
import { measureText, wrapText } from "./art/font.ts";
import { STAGE_W } from "./core/scale.ts";
import { DIALOGUE_LINES, DIALOGUE_WIDTH } from "./scenes/content.ts";
import { createRunState, playerKiMax, recordCup, recordGangWin, recordLinePass, recordTower, recordWin, type RunState } from "./run-state.ts";
import { CUP_IDS } from "./world/tournament.ts";
import { DOJOS, type DojoId } from "./world/dojos.ts";
import { GANGS, routesFrom, type NodeId } from "./world/map.ts";

const armored = (): RunState => ({
  ...createRunState(),
  metSenpai: true,
  gi: true,
  senseiRounds: 3,
  trained: true,
  gear: { tare: true, do: true, men: true, kote: true, shinai: true },
});
const row = (id: UnlockId) => LADDER.find((u) => u.id === id)!;
const beat = (run: RunState, ...ids: DojoId[]) => ids.reduce((r, id) => recordWin({ ...r, node: id }), run);

test("the door stays shut until you've beaten a senpai", () => {
  assert.equal(isOpen(armored(), "door"), false);
  assert.equal(isOpen(recordWin(armored(), "bo"), "door"), true);
  assert.equal(isOpen(beat(armored(), "radish"), "door"), false, "only a senpai counts");
});

test("street fights stay shut until the line drill has been passed enough times", () => {
  let run: RunState = { ...armored(), bonusKi: 500, beaten: ["raccoon", "goose", "heron"] };
  for (const gang of Object.keys(GANGS) as NodeId[]) assert.ok(lockFor(run, gang), gang);
  for (let i = 0; i < LINE_PASSES_TO_UNLOCK - 1; i++) run = recordLinePass(run);
  assert.ok(lockFor(run, "market"));
  run = recordLinePass(run);
  for (const gang of Object.keys(GANGS) as NodeId[]) assert.equal(lockFor(run, gang), null, gang);
});

test("the later street fights also ask for more ki", () => {
  const run = { ...armored(), linePasses: LINE_PASSES_TO_UNLOCK };
  assert.equal(lockFor(run, "market"), null);
  assert.ok(lockFor(run, "bridge"));
  assert.ok(lockFor(run, "gorge"));
  assert.equal(lockFor({ ...run, bonusKi: 40 }, "bridge"), null);
});

test("Old Gen won't see you until you've run the line and grown your ki", () => {
  assert.deepEqual(unmet(armored(), row("ravine")), ["line drill 0/3", "ki 125"]);
  assert.ok(lockFor({ ...armored(), linePasses: 3 }, "ravine"), "the line alone isn't enough");
  assert.ok(lockFor({ ...armored(), bonusKi: 100 }, "ravine"), "ki alone isn't enough");
  assert.equal(lockFor({ ...armored(), linePasses: 3, bonusKi: 25 }, "ravine"), null);
});

test("Ren is the last dojo: every other rival, seme and a lot of ki", () => {
  const others: DojoId[] = ["raccoon", "goose", "heron", "otter"];
  const huge = { ...armored(), bonusKi: 500, seme: true, dan: 3 };
  assert.ok(lockFor(huge, "radish"), "ki and seme aren't enough");
  for (const skip of others) assert.ok(lockFor(beat(huge, ...others.filter((o) => o !== skip)), "radish"), `skipped ${skip}`);
  const beaten = { ...beat(armored(), ...others), dan: 3 };
  assert.ok(lockFor({ ...beaten, bonusKi: 500 }, "radish"), "still needs seme");
  assert.ok(lockFor({ ...beaten, seme: true, bonusKi: 100 }, "radish"), "still needs ki");
  assert.equal(lockFor({ ...beaten, seme: true, bonusKi: 500 }, "radish"), null);
});

test("Ren comes after every other rival on the ladder", () => {
  const at = (id: UnlockId) => LADDER.findIndex((u) => u.id === id);
  for (const id of Object.keys(DOJOS) as DojoId[]) if (id !== "radish") assert.ok(at(id) < at("radish"), id);
});

test("the rivals open up one after another", () => {
  assert.ok(lockFor({ ...armored(), bonusKi: 500 }, "beachLine"), "the beach waits for Sora");
  assert.equal(lockFor(beat(armored(), "raccoon"), "beachLine"), null);
  assert.ok(lockFor({ ...armored(), bonusKi: 500, seme: true }, "station"), "the train waits for Hana");
  assert.equal(lockFor(beat(armored(), "goose"), "station"), null);
  assert.ok(lockFor(armored(), "fallsLine"));
  assert.equal(lockFor(beat(armored(), "heron"), "fallsLine"), null);
});

test("Hana wants seme as well as ki", () => {
  const reachable = beat({ ...armored(), bonusKi: 500, dan: 1 }, "raccoon");
  assert.ok(lockFor(reachable, "goose"));
  assert.equal(lockFor({ ...reachable, seme: true }, "goose"), null);
});

test("the tournament waits until you've beaten Ren", () => {
  assert.ok(lockFor({ ...armored(), bonusKi: 500 }, "arenaLine"));
  assert.equal(lockFor(beat(armored(), "radish"), "arenaLine"), null);
});

test("every route back home is always open", () => {
  for (const id of ["beachStop", "parkStop", "steelStation", "fallsStation", "arenaStation"] as NodeId[]) {
    for (const route of routesFrom(id)) assert.equal(route.line, undefined, `${id} to ${route.to}`);
  }
});

test("places not on the ladder are always open", () => {
  for (const node of ["pinecone", "crossroads", "tower", "stop", "beachStrip", "cherryWalk", "millRow", "lookout", "grandArena"] as NodeId[]) {
    assert.equal(lockFor(createRunState(), node), null, node);
  }
});

test("what's missing is listed, and only what's missing", () => {
  const goose = row("goose");
  const atBeach = beat({ ...armored(), dan: 1 }, "raccoon");
  assert.deepEqual(unmet({ ...atBeach, bonusKi: 0 }, goose), ["ki 170", "seme"]);
  assert.deepEqual(unmet({ ...atBeach, bonusKi: 70 }, goose), ["seme"]);
  assert.deepEqual(unmet({ ...atBeach, bonusKi: 70, seme: true }, goose), []);
  assert.deepEqual(unmet({ ...armored(), linePasses: 1 }, row("market")), ["line drill 1/3"]);
  assert.deepEqual(unmet(armored(), row("beachLine")), ["beat Sora"]);
});

test("a long list of rivals still to beat is kept short", () => {
  assert.ok(unmet(armored(), row("radish")).includes("4 wins"));
  assert.ok(unmet(beat(armored(), "raccoon", "goose", "heron"), row("radish")).includes("beat Kenji"));
});

test("the next goal is the first thing on the ladder that's still shut", () => {
  const run = armored();
  assert.equal(nextGoal(run)?.id, "door");
  assert.equal(nextGoal(recordWin(run, "aki"))?.id, "cup:pinecone");
});

test("techniques grow as you learn them", () => {
  assert.deepEqual(techniques(createRunState()), []);
  assert.deepEqual(techniques({ ...createRunState(), senseiRounds: 1 }), ["men"]);
  assert.deepEqual(techniques({ ...createRunState(), senseiRounds: 2 }), ["men", "do"]);
  assert.deepEqual(techniques(armored()), ["men", "do", "kote", "launch"]);
  assert.deepEqual(techniques({ ...armored(), seme: true }), ["men", "do", "kote", "launch", "seme", "kiai"]);
});

/** Plays everything currently open, over and over, the way a thorough player would. No secret, no tsuba. */
function playEverything(start: RunState, skipOptional: NodeId[] = [], playCups = true): RunState {
  let run = start;
  for (let round = 0; round < 40; round++) {
    run = recordWin(run, "aki");
    run = recordWin(run, "bo");
    run = recordWin(run, "yui");
    run = recordLinePass(run);
    run = { ...run, waza: true };
    if (gradingReady(run)) run = gradingOutcome(run, true).run;
    if (isOpen(run, "door") && isOpen(run, "ravine")) run = { ...run, seme: true };
    for (const gang of Object.keys(GANGS) as NodeId[]) {
      if (!lockFor(run, gang) && !skipOptional.includes(gang)) run = recordGangWin(run, gang);
    }
    if (run.cleared.includes("market")) run = recordTower(run);
    for (const dojo of Object.keys(DOJOS) as DojoId[]) if (!lockFor(run, dojo)) run = recordWin({ ...run, node: dojo });
    if (playCups) for (const cup of CUP_IDS) if (cup !== "grand" && !lockFor(run, `cup:${cup}`)) run = recordCup(run, cup);
  }
  return run;
}

test("every lock can be opened by playing what's already open, without the secret", () => {
  const run = playEverything(armored());
  assert.equal(run.hasTsuba, false);
  for (const unlock of LADDER) assert.deepEqual(unmet(run, unlock), [], unlock.id);
});

test("gang fights really are optional: the cups alone can carry you to Ren", () => {
  const run = playEverything(armored(), Object.keys(GANGS) as NodeId[]);
  assert.deepEqual(run.cleared, []);
  for (const unlock of LADDER.filter((row) => !GANGS[row.id] && row.id !== "arenaLine")) assert.deepEqual(unmet(run, unlock), [], unlock.id);
});

test("or you can skip the cups and fight your way there", () => {
  const run = playEverything(armored(), [], false);
  assert.deepEqual(run.cups, []);
  assert.equal(lockFor(run, "radish"), null);
});

test("Ren stays hard to reach: with neither fights nor cups, the ki isn't there", () => {
  const run = playEverything(armored(), Object.keys(GANGS) as NodeId[], false);
  assert.ok(playerKiMax(run) < 230);
  assert.ok(lockFor(run, "radish"));
});

test("a dojo's cup opens once you've beaten whoever runs it", () => {
  const run = { ...armored(), linePasses: 3 };
  assert.ok(lockFor(run, "cup:raccoon"));
  assert.equal(lockFor({ ...run, beaten: ["raccoon"], dan: 1 }, "cup:raccoon"), null);
  assert.ok(lockFor(createRunState(), "cup:pinecone"));
  assert.equal(lockFor({ ...run, beaten: ["aki"] }, "cup:pinecone"), null);
});

test("every requirement can be spoken by Sensei inside one dialogue box", () => {
  const run = createRunState();
  for (const unlock of LADDER) {
    const line = needsSentence(run, unlock);
    assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
  }
});

test("a locked place says what it's waiting for, in one dialogue box", () => {
  const run = createRunState();
  for (const unlock of LADDER) {
    const line = lockedLine(run, unlock);
    for (const need of unmet(run, unlock)) assert.ok(line.includes(need), line);
    assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
  }
});

test("newly opened things are announced once, when they open", () => {
  const before = armored();
  assert.deepEqual(newlyOpened(before, before), []);
  const after = recordWin(before, "aki");
  assert.deepEqual(newlyOpened(before, after).map((u) => u.id), ["door"]);
  assert.deepEqual(newlyOpened(after, recordWin(after, "bo")).map((u) => u.id), []);
});

test("one action can open several things", () => {
  const before = { ...armored(), linePasses: LINE_PASSES_TO_UNLOCK - 1, bonusKi: 20 };
  assert.deepEqual(newlyOpened(before, recordLinePass(before)).map((u) => u.id), ["market", "ravine", "parkLine"]);
});

test("the progress page shows a short stretch of the ladder around where you are", () => {
  const atStart = ladderWindow(armored());
  assert.equal(atStart[0].id, "door");
  assert.ok(atStart.length <= 10);
  const late = beat({ ...armored(), waza: true, linePasses: 3, seme: true, bonusKi: 500, dan: 3 }, "raccoon", "goose", "heron", "otter");
  const nearEnd = ladderWindow(recordWin(late, "aki"));
  assert.ok(nearEnd.some((u) => u.id === "radish"));
  assert.ok(nearEnd.some((u) => u.id === "arenaLine"));
  assert.ok(nearEnd.length <= 10);
});

test("a place you can't get to yet isn't open, however much ki you've got", () => {
  const huge = { ...armored(), linePasses: 3, seme: true, bonusKi: 500, dan: 3 };
  assert.ok(lockFor(huge, "otter"), "Kenji is at the far end of a train you can't catch");
  assert.ok(unmet(huge, row("otter")).includes("beat Mika"));
  assert.ok(lockFor(huge, "goose"), "Hana is at the far end of a streetcar you can't catch");
  assert.ok(unmet(huge, row("goose")).includes("beat Sora"));
  assert.ok(lockFor(huge, "heron"), "the train itself isn't running yet");
  assert.equal(lockFor(beat(huge, "heron"), "otter"), null);
});

test("every fight and rival in another district waits for the ride there", () => {
  const rides: Partial<Record<NodeId, UnlockId>> = { picnic: "parkLine", raccoon: "parkLine", boardwalk: "beachLine", goose: "beachLine", foundry: "station", heron: "station", gorge: "fallsLine", otter: "fallsLine" };
  for (const [node, ride] of Object.entries(rides)) assert.equal(row(node as UnlockId).via, ride, node);
});

test("reaching a far-off place with enough ki announces it only when the ride opens", () => {
  const before = beat({ ...armored(), linePasses: 3, seme: true, bonusKi: 500, dan: 3 }, "raccoon", "goose");
  const opened = newlyOpened(before, beat(before, "heron")).map((u) => u.id);
  assert.ok(opened.includes("fallsLine"));
  assert.ok(opened.includes("otter"), "Kenji opens with the train");
  assert.ok(opened.includes("gorge"));
  const earlier = { ...armored(), linePasses: 3 };
  assert.deepEqual(newlyOpened(earlier, { ...earlier, bonusKi: 300 }).map((u) => u.id).filter((id) => id === "otter" || id === "gorge" || id === "heron"), []);
});

test("the short list of needs always fits beside its label, and leads with the most useful", () => {
  const run = createRunState();
  for (const unlock of LADDER) {
    const text = `${unlock.label}  ${shortNeeds(run, unlock)}`;
    assert.ok(measureText(text) + 16 <= STAGE_W, text);
    assert.ok(shortNeeds(run, unlock).length > 0, unlock.id);
  }
});

test("Sensei never tells you to go and pick a fight: those stay your own idea", () => {
  let run = recordWin(armored(), "aki");
  for (let i = 0; i < 3; i++) run = recordLinePass(run);
  run = recordCup(run, "pinecone");
  const goal = nextGoal(run);
  assert.ok(goal);
  assert.equal(GANGS[goal.id], undefined);
});

test("your standing fits on one row of the progress page, even at the very end", () => {
  for (const xp of [0, 320, 9000, 40000]) {
    for (const champion of [false, true]) {
      const line = standingLine({ ...createRunState(), dan: 3, xp, bonusKi: 400, champion });
      assert.ok(measureText(line) <= STAGE_W - 16, line);
      assert.equal(line.includes("Champion"), champion);
    }
  }
});

test("1st dan needs the waza lesson, and says so", () => {
  const ready = playEverything(armored());
  const without = { ...ready, dan: 0, waza: false };
  assert.ok(unmet(without, LADDER.find((row) => row.id === "shinsa:1")!).includes("waza lesson"));
  assert.deepEqual(unmet({ ...without, waza: true }, LADDER.find((row) => row.id === "shinsa:1")!), []);
});

test("multiplayer opens at 1st dan with the waza lesson done", () => {
  assert.ok(lockFor({ ...armored(), dan: 0, waza: true }, "online"));
  assert.ok(lockFor({ ...armored(), dan: 1, waza: false }, "online"));
  assert.equal(lockFor({ ...armored(), dan: 1, waza: true }, "online"), null);
});

test("an older save that already holds 1st dan isn't sent back for it, though multiplayer still wants the lesson", () => {
  const old = playEverything({ ...armored(), dan: 1 });
  const notTaught = { ...old, waza: false };
  assert.deepEqual(unmet(notTaught, LADDER.find((row) => row.id === "shinsa:1")!), []);
  assert.ok(lockFor(notTaught, "online"));
});

test("the checklist has what's done as well as what's missing, in the same order", () => {
  const goose = row("goose");
  const atBeach = beat({ ...armored(), dan: 1 }, "raccoon");
  const run = { ...atBeach, bonusKi: 70 };
  const list = needs(run, goose);
  assert.deepEqual(list.filter((need) => !need.met).map((need) => need.text), unmet(run, goose));
  assert.ok(list.some((need) => need.met), "something is already done");
  assert.ok(list.find((need) => need.text === "seme" && !need.met));
  assert.ok(needs(createRunState(), row("door")).every((need) => !need.met));
});

test("every row's checklist agrees with whether it's open, all the way up the ladder", () => {
  for (const unlock of LADDER) {
    for (const run of [createRunState(), armored(), { ...armored(), bonusKi: 500, seme: true, dan: 3, waza: true, linePasses: 3 }]) {
      assert.equal(needs(run, unlock).every((need) => need.met), unmet(run, unlock).length === 0, unlock.id);
    }
  }
});

test("the map opens on what's next, and on the last row when there's nothing left", () => {
  assert.equal(LADDER[goalRow(createRunState())].id, nextGoal(createRunState())!.id);
  const done = { ...armored(), bonusKi: 500, seme: true, dan: 3, waza: true, linePasses: 3, beaten: ["aki", "raccoon", "goose", "heron", "otter", "radish"] as RunState["beaten"], cups: [...CUP_IDS] };
  if (nextGoal(done) === null) assert.equal(goalRow(done), LADDER.length - 1);
});
