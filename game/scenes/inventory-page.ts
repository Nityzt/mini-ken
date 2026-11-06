import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import type { PauseMenu } from "../core/pause-menu.ts";
import { STAGE_H, STAGE_W } from "../core/scale.ts";
import { GRID_COLS, layoutGrid } from "../inventory-grid.ts";
import { durabilityOf, FULL_DURABILITY, WORN_AT } from "../durability.ts";
import { asShinai, gearKeyOf, inventoryGroups, inventoryOf, isUsable, isWearable, isWorn, itemInfo, itemKind, type ItemId } from "../items.ts";
import { moneyText } from "../money.ts";
import type { RunState } from "../run-state.ts";
import { DURABILITY_LABEL, HINT_BACK, HINT_MOVE, HINT_TAKE_OFF, HINT_USE, HINT_WEAR, HINT_WIELD, ITEM_IN_HAND, ITEM_PUT_AWAY, INVENTORY_EMPTY, ITEM_FIGHTS_ONLY, ITEM_NOT_WORN, ITEM_READY, ITEM_WORN } from "./content.ts";
import { drawItemAt } from "./item-card.ts";
import { drawCheck, drawCoin, drawHints } from "./ui.ts";

const SLOT = 18;
const PITCH = 20;
const GRID_X = 8;
const VIEW_TOP = 16;
const VIEW_BOTTOM = 126;
const HEADING_H = 10;
const GROUP_GAP = 4;
const CARD = { x: 134, y: 16, w: 114, h: 110 };
export const CARD_TEXT_WIDTH = CARD.w - 16;
/** The lines the card has room for under its picture: the name, then what it does. */
export const CARD_TEXT_LINES = 6;

const GROUP_COLORS: Record<string, string> = { Items: UI.accent, Gear: "#7FB2E5", Colors: "#B79AE6", Trophies: "#F0A868" };
const groupColor = (title: string): string => GROUP_COLORS[title.split(" ")[0]] ?? UI.accent;

function drawSlot(ctx: CanvasRenderingContext2D, item: ItemId | null, x: number, y: number, selected: boolean, run: RunState): void {
  ctx.fillStyle = selected ? UI.accent : UI.track;
  ctx.fillRect(x, y, SLOT, SLOT);
  ctx.fillStyle = selected ? "#3A3830" : UI.slot;
  ctx.fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2);
  if (!item) {
    drawTextCentered(ctx, "?", x + SLOT / 2, y + 5, UI.track);
    return;
  }
  drawItemAt(ctx, item, x + 1, y + 1, 1, run);
  if (isWorn(run, item)) drawCheck(ctx, x + SLOT - 7, y + SLOT - 7, UI.good);
  if (isUsable(item)) {
    ctx.fillStyle = UI.accent;
    ctx.fillRect(x + SLOT - 4, y + 1, 3, 3);
  }
}

