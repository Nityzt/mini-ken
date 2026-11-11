/**
 * The inventory as an equipment screen: five slots beside your figure, and a pack below with
 * everything else. Pure, so moving the cursor and swapping gear can be tested without drawing.
 */
import { EQUIPMENT, equip, equipmentHeld, equipmentInfo, equippedAt, type EquipmentId, type EquipmentSlot } from "./equipment.ts";
import { layoutGrid, moveInGrid, type Cell, type SlotGroup } from "./inventory-grid.ts";
import { gearKeyOf, isColors, toggleWorn, type ItemId } from "./items.ts";
import { hasDungeonKey } from "./dungeon-story.ts";
import { hasLetter, hasTicket } from "./ranks.ts";
import { playerKiMax, type RunState } from "./run-state.ts";
import { isShopItem, type ShopItemId } from "./shop.ts";
import { CUP_IDS } from "./world/tournament.ts";

/** The slots, head to waist after the shinai, in the order they're drawn. */
export const SCREEN_SLOTS: EquipmentSlot[] = ["shinai", "men", "kote", "do", "tare"];
/** The slots row starts one column in, because your figure stands in the first. */
export const SLOTS_OFFSET = 1;

export type SlotCell = `slot:${EquipmentSlot}`;
/** Something the cursor can rest on: one of the equipment slots, or a thing in the pack. */
export type ScreenCell = SlotCell | ItemId;
export type ScreenKeys = { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean };
/** What E does on a cell, for the hints and the card as well as the step. */
export type ScreenDoes = "equip" | "swap" | "wear" | "take-off" | "use" | null;

export const slotOf = (cell: ScreenCell): EquipmentSlot | null => (cell.startsWith("slot:") ? (cell.slice("slot:".length) as EquipmentSlot) : null);

/** The pack's name for a piece of equipment: earned pieces go by their own name, bought ones as shop items. */
export const itemOfEquipment = (id: EquipmentId): ItemId => (isShopItem(id) ? `shop:${id as ShopItemId}` : (id as ItemId));

/** What sits in a slot right now, as an item, or nothing. */
export const inSlot = (run: RunState, slot: EquipmentSlot): ItemId | null => {
  const id = equippedAt(run, slot);
  return id ? itemOfEquipment(id) : null;
};

/** Everything you carry that isn't in a slot. Spare gear is grouped by slot; trophies keep a gap for each cup not won. */
export function packGroups(run: RunState): SlotGroup<ItemId>[] {
  const shopHeld = (run.owned.filter(isShopItem) as ShopItemId[]).map((id): ItemId => `shop:${id}`);
  const things: ItemId[] = [
    ...(hasTicket(run) ? (["ticket"] as const) : []),
    ...(hasLetter(run) ? (["letter"] as const) : []),
    ...(run.gi ? (["gi"] as const) : []),
    ...(run.hasTsuba ? (["tsuba"] as const) : []),
    ...(run.shinaiQuest === "gotBamboo" && !run.madeShinai ? (["bamboo"] as const) : []),
    ...(run.shinaiQuest === "returned" ? (["shinaiBag"] as const) : []),
    ...(hasDungeonKey(run) ? (["key"] as const) : []),
    ...shopHeld.filter((item) => !isColors(item) && !gearKeyOf(item)),
  ];
  const worn = new Set(SCREEN_SLOTS.map((slot) => equippedAt(run, slot)));
  const order = Object.keys(EQUIPMENT) as EquipmentId[];
  const spares = equipmentHeld(run)
    .filter((id) => !worn.has(id))
    .sort((a, b) => SCREEN_SLOTS.indexOf(equipmentInfo(a).slot) - SCREEN_SLOTS.indexOf(equipmentInfo(b).slot) || order.indexOf(a) - order.indexOf(b))
    .map(itemOfEquipment);
  const colors = shopHeld.filter(isColors);
  const trophies = CUP_IDS.map((cup): ItemId | null => (run.cups.includes(cup) ? `cup:${cup}` : null));
  return [
    { title: "Items", slots: things },
    { title: "Gear", slots: spares },
    { title: "Colors", slots: colors },
    { title: `Trophies ${trophies.filter(Boolean).length}/${trophies.length}`, slots: trophies },
  ].filter((group) => group.slots.length > 0);
}

