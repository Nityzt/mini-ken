import { RANGE_MAX, DRILL_STOMP_WINDOW, SWING_COST, ZANSHIN_PASS, ZANSHIN_SLIDE } from "./constants.ts";

/**
 * Kirikaeshi: a big men with fumikomi, four sayu men forward, five back, the same again, and a last big
 * men with follow-through. Ki only comes back in the reset before each big men, so the two chains are
 * what test your stamina. You set the pace (owner, 2026-11-09, issue #17): every strike waits for you,
 * and nothing fails for being slow. Bo still keeps a beat, from a real set's 0.45s a strike (27 ticks),
 * and sayu men that land on it build a rhythm streak, which is only ever a bonus.
 */

export type Side = "left" | "right";
export type KirikaeshiBeat = {
  kind: "big" | "sayu";
  /** Which side of the head a sayu men goes to. */
  side?: Side;
  /** Which way the pair travel on this strike. */
  dir: 1 | -1;
  /** The last strike, which has to be followed through. */
  final?: boolean;
  cost: number;
};

/** A sayu men is cheaper than a full strike, or nobody could finish a set. Tuned so a clean set nearly empties a starting bar. */
const SAYU_COST = 5;
/** What a miss costs on top. */
const MISS_COST = 6;
export const MISSES_ALLOWED = 4;

/** Squaring up before the first big men. */
const OPENING_TICKS = 30;
/** The step back to distance before the next big men, and the only time you get your breath back. */
const BREATH_TICKS = 40;
/** What one step back gives you, the same however long you then wait, so waiting is a choice and not a refill. */
const BREATH_KI = 30;
/** Driving in to the partner's hands and coming apart, before the chain starts. A sayu men cuts it short. */
const CONTACT_TICKS = 30;

/** How far apart you stand for a big men, for a sayu men, and how far one step of a chain carries the pair. */
const KAMAE_GAP = RANGE_MAX;
const CONTACT_GAP = 14;
const SAYU_GAP = 34;
const STEP = 7;

const big = (final = false): KirikaeshiBeat => ({ kind: "big", dir: 1, cost: SWING_COST, ...(final ? { final } : {}) });
const sayu = (index: number, dir: 1 | -1): KirikaeshiBeat => ({ kind: "sayu", side: index % 2 === 0 ? "left" : "right", dir, cost: SAYU_COST });
const chain = (): KirikaeshiBeat[] => Array.from({ length: 9 }, (_, i) => sayu(i, i < 4 ? 1 : -1));

export const KIRIKAESHI_SEQUENCE: KirikaeshiBeat[] = [big(), ...chain(), big(), ...chain(), big(true)];

/**
 * The beat Bo keeps, slow at first and then up to the speed of the real thing. It's only something to aim for:
 * a sayu men landing within `window` ticks of it counts as in rhythm.
 */
export const KIRIKAESHI_TIERS = [
  { interval: 34, window: 10 },
  { interval: 30, window: 9 },
  { interval: 27, window: 8 },
];
export const kirikaeshiTierFor = (passes: number): number => Math.min(passes, KIRIKAESHI_TIERS.length - 1);
/** How many sayu men there are to keep in rhythm. */
export const SAYU_COUNT = KIRIKAESHI_SEQUENCE.filter((beat) => beat.kind === "sayu").length;

export type KirikaeshiInput = { left: boolean; right: boolean; men: boolean; stomp: boolean; hold: boolean };
export type KirikaeshiEvent =
  | { type: "kiai" }
  | { type: "call"; side: Side; onBeat: boolean }
  | { type: "stomp" }
  | { type: "windowOpen" }
  | { type: "wrong" | "flat" };
export type KirikaeshiOutcome = "passed" | "winded" | "lost";
export type KirikaeshiPhase = "breath" | "big" | "contact" | "rhythm" | "follow";

export type KirikaeshiState = {
  spec: (typeof KIRIKAESHI_TIERS)[number];
  phase: KirikaeshiPhase;
  /** Ticks left in the phases that are just a movement playing out: the step back, and the push. */
  ticks: number;
  /** Which strike of the sequence is next. */
  beat: number;
  /** Ticks until the next sayu men would be on the beat, and negative once it's gone by. Nothing happens when it does. */
  dueIn: number;
  /** Sayu men on the beat in a row, and in all. */
  streak: number;
  onBeat: number;
  ki: number;
  kiMax: number;
  misses: number;
  /** Ticks since the last stomp. */
  stompAge: number;
  playerX: number;
  partnerX: number;
  /** How far the last men has slid through. */
  traveled: number;
  /** The side of the last sayu men, for the pose. */
  lastSide: Side | null;
  events: KirikaeshiEvent[];
  outcome: KirikaeshiOutcome | null;
};

