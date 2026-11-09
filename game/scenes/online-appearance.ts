import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawFighter } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered } from "../art/font.ts";
import { drawTare } from "../art/insignia.ts";
import { UI } from "../art/palette.ts";
import { characterById } from "../characters.ts";
import { onGui, onStage, STAGE_W, viewH } from "../core/scale.ts";
import type { Scene } from "../core/scene.ts";
import { appearanceColors, rankForRecord } from "../net/appearance.ts";
import { createAppearanceEditor, initialEditorAppearance, stepAppearanceEditor, type Editor } from "../net/appearance-editor.ts";
import { resumeScene } from "../save.ts";
import { dimScreen, drawHints } from "./ui.ts";

export function createOnlineAppearanceScene(): Scene {
  let editor: Editor;
  let first = false;
  return {
    outsideStory: () => true,
    enter(game) {
      first = !game.online.profile().appearance;
      const status = game.online.account?.status();
      const known = !status || status === "signed-out" || (status === "signed-in" && game.online.account?.record() !== null);
      editor = createAppearanceEditor(initialEditorAppearance(game.online.appearance(), known ? game.online.rankRecord() : null));
    },
    update(game) {
      const input = game.input;
      const next = stepAppearanceEditor(editor, { up: input.wasPressed("up"), down: input.wasPressed("down"), left: input.wasPressed("left"), right: input.wasPressed("right"), confirm: input.wasPressed("confirm"), cancel: input.wasPressed("cancel") }, game.online.rankRecord());
      editor = next.editor;
      if (next.done === "save") { game.online.setAppearance(editor.appearance); game.go("online"); }
      else if (next.done === "cancel") game.go(first ? (game.online.returnTo === "story" ? resumeScene(game.run) : "title") : "online");
    },
    render(ctx, game) {
      drawDuelBackdrop(ctx, "arena");
      dimScreen(ctx, 0.8);
      onStage(ctx, () => {
        ctx.fillStyle = UI.panel;
        ctx.fillRect(8, 8, STAGE_W - 16, 120);
        drawTextCentered(ctx, "Your multiplayer look", STAGE_W / 2, 13, UI.accent);
        const colors = appearanceColors(editor.appearance);
        drawFighter(ctx, 32, 104, "guard", "player", 0, undefined, { colors, insignia: editor.appearance.insignia });
        drawTare(ctx, 58, 60, 1, editor.appearance.insignia, colors);
        const { appearance, row } = editor;
        const labels = ["Character", "Armor", "Symbol", "Cloth", "Mark"];
        const values = [characterById(appearance.character).name, appearance.armor, appearance.insignia.symbol, appearance.insignia.cloth, appearance.insignia.mark];
        labels.forEach((label, i) => {
          const y = 34 + i * 15;
          drawText(ctx, label, 94, y, row === i ? UI.accent : UI.dim);
          drawText(ctx, `${row === i ? "> " : "  "}${values[i]}`, 151, y, UI.text);
        });
        const rank = rankForRecord(game.online.rankRecord());
        const next = rank === "bronze" ? "Silver: Heron, Otter" : rank === "silver" ? "Gold: Radish" : "All dojo colors unlocked";
        drawTextCentered(ctx, `${rank} - ${next}`, STAGE_W / 2, 108, UI.accent);
        drawTextCentered(ctx, "Silver 50%/5  Gold 65%/10 matches", STAGE_W / 2, 119, UI.dim);
      });
      onGui(ctx, () => drawHints(ctx, [["Arrows", "Choose"], ["E", "Save"], ["X", "Back"]], viewH - 14));
    },
  };
}
