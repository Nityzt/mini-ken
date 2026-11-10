import {
  ABSORB_COST, BOW_TICKS, FREEZE_AIUCHI, FREEZE_BLOCK, FREEZE_BREAK, FREEZE_CROSS, FREEZE_HIT, FREEZE_LOCK, FREEZE_PARRY, FREEZE_SHAKEN, FREEZE_SHOVE, TEMPO_FRAMES, TEMPO_TICKS, BROKEN_TICKS, CLOSING_TICKS, CROSS_CLEAN_WINDOW, CROSS_GAP, CROSS_LOCK_WITHIN, CROSS_QUICK_WINDOW, CROSS_SETTLE, CROSS_SPEED, CROSS_WRONG_WINDOW, BLOCK_DRAIN, COUNTER_DRIVE_TICKS, COUNTER_TICKS, COUNTER_WINDUP, DEFLECT_KI_LOSS, DEFLECT_TICKS, HIKI_STEP_TICKS, HIKI_TELL, HIKI_WINDUP,
  KI_AFTER_BREAK, KI_LOW, KI_MAX, KI_RECOVERY, LOCK_DISTANCE, LOW_KI_SLOWDOWN,
  LOW_KI_WALK, MATCH_TICKS, MIN_DISTANCE, OPENING_MIN, OPENING_START_KI, PARRY_COOLDOWN, PARRY_KI, PARRY_LOCK_WITHIN, PARRY_WINDOW, POINTS_TO_WIN, RANGE_MAX, RANGE_MIN, RECOVERY_TICKS, REPARRY_LOCK_WITHIN, REPARRY_MISS, REPARRY_WINDOW, RETURN_KI_RATE, RETURN_SETTLE, RETURN_WALK, RING_MAX, RING_MIN,
  KIAI_COOLDOWN, KIAI_COST, KIAI_PRESS, LAUNCH_COST, LAUNCH_SPEED, LAUNCH_STRIKE_EXTRA, LAUNCH_STRIKE_GRACE, LAUNCH_TICKS, SEME_DECAY, SEME_DRAIN, SEME_RANGE, SEME_START_KI, SEME_TICKS, SHAKEN_KI_LOSS, SHAKEN_TICKS, SHOVE_TICKS,
  START_DISTANCE, STOMP_WINDOW, STUMBLE_TICKS, SWING_COST, TAIATARI_BALANCE, TSUBA_BREAK, TSUBA_CARRY, TSUBA_CLOSE_SPEED, TSUBA_DRIFT, TSUBA_ENTER, TSUBA_GAP, TSUBA_PUSH_COST, TSUBA_TICKS, TSUBA_WAKARE_GAP,
  WALK, ZANSHIN_EDGE_MAX, ZANSHIN_EDGE_MIN, ZANSHIN_HIKI, ZANSHIN_PASS, ZANSHIN_SLIDE, ZANSHIN_WINDOW,
} from "./constants.ts";

export type Target = "men" | "kote" | "do";
export type AttackKind = Target | "bigMen" | "quickMen";
export type Stance = "guard" | "block" | "opening" | "windup" | "recovery" | "broken" | "seme" | "shaken" | "parry" | "deflected" | "tsuba" | "stumble";
/** How someone stands: chudan like nearly everyone, jodan with the shinai overhead, or nito with two swords. */
export type Kamae = "chudan" | "jodan" | "nito";
/** The three ways of showing an opening. Any of them can lead to any strike, so they say what's open and never what's coming. */
export type Opening = "raise" | "wrist" | "drop";
export type FighterInput = {
  move: -1 | 0 | 1;
  block: boolean;
  attack: AttackKind | null;
  stomp?: boolean;
  dash?: -1 | 0 | 1;
  seme?: boolean;
  parry?: boolean;
  /** Which opening is being held. Pressed together with a strike, it starts the opening and queues the strike. */
  opening?: Opening | null;
};
export type Fighter = {
  kamae: Kamae;
  x: number;
  ki: number;
  kiMax: number;
  stance: Stance;
  stanceTicks: number;
  attack: AttackKind | null;
  points: number;
  /** Ticks since the last fumikomi. */
  stompAge: number;
  launchTicks: number;
  launchDir: -1 | 0 | 1;
  /** How much longer a strike can go straight off a launch toward them, with no opening. */
  launchStrikeTicks: number;
  /** How close the opponent's seme has come to making this fighter flinch. */
  pressure: number;
  /** How long until this fighter can kiai again. */
  kiaiTicks: number;
  /** How long until this fighter can try another parry. */
  parryCooldown: number;
  /** How long a parry's quick answer is still on offer. */
  counterTicks: number;
  /** This strike is being pulled back out of a lock. */
  hiki: boolean;
  /** The opening being shown, which stays open until the strike from it has landed. */
  opening: Opening | null;
  /** How long this opening's been held. */
  openingTicks: number;
  /** A strike waiting for the opening's minimum. */
  queued: AttackKind | null;
  /** This strike is a parry's quick answer, which is the only thing a parried fighter can still parry. */
  countering: boolean;
  /** How much longer a parried fighter's one try at parrying the counter lasts. */
  reparryTicks: number;
  reparryUsed: boolean;
};
export type DuelEvent = {
  type: "kiai" | "shout" | "stomp" | "launch" | "shaken" | "hit" | "flat" | "clean" | "nozanshin" | "blocked" | "whiff" | "lock" | "aiuchi" | "broken" | "bow" | "parry" | "shove" | "taiatari" | "wakare" | "stepout" | "cross" | "noopening" | "time" | "encho";
  by?: 0 | 1;
  target?: Target;
  /** The strike being announced is pulled back out of a lock. */
  hiki?: boolean;
};
type WindupOverrides = Partial<Record<AttackKind, number>>;
export type DuelOptions = {
  kiMax?: [number, number];
  windups?: [WindupOverrides, WindupOverrides];
  harmless?: [boolean, boolean];
  /** How hard a fighter presses just by standing there, in pressure per tick. It costs them nothing. */
  presence?: [number, number];
  /** How many points end the match, if it isn't the usual. */
  pointsToWin?: number;
  /** How much of an opponent's held seme gets through to each fighter, if it isn't all of it. */
  semeTaken?: [number, number];
  /** How each fighter stands, if it isn't chudan. */
  kamae?: [Kamae, Kamae];
  /** A lesson, where nothing gets in the way of the drill: no parries, nobody locks up, and nobody crosses. */
  basics?: boolean;
  /** A lesson about the lock itself, which stays locked however hard anyone pushes, for as long as it takes. */
  longLock?: boolean;
  /** Strikes need no opening, for scripted partners whose slow windup is the tell. */
  direct?: [boolean, boolean];
  /** Holding a guard costs nothing, for a fight or a lesson with a script to keep. */
  steadyGuard?: [boolean, boolean];
  /** A scripted fight or a lesson decides how it ends for itself. */
  noClock?: boolean;
};
export type Tsuba = {
  ticks: number;
  /** Which way it's going: above zero the first fighter's winning, below it the second. */
  balance: number;
  pushing: [boolean, boolean];
  guarding: [boolean, boolean];
  /** Someone drawing back for a hiki strike, which everyone can see coming. */
  pulling: [{ attack: AttackKind; ticks: number; total: number } | null, { attack: AttackKind; ticks: number; total: number } | null];
};
export type DuelState = {
  phase: "bow" | "fight" | "zanshin" | "point" | "wakare" | "crossing" | "turning" | "closing" | "over";
  phaseTicks: number;
  fighters: [Fighter, Fighter];
  winner: 0 | 1 | null;
  lastScore: { by: 0 | 1; attack: AttackKind; defenderStance: Stance } | null;
  /** The follow-through after a clean hit, which the point depends on. */
  zanshin: { by: 0 | 1; attack: AttackKind; target: Target; defenderStance: Stance; traveled: number; needed: number; left: number; dir: -1 | 1 } | null;
  /** Hilt to hilt. */
  lock: Tsuba | null;
  /** How much of the match's time is left, in ticks of fighting, or null if there's no limit (any more). */
  clock: number | null;
  /** Who scored first, which decides a match that runs out of time at one all. */
  firstPoint: 0 | 1 | null;
  /** Time ran out with nobody scoring, so the next point wins. */
  encho: boolean;
  /** It's the clock that's just sent them back to their lines, not a point. */
  timeUp: boolean;
  /**
   * They've passed each other, so each is on the other's side. Every rule assumes the first fighter is
   * on the left, so the rules carry on untouched and only the screen and the keys are mirrored.
   */
  crossed: boolean;
  /** Where the two are headed as they pass. */
  crossTo: [number, number] | null;
  events: DuelEvent[];
  options: DuelOptions;
  /** Where this frame falls in the tempo's cycle. */
  beat: number;
  /** How many more frames everything holds still for after an impact. */
  freeze: number;
  /** Whether the rules moved on the last frame. */
  ticked: boolean;
  /** What each fighter pressed on frames when the rules weren't moving, so nothing gets lost. */
  pressed: [Pressed, Pressed];
};
/** The once-only parts of an input, as opposed to what's being held down. */
type Pressed = Pick<FighterInput, "attack" | "stomp" | "dash" | "parry" | "opening">;

