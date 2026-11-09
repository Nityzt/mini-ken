import { drawText, drawTextCentered, GLYPH_HEIGHT, measureText } from "../art/font.ts";
import { drawKendoka, NO_GEAR } from "../art/kendoka.ts";
import { UI } from "../art/palette.ts";
import { NAME_LIMIT } from "../characters.ts";
import { onStage, STAGE_W, viewH } from "../core/scale.ts";
import type { NameEntry } from "../name-entry.ts";
import { HINT_KEEP_NAME, HINT_NAME_BACK, NAME_TITLE, nameNote } from "./content.ts";
import { dimScreen, drawHints } from "./ui.ts";

const BOX_W = NAME_LIMIT * 6 + 10;
const BOX_H = 15;
const BOX_Y = 74;

/** Your own name, or who you'd otherwise be, in grey until you start typing over it. */
export function drawNameCard(ctx: CanvasRenderingContext2D, entry: NameEntry, colors: Record<string, string>): void {
  dimScreen(ctx, 0.94);
  onStage(ctx, () => {
    drawText(ctx, NAME_TITLE, Math.round((STAGE_W - measureText(NAME_TITLE) * 2) / 2), 6, UI.accent, 2);
    drawKendoka(ctx, STAGE_W / 2 - 8, 28, "down", 0, { ...NO_GEAR }, { colors });
    drawTextCentered(ctx, nameNote(entry.fallback), STAGE_W / 2, 54, UI.dim);

    const left = Math.round((STAGE_W - BOX_W) / 2);
    ctx.fillStyle = UI.edge;
    ctx.fillRect(left, BOX_Y, BOX_W, BOX_H);
    ctx.fillStyle = UI.slot;
    ctx.fillRect(left + 1, BOX_Y + 1, BOX_W - 2, BOX_H - 2);
    const shown = entry.text || entry.fallback;
    const x = Math.round(STAGE_W / 2 - measureText(shown) / 2);
    drawText(ctx, shown, x, BOX_Y + 4, entry.text ? UI.text : UI.faint);
    if (Math.floor(entry.tick / 30) % 2 === 0) {
      ctx.fillStyle = UI.accent;
      ctx.fillRect(entry.text ? x + measureText(shown) + 1 : x - 2, BOX_Y + 3, 1, GLYPH_HEIGHT);
    }
  });
  drawHints(ctx, [["Enter", HINT_KEEP_NAME], ["Esc", HINT_NAME_BACK]], viewH - 14);
}
