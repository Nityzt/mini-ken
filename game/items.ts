import { equip, equippedAt, equipmentEffects, equipmentInfo, isEquipment, modOn, type EquipmentId } from "./equipment.ts";
import type { Gear } from "./art/kendoka.ts";
import { type GearKey, type ShinaiId } from "./durability.ts";
import { hasLetter, hasTicket, rankLabel } from "./ranks.ts";
import { isShopItem, LOOKS, SHOP_ITEMS, wear, type ShopItemId } from "./shop.ts";
import type { RunState } from "./run-state.ts";
import { BAMBOO_LINE, OWN_SHINAI_LINE, SHINAI_BAG_LINE, GAZE_ITEM_LINE, GEAR_LINES, GI_LINE, KEY_LINE, KEY_NAME, LETTER_LINE, RANK_LINE, SEME_ITEM_LINE, TICKET_LINE, TSUBA_FOUND } from "./scenes/content.ts";
import { hasDungeonKey } from "./dungeon-story.ts";
import { CUP_IDS, CUPS, type CupId } from "./world/tournament.ts";

export type ItemId = "gi" | keyof Gear | "tsuba" | "bamboo" | "ownShinai" | "shinaiBag" | "key" | "seme" | "gaze" | "ticket" | "letter" | `shop:${ShopItemId}` | `cup:${CupId}` | `rank:${string}`;
export type ItemInfo = { title: string; name: string; line: string };

const GEAR_ORDER: (keyof Gear)[] = ["shinai", "tare", "do", "men", "kote"];
const GEAR_NAMES: Record<keyof Gear, string> = { tare: "Tare", do: "Do", men: "Men", kote: "Kote", shinai: "Sensei's old shinai" };
const CUP_KI_LINE = "Your name goes on the board. Ki +15.";
const CHAMPION_LINE = "Every dojo in the land bows to you.";
const ITEM = "New item acquired";
const TECHNIQUE = "New technique learned";
const TROPHY = "Trophy won";
const RANK_UP = "Rank up";

export const ALL_ITEMS: ItemId[] = ["gi", ...GEAR_ORDER, "tsuba", "bamboo", "ownShinai", "shinaiBag", "key", "seme", "gaze", ...CUP_IDS.map((cup): ItemId => `cup:${cup}`), "rank:1st dan", "ticket", "letter", ...(Object.keys(SHOP_ITEMS) as ShopItemId[]).map((id): ItemId => `shop:${id}`)];

/** "Tare: guards the waist." becomes "Guards the waist.", because the card already shows the name. */
const withoutName = (line: string) => {
  const rest = line.slice(line.indexOf(": ") + 2);
  return rest[0].toUpperCase() + rest.slice(1);
};


export function itemInfo(id: ItemId): ItemInfo {
  if (id === "gi") return { title: ITEM, name: "Spare gi", line: GI_LINE };
  if (id === "tsuba") return { title: ITEM, name: "Lucky tsuba", line: TSUBA_FOUND };
  if (id === "bamboo") return { title: ITEM, name: "Length of bamboo", line: BAMBOO_LINE };
  if (id === "shinaiBag") return { title: ITEM, name: "Sensei's shinai bag", line: SHINAI_BAG_LINE };
  if (id === "ownShinai") return { title: ITEM, name: "Your own shinai", line: OWN_SHINAI_LINE };
  if (id === "key") return { title: ITEM, name: KEY_NAME, line: KEY_LINE };
  if (id === "seme") return { title: TECHNIQUE, name: "Seme", line: SEME_ITEM_LINE };
  if (id === "gaze") return { title: TECHNIQUE, name: "Far-mountain gaze", line: GAZE_ITEM_LINE };
  if (id.startsWith("shop:")) {
    const bought = SHOP_ITEMS[id.slice("shop:".length) as ShopItemId];
    const key = id.slice("shop:".length);
    return { title: ITEM, name: bought.name, line: isEquipment(key) ? equipmentEffects(key, equipmentInfo(key).premod ?? null) : bought.line };
  }
  if (id === "ticket") return { title: ITEM, name: "Grading ticket", line: TICKET_LINE };
  if (id === "letter") return { title: ITEM, name: "Letter of recommendation", line: LETTER_LINE };
  if (id.startsWith("rank:")) return { title: RANK_UP, name: id.slice("rank:".length), line: RANK_LINE };
  if (id.startsWith("cup:")) {
    const cup = id.slice("cup:".length) as CupId;
    return { title: TROPHY, name: CUPS[cup].name, line: cup === "grand" ? CHAMPION_LINE : CUP_KI_LINE };
  }
  const piece = id as keyof Gear;
  return { title: ITEM, name: GEAR_NAMES[piece], line: withoutName(GEAR_LINES[piece]) };
}

/** What the gear that can wear out is called, in a sentence. */
export const gearName = (key: GearKey): string => equipmentInfo(key).name;

