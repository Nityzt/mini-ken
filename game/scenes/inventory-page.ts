import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { drawKendoka } from "../art/kendoka.ts";
import { UI } from "../art/palette.ts";
import { playerColors } from "../characters.ts";
import { keyLabel } from "../core/key-labels.ts";
import type { Input } from "../core/input.ts";
import type { PauseMenu } from "../core/pause-menu.ts";
import { STAGE_H, STAGE_W } from "../core/scale.ts";
import { durabilityOf, FULL_DURABILITY, WORN_AT } from "../durability.ts";
import { confirmDoes, equipKiChange, inSlot, screenLayout, slotOf, SCREEN_SLOTS, type ScreenCell, type ScreenDoes } from "../equipment-screen.ts";
import { equipmentInfo, modOn, type EquipmentSlot, type ModId } from "../equipment.ts";
import { GRID_COLS } from "../inventory-grid.ts";
import { asShinai, gearKeyOf, inventoryDescription, isColors, isUsable, isWorn, itemInfo, itemKind, type ItemId } from "../items.ts";
import { moneyText } from "../money.ts";
import { walkingGear, type RunState } from "../run-state.ts";
import {
  DURABILITY_LABEL, equipChangeLine, HINT_BACK, HINT_EQUIP, HINT_MOVE, HINT_SWAP, HINT_TAKE_OFF, HINT_USE, HINT_WEAR, INVENTORY_EMPTY, ITEM_FIGHTS_ONLY, ITEM_IN_HAND, ITEM_LOCKED,
  ITEM_NOT_WORN, ITEM_PUT_AWAY, ITEM_READY, ITEM_WORN, SLOT_EMPTY, SLOT_EMPTY_LINE,
} from "./content.ts";
import { drawItemAt } from "./item-card.ts";
import { drawCheck, drawCoin, drawHints } from "./ui.ts";

const SLOT = 18;
const PITCH = 20;
const GRID_X = 8;
/** The equipment row: your figure in the first column, then a slot for each piece. */
const FIGURE = { x: GRID_X, y: 16, w: SLOT, h: 22 };
const SLOTS_Y = 18;
const RULE_Y = 40;
/** The pack scrolls between these. */
const VIEW_TOP = 43;
const VIEW_BOTTOM = 126;
const HEADING_H = 10;
const GROUP_GAP = 4;
const CARD = { x: 134, y: 16, w: 114, h: 110 };
export const CARD_TEXT_WIDTH = CARD.w - 16;
/** The lines the card has room for under its picture: the name, then what it does. */
export const CARD_TEXT_LINES = 6;

const GROUP_COLORS: Record<string, string> = { Equipped: UI.text, Items: UI.accent, Gear: "#7FB2E5", Colors: "#B79AE6", Trophies: "#F0A868" };
const groupColor = (title: string): string => GROUP_COLORS[title.split(" ")[0]] ?? UI.accent;
/** A mod shows as a small mark in its piece's corner, one color for each kind. */
export const MOD_COLORS: Record<ModId, string> = { balancedGrip: UI.accent, softLining: "#DC9EB6", reinforced: "#7FB2E5" };

const DOES_LABEL: Record<Exclude<ScreenDoes, null>, string> = { equip: HINT_EQUIP, swap: HINT_SWAP, wear: HINT_WEAR, "take-off": HINT_TAKE_OFF, use: HINT_USE };

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = UI.faint;
  ctx.fillRect(x + 1, y, 3, 1);
  ctx.fillRect(x, y + 1, 1, 2);
  ctx.fillRect(x + 4, y + 1, 1, 2);
  ctx.fillRect(x, y + 3, 5, 3);
}

