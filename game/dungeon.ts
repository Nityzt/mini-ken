/**
 * The dungeon under Thunder Radish Dojo: an original side-view trial of ledges, traps and ninja guards.
 * Everything here is plain data and pure steps, so a test can play the whole route with real inputs.
 * Positions and speeds are in the stage's own pixels and ticks.
 */
export const PLAYER_W = 10;
export const PLAYER_H = 20;
/** Health before any armor. Each piece you scavenge adds to it. */
export const BASE_HP = 4;
export const MAX_HP = 7;
export const RUN_SPEED = 1.7;
/** Low enough that a full storey (40px) can't be jumped, only climbed: the trial's whole rhythm comes from that. */
export const JUMP_SPEED = -4.3;
const GRAVITY = 0.3;
const MAX_FALL = 6;
/** Grace for a jump pressed just after running off an edge, or just before landing. */
const COYOTE = 5;
const JUMP_BUFFER = 6;
/** How long a climb takes, and how long a hang lasts before holding up starts it. */
export const CLIMB_TICKS = 16;
const HANG_SETTLE = 5;
/** Where hands can catch a ledge, relative to its top, and how far off its end they can be. */
const GRAB_ABOVE = 10;
const GRAB_BELOW = 8;
const GRAB_REACH = 6;
/** A loose slab holds this long once stood on, shaking all the while. */
export const CRUMBLE_TICKS = 28;
const INVULNERABLE = 50;
const KNOCKBACK = 6;
/** A swing's contact frame, counting down from its start, and its reach in front of you. */
const SWING_TICKS = 12;
const SWING_CONTACT = 7;
const SWING_COOLDOWN = 20;
const REACH = 30;
/** The stage has no floor below this. */
const PIT_DEPTH = 150;

export type DungeonRect = { x: number; y: number; w: number; h: number };
/** Loose slabs fall a little after they're stood on, and come back with the room. */
export type DungeonPlatform = DungeonRect & { id?: string; loose?: boolean };
/**
 * Every trap shows what it's about to do before it does it: spikes rattle, a press shakes and sheds dust,
 * a dart slot glows. A cycle is `warn` ticks of that, `active` ticks of danger, then rest until `period`.
 */
export type DungeonTrap = DungeonRect & { id: string; kind: "spikes" | "press" | "darts"; period: number; warn: number; active: number; offset: number; dir?: -1 | 1; range?: number };
export type PickupKind = "shinai" | "scrap" | "kote" | "rice" | "crane" | "chest";
export type DungeonPickup = { id: string; kind: PickupKind; x: number; y: number };
export type EnemyKind = "ninja" | "thrower";
/** A guard keeps to its own floor, between `minX` and `maxX`. */
export type DungeonEnemySpec = { id: string; kind: EnemyKind; x: number; y: number; minX: number; maxX: number };
export type DungeonRoom = {
  name: string;
  width: number;
  /** What the first visit's notice teaches. */
  hint: string;
  start: { x: number; y: number };
  platforms: DungeonPlatform[];
  traps: DungeonTrap[];
  pickups: DungeonPickup[];
  enemies: DungeonEnemySpec[];
  bench?: { x: number; y: number };
  /** Where Ren waits to fight you properly, in a real duel, before the way out (owner, 2026-11-11). */
  ren?: { x: number; y: number };
  exit: { x: number; y: number };
};

const ground = (x: number, w: number): DungeonPlatform => ({ x, y: 120, w, h: 24 });
/** Pickups and benches sit where your feet would be standing, so their y is a standing player's y. */
const on = (top: number): number => top - PLAYER_H;

