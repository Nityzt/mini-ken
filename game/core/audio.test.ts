import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "./audio.ts";

function fakeContext() {
  let started = 0;
  const node = { connect() { return node; }, start() { started++; }, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "", buffer: null };
  const ctx = {
    currentTime: 0, state: "running", sampleRate: 8000, destination: node,
    createOscillator: () => node, createGain: () => node, createBufferSource: () => node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    resume: async () => {},
  };
  return { ctx: ctx as unknown as AudioContext, started: () => started };
}

test("play does nothing and does not throw when audio is unavailable", () => {
  const audio = createAudio(() => null);
  audio.unlock();
  assert.doesNotThrow(() => audio.play("clean"));
});

test("play does nothing before the first key press unlocks it", () => {
  const fake = fakeContext();
  createAudio(() => fake.ctx).play("swing");
  assert.equal(fake.started(), 0);
});

test("an unlocked sound plays", () => {
  const fake = fakeContext();
  const audio = createAudio(() => fake.ctx);
  audio.unlock();
  audio.play("swing");
  assert.ok(fake.started() > 0);
});

test("muted audio plays nothing", () => {
  const fake = fakeContext();
  const audio = createAudio(() => fake.ctx);
  audio.unlock();
  audio.toggleMute();
  audio.play("clean");
  assert.equal(fake.started(), 0);
});

test("toggleMute flips and returns the new state", () => {
  const audio = createAudio(() => null);
  assert.equal(audio.toggleMute(), true);
  assert.equal(audio.toggleMute(), false);
});

test("every sound can play", () => {
  for (const name of ["pickup", "stomp", "charge", "swing", "clean", "blocked", "break", "secret", "flag"] as const) {
    const fake = fakeContext();
    const audio = createAudio(() => fake.ctx);
    audio.unlock();
    audio.play(name);
    assert.ok(fake.started() > 0, name);
  }
});