/** The marks gear carries on its slot: its mod in the top corner and, once it's taken some knocks, a durability bar. */
function drawGearMarks(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number, run: RunState): void {
  const key = gearKeyOf(item);
  if (!key) return;
  const mod = modOn(run, key);
  if (mod) {
    ctx.fillStyle = MOD_COLORS[mod];
    ctx.fillRect(x + 2, y + 2, 3, 3);
  }
  const left = durabilityOf(run, key);
  if (left < FULL_DURABILITY) {
    ctx.fillStyle = UI.panel;
    ctx.fillRect(x + 2, y + SLOT - 4, SLOT - 4, 2);
    ctx.fillStyle = left <= WORN_AT ? UI.bad : UI.good;
    ctx.fillRect(x + 2, y + SLOT - 4, Math.max(1, Math.ceil(((SLOT - 4) * left) / FULL_DURABILITY)), 2);
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, selected: boolean, inside = UI.slot): void {
  ctx.fillStyle = selected ? UI.accent : UI.track;
  ctx.fillRect(x, y, SLOT, SLOT);
  ctx.fillStyle = selected ? "#3A3830" : inside;
  ctx.fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2);
}

function drawGhost(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number, run: RunState, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  drawItemAt(ctx, item, x + 1, y + 1, 1, run);
  ctx.restore();
}

/** One of the five equipment slots. Earned and empty shows a faint outline of the piece; not earned is locked. */
function drawEquipSlot(ctx: CanvasRenderingContext2D, slot: EquipmentSlot, x: number, y: number, selected: boolean, run: RunState): void {
  if (!run.gear[slot]) {
    drawFrame(ctx, x, y, false, UI.panel);
    drawGhost(ctx, slot, x, y, run, 0.18);
    drawLock(ctx, x + SLOT - 8, y + SLOT - 9);
    return;
  }
  drawFrame(ctx, x, y, selected);
  const item = inSlot(run, slot);
  if (!item) {
    drawGhost(ctx, slot, x, y, run, 0.35);
    return;
  }
  // A men kept for fights only is drawn a little faded, so you can tell at a glance it isn't on.
  if (slot === "men" && !run.menOn) drawGhost(ctx, item, x, y, run, 0.55);
  else drawItemAt(ctx, item, x + 1, y + 1, 1, run);
  drawGearMarks(ctx, item, x, y, run);
}

function drawPackSlot(ctx: CanvasRenderingContext2D, item: ItemId | null, x: number, y: number, selected: boolean, run: RunState): void {
  drawFrame(ctx, x, y, selected);
  if (!item) {
    drawTextCentered(ctx, "?", x + SLOT / 2, y + 5, UI.track);
    return;
  }
  const key = gearKeyOf(item);
  const locked = !!key && !run.gear[equipmentInfo(key).slot];
  if (locked) drawGhost(ctx, item, x, y, run, 0.45);
  else drawItemAt(ctx, item, x + 1, y + 1, 1, run);
  drawGearMarks(ctx, item, x, y, run);
  if (locked) drawLock(ctx, x + SLOT - 8, y + SLOT - 9);
  if (isColors(item) && isWorn(run, item)) drawCheck(ctx, x + SLOT - 7, y + SLOT - 7, UI.good);
  if (isUsable(item)) {
    ctx.fillStyle = UI.accent;
    ctx.fillRect(x + SLOT - 4, y + 1, 3, 3);
  }
}

/** Where the piece is, in a word: in hand or worn when it's in a slot, put away when it's in the pack. */
function statusOf(run: RunState, cell: ScreenCell, item: ItemId): [string, string] | null {
  const key = gearKeyOf(item);
  if (key) {
    const slot = equipmentInfo(key).slot;
    if (!slotOf(cell)) return run.gear[slot] ? [asShinai(item) ? ITEM_PUT_AWAY : ITEM_NOT_WORN, UI.faint] : [ITEM_LOCKED, UI.bad];
    if (slot === "shinai") return [ITEM_IN_HAND, UI.good];
    return slot === "men" && !run.menOn ? [ITEM_FIGHTS_ONLY, UI.dim] : [ITEM_WORN, UI.good];
  }
  if (isColors(item)) return isWorn(run, item) ? [ITEM_WORN, UI.good] : [ITEM_NOT_WORN, UI.faint];
  if (isUsable(item)) return [ITEM_READY, UI.good];
  return null;
}

