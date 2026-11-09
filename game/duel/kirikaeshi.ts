import { KI_RECOVERY, RANGE_MAX, DRILL_STOMP_WINDOW, SWING_COST, ZANSHIN_PASS, ZANSHIN_SLIDE, ZANSHIN_WINDOW } from "./constants.ts";

/**
 * Kirikaeshi: a big men with fumikomi, four sayu men forward, five back, the same again, and a last big
 * men with follow-through. Ki only comes back in the reset before each big men, so the two chains are
 * what test your stamina. Timings come from a real set: 0.45s a strike, or 27 ticks.
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

const OPENING_TICKS = 60;
/** The step back to distance before the next big men, and the only time you get to breathe. */
const BREATH_TICKS = 120;
export const BIG_WINDOW = 90;
/** Driving in to the partner's hands and coming apart, before the chain starts. */
const CONTACT_TICKS = 40;

/** How far apart you stand for a big men, for a sayu men, and how far one step of a chain carries the pair. */
const KAMAE_GAP = RANGE_MAX;
const CONTACT_GAP = 14;
const SAYU_GAP = 34;
const STEP = 7;

const big = (final = false): KirikaeshiBeat => ({ kind: "big", dir: 1, cost: SWING_COST, ...(final ? { final } : {}) });
const sayu = (index: number, dir: 1 | -1): KirikaeshiBeat => ({ kind: "sayu", side: index % 2 === 0 ? "left" : "right", dir, cost: SAYU_COST });
const chain = (): KirikaeshiBeat[] => Array.from({ length: 9 }, (_, i) => sayu(i, i < 4 ? 1 : -1));

export const KIRIKAESHI_SEQUENCE: KirikaeshiBeat[] = [big(), ...chain(), big(), ...chain(), big(true)];

/** Slow at first, then up to the speed of the real thing. */
export const KIRIKAESHI_TIERS = [
  { interval: 34, window: 10 },
  { interval: 30, window: 9 },
  { interval: 27, window: 8 },
];
export const kirikaeshiTierFor = (passes: number): number => Math.min(passes, KIRIKAESHI_TIERS.length - 1);

export type KirikaeshiInput = { left: boolean; right: boolean; men: boolean; stomp: boolean; hold: boolean };
export type KirikaeshiEvent =
  | { type: "kiai" }
  | { type: "call"; side: Side }
  | { type: "stomp" }
  | { type: "windowOpen" }
  | { type: "wrong" | "rushed" | "late" | "flat" | "slow" };
export type KirikaeshiOutcome = "passed" | "winded" | "lost" | "noFollow";
export type KirikaeshiPhase = "breath" | "big" | "contact" | "rhythm" | "follow";

export type KirikaeshiState = {
  spec: (typeof KIRIKAESHI_TIERS)[number];
  phase: KirikaeshiPhase;
  /** Ticks left in this phase. */
  ticks: number;
  /** Which strike of the sequence is next. */
  beat: number;
  /** Ticks until the next sayu men is due, and negative once it's overdue. */
  dueIn: number;
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

const miss = (s: KirikaeshiState, type: "wrong" | "rushed" | "late" | "flat" | "slow"): void => {
  s.events.push({ type });
  s.misses++;
  s.ki = Math.max(0, s.ki - MISS_COST);
};

const toBig = (s: KirikaeshiState): void => {
  s.phase = "big";
  s.ticks = BIG_WINDOW;
};

const afterBig = (s: KirikaeshiState): void => {
  const beat = KIRIKAESHI_SEQUENCE[s.beat];
  s.beat++;
  s.playerX = s.partnerX - CONTACT_GAP;
  if (beat.final) {
    s.phase = "follow";
    s.ticks = ZANSHIN_WINDOW;
    return;
  }
  s.phase = "contact";
  s.ticks = CONTACT_TICKS;
};

const nextSayu = (s: KirikaeshiState, dir: 1 | -1, dueIn: number): void => {
  s.beat++;
  s.playerX += STEP * dir;
  s.partnerX += STEP * dir;
  s.dueIn = dueIn;
  if (KIRIKAESHI_SEQUENCE[s.beat].kind === "big") {
    s.phase = "breath";
    s.ticks = BREATH_TICKS;
    s.playerX = 0;
    s.partnerX = KAMAE_GAP;
  }
};

const PHASES: Record<KirikaeshiPhase, (s: KirikaeshiState, input: KirikaeshiInput) => void> = {
  breath(s) {
    s.ki = Math.min(s.kiMax, s.ki + KI_RECOVERY);
    if (--s.ticks <= 0) toBig(s);
  },
  big(s, input) {
    if (input.men) {
      if (s.stompAge > DRILL_STOMP_WINDOW) miss(s, "flat");
      s.ki = Math.max(0, s.ki - KIRIKAESHI_SEQUENCE[s.beat].cost);
      s.events.push({ type: "kiai" });
      afterBig(s);
    } else if (--s.ticks <= 0) {
      miss(s, "slow");
      // Nothing can end the set but the last men itself, so that one's the end of it.
      if (KIRIKAESHI_SEQUENCE[s.beat].final) s.outcome = "noFollow";
      else afterBig(s);
    }
  },
  contact(s) {
    if (--s.ticks > 0) return;
    s.phase = "rhythm";
    s.partnerX = s.playerX + SAYU_GAP;
    s.dueIn = s.spec.interval;
  },
  rhythm(s, input) {
    const beat = KIRIKAESHI_SEQUENCE[s.beat];
    s.dueIn--;
    if (s.dueIn === s.spec.window) s.events.push({ type: "windowOpen" });
    const pressed: Side | null = input.left ? "left" : input.right ? "right" : null;
    if (pressed) {
      if (pressed !== beat.side) return miss(s, "wrong");
      if (s.dueIn > s.spec.window) return miss(s, "rushed");
      if (s.dueIn >= -s.spec.window) {
        s.ki = Math.max(0, s.ki - beat.cost);
        s.lastSide = pressed;
        s.events.push({ type: "call", side: pressed });
        nextSayu(s, beat.dir, s.spec.interval);
        return;
      }
    }
    if (s.dueIn < -s.spec.window) {
      miss(s, "late");
      // Keep the beat where it was, so the rhythm doesn't slip along with you.
      nextSayu(s, beat.dir, s.spec.interval + s.dueIn);
    }
  },
  follow(s, input) {
    if (input.hold) {
      s.traveled += ZANSHIN_SLIDE;
      s.playerX += ZANSHIN_SLIDE;
    }
    if (s.traveled >= FOLLOW_NEEDED) s.outcome = "passed";
    else if (--s.ticks <= 0) s.outcome = "noFollow";
  },
};
