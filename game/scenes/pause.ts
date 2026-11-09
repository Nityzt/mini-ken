import { keyLabel } from "../core/key-labels.ts";
import type { Input } from "../core/input.ts";
import { drawText, drawTextCentered, LINE_HEIGHT, measureText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import type { MenuItem, PauseMenu } from "../core/pause-menu.ts";
import { onStage, STAGE_H, STAGE_W, viewH, viewW } from "../core/scale.ts";
import { CHALLENGES, isClaimed, moneyText } from "../money.ts";
import type { RunState } from "../run-state.ts";
import { drawInventory } from "./inventory-page.ts";
import { drawProgress } from "./progress-page.ts";
import { CHALLENGES_TITLE, CONTROL_ROWS, CONTROLS_TITLE, PAUSE_BACK, PAUSE_CONFIRM, PAUSE_HELP, PAUSE_NO, PAUSE_TITLE, PAUSE_YES, PROGRESS_OPEN_DONE } from "./content.ts";

const ROW_HEIGHT = 12;

function drawChoices(ctx: CanvasRenderingContext2D, labels: string[], choice: number, top: number): void {
  labels.forEach((label, i) => {
    const y = top + i * ROW_HEIGHT;
    const selected = i === choice;
    drawTextCentered(ctx, label, STAGE_W / 2, y, selected ? UI.accent : UI.dim);
    if (selected) drawText(ctx, ">", (STAGE_W - measureText(label)) / 2 - 10, y, UI.accent);
  });
}

function drawChallenges(ctx: CanvasRenderingContext2D, run: RunState, input: Input): void {
  drawText(ctx, CHALLENGES_TITLE, 8, 2, UI.accent);
  const purse = moneyText(run.money);
  drawText(ctx, purse, STAGE_W - 8 - measureText(purse), 2, UI.accent);
  CHALLENGES.forEach((challenge, i) => {
    const y = 16 + i * LINE_HEIGHT;
    const done = isClaimed(run, challenge.id);
    drawText(ctx, challenge.label, 8, y, done ? UI.good : UI.text);
    const reward = done ? PROGRESS_OPEN_DONE : `${challenge.reward}`;
    drawText(ctx, reward, STAGE_W - 8 - measureText(reward), y, done ? UI.good : UI.accent);
  });
  drawTextCentered(ctx, `${keyLabel(input, "confirm", "e")} back`, STAGE_W / 2, STAGE_H - 12, UI.dim);
}

function drawControls(ctx: CanvasRenderingContext2D, run: RunState, input: Input): void {
  drawTextCentered(ctx, CONTROLS_TITLE, STAGE_W / 2, 6, UI.text);
  CONTROL_ROWS.filter((row) => !row.needsSeme || run.seme).forEach((row, i) => {
    const y = 20 + i * 10;
    drawText(ctx, row.keys, 104 - measureText(row.keys), y, UI.accent);
    drawText(ctx, row.does, 114, y, UI.text);
  });
  drawTextCentered(ctx, `${keyLabel(input, "confirm", "e")} back`, STAGE_W / 2, STAGE_H - 12, UI.dim);
}

export function drawPauseMenu(ctx: CanvasRenderingContext2D, menu: PauseMenu, items: MenuItem[], run: RunState, input: Input): void {
  ctx.globalAlpha = menu.page === "main" ? 0.9 : 0.95;
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.globalAlpha = 1;
  onStage(ctx, () => drawPage(ctx, menu, items, run, input));
}

function drawPage(ctx: CanvasRenderingContext2D, menu: PauseMenu, items: MenuItem[], run: RunState, input: Input): void {
  if (menu.page === "progress") {
    drawProgress(ctx, menu, run);
    return;
  }
  if (menu.page === "inventory") {
    drawInventory(ctx, menu, run, input);
    return;
  }
  if (menu.page === "challenges") {
    drawChallenges(ctx, run, input);
    return;
  }
  if (menu.page === "controls") {
    drawControls(ctx, run, input);
    return;
  }
  if (menu.page === "confirm") {
    drawTextCentered(ctx, PAUSE_CONFIRM, STAGE_W / 2, 48, UI.text);
    drawChoices(ctx, [PAUSE_NO, PAUSE_YES], menu.choice, 68);
    return;
  }
  const top = Math.round((STAGE_H - items.length * ROW_HEIGHT) / 2);
  drawTextCentered(ctx, PAUSE_TITLE, STAGE_W / 2, top - 18, UI.text);
  drawChoices(ctx, items.map((item) => item.label), menu.choice, top);
  drawTextCentered(ctx, `${keyLabel(input, "up", "arrowup")} ${keyLabel(input, "down", "arrowdown")} choose   ${keyLabel(input, "confirm", "e")} select   ${keyLabel(input, "mute", "m")} mute`, STAGE_W / 2, STAGE_H - 16, UI.dim);
}
