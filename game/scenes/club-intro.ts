import { TILE } from "../art/tiles.ts";
import type { SoundName } from "../core/audio.ts";
import { moveAndCollide, type TileMap } from "../core/collision.ts";
import { createWalker, touchesTile, type Walker } from "./topdown.ts";

export type Tile = { col: number; row: number };

/** A stroll, a little slower than the player's own pace. */
const STROLL = 1.2;
/** Momo gets this many tiles ahead before the player follows. */
const HEAD_START = 2;
/** Ticks someone can be pushed against something before they're simply put where they were going. */
const STUCK = 40;
/** The door sticks for this long, then slides open over the next stretch. */
const STICK = 30;
const SLIDE = 45;

const STEPS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** The shortest walk over open floor, not counting where you start. Null if there isn't one. */
export function findPath(rows: string[], solid: string, from: Tile, to: Tile, blocked: Tile[] = []): Tile[] | null {
  const key = (t: Tile) => `${t.col},${t.row}`;
  const walls = new Set(blocked.map(key));
  const open = (col: number, row: number) => {
    const char = rows[row]?.[col];
    return char !== undefined && !solid.includes(char) && !walls.has(`${col},${row}`);
  };
  if (!open(to.col, to.row)) return null;
  const came = new Map<string, Tile | null>([[key(from), null]]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    if (here.col === to.col && here.row === to.row) {
      const path: Tile[] = [];
      for (let t: Tile | null = here; t && key(t) !== key(from); t = came.get(key(t)) ?? null) path.unshift(t);
      return path;
    }
    for (const [dc, dr] of STEPS) {
      const next = { col: here.col + dc, row: here.row + dr };
      if (!came.has(key(next)) && open(next.col, next.row)) {
        came.set(key(next), here);
        queue.push(next);
      }
    }
  }
  return null;
}

/** The tile a walker's feet are on. */
export const tileOf = (walker: Walker): Tile => ({ col: Math.floor((walker.box.x + walker.box.w / 2) / TILE), row: Math.floor((walker.box.y + walker.box.h / 2) / TILE) });

export const pointOf = (tile: Tile) => ({ x: tile.col * TILE + 3, y: tile.row * TILE + 8 });

export type Trail = { points: { x: number; y: number }[]; at: number; stuck: number };

export const trailOf = (from: Tile, path: Tile[]): Trail => ({ points: [from, ...path].map(pointOf), at: 0, stuck: 0 });

/** One step along a trail, a tile edge at a time. True once it's all walked. */
export function walk(walker: Walker, trail: Trail, map: TileMap): boolean {
  const target = trail.points[trail.at];
  if (!target) {
    walker.moving = false;
    return true;
  }
  const dx = target.x - walker.box.x;
  const dy = target.y - walker.box.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    walker.box = { ...walker.box, x: target.x, y: target.y };
    trail.at++;
    trail.stuck = 0;
    return walk(walker, trail, map);
  }
  const moveX = Math.abs(dx) >= 0.001;
  const step = (distance: number) => Math.sign(distance) * Math.min(Math.abs(distance), STROLL);
  const [mx, my] = moveX ? [step(dx), 0] : [0, step(dy)];
  if (moveX) {
    walker.facing = "side";
    walker.flip = mx < 0;
  } else {
    walker.facing = my > 0 ? "down" : "up";
  }
  const before = walker.box;
  walker.box = moveAndCollide(walker.box, mx, my, map).box;
  walker.moving = true;
  walker.walkTick++;
  if (walker.box.x === before.x && walker.box.y === before.y) {
    if (++trail.stuck > STUCK) walker.box = { ...walker.box, x: target.x, y: target.y };
  } else {
    trail.stuck = 0;
  }
  return false;
}

export type EscortPhase = "lead" | "arrived" | "knock" | "slide" | "opened" | "return" | "done";

export type EscortEvents = {
  /** Momo and the player are at the door. Say something, then call `proceed`. */
  arrived(): void;
  /** The door is open. Say something, then call `proceed`. */
  opened(): void;
  sound(name: SoundName): void;
};

