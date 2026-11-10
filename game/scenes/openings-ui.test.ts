import test from "node:test";
import assert from "node:assert/strict";
import type { Input } from "../core/input.ts";
import { clockLabel, fighterStatus } from "../duel/hud.ts";
import { OPENING_POSE, poseFor } from "../duel/poses.ts";
import { createDuel, ruleTick, skipBow } from "../duel/rules.ts";
import { tipFor } from "../duel/tips.ts";
import { createRunState } from "../run-state.ts";
import { finishSession } from "./club-story.ts";
import { challengeFor, createLessonDuel, lessonsFor, SENSEI_ROUNDS } from "./curriculum.ts";
import { applyEvents, createDuelView, createPlayerControl, helpLine, refereeCall } from "./duel.ts";
import { duelMoments, momentCard, primerNeeds } from "./teaching.ts";

const keys = (down: string[] = [], pressed: string[] = []) => ({ isDown: (a: string) => down.includes(a), wasPressed: (a: string) => pressed.includes(a) }) as unknown as Input;

test("holding W, Q or E holds an opening, and the newest wins until it's let go", () => {
  const control = createPlayerControl();
  assert.equal(control(keys(["raise"], ["raise"]), { stance: "guard" }).opening, "raise");
  assert.equal(control(keys(["raise", "drop"], ["drop"]), { stance: "opening" }).opening, "drop");
  assert.equal(control(keys(["raise"]), { stance: "opening" }).opening, "raise");
  assert.equal(control(keys(), { stance: "opening" }).opening, null);
});

test("a strike key goes through with an opening held, or from one already going", () => {
  assert.equal(createPlayerControl()(keys(["wrist"], ["wrist", "kote"]), { stance: "guard" }).attack, "kote");
  assert.equal(createPlayerControl()(keys([], ["men"]), { stance: "opening" }).attack, "men");
});

test("a strike key alone tells the rules, which do nothing, but stays waiting a moment for the opening", () => {
  const control = createPlayerControl();
  assert.equal(control(keys([], ["men"]), { stance: "guard" }).attack, "men");
  assert.equal(control(keys(), { stance: "guard" }).attack, null);
  assert.equal(control(keys(["raise"], ["raise"]), { stance: "guard" }).attack, "men");
});

test("a parry's counter needs nothing held", () => {
  assert.equal(createPlayerControl()(keys([], ["men"]), { stance: "guard", counterTicks: 5 }).attack, "men");
});

test("each opening has its own pose, held while it's shown and while the strike gathers", () => {
  const view = { phase: "fight" as const, striking: null, scored: false };
  assert.equal(poseFor({ stance: "opening", attack: null, launchTicks: 0, opening: "raise" }, view), OPENING_POSE.do);
  assert.equal(poseFor({ stance: "opening", attack: null, launchTicks: 0, opening: "wrist" }, view), OPENING_POSE.kote);
  assert.equal(poseFor({ stance: "opening", attack: null, launchTicks: 0, opening: "drop" }, view), OPENING_POSE.men);
  assert.equal(poseFor({ stance: "windup", attack: "do", launchTicks: 0, opening: "raise" }, view), OPENING_POSE.do);
  assert.notEqual(OPENING_POSE.men, OPENING_POSE.kote);
  assert.notEqual(OPENING_POSE.kote, OPENING_POSE.do);
});

test("the label over someone says what they're showing", () => {
  const s = ruleTick(skipBow(createDuel()), { move: 0, block: false, attack: null, opening: "wrist" }, { move: 0, block: false, attack: null });
  assert.equal(fighterStatus(s, 0)?.kind, "showsKote");
});

test("the clock counts down in minutes and seconds, and encho says so", () => {
  const s = createDuel();
  assert.equal(clockLabel(s), "2:00");
  assert.equal(clockLabel({ ...s, clock: 40 * 61 }), "1:01");
  assert.equal(clockLabel({ ...s, clock: 1 }), "0:01");
  assert.equal(clockLabel({ ...s, clock: null, encho: true }), "Encho");
  assert.equal(clockLabel({ ...s, clock: null }), null);
});

test("the referee calls encho, and time", () => {
  const s = createDuel();
  assert.equal(refereeCall({ ...s, encho: true }, "point"), "Encho!");
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type: "time" }], true);
  assert.equal(view.floaters.at(-1)?.text, "Time!");
});

