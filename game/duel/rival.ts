import { RANGE_MAX, RANGE_MIN, TSUBA_BREAK } from "./constants.ts";
import { distance, KAMAE, ticksNext, type AttackKind, type DuelState, type FighterInput, type Target } from "./rules.ts";

/**
 * Ren waits and picks a moment. Hana can't wait, and loves the big swing. Momo can't be touched without seme.
 * Sora nips at your wrist, Mika waits and waits, and Kenji never lets up. Ren, the last of them, has no favourite.
 * The senpai go easier than any of them: Aki is restless, Bo rarely swings at all, and Yui picks at your wrist.
 */
export type RivalStyle = "steady" | "fierce" | "rigged" | "restless" | "wall" | "exact" | "sneaky" | "patient" | "relentless" | "master" | "demonstration" | "jodan" | "nito" | "sensei" | "fury" | "torrent" | "iron" | "shadow";
export type RivalConfig = {
  tell: { men: number; kote: number; bigMen: number };
  habits: AttackKind[];
  habitMin: number;
  habitSpread: number;
  /** Guards at all times, and only swings at someone who's holding seme. */
  rigged?: boolean;
  /** A rigged rival who walks right up to you, rather than guarding from afar. */
  walksIn?: boolean;
  /** Answers someone hiding behind their guard with seme, which leaves this rival wide open while it lasts. */
  pressesGuard?: boolean;
  /** How likely they are to parry any one strike. */
  parry?: number;
  /** How often, instead of a strike, they charge straight into you and lock up. */
  charges?: number;
  /** How likely they are to meet any one strike with their own, so you both go through. */
  meets?: number;
  /** How good they are hilt to hilt, from 0 to 1: reading your pull, and getting out before you shove them. */
  lockSkill?: number;
};
export type RivalState = {
  config: RivalConfig;
  rng: number;
  habitIn: number;
  punishSeen: number;
  opponentBlocking: number;
  catchingBreath: boolean;
  /** How long the opponent has been holding seme. */
  semeSeen: number;
  /** A second stream of luck, so a new kind of decision doesn't change every match that's already been played. */
  luck: number;
  /** Whether they've decided to parry the strike that's coming. Null when there isn't one. */
  parryPlanned: boolean | null;
  /** Whether they've decided to meet the strike that's coming with one of their own. */
  meetPlanned: boolean;
  /** How long it's been since the opponent last swung. */
  sinceSwing: number;
  /** What they're going to do in the lock, and for how long. */
  lockPlan: LockPlan | null;
  lockIn: number;
  /** Whether they've noticed you pulling back for a strike. Null when you aren't. */
  readsPull: boolean | null;
  /** What they're holding down, which carries on through the frames when nothing's being decided. */
  held: FighterInput;
};
type LockPlan = "push" | "hold" | "pull" | "out";

