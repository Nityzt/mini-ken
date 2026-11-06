import type { Crest } from "../art/backdrops.ts";
import { BACKDROP_GRIDS } from "../art/backdrops.ts";
import { drawKendoka, type Facing, type Gear } from "../art/kendoka.ts";
import { bannerColumn, floorMarked, FLOOR_TILES, lookOf } from "../art/looks.ts";
import { drawSprite } from "../art/sprite.ts";
import { TILE, TILE_GRIDS } from "../art/tiles.ts";
import { moveAndCollide, type Box, type TileMap } from "../core/collision.ts";
import type { Input } from "../core/input.ts";
import { viewH, viewW } from "../core/scale.ts";

const SPEED = 1.5;
const DIAGONAL = 0.75;
const REACH = 8;

export type Walker = { box: Box; facing: Facing; flip: boolean; walkTick: number; moving: boolean };
export type Camera = { x: number; y: number };

export function createWalker(col: number, row: number): Walker {
  return { box: { x: col * TILE + 3, y: row * TILE + 8, w: 10, h: 8 }, facing: "up", flip: false, walkTick: 0, moving: false };
}

export function updateWalker(walker: Walker, input: Input, map: TileMap): void {
  const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
  const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
  walker.moving = dx !== 0 || dy !== 0;
  if (!walker.moving) return;
  walker.walkTick++;
  if (dy !== 0) walker.facing = dy > 0 ? "down" : "up";
  if (dx !== 0) {
    walker.facing = "side";
    walker.flip = dx < 0;
  }
  const speed = dx !== 0 && dy !== 0 ? SPEED * DIAGONAL : SPEED;
  walker.box = moveAndCollide(walker.box, dx * speed, dy * speed, map).box;
}

/** The tile just in front of the walker's feet, which is what confirm talks to. */
export function tileInFront(walker: Walker, rows: string[]): string {
  const { x, y, w, h } = walker.box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const [fx, fy] =
    walker.facing === "up" ? [cx, y - REACH]
    : walker.facing === "down" ? [cx, y + h + REACH]
    : walker.flip ? [x - REACH, cy]
    : [x + w + REACH, cy];
  return rows[Math.floor(fy / TILE)]?.[Math.floor(fx / TILE)] ?? "#";
}

export function touchesTile(walker: Walker, col: number, row: number): boolean {
  const { x, y, w, h } = walker.box;
  return x < (col + 1) * TILE && x + w > col * TILE && y < (row + 1) * TILE && y + h > row * TILE;
}

export function cameraFor(walker: Walker, rows: string[]): Camera {
  const axis = (center: number, world: number, view: number) =>
    world <= view ? Math.floor((world - view) / 2) : Math.round(Math.max(0, Math.min(world - view, center - view / 2)));
  return {
    x: axis(walker.box.x + walker.box.w / 2, rows[0].length * TILE, viewW),
    y: axis(walker.box.y, rows.length * TILE, viewH),
  };
}

const TILE_ART: Record<string, string> = { "#": "wallTop", C: "bambooCracked" };
const ON_WALL: Record<string, string> = { r: "rack", p: "plant", N: "noticeBoard" };

/** A window shows this place's weather, in this place's frame. */
const windowLooks = new Map<Crest, Record<string, string>>();
function windowColors(place: Crest): Record<string, string> {
  let colors = windowLooks.get(place);
  if (!colors) windowLooks.set(place, (colors = { ...lookOf(place).room, ...lookOf(place).window }));
  return colors;
}

const CREST_SPRITES: Record<Crest, string> = {
  pinecone: "crestPinecone", radish: "crestRadish", goose: "crestGoose", raccoon: "crestRaccoon", heron: "crestHeron", otter: "crestOtter", arena: "crestArena", hall: "crestHall", hut: "crestHut",
};

/** A room seen from above. It's the same place you'll fight in, so it has the same floor, walls, view and crest. */
export function drawRoom(ctx: CanvasRenderingContext2D, rows: string[], cam: Camera, doorOpen: boolean, place: Crest = "pinecone"): void {
  const look = lookOf(place);
  const floor = TILE_GRIDS[FLOOR_TILES[look.floor]];
  const options = { colors: look.room };
  const banner = bannerColumn(rows);
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const x = col * TILE - cam.x;
      const y = row * TILE - cam.y;
      if (x <= -TILE || y <= -TILE || x >= viewW || y >= viewH) continue;
      const char = line[col];
      if (char === "D") {
        drawSprite(ctx, TILE_GRIDS[doorOpen ? "doorOpen" : "doorClosed"], x, y, options);
      } else if (char === "Q") {
        drawSprite(ctx, TILE_GRIDS.doorClosed, x, y, options);
      } else if (char === "$") {
        drawSprite(ctx, floor, x, y, options);
        drawSprite(ctx, TILE_GRIDS.merch, x, y);
      } else if (char === "w") {
        drawSprite(ctx, TILE_GRIDS.window, x, y, { colors: windowColors(place) });
      } else if (char === "W") {
        drawSprite(ctx, TILE_GRIDS.wall, x, y, options);
        if (banner && banner.col === col && banner.row === row && look.banner) {
          ctx.fillStyle = look.banner.edge;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = look.banner.cloth;
          ctx.fillRect(x + 1, y, TILE - 2, TILE - 1);
          ctx.fillStyle = look.banner.field;
          ctx.fillRect(x + 2, y + 1, TILE - 4, TILE - 3);
          drawSprite(ctx, BACKDROP_GRIDS[CREST_SPRITES[place]], x + 1, y);
        } else if (look.decor && (col + row) % look.decor.every === 0) {
          drawSprite(ctx, TILE_GRIDS[look.decor.tile], x, y);
        }
      } else if (ON_WALL[char]) {
        drawSprite(ctx, TILE_GRIDS.wall, x, y, options);
        drawSprite(ctx, TILE_GRIDS[ON_WALL[char]], x, y, options);
      } else if (TILE_ART[char]) {
        drawSprite(ctx, TILE_GRIDS[TILE_ART[char]], x, y, options);
      } else {
        drawSprite(ctx, floor, x, y, options);
        if (char === "." && look.mark && floorMarked(col, row, look.mark.every)) drawSprite(ctx, TILE_GRIDS[look.mark.tile], x, y);
      }
    }
  });
}

export function drawWalker(ctx: CanvasRenderingContext2D, walker: Walker, cam: Camera, gear: Gear, colors: Record<string, string>): void {
  const frame = (walker.moving ? Math.floor(walker.walkTick / 8) % 2 : 0) as 0 | 1;
  drawKendoka(ctx, walker.box.x - 3 - cam.x, walker.box.y - 12 - cam.y, walker.facing, frame, gear, {
    flip: walker.flip,
    colors,
  });
}
