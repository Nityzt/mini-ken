import test from "node:test";
import assert from "node:assert/strict";
import { createFlow, FADE_TICKS, startFade, stepFlow, type Flow } from "./flow.ts";

const ticks = (flow: Flow, count: number) => {
  let f = flow;
  const switched: string[] = [];
  let ran = 0;
  for (let i = 0; i < count; i++) {
    const r = stepFlow(f, false);
    f = r.flow;
    if (r.switchTo) switched.push(r.switchTo);
    if (r.runScene) ran++;
  }
  return { flow: f, switched, ran };
};

test("the scene runs when nothing else is happening", () => {
  assert.equal(stepFlow(createFlow(), false).runScene, true);
});

test("pause stops the scene and pressing again resumes it", () => {
  const paused = stepFlow(createFlow(), true);
  assert.equal(paused.flow.paused, true);
  assert.equal(paused.runScene, false);
  assert.equal(stepFlow(paused.flow, true).flow.paused, false);
});

test("a fade switches scene halfway, then the new scene runs", () => {
  const out = ticks(startFade(createFlow(), "duel"), FADE_TICKS);
  assert.deepEqual(out.switched, ["duel"]);
  assert.equal(out.ran, 0);
  assert.equal(ticks(out.flow, FADE_TICKS + 1).ran, 1);
});

test("losing focus during a fade can always be resumed with Esc", () => {
  // Focus loss forces paused on, mid-fade.
  let flow: Flow = { ...startFade(createFlow(), "duel"), paused: true };
  flow = stepFlow(flow, true).flow;
  assert.equal(flow.paused, false, "Esc must unpause");
  assert.deepEqual(ticks(flow, FADE_TICKS).switched, ["duel"]);
});

test("losing focus while fading in can always be resumed with Esc", () => {
  const flow: Flow = { paused: true, fadingTo: null, fadeTicks: 4 };
  assert.equal(stepFlow(flow, true).flow.paused, false);
});

test("pausing mid-fade holds the fade where it is", () => {
  const start = startFade(createFlow(), "duel");
  const paused = stepFlow(start, true).flow;
  assert.equal(paused.paused, true);
  assert.deepEqual(ticks(paused, 30).switched, []);
  assert.equal(ticks(paused, 30).flow.fadeTicks, paused.fadeTicks);
});
