import type { Facing, Gear } from "../art/kendoka.ts";
import { TILE } from "../art/tiles.ts";
import type { TileMap } from "../core/collision.ts";
import { findPath, tileOf, trailOf, walk, type Tile } from "./club-intro.ts";
import { createWalker, type Walker } from "./topdown.ts";

/** How people move about when something's going on: walking up to talk, dropping by, and getting changed. */

/** How many tiles off someone can be and still be walked up to. */
const PERSON_REACH = 3;

const STEP: Record<Facing, [number, number]> = { up: [0, -1], down: [0, 1], side: [1, 0] };

export function facingToward(from: { x: number; y: number }, to: { x: number; y: number }): { facing: Facing; flip: boolean } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { facing: "side", flip: dx < 0 };
  return { facing: dy > 0 ? "down" : "up", flip: false };
}

/** Someone you could walk up to, along the way you're facing with nothing in between, and where you'd stand to talk. */
export function personAhead(walker: Walker, rows: string[], solid: string, people: string): { char: string; stand: Tile } | null {
  let stand = tileOf(walker);
  const [stepCol, stepRow] = STEP[walker.facing];
  const dc = walker.facing === "side" && walker.flip ? -stepCol : stepCol;
  for (let i = 0; i < PERSON_REACH; i++) {
    const next = { col: stand.col + dc, row: stand.row + stepRow };
    const char = rows[next.row]?.[next.col];
    if (char === undefined) return null;
    if (people.includes(char)) return { char, stand };
    if (solid.includes(char)) return null;
    stand = next;
  }
  return null;
}

/** You going over to someone. You arrive still facing them, whichever way your feet went. */
export function createStride(walker: Walker, stand: Tile): { update(walker: Walker, map: TileMap): boolean } {
  const { facing, flip } = walker;
  const trail = trailOf(stand, []);
  return {
    update(current, map) {
      if (!walk(current, trail, map)) return false;
      current.facing = facing;
      current.flip = flip;
      current.moving = false;
      return true;
    },
  };
}

/** You stepping in through the door, to where you'd have started anyway. */
export function createEntrance(walker: Walker, door: Tile, start: Tile, map: TileMap): { update(): boolean } {
  const trail = trailOf(door, [start]);
  walker.box = { ...walker.box, ...createWalker(door.col, door.row).box };
  return {
    update() {
      if (!walk(walker, trail, map)) return false;
      walker.moving = false;
      return true;
    },
  };
}

const NEIGHBOURS: [number, number][] = [[0, 1], [-1, 0], [1, 0], [0, -1]];
const centerOf = (walker: Walker) => ({ x: walker.box.x + walker.box.w / 2, y: walker.box.y + walker.box.h / 2 });

function faceEachOther(a: Walker, b: Walker): void {
  Object.assign(a, facingToward(centerOf(a), centerOf(b)), { moving: false });
  Object.assign(b, facingToward(centerOf(b), centerOf(a)), { moving: false });
}

export type VisitPhase = "coming" | "talking" | "going" | "done";
export type Visit = {
  readonly walker: Walker;
  readonly phase: VisitPhase;
  /** You wait for them to get to you, and stay for what they've got to say. */
  readonly blocking: boolean;
  readonly done: boolean;
  update(player: Walker): void;
  /** They've finished talking, so off they go. */
  leave(to: Tile): void;
};

/**
 * Somebody coming over to you and then going on their way. `rows` needs their usual spot to be open floor.
 * They walk freely, so nothing you've done with the furniture can leave them stuck.
 */
export function createVisit(setup: { rows: string[]; solid: string; start: Tile; door: Tile; player: Walker; alreadyHere?: boolean }): Visit {
  const { solid, start, door, player } = setup;
  // The door's a way in and out for them, and a wall for everyone else.
  const rows = setup.rows.map((line, row) => (row === door.row ? line.slice(0, door.col) + "." + line.slice(door.col + 1) : line));
  const free: TileMap = { rows, solid: "", tile: TILE };
  const walker: Walker = { ...createWalker(start.col, start.row), facing: "down" };
  const you = tileOf(player);
  const open = NEIGHBOURS.map(([dc, dr]) => ({ col: you.col + dc, row: you.row + dr })).filter((t) => {
    const char = setup.rows[t.row]?.[t.col];
    return char !== undefined && !solid.includes(char);
  });
  const routes = open.map((t) => ({ to: t, path: findPath(rows, solid, start, t, [you]) }));
  const walkable = routes.filter((r) => r.path).sort((a, b) => a.path!.length - b.path!.length)[0];
  // Shut off from the door somehow, they're simply on their way over regardless.
  const path = walkable?.path ?? [open[0] ?? start];
  let trail = trailOf(start, path);
  let phase: VisitPhase = setup.alreadyHere ? "talking" : "coming";
  if (setup.alreadyHere) faceEachOther(walker, player);

  return {
    walker,
    get phase() {
      return phase;
    },
    get blocking() {
      return phase === "coming" || phase === "talking";
    },
    get done() {
      return phase === "done";
    },
    update(current) {
      if (phase === "coming" && walk(walker, trail, free)) {
        faceEachOther(walker, current);
        phase = "talking";
      } else if (phase === "going" && walk(walker, trail, free)) {
        walker.moving = false;
        phase = "done";
      }
    },
    leave(to) {
      const from = tileOf(walker);
      trail = trailOf(from, findPath(rows, solid, from, to, [tileOf(player)]) ?? [to]);
      phase = "going";
    },
  };
}

export const gainedGear = (before: Gear, after: Gear): boolean => (Object.keys(after) as (keyof Gear)[]).some((piece) => after[piece] && !before[piece]);

const HOLD_TICKS = 16;
const SPIN_TICKS = 36;
const TURN_TICKS = 5;
const HOP_TICKS = 16;
const HOP = 2;
export const DRESSING_TICKS = HOLD_TICKS + SPIN_TICKS + HOP_TICKS;
const SPIN: { facing: Facing; flip: boolean }[] = [{ facing: "down", flip: false }, { facing: "side", flip: false }, { facing: "up", flip: false }, { facing: "side", flip: true }];

export type DressingFrame = { facing: Facing; flip: boolean; hop: number; puffs: boolean; held: boolean; changed: boolean; done: boolean };

/** Hold it up, spin round in a flurry of cloth, and come out wearing it with a little hop. With reduced motion, you simply are. */
export function dressingAt(tick: number, still: boolean): DressingFrame {
  const done = tick >= DRESSING_TICKS;
  if (still) return { facing: "down", flip: false, hop: 0, puffs: false, held: false, changed: tick >= DRESSING_TICKS / 2, done };
  const spinning = tick >= HOLD_TICKS && tick < HOLD_TICKS + SPIN_TICKS;
  const turn = spinning ? SPIN[Math.floor((tick - HOLD_TICKS) / TURN_TICKS) % SPIN.length] : SPIN[0];
  const hopping = tick >= HOLD_TICKS + SPIN_TICKS && tick < DRESSING_TICKS - HOP_TICKS / 2;
  return { ...turn, hop: hopping ? HOP : 0, puffs: spinning, held: tick < HOLD_TICKS, changed: tick >= HOLD_TICKS + SPIN_TICKS / 2, done };
}