export type Escort = {
  /** Momo, who's up and walking while this goes on. */
  readonly momo: Walker;
  readonly phase: EscortPhase;
  /** The player can't move until Momo's done with the door. */
  readonly blocking: boolean;
  readonly done: boolean;
  /** How far the storage door has slid open, and how much it's rattling. */
  readonly door: { slide: number; shake: number };
  update(player: Walker, map: TileMap): void;
  /** Whatever was being said is finished. */
  proceed(): void;
};

/**
 * Momo leads the player to the storage door, rattles it open, and then goes back to where she was standing.
 * `rows` must have Momo's tile as open floor, so the walk can use it, and `door` is the tile in the wall.
 */
export function createEscort(setup: { rows: string[]; solid: string; player: Walker; home: Tile; door: Tile; events: EscortEvents }): Escort {
  const { rows, solid, home, door, events } = setup;
  const free: TileMap = { rows, solid: "", tile: TILE };
  const momo: Walker = { ...createWalker(home.col, home.row), facing: "down" };
  const momoSpot: Tile = { col: door.col, row: door.row - 1 };
  const playerSpot: Tile = { col: door.col + 1, row: door.row - 1 };
  let player = setup.player;
  const playerStart = tileOf(player);

  // If there's no way through, they simply end up there.
  const momoTrail = trailOf(home, findPath(rows, solid, home, momoSpot, [playerStart]) ?? [momoSpot]);
  const playerTrail = trailOf(playerStart, findPath(rows, solid, playerStart, playerSpot, [momoSpot]) ?? [playerSpot]);
  let returnTrail: Trail | null = null;
  let following = false;
  let phase: EscortPhase = "lead";
  let timer = 0;
  const slide = { slide: 0, shake: 0 };

  const face = (walker: Walker) => {
    walker.facing = "down";
    walker.flip = false;
    walker.moving = false;
  };

  return {
    momo,
    get phase() {
      return phase;
    },
    get blocking() {
      return phase !== "return" && phase !== "done";
    },
    get done() {
      return phase === "done";
    },
    door: slide,
    update(current, map) {
      player = current;
      if (phase === "lead") {
        const ahead = walk(momo, momoTrail, free);
        if (ahead || momoTrail.at >= HEAD_START) following = true;
        // The two walks can cross, most often when you've just been talking to her from below. Following means
        // waiting for her to be out of the next tile, not stepping into her.
        const next = playerTrail.points[playerTrail.at];
        const clear = ahead || !next || Math.max(Math.abs(next.x - momo.box.x), Math.abs(next.y - momo.box.y)) >= TILE;
        if (following && !clear) player.moving = false;
        const behind = following && clear && walk(player, playerTrail, map);
        if (ahead && behind) {
          face(momo);
          face(player);
          phase = "arrived";
          events.arrived();
        }
      } else if (phase === "knock") {
        timer++;
        slide.shake = Math.floor(timer / 3) % 2 === 0 ? 1 : -1;
        if (timer >= STICK) {
          slide.shake = 0;
          timer = 0;
          phase = "slide";
          events.sound("secret");
        }
      } else if (phase === "slide") {
        timer++;
        slide.slide = Math.min(1, timer / SLIDE);
        if (timer >= SLIDE) {
          phase = "opened";
          events.opened();
        }
      } else if (phase === "return") {
        // Momo goes back to her place, and waits there if someone's standing on it.
        if (walk(momo, returnTrail!, free) && !touchesTile(player, home.col, home.row)) phase = "done";
      }
    },
    proceed() {
      if (phase === "arrived") {
        timer = 0;
        phase = "knock";
        events.sound("blocked");
      } else if (phase === "opened") {
        const from = tileOf(momo);
        returnTrail = trailOf(from, findPath(rows, solid, from, home, [tileOf(player)]) ?? [home]);
        phase = "return";
      }
    },
  };
}
