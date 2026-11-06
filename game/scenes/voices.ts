import type { Voice } from "../core/babble.ts";

type Tone = Partial<Omit<Voice, "pitch" | "every">>;

const voice = (pitch: number, every: number, tone: Tone = {}): Voice => ({ pitch, every, wave: "sawtooth", tract: 1, lilt: 1, fall: 2.5, volume: 0.2, breath: 0, ...tone });

/** How everyone sounds. Pace comes from how they talk, pitch and tract from who they are. */
export const VOICES: Record<string, Voice> = {
  // Pinecone, at home.
  "Sensei Kuma": voice(155, 6, { tract: 0.85, lilt: 0.7, fall: 2, volume: 0.28 }), // A big, unhurried bear of a teacher.
  "Senpai Momo": voice(345, 5, { tract: 1.12, lilt: 1.1, volume: 0.17 }), // Kind, and a bit ahead of you.
  Aki: voice(420, 4, { tract: 1.2, lilt: 1.8, fall: 1.5, volume: 0.19 }), // Never stops. Never stands still.
  Bo: voice(190, 7, { wave: "triangle", tract: 0.9, lilt: 0.3, fall: 1, volume: 0.34 }), // "Mm. Indigo runs."
  Yui: voice(390, 5, { tract: 1.15, lilt: 1.4, fall: 2, volume: 0.16 }), // A thousand suburi, nine of them right.
  Coach: voice(240, 5, { wave: "square", lilt: 0.6, fall: 1.5, volume: 0.18 }), // Brisk, and already on to the next thing.

  // Thunder Radish.
  Ren: voice(170, 8, { wave: "triangle", tract: 0.95, lilt: 0.25, fall: 1.5, volume: 0.31 }), // Used to be the loud one. Now says as little as possible, quietly.
  "Sensei Raiko": voice(265, 5, { wave: "square", lilt: 1.6, fall: 4, volume: 0.22 }), // A dojo should be loud. Each sentence comes down like a strike.
  Kei: voice(300, 6, { lilt: 0.6, volume: 0.18 }), // Dry, and on pickle duty.
  Dai: voice(185, 6, { tract: 0.9, lilt: 0.8, volume: 0.25 }), // Solid, and watches for the stare.

  // Angry Goose.
  Hana: voice(375, 4, { wave: "square", tract: 1.1, lilt: 1.3, fall: 1, volume: 0.11 }), // Can't wait, and honks a little.
  "Sensei Kan": voice(205, 5, { wave: "square", tract: 0.85, lilt: 0.8, fall: 3, volume: 0.2 }), // A bark. "Wipe your feet."
  Ida: voice(320, 6, { lilt: 0.8, fall: 2, volume: 0.17 }), // Stands their ground.
  Pip: voice(530, 4, { wave: "square", tract: 1.35, lilt: 1.6, volume: 0.11 }), // The smallest and the keenest.
  Tetsu: voice(215, 7, { tract: 0.95, lilt: 0.5, fall: 1, volume: 0.27 }), // Sure, and tall with it.

  // Sleepy Raccoon.
  Sora: voice(235, 8, { wave: "triangle", lilt: 0.9, fall: 5, breath: 0.35, volume: 0.27 }), // Dozing off partway through every sentence.
  "Sensei Nemu": voice(180, 8, { wave: "triangle", tract: 0.9, lilt: 0.6, fall: 6, volume: 0.31, breath: 0.45 }), // Further along than Sora, and worse to wake.
  Niko: voice(350, 6, { tract: 1.05, lilt: 1, fall: 3, volume: 0.17 }), // Thinks noon is morning.
  Rio: voice(305, 7, { tract: 1.05, lilt: 1.2, fall: 3, breath: 0.1, volume: 0.21 }), // Keeps snacks in the plant pot.

  // Iron Heron.
  Mika: voice(285, 8, { wave: "triangle", tract: 1.05, lilt: 0.2, fall: 0.5, volume: 0.14 }), // Level as still water.
  "Sensei Hagane": voice(135, 8, { wave: "square", tract: 0.8, lilt: 0.15, fall: 0.5, volume: 0.21 }), // Iron. It rings, low, and doesn't bend.
  Teo: voice(260, 8, { lilt: 0.4, fall: 1, volume: 0.19 }), // In this spot since before lunch.
  Uma: voice(225, 7, { wave: "triangle", lilt: 0.35, fall: 1, volume: 0.36 }), // It's boring here. That's what it's for.
  Shin: voice(250, 7, { tract: 0.95, lilt: 0.3, fall: 1.5, volume: 0.2 }), // Has heard that joke.

  // Soggy Otter.
  Kenji: voice(365, 4, { tract: 1.1, lilt: 2.2, fall: 1, volume: 0.19 }), // A thousand suburi, in the rain, on purpose.
  "Sensei Mizu": voice(250, 6, { wave: "triangle", tract: 1.05, lilt: 1.4, fall: 2.5, volume: 0.33 }), // Round and burbling, like a leak.
  Val: voice(280, 6, { wave: "triangle", lilt: 1, fall: 2, volume: 0.2 }), // Named the buckets.
  Wes: voice(210, 6, { lilt: 0.8, fall: 2, breath: 0.08, volume: 0.25 }), // Fond of the damp towel.

  // Out on the road, and up at the hall.
  "Old Gen": voice(140, 7, { tract: 0.9, lilt: 1.4, fall: 3, volume: 0.33, breath: 0.3 }), // Fifty years of shouting at the hills.
  Fumi: voice(330, 6, { wave: "triangle", tract: 1.05, lilt: 0.7, fall: 2, volume: 0.15 }), // Careful with their hands and their words.
  "Examiner Ono": voice(200, 6, { wave: "square", tract: 0.95, lilt: 0.2, fall: 1.5, volume: 0.15 }), // Reads you out like a form.

  // The neighbours the Alley Cats pick on.
  "Auntie Bea": voice(310, 6, { wave: "triangle", tract: 1.1, lilt: 1.5, fall: 3, volume: 0.21 }), // Warm. Have a plum.
  "Little Tomo": voice(600, 5, { tract: 1.45, lilt: 1.5, fall: 2, volume: 0.2 }), // Small, and upset about it.
  "Old Finn": voice(150, 7, { tract: 0.95, lilt: 1, fall: 2.5, breath: 0.4, volume: 0.29 }), // Salt in the lungs.
  "Nana Pim": voice(430, 7, { wave: "triangle", tract: 1.25, lilt: 1.8, fall: 3, breath: 0.25, volume: 0.18 }), // A very small voice with a very large pie.
  "Big Lou": voice(115, 6, { tract: 0.78, lilt: 0.6, fall: 2, volume: 0.33 }), // Runs the gate. The gate listens.
  Dot: voice(460, 4, { wave: "square", tract: 1.3, lilt: 1.2, fall: 1.5, volume: 0.1 }), // Quick, and outraged about the waterfall.
  Mo: voice(275, 5, { tract: 1.05, lilt: 1.7, fall: 2, volume: 0.23 }), // Sings the ice cream menu.
  "Alley Cat": voice(330, 4, { wave: "square", tract: 1.2, lilt: 2.4, fall: -1, volume: 0.13, breath: 0.2 }), // Sneers upward at the end of everything.
};

/** Other ways the same people get written down. */
const ALSO_KNOWN_AS: Record<string, string> = { Sensei: "Sensei Kuma", Momo: "Senpai Momo" };

/** Whoever goes by this name. Narration and labels like "Tare: ..." have no one behind them, so they're silent. */
export const voiceOf = (name: string | null): Voice | null => (name === null ? null : VOICES[ALSO_KNOWN_AS[name] ?? name] ?? null);
