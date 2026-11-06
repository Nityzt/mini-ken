import test from "node:test";
import assert from "node:assert/strict";
import { babble, type Voice } from "./babble.ts";

const VOICE: Voice = { pitch: 300, every: 5, wave: "sawtooth", tract: 1, lilt: 0, fall: 3, volume: 0.2, breath: 0 };
const positions = (text: string, voice = VOICE) => babble(text, voice).map((s) => s.at);
const semitones = (from: number, to: number) => 12 * Math.log2(to / from);

test("at one letter a tick, a five-letter voice talks about twelve times a second", () => {
  const line = "the quick brown fox jumps over the lazy dog and keeps on running for quite a long way";
  const syllables = babble(line, VOICE);
  const perSecond = syllables.length / (line.length / 60);
  assert.ok(perSecond > 9 && perSecond <= 12, `${perSecond} per second`);
});

test("no two syllables start closer together than the voice's pace", () => {
  const at = positions("Hi! I am ok. A b c d e f g.");
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= VOICE.every, `${at}`);
});

test("a faster voice says more in the same line", () => {
  const line = "I talk a lot and I never stand still, so keep up with me!";
  assert.ok(babble(line, { ...VOICE, every: 4 }).length > babble(line, { ...VOICE, every: 8 }).length);
});

test("punctuation alone says nothing", () => {
  assert.deepEqual(babble("... !?", VOICE), []);
});

test("a syllable starts where its first letter gets typed", () => {
  assert.equal(babble("...Huh", VOICE)[0].at, 3);
});

test("speech can start partway through, past a speaker's name", () => {
  assert.deepEqual(babble("Bo: Mm", VOICE, 4).map((s) => s.at), [4]);
});

test("the same line always sounds the same", () => {
  assert.deepEqual(babble("Wash your gi alone.", VOICE), babble("Wash your gi alone.", VOICE));
});

test("the vowel it lands on shapes the sound: ee is brighter than oo", () => {
  const [ee] = babble("ee", VOICE);
  const [oo] = babble("oo", VOICE);
  assert.ok(ee.f2 > oo.f2 * 1.5, `${ee.f2} vs ${oo.f2}`);
  assert.ok(babble("aa", VOICE)[0].f1 > ee.f1, "an open vowel has a higher first formant");
});

test("a word with no vowel in reach still gets a sound", () => {
  const [hm] = babble("Hmm", VOICE);
  assert.ok(hm.f1 > 0 && hm.f2 > hm.f1);
});

test("consonants change how a syllable begins", () => {
  assert.equal(babble("sa", VOICE)[0].onset, "hiss");
  assert.equal(babble("ta", VOICE)[0].onset, "tick");
  assert.equal(babble("ma", VOICE)[0].onset, "soft");
  assert.equal(babble("oa", VOICE)[0].onset, "soft");
});

test("a smaller tract moves every formant up, and leaves the pitch alone", () => {
  const big = babble("a", VOICE)[0];
  const small = babble("a", { ...VOICE, tract: 1.25 })[0];
  assert.equal(small.f1, big.f1 * 1.25);
  assert.equal(small.f2, big.f2 * 1.25);
  assert.equal(small.freq, big.freq);
});

test("a phrase falls as it goes, by about what the voice says", () => {
  const syllables = babble("na na na na na na na na na na na na na na na na", VOICE);
  const drop = semitones(syllables[0].freq, syllables[syllables.length - 1].freq);
  assert.ok(drop < -VOICE.fall * 0.7 && drop > -VOICE.fall * 1.1, `${drop}`);
});

test("the next sentence starts high again", () => {
  const syllables = babble("na na na na na na na na na. na na na na", VOICE);
  const reset = syllables.findIndex((s) => s.at > 26);
  assert.ok(syllables[reset].freq > syllables[reset - 1].freq, `${syllables.map((s) => Math.round(s.freq))}`);
});

test("a question climbs at the end where a statement falls", () => {
  const asked = babble("na na na na na na na na na?", VOICE);
  const told = babble("na na na na na na na na na.", VOICE);
  assert.ok(asked[asked.length - 1].freq > told[told.length - 1].freq * 1.1);
  assert.ok(asked[asked.length - 1].slideTo > asked[asked.length - 1].freq, "and the last syllable itself bends up");
});

test("a shout is higher and louder than the same words said", () => {
  const shout = babble("na na na!", VOICE)[0];
  const said = babble("na na na.", VOICE)[0];
  assert.ok(shout.freq > said.freq);
  assert.ok(shout.volume > said.volume);
});

test("a syllable lasts a little past the start of the next, so the sound runs together", () => {
  const [syllable] = babble("na na na", VOICE);
  const gap = VOICE.every / 60;
  assert.ok(syllable.length > gap && syllable.length < gap * 1.5, `${syllable.length}`);
});

test("lilt moves the pitch from one letter to the next, and none leaves it smooth", () => {
  const steps = (voice: Voice) => {
    const f = babble("ba do ki mu se ra to ni", voice).map((s) => s.freq);
    return Math.max(...f.slice(1).map((v, i) => Math.abs(semitones(f[i], v))));
  };
  assert.ok(steps({ ...VOICE, fall: 0, lilt: 2 }) > 1);
  assert.equal(steps({ ...VOICE, fall: 0, lilt: 0 }), 0);
});