export const DUNGEON_ROOMS: DungeonRoom[] = [
  {
    name: "The Cell",
    width: 336,
    hint: "Hold W at a ledge to grab it and climb.",
    start: { x: 20, y: on(120) },
    platforms: [ground(0, 200), ground(236, 100), { x: 112, y: 80, w: 40, h: 40 }, { x: 72, y: 44, w: 34, h: 6 }],
    traps: [],
    pickups: [
      { id: "cell-shinai", kind: "shinai", x: 130, y: on(80) },
      { id: "cell-crane", kind: "crane", x: 80, y: on(44) },
    ],
    enemies: [{ id: "cell-guard", kind: "ninja", x: 290, y: on(120), minX: 262, maxX: 320 }],
    exit: { x: 316, y: on(120) },
  },
  {
    name: "The Spike Hall",
    width: 512,
    hint: "Watch the floor. Every trap shows itself first.",
    start: { x: 12, y: on(120) },
    platforms: [
      ground(0, 180),
      { id: "hall-slab", x: 180, y: 120, w: 36, h: 24, loose: true },
      ground(216, 296),
      { x: 360, y: 80, w: 92, h: 40 },
      { x: 400, y: 44, w: 22, h: 6 },
    ],
    traps: [
      { id: "hall-spikes", kind: "spikes", x: 70, y: 112, w: 36, h: 8, period: 120, warn: 36, active: 36, offset: 0 },
      { id: "hall-darts", kind: "darts", x: 358, y: 104, w: 4, h: 4, period: 150, warn: 30, active: 1, offset: 20, dir: -1, range: 144 },
    ],
    pickups: [
      { id: "hall-scrap", kind: "scrap", x: 436, y: on(80) },
      { id: "hall-crane", kind: "crane", x: 404, y: on(44) },
    ],
    enemies: [{ id: "hall-guard", kind: "ninja", x: 410, y: on(80), minX: 362, maxX: 440 }],
    exit: { x: 490, y: on(120) },
  },
  {
    name: "The Copper Works",
    width: 576,
    hint: "Scrap and a workbench make armor. Look high as well as low.",
    start: { x: 12, y: on(120) },
    platforms: [ground(0, 576), { x: 230, y: 72, w: 140, h: 6 }],
    traps: [
      { id: "works-press-a", kind: "press", x: 104, y: 16, w: 20, h: 104, period: 100, warn: 30, active: 16, offset: 0 },
      { id: "works-press-b", kind: "press", x: 156, y: 16, w: 20, h: 104, period: 100, warn: 30, active: 16, offset: 50 },
    ],
    pickups: [
      { id: "works-scrap-a", kind: "scrap", x: 136, y: on(120) },
      { id: "works-scrap-b", kind: "scrap", x: 262, y: on(120) },
      { id: "works-kote", kind: "kote", x: 352, y: on(72) },
      { id: "works-rice", kind: "rice", x: 444, y: on(120) },
    ],
    enemies: [
      { id: "works-guard", kind: "ninja", x: 320, y: on(120), minX: 210, maxX: 420 },
      { id: "works-thrower", kind: "thrower", x: 320, y: on(72), minX: 240, maxX: 340 },
    ],
    bench: { x: 492, y: on(120) },
    exit: { x: 552, y: on(120) },
  },
  {
    name: "The Spy Chamber",
    width: 288,
    hint: "",
    start: { x: 16, y: on(120) },
    platforms: [ground(0, 288), { x: 30, y: 80, w: 40, h: 6 }, { x: 218, y: 80, w: 40, h: 6 }],
    traps: [],
    pickups: [{ id: "spy-chest", kind: "chest", x: 244, y: on(120) }],
    enemies: [],
    ren: { x: 190, y: on(120) },
    exit: { x: 270, y: on(120) },
  },
];
export const FINAL_ROOM = DUNGEON_ROOMS.length - 1;
/** Three scraps lashed together make a do and tare. */
export const SCRAP_FOR_ARMOR = 3;

