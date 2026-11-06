import { createBrawl, stepBrawl, type BrawlEvent, type BrawlState } from "./brawl.ts";
import { RANGE_MAX } from "./constants.ts";
import { nextRandom } from "./rival.ts";
import type { FighterInput, Target } from "./rules.ts";

export type LineSpec = {
  /** How many senpai stand in the line. */
  count: number;
  /** How long each one holds an opening, in ticks. */
  window: number;
  /** How many clean hits pass the run. */
  need: number;
  /** Show which key answers each opening. */
  labels: boolean;
};

/** Each pass moves you up. The last one asks you to read the openings with no key shown. */
export const LINE_TIERS: LineSpec[] = [
  { count: 4, window: 150, need: 3, labels: true },
  { count: 5, window: 110, need: 4, labels: true },
  { count: 5, window: 90, need: 4, labels: false },
];
export const lineTierFor = (passes: number): number => Math.min(passes, LINE_TIERS.length - 1);

const FIRST_AT = 130;
/** Far enough apart that sliding through one senpai carries you up to the next. */
const SPACING = 84;
const TARGETS: Target[] = ["men", "kote", "do"];

export type LineResult = "clean" | "miss" | null;
export type LineNote = "opened" | "slow" | "passed";
export type LineState = {
  brawl: BrawlState;
  spec: LineSpec;
  /** What each senpai will offer, chosen ahead of time. */
  openings: Target[];
  results: LineResult[];
  /** Whose turn it is, or null once everyone's done. */
  active: number | null;
  windowLeft: number;
  notes: LineNote[];
  events: BrawlEvent[];
  done: boolean;
  left: boolean;
};

/** All three targets come up, and never the same one twice in a row. */
function planOpenings(count: number, seed: number): Target[] {
  let rng = seed;
  const roll = (size: number) => {
    const r = nextRandom(rng);
    rng = r.seed;
    return Math.floor(r.value * size);
  };
  const pool = [...TARGETS];
  const plan: Target[] = [];
  while (pool.length) plan.push(pool.splice(roll(pool.length), 1)[0]);
  while (plan.length < count) {
    const others = TARGETS.filter((t) => t !== plan[plan.length - 1]);
    plan.push(others[roll(others.length)]);
  }
  return plan;
}

export function createLine(options: { tier: number; seed: number; kiMax?: number }): LineState {
  const spec = LINE_TIERS[options.tier];
  const brawl = createBrawl({
    bullies: Array.from({ length: spec.count }, (_, i) => ({ kind: "fist" as const, x: FIRST_AT + i * SPACING })),
    seed: options.seed,
    kiMax: options.kiMax,
    drill: true,
  });
  for (const senpai of brawl.bullies) senpai.opening = null;
  return {
    brawl,
    spec,
    openings: planOpenings(spec.count, options.seed),
    results: Array.from({ length: spec.count }, () => null),
    active: 0,
    windowLeft: 0,
    notes: [],
    events: [],
    done: false,
    left: false,
  };
}

/** One step of the drill. Every senpai gets one try: anything but the whole combination on the right target is a miss. */
export function stepLine(state: LineState, input: FighterInput): LineState {
  if (state.done) return { ...state, notes: [], events: [] };
  const brawl = stepBrawl(state.brawl, { ...input, seme: false });
  const results = [...state.results];
  const notes: LineNote[] = [];
  let { active, windowLeft } = state;

  const resolve = (result: LineResult) => {
    if (active === null) return;
    results[active] = result;
    const senpai = brawl.bullies[active];
    senpai.state = "down";
    senpai.opening = null;
    windowLeft = 0;
    active = active + 1 < results.length ? active + 1 : null;
  };

  if (brawl.phase === "fled") {
    return { ...state, brawl, results, notes, events: brawl.events, active: null, done: true, left: true };
  }

  for (const event of brawl.events) {
    if (event.type === "clean") resolve("clean");
    else if (event.type === "blocked" || event.type === "flat" || event.type === "nozanshin") resolve("miss");
    else if (event.type === "hit" && active !== null) {
      brawl.bullies[active].opening = null;
      windowLeft = 0;
    }
  }

  if (active !== null && !brawl.zanshin) {
    const senpai = brawl.bullies[active];
    const gap = senpai.x - brawl.player.x;
    if (gap < 0) {
      notes.push("passed");
      resolve("miss");
    } else if (windowLeft === 0 && gap <= RANGE_MAX) {
      senpai.opening = state.openings[active];
      windowLeft = state.spec.window;
      notes.push("opened");
    } else if (windowLeft > 0 && brawl.player.stance !== "windup" && --windowLeft === 0) {
      notes.push("slow");
      resolve("miss");
    }
  }

  return { ...state, brawl, results, active, windowLeft, notes, events: brawl.events, done: results.every((r) => r !== null) };
}

export const lineCleans = (state: LineState): number => state.results.filter((r) => r === "clean").length;
export const linePassed = (state: LineState): boolean => state.done && !state.left && lineCleans(state) >= state.spec.need;