const STYLES: Record<RivalStyle, Omit<RivalConfig, "tell"> & { baseTell: RivalConfig["tell"] }> = {
  steady: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["men", "kote", "bigMen"], habitMin: 60, habitSpread: 50, parry: 0.1, lockSkill: 0.5, meets: 0.65 },
  fierce: { baseTell: { men: 28, kote: 28, bigMen: 44 }, habits: ["bigMen", "men", "bigMen", "kote", "bigMen"], habitMin: 34, habitSpread: 30, parry: 0.05, charges: 0.15, lockSkill: 0.3, meets: 0.75 },
  rigged: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["bigMen"], habitMin: 70, habitSpread: 50, rigged: true },
  demonstration: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["bigMen"], habitMin: 70, habitSpread: 50, rigged: true, walksIn: true },
  sneaky: { baseTell: { men: 42, kote: 42, bigMen: 56 }, habits: ["kote", "kote", "men"], habitMin: 50, habitSpread: 40, parry: 0.15, lockSkill: 0.5, meets: 0.55 },
  patient: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["men", "bigMen"], habitMin: 90, habitSpread: 60, parry: 0.25, lockSkill: 0.6, meets: 0.55 },
  relentless: { baseTell: { men: 28, kote: 28, bigMen: 42 }, habits: ["men", "kote", "men"], habitMin: 36, habitSpread: 24, parry: 0.1, charges: 0.15, lockSkill: 0.4, meets: 0.75 },
  master: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["men", "kote", "bigMen", "kote"], habitMin: 44, habitSpread: 40, pressesGuard: true, parry: 0.3, lockSkill: 1, meets: 0.6 },
  // Sensei has no favourite and doesn't wait long, and won't let you hide. They've seen everything you've got, because they taught it.
  sensei: { baseTell: { men: 28, kote: 28, bigMen: 44 }, habits: ["men", "kote", "bigMen", "men"], habitMin: 50, habitSpread: 40, pressesGuard: true, parry: 0.35, lockSkill: 1, meets: 0.6 },
  // The senseis of other dojos: what their students do, only they leave you time to feel it. Nobody hides from any of them.
  fury: { baseTell: { men: 28, kote: 28, bigMen: 42 }, habits: ["bigMen", "men", "bigMen", "kote"], habitMin: 50, habitSpread: 30, pressesGuard: true, parry: 0.15, charges: 0.2, lockSkill: 0.9, meets: 0.7 },
  torrent: { baseTell: { men: 28, kote: 28, bigMen: 42 }, habits: ["men", "kote", "men", "kote"], habitMin: 50, habitSpread: 20, pressesGuard: true, parry: 0.2, lockSkill: 0.9, meets: 0.65 },
  // What Sora does, from someone who's been doing it for forty years and doesn't get caught at close quarters.
  shadow: { baseTell: { men: 42, kote: 42, bigMen: 56 }, habits: ["kote", "kote", "men"], habitMin: 50, habitSpread: 40, parry: 0.25, lockSkill: 0.9, meets: 0.55 },
  iron: { baseTell: { men: 26, kote: 26, bigMen: 40 }, habits: ["men", "bigMen"], habitMin: 70, habitSpread: 50, pressesGuard: true, parry: 0.35, lockSkill: 1, meets: 0.55 },
  // Strikes come quicker from up there, and they favour the men.
  jodan: { baseTell: { men: 26, kote: 26, bigMen: 40 }, habits: ["men", "men", "kote"], habitMin: 50, habitSpread: 40, parry: 0.1, lockSkill: 0.6, meets: 0.55 },
  // Two swords take longer to bring round, so their tells last longer than anyone's at this level.
  nito: { baseTell: { men: 34, kote: 34, bigMen: 48 }, habits: ["men", "kote", "men"], habitMin: 60, habitSpread: 40, parry: 0.2, lockSkill: 0.6, meets: 0.55 },
  restless: { baseTell: { men: 46, kote: 46, bigMen: 60 }, habits: ["men", "kote", "bigMen"], habitMin: 36, habitSpread: 40, lockSkill: 0.1, meets: 0.55 },
  wall: { baseTell: { men: 50, kote: 50, bigMen: 66 }, habits: ["bigMen", "men"], habitMin: 110, habitSpread: 70, parry: 0.1, lockSkill: 0.3, meets: 0.4 },
  exact: { baseTell: { men: 46, kote: 46, bigMen: 60 }, habits: ["kote", "men", "kote", "bigMen"], habitMin: 70, habitSpread: 40, parry: 0.1, lockSkill: 0.3, meets: 0.45 },
};
/** The table above is in the old tells. These run a quarter longer, so there's time to answer now strikes are slower to land. */
const TELL_STRETCH = 1.25;
const EASE_PER_LOSS = 4;
const EASE_CAP = 16;
const PUNISH_REACTION = 6;
const TURTLE_LIMIT = 90;
const TIRED_BELOW = 25;
const RESTED_AT = 60;
const PREFERRED_GAP = 6;
/** A rigged rival guards from further out than any launch can surprise it. */
const RIGGED_REACH = 70;
/** How long someone has to hide behind their guard before a pressing rival starts to press them. */
const PRESS_AFTER = 40;
const PRESS_MIN_KI = 40;
/** After this many losses, a rival who presses gives up on it. */
export const PRESS_GIVES_UP_AT = 3;

const PARRY_EASE_PER_LOSS = 0.25;
const PARRY_EASE_FLOOR = 0.25;

const stretched = (ticks: number) => Math.round(ticks * TELL_STRETCH);

