import { OPENING_MIN, OPENING_START_KI, RANGE_MAX, RANGE_MIN, REPARRY_WINDOW, TSUBA_BREAK } from "./constants.ts";
import { ATTACKS, distance, exposedTargets, exposes, KAMAE, ticksNext, type AttackKind, type DuelState, type Fighter, type FighterInput, type Opening, type Target } from "./rules.ts";

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
  /** How likely they are, once you've parried them, to parry your counter back (issue #41). */
  reparry?: number;
  /** How often, instead of a strike, they charge straight into you and lock up. */
  charges?: number;
  /** How likely they are to meet any one strike with their own, so you both go through. */
  meets?: number;
  /** How good they are hilt to hilt, from 0 to 1: reading your pull, and getting out before you shove them. */
  lockSkill?: number;
  /** How often an opening they show is only bait, which turns into a parry if you bite. */
  bait?: number;
  /** How often they go for an opening you show them. */
  bites?: number;
  /** How often their opening isn't the one their habit would show, so it says even less about what's coming. */
  openingMix?: number;
};
/** A strike they've decided on, with the opening they're showing first. Online, it takes a few frames for what they've pressed to take effect, so it's `waiting` until it shows. */
type Plan = { attack: AttackKind; opening: Opening; hold: number; bait: boolean; waiting: number };
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
  /** Knocked aside, whether they've decided to parry your counter back. Null when there isn't one coming. */
  reparryPlanned: boolean | null;
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
  /** What they're showing, and what's behind it. */
  plan: Plan | null;
  /** How long you've been showing them an opening. */
  openingSeen: number;
  /** Whether they've decided about this opening of yours yet. */
  biteDecided: boolean;
};
type LockPlan = "push" | "hold" | "pull" | "out";

