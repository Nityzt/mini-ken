import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { drawTare, TARE_ART_HEIGHT, TARE_ART_WIDTH } from "../art/insignia.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { spriteFor } from "../art/sprite.ts";
import { TILE, TILE_GRIDS } from "../art/tiles.ts";
import { playerColors } from "../characters.ts";
import { onStage, STAGE_H, STAGE_W } from "../core/scale.ts";
import { itemIconColors, isUsable, itemInfo, REVEAL_MIN_TICKS, revealBounce, type ItemId, type Reveal } from "../items.ts";
import type { RunState } from "../run-state.ts";
import { SHOP_ITEMS, type ShopItemId } from "../shop.ts";
import { CARD_KEEP, CARD_TRAVEL } from "./content.ts";
import { dimScreen, drawKeycap } from "./ui.ts";

const ICON_SCALE = 3;
const ICON_REST_Y = 36;
const ICONS: Partial<Record<ItemId, string>> = { gi: "iconGi", do: "iconDo", men: "iconMen", kote: "iconKote", shinai: "iconShinai", ownShinai: "iconShinai", bamboo: "iconBamboo", shinaiBag: "iconBag", tsuba: "tsuba", seme: "iconSeme", gaze: "iconGaze", ticket: "iconTicket", letter: "iconLetter" };

/** A key and what it does, side by side. Returns how wide it came out. */
function drawCardHint(ctx: CanvasRenderingContext2D, key: string, label: string, x: number, y: number): number {
  const cap = drawKeycap(ctx, key, x, y);
  drawText(ctx, label, x + cap + 3, y + 1, UI.text);
  return cap + 3 + measureText(label);
}

export function drawItem(ctx: CanvasRenderingContext2D, item: ItemId, y: number, run: RunState): void {
  drawItemAt(ctx, item, Math.round((STAGE_W - TILE * ICON_SCALE) / 2), y, ICON_SCALE, run);
}

/** An item's picture with its top-left corner at x and y, `scale` times the size of a tile. */
export function drawItemAt(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number, scale: number, run: RunState): void {
  const size = TILE * scale;
  // Your tare is drawn with your own design when there's room for it. In a small slot it's the plain icon.
  if (item === "tare" && scale > 1) {
    const art = scale - 1;
    drawTare(ctx, x + Math.round((size - TARE_ART_WIDTH * art) / 2), y + Math.round((size - TARE_ART_HEIGHT * art) / 2), art, run.insignia, playerColors(run));
    return;
  }
  const icon = item === "tare" ? "iconTare" : item.startsWith("rank:") ? "iconRank" : item.startsWith("shop:") ? SHOP_ITEMS[item.slice("shop:".length) as ShopItemId].icon : (ICONS[item] ?? "iconCup");
  // Your men is drawn as your own, the same as your tare.
  const sprite = spriteFor(TILE_GRIDS[icon], item === "men" ? playerColors(run) : itemIconColors(item));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, size, size);
}

/** Everything else stops, the screen goes dark, and what you've earned bounces into the middle. */
export function drawItemCard(ctx: CanvasRenderingContext2D, reveal: Reveal, run: RunState, reducedMotion: boolean): void {
  dimScreen(ctx, 0.9);
  onStage(ctx, () => drawCard(ctx, reveal, run, reducedMotion));
}

function drawCard(ctx: CanvasRenderingContext2D, reveal: Reveal, run: RunState, reducedMotion: boolean): void {
  const { tick, item } = reveal;
  const info = itemInfo(item);
  const center = STAGE_W / 2;
  const floor = ICON_REST_Y + TILE * ICON_SCALE;

  // Light gathers under it as it lands.
  const bounce = revealBounce(tick, reducedMotion);
  const shadow = Math.max(8, 34 + bounce);
  ctx.fillStyle = UI.faint;
  ctx.fillRect(Math.round(center - shadow / 2), floor + 1, shadow, 2);
  if (!reducedMotion) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + tick / 40;
      const reach = 34 + ((tick + i * 7) % 16);
      ctx.fillStyle = i % 2 ? UI.accent : UI.text;
      ctx.fillRect(Math.round(center + Math.cos(angle) * reach), Math.round(ICON_REST_Y + 24 + Math.sin(angle) * reach * 0.6), 2, 2);
    }
  }
  drawItem(ctx, item, ICON_REST_Y + bounce, run);

  const titleWidth = measureText(info.title.toUpperCase()) * 2;
  const titleX = Math.round((STAGE_W - titleWidth) / 2);
  drawText(ctx, info.title.toUpperCase(), titleX + 1, 13, PALETTE.r, 2);
  drawText(ctx, info.title.toUpperCase(), titleX, 12, UI.accent, 2);
  drawTextCentered(ctx, info.name, center, floor + 7, UI.text);
  wrapText(info.line, STAGE_W - 24).forEach((line, i) => drawTextCentered(ctx, line, center, floor + 18 + i * LINE_HEIGHT, UI.dim));
  if (tick >= REVEAL_MIN_TICKS) {
    const y = STAGE_H - 12;
    if (isUsable(item)) {
      const width = measureText("E") + 8 + measureText(CARD_TRAVEL) + 14 + measureText("X") + 8 + measureText(CARD_KEEP);
      const x = Math.round(center - width / 2);
      const first = drawCardHint(ctx, "E", CARD_TRAVEL, x, y);
      drawCardHint(ctx, "X", CARD_KEEP, x + first + 14, y);
    } else {
      const label = "Continue";
      drawCardHint(ctx, "E", label, Math.round(center - (measureText("E") + 8 + measureText(label)) / 2), y);
    }
  }
}
