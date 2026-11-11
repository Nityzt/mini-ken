import type { Gear } from "../art/kendoka.ts";
import type { Crest } from "../art/backdrops.ts";
import { AKI_COLORS, BO_COLORS, GEN_COLORS, SENIOR_COLORS, YUI_COLORS } from "../art/palette.ts";
import { KI_MAX, RANGE_MAX, TSUBA_GAP } from "../duel/constants.ts";
import { createDuel, distance, type AttackKind, type DuelEvent, type DuelState, type FighterInput, type Target } from "../duel/rules.ts";
import type { OpponentId } from "../world/dojos.ts";
import type { ArmorPiece, RunState } from "../run-state.ts";
import { COACH_NAME, SENPAI_LINES } from "./content.ts";
import type { TeachKey } from "./teach-card.ts";
import { challengeText, lessonText } from "./teaching.ts";

export type SenpaiId = "aki" | "bo" | "yui";
/** Who you're training with, and what on. */
export type Session =
  | { kind: "sensei"; round: number }
  | { kind: "senpai"; senpai: SenpaiId; level: number }
  | { kind: "master" }
  /** Sensei on the parry, the lock and crossing, before 1st dan. */
  | { kind: "waza" }
  /** The short tutorial for anyone going straight to multiplayer. It isn't part of any story. */
  /** Just these steps of it, for someone who's already been through the rest in their story. */
  | { kind: "quick"; only?: string[] };

export type Lesson = {
  id: string;
  /** What the card says as the drill begins, and the reminder during it. */
  title: string;
  prompt: string;
  keys: TeachKey[];
  windups: Partial<Record<AttackKind, number>>;
  partner(tick: number, duel: DuelState): FighterInput;
  done(events: DuelEvent[], duel: DuelState, memo: Record<string, boolean>): boolean;
  /** How far apart to start. Left out, the fighters start at the normal distance. */
  gap?: number;
  /** How many clean strikes it takes. One, if left out. */
  reps?: number;
  /** Set on a challenge: this many misses ends it. */
  misses?: number;
  /** How hard the partner's aura presses, if they have one. */
  presence?: number;
  /** Plays by the real rules, with the parry, the lock and crossing. Earlier drills leave those out so nothing gets in the way. */
  full?: boolean;
  /** Nobody gets shoved or separated, so there's time to read the prompt. */
  longLock?: boolean;
  /** Shows when to tap, over the partner. */
  cue?: boolean;
  /** Your ki for the drill. Left out, it's the starting 100. */
  kiMax?: number;
};

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const SLOW_TELL = 90;
const SLOW_SWING = 70;
const LESSON_DISTANCE = 40;
const BACK_OUT = 10;
const LAUNCH_DISTANCE = 84;
const STOMP_AT = 3;

/** The partner repeats one slow attack and stomps as it lands, so there's always another chance. */
const repeats = (attack: AttackKind) => (_tick: number, duel: DuelState): FighterInput => {
  const me = duel.fighters[1];
  if (me.stance === "guard") return { ...IDLE, attack };
  return me.stance === "windup" ? { ...IDLE, stomp: me.stanceTicks <= STOMP_AT } : IDLE;
};

/** The strike lands with its stomp. The point still depends on what comes next. */
const hit = (target: Target) => (events: DuelEvent[]) =>
  events.some((e) => e.type === "hit" && e.by === 0 && e.target === target);
/** The strike, the stomp and the follow-through, all together. */
const finished = (target: Target) => (events: DuelEvent[]) =>
  events.some((e) => e.type === "clean" && e.by === 0 && e.target === target);

const inThenOutThenIn = (_events: DuelEvent[], duel: DuelState, memo: Record<string, boolean>) => {
  const gap = distance(duel);
  if (gap <= RANGE_MAX) memo.wentIn = true;
  if (memo.wentIn && gap >= RANGE_MAX + BACK_OUT) memo.cameOut = true;
  return !!memo.cameOut && gap <= RANGE_MAX;
};

/** All three openings, one after another. */
const showedThemAll = (_events: DuelEvent[], duel: DuelState, memo: Record<string, boolean>) => {
  const { stance, opening } = duel.fighters[0];
  if (stance === "opening" && opening) memo[opening] = true;
  return !!memo.raise && !!memo.wrist && !!memo.drop;
};