export type DungeonInput = {
  move: -1 | 0 | 1;
  /** Up was just pressed: a jump. */
  jump?: boolean;
  /** Up is held: catch ledges and climb them. */
  up?: boolean;
  attack?: boolean;
  interact?: boolean;
  block?: boolean;
  retry?: boolean;
};
export type EnemyState = "patrol" | "alert" | "chase" | "tell" | "strike" | "recover" | "block" | "aim" | "down";
export type DungeonEnemy = DungeonEnemySpec & { hp: number; state: EnemyState; ticks: number; facing: -1 | 1; noticed: boolean; flash: number };
export type DungeonPlayer = {
  x: number; y: number; vx: number; vy: number; facing: -1 | 1; hp: number; grounded: boolean;
  attackTicks: number; cooldown: number; invulnerable: number;
  /** Frames since last on the ground, and since up was last pressed, for forgiving jumps. */
  air: number; buffer: number;
  /** Hanging from, or climbing onto, the ledge whose top-left corner this is. */
  ledge: { x: number; y: number; side: -1 | 1 } | null;
  climb: number; hang: number; knock: number;
};
export type Projectile = { x: number; y: number; vx: number; vy: number; kind: "dart" | "star"; /** Ticks left before it falls spent. */ ttl: number };
export type DungeonEvent = {
  type: "jump" | "land" | "grab" | "climb" | "swing" | "hit" | "blocked" | "hurt" | "parry" | "deflect" | "pickup" | "secret" | "craft" | "locked" | "room" | "death" | "retry" | "escape" | "crumble" | "throw" | "duel" | "gear";
  id?: string; text?: string;
};
export type DungeonPiece = "do" | "kote";
/** Only progress between rooms and discoveries persist. A retry restores the room's guards and slabs. */
export type DungeonProgress = {
  room: number; collected: string[]; shinai: boolean; pieces: DungeonPiece[]; materials: number; recovered: boolean;
  /** Ren has been beaten in the duel at the end of this trial. */
  renBeaten: boolean;
};
export type DungeonState = DungeonProgress & {
  tick: number;
  phase: "playing" | "dead" | "escaped";
  player: DungeonPlayer;
  enemies: DungeonEnemy[];
  projectiles: Projectile[];
  /** Ticks each stood-on slab has shaken; a slab past CRUMBLE_TICKS has fallen. */
  crumble: Record<string, number>;
  checkpoint: number;
  events: DungeonEvent[];
  /** What last hurt you, for the retry screen. */
  cause: string;
};

const enemyHp = (kind: EnemyKind): number => (kind === "thrower" ? 1 : 2);
export const maxHp = (pieces: readonly DungeonPiece[]): number => BASE_HP + (pieces.includes("do") ? 2 : 0) + (pieces.includes("kote") ? 1 : 0);

export function createDungeon(room = 0, progress?: Partial<DungeonProgress>): DungeonState {
  const at = Math.max(0, Math.min(FINAL_ROOM, Math.floor(room)));
  const spec = DUNGEON_ROOMS[at];
  const pieces = [...(progress?.pieces ?? [])];
  return {
    room: at,
    collected: [...(progress?.collected ?? [])],
    shinai: progress?.shinai ?? false,
    pieces,
    materials: progress?.materials ?? 0,
    recovered: progress?.recovered ?? false,
    renBeaten: progress?.renBeaten ?? false,
    tick: 0,
    phase: "playing",
    checkpoint: at,
    player: { x: spec.start.x, y: spec.start.y, vx: 0, vy: 0, facing: 1, hp: maxHp(pieces), grounded: true, attackTicks: 0, cooldown: 0, invulnerable: 0, air: 0, buffer: 0, ledge: null, climb: 0, hang: 0, knock: 0 },
    enemies: spec.enemies.map((enemy) => ({ ...enemy, hp: enemyHp(enemy.kind), state: "patrol", ticks: 0, facing: -1, noticed: false, flash: 0 })),
    projectiles: [],
    crumble: {},
    events: [],
    cause: "",
  };
}

export const dungeonProgress = (state: DungeonState): DungeonProgress => ({ room: state.room, collected: [...state.collected], shinai: state.shinai, pieces: [...state.pieces], materials: state.materials, recovered: state.recovered, renBeaten: state.renBeaten });

export type TrapPhase = "rest" | "warn" | "active";
export function trapPhase(trap: DungeonTrap, tick: number): TrapPhase {
  const at = (((tick - trap.offset) % trap.period) + trap.period) % trap.period;
  return at < trap.warn ? "warn" : at < trap.warn + trap.active ? "active" : "rest";
}
export const trapActive = (trap: DungeonTrap, tick: number): boolean => trapPhase(trap, tick) === "active";
/** The press comes down over its first few active ticks rather than appearing at the floor. */
export function pressReach(trap: DungeonTrap, tick: number): number {
  const at = (((tick - trap.offset) % trap.period) + trap.period) % trap.period;
  if (at < trap.warn) return 14;
  if (at < trap.warn + trap.active) return Math.min(trap.h, 14 + ((at - trap.warn + 1) * trap.h) / 4);
  return Math.max(14, trap.h - ((at - trap.warn - trap.active) * trap.h) / 12);
}

