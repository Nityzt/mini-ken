import { OPENING_MIN, PARRY_LATEST_TAP, RANGE_MAX, RANGE_MIN, REPARRY_WINDOW } from "./constants.ts";
import { nextRandom } from "./rival.ts";
import { createDuel, distance, exposedTargets, skipBow, step, ticksNext, type AttackKind, type DuelState, type FighterInput, type Opening, type Target } from "./rules.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
/** About 250ms, plus the 50ms lockstep holds every input back, counted in the duel's 25ms ticks. */
const REACTION = 12;
/** How long it takes to notice a strike's started, from a good moment to a bad one. A short strike can land before anyone reacts to it. */
const STRIKE_REACTION_MIN = 9;
const STRIKE_REACTION_SPREAD = 10;
const WATCHFUL = 0.5;
const STOMP_AT = 3;
const CUTS: Target[] = ["men", "kote", "do"];
const OPENINGS: Opening[] = ["raise", "wrist", "drop"];
const STRIKING = RANGE_MAX - 4;

/** One player: reads the match, and says what to press. */
export type Style = (duel: DuelState) => FighterInput;
export type StyleName = "idle" | "masher" | "turtle" | "runner" | "reader" | "baiter" | "counterOnly" | "pressurer" | "clockRunner";

type Sense = {
  me: DuelState["fighters"][0];
  them: DuelState["fighters"][0];
  gap: number;
  toward: -1 | 1;
  away: -1 | 1;
  /** How long they've been showing an opening, or swinging from one. */
  shown: number;
  /** How long they've been pressing with seme. */
  shownSeme: number;
  /** How long their strike's been going, how long this one takes to notice, and whether a parry's been tried against it. */
  strikeAge: number;
  reactAfter: number;
  tried: boolean;
  /** Whether they happened to be watching when this strike's opening went up. */
  watching: boolean;
  roll(): number;
};

/** What every style shares: finishing a zanshin, leaving a lock, stomping as a strike lands, and not cancelling its own queued strike. */
function player(side: 0 | 1, seed: number, choose: (s: Sense) => FighterInput): Style {
  let luck = seed;
  let shown = 0;
  let shownSeme = 0;
  let strikeAge = 0;
  let reactAfter = 0;
  let tried = false;
  let watching = false;
  let held: FighterInput = IDLE;
  const roll = () => {
    const r = nextRandom(luck);
    luck = r.seed;
    return r.value;
  };
  return (duel) => {
    if (!ticksNext(duel)) return held;
    const me = duel.fighters[side];
    const them = duel.fighters[side === 0 ? 1 : 0];
    const toward = side === 0 ? 1 : -1;
    const away = (-toward) as -1 | 1;
    held = IDLE;
    if (duel.phase === "zanshin") {
      if (duel.zanshin?.by === side) held = { ...IDLE, move: duel.zanshin.dir };
      return held;
    }
    if (duel.phase !== "fight") return IDLE;
    if (duel.lock) {
      // Whatever you were up to, out of the lock is a fair enough plan for a scripted player.
      held = { ...IDLE, move: away };
      return held;
    }
    shown = them.stance === "opening" || them.stance === "windup" ? shown + 1 : 0;
    shownSeme = them.stance === "seme" ? shownSeme + 1 : 0;
    if (them.stance === "windup") {
      if (strikeAge === 0) {
        reactAfter = STRIKE_REACTION_MIN + Math.floor(roll() * STRIKE_REACTION_SPREAD);
        tried = false;
        watching = roll() < WATCHFUL;
      }
      strikeAge++;
    } else strikeAge = 0;
    // Stuck after being parried, with one guess at when the counter's coming. It's a read, so it's usually wrong.
    if (me.stance === "deflected" && them.countering && them.stanceTicks <= REPARRY_WINDOW - 1 && !me.reparryUsed && roll() < REPARRY_SKILL) return { ...IDLE, block: true, parry: true };
    if (me.stance === "windup") return { ...IDLE, stomp: me.stanceTicks <= STOMP_AT };
    if (me.queued) return { ...IDLE, opening: me.opening, stomp: true };
    const sense: Sense = { me, them, gap: distance(duel), toward, away, shown, shownSeme, strikeAge, reactAfter, tried, watching, roll };
    held = choose(sense);
    tried = sense.tried;
    return held;
  };
}