/** What each attack strikes, what it leaves open while winding up, and how long that takes. */
export const ATTACKS: Record<AttackKind, { strikes: Target; exposes: Target; windup: number }> = {
  men: { strikes: "men", exposes: "kote", windup: 16 },
  kote: { strikes: "kote", exposes: "men", windup: 14 },
  do: { strikes: "do", exposes: "men", windup: 18 },
  bigMen: { strikes: "men", exposes: "do", windup: 46 },
  quickMen: { strikes: "men", exposes: "kote", windup: 16 },
};

const ALL_TARGETS: Target[] = ["men", "kote", "do"];
const NOTHING_PRESSED: Pressed = { attack: null };
const NEVER_STOMPED = 9999;

type KamaeRules = {
  /** What standing in this stance leaves open. */
  open: Target[];
  /** What's still covered after a miss. */
  openAfterMiss: Target[];
  /** Where a windup leaves you open, where it isn't the usual place. */
  tells: Partial<Record<AttackKind, Target>>;
  /** How much further than usual a strike reaches. */
  reach: number;
  /** How much longer a miss leaves you hanging. */
  extraRecovery: number;
  /** How much of a blocked strike's ki you pay. */
  absorbs: number;
};

/**
 * Jodan is held overhead: the men is out of reach, and one-handed strikes land from further out, but
 * the wrist and body are open and a miss overextends you. Nito's short sword covers the men all the
 * time, the wrist too after a miss, and soaks up blocks. Raising the long one opens the do, whichever strike it is.
 */
export const KAMAE: Record<Kamae, KamaeRules> = {
  chudan: { open: ALL_TARGETS, openAfterMiss: ALL_TARGETS, tells: {}, reach: 0, extraRecovery: 0, absorbs: 1 },
  jodan: { open: ["kote", "do"], openAfterMiss: ALL_TARGETS, tells: { men: "kote", kote: "do", quickMen: "kote" }, reach: 10, extraRecovery: 14, absorbs: 1 },
  nito: { open: ["kote", "do"], openAfterMiss: ["do"], tells: { men: "do", kote: "do", do: "do", bigMen: "do", quickMen: "do" }, reach: 0, extraRecovery: 0, absorbs: 0.5 },
};

/** What an attack leaves open while it winds up, in this stance. */
export const exposes = (attack: AttackKind, kamae: Kamae): Target => KAMAE[kamae].tells[attack] ?? ATTACKS[attack].exposes;

const OPENING_SHOWS: Record<Opening, Target> = { raise: "do", wrist: "kote", drop: "men" };
/** What this opening leaves exposed. Jodan's men is out of reach, and nito only ever opens the do. */
export const openingTarget = (opening: Opening, kamae: Kamae): Target => {
  if (kamae === "nito") return "do";
  const target = OPENING_SHOWS[opening];
  return KAMAE[kamae].open.includes(target) ? target : KAMAE[kamae].open[0];
};

export function exposedTargets(f: Fighter): Target[] {
  if (f.stance === "block" || f.stance === "parry") return [];
  if (f.stance === "opening" && f.opening) return [openingTarget(f.opening, f.kamae)];
  if (f.stance === "windup" && f.attack) return [f.opening ? openingTarget(f.opening, f.kamae) : exposes(f.attack, f.kamae)];
  if (f.stance === "guard" || f.stance === "seme") return [...KAMAE[f.kamae].open];
  if (f.stance === "recovery") return [...KAMAE[f.kamae].openAfterMiss];
  return [...ALL_TARGETS];
}