const launchedIn = (events: DuelEvent[], _duel: DuelState, memo: Record<string, boolean>) => {
  if (events.some((e) => e.type === "launch" && e.by === 0)) memo.launched = true;
  return !!memo.launched && finished("men")(events);
};

/** What Sensei teaches, one round at a time. Each round is taken to a senpai afterwards. */
export const SENSEI_ROUNDS: Lesson[][] = [
  [
    { id: "suriashi", ...lessonText("suriashi"), windups: {}, partner: () => IDLE, done: inThenOutThenIn },
    { id: "opening", ...lessonText("opening"), windups: {}, gap: LESSON_DISTANCE, partner: () => IDLE, done: showedThemAll },
    { id: "fumikomi", ...lessonText("fumikomi"), windups: {}, gap: LESSON_DISTANCE, partner: () => IDLE, done: hit("men") },
    { id: "zanshin", ...lessonText("zanshin"), windups: {}, gap: LESSON_DISTANCE, partner: () => IDLE, done: finished("men") },
  ],
  [
    {
      id: "block",
      ...lessonText("block"),
      windups: { do: SLOW_SWING },
      gap: LESSON_DISTANCE,
      partner: repeats("do"),
      done: (events) => events.some((e) => e.type === "blocked" && e.by === 1),
    },
    { id: "do", ...lessonText("do"), windups: { bigMen: SLOW_TELL }, gap: LESSON_DISTANCE, partner: repeats("bigMen"), done: finished("do") },
  ],
  [
    { id: "kote", ...lessonText("kote"), windups: { men: SLOW_TELL }, gap: LESSON_DISTANCE, partner: repeats("men"), done: finished("kote") },
    { id: "launch", ...lessonText("launch"), windups: {}, gap: LAUNCH_DISTANCE, partner: () => IDLE, done: launchedIn },
  ],
];

const WAZA_SWING = 70;
const QUICK_TELL = 80;
const HOLD_THEN_PULL_AT = 30;
const PULL_TELL = 56;

/** Hilt to hilt, doing this. If the lock's broken, they walk back in until it's on again. */
const inTheLock = (locked: (duel: DuelState) => FighterInput) => (_tick: number, duel: DuelState): FighterInput => {
  const me = duel.fighters[1];
  if (duel.lock) return duel.lock.pulling[1] ? { ...IDLE, stomp: true } : locked(duel);
  if (me.stance === "windup") return { ...IDLE, stomp: true };
  return me.stance === "guard" || me.stance === "block" ? { ...IDLE, move: -1 } : IDLE;
};
const holdsGuard = inTheLock(() => ({ ...IDLE, block: true }));
const leansIn = inTheLock(() => ({ ...IDLE, move: -1 }));
const pullsBack = inTheLock((duel) => (duel.lock!.ticks >= HOLD_THEN_PULL_AT ? { ...IDLE, attack: "men" } : { ...IDLE, block: true }));

/** Goes for it the moment you do, so you pass each other. Once you're past, they just wait for you. */
const meetsYourSwing = (_tick: number, duel: DuelState): FighterInput => {
  const [you, me] = duel.fighters;
  if (me.stance === "windup") return { ...IDLE, stomp: true };
  if (!duel.crossed && you.stance === "windup" && me.stance === "guard") return { ...IDLE, attack: "quickMen" };
  return IDLE;
};

const did = (type: DuelEvent["type"], by?: 0 | 1) => (events: DuelEvent[]) => events.some((e) => e.type === type && (by === undefined || e.by === by));
const thenFinished = (first: DuelEvent["type"], by?: 0 | 1) => (events: DuelEvent[], _duel: DuelState, memo: Record<string, boolean>) => {
  if (did(first, by)(events)) memo.first = true;
  return !!memo.first && events.some((e) => e.type === "clean" && e.by === 0);
};