const STYLES: Record<RivalStyle, Omit<RivalConfig, "tell"> & { baseTell: RivalConfig["tell"] }> = {
  steady: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["men", "kote", "bigMen"], habitMin: 60, habitSpread: 50, parry: 0.1, reparry: 0.3, lockSkill: 0.5, meets: 0.65, bait: 0.15, bites: 0.3, openingMix: 0.5 },
  fierce: { baseTell: { men: 28, kote: 28, bigMen: 44 }, habits: ["bigMen", "men", "bigMen", "kote", "bigMen"], habitMin: 34, habitSpread: 30, parry: 0.05, reparry: 0.2, charges: 0.15, lockSkill: 0.3, meets: 0.75, bait: 0.05, bites: 0.5, openingMix: 0.3 },
  rigged: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["bigMen"], habitMin: 70, habitSpread: 50, rigged: true },
  demonstration: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["bigMen"], habitMin: 70, habitSpread: 50, rigged: true, walksIn: true },
  sneaky: { baseTell: { men: 42, kote: 42, bigMen: 56 }, habits: ["kote", "kote", "men"], habitMin: 50, habitSpread: 40, parry: 0.15, reparry: 0.35, lockSkill: 0.5, meets: 0.55, bait: 0.1, bites: 0.1, openingMix: 0.5 },
  patient: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["men", "bigMen"], habitMin: 90, habitSpread: 60, parry: 0.25, reparry: 0.4, lockSkill: 0.6, meets: 0.55, bait: 0.25, bites: 0.3, openingMix: 0.5 },
  relentless: { baseTell: { men: 28, kote: 28, bigMen: 42 }, habits: ["men", "kote", "men"], habitMin: 36, habitSpread: 24, parry: 0.1, reparry: 0.25, charges: 0.15, lockSkill: 0.4, meets: 0.75, bait: 0.1, bites: 0.4, openingMix: 0.3 },
  master: { baseTell: { men: 30, kote: 30, bigMen: 46 }, habits: ["men", "kote", "bigMen", "kote"], habitMin: 44, habitSpread: 40, pressesGuard: true, parry: 0.3, reparry: 0.5, lockSkill: 1, meets: 0.6, bait: 0.2, bites: 0.4, openingMix: 0.7 },
  // Sensei has no favourite and doesn't wait long, and won't let you hide. They've seen everything you've got, because they taught it.
  sensei: { baseTell: { men: 28, kote: 28, bigMen: 44 }, habits: ["men", "kote", "bigMen", "men"], habitMin: 50, habitSpread: 40, pressesGuard: true, parry: 0.35, reparry: 0.55, lockSkill: 1, meets: 0.6, bait: 0.2, bites: 0.4, openingMix: 0.7 },
  // The senseis of other dojos: what their students do, only they leave you time to feel it. Nobody hides from any of them.
  fury: { baseTell: { men: 28, kote: 28, bigMen: 42 }, habits: ["bigMen", "men", "bigMen", "kote", "bigMen"], habitMin: 50, habitSpread: 30, pressesGuard: true, parry: 0.3, reparry: 0.45, charges: 0.2, lockSkill: 0.9, meets: 0.7, bait: 0.2, bites: 0.5, openingMix: 0.5 },
  torrent: { baseTell: { men: 28, kote: 28, bigMen: 42 }, habits: ["men", "kote", "men", "kote"], habitMin: 50, habitSpread: 20, pressesGuard: true, parry: 0.2, reparry: 0.4, lockSkill: 0.9, meets: 0.65, bait: 0.2, bites: 0.4, openingMix: 0.5 },
  // What Sora does, from someone who's been doing it for forty years and doesn't get caught at close quarters.
  shadow: { baseTell: { men: 42, kote: 42, bigMen: 56 }, habits: ["kote", "kote", "men"], habitMin: 50, habitSpread: 40, parry: 0.25, reparry: 0.45, lockSkill: 0.9, meets: 0.55, bait: 0.1, bites: 0.2, openingMix: 0.7 },
  iron: { baseTell: { men: 26, kote: 26, bigMen: 40 }, habits: ["men", "bigMen"], habitMin: 70, habitSpread: 50, pressesGuard: true, parry: 0.5, reparry: 0.6, lockSkill: 1, meets: 0.55, bait: 0.2, bites: 0.4, openingMix: 0.7 },
  // Strikes come quicker from up there, and they favour the men.
  jodan: { baseTell: { men: 26, kote: 26, bigMen: 40 }, habits: ["men", "men", "kote"], habitMin: 50, habitSpread: 40, parry: 0.1, reparry: 0.3, lockSkill: 0.6, meets: 0.55, bait: 0.15, bites: 0.3, openingMix: 0.3 },
  // Two swords take longer to bring round, so their tells last longer than anyone's at this level.
  nito: { baseTell: { men: 34, kote: 34, bigMen: 48 }, habits: ["men", "kote", "men"], habitMin: 60, habitSpread: 40, parry: 0.2, reparry: 0.35, lockSkill: 0.6, meets: 0.55, bait: 0.15, bites: 0.3, openingMix: 0.3 },
  restless: { baseTell: { men: 46, kote: 46, bigMen: 60 }, habits: ["men", "kote", "bigMen"], habitMin: 36, habitSpread: 40, lockSkill: 0.1, meets: 0.55, bites: 0.2 },
  wall: { baseTell: { men: 50, kote: 50, bigMen: 66 }, habits: ["bigMen", "men"], habitMin: 110, habitSpread: 70, parry: 0.1, reparry: 0.1, lockSkill: 0.3, meets: 0.4, bites: 0.1 },
  exact: { baseTell: { men: 46, kote: 46, bigMen: 60 }, habits: ["kote", "men", "kote", "bigMen"], habitMin: 70, habitSpread: 40, parry: 0.1, reparry: 0.15, lockSkill: 0.3, meets: 0.45, bites: 0.2 },
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
  const easing = Math.max(PARRY_EASE_FLOOR, 1 - losses * PARRY_EASE_PER_LOSS);
  const parrying = habits.parry ? { parry: habits.parry * easing } : {};
  const reparrying = habits.reparry ? { reparry: habits.reparry * easing } : {};
  const baiting = habits.bait ? { bait: habits.bait * easing } : {};
  return { ...habits, ...pressing, ...parrying, ...reparrying, ...baiting, tell: { men: stretched(baseTell.men) + ease, kote: stretched(baseTell.kote) + ease, bigMen: stretched(baseTell.bigMen) + ease } };
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
    reparryPlanned: null,
    meetPlanned: false,
    sinceSwing: MEET_PATIENCE,
    lockPlan: null,
    lockIn: 0,
    readsPull: null,
    held: IDLE,
    plan: null,
    openingSeen: 0,
    biteDecided: false,
  };
}

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const STOMP_AT = 3;
/** How long you have to show them an opening before they make up their mind about it. */
const BITE_REACTION = 8;
/** How long to keep asking for an opening before giving up on it. It's more than lockstep's delay, in ticks. */
const PLAN_PATIENCE = 8;
/** On top of the tell itself: the shortest opening, plus enough that answering from plain guard stays as easy as it was. */
const TELL_EXTRA = OPENING_MIN + 2;
/** Someone about to strike has their mind made up, which is why answering a real tell in time usually works. So they only sometimes change it. */
const COMMITTED_PARRY = 0.5;
const COMMITTED_BLOCK = 0.2;
const OPENINGS: Opening[] = ["raise", "wrist", "drop"];
/** The opening that shows this target, and the strike that hits it. */
const OPENING_FOR: Record<Target, Opening> = { do: "raise", kote: "wrist", men: "drop" };

