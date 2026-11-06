import {
  ABSORB_COST, BRAWL_KIAI_PRESS, BRAWL_SEME_TICKS, BROKEN_TICKS, COWER_TICKS, SEME_DECAY, SEME_DRAIN, SEME_RANGE, SEME_START_KI, KI_AFTER_BREAK, KIAI_COOLDOWN, KIAI_COST, KI_LOW, KI_MAX, KI_RECOVERY, LAUNCH_COST, LAUNCH_SPEED, LAUNCH_TICKS, LOCK_DISTANCE,
  LOW_KI_SLOWDOWN, LOW_KI_WALK, RANGE_MAX, RANGE_MIN, RECOVERY_TICKS, DRILL_STOMP_WINDOW, SWING_COST, WALK, ZANSHIN_PASS, ZANSHIN_SLIDE, ZANSHIN_WINDOW,
} from "./constants.ts";
import { nextRandom } from "./rival.ts";
import { ATTACKS, type AttackKind, type FighterInput, type Stance, type Target } from "./rules.ts";

/** Street fights keep their own quick strikes: only a duel has the slower tempo. */
const BRAWL_WINDUP: Record<AttackKind, number> = { men: 8, kote: 6, do: 10, bigMen: 46, quickMen: 12 };

export type BullyKind = "fist" | "stick";
export type BrawlSpec = { kind: BullyKind; x: number };
export type Bully = {
  id: number;
  kind: BullyKind;
  x: number;
  state: "wait" | "walk" | "tell" | "recover" | "stagger" | "cower" | "down";
  ticks: number;
  cooldown: number;
  /** In a drill: the one target this partner is offering, or null while their guard is shut. */
  opening?: Target | null;
};
export type BrawlPlayer = {
  x: number;
  facing: 1 | -1;
  ki: number;
  kiMax: number;
  stance: Stance;
  stanceTicks: number;
  attack: AttackKind | null;
  stompAge: number;
  launchTicks: number;
  launchDir: -1 | 0 | 1;
  kiaiTicks: number;
};
export type BrawlEvent = {
  type: "kiai" | "shout" | "stomp" | "launch" | "hit" | "flat" | "clean" | "nozanshin" | "blocked" | "whiff" | "lock" | "broken" | "hurt" | "swing" | "cower";
  target?: Target;
  bully?: number;
};
export type BrawlState = {
  phase: "fight" | "won" | "lost" | "fled";
  /** Your health, which you bring with you and take away with you. */
  hp: number;
  invulnerable: number;
  pressure: number;
  player: BrawlPlayer;
  bullies: Bully[];
  zanshin: { bully: number; target: Target; traveled: number; needed: number; left: number } | null;
  worldEnd: number;
  rng: number;
  events: BrawlEvent[];
  /** Partners in a drill stand and wait. They don't walk or swing. */
  drill?: boolean;
};

const FULL_HP = 100;
/** A stick hurts more than a fist. */
export const HIT_DAMAGE: Record<BullyKind, number> = { fist: 15, stick: 20 };
const NOTICE_RANGE = 150;
const END_MARGIN = 80;
const REACH: Record<BullyKind, number> = { fist: 28, stick: 44 };
const GAP_BEHIND_REACH = 6;
export const TELL_TICKS: Record<BullyKind, number> = { fist: 34, stick: 42 };
const WALK_SPEED: Record<BullyKind, number> = { fist: 0.6, stick: 0.5 };
/** Hands up leaves the belly open. A raised stick leaves the wrist open. */
export const OPEN_DURING_TELL: Record<BullyKind, Target> = { fist: "do", stick: "kote" };
const BULLY_RECOVER_TICKS = 40;
const MAX_ATTACKING = 2;
const COOLDOWN_MIN = 30;
const COOLDOWN_SPREAD = 70;
const INVULNERABLE_TICKS = 45;
const KNOCKBACK = 8;

export function createBrawl(options: { bullies: BrawlSpec[]; seed: number; kiMax?: number; hp?: number; startX?: number; drill?: boolean }): BrawlState {
  const kiMax = options.kiMax ?? KI_MAX;
  let rng = options.seed;
  const bullies: Bully[] = options.bullies.map((spec, id) => {
    const roll = nextRandom(rng);
    rng = roll.seed;
    return { id, kind: spec.kind, x: spec.x, state: "wait", ticks: 0, cooldown: Math.floor(roll.value * COOLDOWN_MIN) };
  });
  return {
    phase: "fight",
    hp: options.hp ?? FULL_HP,
    invulnerable: 0,
    pressure: 0,
    player: {
      x: options.startX ?? 40,
      facing: 1,
      ki: kiMax,
      kiMax,
      stance: "guard",
      stanceTicks: 0,
      attack: null,
      stompAge: 9999,
      launchTicks: 0,
      launchDir: 0,
      kiaiTicks: 0,
    },
    bullies,
    zanshin: null,
    worldEnd: Math.max(...options.bullies.map((b) => b.x)) + END_MARGIN,
    rng,
    events: [],
    ...(options.drill ? { drill: true } : {}),
  };
}