const WAZA_LESSONS: Lesson[] = [
  { id: "parry", ...lessonText("parry"), full: true, cue: true, reps: 2, windups: { men: WAZA_SWING }, gap: LESSON_DISTANCE, partner: repeats("men"), done: did("parry", 0) },
  { id: "parry-counter", ...lessonText("parryCounter"), full: true, cue: true, windups: { men: WAZA_SWING }, gap: LESSON_DISTANCE, partner: repeats("men"), done: thenFinished("parry", 0) },
  { id: "lock-push", ...lessonText("lockPush"), full: true, windups: {}, gap: TSUBA_GAP, partner: holdsGuard, done: did("shove", 0) },
  { id: "lock-hiki", ...lessonText("lockHiki"), full: true, longLock: true, windups: {}, gap: TSUBA_GAP, partner: leansIn, done: (events) => events.some((e) => e.type === "clean" && e.by === 0) },
  { id: "lock-hold", ...lessonText("lockHold"), full: true, windups: { men: PULL_TELL }, gap: TSUBA_GAP, partner: pullsBack, done: did("blocked", 1) },
  { id: "cross", ...lessonText("cross"), full: true, windups: {}, gap: LESSON_DISTANCE, partner: meetsYourSwing, done: did("cross") },
  { id: "cross-turn", ...lessonText("crossTurn"), full: true, windups: {}, gap: LESSON_DISTANCE, partner: meetsYourSwing, done: thenFinished("cross") },
];

/** Everything you need to not be lost in a real match, a step at a time, with one go at each. */
const QUICK_LESSONS: Lesson[] = [
  { id: "quick-opening", ...lessonText("quickOpening"), full: true, windups: {}, gap: LESSON_DISTANCE, partner: () => IDLE, done: showedThemAll },
  { id: "quick-strike", ...lessonText("quickStrike"), full: true, windups: {}, partner: () => ({ ...IDLE, block: false }), done: finished("men") },
  { id: "quick-tell", ...lessonText("quickTell"), full: true, windups: { men: QUICK_TELL }, gap: LESSON_DISTANCE, partner: repeats("men"), done: finished("kote") },
  { id: "quick-parry", ...lessonText("quickParry"), full: true, cue: true, windups: { men: WAZA_SWING }, gap: LESSON_DISTANCE, partner: repeats("men"), done: did("parry", 0) },
  { id: "quick-seme", ...lessonText("quickSeme"), full: true, windups: {}, gap: LESSON_DISTANCE, partner: () => IDLE, done: (events) => events.some((e) => e.type === "shaken" && e.by === 1) },
  { id: "quick-push", ...lessonText("quickPush"), full: true, windups: {}, gap: TSUBA_GAP, partner: holdsGuard, done: did("shove", 0) },
  { id: "quick-hiki", ...lessonText("quickHiki"), full: true, longLock: true, windups: {}, gap: TSUBA_GAP, partner: leansIn, done: (events) => events.some((e) => e.type === "clean" && e.by === 0) },
  { id: "quick-cross", ...lessonText("quickCross"), full: true, windups: {}, gap: LESSON_DISTANCE, partner: meetsYourSwing, done: did("cross") },
];

/** Old Gen presses as hard as Momo does, so a flinch is never far away. */
const GEN_PRESENCE = 3;
const GEN_MISSES = 3;
/**
 * Gen won't see anyone under ki 125, so that's the least you face Gen with. At the starting 100, holding
 * seme until Gen flinches left you tired, and a tired strike is too slow to land with the stomp it began with.
 */
export const GEN_KI = 125;
const GEN_TELL = 56;
/** How much pressure Gen will take before losing patience and swinging. */
const GEN_PATIENCE = 90;

const genGuards = (_tick: number, duel: DuelState): FighterInput => {
  const me = duel.fighters[1];
  return me.stance === "guard" || me.stance === "block" ? { ...IDLE, block: true } : IDLE;
};

const genLosesPatience = (_tick: number, duel: DuelState): FighterInput => {
  const me = duel.fighters[1];
  if (me.stance === "windup") return { ...IDLE, stomp: me.stanceTicks <= STOMP_AT };
  if (me.stance !== "guard" && me.stance !== "block") return IDLE;
  if (me.pressure >= GEN_PATIENCE) return { ...IDLE, attack: "bigMen" };
  return { ...IDLE, block: true };
};

const flinched = (events: DuelEvent[]) => events.some((e) => e.type === "shaken" && e.by === 1);

