import { MEN_INHERITS, PALETTE } from "./palette.ts";

/** Pads short rows and missing rows with transparency, so grids stay readable as text. */
export function grid(width: number, height: number, rows: string[]): string[] {
  if (rows.length > height) throw new Error(`Grid has ${rows.length} rows, expected ${height}`);
  const padded = rows.map((row) => {
    if (row.length > width) throw new Error(`Row wider than ${width}: ${row}`);
    return row.padEnd(width, ".");
  });
  while (padded.length < height) padded.push(".".repeat(width));
  return padded;
}

export function validateGrid(rows: string[]): string[] {
  const problems: string[] = [];
  rows.forEach((row, y) => {
    if (row.length !== rows[0].length) problems.push(`Row ${y} is ${row.length} wide, expected ${rows[0].length}`);
    for (const char of row) {
      if (char !== "." && !(char in PALETTE)) problems.push(`Row ${y} uses unknown color "${char}"`);
    }
  });
  return problems;
}

/** What one palette key comes out as under this color map. */
export const colorOf = (char: string, colors?: Record<string, string>): string => colors?.[char] ?? colors?.[MEN_INHERITS[char]] ?? PALETTE[char];

export function buildSprite(rows: string[], colors?: Record<string, string>): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      if (char === ".") continue;
      ctx.fillStyle = colorOf(char, colors);
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

const cache = new WeakMap<string[], Map<Record<string, string> | undefined, HTMLCanvasElement>>();

/** The same grid and color map always returns the same canvas. */
export function spriteFor(rows: string[], colors?: Record<string, string>): HTMLCanvasElement {
  let byColor = cache.get(rows);
  if (!byColor) cache.set(rows, (byColor = new Map()));
  let sprite = byColor.get(colors);
  if (!sprite) byColor.set(colors, (sprite = buildSprite(rows, colors)));
  return sprite;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  x: number,
  y: number,
  options: { flip?: boolean; colors?: Record<string, string> } = {},
): void {
  const sprite = spriteFor(rows, options.colors);
  const px = Math.round(x);
  const py = Math.round(y);
  if (!options.flip) {
    ctx.drawImage(sprite, px, py);
    return;
  }
  ctx.save();
  ctx.translate(px + sprite.width, py);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
}