const tired = (p: BrawlPlayer) => p.ki < KI_LOW;

function startRecovery(p: BrawlPlayer): void {
  p.stance = "recovery";
  p.attack = null;
  p.stanceTicks = tired(p) ? Math.round(RECOVERY_TICKS * LOW_KI_SLOWDOWN) : RECOVERY_TICKS;
}

function targetInFront(s: BrawlState): Bully | null {
  const p = s.player;
  let best: Bully | null = null;
  for (const b of s.bullies) {
    if (b.state === "down") continue;
    const gap = (b.x - p.x) * p.facing;
    if (gap <= 0) continue;
    if (!best || gap < (best.x - p.x) * p.facing) best = b;
  }
  return best;
}

function landStrike(s: BrawlState): void {
  const p = s.player;
  const target = ATTACKS[p.attack!].strikes;
  s.events.push({ type: "kiai", target });
  const b = targetInFront(s);
  const gap = b ? (b.x - p.x) * p.facing : Infinity;
  if (!b || gap > RANGE_MAX) {
    s.events.push({ type: "whiff" });
    startRecovery(p);
    return;
  }
  if (gap < RANGE_MIN) {
    s.events.push({ type: "lock" });
    p.stance = "guard";
    p.attack = null;
    b.x = p.x + p.facing * LOCK_DISTANCE;
    return;
  }
  const exposed = b.opening !== undefined ? b.opening === target : b.state !== "tell" || OPEN_DURING_TELL[b.kind] === target;
  if (!exposed) {
    s.events.push({ type: "blocked" });
    startRecovery(p);
    return;
  }
  if (p.stompAge > DRILL_STOMP_WINDOW) {
    s.events.push({ type: "flat" });
    startRecovery(p);
    return;
  }
  b.state = "stagger";
  const end = p.facing > 0 ? s.worldEnd : 0;
  s.zanshin = {
    bully: b.id,
    target,
    traveled: 0,
    needed: Math.min(gap + ZANSHIN_PASS, Math.abs(end - p.x)),
    left: ZANSHIN_WINDOW,
  };
  p.stance = "guard";
  p.attack = null;
  p.launchTicks = 0;
  s.events.push({ type: "hit", target, bully: b.id });
}

function stepZanshin(s: BrawlState, input: FighterInput): void {
  const z = s.zanshin!;
  const p = s.player;
  const b = s.bullies[z.bully];
  z.left--;
  if (input.move === p.facing) {
    z.traveled += ZANSHIN_SLIDE;
    p.x = Math.max(0, Math.min(s.worldEnd, p.x + p.facing * ZANSHIN_SLIDE));
  }
  if (z.traveled >= z.needed) {
    b.state = "down";
    s.events.push({ type: "clean", target: z.target, bully: b.id });
    s.zanshin = null;
  } else if (z.left <= 0) {
    b.state = "recover";
    b.ticks = BULLY_RECOVER_TICKS;
    s.events.push({ type: "nozanshin" });
    startRecovery(p);
    s.zanshin = null;
  }
}

function stepPlayer(s: BrawlState, input: FighterInput): void {
  const p = s.player;
  p.stompAge++;
  if (input.stomp) {
    p.stompAge = 0;
    s.events.push({ type: "stomp" });
  }
  if (s.zanshin) {
    stepZanshin(s, input);
    return;
  }
  if (p.stance === "block" && !input.block) p.stance = "guard";
  if (p.stance === "seme" && (!input.seme || p.ki <= 0 || input.attack || input.block || input.dash)) p.stance = "guard";
  if (p.stance === "guard" && !input.block && input.dash && p.launchTicks === 0) {
    p.launchTicks = LAUNCH_TICKS;
    p.launchDir = input.dash;
    p.facing = input.dash;
    p.ki = Math.max(0, p.ki - LAUNCH_COST);
    s.events.push({ type: "launch" });
  }
  if (p.stance === "guard" && input.attack) {
    const base = BRAWL_WINDUP[input.attack];
    p.stanceTicks = tired(p) ? Math.round(base * LOW_KI_SLOWDOWN) : base;
    p.stance = "windup";
    p.attack = input.attack;
    p.ki = Math.max(0, p.ki - SWING_COST);
    s.events.push({ type: "swing" });
  } else if ((p.stance === "guard" || p.stance === "block") && input.block) {
    p.stance = "block";
    p.launchTicks = 0;
  } else if (p.stance === "guard" && input.seme && p.launchTicks === 0 && p.ki >= SEME_START_KI) {
    p.stance = "seme";
  } else if (p.stance === "guard" && p.launchTicks === 0 && input.move !== 0) {
    p.facing = input.move;
    p.x += input.move * WALK * (tired(p) ? LOW_KI_WALK : 1);
  }
  if (p.launchTicks > 0) {
    p.launchTicks--;
    p.x += p.launchDir * LAUNCH_SPEED * (tired(p) ? LOW_KI_WALK : 1);
  }

  if (p.stance === "guard") {
    p.ki = Math.min(p.kiMax, p.ki + KI_RECOVERY);
    if (p.x <= 0 && input.move < 0) s.phase = "fled";
  } else if (p.stance === "windup") {
    if (--p.stanceTicks <= 0) landStrike(s);
  } else if (p.stance === "recovery" || p.stance === "broken") {
    if (--p.stanceTicks <= 0) p.stance = "guard";
  }
  p.x = Math.max(0, Math.min(s.worldEnd, p.x));
  applySeme(s, !!input.stomp);
}