function drawCard(ctx: CanvasRenderingContext2D, item: ItemId | null, color: string, run: RunState): void {
  ctx.fillStyle = UI.slot;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  if (!item) {
    drawTextCentered(ctx, INVENTORY_EMPTY, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2 - 4, UI.dim);
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(CARD.x, CARD.y, 3, CARD.h);
  ctx.fillStyle = UI.panel;
  ctx.fillRect(CARD.x + 8, CARD.y + 6, 36, 36);
  drawItemAt(ctx, item, CARD.x + 10, CARD.y + 8, 2, run);
  // Gear that can wear out needs one more row beside its picture, so everything moves up to make room.
  const gearKey = gearKeyOf(item);
  const top = gearKey ? CARD.y + 7 : CARD.y + 12;
  drawText(ctx, itemKind(item).toUpperCase(), CARD.x + 52, top, color);
  if (isWearable(item)) {
    const worn = isWorn(run, item);
    const status = asShinai(item) ? (worn ? ITEM_IN_HAND : ITEM_PUT_AWAY) : worn ? ITEM_WORN : item === "men" ? ITEM_FIGHTS_ONLY : ITEM_NOT_WORN;
    drawText(ctx, status, CARD.x + 52, top + 10, worn ? UI.good : UI.faint);
  } else if (isUsable(item)) drawText(ctx, ITEM_READY, CARD.x + 52, top + 10, UI.good);
  if (gearKey) {
    const left = durabilityOf(run, gearKey);
    const y = gearKey === "tare" || gearKey === "do" || gearKey === "kote" ? top + 10 : top + 20;
    drawText(ctx, DURABILITY_LABEL, CARD.x + 52, y, UI.dim);
    ctx.fillStyle = UI.track;
    ctx.fillRect(CARD.x + 52, y + 12, 34, 3);
    ctx.fillStyle = left <= WORN_AT ? UI.bad : UI.good;
    ctx.fillRect(CARD.x + 52, y + 12, Math.ceil((34 * left) / FULL_DURABILITY), 3);
    drawText(ctx, `${left}`, CARD.x + 89, y + 9, left <= WORN_AT ? UI.bad : UI.dim);
  }
  const { name, line } = itemInfo(item);
  const nameLines = wrapText(name, CARD_TEXT_WIDTH);
  nameLines.forEach((text, i) => drawText(ctx, text, CARD.x + 8, CARD.y + 48 + i * LINE_HEIGHT, UI.accent));
  wrapText(line, CARD_TEXT_WIDTH).forEach((text, i) => drawText(ctx, text, CARD.x + 8, CARD.y + 50 + (nameLines.length + i) * LINE_HEIGHT, UI.dim));
}

export function drawInventory(ctx: CanvasRenderingContext2D, menu: PauseMenu, run: RunState): void {
  drawText(ctx, "Inventory", GRID_X, 3, UI.accent);
  const purse = moneyText(run.money);
  drawText(ctx, purse, STAGE_W - 8 - measureText(purse), 3, UI.accent);
  drawCoin(ctx, STAGE_W - 8 - measureText(purse) - 10, 4);
  ctx.fillStyle = UI.track;
  ctx.fillRect(GRID_X, 13, STAGE_W - 16, 1);

  const groups = inventoryGroups(run);
  const held = inventoryOf(run);
  const picked = held.length ? Math.min(menu.choice, held.length - 1) : -1;
  const cells = layoutGrid(groups.map((group) => group.slots.length), groups.map((group) => group.slots.map(Boolean)));

  // Where each group starts, from the top of the page, so the page can scroll when there are many rows.
  const tops: number[] = [];
  let y = 0;
  groups.forEach((group) => {
    tops.push(y);
    y += HEADING_H + Math.ceil(group.slots.length / GRID_COLS) * PITCH + GROUP_GAP;
  });
  const total = y - GROUP_GAP;
  const at = cells.find((cell) => cell.index === picked);
  const slotTop = (cell: (typeof cells)[number]) => {
    const firstRow = Math.min(...cells.filter((c) => c.group === cell.group).map((c) => c.row));
    return tops[cell.group] + HEADING_H + (cell.row - firstRow) * PITCH;
  };
  const viewH = VIEW_BOTTOM - VIEW_TOP;
  let scroll = 0;
  if (at) {
    const firstRow = Math.min(...cells.filter((c) => c.group === at.group).map((c) => c.row));
    const top = at.row === firstRow ? tops[at.group] : slotTop(at);
    scroll = Math.max(0, slotTop(at) + SLOT - viewH);
    if (top < scroll) scroll = top;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, VIEW_TOP, GRID_X + GRID_COLS * PITCH + 6, viewH);
  ctx.clip();
  groups.forEach((group, g) => {
    const headingY = VIEW_TOP + tops[g] - scroll;
    ctx.fillStyle = groupColor(group.title);
    ctx.fillRect(GRID_X, headingY + 1, 2, 7);
    drawText(ctx, group.title, GRID_X + 5, headingY, UI.dim);
  });
  for (const cell of cells) {
    const item = groups[cell.group].slots[cell.slot];
    drawSlot(ctx, item, GRID_X + cell.col * PITCH, VIEW_TOP + slotTop(cell) - scroll, cell.index !== null && cell.index === picked, run);
  }
  ctx.restore();

  if (total > viewH) {
    const thumb = Math.max(6, Math.round((viewH * viewH) / total));
    ctx.fillStyle = UI.track;
    ctx.fillRect(GRID_X + GRID_COLS * PITCH + 3, VIEW_TOP, 2, viewH);
    ctx.fillStyle = UI.dim;
    ctx.fillRect(GRID_X + GRID_COLS * PITCH + 3, VIEW_TOP + Math.round(((viewH - thumb) * scroll) / (total - viewH)), 2, thumb);
  }

  const item = picked >= 0 ? held[picked] : null;
  drawCard(ctx, item, at ? groupColor(groups[at.group].title) : UI.accent, run);

  const act: [string, string][] = item && isUsable(item) ? [["E", HINT_USE]] : item && asShinai(item) ? (isWorn(run, item) ? [] : [["E", HINT_WIELD]]) : item && isWearable(item) ? [["E", isWorn(run, item) ? HINT_TAKE_OFF : HINT_WEAR]] : [];
  drawHints(ctx, [["<^v>", HINT_MOVE], ...act, ["X", HINT_BACK]], STAGE_H - 12, STAGE_W);
}
