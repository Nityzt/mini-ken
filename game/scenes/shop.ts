import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_H, STAGE_W } from "../core/scale.ts";
import type { Game } from "../core/scene.ts";
import { EQUIPMENT, GEAR_KI_CAP, MODS, canModify, equipmentKiUncapped, equip, equippedAt, equipmentDescription, equipmentHeld, isEquipment, modify, modOn, type EquipmentId } from "../equipment.ts";
import { moneyText } from "../money.ts";
import { buy, canBuy, LOOKS, MOD_STALLS, owns, SHOP_ITEMS, STALLS, wear, type StallId } from "../shop.ts";
import { SHOP_OWNED, SHOP_TITLES, SHOP_WORN } from "./content.ts";
import { dimScreen } from "./ui.ts";

export type ShopOverlay = {
  readonly active: boolean;
  open(stall: StallId): void;
  update(game: Game): void;
  render(ctx: CanvasRenderingContext2D, game: Game): void;
};

const VISIBLE_ROWS = 5;
/** Keeps the selected stock row visible without allowing descriptions to collide with the list. */
export const shopWindow = (length: number, selected: number): { start: number; end: number } => {
  const start = Math.max(0, Math.min(selected - VISIBLE_ROWS + 1, length - VISIBLE_ROWS));
  return { start, end: Math.min(length, start + VISIBLE_ROWS) };
};

/** How much of the gear cap your selected pieces fill. Anything past it is shown, but adds nothing. */
export const gearKiText = (ki: number): string => `Gear ki ${Math.min(ki, GEAR_KI_CAP)}/${GEAR_KI_CAP}${ki >= GEAR_KI_CAP ? " (full)" : ""}`;

/** Each stall has shelves and a workbench. A fitted mod replaces the previous one on that piece. */
export function createShop(): ShopOverlay {
  let stall: StallId | null = null;
  let at = 0;
  let tab: "browse" | "modify" = "browse";
  let target: EquipmentId | null = null;
  let notice = "";
  const targets = (game: Game) => equipmentHeld(game.run).filter((id) => MOD_STALLS[stall!].some((mod) => MODS[mod].slots.includes(EQUIPMENT[id].slot)));
  const modsFor = (id: EquipmentId) => MOD_STALLS[stall!].filter((mod) => MODS[mod].slots.includes(EQUIPMENT[id].slot));
  return {
    get active() { return stall !== null; },
    open(next) {
      stall = next;
      at = 0;
      tab = "browse";
      target = null;
      notice = "";
    },
    update(game) {
      if (!stall) return;
      const { input } = game;
      if (input.wasPressed("cancel")) {
        if (target) { target = null; at = 0; notice = ""; }
        else stall = null;
        return;
      }
      if (input.wasPressed("left") || input.wasPressed("right")) {
        tab = tab === "browse" ? "modify" : "browse";
        target = null;
        at = 0;
        notice = "";
        return;
      }
      const stock = STALLS[stall];
      const held = targets(game);
      const mods = target ? modsFor(target) : [];
      const length = tab === "browse" ? stock.length : target ? mods.length : held.length;
      if (!length) return;
      if (input.wasPressed("up")) { at = (at + length - 1) % length; notice = ""; }
      if (input.wasPressed("down")) { at = (at + 1) % length; notice = ""; }
      if (!input.wasPressed("confirm")) return;
      if (tab === "modify") {
        if (!target) { target = held[at]; at = 0; notice = ""; return; }
        const mod = mods[at];
        if (canModify(game.run, target, mod)) {
          game.run = modify(game.run, target, mod);
          notice = `Fitted ${MODS[mod].name}.`;
          game.audio.play("secret");
        } else { notice = modOn(game.run, target) === mod ? "Already fitted." : "Not enough kensen."; game.audio.play("blocked"); }
        return;
      }
      const id = stock[at];
      if (owns(game.run, id)) game.run = isEquipment(id) ? equip(game.run, id) : wear(game.run, id);
      else if (canBuy(game.run, id)) {
        game.run = buy(game.run, id);
        game.audio.play("secret");
        // Its card comes up straight away, over the shelves, rather than waiting for you to walk out.
        game.showCards(() => {});
      }
      else game.audio.play("blocked");
    },
    render(ctx, game) {
      if (!stall) return;
      const stock = STALLS[stall];
      const held = targets(game);
      const mods = target ? modsFor(target) : [];
      const rows = tab === "browse" ? stock.map((id) => {
        const item = SHOP_ITEMS[id];
        const mine = owns(game.run, id);
        const selected = isEquipment(id) ? equippedAt(game.run, EQUIPMENT[id].slot) === id : !!LOOKS[id] && game.run.look === id;
        return { name: item.name, status: mine ? selected ? SHOP_WORN : SHOP_OWNED : `${item.price}`, good: mine, line: isEquipment(id) && mine ? equipmentDescription(game.run, id) : item.line };
      }) : target ? mods.map((id) => ({ name: MODS[id].name, status: modOn(game.run, target!) === id ? "Fitted" : `${MODS[id].price}`, good: modOn(game.run, target!) === id, line: MODS[id].line })) : held.map((id) => ({ name: EQUIPMENT[id].name, status: modOn(game.run, id) ? "Modded" : "Plain", good: true, line: equipmentDescription(game.run, id) }));
      const picked = Math.min(at, Math.max(0, rows.length - 1));
      const { start, end } = shopWindow(rows.length, picked);
      onGui(ctx, () => {
        dimScreen(ctx, 0.9);
        onStage(ctx, () => {
          drawText(ctx, SHOP_TITLES[stall!], 8, 6, UI.accent);
          const purse = moneyText(game.run.money);
          drawText(ctx, purse, STAGE_W - 8 - measureText(purse), 6, UI.accent);
          drawText(ctx, tab === "browse" ? "< BROWSE >   Modify" : "Browse   < MODIFY >", 8, 20, UI.accent);
          rows.slice(start, end).forEach((row, i) => {
            const y = 35 + i * LINE_HEIGHT;
            const selected = start + i === picked;
            if (selected) drawText(ctx, ">", 8, y, UI.accent);
            drawText(ctx, row.name, 16, y, selected ? UI.accent : UI.text);
            drawText(ctx, row.status, STAGE_W - 8 - measureText(row.status), y, row.good ? UI.good : UI.dim);
          });
          if (rows.length > VISIBLE_ROWS) drawText(ctx, `${picked + 1}/${rows.length}`, STAGE_W - 30, 84, UI.faint);
          const installed = target ? modOn(game.run, target) : null;
          if (target) drawText(ctx, `${EQUIPMENT[target].name}: ${installed ? MODS[installed].name : "no mod"}`, 8, 84, UI.faint);
          // Gear ki stops at the cap, so say so before anyone pays for ki they can't use.
          else drawText(ctx, gearKiText(equipmentKiUncapped(game.run)), 8, 84, UI.faint);
          const line = notice || (rows.length ? `${rows[picked].line}${target ? " Replaces current mod." : ""}` : "No compatible gear. Buy or earn equipment first.");
          wrapText(line, STAGE_W - 16).slice(0, 4).forEach((text, i) => drawText(ctx, text, 8, 94 + i * LINE_HEIGHT, UI.dim));
          const help = target ? "E fit mod   X back   Left/right tabs" : tab === "browse" ? "E buy or equip   X leave   Left/right tabs" : "E choose gear   X leave   Left/right tabs";
          drawTextCentered(ctx, help, STAGE_W / 2, STAGE_H - 10, UI.dim);
        });
      });
    },
  };
}