/** Nobody parries everything: most of the time it's a held block, because the moment went by. */
const PARRY_SKILL = 0.45;
const REPARRY_SKILL = 0.25;
const answerIncoming = (s: Sense): FighterInput | null => {
  // A strike straight out of a fresh opening gets noticed from the opening, which is what an opening's for.
  const quickly = s.watching && s.shown >= s.reactAfter && s.shown - s.strikeAge <= OPENING_MIN + 2;
  if (s.them.stance !== "windup" || s.them.hiki || (s.strikeAge < s.reactAfter && !quickly)) return null;
  // The first moment you've noticed, and it's near enough to try.
  if (!s.tried && s.them.stanceTicks <= PARRY_LATEST_TAP && s.me.parryCooldown === 0) {
    s.tried = true;
    if (s.roll() < PARRY_SKILL) return { ...IDLE, block: true, parry: true };
  }
  return { ...IDLE, block: true };
};
const strike = (s: Sense, attack: AttackKind, opening: Opening): FighterInput => ({ ...IDLE, opening, attack, stomp: true });
const canPunish = (s: Sense) => (s.them.stance === "recovery" || s.them.stance === "deflected" || s.them.stance === "broken" || s.them.stance === "shaken" || s.them.stance === "stumble") && s.them.stanceTicks > 24 && s.gap <= RANGE_MAX && s.gap >= RANGE_MIN;
const counterNow = (s: Sense): FighterInput | null => (s.me.counterTicks > 0 && s.gap <= RANGE_MAX + 6 ? { ...IDLE, attack: "men", stomp: true } : null);
const pick = <T>(s: Sense, from: T[]): T => from[Math.floor(s.roll() * from.length)];

const STYLES: Record<StyleName, (side: 0 | 1, seed: number) => Style> = {
  idle: () => () => IDLE,
  /** Strikes as fast as it can, whatever the other player's doing. */
  masher: (side, seed) =>
    player(side, seed, (s) => {
      if (s.gap > STRIKING) return { ...IDLE, move: s.toward };
      return s.me.ki > 0 ? strike(s, pick(s, CUTS), pick(s, OPENINGS)) : IDLE;
    }),
  /** Holds block, and only ever goes for someone who's left wide open. */
  turtle: (side, seed) =>
    player(side, seed, (s) => {
      const c = counterNow(s);
      if (c) return c;
      if (canPunish(s)) return strike(s, "men", "drop");
      if (s.gap > STRIKING) return { ...IDLE, move: s.toward };
      if (s.me.ki < 15) return IDLE;
      return { ...IDLE, block: true };
    }),
  /** Backs off to recharge whenever it can, and comes back with one launch and one strike. */
  runner: (side, seed) => {
    let attacking = false;
    return player(side, seed, (s) => {
      const c = counterNow(s);
      if (c) return c;
      if (s.me.ki >= s.me.kiMax - 2) attacking = true;
      if (s.me.ki < 60) attacking = false;
      if (!attacking) return s.gap < RANGE_MAX + 40 ? { ...IDLE, move: s.away } : IDLE;
      if (s.gap > STRIKING) return { ...IDLE, move: s.toward, ...(s.gap < RANGE_MAX + 20 ? { dash: s.toward } : {}) };
      return strike(s, pick(s, CUTS), pick(s, OPENINGS));
    });
  },
  /** Waits in range, strikes what's open, parries what's coming and rests when it needs to. Some openings are worth trusting, and some aren't. */
  reader: (side, seed) => {
    let decidedFor = 0;
    let goes = false;
    return player(side, seed, (s) => {
      const c = counterNow(s);
      if (c) return c;
      const incoming = answerIncoming(s);
      if (incoming) return incoming;
      if (canPunish(s)) return strike(s, "men", pick(s, OPENINGS));
      // Someone launching at you is coming, whatever else they've got in mind.
      if (s.them.launchTicks > 0 && s.them.launchDir === s.away && s.gap < RANGE_MAX + 30) return { ...IDLE, block: true };
      if (s.gap > STRIKING) return { ...IDLE, move: s.toward, ...(s.gap > RANGE_MAX + 10 && s.gap < RANGE_MAX + 40 && s.me.ki > 60 && s.roll() < 0.05 ? { dash: s.toward } : {}) };
      if (s.gap < RANGE_MIN + 6) return { ...IDLE, move: s.away };
      if (s.them.stance === "opening" && s.shown >= REACTION) {
        if (decidedFor !== s.shown - 1) goes = s.roll() < 0.35;
        decidedFor = s.shown;
        if (goes) return strike(s, exposedTargets(s.them)[0], pick(s, OPENINGS));
        // Not trusting it means pressing them to find out what's behind it, or getting ready for it.
        if (s.me.ki > 50) return { ...IDLE, seme: true, stomp: s.me.kiaiTicks === 0 };
        if (s.me.ki > 25) return { ...IDLE, block: true };
      }
      // Pressing leaves them open, so that's the answer to it. And someone only blocking needs breaking first.
      if (s.them.stance === "seme" && s.me.pressure > 40 && s.me.ki > 30) return { ...IDLE, seme: true };
      if (s.them.stance === "seme" && s.shownSeme >= REACTION && s.roll() < 0.03) return strike(s, pick(s, CUTS), pick(s, OPENINGS));
      if (s.me.ki < 45) return IDLE;
      // Someone resting in guard has to take that risk, and this is why.
      if (s.them.stance === "guard" && s.them.ki < 50 && s.roll() < 0.06) return strike(s, pick(s, CUTS), pick(s, OPENINGS));
      if (s.them.stance === "block" && s.me.ki > 50) return { ...IDLE, seme: true, stomp: s.me.kiaiTicks === 0 };
      // Nothing's happening, so someone has to start something.
      if (s.them.stance !== "opening" && s.them.stance !== "block" && s.roll() < 0.008) return strike(s, pick(s, CUTS), pick(s, OPENINGS));
      return IDLE;
    });
  },
  /** Shows openings, cancels into a parry often, and now and then goes through with it. */
  baiter: (side, seed) => {
    let current: Opening = "raise";
    let hold = 0;
    return player(side, seed, (s) => {
      const c = counterNow(s);
      if (c) return c;
      const incoming = answerIncoming(s);
      if (incoming) return incoming;
      if (canPunish(s)) return strike(s, "men", pick(s, OPENINGS));
      if (s.gap > STRIKING) return { ...IDLE, move: s.toward };
      if (s.me.ki < 40) return IDLE;
      if (hold <= 0) {
        current = pick(s, OPENINGS);
        hold = 30 + Math.floor(s.roll() * 30);
      }
      hold--;
      if (hold === 0 && s.roll() < 0.35) return strike(s, s.them.stance === "opening" ? exposedTargets(s.them)[0] : pick(s, CUTS), current);
      return { ...IDLE, opening: current };
    });
  },
  /** The same bait, but it never starts a strike at all: every point has to come from a counter. */
  counterOnly: (side, seed) => {
    let current: Opening = "raise";
    let hold = 0;
    return player(side, seed, (s) => {
      const c = counterNow(s);
      if (c) return c;
      const incoming = answerIncoming(s);
      if (incoming) return incoming;
      if (s.gap > STRIKING) return { ...IDLE, move: s.toward };
      if (s.me.ki < 40) return IDLE;
      if (hold <= 0) {
        current = pick(s, OPENINGS);
        hold = 30 + Math.floor(s.roll() * 30);
      }
      hold--;
      return { ...IDLE, opening: current };
    });
  },
  /** A point up, it does nothing but back away and wait for the clock, blocking whatever reaches it. */
  clockRunner: (side, seed) =>
    player(side, seed, (s) => {
      const incoming = answerIncoming(s);
      if (incoming) return incoming;
      return { ...IDLE, move: s.away };
    }),
  /** Presses anyone resting or blocking, and strikes when they flinch. */
  pressurer: (side, seed) =>
    player(side, seed, (s) => {
      const c = counterNow(s);
      if (c) return c;
      const incoming = answerIncoming(s);
      if (incoming) return incoming;
      if (canPunish(s)) return strike(s, "men", pick(s, OPENINGS));
      if (s.gap > STRIKING) return { ...IDLE, move: s.toward };
      if (s.them.stance === "opening" && s.shown >= REACTION && s.roll() < 0.05) return strike(s, exposedTargets(s.them)[0], pick(s, OPENINGS));
      if (s.me.ki < 35) return IDLE;
      return { ...IDLE, seme: true, stomp: s.me.kiaiTicks === 0 };
    }),
};