export function distance(s: DuelState): number {
  return s.fighters[1].x - s.fighters[0].x;
}

const MIRROR = RING_MIN + RING_MAX;
/** Where someone at this position in the rules is on the screen. */
export const screenX = (s: Pick<DuelState, "crossed">, x: number): number => (s.crossed ? MIRROR - x : x);
/** Which way this fighter faces on the screen. */
export const faceDir = (s: Pick<DuelState, "crossed">, i: 0 | 1): -1 | 1 => ((i === 0) !== s.crossed ? 1 : -1);

/** Where each fighter stands to begin. */
export const startX = (i: 0 | 1) => (RING_MIN + RING_MAX) / 2 + (i === 0 ? -START_DISTANCE / 2 : START_DISTANCE / 2);

function newFighter(i: 0 | 1, options: DuelOptions): Fighter {
  const kiMax = options.kiMax?.[i] ?? KI_MAX;
  return { kamae: options.kamae?.[i] ?? "chudan", x: startX(i), ki: kiMax, kiMax, stance: "guard", stanceTicks: 0, attack: null, points: 0, stompAge: NEVER_STOMPED, launchTicks: 0, launchDir: 0, launchStrikeTicks: 0, pressure: 0, kiaiTicks: 0, parryCooldown: 0, counterTicks: 0, hiki: false, opening: null, openingTicks: 0, queued: null, countering: false, reparryTicks: 0, reparryUsed: false };
}

export function createDuel(options: DuelOptions = {}): DuelState {
  return {
    phase: "bow",
    phaseTicks: BOW_TICKS,
    fighters: [newFighter(0, options), newFighter(1, options)],
    winner: null,
    lastScore: null,
    zanshin: null,
    lock: null,
    clock: options.noClock ? null : MATCH_TICKS,
    firstPoint: null,
    encho: false,
    timeUp: false,
    crossed: false,
    crossTo: null,
    events: [{ type: "bow" }],
    options,
    beat: 0,
    freeze: 0,
    ticked: true,
    pressed: [NOTHING_PRESSED, NOTHING_PRESSED],
  };
}

export function skipBow(state: DuelState): DuelState {
  return state.phase === "bow" ? { ...structuredClone(state), phase: "fight", phaseTicks: 0, events: [] } : state;
}

/** Straight to the end of the closing ceremony, once it's started. */
export function skipClosing(state: DuelState): DuelState {
  return state.phase === "closing" ? { ...structuredClone(state), phase: "over", phaseTicks: 0, events: [] } : state;
}

const isTired = (f: Fighter) => f.ki < KI_LOW;

function startRecovery(f: Fighter): void {
  f.stance = "recovery";
  f.attack = null;
  f.hiki = false;
  const ticks = RECOVERY_TICKS + KAMAE[f.kamae].extraRecovery;
  f.stanceTicks = isTired(f) ? Math.round(ticks * LOW_KI_SLOWDOWN) : ticks;
}

/** How long this strike takes, and it's gone. A parry's quick answer is the only one that needs no opening behind it, apart from a scripted partner's. */
function startStrike(s: DuelState, i: 0 | 1, attack: AttackKind): void {
  const f = s.fighters[i];
  const fromOpening = f.stance === "opening";
  const usual = fromOpening ? ATTACKS[attack].windup : (s.options.windups?.[i]?.[attack] ?? ATTACKS[attack].windup);
  f.countering = f.counterTicks > 0;
  // Off a launch, the strike takes a little longer than usual, so the launch is the warning an opening would have been.
  const offLaunch = f.launchStrikeTicks > 0 && !f.countering ? Math.max(0, LAUNCH_STRIKE_EXTRA - (fromOpening ? f.openingTicks : 0)) : 0;
  const base = (f.countering ? Math.min(usual, COUNTER_WINDUP) : usual) + offLaunch;
  if (f.countering) {
    f.launchTicks = COUNTER_DRIVE_TICKS;
    f.launchDir = i === 0 ? 1 : -1;
  }
  f.counterTicks = 0;
  f.launchStrikeTicks = 0;
  f.stanceTicks = isTired(f) ? Math.round(base * LOW_KI_SLOWDOWN) : base;
  f.stance = "windup";
  f.attack = attack;
  f.queued = null;
  f.ki = Math.max(0, f.ki - SWING_COST);
}

function applyInput(s: DuelState, i: 0 | 1, input: FighterInput): void {
  const f = s.fighters[i];
  const canParry = !s.options.basics;
  if (f.parryCooldown > 0) f.parryCooldown--;
  if (f.counterTicks > 0) f.counterTicks--;
  if (f.launchStrikeTicks > 0) f.launchStrikeTicks--;
  if (f.stance === "block" && !input.block) f.stance = "guard";
  if (f.stance === "seme" && (!input.seme || f.ki <= 0 || input.attack || input.block || input.dash || input.opening)) f.stance = "guard";
  if (f.stance === "opening") {
    // A strike pressed just as the key comes up was meant to go, so that's not letting go of it.
    if (input.block || input.seme || input.parry || (!input.opening && !f.queued && !input.attack)) {
      f.stance = "guard";
      f.opening = null;
      f.queued = null;
    } else if (input.opening && input.opening !== f.opening) {
      f.opening = input.opening;
      f.openingTicks = 0;
    }
  }
  if (canParry && input.parry && f.stance === "deflected" && !f.reparryUsed) {
    f.reparryUsed = true;
    f.reparryTicks = REPARRY_WINDOW;
  }
  if (canParry && input.parry && !input.attack && f.parryCooldown === 0 && (f.stance === "guard" || f.stance === "block")) {
    f.stance = "parry";
    f.stanceTicks = PARRY_WINDOW;
    f.parryCooldown = PARRY_COOLDOWN;
    f.launchTicks = 0;
    return;
  }
  const free = f.stance === "guard" || f.stance === "opening";
  if (free && !input.block && input.dash && f.launchTicks === 0) {
    f.launchTicks = LAUNCH_TICKS;
    f.launchDir = input.dash;
    f.ki = Math.max(0, f.ki - LAUNCH_COST);
    if (input.dash === (i === 0 ? 1 : -1)) f.launchStrikeTicks = LAUNCH_TICKS + LAUNCH_STRIKE_GRACE;
    s.events.push({ type: "launch", by: i });
  }
  // Off a launch toward them, the strike goes at once, from guard or from an opening alike.
  if (free && input.attack && !input.block && f.launchStrikeTicks > 0) {
    startStrike(s, i, input.attack);
  } else if (f.stance === "guard" && input.attack && (s.options.direct?.[i] || f.counterTicks > 0)) {
    startStrike(s, i, input.attack);
  } else if (f.stance === "guard" && input.opening && !input.block && !input.seme && f.ki >= OPENING_START_KI) {
    f.stance = "opening";
    f.opening = input.opening;
    f.openingTicks = 0;
    f.queued = input.attack;
  } else if (f.stance === "opening") {
    if (input.attack) f.queued = input.attack;
    if (f.queued && (f.openingTicks >= OPENING_MIN || f.counterTicks > 0)) startStrike(s, i, f.queued);
  } else if ((f.stance === "guard" || f.stance === "block") && input.block) {
    f.stance = "block";
  } else if (f.stance === "guard" && input.seme && f.launchTicks === 0 && f.ki >= SEME_START_KI) {
    f.stance = "seme";
  } else if (f.stance === "guard" && input.attack) {
    s.events.push({ type: "noopening", by: i });
  }
  if ((f.stance === "guard" || f.stance === "opening") && f.launchTicks === 0) {
    f.x += input.move * WALK * (isTired(f) ? LOW_KI_WALK : 1);
  }
  if (f.stance === "block") f.launchTicks = 0;
  if (f.launchTicks > 0) {
    f.launchTicks--;
    f.x += f.launchDir * LAUNCH_SPEED * (isTired(f) ? LOW_KI_WALK : 1);
  }
}