/** A planned attack's opening lasts its tell, less the strike, plus the shortest opening anyone can show. So it can be read and answered as well as it ever could. */
function holdFor(config: RivalConfig, attack: AttackKind): number {
  const tell = attack === "bigMen" ? config.tell.bigMen : attack === "kote" ? config.tell.kote : config.tell.men;
  return Math.max(OPENING_MIN, tell - ATTACKS[attack].windup + TELL_EXTRA);
}

/** Which opening to show. A big swing starts from overhead, and otherwise it's a matter of habit, or of hiding one. */
function pickOpening(me: Fighter, attack: AttackKind, next: RivalState): Opening {
  if (me.stance === "opening" && me.opening) return me.opening;
  if (attack === "bigMen") return "raise";
  if (rollLuck(next) < (next.config.openingMix ?? 0)) return OPENINGS[Math.floor(rollLuck(next) * OPENINGS.length)];
  return OPENING_FOR[exposes(attack, me.kamae)];
}

/** A strike they mean to do, starting with what they show first. */
function startPlan(me: Fighter, attack: AttackKind, next: RivalState): { input: FighterInput; rival: RivalState } {
  const opening = pickOpening(me, attack, next);
  next.plan = { attack, opening, hold: holdFor(next.config, attack), bait: !next.config.rigged && rollLuck(next) < (next.config.bait ?? 0), waiting: 0 };
  return { input: { ...IDLE, opening }, rival: next };
}

