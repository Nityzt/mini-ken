import { createBrawl, HIT_DAMAGE, OPEN_DURING_TELL, stepBrawl, type BrawlEvent, type BrawlSpec, type BrawlState, type Bully } from "./brawl.ts";
import { RANGE_MAX, RANGE_MIN } from "./constants.ts";
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

/** How a street fight's gang comes at you: a harder line run the further out it is. */
export type StreetPace = {
  /** How long a bully holds their opening before their swing lands, in ticks. */
  window: number;
  /** How fast each one walks up to you. */
  approach: number;
};

/** A street fight shows its keys for your first fight or two, like the line's first two runs, and then never again. */
export const STREET_PROMPT_FIGHTS = 2;
export const streetLabels = (fightsWon: number): boolean => fightsWon < STREET_PROMPT_FIGHTS;

const FIRST_AT = 130;
/** Far enough apart that sliding through one senpai carries you up to the next. */
export const SPACING = 84;
const TARGETS: Target[] = ["men", "kote", "do"];
/**
 * Once a senpai has opened up, walking on stops here, comfortably inside striking distance. Holding D while you read
 * the opening used to carry you close enough to lock hilts and then walk you past them: a miss for being slow to read.
 */
export const STRIKING_GAP = Math.round((RANGE_MIN + RANGE_MAX) / 2) + 2;

/**
 * Squared up and shut, between stopping in front of you and opening up. It's always longer than it takes to swing and
 * recover, so a strike thrown before the opening is always caught: mashing never lands on one by luck.
 */
export const STREET_GUARD_MIN = 40;
const STREET_GUARD_SPREAD = 30;
/** How long a bully who's just hit you takes to come again. The first part of it is the swing itself. */
export const STREET_RECOVER_TICKS = 40;
/** The rest of the gang hangs back this far, waiting their turn. */
const HANG_BACK = 70;
/** A hit throws you back out of reach, so the bully has to walk in again. */
const KNOCKBACK = 14;
const KNOCKBACK_SPEED = 2;
const KNOCKBACK_FLOOR = 24;

export type LineResult = "clean" | "miss" | null;
/**
 * `missed` comes with every miss, whatever the reason, so none of them goes unannounced. `early` is a strike at
 * someone who hadn't opened up yet. In a street fight `struck` is the bully hitting you for it.
 */
