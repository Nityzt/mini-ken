import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawFighter } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_W, stageX, viewH, viewW } from "../core/scale.ts";
import type { Scene } from "../core/scene.ts";
import { TITLE_CONTINUE, TITLE_ERASE, TITLE_MULTIPLAYER, TITLE_NEW, TITLE_START } from "./content.ts";

const TITLE = "TINY KENDO";
const TITLE_SIZE = 4;
const BAND_TOP = 16;
const BAND_HEIGHT = 42;
const BOX_TOP = 64;
const BOX_LEFT = 38;
const HELP_LINES = ["Arrows or WASD move   E talks", "Esc or P menu   F fullscreen"];

export function createTitleScene(): Scene {
  let tick = 0;
  let hasSave = false;
  let choice = 0;
  let confirming = false;
  /** Multiplayer's always offered, so anyone can go straight there without starting a story. */
  const optionsNow = () => (hasSave ? [TITLE_CONTINUE, TITLE_NEW, TITLE_MULTIPLAYER] : [TITLE_START, TITLE_MULTIPLAYER]);

  return {
    enter(game) {
      hasSave = game.hasSave();
      choice = 0;
      confirming = false;
    },
    update(game) {
      tick++;
      const { input } = game;
      // A story can arrive from an account, or go, while this is on screen. Start must never erase one nobody's been warned about.
      const saved = game.hasSave();
      if (saved !== hasSave) {
        hasSave = saved;
        choice = 0;
        confirming = false;
      }
      // Starting over erases the save, so it asks first.
      if (confirming) {
        if (input.wasPressed("cancel")) confirming = false;
        else if (input.wasPressed("confirm")) game.go("character");
        return;
      }
      const options = optionsNow();
      if (input.wasPressed("up")) choice = (choice + options.length - 1) % options.length;
      if (input.wasPressed("down")) choice = (choice + 1) % options.length;
      if (!input.wasPressed("confirm")) return;
      const picked = options[choice];
      if (picked === TITLE_MULTIPLAYER) {
        game.online.returnTo = "title";
        game.go("online");
      } else if (picked === TITLE_START) game.go("character");
      else if (picked === TITLE_CONTINUE) game.continueGame();
      else confirming = true;
    },
    render(ctx) {
      drawDuelBackdrop(ctx, "pinecone");
      onStage(ctx, () => {
        drawFighter(ctx, 58, 128, Math.floor(tick / 40) % 2 === 0 ? "guard" : "tellHandsUp", "player", 0);
        drawFighter(ctx, STAGE_W - 58, 128, "guard", "rival", 0);
      });

      onGui(ctx, () => {
        onStage(ctx, () => {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(-stageX(), BAND_TOP, viewW, BAND_HEIGHT);
          const x = (STAGE_W - measureText(TITLE) * TITLE_SIZE) / 2;
          drawText(ctx, TITLE, x + 1, BAND_TOP + 8, PALETTE.r, TITLE_SIZE);
          drawText(ctx, TITLE, x, BAND_TOP + 7, UI.text, TITLE_SIZE);

          // Small enough to stand between the two fighters, not in front of them.
          const options = confirming ? [] : optionsNow();
          const height = options.length * 10 + HELP_LINES.length * 9 + 14;
          ctx.fillStyle = UI.edge;
          ctx.fillRect(BOX_LEFT - 1, BOX_TOP - 1, STAGE_W - BOX_LEFT * 2 + 2, height + 2);
          ctx.fillStyle = UI.panel;
          ctx.fillRect(BOX_LEFT, BOX_TOP, STAGE_W - BOX_LEFT * 2, height);
          options.forEach((option, i) => {
            const y = BOX_TOP + 5 + i * 10;
            const selected = i === choice;
            drawTextCentered(ctx, option, STAGE_W / 2, y, selected ? UI.accent : UI.text);
            if (selected) drawText(ctx, ">", (STAGE_W - measureText(option)) / 2 - 10, y, UI.accent);
          });
          HELP_LINES.forEach((line, i) => drawTextCentered(ctx, line, STAGE_W / 2, BOX_TOP + 9 + options.length * 10 + i * 9, UI.dim));
        });

        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 11, viewW, 11);
        drawTextCentered(ctx, confirming ? TITLE_ERASE : "E or Space to choose", viewW / 2, viewH - 10, confirming ? UI.accent : UI.text);
      });
    },
  };
}