function drawCard(ctx: CanvasRenderingContext2D, cell: ScreenCell | null, color: string, run: RunState): void {
  ctx.fillStyle = UI.slot;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  if (!cell) {
    drawTextCentered(ctx, INVENTORY_EMPTY, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2 - 4, UI.dim);
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(CARD.x, CARD.y, 3, CARD.h);
  ctx.fillStyle = UI.panel;
  ctx.fillRect(CARD.x + 8, CARD.y + 6, 36, 36);
  const slot = slotOf(cell);
  const item = slot ? inSlot(run, slot) : (cell as ItemId);
  if (!item) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawItemAt(ctx, slot!, CARD.x + 10, CARD.y + 8, 2, run);
    ctx.restore();
    drawText(ctx, SLOT_EMPTY, CARD.x + 52, CARD.y + 12, UI.dim);
    wrapText(SLOT_EMPTY_LINE, CARD_TEXT_WIDTH).forEach((text, i) => drawText(ctx, text, CARD.x + 8, CARD.y + 50 + i * LINE_HEIGHT, UI.dim));
    return;
  }
  drawItemAt(ctx, item, CARD.x + 10, CARD.y + 8, 2, run);
  const gearKey = gearKeyOf(item);
  const mod = gearKey ? modOn(run, gearKey) : null;
  if (mod) {
    ctx.fillStyle = MOD_COLORS[mod];
    ctx.fillRect(CARD.x + 10, CARD.y + 8, 4, 4);
  }
  // Gear that can wear out needs one more row beside its picture, so everything moves up to make room.
  const top = gearKey ? CARD.y + 7 : CARD.y + 12;
  drawText(ctx, (slot ? `${slot} slot` : itemKind(item)).toUpperCase(), CARD.x + 52, top, color);
  const status = statusOf(run, cell, item);
  if (status) drawText(ctx, status[0], CARD.x + 52, top + 10, status[1]);
  if (gearKey) {
    const left = durabilityOf(run, gearKey);
    const y = top + 20;
    drawText(ctx, DURABILITY_LABEL, CARD.x + 52, y, UI.dim);
    ctx.fillStyle = UI.track;
    ctx.fillRect(CARD.x + 52, y + 12, 34, 3);
    ctx.fillStyle = left <= WORN_AT ? UI.bad : UI.good;
    ctx.fillRect(CARD.x + 52, y + 12, Math.ceil((34 * left) / FULL_DURABILITY), 3);
    drawText(ctx, `${left}`, CARD.x + 89, y + 9, left <= WORN_AT ? UI.bad : UI.dim);
  }
  const nameLines = wrapText(itemInfo(item).name, CARD_TEXT_WIDTH);
  nameLines.forEach((text, i) => drawText(ctx, text, CARD.x + 8, CARD.y + 48 + i * LINE_HEIGHT, UI.accent));
  wrapText(inventoryDescription(run, item), CARD_TEXT_WIDTH).forEach((text, i) => drawText(ctx, text, CARD.x + 8, CARD.y + 50 + (nameLines.length + i) * LINE_HEIGHT, UI.dim));
  const change = equipKiChange(run, item);
  if (change !== null) drawText(ctx, equipChangeLine(change), CARD.x + 8, CARD.y + CARD.h - 12, change > 0 ? UI.good : change < 0 ? UI.bad : UI.dim);
}