export const overlap = (a: DungeonRect, b: DungeonRect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const box = (p: { x: number; y: number }): DungeonRect => ({ x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H });
const near = (p: DungeonPlayer, point: { x: number; y: number }, distance = 14): boolean => Math.abs(p.x - point.x) <= distance && Math.abs(p.y - point.y) <= 10;
/** The slabs and floors still standing. */
export const solidPlatforms = (state: DungeonState): DungeonPlatform[] => DUNGEON_ROOMS[state.room].platforms.filter((platform) => !platform.id || (state.crumble[platform.id] ?? 0) < CRUMBLE_TICKS);

function hurt(state: DungeonState, amount: number, cause: string, from?: number): void {
  const p = state.player;
  if (p.invulnerable || state.phase !== "playing") return;
  p.hp = Math.max(0, p.hp - amount);
  p.invulnerable = INVULNERABLE;
  state.cause = cause;
  state.events.push({ type: "hurt", text: cause });
  // A blow knocks you back from where it came, and off any ledge you were hanging from.
  if (from !== undefined && !p.ledge) {
    p.knock = KNOCKBACK;
    p.vx = (p.x + PLAYER_W / 2 < from ? -1 : 1) * 1.6;
  }
  if (!p.hp) die(state, cause);
}
function die(state: DungeonState, cause: string): void {
  state.player.hp = 0;
  state.phase = "dead";
  state.cause = cause;
  state.events.push({ type: "death", text: cause });
}

/** The ledge your hands can catch right now, if any: an end of a platform, with you just off that end, facing it. */
function ledgeInReach(state: DungeonState, platforms: DungeonPlatform[]): DungeonPlayer["ledge"] {
  const p = state.player;
  for (const platform of platforms) {
    if (p.y < platform.y - GRAB_ABOVE || p.y > platform.y + GRAB_BELOW) continue;
    const blocked = (x: number) => platforms.some((other) => other !== platform && overlap({ x, y: platform.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H }, other));
    if (p.facing === 1 && Math.abs(p.x + PLAYER_W - platform.x) <= GRAB_REACH && !blocked(platform.x + 1)) return { x: platform.x, y: platform.y, side: 1 };
    if (p.facing === -1 && Math.abs(p.x - (platform.x + platform.w)) <= GRAB_REACH && !blocked(platform.x + platform.w - PLAYER_W - 1)) return { x: platform.x + platform.w, y: platform.y, side: -1 };
  }
  return null;
}

function movePlayer(state: DungeonState, input: DungeonInput): void {
  const room = DUNGEON_ROOMS[state.room];
  const platforms = solidPlatforms(state);
  const p = state.player;
  p.buffer = input.jump ? JUMP_BUFFER : Math.max(0, p.buffer - 1);
  if (p.ledge) {
    p.vx = 0;
    p.vy = 0;
    if (p.climb) {
      // Pulling up: you finish on top, a step in from the edge.
      if (--p.climb === 0) {
        p.x = p.ledge.side === 1 ? p.ledge.x + 1 : p.ledge.x - PLAYER_W - 1;
        p.y = p.ledge.y - PLAYER_H;
        p.ledge = null;
        p.grounded = true;
        p.air = 0;
      }
      return;
    }
    p.hang++;
    if (input.block || (input.move && input.move !== p.ledge.side)) {
      // Letting go drops you straight down.
      p.ledge = null;
      p.hang = 0;
      p.buffer = 0;
    } else {
      if (input.up && p.hang >= HANG_SETTLE) {
        p.climb = CLIMB_TICKS;
        state.events.push({ type: "climb" });
      }
      return;
    }
  }
  if (p.knock > 0) p.knock--;
  const target = p.knock ? p.vx : input.move * (input.block && p.grounded ? 0.6 : RUN_SPEED);
  if (!p.knock) p.vx += (target - p.vx) * (p.grounded ? 0.45 : 0.2);
  if (Math.abs(p.vx) < 0.05) p.vx = 0;
  if (input.move && !p.knock && !p.attackTicks) p.facing = input.move;
  if (p.buffer && (p.grounded || p.air < COYOTE) && !input.block) {
    p.vy = JUMP_SPEED;
    p.grounded = false;
    p.air = COYOTE;
    p.buffer = 0;
    state.events.push({ type: "jump" });
  }
  const oldX = p.x;
  p.x = Math.max(0, Math.min(room.width - PLAYER_W, p.x + p.vx));
  for (const platform of platforms) {
    if (!overlap(box(p), platform)) continue;
    if (oldX + PLAYER_W <= platform.x + 0.001) p.x = platform.x - PLAYER_W;
    else if (oldX >= platform.x + platform.w - 0.001) p.x = platform.x + platform.w;
  }
  // Guards stand their ground: you can vault one, but not walk through it.
  for (const enemy of state.enemies) {
    if (enemy.state === "down" || !overlap(box(p), { x: enemy.x + 1, y: enemy.y, w: PLAYER_W - 2, h: PLAYER_H })) continue;
    if (oldX + PLAYER_W <= enemy.x + 1.001) p.x = enemy.x + 1 - PLAYER_W;
    else if (oldX >= enemy.x + PLAYER_W - 1.001) p.x = enemy.x + PLAYER_W - 1;
  }
  const oldY = p.y;
  const wasGrounded = p.grounded;
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
  p.y += p.vy;
  p.grounded = false;
  for (const platform of platforms) {
    if (p.x + PLAYER_W <= platform.x || p.x >= platform.x + platform.w) continue;
    if (p.vy >= 0 && oldY + PLAYER_H <= platform.y + 0.001 && p.y + PLAYER_H >= platform.y) {
      p.y = platform.y - PLAYER_H;
      p.vy = 0;
      p.grounded = true;
    } else if (p.vy < 0 && oldY >= platform.y + platform.h - 0.001 && p.y < platform.y + platform.h) {
      p.y = platform.y + platform.h;
      p.vy = 0;
    }
  }
  if (p.grounded) {
    if (!wasGrounded) state.events.push({ type: "land" });
    p.air = 0;
    for (const platform of platforms) {
      if (platform.loose && platform.id && p.y + PLAYER_H === platform.y && p.x + PLAYER_W > platform.x && p.x < platform.x + platform.w && !state.crumble[platform.id]) {
        state.crumble[platform.id] = 1;
        state.events.push({ type: "crumble", id: platform.id });
      }
    }
  } else {
    p.air++;
    // Holding up in the air catches whatever ledge your hands pass, rising slowly or falling.
    if (input.up && p.vy > -3.5 && !p.knock) {
      const ledge = ledgeInReach(state, platforms);
      if (ledge) {
        p.ledge = ledge;
        p.hang = 0;
        p.x = ledge.side === 1 ? ledge.x - PLAYER_W : ledge.x;
        p.y = ledge.y + 1;
        p.vx = 0;
        p.vy = 0;
        state.events.push({ type: "grab" });
      }
    }
  }
  if (p.y > PIT_DEPTH) die(state, "You fell into the dark.");
}

function stepTraps(state: DungeonState): void {
  const room = DUNGEON_ROOMS[state.room];
  for (const id of Object.keys(state.crumble)) if (state.crumble[id] < CRUMBLE_TICKS + 30) state.crumble[id]++;
  const you = box(state.player);
  for (const trap of room.traps) {
    const phase = trapPhase(trap, state.tick);
    if (trap.kind === "spikes" && phase === "active" && overlap(you, trap)) hurt(state, 1, "The spikes caught you.");
    if (trap.kind === "press" && phase === "active" && overlap(you, { x: trap.x, y: trap.y, w: trap.w, h: pressReach(trap, state.tick) })) hurt(state, 2, "The press came down on you.");
    if (trap.kind === "darts" && phase === "active" && trapPhase(trap, state.tick - 1) === "warn") state.projectiles.push({ x: trap.x, y: trap.y, vx: 2.6 * (trap.dir ?? -1), vy: 0, kind: "dart", ttl: Math.round((trap.range ?? 200) / 2.6) });
  }
}

const guarding = (state: DungeonState, input: DungeonInput, fromX: number): boolean => !!input.block && state.player.grounded && !state.player.ledge && state.player.facing === (fromX > state.player.x + PLAYER_W / 2 ? 1 : -1);

function stepProjectiles(state: DungeonState, input: DungeonInput): void {
  const room = DUNGEON_ROOMS[state.room];
  const platforms = solidPlatforms(state);
  state.projectiles = state.projectiles.filter((shot) => {
    shot.x += shot.vx;
    shot.y += shot.vy;
    if (--shot.ttl <= 0) return false;
    if (shot.x < -8 || shot.x > room.width + 8 || shot.y > PIT_DEPTH) return false;
    const rect = { x: shot.x - 2, y: shot.y - 1, w: 4, h: 3 };
    // Catwalks and shelves are gratings: only solid stone stops a shot.
    if (platforms.some((platform) => platform.h > 8 && overlap(rect, platform))) return false;
    if (!overlap(rect, box(state.player))) return true;
    if (guarding(state, input, shot.x)) state.events.push({ type: "deflect" });
    // A shot stings without knocking you back, so it never throws you off a slab or a ledge you chose to stand on.
    else hurt(state, 1, shot.kind === "dart" ? "A dart from the wall found you." : "A throwing star found you.");
    return false;
  });
}

/** A guard can only see you on its own floor, or below it when it has something to throw. */
function sees(enemy: DungeonEnemy, p: DungeonPlayer): boolean {
  const dy = p.y - enemy.y;
  const dx = Math.abs(p.x - enemy.x);
  if (enemy.kind === "thrower") return dx < 120 && dy > -8 && dy < 70;
  return dx < 110 && Math.abs(dy) < 16;
}

function stepEnemy(state: DungeonState, enemy: DungeonEnemy, input: DungeonInput): void {
  const p = state.player;
  if (enemy.flash) enemy.flash--;
  if (enemy.state === "down") return;
  const delta = p.x - enemy.x;
  const distance = Math.abs(delta);
  const level = Math.abs(p.y - enemy.y) < 16;
  const walk = (dir: number, speed: number) => {
    enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX, enemy.x + dir * speed));
  };
  const face = () => {
    enemy.facing = delta < 0 ? -1 : 1;
  };
  enemy.ticks = Math.max(0, enemy.ticks - 1);
  switch (enemy.state) {
    case "patrol": {
      if (sees(enemy, p) && state.phase === "playing") {
        face();
        enemy.state = enemy.noticed ? "chase" : "alert";
        enemy.ticks = 20;
        enemy.noticed = true;
        break;
      }
      // An unhurried beat between its posts.
      if (enemy.x <= enemy.minX + 1) enemy.facing = 1;
      if (enemy.x >= enemy.maxX - 1) enemy.facing = -1;
      walk(enemy.facing, 0.35);
      break;
    }
    case "alert":
      face();
      if (!enemy.ticks) enemy.state = "chase";
      break;
    case "chase": {
      face();
      if (!sees(enemy, p)) {
        enemy.state = "patrol";
        break;
      }
      if (enemy.kind === "thrower") {
        if (distance < 40) walk(-enemy.facing, 0.6);
        else if (!enemy.ticks) {
          enemy.state = "aim";
          enemy.ticks = 34;
        }
        break;
      }
      if (distance > 24) walk(enemy.facing, 0.8);
      else if (level && !enemy.ticks) {
        enemy.state = "tell";
        enemy.ticks = 28;
      }
      break;
    }
    case "tell":
      face();
      if (!enemy.ticks) {
        enemy.state = "strike";
        enemy.ticks = 6;
        if (level && distance < REACH + 4) {
          if (guarding(state, input, enemy.x + PLAYER_W / 2)) {
            state.events.push({ type: "parry", id: enemy.id });
            enemy.state = "recover";
            enemy.ticks = 44;
          } else hurt(state, 1, "A ninja's strike landed.", enemy.x + PLAYER_W / 2);
        }
      }
      break;
    case "strike":
      if (!enemy.ticks) {
        enemy.state = "recover";
        enemy.ticks = 26;
      }
      break;
    case "aim":
      face();
      if (!enemy.ticks) {
        const fromX = enemy.x + PLAYER_W / 2;
        const fromY = enemy.y + 7;
        const toX = p.x + PLAYER_W / 2;
        const toY = p.y + 8;
        const length = Math.hypot(toX - fromX, toY - fromY) || 1;
        state.projectiles.push({ x: fromX, y: fromY, vx: ((toX - fromX) / length) * 2.3, vy: ((toY - fromY) / length) * 2.3, kind: "star", ttl: 120 });
        state.events.push({ type: "throw", id: enemy.id });
        enemy.state = "recover";
        enemy.ticks = 60;
      }
      break;
    case "block":
      if (!enemy.ticks) {
        // A blocked swing is answered quickly: mashing at a guard gets you hit.
        enemy.state = "tell";
        enemy.ticks = 16;
      }
      break;
    case "recover":
      if (!enemy.ticks) {
        enemy.state = "chase";
        enemy.ticks = 16;
      }
      break;
  }
}