function keepApart(s: DuelState): void {
  const [a, b] = s.fighters;
  const overlap = MIN_DISTANCE - (b.x - a.x);
  if (overlap > 0) {
    a.x -= overlap / 2;
    b.x += overlap / 2;
  }
  a.x = Math.max(RING_MIN, Math.min(a.x, RING_MAX - MIN_DISTANCE));
  b.x = Math.min(RING_MAX, Math.max(b.x, a.x + MIN_DISTANCE));
}

function pushApart(s: DuelState): void {
  const [a, b] = s.fighters;
  const mid = (a.x + b.x) / 2;
  a.x = mid - LOCK_DISTANCE / 2;
  b.x = mid + LOCK_DISTANCE / 2;
  if (a.x < RING_MIN) {
    a.x = RING_MIN;
    b.x = RING_MIN + LOCK_DISTANCE;
  }
  if (b.x > RING_MAX) {
    b.x = RING_MAX;
    a.x = RING_MAX - LOCK_DISTANCE;
  }
}

function absorb(s: DuelState, defender: 0 | 1): void {
  const f = s.fighters[defender];
  f.ki -= ABSORB_COST * KAMAE[f.kamae].absorbs;
  if (f.ki <= 0) breakGuard(s, defender);
}

function breakGuard(s: DuelState, i: 0 | 1): void {
  const f = s.fighters[i];
  f.ki = KI_AFTER_BREAK;
  f.stance = "broken";
  f.stanceTicks = BROKEN_TICKS;
  s.events.push({ type: "broken", by: i });
}

/** Whether two people can end up hilt to hilt. Anyone already stunned just gets bumped. */
const canLock = (f: Fighter) => f.stance === "guard" || f.stance === "block" || f.stance === "opening" || f.stance === "seme" || f.stance === "windup" || f.stance === "parry";

function enterLock(s: DuelState, balance = 0): void {
  s.lock = { ticks: 0, balance, pushing: [false, false], guarding: [false, false], pulling: [null, null] };
  for (const f of s.fighters) {
    f.stance = "tsuba";
    f.stanceTicks = 0;
    f.attack = null;
    f.launchTicks = 0;
    f.hiki = false;
  }
}

/** Anyone standing right up against someone is locked with them. A launch that gets there is a body check, and starts ahead. */
function lockIfTouching(s: DuelState): void {
  if (s.options.basics || s.lock || distance(s) > TSUBA_ENTER) return;
  const [a, b] = s.fighters;
  if (a.stance === "windup" || b.stance === "windup" || !canLock(a) || !canLock(b)) return;
  const aCharging = a.launchTicks > 0 && a.launchDir === 1;
  const bCharging = b.launchTicks > 0 && b.launchDir === -1;
  const balance = (aCharging ? TAIATARI_BALANCE : 0) - (bCharging ? TAIATARI_BALANCE : 0);
  if (aCharging !== bCharging) s.events.push({ type: "taiatari", by: aCharging ? 0 : 1 });
  s.events.push({ type: "lock" });
  enterLock(s, balance);
}

/**
 * Both have committed, so neither gets anything. It takes one strike landing as the other's about to, or both
 * together. A clean strike has to be a lot closer to theirs to be caught up in it, because answering a tell in
 * time should score. From a distance they pass each other, and up close there's no room, so they bind hilt to hilt.
 */
function startsCrossing(s: DuelState, landing: (0 | 1)[], dist: number): boolean {
  if (s.options.basics || dist < RANGE_MIN) return false;
  const [a, b] = s.fighters;
  if (a.hiki || b.hiki) return false;
  const reaches = (i: 0 | 1) => dist <= RANGE_MAX + KAMAE[s.fighters[i].kamae].reach;
  if (!reaches(0) || !reaches(1)) return false;
  if (landing.length === 1) {
    const i = landing[0];
    const them = s.fighters[i === 0 ? 1 : 0];
    // A quick strike is someone going for it right then, even in the moment before it's left the opening.
    const meeting = them.stance === "opening" && them.queued === "quickMen";
    if (them.stance !== "windup" && !meeting) return false;
    const open = exposedTargets(them).includes(ATTACKS[s.fighters[i].attack!].strikes);
    const window = them.attack === "quickMen" ? CROSS_QUICK_WINDOW : open ? CROSS_CLEAN_WINDOW : CROSS_WRONG_WINDOW;
    if (!meeting && them.stanceTicks > window) return false;
  }
  ([0, 1] as const).forEach((i) => s.events.push({ type: "kiai", by: i, target: ATTACKS[(s.fighters[i].attack ?? s.fighters[i].queued)!].strikes }));
  if (dist <= CROSS_LOCK_WITHIN) {
    s.events.push({ type: "lock" });
    for (const f of s.fighters) f.stompAge = NEVER_STOMPED;
    enterLock(s);
    return true;
  }
  s.events.push({ type: "cross" });
  const middle = Math.max(RING_MIN + CROSS_GAP / 2, Math.min(RING_MAX - CROSS_GAP / 2, (a.x + b.x) / 2));
  s.crossTo = [middle + CROSS_GAP / 2, middle - CROSS_GAP / 2];
  for (const f of s.fighters) {
    f.stance = "guard";
    f.stanceTicks = 0;
    f.attack = null;
    f.launchTicks = 0;
    f.stompAge = NEVER_STOMPED;
  }
  s.phase = "crossing";
  return true;
}

