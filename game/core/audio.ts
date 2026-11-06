import type { Syllable } from "./babble.ts";

export type SoundName = "dud" | "stomp" | "charge" | "pickup" | "swing" | "clean" | "blocked" | "break" | "secret" | "flag" | "bell" | "kiai" | "call" | "horn" | "parry" | "clash" | "ting";
export type GameAudio = { play(name: SoundName): void; say(syllable: Syllable): void; toggleMute(): boolean; unlock(): void };

type Note = { freq: number; at: number; length: number; wave: OscillatorType; volume: number; slideTo?: number };
type Noise = { at: number; length: number; volume: number };

// A voice is a buzz through two resonances, which is what makes one vowel different from another. A little of the raw buzz keeps it reedy.
const F1_Q = 5;
const F2_Q = 8;
const F2_LEVEL = 1.3;
const BUZZ_LEVEL = 0.06;
const GLIDE = 1.2;
const GLIDE_SHARE = 0.5;
const ATTACK = 0.006;
const HOLD = 0.7;
const HISS = { length: 0.035, volume: 0.35, cutoff: 3500 };
const TICK = { length: 0.012, volume: 0.5, center: 2200 };

const SOUNDS: Record<SoundName, { notes?: Note[]; noise?: Noise[] }> = {
  // The bare foot on wood: a low thump with a slap on top.
  stomp: {
    noise: [{ at: 0, length: 0.05, volume: 0.14 }],
    notes: [{ freq: 130, slideTo: 60, at: 0, length: 0.09, wave: "sine", volume: 0.3 }],
  },
  // A low rumble while powering up.
  dud: { notes: [{ freq: 110, slideTo: 70, at: 0, length: 0.08, wave: "triangle", volume: 0.09 }] },
  charge: { notes: [{ freq: 62, slideTo: 90, at: 0, length: 0.22, wave: "sawtooth", volume: 0.05 }] },
  pickup: {
    notes: [
      { freq: 523, at: 0, length: 0.08, wave: "square", volume: 0.06 },
      { freq: 784, at: 0.08, length: 0.12, wave: "square", volume: 0.06 },
    ],
  },
  swing: { notes: [{ freq: 500, slideTo: 180, at: 0, length: 0.09, wave: "triangle", volume: 0.08 }] },
  // A shinai hit is mostly a sharp burst of noise.
  clean: {
    noise: [{ at: 0, length: 0.09, volume: 0.22 }],
    notes: [{ freq: 880, at: 0.02, length: 0.14, wave: "square", volume: 0.05 }],
  },
  // A bright knock, as one shinai rides up the other.
  parry: { noise: [{ at: 0, length: 0.04, volume: 0.14 }], notes: [{ freq: 660, slideTo: 990, at: 0, length: 0.1, wave: "square", volume: 0.06 }] },
  // Light catching the tip: high and thin, so it cuts through everything else without getting in the way.
  ting: {
    notes: [
      { freq: 2637, at: 0, length: 0.16, wave: "sine", volume: 0.1 },
      { freq: 3951, at: 0, length: 0.09, wave: "sine", volume: 0.05 },
    ],
  },
  // Two guards meeting, with a body behind them.
  clash: { noise: [{ at: 0, length: 0.07, volume: 0.12 }], notes: [{ freq: 140, slideTo: 90, at: 0, length: 0.1, wave: "square", volume: 0.06 }] },
  blocked: { noise: [{ at: 0, length: 0.05, volume: 0.1 }], notes: [{ freq: 200, at: 0, length: 0.06, wave: "square", volume: 0.04 }] },
  break: { noise: [{ at: 0, length: 0.18, volume: 0.16 }], notes: [{ freq: 240, slideTo: 80, at: 0, length: 0.16, wave: "square", volume: 0.05 }] },
  secret: {
    notes: [523, 659, 784, 1047].map((freq, i) => ({ freq, at: i * 0.09, length: 0.14, wave: "square" as const, volume: 0.05 })),
  },
  flag: { notes: [{ freq: 660, at: 0, length: 0.05, wave: "triangle", volume: 0.06 }] },
  // A short, rough shout that climbs.
  kiai: {
    noise: [{ at: 0, length: 0.08, volume: 0.08 }],
    notes: [{ freq: 220, slideTo: 520, at: 0, length: 0.22, wave: "sawtooth", volume: 0.09 }],
  },
  // Calling men on each sayu men: much shorter and quieter than a kiai, because it isn't one.
  call: { notes: [{ freq: 300, slideTo: 380, at: 0, length: 0.08, wave: "sawtooth", volume: 0.05 }] },
  // The train's two-tone horn.
  horn: {
    notes: [
      { freq: 311, at: 0, length: 0.4, wave: "sawtooth", volume: 0.05 },
      { freq: 392, at: 0, length: 0.4, wave: "sawtooth", volume: 0.05 },
    ],
  },
  // Ding ding!
  bell: {
    notes: [
      { freq: 1568, at: 0, length: 0.16, wave: "triangle", volume: 0.09 },
      { freq: 1568, at: 0.2, length: 0.22, wave: "triangle", volume: 0.09 },
    ],
  },
};