function playerStrikes(state: DungeonState): void {
  const p = state.player;
  if (p.attackTicks !== SWING_CONTACT) return;
  const centre = p.x + PLAYER_W / 2;
  for (const enemy of state.enemies) {
    if (enemy.state === "down") continue;
    const ahead = (enemy.x + PLAYER_W / 2 - centre) * p.facing;
    if (ahead < 0 || ahead > REACH || Math.abs(enemy.y - p.y) >= 16) continue;
    const behind = enemy.facing === p.facing;
    // Only a guard that's recovering, aiming or caught from behind is open. Throwers never learned to block.
    const open = enemy.kind === "thrower" || enemy.state === "recover" || enemy.state === "aim" || behind || (enemy.state === "patrol" && !enemy.noticed);
    if (!open) {
      enemy.state = "block";
      enemy.ticks = 8;
      enemy.facing = p.facing === 1 ? -1 : 1;
      state.events.push({ type: "blocked", id: enemy.id });
      continue;
    }
    enemy.hp--;
    enemy.flash = 10;
    enemy.noticed = true;
    state.events.push({ type: "hit", id: enemy.id });
    enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX, enemy.x + p.facing * 6));
    if (!enemy.hp) {
      enemy.state = "down";
      enemy.ticks = 0;
    } else {
      // Staggered, but back on guard before you can swing again: every hit has to be earned with a parry.
      enemy.state = "recover";
      enemy.ticks = 10;
      enemy.facing = p.facing === 1 ? -1 : 1;
    }
  }
}

