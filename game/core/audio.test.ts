import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "./audio.ts";
import type { Syllable } from "./babble.ts";

function fakeContext() {
  let started = 0;
  const node = { connect() { return node; }, start() { started++; }, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, type: "", buffer: null };
  const ctx = {
    currentTime: 0, state: "running", sampleRate: 8000, destination: node,
    createOscillator: () => node, createGain: () => node, createBufferSource: () => node, createBiquadFilter: () => node,
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

const SYLLABLE: Syllable = { at: 0, freq: 300, slideTo: 280, f1: 700, f2: 1200, length: 0.1, volume: 0.2, wave: "sawtooth", onset: "soft", breath: 0 };

test("a syllable can't be heard before the first key press", () => {
  const fake = fakeContext();
  createAudio(() => fake.ctx).say(SYLLABLE);
  assert.equal(fake.started(), 0);
});

test("an unlocked syllable is heard", () => {
  const fake = fakeContext();
  const audio = createAudio(() => fake.ctx);
  audio.unlock();
  audio.say(SYLLABLE);
  assert.ok(fake.started() > 0);
});

test("mute silences voices too", () => {
  const fake = fakeContext();
  const audio = createAudio(() => fake.ctx);
  audio.unlock();
  audio.toggleMute();
  audio.say(SYLLABLE);
  assert.equal(fake.started(), 0);
});

test("a hissed consonant adds noise that a soft start doesn't", () => {
  const started = (onset: Syllable["onset"]) => {
    const fake = fakeContext();
    const audio = createAudio(() => fake.ctx);
    audio.unlock();
    audio.say({ ...SYLLABLE, onset });
    return fake.started();
  };
  assert.ok(started("hiss") > started("soft"));
});

test("a breathy voice adds noise under the note", () => {
  const started = (breath: number) => {
    const fake = fakeContext();
    const audio = createAudio(() => fake.ctx);
    audio.unlock();
    audio.say({ ...SYLLABLE, breath });
    return fake.started();
  };
  assert.ok(started(0.3) > started(0));
});
