import { INSIGNIA_COLORS, symbolGrid, type Insignia } from "../insignia.ts";
import { PALETTE } from "./palette.ts";

const WIDTH = 25;
const HEIGHT = 16;
export const TARE_ART_WIDTH = WIDTH;
export const TARE_ART_HEIGHT = HEIGHT;

/** A big picture of your tare, with your design on the cloth at the front. x and y are its top-left corner. */
export function drawTare(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, insignia: Insignia, armor: Record<string, string> = {}): void {
  const main = armor.I ?? PALETTE.I;
  const light = armor.i ?? PALETTE.i;
  const dark = armor.N ?? PALETTE.N;
  const box = (bx: number, by: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + bx * scale, y + by * scale, w * scale, h * scale);
  };
  // The belt, then five flaps with the big ones at the middle of the three in front.
  box(0, 0, WIDTH, 3, PALETTE.K);
  box(1, 1, WIDTH - 2, 1, main);
  for (const [left, width, height] of [[0, 4, 11], [4, 4, 13], [8, 9, 16], [17, 4, 13], [21, 4, 11]]) {
    box(left, 2, width, height, PALETTE.K);
    box(left + 1, 3, width - 2, height - 2, main);
    box(left + 1, 3, 1, height - 2, light);
    box(left + 1, height - 1, width - 2, 1, dark);
  }
  // The name cloth, carrying the symbol.
  const cloth = INSIGNIA_COLORS[insignia.cloth];
  const mark = INSIGNIA_COLORS[insignia.mark];
  box(9, 4, 7, 7, cloth);
  symbolGrid(insignia.symbol).forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) if (row[rx] === "#") box(10 + rx, 5 + ry, 1, 1, mark);
  });
}