/** The rival is at full strength on the first try, and its tells last longer after each loss. */
export function rivalConfig(losses: number, style: RivalStyle = "steady"): RivalConfig {
  const { baseTell, ...habits } = STYLES[style];
  const ease = Math.min(EASE_CAP, losses * EASE_PER_LOSS);
  const pressing = habits.pressesGuard ? { pressesGuard: losses < PRESS_GIVES_UP_AT } : {};
  const parrying = habits.parry ? { parry: habits.parry * Math.max(PARRY_EASE_FLOOR, 1 - losses * PARRY_EASE_PER_LOSS) } : {};
  return { ...habits, ...pressing, ...parrying, tell: { men: stretched(baseTell.men) + ease, kote: stretched(baseTell.kote) + ease, bigMen: stretched(baseTell.bigMen) + ease } };
}

const MOOD_SLOWEST = 1.25;
const MOOD_QUICKEST = 0.8;
const MOOD_QUICK_BELOW = 0.95;
const MOOD_SLOW_ABOVE = 1.1;

/**
 * How someone's feeling today: how long they wait between swings, and which strike they favour.
 * It never touches a tell, so every attack can still be read. Rigged fights have a script to keep to.
 */
export function withMood(config: RivalConfig, seed: number): RivalConfig {
  const mood = moodOf(config, seed);
  if (!mood) return config;
  return { ...config, habitMin: Math.round(config.habitMin * mood.scale), habits: [...config.habits, mood.favourite] };
}

export type Mood = { scale: number; pace: "quick" | "calm" | "slow"; favourite: AttackKind };
/** The mood itself, so the player can be shown what's about to be true. A scripted fight doesn't have one. */
export function moodOf(config: RivalConfig, seed: number): Mood | null {
  if (config.rigged) return null;
  const cadence = nextRandom(seed);
  const favourite = nextRandom(cadence.seed);
  const scale = MOOD_QUICKEST + cadence.value * (MOOD_SLOWEST - MOOD_QUICKEST);
  return { scale, pace: scale < MOOD_QUICK_BELOW ? "quick" : scale > MOOD_SLOW_ABOVE ? "slow" : "calm", favourite: config.habits[Math.floor(favourite.value * config.habits.length)] };
}

/** mulberry32. The state is a plain number, so a seed always replays the same match. */
export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

export function createRival(seed: number, config: RivalConfig): RivalState {
  const roll = nextRandom(seed);
  return {
    config,
    rng: roll.seed,
    habitIn: config.habitMin + Math.floor(roll.value * config.habitSpread),
    punishSeen: 0,
    opponentBlocking: 0,
    catchingBreath: false,
    semeSeen: 0,
    luck: seed ^ 0x2f6e2b1,
    parryPlanned: null,
    meetPlanned: false,
    sinceSwing: MEET_PATIENCE,
    lockPlan: null,
    lockIn: 0,
    readsPull: null,
    held: IDLE,
  };
}

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const STOMP_AT = 3;
/** How close a strike has to be before they try to parry it. */
const PARRY_AT = 6;
/** Someone swinging again and again gets blocked and punished. Only a swing they've been building up to gets met. */
const MEET_PATIENCE = 70;
const LOCK_PLAN_MIN = 30;
const LOCK_PLAN_SPREAD = 40;
const LOCK_COUNTER_CHANCE = 0.4;
/** How far they'll let a push get, if they're any good, before getting out. */
const LOCK_BAIL_AT = TSUBA_BREAK / 3;
/** How much less often a good fighter risks pulling: it's the one choice a good read punishes. */
const PULL_RISK_AWAY = 0.85;
/** How long a pull has been going before it can be noticed. */
const READ_PULL_AFTER = 6;
const HIKI_TARGETS: Target[] = ["men", "kote", "do"];

function rollLuck(next: RivalState): number {
  const roll = nextRandom(next.luck);
  next.luck = roll.seed;
  return roll.value;
}

