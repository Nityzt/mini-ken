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
