/** The design on the cloth at the front of your tare. Plain data, so it could be shown to other players one day. */
export const INSIGNIA_SYMBOLS = ["plain", "pine", "moon", "star", "wave", "peak", "sun", "cross", "gem"] as const;
export type InsigniaSymbol = (typeof INSIGNIA_SYMBOLS)[number];

export const INSIGNIA_CLOTHS = ["red", "indigo", "cream", "ink", "green", "gold"] as const;
export const INSIGNIA_MARKS = ["cream", "ink", "gold", "red", "indigo"] as const;
export type InsigniaColor = (typeof INSIGNIA_CLOTHS)[number];
export type Insignia = { symbol: InsigniaSymbol; cloth: InsigniaColor; mark: InsigniaColor };

export const INSIGNIA_COLORS: Record<InsigniaColor, string> = {
  red: "#E8192C",
  indigo: "#2B3A67",
  cream: "#FAF7F2",
  ink: "#1A1A1A",
  green: "#3E6E4A",
  gold: "#E6C46A",
};

export const DEFAULT_INSIGNIA: Insignia = { symbol: "plain", cloth: "red", mark: "cream" };

const SYMBOLS: Record<InsigniaSymbol, string[]> = {
  plain: [".....", ".....", ".....", ".....", "....."],
  pine: ["..#..", ".###.", "..#..", ".###.", "#####"],
  moon: [".###.", "##...", "##...", "##...", ".###."],
  star: ["..#..", "#####", ".###.", ".#.#.", "#...#"],
  wave: [".#..#", "#.##.", ".....", ".#..#", "#.##."],
  peak: [".....", "..#..", ".###.", "#####", "#####"],
  sun: ["#.#.#", ".###.", "#####", ".###.", "#.#.#"],
  cross: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  gem: ["..#..", ".###.", "#####", ".###.", "..#.."],
};

export const symbolGrid = (symbol: InsigniaSymbol): string[] => SYMBOLS[symbol];

export type InsigniaRow = 0 | 1 | 2;
export type InsigniaEditor = { insignia: Insignia; row: InsigniaRow };
export type InsigniaKeys = { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; cancel: boolean };

export const createInsigniaEditor = (insignia: Insignia): InsigniaEditor => ({ insignia, row: 0 });

function cycle<T>(list: readonly T[], current: T, by: number, skip?: T): T {
  let at = list.indexOf(current);
  do at = (at + by + list.length) % list.length;
  while (list[at] === skip);
  return list[at];
}

/** Up and down pick a row, left and right change it. E keeps the design, and X leaves everything as it was. */
export function stepInsigniaEditor(editor: InsigniaEditor, keys: InsigniaKeys): { editor: InsigniaEditor; done: "keep" | "skip" | null } {
  if (keys.cancel) return { editor, done: "skip" };
  if (keys.confirm) return { editor, done: "keep" };
  const rows = 3;
  let row = editor.row;
  if (keys.up) row = ((row + rows - 1) % rows) as InsigniaRow;
  if (keys.down) row = ((row + 1) % rows) as InsigniaRow;
  const by = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let { insignia } = editor;
  if (by !== 0) {
    if (row === 0) insignia = { ...insignia, symbol: cycle(INSIGNIA_SYMBOLS, insignia.symbol, by) };
    // A mark the same color as its cloth would vanish.
    if (row === 1) {
      const cloth = cycle(INSIGNIA_CLOTHS, insignia.cloth, by);
      const mark = cloth === insignia.mark ? cycle<InsigniaColor>(INSIGNIA_MARKS, insignia.mark, 1, cloth) : insignia.mark;
      insignia = { ...insignia, cloth, mark };
    }
    if (row === 2) insignia = { ...insignia, mark: cycle<InsigniaColor>(INSIGNIA_MARKS, insignia.mark, by, insignia.cloth) };
  }
  return { editor: { insignia, row }, done: null };
}

export function isInsignia(value: unknown): value is Insignia {
  if (typeof value !== "object" || value === null) return false;
  const { symbol, cloth, mark } = value as Record<string, unknown>;
  return (
    (INSIGNIA_SYMBOLS as readonly unknown[]).includes(symbol) &&
    (INSIGNIA_CLOTHS as readonly unknown[]).includes(cloth) &&
    (INSIGNIA_MARKS as readonly unknown[]).includes(mark) &&
    cloth !== mark
  );
}
