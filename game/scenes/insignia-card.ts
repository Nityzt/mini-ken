import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { drawTare, TARE_ART_WIDTH } from "../art/insignia.ts";
import { UI } from "../art/palette.ts";
import { playerColors } from "../characters.ts";
import { onStage, STAGE_W, viewH } from "../core/scale.ts";
import type { InsigniaEditor } from "../insignia.ts";
import type { RunState } from "../run-state.ts";
import { INSIGNIA_NOTE, INSIGNIA_ROWS, INSIGNIA_TITLE } from "./content.ts";
import { dimScreen, drawHints } from "./ui.ts";

const PREVIEW_SCALE = 4;
const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

/** Choose a symbol and colors for the cloth on your tare. Skipping is fine, and the menu can bring you back. */
export function drawInsigniaCard(ctx: CanvasRenderingContext2D, editor: InsigniaEditor, run: RunState): void {
  dimScreen(ctx, 0.94);
  const { insignia, row } = editor;
  onStage(ctx, () => {
  const title = INSIGNIA_TITLE;
  drawText(ctx, title, Math.round((STAGE_W - measureText(title) * 2) / 2), 6, UI.accent, 2);
  drawTextCentered(ctx, INSIGNIA_NOTE, STAGE_W / 2, 24, UI.dim);

  drawTare(ctx, 18, 44, PREVIEW_SCALE, insignia, playerColors(run));

  const left = 18 + TARE_ART_WIDTH * PREVIEW_SCALE + 14;
  const values = [insignia.symbol, insignia.cloth, insignia.mark];
  INSIGNIA_ROWS.forEach((label, i) => {
    const y = 50 + i * 18;
    const selected = i === row;
    drawText(ctx, label, left, y, selected ? UI.accent : UI.dim);
    const value = capitalize(values[i]);
    const valueX = left + 44;
    drawText(ctx, selected ? `< ${value} >` : `  ${value}`, valueX, y, selected ? UI.text : UI.dim);
  });

  });
  drawHints(ctx, [["Arrows", "Change"], ["E", "Keep"], ["X", "Skip"]], viewH - 14);
}