/** Hold off the aura, punish the flinch, then let go in time to answer the swing. Failing any of them starts it all over. */
const SEME_LESSONS: Lesson[] = [
  { id: "seme-hold", ...lessonText("semeHold"), kiMax: GEN_KI, windups: {}, gap: LESSON_DISTANCE, presence: GEN_PRESENCE, misses: GEN_MISSES, reps: 2, partner: genGuards, done: flinched },
  { id: "seme-punish", ...lessonText("semePunish"), kiMax: GEN_KI, windups: {}, gap: LESSON_DISTANCE, presence: GEN_PRESENCE, misses: GEN_MISSES, reps: 2, partner: genGuards, done: finished("men") },
  { id: "seme-read", ...lessonText("semeRead"), kiMax: GEN_KI, windups: { bigMen: GEN_TELL }, gap: LESSON_DISTANCE, presence: GEN_PRESENCE, misses: GEN_MISSES, reps: 2, partner: genLosesPatience, done: finished("do") },
];

/** What passing each level of challenge earns. Sensei gives the tare; the senpai give the rest. */
export const CHALLENGE_REWARD: ArmorPiece[] = ["do", "men", "kote"];
const LEVEL_TARGET: Target[] = ["men", "do", "kote"];
/** What each level throws at you. Partners stop short of anything you aren't armored for. */
const LEVEL_ATTACKS: AttackKind[][] = [[], ["bigMen", "do"], ["men", "do"]];

const ATTACK_EVERY = 150;
const COME_IN_TICKS = 60;
const COME_IN_RANGE = 44;

type SenpaiStyle = {
  name: string;
  colors: Record<string, string>;
  /** What the senpai does between attacks. */
  between(tick: number, level: number): FighterInput;
  tell: number;
  reps: number;
  misses: number;
  gap: number;
} & (typeof SENPAI_LINES)[SenpaiId];

/** Bo's guard drops for a moment in each cycle. */
const BO_CYCLE = 280;
const BO_GUARD_TICKS = 120;
const AKI_STEP_TICKS = 22;

export const SENPAI_IDS: SenpaiId[] = ["aki", "bo", "yui"];
export const SENPAI: Record<SenpaiId, SenpaiStyle> = {
  // Restless: never stands still, so the distance keeps changing.
  aki: {
    ...SENPAI_LINES.aki,
    name: "Aki",
    colors: AKI_COLORS,
    between: (tick) => ({ ...IDLE, move: tick % (AKI_STEP_TICKS * 2) < AKI_STEP_TICKS ? 1 : -1 }),
    tell: 56,
    reps: 3,
    misses: 3,
    gap: LESSON_DISTANCE,
  },
  // A wall: keeps a guard up, and the opening is the whole lesson.
  bo: {
    ...SENPAI_LINES.bo,
    name: "Bo",
    colors: BO_COLORS,
    between: (tick, level) => ({ ...IDLE, block: level > 0 || tick % BO_CYCLE < BO_GUARD_TICKS }),
    tell: 70,
    reps: 3,
    misses: 3,
    gap: LESSON_DISTANCE,
  },
  // A perfectionist: as many clean strikes as anyone, each from far away, with one mistake allowed and the quickest tells.
  // With two strikes, a partner standing still was the easiest do in the dojo (owner, 2026-11-11).
  yui: {
    ...SENPAI_LINES.yui,
    name: "Yui",
    colors: YUI_COLORS,
    between: (_tick, level) => ({ ...IDLE, block: level > 0 }),
    tell: 48,
    reps: 3,
    misses: 2,
    gap: LAUNCH_DISTANCE,
  },
};