/** Pressure works on everyone close enough, and they all cower together. */
function applySeme(s: BrawlState, shoutWanted: boolean): void {
  const p = s.player;
  if (p.kiaiTicks > 0) p.kiaiTicks--;
  if (p.stance !== "seme") {
    s.pressure = Math.max(0, s.pressure - SEME_DECAY);
    return;
  }
  p.ki = Math.max(0, p.ki - SEME_DRAIN);
  const shouting = shoutWanted && p.kiaiTicks === 0 && p.ki >= KIAI_COST;
  if (shouting) {
    p.ki -= KIAI_COST;
    p.kiaiTicks = KIAI_COOLDOWN;
    s.events.push({ type: "shout" });
  }
  const near = s.bullies.filter((b) => b.state !== "down" && b.state !== "stagger" && Math.abs(b.x - p.x) <= SEME_RANGE);
  if (!near.length) return;
  s.pressure += 1 + (shouting ? BRAWL_KIAI_PRESS : 0);
  if (s.pressure < BRAWL_SEME_TICKS) return;
  s.pressure = 0;
  for (const b of near) {
    b.state = "cower";
    b.ticks = COWER_TICKS;
  }
  s.events.push({ type: "cower" });
}

function bullyStrikes(s: BrawlState, b: Bully): void {
  const p = s.player;
  s.events.push({ type: "swing", bully: b.id });
  b.state = "recover";
  b.ticks = BULLY_RECOVER_TICKS;
  const roll = nextRandom(s.rng);
  s.rng = roll.seed;
  b.cooldown = COOLDOWN_MIN + Math.floor(roll.value * COOLDOWN_SPREAD);

  const gap = Math.abs(b.x - p.x);
  if (gap > REACH[b.kind] + GAP_BEHIND_REACH) return;
  const fromFront = Math.sign(b.x - p.x) === p.facing;
  if (p.stance === "block" && fromFront) {
    s.events.push({ type: "blocked", bully: b.id });
    p.ki -= ABSORB_COST;
    if (p.ki <= 0) {
      p.ki = KI_AFTER_BREAK;
      p.stance = "broken";
      p.stanceTicks = BROKEN_TICKS;
      s.events.push({ type: "broken" });
    }
    return;
  }
  if (s.invulnerable > 0) return;
  s.hp = Math.max(0, s.hp - HIT_DAMAGE[b.kind]);
  s.pressure = Math.floor(s.pressure / 2);
  s.invulnerable = INVULNERABLE_TICKS;
  s.events.push({ type: "hurt", bully: b.id });
  if (!s.zanshin) p.x = Math.max(0, Math.min(s.worldEnd, p.x - Math.sign(b.x - p.x) * KNOCKBACK));
  if (s.hp <= 0) s.phase = "lost";
}

function stepBullies(s: BrawlState): void {
  const p = s.player;
  let attacking = s.bullies.filter((b) => b.state === "tell").length;
  for (const b of s.bullies) {
    if (s.phase !== "fight") return;
    if (b.state === "down" || b.state === "stagger") continue;
    const gap = Math.abs(b.x - p.x);
    if (b.state === "wait") {
      if (gap <= NOTICE_RANGE) b.state = "walk";
      continue;
    }
    if (b.cooldown > 0) b.cooldown--;
    if (b.state === "recover" || b.state === "cower") {
      if (--b.ticks <= 0) b.state = "walk";
    } else if (b.state === "tell") {
      if (--b.ticks <= 0) {
        attacking--;
        bullyStrikes(s, b);
      }
    } else if (gap > REACH[b.kind] - GAP_BEHIND_REACH) {
      b.x += Math.sign(p.x - b.x) * WALK_SPEED[b.kind];
    } else if (b.cooldown === 0 && attacking < MAX_ATTACKING) {
      b.state = "tell";
      b.ticks = TELL_TICKS[b.kind];
      attacking++;
    }
  }
}

export function stepBrawl(state: BrawlState, input: FighterInput): BrawlState {
  const s = structuredClone(state);
  s.events = [];
  if (s.phase !== "fight") return s;
  if (s.invulnerable > 0) s.invulnerable--;
  stepPlayer(s, input);
  if (s.phase !== "fight") return s;
  if (!s.drill) stepBullies(s);
  if (s.phase === "fight" && s.bullies.every((b) => b.state === "down")) s.phase = "won";
  return s;
}