/** Walking through. Once they're past, the sides swap over, and they turn to face each other. */
function stepCrossing(s: DuelState): void {
  const to = s.crossTo!;
  s.fighters.forEach((f, i) => {
    const gap = to[i] - f.x;
    f.x = Math.abs(gap) <= CROSS_SPEED ? to[i] : f.x + Math.sign(gap) * CROSS_SPEED;
  });
  if (s.fighters[0].x !== to[0] || s.fighters[1].x !== to[1]) return;
  for (const f of s.fighters) f.x = MIRROR - f.x;
  s.crossed = !s.crossed;
  s.crossTo = null;
  s.phase = "turning";
  s.phaseTicks = CROSS_SETTLE;
}

function resolveLandings(s: DuelState, landing: (0 | 1)[]): void {
  const dist = distance(s);
  const strikes = (i: 0 | 1) => ATTACKS[s.fighters[i].attack!].strikes;
  const opponentOf = (i: 0 | 1): 0 | 1 => (i === 0 ? 1 : 0);
  const outOfReach = (i: 0 | 1) => dist > RANGE_MAX + KAMAE[s.fighters[i].kamae].reach;
  /** Stuck after being parried, with their one try at this counter timed right. */
  const parriedBack = (i: 0 | 1) => s.fighters[i].countering && s.fighters[opponentOf(i)].reparryTicks > 0;
  const lands = (i: 0 | 1) => !outOfReach(i) && dist >= RANGE_MIN && !parriedBack(i) && exposedTargets(s.fighters[opponentOf(i)]).includes(strikes(i));
  // Ki-ken-tai-itchi: a strike only counts when the stomp lands with it.
  const clean = landing.filter((i) => lands(i) && s.fighters[i].stompAge <= STOMP_WINDOW);
  const scoring = clean.filter((i) => !s.options.harmless?.[i]);

  if (startsCrossing(s, landing, dist)) return;

  for (const i of landing) s.events.push(s.fighters[i].hiki ? { type: "kiai", by: i, target: strikes(i), hiki: true } : { type: "kiai", by: i, target: strikes(i) });

  if (clean.length === 2) {
    s.events.push({ type: "aiuchi" });
    for (const i of landing) startRecovery(s.fighters[i]);
    return;
  }

  if (scoring.length === 1) {
    const by = scoring[0];
    const target = strikes(by);
    const striker = s.fighters[by];
    const opponent = s.fighters[opponentOf(by)];
    const forward = by === 0 ? 1 : -1;
    const finish = Math.max(ZANSHIN_EDGE_MIN, Math.min(ZANSHIN_EDGE_MAX, opponent.x + forward * ZANSHIN_PASS));
    // A strike pulled back from the lock carries on the way it's already going.
    s.zanshin = {
      by,
      attack: striker.attack!,
      target,
      defenderStance: opponent.stance,
      traveled: 0,
      needed: striker.hiki ? ZANSHIN_HIKI : Math.abs(finish - striker.x),
      left: ZANSHIN_WINDOW,
      dir: striker.hiki ? (-forward as -1 | 1) : (forward as -1 | 1),
    };
    striker.hiki = false;
    striker.launchTicks = 0;
    opponent.launchTicks = 0;
    s.fighters[by].attack = null;
    s.fighters[by].stance = "guard";
    s.events.push({ type: "hit", by, target });
    s.phase = "zanshin";
    return;
  }

  const tsuba = !s.options.basics;
  let locked = false;
  for (const i of landing) {
    const defender = opponentOf(i);
    const them = s.fighters[defender];
    if (outOfReach(i)) {
      s.events.push({ type: "whiff", by: i });
      startRecovery(s.fighters[i]);
    } else if (dist < RANGE_MIN) {
      s.events.push({ type: "lock", by: i });
      s.fighters[i].stance = "guard";
      s.fighters[i].attack = null;
      s.fighters[i].hiki = false;
      locked = true;
    } else if (tsuba && (them.stance === "parry" || parriedBack(i))) {
      s.events.push({ type: "parry", by: defender });
      const striker = s.fighters[i];
      // Only one counter-parry: a counter knocked aside is nobody's advantage.
      const second = striker.countering;
      striker.attack = null;
      striker.hiki = false;
      them.stance = "guard";
      them.stanceTicks = 0;
      if (dist <= (second ? REPARRY_LOCK_WITHIN : PARRY_LOCK_WITHIN)) {
        striker.stance = "guard";
        locked = true;
      } else if (second) {
        striker.stance = "guard";
        striker.stanceTicks = 0;
      } else {
        // Knocked aside. The one who did it has a moment to answer, and it's cost them nothing.
        striker.stance = "deflected";
        striker.stanceTicks = DEFLECT_TICKS;
        striker.ki = Math.max(0, striker.ki - DEFLECT_KI_LOSS);
        them.counterTicks = COUNTER_TICKS;
        them.ki = Math.min(them.kiMax, them.ki + PARRY_KI);
      }
    } else if (clean.includes(i)) {
      // A harmless strike that would have landed, used by training partners.
      s.events.push({ type: "clean", by: i, target: strikes(i) });
      startRecovery(s.fighters[i]);
    } else if (lands(i)) {
      s.events.push({ type: "flat", by: i });
      startRecovery(s.fighters[i]);
    } else {
      s.events.push({ type: "blocked", by: i });
      startRecovery(s.fighters[i]);
      if (them.stance === "block") {
        absorb(s, defender);
        // From this close the strike carries on into them.
        if (tsuba && landing.length === 1 && dist <= TSUBA_CARRY && them.stance === "block") locked = true;
      }
    }
  }
  if (!locked) return;
  const carried = landing.some((i) => s.fighters[i].stance === "recovery");
  if (tsuba && (carried || landing.every((i) => canLock(s.fighters[i]) && canLock(s.fighters[opponentOf(i)])))) {
    s.events.push({ type: "lock", by: landing[0] });
    enterLock(s);
  } else {
    if (!carried) s.events.push({ type: "lock", by: landing[0] });
    pushApart(s);
  }
}

