export type Box = { x: number; y: number; w: number; h: number };
export type TileMap = { rows: string[]; solid: string; tile: number };

const EDGE = 0.001;

export function isSolidAt(map: TileMap, col: number, row: number): boolean {
  if (col < 0 || col >= map.rows[0].length) return true;
  if (row < 0 || row >= map.rows.length) return false;
  return map.solid.includes(map.rows[row][col]);
}

/** Moves one axis at a time, so a blocked fighter can still slide along a wall. Speeds must stay under one tile per tick. */
export function moveAndCollide(box: Box, dx: number, dy: number, map: TileMap): { box: Box; hitX: boolean; hitY: boolean } {
  const { tile } = map;
  const next = { ...box };
  let hitX = false;
  let hitY = false;

  if (dx !== 0) {
    next.x += dx;
    const col = Math.floor((dx > 0 ? next.x + next.w - EDGE : next.x) / tile);
    const top = Math.floor(next.y / tile);
    const bottom = Math.floor((next.y + next.h - EDGE) / tile);
    for (let row = top; row <= bottom; row++) {
      if (isSolidAt(map, col, row)) {
        next.x = dx > 0 ? col * tile - next.w : (col + 1) * tile;
        hitX = true;
        break;
      }
    }
  }
  if (dy !== 0) {
    next.y += dy;
    const row = Math.floor((dy > 0 ? next.y + next.h - EDGE : next.y) / tile);
    const left = Math.floor(next.x / tile);
    const right = Math.floor((next.x + next.w - EDGE) / tile);
    for (let col = left; col <= right; col++) {
      if (isSolidAt(map, col, row)) {
        next.y = dy > 0 ? row * tile - next.h : (row + 1) * tile;
        hitY = true;
        break;
      }
    }
  }
  return { box: next, hitX, hitY };
}

function overlapsSolid(box: Box, map: TileMap): boolean {
  const { tile } = map;
  for (let row = Math.floor(box.y / tile); row <= Math.floor((box.y + box.h - EDGE) / tile); row++) {
    for (let col = Math.floor(box.x / tile); col <= Math.floor((box.x + box.w - EDGE) / tile); col++) if (isSolidAt(map, col, row)) return true;
  }
  return false;
}

/**
 * Walking straight at a wall a few pixels to one side of a gap, such as a one-tile doorway, eases you sideways into
 * the gap instead of stopping you dead. Doorways are exactly one tile wide, so lining up by eye is fiddly otherwise.
 * Only within `slack` pixels, and only when walking along one axis.
 */
export function slideIntoGap(box: Box, dx: number, dy: number, map: TileMap, slack: number): Box {
  const moved = moveAndCollide(box, dx, dy, map);
  if ((dx !== 0) === (dy !== 0)) return moved.box;
  const blocked = dx !== 0 ? moved.hitX && Math.abs(moved.box.x - box.x) < Math.abs(dx) : moved.hitY && Math.abs(moved.box.y - box.y) < Math.abs(dy);
  if (!blocked) return moved.box;
  const speed = Math.abs(dx || dy);
  for (let offset = 1; offset <= slack; offset++) {
    for (const sign of [-1, 1]) {
      const side = dx !== 0 ? { ...box, y: box.y + sign * offset } : { ...box, x: box.x + sign * offset };
      if (overlapsSolid(side, map)) continue;
      const through = { ...side, x: side.x + dx + Math.sign(dx), y: side.y + dy + Math.sign(dy) };
      if (overlapsSolid(through, map)) continue;
      // Step towards the gap at walking pace, rather than jumping into it.
      const step = sign * Math.min(speed, offset);
      return moveAndCollide(box, dx !== 0 ? 0 : step, dx !== 0 ? step : 0, map).box;
    }
  }
  return moved.box;
}