function pickLockPlan(duel: DuelState, next: RivalState): LockPlan {
  const lock = duel.lock!;
  const skill = next.config.lockSkill ?? 0;
  // A good fighter knows a pull is what a good read punishes, so mostly they find another way.
  const pull = (otherwise: LockPlan): LockPlan => (rollLuck(next) < skill * PULL_RISK_AWAY ? otherwise : "pull");
  // Sometimes they answer what you're doing, and sometimes they just have their own idea.
  if (rollLuck(next) < LOCK_COUNTER_CHANCE) {
    if (lock.pushing[0]) return pull("out");
    if (lock.guarding[0]) return "push";
  }
  const roll = rollLuck(next);
  return roll < 0.4 ? "push" : roll < 0.65 ? "hold" : roll < 0.9 ? pull("hold") : "out";
}

/** Hilt to hilt. A scripted fight has no part in this, and just steps out. */
function lockAct(duel: DuelState, rival: RivalState, next: RivalState): { input: FighterInput; rival: RivalState } {
  if (rival.config.rigged) return { input: { ...IDLE, move: 1 }, rival: next };
  const lock = duel.lock!;
  const mine = lock.pulling[1];
  if (mine) return { input: { ...IDLE, stomp: mine.ticks <= STOMP_AT }, rival: next };

  const theirs = lock.pulling[0];
  if (!theirs) next.readsPull = null;
  else if (theirs.total - theirs.ticks >= READ_PULL_AFTER) {
    if (rival.readsPull === null) next.readsPull = rollLuck(next) < (rival.config.lockSkill ?? 0);
    if (next.readsPull) return { input: { ...IDLE, block: true }, rival: next };
  }

  // Being pushed back, anyone good gets out before it costs them. The better they are, the sooner they notice.
  if (lock.balance > LOCK_BAIL_AT && rollLuck(next) < (rival.config.lockSkill ?? 0) / 4) return { input: { ...IDLE, move: 1 }, rival: next };

  next.lockIn = rival.lockIn - 1;
  if (!rival.lockPlan || next.lockIn <= 0) {
    next.lockPlan = pickLockPlan(duel, next);
    next.lockIn = LOCK_PLAN_MIN + Math.floor(rollLuck(next) * LOCK_PLAN_SPREAD);
  }
  switch (next.lockPlan) {
    case "push":
      return { input: { ...IDLE, move: -1 }, rival: next };
    case "pull":
      return { input: { ...IDLE, attack: HIKI_TARGETS[Math.floor(rollLuck(next) * HIKI_TARGETS.length)] }, rival: next };
    case "out":
      return { input: { ...IDLE, move: 1 }, rival: next };
    default:
      return { input: { ...IDLE, block: true }, rival: next };
  }
}

/** The rival's input for this frame. They only make up their mind when the rules are about to move, so their timing is counted in ticks like everything else's. */
export function rivalAct(duel: DuelState, rival: RivalState): { input: FighterInput; rival: RivalState } {
  if (!ticksNext(duel)) return { input: rival.held, rival };
  const act = decide(duel, rival);
  const { move, block, seme } = act.input;
  return { input: act.input, rival: { ...act.rival, held: { move, block, seme, attack: null } } };
}