test("a strike with no opening gets a reminder, the first few times, for the player only", () => {
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type: "noopening", by: 1 }], true);
  assert.equal(view.floaters.length, 0);
  for (let i = 0; i < 6; i++) applyEvents(view, [{ type: "noopening", by: 0 }], true);
  assert.equal(view.floaters.length, 3);
  assert.ok(view.floaters.at(-1)!.text.includes("W"));
});

test("the help line and tips know about openings", () => {
  assert.ok(helpLine(0).includes("W"));
  assert.ok(tipFor({ by: 1, attack: "men", defenderStance: "guard" }).toLowerCase().includes("guard"));
  assert.ok(tipFor({ by: 1, attack: "men", defenderStance: "opening" }).toLowerCase().includes("showing"));
});

test("the first lesson teaches openings before the first men, and the short tutorial has them and seme", () => {
  const first = SENSEI_ROUNDS[0].map((l) => l.id);
  assert.ok(first.indexOf("opening") < first.indexOf("fumikomi"));
  const quick = lessonsFor({ kind: "quick" }).map((l) => l.id);
  assert.equal(quick[0], "quick-opening");
  assert.ok(quick.includes("quick-seme"));
  assert.deepEqual(lessonsFor({ kind: "quick", only: ["quick-seme"] }).map((l) => l.id), ["quick-seme"]);
});

test("showing all three openings is what passes the lesson", () => {
  const lesson = SENSEI_ROUNDS[0].find((l) => l.id === "opening")!;
  let s = skipBow(createLessonDuel(lesson));
  const memo = {};
  for (const opening of ["raise", "wrist"] as const) {
    s = ruleTick(s, { move: 0, block: false, attack: null, opening }, lesson.partner(0, s));
    assert.equal(lesson.done(s.events, s, memo), false);
  }
  s = ruleTick(s, { move: 0, block: false, attack: null, opening: "drop" }, lesson.partner(0, s));
  assert.equal(lesson.done(s.events, s, memo), true);
});

test("someone going online gets offered what they've missed, once", () => {
  const run = createRunState();
  assert.deepEqual(primerNeeds(run, false), ["opening", "seme"]);
  assert.deepEqual(primerNeeds({ ...run, seme: true }, false), ["opening"]);
  assert.deepEqual(primerNeeds({ ...run, seen: ["taught:openings"] }, false), ["seme"]);
  assert.deepEqual(primerNeeds({ ...run, seen: ["taught:openings"], seme: true }, false), []);
  assert.deepEqual(primerNeeds(run, true), []);
});

test("an older save sees the openings card on its next match", () => {
  const moments = duelMoments(skipBow(createDuel()), { waza: true, tellsShown: false });
  assert.ok(moments.includes("openings"));
  assert.equal(momentCard("openings", skipBow(createDuel())).title, "Openings");
});

test("the seme step never gives a story seme", () => {
  assert.equal(finishSession(createRunState(), { kind: "quick" }).run.seme, false);
});

test("lessons have no clock", () => {
  for (const lesson of [...SENSEI_ROUNDS[0], ...lessonsFor({ kind: "quick" }), challengeFor("aki", 0)]) assert.equal(createLessonDuel(lesson).clock, null, lesson.id);
});

test("the launch lesson's card doesn't ask for the opening Sensei says it doesn't need (issue #14)", () => {
  const launch = SENSEI_ROUNDS[2].find((lesson) => lesson.id === "launch")!;
  assert.match(launch.prompt, /No opening needed/);
  assert.ok(!launch.keys.some(([key]) => key === "W Q E"), JSON.stringify(launch.keys));
  // The counters it's taught alongside still start from one.
  const kote = SENSEI_ROUNDS[2].find((lesson) => lesson.id === "kote")!;
  assert.ok(kote.keys.some(([key]) => key === "W Q E"));
});

test("street fights and the line drill need no opening, and a late press still counts", () => {
  const control = createPlayerControl({ openings: false });
  assert.equal(control(keys([], ["men"]), { stance: "recovery" }).attack, null);
  assert.equal(control(keys(), { stance: "guard" }).attack, "men");
});

test("nobody cries ippon when it's the clock that ended it", () => {
  const s = skipBow(createDuel());
  s.fighters[0].points = 1;
  s.firstPoint = 0;
  s.lastScore = { by: 0, attack: "men", defenderStance: "guard" };
  s.clock = 1;
  const ended = ruleTick(s, { move: 0, block: false, attack: null }, { move: 0, block: false, attack: null });
  assert.equal(ended.timeUp, true);
  assert.equal(ended.phase, "point");
});
