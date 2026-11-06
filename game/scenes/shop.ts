import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_H, STAGE_W } from "../core/scale.ts";
import type { Game } from "../core/scene.ts";
import { moneyText } from "../money.ts";
import { buy, canBuy, LOOKS, owns, SHOP_ITEMS, STALLS, wear, type StallId } from "../shop.ts";
import { SHOP_HELP, SHOP_OWNED, SHOP_TITLES, SHOP_WORN } from "./content.ts";
import { dimScreen } from "./ui.ts";

export type ShopOverlay = {
  readonly active: boolean;
  open(stall: StallId): void;
  update(game: Game): void;
  render(ctx: CanvasRenderingContext2D, game: Game): void;
};

/** Any stall: the store, a dojo's merch table, or the one at a tournament. It sits over whatever scene you're in. */
export function createShop(): ShopOverlay {
  let stall: StallId | null = null;
  let at = 0;
  return {
    get active() {
      return stall !== null;
    },
    open(next) {
      stall = next;
      at = 0;
    },
    update(game) {
      if (!stall) return;
      const { input } = game;
      const stock = STALLS[stall];
      if (input.wasPressed("cancel")) {
        stall = null;
        return;
      }
      if (input.wasPressed("up")) at = (at + stock.length - 1) % stock.length;
      if (input.wasPressed("down")) at = (at + 1) % stock.length;
      if (!input.wasPressed("confirm")) return;
      const id = stock[at];
      if (owns(game.run, id)) {
        game.run = wear(game.run, id);
      } else if (canBuy(game.run, id)) {
        game.run = buy(game.run, id);
        game.audio.play("secret");
      } else game.audio.play("blocked");
    },
    render(ctx, game) {
      if (!stall) return;
      const stock = STALLS[stall];
      const title = SHOP_TITLES[stall];
      onGui(ctx, () => {
        dimScreen(ctx, 0.9);
        onStage(ctx, () => {
          drawText(ctx, title, 8, 6, UI.accent);
          const purse = moneyText(game.run.money);
          drawText(ctx, purse, STAGE_W - 8 - measureText(purse), 6, UI.accent);
          stock.forEach((id, i) => {
            const y = 22 + i * LINE_HEIGHT;
            const selected = i === at;
            const item = SHOP_ITEMS[id];
            if (selected) drawText(ctx, ">", 8, y, UI.accent);
            drawText(ctx, item.name, 16, y, selected ? UI.accent : UI.text);
            const mine = owns(game.run, id);
            const status = !mine ? `${item.price}` : LOOKS[id] && game.run.look === id ? SHOP_WORN : SHOP_OWNED;
            drawText(ctx, status, STAGE_W - 8 - measureText(status), y, mine ? UI.good : game.run.money >= item.price ? UI.accent : UI.bad);
          });
          wrapText(SHOP_ITEMS[stock[at]].line, STAGE_W - 16).forEach((line, i) => drawText(ctx, line, 8, 92 + i * LINE_HEIGHT, UI.dim));
          drawTextCentered(ctx, SHOP_HELP, STAGE_W / 2, STAGE_H - 12, UI.dim);
        });
      });
    },
  };
}