export function drawInventory(ctx: CanvasRenderingContext2D, menu: PauseMenu, run: RunState, input: Input): void {
  drawText(ctx, "Inventory", GRID_X, 3, UI.accent);
  const purse = moneyText(run.money);
  drawText(ctx, purse, STAGE_W - 8 - measureText(purse), 3, UI.accent);
  drawCoin(ctx, STAGE_W - 8 - measureText(purse) - 10, 4);
  ctx.fillStyle = UI.track;
  ctx.fillRect(GRID_X, 13, STAGE_W - 16, 1);

  const { groups, cells } = screenLayout(run);
  const picks = cells.filter((cell) => cell.index !== null).length;
  const picked = picks ? Math.min(menu.choice, picks - 1) : -1;
  const at = cells.find((cell) => cell.index === picked);

  // You, dressed in what's in the slots, with the slots beside you.
  ctx.fillStyle = UI.panel;
  ctx.fillRect(FIGURE.x, FIGURE.y, FIGURE.w, FIGURE.h);
  drawKendoka(ctx, FIGURE.x + 1, FIGURE.y + 1, "down", 0, walkingGear(run), { colors: playerColors(run) });
  for (const cell of cells.filter((c) => c.group === 0)) {
    drawEquipSlot(ctx, SCREEN_SLOTS[cell.slot], GRID_X + cell.col * PITCH, SLOTS_Y, cell.index !== null && cell.index === picked, run);
  }
  ctx.fillStyle = UI.track;
  ctx.fillRect(GRID_X, RULE_Y, GRID_COLS * PITCH - 2, 1);

  // The pack below: where each group starts, from the top of the pack, so it can scroll when there are many rows.
  const pack = cells.filter((cell) => cell.group > 0);
  const tops: number[] = [];
  let y = 0;
  groups.forEach((group, g) => {
    tops.push(y);
    if (g > 0) y += HEADING_H + Math.ceil(group.slots.length / GRID_COLS) * PITCH + GROUP_GAP;
  });
  const total = y - GROUP_GAP;
  const slotTop = (cell: (typeof cells)[number]) => {
    const firstRow = Math.min(...pack.filter((c) => c.group === cell.group).map((c) => c.row));
    return tops[cell.group] + HEADING_H + (cell.row - firstRow) * PITCH;
  };
  const viewH = VIEW_BOTTOM - VIEW_TOP;
  let scroll = 0;
  if (at && at.group > 0) {
    const firstRow = Math.min(...pack.filter((c) => c.group === at.group).map((c) => c.row));
    const top = at.row === firstRow ? tops[at.group] : slotTop(at);
    scroll = Math.max(0, slotTop(at) + SLOT - viewH);
    if (top < scroll) scroll = top;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, VIEW_TOP, GRID_X + GRID_COLS * PITCH + 6, viewH);
  ctx.clip();
  groups.forEach((group, g) => {
    if (g === 0) return;
    const headingY = VIEW_TOP + tops[g] - scroll;
    ctx.fillStyle = groupColor(group.title);
    ctx.fillRect(GRID_X, headingY + 1, 2, 7);
    drawText(ctx, group.title, GRID_X + 5, headingY, UI.dim);
  });
  for (const cell of pack) {
    const item = groups[cell.group].slots[cell.slot] as ItemId | null;
    drawPackSlot(ctx, item, GRID_X + cell.col * PITCH, VIEW_TOP + slotTop(cell) - scroll, cell.index !== null && cell.index === picked, run);
  }
  ctx.restore();

  if (total > viewH) {
    const thumb = Math.max(6, Math.round((viewH * viewH) / total));
    ctx.fillStyle = UI.track;
    ctx.fillRect(GRID_X + GRID_COLS * PITCH + 3, VIEW_TOP, 2, viewH);
    ctx.fillStyle = UI.dim;
    ctx.fillRect(GRID_X + GRID_COLS * PITCH + 3, VIEW_TOP + Math.round(((viewH - thumb) * scroll) / (total - viewH)), 2, thumb);
  }

  const cell = at ? groups[at.group].slots[at.slot] : null;
  drawCard(ctx, cell, at ? groupColor(groups[at.group].title) : UI.accent, run);

  const does = cell ? confirmDoes(run, cell) : null;
  const act: [string, string][] = does ? [[keyLabel(input, "confirm", "e"), DOES_LABEL[does]]] : [];
  drawHints(ctx, [["<^v>", HINT_MOVE], ...act, [keyLabel(input, "cancel", "x"), HINT_BACK]], STAGE_H - 12, STAGE_W);
}