/** Whatever this change of state just gave you. Anything you gain, by any route, gets its moment. */
export function itemsGained(before: RunState, after: RunState): ItemId[] {
  // Recovered belongings were already acquired before Ren confiscated them.
  if (before.dungeon?.escrow && !after.dungeon?.escrow) before = { ...before, ...before.dungeon.escrow };
  const gained: ItemId[] = [];
  if (after.gi && !before.gi) gained.push("gi");
  for (const piece of GEAR_ORDER) if (after.gear[piece] && !before.gear[piece]) gained.push(piece);
  if (after.hasTsuba && !before.hasTsuba) gained.push("tsuba");
  if (after.shinaiQuest === "gotBamboo" && before.shinaiQuest !== "gotBamboo") gained.push("bamboo");
  if (after.madeShinai && !before.madeShinai) gained.push("ownShinai");
  if (after.shinaiQuest === "returned" && before.shinaiQuest !== "returned") gained.push("shinaiBag");
  // Raiko hands it over once. Ren taking it with everything else, and giving it back, is no new find.
  if (hasDungeonKey(after) && before.dungeon?.stage === "locked") gained.push("key");
  if (after.seme && !before.seme) gained.push("seme");
  if (after.gaze && !before.gaze) gained.push("gaze");
  for (const cup of after.cups) if (!before.cups.includes(cup)) gained.push(`cup:${cup}`);
  if (after.ticket > before.ticket && hasTicket(after)) gained.push("ticket");
  if (after.letter > before.letter && hasLetter(after)) gained.push("letter");
  for (const id of after.owned) if (!before.owned.includes(id) && isShopItem(id)) gained.push(`shop:${id}`);
  if (rankLabel(after) !== rankLabel(before)) gained.push(`rank:${rankLabel(after)}`);
  return gained;
}

/** Colors you can buy are shown in those colors. Everything else is drawn as it is. */
export const itemIconColors = (item: ItemId): Record<string, string> | undefined => {
  const key = gearKeyOf(item);
  return key ? equipmentInfo(key).colors : isColors(item) ? LOOKS[item.slice("shop:".length) as ShopItemId] : undefined;
};

/** Inventory details include the installed mod and its current effect. */
export const inventoryDescription = (run: RunState, item: ItemId): string => {
  const key = gearKeyOf(item);
  if (!key) return itemInfo(item).line;
  return equipmentEffects(key, modOn(run, key));

};

/** Only some things do anything when you use them. */
export const isUsable = (item: ItemId): boolean => item === "ticket";
export const isColors = (item: ItemId): boolean => item.startsWith("shop:") && !!LOOKS[item.slice("shop:".length) as ShopItemId];
/** Which shinai this is, if it's one you can carry. */
export const asShinai = (item: ItemId): ShinaiId | null => {
  const key = gearKeyOf(item);
  return key && equipmentInfo(key).slot === "shinai" ? key as ShinaiId : null;
};
/** What this item is to the durability rules, if it can wear out at all. */
export const gearKeyOf = (item: ItemId): EquipmentId | null => {
  const key = item.startsWith("shop:") ? item.slice("shop:".length) : item;
  return isEquipment(key) ? key : null;
};
/** Equipment swaps its slot; colors and the visibility of your current men can be toggled. */
export const isWearable = (item: ItemId): boolean => isColors(item) || gearKeyOf(item) !== null;
export function isWorn(run: RunState, item: ItemId): boolean {
  const key = gearKeyOf(item);
  if (key) return equippedAt(run, equipmentInfo(key).slot) === key && (equipmentInfo(key).slot !== "men" || run.menOn);
  return isColors(item) && run.look === item.slice("shop:".length);
}
/** Gear always swaps, while your men visibility and cosmetic colors can be toggled. */
export function toggleWorn(run: RunState, item: ItemId): RunState {
  const key = gearKeyOf(item);
  if (key) {
    if (equipmentInfo(key).slot === "men" && equippedAt(run, "men") === key) return { ...run, menOn: !run.menOn };
    return equip(run, key);
  }
  return isColors(item) ? wear(run, item.slice("shop:".length) as ShopItemId) : run;
}

/** What the inventory page calls each kind of thing, for the card beside the grid. */
export function itemKind(item: ItemId): string {
  if (isColors(item)) return "Color";
  if (item.startsWith("cup:")) return "Trophy";
  if (item.startsWith("rank:")) return "Rank";
  if (item === "seme" || item === "gaze") return "Technique";
  if (gearKeyOf(item)) return "Gear";
  if (item === "gi" || item === "tare" || item === "do" || item === "men" || item === "kote" || item === "shinai") return "Gear";
  return "Item";
}

/** Long enough for the whole bounce, so the button you were already mashing can't skip it. */
export const REVEAL_MIN_TICKS = 60;
export type Reveal = { item: ItemId; tick: number };
export const createReveal = (item: ItemId): Reveal => ({ item, tick: 0 });
/** Something usable can be used right there, or kept for later with X. Everything else just waits for confirm. */
export function stepReveal(reveal: Reveal, confirm: boolean, cancel = false): { reveal: Reveal; done: boolean; use: boolean } {
  const ready = reveal.tick >= REVEAL_MIN_TICKS;
  const usable = isUsable(reveal.item);
  return {
    reveal: { ...reveal, tick: reveal.tick + 1 },
    done: ready && (confirm || (usable && cancel)),
    use: ready && usable && confirm,
  };
}

const DROP_HEIGHT = 36;
const DROP_TICKS = 24;
const BOUNCES = [
  { height: 14, ticks: 20 },
  { height: 5, ticks: 12 },
];

/** How far above its resting place the item is: it drops in, bounces twice, and settles. */
export function revealBounce(tick: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (tick < DROP_TICKS) return Math.round(-DROP_HEIGHT * (1 - (tick / DROP_TICKS) ** 2)) || 0;
  let at = tick - DROP_TICKS;
  for (const { height, ticks } of BOUNCES) {
    if (at < ticks) {
      const u = at / ticks;
      return Math.round(-height * 4 * u * (1 - u)) || 0;
    }
    at -= ticks;
  }
  return 0;
}