export type LineNote = "opened" | "slow" | "passed" | "missed" | "early" | "struck";
export type LineState = {
  brawl: BrawlState;
  spec: LineSpec;
  /** What each senpai will offer, chosen ahead of time. */
  openings: Target[];
  /** In a line drill a miss is final. In a street fight only a clean answer is: a miss and they come at you again. */
  results: LineResult[];
  /** Whose turn it is, or null once everyone's done. */
  active: number | null;
  windowLeft: number;
  notes: LineNote[];
  events: BrawlEvent[];
  done: boolean;
  left: boolean;
  /** A street fight: the line drill for real. Nobody waits for you, and a miss gets you hit. */
  street: StreetPace | null;
  /** Times a bully made you pay for a miss. */
  misses: number;
  /** How much further a hit is still throwing you back. */
  pushback: number;
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

const lineState = (brawl: BrawlState, spec: LineSpec, openings: Target[], street: StreetPace | null): LineState => ({
  brawl,
  spec,
  openings,
  results: Array.from({ length: spec.count }, () => null),
  active: 0,
  windowLeft: 0,
  notes: [],
  events: [],
  done: false,
  left: false,
  street,
  misses: 0,
  pushback: 0,
});

export function createLine(options: { tier: number; seed: number; kiMax?: number }): LineState {
  const spec = LINE_TIERS[options.tier];
  const brawl = createBrawl({
    bullies: Array.from({ length: spec.count }, (_, i) => ({ kind: "fist" as const, x: FIRST_AT + i * SPACING })),
    seed: options.seed,
    kiMax: options.kiMax,
  });
  return lineState(brawl, spec, planOpenings(spec.count, options.seed), null);
}

/** A street fight, as a line drill: the gang comes at you one at a time, and what each one does says what's open. */
export function createStreet(options: { gang: BrawlSpec[]; pace: StreetPace; labels: boolean; seed: number; kiMax?: number; hp?: number }): LineState {
  const brawl = createBrawl({ bullies: options.gang, seed: options.seed, kiMax: options.kiMax, hp: options.hp });
  const count = options.gang.length;
  const spec: LineSpec = { count, window: options.pace.window, need: count, labels: options.labels };
  return lineState(brawl, spec, options.gang.map((b) => OPEN_DURING_TELL[b.kind]), options.pace);
}

function roll(brawl: BrawlState, size: number): number {
  const r = nextRandom(brawl.rng);
  brawl.rng = r.seed;
  return Math.floor(r.value * size);
}

/** A street bully's turn: walk up, square up, then open. Returns true the moment they open. */
function comeOn(brawl: BrawlState, bully: Bully, pace: StreetPace): boolean {
  const gap = bully.x - brawl.player.x;
  if (bully.state === "recover" || bully.state === "cower") {
    if (--bully.ticks <= 0) bully.state = "walk";
    return false;
  }
  if (bully.state === "wait" || bully.state === "walk") {
    if (Math.abs(gap - STRIKING_GAP) > pace.approach) {
      bully.state = "walk";
      bully.x -= Math.sign(gap - STRIKING_GAP) * pace.approach;
      return false;
    }
    bully.state = "guard";
    bully.ticks = STREET_GUARD_MIN + roll(brawl, STREET_GUARD_SPREAD);
    return false;
  }
  if (bully.state === "guard") {
    // Backing off out of reach just makes them follow you.
    if (gap > RANGE_MAX) bully.state = "walk";
    else if (--bully.ticks <= 0) return true;
  }
  return false;
}

/** The rest of the gang keeps its distance until it's their turn. */
function hangBack(brawl: BrawlState, active: number | null): void {
  for (const b of brawl.bullies) {
    if (b.id === active || b.state === "down") continue;
    if (b.state === "cower") b.state = "wait";
    if (b.x - brawl.player.x < HANG_BACK) b.x = Math.min(brawl.worldEnd - 24, b.x + 1);
  }
}

/** One step of the drill. Every senpai gets one try: anything but the whole combination on the right target is a miss. */
export function stepLine(state: LineState, input: FighterInput): LineState {
  if (state.done) return { ...state, notes: [], events: [] };
  const { street } = state;
  const waiting = state.active === null ? null : state.brawl.bullies[state.active];
  // On the street you never walk into the bully whose turn it is, whatever they're doing: they come to you.
  const squaredUp = !!waiting && (!!waiting.opening || !!street);
  const atDistance = squaredUp && !state.brawl.zanshin && input.move > 0 && waiting!.x - state.brawl.player.x <= STRIKING_GAP;
  const brawl = stepBrawl(state.brawl, { ...input, move: atDistance ? 0 : input.move, seme: !!street && !!input.seme });
  const results = [...state.results];
  const notes: LineNote[] = [];
  let { active, windowLeft, misses, pushback } = state;

  /** In the line, a miss is that senpai done. On the street, that bully hits you and comes again. */
  const resolve = (result: LineResult) => {
    if (active === null) return;
    const senpai = brawl.bullies[active];
    senpai.opening = null;
    windowLeft = 0;
    if (result === "miss") notes.push("missed");
    if (street && result === "miss") {
      hitBack(senpai);
      return;
    }
    results[active] = result;
    senpai.state = "down";
    active = active + 1 < results.length ? active + 1 : null;
  };

  const hitBack = (bully: Bully) => {
    misses++;
    notes.push("struck");
    brawl.events.push({ type: "swing", bully: bully.id }, { type: "hurt", bully: bully.id });
    brawl.hp = Math.max(0, brawl.hp - HIT_DAMAGE[bully.kind]);
    bully.state = "recover";
    bully.ticks = STREET_RECOVER_TICKS;
    const p = brawl.player;
    // Never off the start of the street, where walking back would mean leaving.
    pushback = Math.max(0, p.x - Math.max(KNOCKBACK_FLOOR, Math.min(p.x, bully.x - STRIKING_GAP) - KNOCKBACK));
    if (brawl.hp <= 0) brawl.phase = "lost";
  };

  if (brawl.phase === "fled") {
    return { ...state, brawl, results, notes, events: brawl.events, active: null, done: true, left: true };
  }

  for (const event of brawl.events.slice()) {
    if (event.type === "clean") resolve("clean");
    else if (event.type === "blocked") {
      const shut = active !== null && !state.brawl.bullies[active].opening;
      if (shut) notes.push("early");
      // A bully who's just swung at you isn't ready to punish anything yet.
      if (!(street && state.brawl.bullies[active!]?.state === "recover")) resolve("miss");
    } else if (event.type === "flat" || event.type === "nozanshin") resolve("miss");
    else if (event.type === "hit" && active !== null) {
      brawl.bullies[active].opening = null;
      windowLeft = 0;
    }
  }

  // Seme made them flinch: whatever they were about to do is off, and for a moment they're open everywhere.
  if (street && active !== null && brawl.bullies[active].state === "cower" && state.brawl.bullies[active].state !== "cower") windowLeft = 0;

  if (street && pushback > 0) {
    const step = Math.min(KNOCKBACK_SPEED, pushback);
    brawl.player.x = Math.max(0, brawl.player.x - step);
    pushback -= step;
  }

  if (active !== null && !brawl.zanshin && brawl.phase === "fight") {
    const senpai = brawl.bullies[active];
    const gap = senpai.x - brawl.player.x;
    if (gap < 0 && !street) {
      notes.push("passed");
      resolve("miss");
    } else if (windowLeft === 0 && (street ? comeOn(brawl, senpai, street) : gap <= RANGE_MAX)) {
      senpai.opening = state.openings[active];
      if (street) senpai.state = "tell";
      windowLeft = state.spec.window;
      notes.push("opened");
    } else if (street && windowLeft > 0 && gap > RANGE_MAX) {
      // You backed off out of reach, so they put their hands down and follow you.
      senpai.opening = null;
      senpai.state = "walk";
      windowLeft = 0;
    } else if (windowLeft > 0 && brawl.player.stance !== "windup" && --windowLeft === 0) {
      notes.push("slow");
      resolve("miss");
    }
  }
  if (street) hangBack(brawl, active);

  const over = street ? brawl.phase !== "fight" : results.every((r) => r !== null);
  return { ...state, brawl, results, active, windowLeft, misses, pushback, notes, events: brawl.events, done: over };
}

export const lineCleans = (state: LineState): number => state.results.filter((r) => r === "clean").length;
export const linePassed = (state: LineState): boolean => state.done && !state.left && lineCleans(state) >= state.spec.need;
