import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawFighter } from "../art/duel-sprites.ts";
import { drawText, LINE_HEIGHT, wrapText, drawLabelAt } from "../art/font.ts";
import { drawKendoka, FULL_GEAR, NO_GEAR } from "../art/kendoka.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { CHARACTERS, cleanPlayerName, playerColors } from "../characters.ts";
import { guiPoint, onGui, onStage, STAGE_W, viewH } from "../core/scale.ts";
import type { Scene } from "../core/scene.ts";
import { DEFAULT_INSIGNIA } from "../insignia.ts";
import { createNameEntry, stepNameEntry, type NameEntry } from "../name-entry.ts";
import { CHARACTER_TITLE } from "./content.ts";
import { drawNameCard } from "./name-card.ts";
import { dimScreen, drawHints } from "./ui.ts";

const COLUMN = 40;
const ROW_Y = 26;
const TITLE_BASELINE = 19;
/** Light enough that black hair still shows against it. */
const PANEL = "#4A505E";

/** Pick who you are. Only your looks change, so nobody's choice makes the game harder. */
export function createCharacterScene(): Scene {
  let choice = 0;
  let tick = 0;
  /** You've picked someone, and they're deciding what to be called. */
  let naming: NameEntry | null = null;

  const colorsOf = (index: number, gi: boolean) => playerColors({ character: CHARACTERS[index].id, insignia: DEFAULT_INSIGNIA, gi });

  return {
    typing: () => naming !== null,
    enter() {
      choice = 0;
      tick = 0;
      naming = null;
    },
    update(game) {
      tick++;
      const { input } = game;
      if (naming) {
        const step = stepNameEntry(naming, input.typed());
        if (step.done === "keep") game.newGame(CHARACTERS[choice].id, cleanPlayerName(step.entry.text));
        naming = step.done ? null : step.entry;
        return;
      }
      const count = CHARACTERS.length;
      if (input.wasPressed("left")) choice = (choice + count - 1) % count;
      if (input.wasPressed("right")) choice = (choice + 1) % count;
      if (input.wasPressed("cancel")) game.go("title");
      else if (input.wasPressed("confirm")) naming = createNameEntry(CHARACTERS[choice].name);
      game.debug.character = CHARACTERS[choice].id;
    },
    render(ctx, game) {
      drawDuelBackdrop(ctx, "pinecone");
      dimScreen(ctx, 0.78);
      onStage(ctx, () => {
      drawLabelAt(ctx, CHARACTER_TITLE, STAGE_W / 2, TITLE_BASELINE, UI.text, 3);

      const frame = (game.reducedMotion ? 0 : Math.floor(tick / 20) % 2) as 0 | 1;
      const rowLeft = Math.round((STAGE_W - CHARACTERS.length * COLUMN) / 2);
      CHARACTERS.forEach((person, i) => {
        const x = rowLeft + i * COLUMN + (COLUMN - 16) / 2;
        const selected = i === choice;
        if (selected) {
          ctx.fillStyle = PALETTE.Y;
          ctx.fillRect(x - 10, ROW_Y - 2, 36, 37);
          ctx.fillStyle = PANEL;
          ctx.fillRect(x - 9, ROW_Y - 1, 34, 35);
        }
        drawKendoka(ctx, x, ROW_Y, "down", selected ? frame : 0, NO_GEAR, { colors: colorsOf(i, false) });
        drawLabelAt(ctx, person.name, x + 8, ROW_Y + 29, selected ? UI.accent : UI.dim);
      });

      // A closer look at the one you've landed on, in the gi and in full armor.
      const person = CHARACTERS[choice];
      const top = 68;
      ctx.fillStyle = PANEL;
      ctx.fillRect(8, top, STAGE_W - 16, 56);
      drawFighter(ctx, 34, top + 54, "guard", "player", 0, FULL_GEAR, { colors: colorsOf(choice, true) });
      ctx.save();
      ctx.translate(58, top + 6);
      ctx.scale(2, 2);
      drawKendoka(ctx, 0, 0, "down", 0, NO_GEAR, { colors: colorsOf(choice, true) });
      ctx.restore();
      const name = guiPoint(ctx, 98, top + 8);
      const lineEnd = guiPoint(ctx, STAGE_W - 12, 0).x;
      onGui(ctx, () => {
        drawText(ctx, person.name, name.x, name.y, UI.accent, 2);
        wrapText(person.blurb, lineEnd - name.x).forEach((line, i) => drawText(ctx, line, name.x, name.y + 22 + i * LINE_HEIGHT, UI.text));
      });

      });
      if (naming) onGui(ctx, () => drawNameCard(ctx, naming!, colorsOf(choice, true)));
      else onGui(ctx, () => drawHints(ctx, [["Left Right", "Choose"], ["E", "Pick"], ["X", "Back"]], viewH - 14));
    },
  };
}