/** A strike in answer to something: as quick as the rules let anyone go, from whatever they're showing. */
function strikeNow(me: Fighter, attack: AttackKind, next: RivalState): { input: FighterInput; rival: RivalState } {
  const opening = pickOpening(me, attack, next);
  next.plan = { attack, opening, hold: 0, bait: false, waiting: 0 };
  return { input: { ...IDLE, opening, attack }, rival: next };
}
/** How close a strike has to be before they try to parry it. */
const PARRY_AT = 6;
/** A counter can only be parried in its last few ticks, so they wait for the first of them. */
const REPARRY_AT = REPARRY_WINDOW - 1;
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
  const { move, block, seme, opening } = act.input;
  return { input: act.input, rival: { ...act.rival, held: { move, block, seme, opening, attack: null } } };
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
  // Struck, or knocked out of it. Plain guard or a block may only mean what they pressed hasn't arrived yet.
  if (next.plan && me.stance !== "opening" && ((me.stance !== "guard" && me.stance !== "block") || next.plan.waiting > PLAN_PATIENCE)) next.plan = null;

  // Knocked aside, they get one try at parrying your counter back: decided once, by luck, and tapped right as it arrives.
  if (me.stance !== "deflected" || me.reparryUsed || !opponent.countering || opponent.stance !== "windup") next.reparryPlanned = null;
  else {
    if (rival.reparryPlanned === null) next.reparryPlanned = rollLuck(next) < (rival.config.reparry ?? 0);
    if (next.reparryPlanned && opponent.stanceTicks <= REPARRY_AT) {
      next.reparryPlanned = false;
      return { input: { ...IDLE, parry: true }, rival: next };
    }
  }

  // Deciding once per strike whether to go for the parry, then doing it right as it arrives.
  const swinging = opponent.stance === "windup" && dist >= RANGE_MIN && dist <= RANGE_MAX + KAMAE[opponent.kamae].reach;
  next.sinceSwing = opponent.stance === "windup" ? 0 : rival.sinceSwing + 1;
  if (!swinging) {
    next.parryPlanned = null;
    next.meetPlanned = false;
  } else if (rival.parryPlanned === null) {
    // Mid-attack and seeing yours coming, anyone with any experience may think better of it. Rigged fights and the senpai keep to the drill.
    if (next.plan && !next.plan.bait && rival.config.bait !== undefined && rollLuck(next) < COMMITTED_BLOCK) {
      next.plan = null;
      next.parryPlanned = false;
      return { input: { ...IDLE, block: true }, rival: next };
    }
    // Bait is there to be bitten, so this is the one strike they've been waiting for.
    next.parryPlanned = !!next.plan?.bait || rollLuck(next) < (rival.config.parry ?? 0) * (next.plan ? COMMITTED_PARRY : 1);
    next.meetPlanned = !next.parryPlanned && !next.plan && rival.sinceSwing >= MEET_PATIENCE && rollLuck(next) < (rival.config.meets ?? 0);
  }
  const ready = me.stance === "guard" || me.stance === "block" || me.stance === "opening";
  if (next.parryPlanned && opponent.stanceTicks <= PARRY_AT && me.parryCooldown === 0 && ready) {
    next.parryPlanned = false;
    return { input: { ...IDLE, block: true, parry: true }, rival: next };
  }
  // Going for it at the same moment, so you pass each other.
  if (next.meetPlanned && ready) {
    next.meetPlanned = false;
    return strikeNow(me, "quickMen", next);
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
  if (me.stance !== "guard" && me.stance !== "block" && me.stance !== "opening") return { input: IDLE, rival: next };

  if (vulnerable && next.punishSeen >= PUNISH_REACTION) {
    next.punishSeen = 0;
    return strikeNow(me, "quickMen", next);
  }
  if (vulnerable && !inRange) return { input: { move: dist > myRange ? -1 : 1, block: false, attack: null, opening: me.stance === "opening" ? me.opening : null }, rival: next };

  // Asked to open, and waiting for it to arrive.
  if (next.plan && me.stance !== "opening") {
    next.plan = { ...next.plan, waiting: next.plan.waiting + 1 };
    return { input: { ...IDLE, opening: next.plan.opening, attack: next.plan.hold === 0 ? next.plan.attack : null }, rival: next };
  }

  // Showing something: hold it until it's time, then either go through with it or let it drop.
  if (me.stance === "opening") {
    if (!next.plan) return { input: { ...IDLE, opening: me.queued ? me.opening : null }, rival: next };
    if (next.catchingBreath) {
      next.plan = null;
      return { input: IDLE, rival: next };
    }
    const hold = next.plan.hold - 1;
    if (hold > 0 || (me.queued && next.plan.hold <= 0 && me.openingTicks < OPENING_MIN)) {
      next.plan = { ...next.plan, hold: Math.max(0, hold) };
      return { input: { ...IDLE, opening: next.plan.opening, move: dist > myRange - PREFERRED_GAP ? -1 : 0 }, rival: next };
    }
    const { attack, opening, bait } = next.plan;
    // It stays until the strike's seen to have started, in case this takes a moment to arrive.
    if (bait) next.plan = null;
    else next.plan = { ...next.plan, hold: 0 };
    if (bait) return { input: { ...IDLE, block: true }, rival: next };
    // Any opening leads to any strike, so if you're showing them something, that's what they go for. A big swing's already too big to change.
    return { input: { ...IDLE, opening, attack: opponent.stance === "opening" && attack !== "bigMen" ? exposedTargets(opponent)[0] : attack }, rival: next };
  }

  // Going for an opening you're showing them, if they're that sort of person.
  const showing = opponent.stance === "opening" && inRange && !rival.config.rigged && !next.catchingBreath;
  next.openingSeen = showing ? rival.openingSeen + 1 : 0;
  if (!showing) next.biteDecided = false;
  else if (next.openingSeen >= BITE_REACTION && !rival.biteDecided) {
    next.biteDecided = true;
    if (rollLuck(next) < (rival.config.bites ?? 0) && me.ki >= OPENING_START_KI) return strikeNow(me, exposedTargets(opponent)[0], next);
  }

  if (rival.config.rigged) {
    next.semeSeen = opponent.stance === "seme" ? rival.semeSeen + 1 : 0;
    if (dist > (rival.config.walksIn ? myRange - PREFERRED_GAP : RIGGED_REACH)) return { input: { move: -1, block: false, attack: null }, rival: next };
    if (inRange && next.semeSeen >= rival.habitIn) {
      const roll = nextRandom(rival.rng);
      next.rng = roll.seed;
      next.semeSeen = 0;
      next.habitIn = rival.config.habitMin + Math.floor(roll.value * rival.config.habitSpread);
      return startPlan(me, "bigMen", next);
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
    return startPlan(me, habits[Math.floor(pick.value * habits.length)], next);
  }
  return { input: { move: 0, block: true, attack: null }, rival: next };
}