function defaultContext(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

/** Beeps made in code. Browsers only allow sound after a key press, so it starts locked. */
export function createAudio(makeContext: () => AudioContext | null = defaultContext): GameAudio {
  let ctx: AudioContext | null = null;
  let muted = false;

  const playNote = (c: AudioContext, n: Note) => {
    const start = c.currentTime + n.at;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.wave;
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, start + n.length);
    gain.gain.setValueAtTime(n.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + n.length);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + n.length);
  };

  const playNoise = (c: AudioContext, n: Noise) => {
    const start = c.currentTime + n.at;
    const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * n.length)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(n.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + n.length);
    source.connect(gain);
    gain.connect(c.destination);
    source.start(start);
  };

  let noise: AudioBuffer | null = null;
  /** The same second of noise does for every consonant, so talking isn't making a new one twelve times a second. */
  const noiseOf = (c: AudioContext): AudioBuffer => {
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
  };

  const speakNoise = (c: AudioContext, kind: BiquadFilterType, freq: number, volume: number, start: number, length: number) => {
    const source = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    source.buffer = noiseOf(c);
    filter.type = kind;
    filter.frequency.value = freq;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start(start, Math.random() * 0.9, length);
  };

  const speak = (c: AudioContext, s: Syllable) => {
    const start = c.currentTime;
    const end = start + s.length;
    const osc = c.createOscillator();
    const mouth = c.createGain();
    osc.type = s.wave;
    osc.frequency.setValueAtTime(s.freq, start);
    osc.frequency.exponentialRampToValueAtTime(s.slideTo, end);
    mouth.gain.setValueAtTime(0.001, start);
    mouth.gain.linearRampToValueAtTime(s.volume, start + ATTACK);
    mouth.gain.setValueAtTime(s.volume, start + s.length * HOLD);
    mouth.gain.exponentialRampToValueAtTime(0.001, end);
    const route = (freq: number, q: number, level: number) => {
      const filter = c.createBiquadFilter();
      const gain = c.createGain();
      filter.type = "bandpass";
      // The mouth is still opening as the sound starts, which is much of what makes it read as talking.
      filter.frequency.setValueAtTime(freq * GLIDE, start);
      filter.frequency.exponentialRampToValueAtTime(freq, start + s.length * GLIDE_SHARE);
      filter.Q.value = q;
      gain.gain.value = level;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(mouth);
    };
    route(s.f1, F1_Q, 1);
    route(s.f2, F2_Q, F2_LEVEL);
    const buzz = c.createGain();
    buzz.gain.value = BUZZ_LEVEL;
    osc.connect(buzz);
    buzz.connect(mouth);
    mouth.connect(c.destination);
    osc.start(start);
    osc.stop(end);
    if (s.onset === "hiss") speakNoise(c, "highpass", HISS.cutoff, s.volume * HISS.volume, start, HISS.length);
    if (s.onset === "tick") speakNoise(c, "bandpass", TICK.center, s.volume * TICK.volume, start, TICK.length);
    if (s.breath > 0) speakNoise(c, "bandpass", s.f2, s.volume * s.breath, start, s.length);
  };

  return {
    say(syllable) {
      if (ctx && !muted) speak(ctx, syllable);
    },
    play(name) {
      if (!ctx || muted) return;
      const sound = SOUNDS[name];
      for (const note of sound.notes ?? []) playNote(ctx, note);
      for (const noise of sound.noise ?? []) playNoise(ctx, noise);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    unlock() {
      if (!ctx) ctx = makeContext();
      if (ctx?.state === "suspended") void ctx.resume();
    },
  };
}
