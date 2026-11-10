import test from "node:test";
import assert from "node:assert/strict";
import { createRunState, type RunState } from "../run-state.ts";
import { POSES } from "../art/duel-sprites.ts";
import { finishSession } from "./club-story.ts";
import {
  beatAt, CEREMONY_BEATS, CEREMONY_POSES, CEREMONY_SKIP_AFTER, CEREMONY_TICKS, ceremonyFrame, createCeremony, markMenToast, MEN_CEREMONY_SEEN, MEN_TOAST_SEEN, menToastDue, stepCeremony, TOAST_TICKS, toastSlide, type CeremonyBeat,
} from "./men-ceremony.ts";

const play = (reducedMotion: boolean, skipAt = -1) => {
  let state = createCeremony();
  const frames = [];
  while (!state.done) {
    state = stepCeremony(state, state.tick === skipAt);
    frames.push(ceremonyFrame(state.tick, reducedMotion));
  }
  return { state, frames };
};
const beatsIn = (frames: { beat: CeremonyBeat }[]) => frames.map((f) => f.beat).filter((beat, i, all) => beat !== all[i - 1]);

test("the senpai reaches in, draws the men, it glows, they walk over and put it on you, in that order", () => {
  assert.deepEqual(CEREMONY_BEATS.map((b) => b.beat), ["reach", "draw", "glow", "approach", "place", "worn"]);
  const { state, frames } = play(false);
  assert.equal(state.tick, CEREMONY_TICKS);
  assert.deepEqual(beatsIn(frames), ["reach", "draw", "glow", "approach", "place", "worn"]);
});

test("each beat starts where the last left off", () => {
  let start = 0;
  for (const { beat, ticks } of CEREMONY_BEATS) {
    assert.deepEqual(beatAt(start), { beat, t: 0 });
    assert.equal(beatAt(start + ticks - 1).beat, beat);
    start += ticks;
  }
  assert.equal(beatAt(CEREMONY_TICKS + 50).beat, "worn");
});

test("the men's only in one hand once it's drawn, and only on your head once it's placed", () => {
  const { frames } = play(false);
  for (const frame of frames) {
    assert.equal(frame.held, frame.beat !== "reach" && frame.beat !== "worn", frame.beat);
    assert.equal(frame.worn, frame.beat === "worn");
  }
  const at = (beat: CeremonyBeat) => frames.filter((f) => f.beat === beat);
  assert.ok(at("reach").every((f) => f.lift === 0 && f.approach === 0));
  assert.equal(at("glow")[0].lift, 1);
  assert.ok(at("glow").every((f) => f.approach === 0), "they stay put while it glows");
  assert.equal(at("place")[0].approach, 1);
  assert.equal(at("worn")[0].place, 1);
  // Moving only ever goes one way.
  for (let i = 1; i < frames.length; i++) {
    for (const key of ["lift", "approach", "place"] as const) assert.ok(frames[i][key] >= frames[i - 1][key], `${key} at ${i}`);
  }
});

test("it glows, with a flash as it first catches the light", () => {
  const { frames } = play(false);
  const glow = frames.filter((f) => f.beat === "glow");
  assert.ok(glow.some((f) => f.flash));
  assert.ok(glow.some((f) => f.glow > 0.5));
  assert.ok(new Set(glow.map((f) => f.glow.toFixed(2))).size > 3, "it pulses");
  assert.ok(frames.filter((f) => f.beat === "reach" || f.beat === "draw" || f.beat === "worn").every((f) => f.glow === 0 && !f.flash));
});

test("reduced motion keeps every beat but drops the flash and the pulse", () => {
  const calm = play(true).frames;
  assert.deepEqual(beatsIn(calm), beatsIn(play(false).frames));
  assert.equal(calm.length, CEREMONY_TICKS);
  assert.ok(calm.every((f) => !f.flash));
  const glowing = calm.filter((f) => f.glow > 0);
  assert.ok(glowing.length > 0, "it still glows");
  assert.equal(new Set(glowing.map((f) => f.glow)).size, 1, "steadily");
});

test("E cuts it short, but not with the press that closed the line before it", () => {
  let state = createCeremony();
  for (let i = 0; i < CEREMONY_SKIP_AFTER; i++) state = stepCeremony(state, true);
  assert.equal(state.done, false);
  state = stepCeremony(state, true);
  assert.equal(state.done, true);
  assert.equal(stepCeremony(state, false), state, "a finished ceremony stays finished");
});

const withMen = (): RunState => ({ ...createRunState(), gi: true, senseiRounds: 2, gear: { tare: true, do: true, men: false, kote: false, shinai: true } });

test("earning the men plays the ceremony, and only for the men", () => {
  const men = finishSession(withMen(), { kind: "senpai", senpai: "bo", level: 1 });
  assert.equal(men.ceremony, "men");
  assert.ok(men.run.seen.includes(MEN_CEREMONY_SEEN));
  const doPiece = finishSession({ ...withMen(), senseiRounds: 1, gear: { ...withMen().gear, do: false } }, { kind: "senpai", senpai: "bo", level: 0 });
  assert.equal(doPiece.ceremony, undefined);
  const kote = finishSession({ ...withMen(), senseiRounds: 3, gear: { ...withMen().gear, men: true } }, { kind: "senpai", senpai: "bo", level: 2 });
  assert.equal(kote.ceremony, undefined);
});

test("the note about the men shows the first time home after the ceremony, and never again", () => {
  const earned = finishSession(withMen(), { kind: "senpai", senpai: "aki", level: 1 }).run;
  assert.equal(menToastDue(earned), true);
  const shown = markMenToast(earned);
  assert.ok(shown.seen.includes(MEN_TOAST_SEEN));
  assert.equal(menToastDue(shown), false);
  assert.equal(markMenToast(shown), shown);
});

test("no note for a men that never had the ceremony, or one you're already wearing", () => {
  // Saves from before the ceremony already know where their men is.
  assert.equal(menToastDue({ ...withMen(), gear: { ...withMen().gear, men: true } }), false);
  const earned = finishSession(withMen(), { kind: "senpai", senpai: "aki", level: 1 }).run;
  assert.equal(menToastDue({ ...earned, menOn: true }), false);
});

test("the note slides in, stays, and slides out, and with reduced motion it just shows", () => {
  assert.equal(toastSlide(0, false), 1);
  assert.equal(toastSlide(TOAST_TICKS / 2, false), 0);
  assert.ok(toastSlide(TOAST_TICKS - 2, false) > 0);
  assert.equal(toastSlide(TOAST_TICKS, false), 1);
  assert.equal(toastSlide(0, true), 0);
  assert.equal(toastSlide(TOAST_TICKS - 1, true), 0);
  assert.equal(toastSlide(TOAST_TICKS, true), 1);
});

test("nobody's in kamae for the handing over: both shinai are down at the hip, and the senpai's free hand is the one holding the men", () => {
  const [you, senpai] = CEREMONY_POSES;
  for (const pose of CEREMONY_POSES) assert.ok(POSES[pose].sheathed, pose);
  // You stand with your right hand free, ready to be given it.
  assert.ok(POSES[you].rightHand);
  // The senpai's right arm is drawn by the ceremony, reaching into the gi and holding up the men, so the pose mustn't draw a second one.
  assert.equal(POSES[senpai].rightHand, undefined);
  assert.equal(POSES[senpai].angle, POSES[you].angle);
});