/** Both walk apart to where they can fight again, as the referee called. */
function stepWakare(s: DuelState): void {
  const [a, b] = s.fighters;
  a.x = Math.max(RING_MIN, a.x - RETURN_WALK);
  b.x = Math.min(RING_MAX, b.x + RETURN_WALK);
  if (distance(s) >= TSUBA_WAKARE_GAP) {
    s.phase = "fight";
    s.phaseTicks = 0;
  }
}

function startPull(s: DuelState, i: 0 | 1, attack: AttackKind): void {
  const lock = s.lock!;
  const f = s.fighters[i];
  // A slower fighter's tells show here too, and get longer as they go easier on you.
  const total = Math.max(HIKI_TELL, Math.ceil((s.options.windups?.[i]?.[attack] ?? 0) / 2));
  lock.pulling[i] = { attack, ticks: total, total };
  f.ki = Math.max(0, f.ki - SWING_COST);
}

/** The pull's done: this fighter springs back and strikes. Whatever the other one's doing right now decides how it goes. */
function firePull(s: DuelState, i: 0 | 1): void {
  const lock = s.lock!;
  const f = s.fighters[i];
  const pull = lock.pulling[i]!;
  f.stance = "windup";
  f.attack = pull.attack;
  f.stanceTicks = HIKI_WINDUP;
  f.hiki = true;
  f.launchDir = i === 0 ? -1 : 1;
  f.launchTicks = HIKI_STEP_TICKS;
  if (f.stompAge <= pull.total + STOMP_WINDOW) f.stompAge = 0;
  const other = i === 0 ? 1 : 0;
  const them = s.fighters[other];
  if (lock.pulling[other]) return;
  if (lock.pushing[other]) {
    // Leaning on someone who's just gone.
    them.stance = "stumble";
    them.stanceTicks = STUMBLE_TICKS;
  } else {
    them.stance = lock.guarding[other] ? "block" : "guard";
    them.stanceTicks = 0;
  }
}

function endLockApart(s: DuelState): void {
  for (const f of s.fighters) {
    f.stance = "guard";
    f.stanceTicks = 0;
  }
  s.lock = null;
  pushApart(s);
}

function stepLock(s: DuelState, inputs: FighterInput[]): void {
  const lock = s.lock!;
  lock.ticks++;
  const [a, b] = s.fighters;
  let steppingOut: 0 | 1 | null = null;
  ([0, 1] as const).forEach((i) => {
    const input = inputs[i];
    const back = i === 0 ? -1 : 1;
    if (!lock.pulling[i] && input.attack) startPull(s, i, input.attack);
    const free = !lock.pulling[i];
    lock.pushing[i] = free && input.move === -back && !input.block;
    lock.guarding[i] = free && input.block;
    if (free && input.move === back && !input.block && steppingOut === null) steppingOut = i;
    if (lock.pushing[i]) s.fighters[i].ki = Math.max(0, s.fighters[i].ki - TSUBA_PUSH_COST);
  });

  const strength = (i: 0 | 1) => (lock.pushing[i] ? 0.5 + (0.5 * s.fighters[i].ki) / s.fighters[i].kiMax : 0);
  const shove = strength(0) - strength(1);
  lock.balance += shove;

  // Closing up to hilts, and drifting whichever way the push is going.
  const mid = (a.x + b.x) / 2 + Math.sign(shove) * TSUBA_DRIFT;
  const gap = Math.max(TSUBA_GAP, distance(s) - TSUBA_CLOSE_SPEED);
  const centre = Math.max(RING_MIN + gap / 2, Math.min(RING_MAX - gap / 2, mid));
  a.x = centre - gap / 2;
  b.x = centre + gap / 2;

  const fires: (0 | 1)[] = [];
  ([0, 1] as const).forEach((i) => {
    const pull = lock.pulling[i];
    if (pull && --pull.ticks <= 0) fires.push(i);
  });

  if (fires.length) {
    for (const i of fires) firePull(s, i);
    // Anyone still pulling back is caught with their hands down: that pull's lost, and nothing's held. Left in
    // the lock's stance with no lock, they could never lock again, and the other side would walk into them forever (issue #39).
    for (const f of s.fighters) {
      if (f.stance !== "tsuba") continue;
      f.stance = "guard";
      f.stanceTicks = 0;
    }
    s.lock = null;
    return;
  }
  if (steppingOut !== null) {
    s.events.push({ type: "stepout", by: steppingOut });
    const other = steppingOut === 0 ? 1 : 0;
    if (lock.pulling[other]) {
      firePull(s, other);
      s.fighters[steppingOut].stance = "guard";
      s.lock = null;
    } else endLockApart(s);
    return;
  }
  if (s.options.longLock) return;
  if (Math.abs(lock.balance) >= TSUBA_BREAK) {
    const winner = lock.balance > 0 ? 0 : 1;
    const loser = s.fighters[winner === 0 ? 1 : 0];
    s.fighters[winner].stance = "guard";
    s.fighters[winner].stanceTicks = 0;
    loser.stance = "stumble";
    loser.stanceTicks = STUMBLE_TICKS;
    loser.launchDir = winner === 0 ? 1 : -1;
    loser.launchTicks = SHOVE_TICKS;
    s.events.push({ type: "shove", by: winner });
    s.lock = null;
    return;
  }
  if (lock.ticks >= TSUBA_TICKS) {
    s.events.push({ type: "wakare" });
    for (const f of s.fighters) {
      f.stance = "guard";
      f.stanceTicks = 0;
      f.launchTicks = 0;
    }
    s.lock = null;
    s.phase = "wakare";
  }
}

/** Everyone's going back to their own line, whichever side they've ended up on. */
function backToTheLines(s: DuelState): void {
  s.phase = "point";
  s.phaseTicks = RETURN_SETTLE;
  s.lock = null;
  if (s.crossed) {
    for (const f of s.fighters) f.x = MIRROR - f.x;
    s.crossed = false;
  }
  for (const f of s.fighters) {
    f.stance = "guard";
    f.stanceTicks = 0;
    f.attack = null;
    f.launchTicks = 0;
    f.hiki = false;
  }
}