/** Decides the rival's input for this tick. The rival plays by the same rules as the player. */
function decide(duel: DuelState, rival: RivalState): { input: FighterInput; rival: RivalState } {
  if (duel.phase === "zanshin" && duel.zanshin?.by === 1) return { input: { ...IDLE, move: duel.zanshin.dir }, rival };
  if (duel.phase !== "fight") return { input: IDLE, rival };

  const me = duel.fighters[1];
  const opponent = duel.fighters[0];
  const dist = distance(duel);
  const myRange = RANGE_MAX + KAMAE[me.kamae].reach;
  const inRange = dist >= RANGE_MIN && dist <= myRange;
  const next: RivalState = { ...rival };

  if (duel.lock) return lockAct(duel, rival, next);
  next.lockPlan = null;
  next.readsPull = null;

  // Deciding once per strike whether to go for the parry, then doing it right as it arrives.
  const swinging = opponent.stance === "windup" && dist >= RANGE_MIN && dist <= RANGE_MAX + KAMAE[opponent.kamae].reach;
  next.sinceSwing = opponent.stance === "windup" ? 0 : rival.sinceSwing + 1;
  if (!swinging) {
    next.parryPlanned = null;
    next.meetPlanned = false;
  } else if (rival.parryPlanned === null) {
    next.parryPlanned = rollLuck(next) < (rival.config.parry ?? 0);
    next.meetPlanned = !next.parryPlanned && rival.sinceSwing >= MEET_PATIENCE && rollLuck(next) < (rival.config.meets ?? 0);
  }
  const ready = me.stance === "guard" || me.stance === "block";
  if (next.parryPlanned && opponent.stanceTicks <= PARRY_AT && me.parryCooldown === 0 && ready) {
    next.parryPlanned = false;
    return { input: { ...IDLE, block: true, parry: true }, rival: next };
  }
  // Going for it at the same moment, so you pass each other.
  if (next.meetPlanned && ready) {
    next.meetPlanned = false;
    return { input: { ...IDLE, attack: "quickMen" }, rival: next };
  }

  const vulnerable = opponent.stance === "recovery" || opponent.stance === "broken" || opponent.stance === "shaken" || opponent.stance === "deflected" || opponent.stance === "stumble";
  next.punishSeen = vulnerable && inRange ? rival.punishSeen + 1 : 0;
  next.opponentBlocking = opponent.stance === "block" ? rival.opponentBlocking + 1 : 0;

  if (me.ki < TIRED_BELOW) next.catchingBreath = true;
  else if (me.ki >= RESTED_AT) next.catchingBreath = false;

  // Pressing someone who's hiding, for as long as they keep hiding.
  const pressing = rival.config.pressesGuard && next.opponentBlocking > PRESS_AFTER && me.ki > PRESS_MIN_KI && !next.catchingBreath;
  if (pressing && (me.stance === "guard" || me.stance === "block" || me.stance === "seme")) {
    return { input: { ...IDLE, seme: true }, rival: next };
  }

  // A rival stomps as each strike comes down.
  if (me.stance === "windup") return { input: { ...IDLE, stomp: me.stanceTicks <= STOMP_AT }, rival: next };
  if (me.stance !== "guard" && me.stance !== "block") return { input: IDLE, rival: next };

  if (vulnerable && next.punishSeen >= PUNISH_REACTION) {
    next.punishSeen = 0;
    return { input: { move: 0, block: false, attack: "quickMen" }, rival: next };
  }
  if (vulnerable && !inRange) return { input: { move: dist > myRange ? -1 : 1, block: false, attack: null }, rival: next };

  if (rival.config.rigged) {
    next.semeSeen = opponent.stance === "seme" ? rival.semeSeen + 1 : 0;
    if (dist > (rival.config.walksIn ? myRange - PREFERRED_GAP : RIGGED_REACH)) return { input: { move: -1, block: false, attack: null }, rival: next };
    if (inRange && next.semeSeen >= rival.habitIn) {
      const roll = nextRandom(rival.rng);
      next.rng = roll.seed;
      next.semeSeen = 0;
      next.habitIn = rival.config.habitMin + Math.floor(roll.value * rival.config.habitSpread);
      return { input: { move: 0, block: false, attack: "bigMen" }, rival: next };
    }
    return { input: { move: 0, block: true, attack: null }, rival: next };
  }

  // Catching its breath leaves it walking backwards with its guard down: a real opening.
  if (next.catchingBreath) return { input: { move: 1, block: false, attack: null }, rival: next };

  if (dist > myRange - PREFERRED_GAP) return { input: { move: -1, block: false, attack: null }, rival: next };
  if (dist < RANGE_MIN + 2) return { input: { move: 1, block: false, attack: null }, rival: next };

  next.habitIn = rival.habitIn - 1;
  if (next.habitIn <= 0 || next.opponentBlocking > TURTLE_LIMIT) {
    const roll = nextRandom(rival.rng);
    const pick = nextRandom(roll.seed);
    next.rng = pick.seed;
    const { habits, habitMin, habitSpread } = rival.config;
    next.habitIn = habitMin + Math.floor(roll.value * habitSpread);
    if (rollLuck(next) < (rival.config.charges ?? 0)) return { input: { ...IDLE, dash: -1 }, rival: next };
    return { input: { move: 0, block: false, attack: habits[Math.floor(pick.value * habits.length)] }, rival: next };
  }
  return { input: { move: 0, block: true, attack: null }, rival: next };
}