function interact(state: DungeonState): DungeonState | null {
  const room = DUNGEON_ROOMS[state.room];
  const p = state.player;
  for (const pickup of room.pickups) {
    if (state.collected.includes(pickup.id) || !near(p, pickup)) continue;
    if (pickup.kind === "chest" && room.ren && !state.renBeaten) continue;
    state.collected.push(pickup.id);
    if (pickup.kind === "shinai") state.shinai = true;
    if (pickup.kind === "scrap") state.materials++;
    if (pickup.kind === "kote") {
      state.pieces = [...state.pieces, "kote"];
      p.hp = Math.min(maxHp(state.pieces), p.hp + 2);
    }
    if (pickup.kind === "rice") p.hp = Math.min(maxHp(state.pieces), p.hp + 2);
    if (pickup.kind === "chest") {
      state.recovered = true;
      state.events.push({ type: "gear", id: pickup.id });
      return state;
    }
    state.events.push({ type: pickup.kind === "crane" ? "secret" : "pickup", id: pickup.id });
    return state;
  }
  if (room.bench && near(p, room.bench, 18) && !state.pieces.includes("do")) {
    if (state.materials >= SCRAP_FOR_ARMOR) {
      state.materials -= SCRAP_FOR_ARMOR;
      state.pieces = [...state.pieces, "do"];
      p.hp = maxHp(state.pieces);
      state.events.push({ type: "craft" });
    } else state.events.push({ type: "locked", text: `The bench needs ${SCRAP_FOR_ARMOR} scraps for armor. You have ${state.materials}.` });
    return state;
  }
  if (near(p, room.exit, 14)) {
    const guards = state.enemies.some((enemy) => enemy.hp > 0);
    const why = room.ren && !state.renBeaten ? "Ren stands between you and the door."
      : guards ? "A guard still watches this door."
      : !state.shinai ? "Unarmed, you won't get past the next guard. Find something."
      : state.room === 2 && !state.pieces.includes("do") ? "Make armor at the workbench before going deeper."
      : state.room === FINAL_ROOM && !state.recovered ? "Your equipment is in the chest. Take it."
      : "";
    if (why) state.events.push({ type: "locked", text: why });
    else if (state.room === FINAL_ROOM) {
      state.phase = "escaped";
      state.events.push({ type: "escape" });
    } else return { ...createDungeon(state.room + 1, state), events: [...state.events, { type: "room" }] };
    return state;
  }
  return null;
}