/** Nothing in flight is lost: a strike that's going still lands, and only then is the time up. */
function endIfOutOfTime(s: DuelState): void {
  if (s.clock !== 0) return;
  if (s.fighters.some((f) => f.stance === "windup") || s.lock?.pulling.some((p) => p)) return;
  const [a, b] = s.fighters;
  if (a.points === 0 && b.points === 0) {
    s.encho = true;
    s.events.push({ type: "encho" });
  } else {
    s.winner = a.points > b.points ? 0 : b.points > a.points ? 1 : s.firstPoint;
    s.events.push({ type: "time" });
  }
  s.clock = null;
  s.timeUp = true;
  backToTheLines(s);
}

function stepZanshin(s: DuelState, inputs: FighterInput[]): void {
  const z = s.zanshin!;
  const striker = s.fighters[z.by];
  z.left--;
  if (inputs[z.by].move === z.dir) {
    z.traveled += ZANSHIN_SLIDE;
    striker.x = Math.max(ZANSHIN_EDGE_MIN, Math.min(ZANSHIN_EDGE_MAX, striker.x + z.dir * ZANSHIN_SLIDE));
  }
  if (z.traveled >= z.needed) {
    striker.points++;
    s.firstPoint ??= z.by;
    s.lastScore = { by: z.by, attack: z.attack, defenderStance: z.defenderStance };
    s.events.push({ type: "clean", by: z.by, target: z.target });
    s.zanshin = null;
    s.phase = "point";
    s.phaseTicks = RETURN_SETTLE;
    const winner = s.fighters.findIndex((f) => f.points >= (s.encho ? 1 : (s.options.pointsToWin ?? POINTS_TO_WIN)));
    if (winner >= 0) s.winner = winner as 0 | 1;
    backToTheLines(s);
  } else if (z.left <= 0) {
    s.events.push({ type: "nozanshin", by: z.by });
    startRecovery(striker);
    s.zanshin = null;
    s.phase = "fight";
    keepApart(s);
  }
}

function press(s: DuelState, by: 0 | 1, amount: number): void {
  const opponentIndex = by === 0 ? 1 : 0;
  const opponent = s.fighters[opponentIndex];
  opponent.pressure += amount;
  if (opponent.pressure >= SEME_TICKS) {
    opponent.pressure = 0;
    opponent.stance = "shaken";
    opponent.stanceTicks = SHAKEN_TICKS;
    opponent.attack = null;
    opponent.launchTicks = 0;
    opponent.ki = Math.max(0, opponent.ki - SHAKEN_KI_LOSS);
    s.events.push({ type: "shaken", by: opponentIndex });
  }
}

/** The spirit shout: a stomp while holding seme. */
function shout(s: DuelState, by: 0 | 1): void {
  const f = s.fighters[by];
  f.ki -= KIAI_COST;
  f.kiaiTicks = KIAI_COOLDOWN;
  s.events.push({ type: "shout", by });
  const opponent = s.fighters[by === 0 ? 1 : 0];
  if (distance(s) <= SEME_RANGE && opponent.stance !== "shaken" && opponent.stance !== "seme") press(s, by, KIAI_PRESS);
}

/**
 * Pressure builds on the opponent while a fighter holds seme, and fades when they stop. A fighter
 * with a presence presses all the time, unless the opponent is holding seme against them.
 */
function applySeme(s: DuelState): void {
  s.fighters.forEach((f, i) => {
    const by = i as 0 | 1;
    const opponent = s.fighters[i === 0 ? 1 : 0];
    const inReach = distance(s) <= SEME_RANGE && opponent.stance !== "shaken";
    if (f.stance === "seme") {
      f.ki = Math.max(0, f.ki - SEME_DRAIN);
      // A standoff: both spending ki, and neither getting anywhere until someone commits or backs off.
      if (inReach && opponent.stance !== "seme") press(s, by, s.options.semeTaken?.[i === 0 ? 1 : 0] ?? 1);
      return;
    }
    if (opponent.stance !== "seme") opponent.pressure = Math.max(0, opponent.pressure - SEME_DECAY);
    const presence = s.options.presence?.[i] ?? 0;
    const composed = f.stance === "guard" || f.stance === "block" || f.stance === "opening" || f.stance === "windup" || f.stance === "tsuba";
    if (presence > 0 && composed && inReach && opponent.stance !== "seme") press(s, by, presence);
  });
}

function resetForNextPoint(s: DuelState): void {
  s.timeUp = false;
  s.fighters.forEach((f) => {
    f.ki = f.kiMax;
    f.stance = "guard";
    f.stanceTicks = 0;
    f.attack = null;
    f.stompAge = NEVER_STOMPED;
    f.launchTicks = 0;
    f.launchStrikeTicks = 0;
    f.pressure = 0;
    f.parryCooldown = 0;
    f.counterTicks = 0;
    f.hiki = false;
  });
  s.phase = "fight";
  s.phaseTicks = 0;
}

/** Both walk back to their lines, getting their breath back. The next point starts as soon as they're ready. */
function stepPoint(s: DuelState): void {
  let home = true;
  s.fighters.forEach((f, i) => {
    const line = startX(i as 0 | 1);
    const gap = line - f.x;
    f.x = Math.abs(gap) <= RETURN_WALK ? line : f.x + Math.sign(gap) * RETURN_WALK;
    if (f.x !== line) home = false;
    f.ki = Math.min(f.kiMax, f.ki + (f.kiMax - f.ki) * RETURN_KI_RATE);
    f.pressure = 0;
  });
  if (!home || --s.phaseTicks > 0) return;
  if (s.winner !== null) {
    s.fighters.forEach((f) => (f.ki = f.kiMax));
    s.phase = "closing";
    s.phaseTicks = CLOSING_TICKS;
  } else resetForNextPoint(s);
}

/** How long each kind of contact holds everything still. A tick with several takes the longest. */
const FREEZE_FOR: Partial<Record<DuelEvent["type"], number>> = {
  hit: FREEZE_HIT,
  broken: FREEZE_BREAK,
  parry: FREEZE_PARRY,
  cross: FREEZE_CROSS,
  aiuchi: FREEZE_AIUCHI,
  shove: FREEZE_SHOVE,
  taiatari: FREEZE_SHOVE,
  lock: FREEZE_LOCK,
  shaken: FREEZE_SHAKEN,
  blocked: FREEZE_BLOCK,
};