export const makeStyle = (name: StyleName, side: 0 | 1, seed: number): Style => STYLES[name](side, seed);

export type MatchResult = { winner: 0 | 1 | null; frames: number; onTime: boolean; encho: boolean; points: [number, number]; firstBy: 0 | 1 | null };
const MAX_FRAMES = 60 * 60 * 5;

/** One online match: the rules everyone plays by, with nothing but these two players in it. */
export function playOut(a: StyleName, b: StyleName, seed: number, tweak?: (duel: DuelState) => void): MatchResult {
  let duel = skipBow(createDuel({}));
  tweak?.(duel);
  const left = makeStyle(a, 0, seed);
  const right = makeStyle(b, 1, seed ^ 0x5bd1e995);
  let frames = 0;
  let onTime = false;
  while (duel.phase !== "closing" && duel.phase !== "over" && frames < MAX_FRAMES) {
    duel = step(duel, left(duel), right(duel));
    if (duel.events.some((e) => e.type === "time")) onTime = true;
    frames++;
  }
  return { winner: duel.winner, frames, onTime, encho: duel.encho, points: [duel.fighters[0].points, duel.fighters[1].points], firstBy: duel.firstPoint };
}

/** How `a` does against `b`, playing each side equally often. */
export function versus(a: StyleName, b: StyleName, seeds = 30): { wins: number; losses: number; unfinished: number; matches: number; meanSeconds: number; onTime: number } {
  let wins = 0;
  let losses = 0;
  let unfinished = 0;
  let frames = 0;
  let onTime = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const asLeft = seed % 2 === 0;
    const r = asLeft ? playOut(a, b, seed) : playOut(b, a, seed);
    const mine = asLeft ? 0 : 1;
    if (r.winner === null) unfinished++;
    else if (r.winner === mine) wins++;
    else losses++;
    frames += r.frames;
    if (r.onTime) onTime++;
  }
  return { wins, losses, unfinished, matches: seeds, meanSeconds: frames / seeds / 60, onTime };
}
