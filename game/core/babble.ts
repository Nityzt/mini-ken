/**
 * Speech that isn't words: one little sung syllable for every few letters on screen.
 * What makes it read as talking, measured off the real thing, is that the sound runs together rather than beeping,
 * the vowel changes every syllable, and each phrase starts high and drifts down a few semitones.
 */
export type Voice = {
  /** Where they start a sentence, in Hz. */
  pitch: number;
  /** Letters per syllable. Text types at 60 letters a second, so 5 is 12 syllables a second. */
  every: number;
  wave: OscillatorType;
  /** How small the head is: above 1 squeaks, below 1 booms, whatever the pitch. */
  tract: number;
  /** Semitones the pitch wanders from letter to letter. Near 0 is a monotone. */
  lilt: number;
  /** Semitones a sentence falls by its end. */
  fall: number;
  volume: number;
  /** How much air gets in, 0 to 1. */
  breath: number;
};

export type Onset = "hiss" | "tick" | "soft";

export type Syllable = {
  /** The letter it starts on. */
  at: number;
  freq: number;
  slideTo: number;
  f1: number;
  f2: number;
  /** Seconds. */
  length: number;
  volume: number;
  wave: OscillatorType;
  onset: Onset;
  breath: number;
};

const TICKS_PER_SECOND = 60;
/** Longer than the gap to the next syllable, so they overlap instead of beeping. */
const OVERLAP = 1.2;
/** Where the end of a question turns upward, as a share of the way through it. */
const QUESTION_TURN = 2 / 3;
const QUESTION_RISE = 4;
const SHOUT_LIFT = 2;
const SHOUT_VOLUME = 1.25;
const SLIDE_DOWN = -1;
const SLIDE_UP = 1.5;

const VOWELS: Record<string, { f1: number; f2: number; lean: number }> = {
  a: { f1: 800, f2: 1250, lean: 0 },
  e: { f1: 550, f2: 1800, lean: 0.4 },
  i: { f1: 320, f2: 2250, lean: 1 },
  y: { f1: 320, f2: 2250, lean: 1 },
  o: { f1: 520, f2: 950, lean: -0.6 },
  u: { f1: 360, f2: 850, lean: -1 },
};
/** The neutral mouth, for "hmm" and "1,000". */
const NEUTRAL = { f1: 500, f2: 1400, lean: 0 };

const onsetOf = (letter: string): Onset => ("scfxzjh".includes(letter) ? "hiss" : "tkpdbgq".includes(letter) ? "tick" : "soft");
const bend = (freq: number, semitones: number) => freq * 2 ** (semitones / 12);
/** Each letter leans its own way, so a given word always comes out with the same tune. */
const letterLean = (letter: string) => (((letter.charCodeAt(0) * 7) % 5) - 2) / 2;

/** What a voice makes of some text, starting at `from`. It's worked out ahead, so the same line is always the same tune. */
export function babble(text: string, voice: Voice, from = 0): Syllable[] {
  const syllables: Syllable[] = [];
  let last = -Infinity;
  for (const phrase of text.matchAll(/[^.,!?;:]+[.,!?;:]*/g)) {
    const start = phrase.index;
    const words = phrase[0];
    const asks = words.includes("?");
    const shouts = words.includes("!");
    for (let i = 0; i < words.length; i++) {
      const at = start + i;
      const letter = words[i].toLowerCase();
      if (at < from || !/[a-z0-9]/.test(letter) || at - last < voice.every) continue;
      last = at;
      const shape = [...text.slice(at, at + voice.every).toLowerCase()].map((c) => VOWELS[c]).find(Boolean) ?? NEUTRAL;
      const through = i / Math.max(1, words.length - 1);
      const asking = asks && through > QUESTION_TURN;
      const contour = -voice.fall * (asks ? Math.min(through, QUESTION_TURN) : through) + (asking ? (QUESTION_RISE * (through - QUESTION_TURN)) / (1 - QUESTION_TURN) : 0) + (shouts ? SHOUT_LIFT : 0);
      const freq = bend(voice.pitch, contour + voice.lilt * (shape.lean + letterLean(letter)) * 0.5);
      syllables.push({
        at,
        freq,
        slideTo: bend(freq, asking ? SLIDE_UP : SLIDE_DOWN),
        f1: shape.f1 * voice.tract,
        f2: shape.f2 * voice.tract,
        length: (voice.every / TICKS_PER_SECOND) * OVERLAP,
        volume: voice.volume * (shouts ? SHOUT_VOLUME : 1),
        wave: voice.wave,
        onset: onsetOf(letter),
        breath: voice.breath,
      });
    }
  }
  return syllables;
}