export function challengeFor(id: SenpaiId, level: number): Lesson {
  const style = SENPAI[id];
  const attacks = LEVEL_ATTACKS[level];
  return {
    id: `${id}-${level}`,
    prompt: style.prompts[level],
    ...challengeText(style.name, LEVEL_TARGET[level], attacks.length > 0),
    windups: { men: style.tell, kote: style.tell, do: style.tell, bigMen: style.tell },
    gap: style.gap,
    reps: style.reps,
    misses: style.misses,
    done: finished(LEVEL_TARGET[level]),
    partner(tick, duel) {
      const me = duel.fighters[1];
      if (me.stance === "windup") return { ...IDLE, stomp: me.stanceTicks <= STOMP_AT };
      if (me.stance !== "guard" && me.stance !== "block") return IDLE;
      if (attacks.length && tick % ATTACK_EVERY >= ATTACK_EVERY - COME_IN_TICKS) {
        if (distance(duel) > COME_IN_RANGE) return { ...IDLE, move: -1 };
        return { ...IDLE, attack: attacks[Math.floor(tick / ATTACK_EVERY) % attacks.length] };
      }
      return style.between(tick, level);
    },
  };
}

/** Where a session starts. Old Gen picks up from the step you'd reached; everything else starts at the top. */
export const firstStep = (session: Session, run: Pick<RunState, "semeStep">): number =>
  session.kind === "master" ? Math.min(Math.max(0, Math.floor(run.semeStep)), SEME_LESSONS.length - 1) : 0;

/** After a miss with Old Gen, you get your ki back and his pressure starts again, so the step's worth another go. */
export function afterMiss(session: Session, duel: DuelState): DuelState {
  if (session.kind !== "master") return duel;
  const [you, them] = duel.fighters;
  return { ...duel, fighters: [{ ...you, ki: you.kiMax, pressure: 0 }, them] };
}

export const lessonsFor = (session: Session): Lesson[] => {
  if (session.kind === "sensei") return SENSEI_ROUNDS[session.round];
  if (session.kind === "senpai") return [challengeFor(session.senpai, session.level)];
  if (session.kind === "waza") return WAZA_LESSONS;
  if (session.kind === "quick") return session.only ? QUICK_LESSONS.filter((l) => session.only!.includes(l.id)) : QUICK_LESSONS;
  return SEME_LESSONS;
};

/** Where a session happens. Everything's at home, except Old Gen, who teaches at the hut. */
export const sessionPlace = (session: Session): Crest => (session.kind === "master" ? "hut" : "pinecone");
/** Who you're practicing with, so they aren't also sitting along the wall. Old Gen's a long way from any of them. */
export const sessionPartner = (session: Session): OpponentId | null => (session.kind === "sensei" || session.kind === "waza" ? "sensei" : session.kind === "senpai" ? session.senpai : null);

export const partnerName = (session: Session): string =>
  session.kind === "sensei" || session.kind === "waza" ? "Sensei" : session.kind === "quick" ? COACH_NAME : session.kind === "senpai" ? SENPAI[session.senpai].name : "Gen";

export const partnerColors = (session: Session): Record<string, string> =>
  session.kind === "sensei" || session.kind === "waza" || session.kind === "quick" ? SENIOR_COLORS : session.kind === "senpai" ? SENPAI[session.senpai].colors : GEN_COLORS;

/** Did this tick cost a miss? Your own errors do, and so does a hit on armor you're wearing. */
export function judge(events: DuelEvent[], gear: Gear): boolean {
  return events.some((e) => {
    if (e.by === 0) return e.type === "flat" || e.type === "nozanshin" || e.type === "whiff" || e.type === "blocked" || e.type === "shaken";
    return e.type === "clean" && e.by === 1 && !!e.target && gear[e.target];
  });
}

export function createLessonDuel(lesson: Lesson): DuelState {
  const duel = createDuel({
    windups: [{}, lesson.windups],
    harmless: [false, true],
    // A partner's slow windup is the tell, and their guard is part of the drill.
    direct: [false, true],
    steadyGuard: [false, true],
    noClock: true,
    ...(lesson.full ? {} : { basics: true }),
    ...(lesson.longLock ? { longLock: true } : {}),
    ...(lesson.presence ? { presence: [0, lesson.presence] as [number, number] } : {}),
    ...(lesson.kiMax ? { kiMax: [lesson.kiMax, KI_MAX] as [number, number] } : {}),
  });
  if (lesson.gap !== undefined) {
    const mid = (duel.fighters[0].x + duel.fighters[1].x) / 2;
    duel.fighters[0].x = mid - lesson.gap / 2;
    duel.fighters[1].x = mid + lesson.gap / 2;
  }
  return duel;
}