export function createKirikaeshi(options: { tier: number; kiMax: number }): KirikaeshiState {
  return {
    spec: KIRIKAESHI_TIERS[options.tier],
    phase: "breath",
    ticks: OPENING_TICKS,
    beat: 0,
    dueIn: 0,
    streak: 0,
    onBeat: 0,
    ki: options.kiMax,
    kiMax: options.kiMax,
    misses: 0,
    stompAge: Infinity,
    playerX: 0,
    partnerX: KAMAE_GAP,
    traveled: 0,
    lastSide: null,
    events: [],
    outcome: null,
  };
}

/** The distance the last men has to slide: past the partner, from up close. */
export const FOLLOW_NEEDED = CONTACT_GAP + ZANSHIN_PASS;

export function stepKirikaeshi(state: KirikaeshiState, input: KirikaeshiInput): KirikaeshiState {
  if (state.outcome) return state.events.length ? { ...state, events: [] } : state;
  const s: KirikaeshiState = { ...state, events: [], stompAge: state.stompAge + 1 };
  if (input.stomp) {
    s.stompAge = 0;
    if (s.phase === "breath" || s.phase === "big") s.events.push({ type: "stomp" });
  }
  PHASES[s.phase](s, input);
  if (s.outcome) return s;
  if (s.ki <= 0) s.outcome = "winded";
  else if (s.misses > MISSES_ALLOWED) s.outcome = "lost";
  return s;
}

const miss = (s: KirikaeshiState, type: "wrong" | "flat"): void => {
  s.events.push({ type });
  s.streak = 0;
  s.misses++;
  s.ki = Math.max(0, s.ki - MISS_COST);
};

const afterBig = (s: KirikaeshiState): void => {
  const beat = KIRIKAESHI_SEQUENCE[s.beat];
  s.beat++;
  s.playerX = s.partnerX - CONTACT_GAP;
  s.phase = beat.final ? "follow" : "contact";
  s.ticks = CONTACT_TICKS;
};

const toRhythm = (s: KirikaeshiState): void => {
  s.phase = "rhythm";
  s.partnerX = s.playerX + SAYU_GAP;
  s.dueIn = s.spec.interval;
};

/** A sayu men, whenever it comes. The wrong side is the only way to slip. */
const sayuMen = (s: KirikaeshiState, pressed: Side): void => {
  const beat = KIRIKAESHI_SEQUENCE[s.beat];
  if (pressed !== beat.side) return miss(s, "wrong");
  const onBeat = Math.abs(s.dueIn) <= s.spec.window;
  s.streak = onBeat ? s.streak + 1 : 0;
  if (onBeat) s.onBeat++;
  s.ki = Math.max(0, s.ki - beat.cost);
  s.lastSide = pressed;
  s.events.push({ type: "call", side: pressed, onBeat });
  s.beat++;
  s.playerX += STEP * beat.dir;
  s.partnerX += STEP * beat.dir;
  s.dueIn = s.spec.interval;
  if (KIRIKAESHI_SEQUENCE[s.beat].kind === "big") {
    s.phase = "breath";
    s.ticks = BREATH_TICKS;
    s.playerX = 0;
    s.partnerX = KAMAE_GAP;
  }
};

const sidePressed = (input: KirikaeshiInput): Side | null => (input.left ? "left" : input.right ? "right" : null);

const PHASES: Record<KirikaeshiPhase, (s: KirikaeshiState, input: KirikaeshiInput) => void> = {
  // Stepping back to distance, getting your breath back as you go. The first time, you're already rested.
  breath(s) {
    if (s.beat > 0) s.ki = Math.min(s.kiMax, s.ki + BREATH_KI / BREATH_TICKS);
    if (--s.ticks <= 0) s.phase = "big";
  },
  // Bo waits in kamae for as long as you like.
  big(s, input) {
    if (!input.men) return;
    if (s.stompAge > DRILL_STOMP_WINDOW) miss(s, "flat");
    s.ki = Math.max(0, s.ki - KIRIKAESHI_SEQUENCE[s.beat].cost);
    s.events.push({ type: "kiai" });
    afterBig(s);
  },
  contact(s, input) {
    const pressed = sidePressed(input);
    if (pressed) {
      // Going straight into the first sayu men cuts the push short. That's quicker than any beat, so it isn't on it.
      toRhythm(s);
      s.dueIn = Infinity;
      sayuMen(s, pressed);
      return;
    }
    if (--s.ticks <= 0) toRhythm(s);
  },
  rhythm(s, input) {
    s.dueIn--;
    if (s.dueIn === s.spec.window) s.events.push({ type: "windowOpen" });
    const pressed = sidePressed(input);
    if (pressed) sayuMen(s, pressed);
  },
  // The last men goes all the way through Bo, at whatever speed you hold it.
  follow(s, input) {
    if (!input.hold) return;
    s.traveled += ZANSHIN_SLIDE;
    s.playerX += ZANSHIN_SLIDE;
    if (s.traveled >= FOLLOW_NEEDED) s.outcome = "passed";
  },
};