/** Everything you carry, whether it's in a slot or in the pack. */
export const inventoryOf = (run: RunState): ItemId[] => [
  ...SCREEN_SLOTS.map((slot) => inSlot(run, slot)).filter((item): item is ItemId => item !== null),
  ...packGroups(run).flatMap((group) => group.slots.filter((item): item is ItemId => item !== null)),
];

/** The whole screen: the slots first (a gap for each slot not earned yet), then the pack. */
export function screenGroups(run: RunState): SlotGroup<ScreenCell>[] {
  const slots = SCREEN_SLOTS.map((slot): ScreenCell | null => (run.gear[slot] ? `slot:${slot}` : null));
  return [{ title: "Equipped", slots }, ...packGroups(run)];
}

/** Where everything sits on the screen's grid. */
export function screenLayout(run: RunState): { groups: SlotGroup<ScreenCell>[]; cells: Cell[] } {
  const groups = screenGroups(run);
  const cells = layoutGrid(groups.map((g) => g.slots.length), groups.map((g) => g.slots.map(Boolean)), undefined, [SLOTS_OFFSET]);
  return { groups, cells };
}

/** Everything the cursor can rest on, in the order it's numbered. */
export const cellsOf = (run: RunState): ScreenCell[] => screenGroups(run).flatMap((g) => g.slots.filter((cell): cell is ScreenCell => cell !== null));

/** Spare pieces in the pack that would fit this slot. */
const sparesFor = (run: RunState, slot: EquipmentSlot): ItemId[] =>
  packGroups(run).flatMap((g) => g.slots).filter((item): item is ItemId => {
    const key = item && gearKeyOf(item);
    return !!key && equipmentInfo(key).slot === slot;
  });

export function confirmDoes(run: RunState, cell: ScreenCell): ScreenDoes {
  const slot = slotOf(cell);
  if (slot) {
    // The men is the one piece you choose to keep on outside fights, so its slot puts it on and takes it off.
    if (slot === "men" && equippedAt(run, "men")) return run.menOn ? "take-off" : "wear";
    return sparesFor(run, slot).length ? "swap" : null;
  }
  const item = cell as ItemId;
  if (item === "ticket") return "use";
  const key = gearKeyOf(item);
  // Only a slot you've earned can take a piece, even one you've bought for it.
  if (key) return run.gear[equipmentInfo(key).slot] ? "equip" : null;
  if (isColors(item)) return run.look === item.slice("shop:".length) ? "take-off" : "wear";
  return null;
}

/**
 * What swapping this spare in would do to your ki, against what's in its slot now, or null where E wouldn't
 * equip it. Like a crafting game's tooltip, so you can see whether a piece is better before you put it on.
 */
export function equipKiChange(run: RunState, item: ItemId): number | null {
  const key = gearKeyOf(item);
  if (!key || confirmDoes(run, item) !== "equip" || equippedAt(run, equipmentInfo(key).slot) === key) return null;
  return playerKiMax(equip(run, key)) - playerKiMax(run);
}

/** One tick of the screen: move the cursor, and E does whatever the cell under it does. */
export function stepInventoryScreen(run: RunState, choice: number, keys: ScreenKeys): { run: RunState; choice: number; action: "use-ticket" | null } {
  const { cells } = screenLayout(run);
  const moved = moveInGrid(cells, choice, (keys.right ? 1 : 0) - (keys.left ? 1 : 0), (keys.down ? 1 : 0) - (keys.up ? 1 : 0));
  const list = cellsOf(run);
  const cell = list[moved];
  if (!keys.confirm || !cell) return { run, choice: moved, action: null };
  const does = confirmDoes(run, cell);
  const slot = slotOf(cell);
  if (does === "use") return { run, choice: moved, action: "use-ticket" };
  if (does === "swap" && slot) return { run, choice: list.indexOf(sparesFor(run, slot)[0]), action: null };
  if ((does === "wear" || does === "take-off") && slot) return { run: toggleWorn(run, inSlot(run, slot)!), choice: moved, action: null };
  if (does === "equip") {
    const key = gearKeyOf(cell as ItemId)!;
    const off = inSlot(run, equipmentInfo(key).slot);
    const next = equip(run, key);
    // What came off lands under the cursor, so swapping back is one more press.
    const after = cellsOf(next);
    const landed = off ? after.indexOf(off) : -1;
    return { run: next, choice: landed >= 0 ? landed : Math.min(moved, after.length - 1), action: null };
  }
  if (does === "wear" || does === "take-off") return { run: toggleWorn(run, cell as ItemId), choice: moved, action: null };
  return { run, choice: moved, action: null };
}