/** Whether the rules will move on the next frame. The ceremonies have their own timing and don't run on the tempo. */
export function ticksNext(s: Pick<DuelState, "phase" | "beat" | "freeze">): boolean {
  if (s.phase === "bow" || s.phase === "closing" || s.phase === "over") return true;
  return s.freeze === 0 && s.beat % TEMPO_FRAMES < TEMPO_TICKS;
}

const pressedIn = ({ attack, stomp, dash, parry, opening }: FighterInput, before: Pressed): Pressed => ({
  // The opening a strike was pressed with, in case both are let go before the rules next move.
  opening: before.attack ? before.opening : opening,
  attack: before.attack ?? attack,
  stomp: before.stomp || stomp,
  dash: before.dash || dash,
  parry: before.parry || parry,
});

/**
 * One frame of a duel, which is what everything outside the rules should call. It's pure and counts only frames,
 * so two players given the same inputs are always on the same beat and freeze for the same frames.
 */
export function step(state: DuelState, a: FighterInput, b: FighterInput): DuelState {
  const pressed: [Pressed, Pressed] = [pressedIn(a, state.pressed[0]), pressedIn(b, state.pressed[1])];
  if (!ticksNext(state)) {
    const holding = state.freeze > 0;
    return { ...state, events: [], ticked: false, pressed, freeze: holding ? state.freeze - 1 : 0, beat: holding ? state.beat : state.beat + 1 };
  }
  const merged = (input: FighterInput, p: Pressed): FighterInput => ({ ...input, ...p, opening: input.opening ?? (p.attack ? p.opening : null) });
  const next = ruleTick(state, merged(a, pressed[0]), merged(b, pressed[1]));
  next.ticked = true;
  next.pressed = [NOTHING_PRESSED, NOTHING_PRESSED];
  next.beat = (state.beat + 1) % TEMPO_FRAMES;
  next.freeze = Math.max(0, ...next.events.map((e) => FREEZE_FOR[e.type] ?? 0));
  return next;
}

/** One tick of the rules themselves, which take no notice of the tempo. */
export function ruleTick(state: DuelState, a: FighterInput, b: FighterInput): DuelState {
  const s = structuredClone(state);
  s.events = [];
  const was = s.phase;
  tickRules(s, a, b);
  if (was === "fight" && s.clock !== null) s.clock = Math.max(0, s.clock - 1);
  // A zanshin that was going when time ran out has just finished, one way or the other.
  if (s.phase === "fight" || (was === "zanshin" && s.phase === "point" && s.winner === null)) endIfOutOfTime(s);
  // However someone came to stop showing an opening, it's over, along with anything waiting on it.
  for (const f of s.fighters) {
    if (f.stance !== "opening" && f.stance !== "windup") f.opening = null;
    if (f.stance !== "opening") {
      f.openingTicks = 0;
      f.queued = null;
    }
    if (f.stance !== "windup") f.countering = false;
    if (f.stance !== "guard" && f.stance !== "opening") f.launchStrikeTicks = 0;
    if (f.stance !== "deflected") {
      f.reparryTicks = 0;
      f.reparryUsed = false;
    }
  }
  return s;
}

function tickRules(s: DuelState, a: FighterInput, b: FighterInput): void {
  if (s.phase === "over") return;
  if (s.phase === "bow") {
    if (--s.phaseTicks <= 0) s.phase = "fight";
    return;
  }
  if (s.phase === "closing") {
    if (--s.phaseTicks <= 0) s.phase = "over";
    return;
  }
  if (s.phase === "point") {
    stepPoint(s);
    return;
  }
  if (s.phase === "wakare") {
    stepWakare(s);
    return;
  }
  if (s.phase === "crossing") {
    stepCrossing(s);
    return;
  }
  if (s.phase === "turning") {
    if (--s.phaseTicks <= 0) s.phase = "fight";
    return;
  }

  const inputs = [a, b];
  if (s.phase === "zanshin") {
    stepZanshin(s, inputs);
    return;
  }
  s.fighters.forEach((f, i) => {
    f.stompAge++;
    if (inputs[i].stomp) {
      f.stompAge = 0;
      s.events.push({ type: "stomp", by: i as 0 | 1 });
    }
  });
  if (s.lock) {
    stepLock(s, inputs);
    if (!s.lock) return;
    // A strong presence doesn't stop at close quarters, and a flinch breaks the lock.
    applySeme(s);
    if (s.fighters.some((f) => f.stance === "shaken")) {
      for (const f of s.fighters) if (f.stance === "tsuba") f.stance = "guard";
      s.lock = null;
    }
    return;
  }
  s.fighters.forEach((f, i) => {
    applyInput(s, i as 0 | 1, inputs[i]);
    if (f.kiaiTicks > 0) f.kiaiTicks--;
    if (f.stance === "seme" && inputs[i].stomp && f.kiaiTicks === 0 && f.ki >= KIAI_COST) shout(s, i as 0 | 1);
  });
  keepApart(s);
  lockIfTouching(s);
  if (s.lock) return;

  const landing: (0 | 1)[] = [];
  s.fighters.forEach((f, i) => {
    if (f.stance === "guard") {
      f.ki = Math.min(f.kiMax, f.ki + KI_RECOVERY);
    } else if (f.stance === "block") {
      if (!s.options.steadyGuard?.[i]) {
        f.ki -= BLOCK_DRAIN;
        if (f.ki <= 0) breakGuard(s, i as 0 | 1);
      }
    } else if (f.stance === "opening") {
      // Holding an opening is free but not restful (owner, issue #15): ki neither drains nor comes back, so bait can wait as long as it likes without being a way to rest.
      f.openingTicks++;
    } else if (f.stance === "windup") {
      if (--f.stanceTicks <= 0) landing.push(i as 0 | 1);
    } else if (f.stance === "deflected" && f.reparryTicks > 0) {
      f.stanceTicks--;
      if (--f.reparryTicks === 0) f.stanceTicks += REPARRY_MISS;
    } else if (f.stance === "recovery" || f.stance === "broken" || f.stance === "shaken" || f.stance === "deflected" || f.stance === "stumble") {
      if (--f.stanceTicks <= 0) f.stance = "guard";
    } else if (f.stance === "parry") {
      if (--f.stanceTicks <= 0) f.stance = inputs[i].block ? "block" : "guard";
    }
  });

  if (landing.length) resolveLandings(s, landing);
  if (s.phase === "fight") applySeme(s);
}
