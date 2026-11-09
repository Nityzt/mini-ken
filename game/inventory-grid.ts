/** How the inventory's slots sit on the page. Pure, so moving around it can be tested without drawing anything. */
export const GRID_COLS = 6;

/** One group of slots. A null is a slot for something you haven't found, which is drawn but can't be picked. */
export type SlotGroup<T> = { title: string; slots: (T | null)[] };
export type Cell = { group: number; slot: number; row: number; col: number; index: number | null };

/** Every slot's place. Rows count down the whole page, and each group starts on a row of its own. */
export function layoutGrid(groupSizes: readonly number[], pickable: readonly (readonly boolean[])[], cols = GRID_COLS): Cell[] {
  const cells: Cell[] = [];
  let row = 0;
  let index = 0;
  groupSizes.forEach((size, group) => {
    for (let slot = 0; slot < size; slot++) {
      cells.push({ group, slot, row: row + Math.floor(slot / cols), col: slot % cols, index: pickable[group][slot] ? index++ : null });
    }
    row += Math.ceil(size / cols);
  });
  return cells;
}

/** Left and right walk through what you've got in reading order; up and down keep to the same column as near as they can. */
export function moveInGrid(cells: readonly Cell[], from: number, dx: number, dy: number): number {
  const picks = cells.filter((cell) => cell.index !== null);
  if (!picks.length) return 0;
  const here = picks[Math.min(Math.max(from, 0), picks.length - 1)];
  if (dx) return Math.min(Math.max(here.index! + Math.sign(dx), 0), picks.length - 1);
  if (!dy) return here.index!;
  const step = Math.sign(dy);
  const rows = [...new Set(picks.map((cell) => cell.row))].sort((a, b) => a - b);
  const next = rows[rows.indexOf(here.row) + step];
  if (next === undefined) return here.index!;
  const along = picks.filter((cell) => cell.row === next);
  along.sort((a, b) => Math.abs(a.col - here.col) - Math.abs(b.col - here.col) || a.col - b.col);
  return along[0].index!;
}