/** How close you can get to Ren before Ren calls the duel. */
export const REN_DUEL_RANGE = 26;
/**
 * Ren won't be walked past. Coming up to Ren on the floor starts the duel, which the scene plays with the real
 * duel engine; a loss leaves you here, at the start of the room, to walk up again.
 */
function waitForRen(state: DungeonState): void {
  const ren = DUNGEON_ROOMS[state.room].ren;
  if (!ren || state.renBeaten) return;
  const p = state.player;
  const stop = ren.x - REN_DUEL_RANGE;
  if (p.x > stop) {
    p.x = stop;
    p.vx = Math.min(0, p.vx);
  }
  if (p.grounded && p.x >= stop - 2 && Math.abs(p.y - ren.y) < 4) state.events.push({ type: "duel" });
}

export function stepDungeon(previous: DungeonState, input: DungeonInput): DungeonState {
  if (previous.phase === "escaped") return previous;
  if (previous.phase === "dead") {
    if (!input.retry) return previous.events.length ? { ...previous, events: [] } : previous;
    return { ...createDungeon(previous.checkpoint, previous), events: [{ type: "retry" }] };
  }
  const state: DungeonState = {
    ...previous,
    tick: previous.tick + 1,
    collected: [...previous.collected],
    pieces: [...previous.pieces],
    player: { ...previous.player, ledge: previous.player.ledge && { ...previous.player.ledge } },
    enemies: previous.enemies.map((enemy) => ({ ...enemy })),
    projectiles: previous.projectiles.map((shot) => ({ ...shot })),
    crumble: { ...previous.crumble },
    events: [],
  };
  const p = state.player;
  p.attackTicks = Math.max(0, p.attackTicks - 1);
  p.cooldown = Math.max(0, p.cooldown - 1);
  p.invulnerable = Math.max(0, p.invulnerable - 1);
  if (input.interact && !p.ledge && p.grounded) {
    const done = interact(state);
    if (done) return done;
  }
  if (input.attack && state.shinai && !p.cooldown && !p.ledge && !input.block) {
    p.attackTicks = SWING_TICKS;
    p.cooldown = SWING_COOLDOWN;
    state.events.push({ type: "swing" });
  }
  movePlayer(state, input);
  if (state.phase !== "playing") return state;
  waitForRen(state);
  stepTraps(state);
  stepProjectiles(state, input);
  for (const enemy of state.enemies) stepEnemy(state, enemy, input);
  playerStrikes(state);
  return state;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const numberIn = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const countIn = (value: unknown, max: number): value is number => numberIn(value, 0, max) && Number.isInteger(value);

/**
 * Only what persists between rooms is trusted from a save: the room, gear and discoveries. You come back at
 * the start of the room you were in, which is where a retry would put you anyway. Older or damaged saves give
 * null, and the scene starts the trial again rather than losing the whole story.
 */
export function parseDungeonState(raw: unknown): DungeonState | null {
  if (!record(raw) || !countIn(raw.room, FINAL_ROOM)) return null;
  if (typeof raw.shinai !== "boolean" || !countIn(raw.materials, SCRAP_FOR_ARMOR) || typeof raw.recovered !== "boolean") return null;
  // Saves from before the duel replaced the fight in the Spy Chamber have no record of it, so Ren is still there.
  if (raw.renBeaten !== undefined && typeof raw.renBeaten !== "boolean") return null;
  const pickupIds = DUNGEON_ROOMS.flatMap((room) => room.pickups.map((pickup) => pickup.id));
  if (!Array.isArray(raw.collected) || !raw.collected.every((id) => typeof id === "string" && pickupIds.includes(id)) || new Set(raw.collected).size !== raw.collected.length) return null;
  if (!Array.isArray(raw.pieces) || !raw.pieces.every((piece) => piece === "do" || piece === "kote") || new Set(raw.pieces).size !== raw.pieces.length) return null;
  if (raw.phase !== "playing" && raw.phase !== "dead" && raw.phase !== "escaped") return null;
  const state = createDungeon(raw.room, { collected: raw.collected as string[], shinai: raw.shinai, pieces: raw.pieces as DungeonPiece[], materials: raw.materials, recovered: raw.recovered, renBeaten: raw.renBeaten === true });
  // An escape that hadn't been handed back yet still counts.
  if (raw.phase === "escaped" && raw.room === FINAL_ROOM && raw.recovered) {
    state.phase = "escaped";
    state.renBeaten = true;
    state.enemies = state.enemies.map((enemy) => ({ ...enemy, hp: 0, state: "down" }));
  }
  return state;
}
