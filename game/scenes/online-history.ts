import { keyLabel } from "../core/key-labels.ts";
import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawText, drawTextCentered, measureText, LINE_HEIGHT } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_W, stageX, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import type { HistoryRow } from "../net/account-client.ts";
import { HISTORY_BACK, HISTORY_EMPTY, HISTORY_FAILED, HISTORY_LOADING, historyLine, ONLINE_HISTORY } from "./online-lines.ts";

const TOP = 18;
const VISIBLE = 13;

/** The last few matches, newest first. */
export function createOnlineHistoryScene(): Scene {
  let rows: HistoryRow[] | null | "loading" = "loading";
  let first = 0;
  let asked = 0;

  return {
    outsideStory: () => true,
    enter(game: Game) {
      const ask = ++asked;
      rows = "loading";
      first = 0;
      void game.online.account?.history().then((found) => {
        if (ask === asked) rows = found;
      });
    },
    update(game) {
      if (game.input.wasPressed("cancel") || game.input.wasPressed("confirm")) {
        game.go("online");
        return;
      }
      if (!Array.isArray(rows)) return;
      if (game.input.wasPressed("down")) first = Math.min(first + 1, Math.max(0, rows.length - VISIBLE));
      if (game.input.wasPressed("up")) first = Math.max(0, first - 1);
    },
    render(ctx, game) {
      drawDuelBackdrop(ctx, "arena");
      onGui(ctx, () => {
        onStage(ctx, () => {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(-stageX(), TOP - 8, viewW, (VISIBLE + 3) * LINE_HEIGHT + 12);
          drawText(ctx, ONLINE_HISTORY, (STAGE_W - measureText(ONLINE_HISTORY) * 2) / 2, TOP - 4, UI.text, 2);
          const body = TOP + 18;
          if (rows === "loading") drawTextCentered(ctx, HISTORY_LOADING, STAGE_W / 2, body, UI.dim);
          else if (rows === null) drawTextCentered(ctx, HISTORY_FAILED, STAGE_W / 2, body, UI.bad);
          else if (!rows.length) drawTextCentered(ctx, HISTORY_EMPTY, STAGE_W / 2, body, UI.dim);
          else {
            rows.slice(first, first + VISIBLE).forEach((row, i) => {
              drawTextCentered(ctx, historyLine(row), STAGE_W / 2, body + i * LINE_HEIGHT, row.result === "won" ? UI.accent : row.result === "lost" ? UI.text : UI.dim);
            });
          }
          drawTextCentered(ctx, `${keyLabel(game.input, "cancel", "x")}: back`, STAGE_W / 2, body + VISIBLE * LINE_HEIGHT, UI.dim);
        });
      });
    },
  };
}
