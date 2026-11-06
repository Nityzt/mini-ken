import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import type { MenuItem, PauseMenu } from "../core/pause-menu.ts";
import { onStage, STAGE_H, STAGE_W, viewH, viewW } from "../core/scale.ts";
import { inventoryOf, isUsable, isWearable, itemInfo } from "../items.ts";
import { CHALLENGES, isClaimed, moneyText } from "../money.ts";
import { ladderWindow, shortNeeds, standingLine, techniques, unmet } from "../progress.ts";
import type { RunState } from "../run-state.ts";
import { drawItem } from "./item-card.ts";
import { CHALLENGES_TITLE, CONTROL_ROWS, CONTROLS_TITLE, INVENTORY_EMPTY, INVENTORY_USE, INVENTORY_WEAR, PAUSE_BACK, PAUSE_CONFIRM, PAUSE_HELP, PAUSE_NO, PAUSE_TITLE, PAUSE_YES, PROGRESS_NONE, PROGRESS_OPEN_DONE, PROGRESS_OPEN } from "./content.ts";

const ROW_HEIGHT = 12;

function drawChoices(ctx: CanvasRenderingContext2D, labels: string[], choice: number, top: number): void {
  labels.forEach((label, i) => {
    const y = top + i * ROW_HEIGHT;
    const selected = i === choice;
    drawTextCentered(ctx, label, STAGE_W / 2, y, selected ? UI.accent : UI.dim);
    if (selected) drawText(ctx, ">", (STAGE_W - measureText(label)) / 2 - 10, y, UI.accent);
  });
}

function drawProgress(ctx: CanvasRenderingContext2D, run: RunState): void {
  drawText(ctx, standingLine(run), 8, 2, UI.accent);
  const known = techniques(run);
  drawText(ctx, known.length ? known.join(" ") : PROGRESS_NONE, 8, 11, UI.text);
  ladderWindow(run).forEach((unlock, i) => {
    const y = 22 + i * LINE_HEIGHT;
    const needs = unmet(run, unlock);
    const open = needs.length === 0;
    drawText(ctx, unlock.label, 8, y, open ? UI.text : UI.dim);
    const status = open ? PROGRESS_OPEN : shortNeeds(run, unlock);
    drawText(ctx, status, STAGE_W - 8 - measureText(status), y, open ? UI.good : UI.accent);
  });
  drawTextCentered(ctx, PAUSE_BACK, STAGE_W / 2, STAGE_H - 12, UI.dim);
}

const INVENTORY_ROWS = 11;
const INVENTORY_DETAIL_X = 118;

function drawInventory(ctx: CanvasRenderingContext2D, menu: PauseMenu, run: RunState): void {
  const held = inventoryOf(run);
  drawText(ctx, "Inventory", 8, 2, UI.accent);
  const purse = moneyText(run.money);
  drawText(ctx, purse, STAGE_W - 8 - measureText(purse), 2, UI.accent);
  if (!held.length) {
    drawTextCentered(ctx, INVENTORY_EMPTY, STAGE_W / 2, 60, UI.dim);
    drawTextCentered(ctx, PAUSE_BACK, STAGE_W / 2, STAGE_H - 12, UI.dim);
    return;
  }
  const at = Math.min(menu.choice, held.length - 1);
  const first = Math.max(0, Math.min(at - INVENTORY_ROWS + 1, held.length - INVENTORY_ROWS));
  held.slice(first, first + INVENTORY_ROWS).forEach((item, i) => {
    const selected = first + i === at;
    const y = 14 + i * LINE_HEIGHT;
    if (selected) drawText(ctx, ">", 8, y, UI.accent);
    drawText(ctx, itemInfo(item).name, 16, y, selected ? UI.accent : UI.text);
  });
  const item = held[at];
  const { name, line } = itemInfo(item);
  drawItem(ctx, item, 14, run);
  drawText(ctx, name, INVENTORY_DETAIL_X, 66, UI.accent);
  wrapText(line, STAGE_W - INVENTORY_DETAIL_X - 8).forEach((text, i) => drawText(ctx, text, INVENTORY_DETAIL_X, 77 + i * LINE_HEIGHT, UI.dim));
  drawTextCentered(ctx, isUsable(item) ? INVENTORY_USE : isWearable(item) ? INVENTORY_WEAR : "X back", STAGE_W / 2, STAGE_H - 12, UI.dim);
}

function drawChallenges(ctx: CanvasRenderingContext2D, run: RunState): void {
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
  drawTextCentered(ctx, PAUSE_BACK, STAGE_W / 2, STAGE_H - 12, UI.dim);
}

function drawControls(ctx: CanvasRenderingContext2D, run: RunState): void {
  drawTextCentered(ctx, CONTROLS_TITLE, STAGE_W / 2, 6, UI.text);
  CONTROL_ROWS.filter((row) => !row.needsSeme || run.seme).forEach((row, i) => {
    const y = 20 + i * 10;
    drawText(ctx, row.keys, 104 - measureText(row.keys), y, UI.accent);
    drawText(ctx, row.does, 114, y, UI.text);
  });
  drawTextCentered(ctx, PAUSE_BACK, STAGE_W / 2, STAGE_H - 12, UI.dim);
}

export function drawPauseMenu(ctx: CanvasRenderingContext2D, menu: PauseMenu, items: MenuItem[], run: RunState): void {
  ctx.globalAlpha = menu.page === "main" ? 0.9 : 0.95;
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.globalAlpha = 1;
  onStage(ctx, () => drawPage(ctx, menu, items, run));
}

function drawPage(ctx: CanvasRenderingContext2D, menu: PauseMenu, items: MenuItem[], run: RunState): void {
  if (menu.page === "progress") {
    drawProgress(ctx, run);
    return;
  }
  if (menu.page === "inventory") {
    drawInventory(ctx, menu, run);
    return;
  }
  if (menu.page === "challenges") {
    drawChallenges(ctx, run);
    return;
  }
  if (menu.page === "controls") {
    drawControls(ctx, run);
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
  drawTextCentered(ctx, PAUSE_HELP, STAGE_W / 2, STAGE_H - 16, UI.dim);
}
