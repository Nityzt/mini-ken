import { GOOSE_COLORS, HERON_COLORS, OTTER_COLORS, RACCOON_COLORS, RIVAL_COLORS } from "./art/palette.ts";
import { TEAM_COLORS } from "./art/looks.ts";
import type { RunState } from "./run-state.ts";

export type ShopItemId =
  | "fineShinai" | "deerKote" | "lacquerDo" | "inkColors"
  | "charm" | "festivalColors"
  | "ownColors" | "raccoonColors" | "gooseColors" | "heronColors" | "otterColors" | "radishColors"
  | "tideColors" | "coralColors" | "blossomColors" | "mossColors"
  | "copperColors" | "slateColors" | "mistColors" | "cascadeColors" | "lanternColors" | "bambooColors";
export type ShopItem = { name: string; price: number; line: string; icon: string; ki?: number };
export type StallId = "store" | "cup" | "pinecone" | "raccoon" | "goose" | "heron" | "otter" | "radish" | "beachShop" | "parkShop" | "steelShop" | "fallsShop" | "lantern" | "bamboo";

export const SHOP_ITEMS: Record<ShopItemId, ShopItem> = {
  fineShinai: { name: "Fine shinai", price: 80, line: "Well balanced, so swings tire you less. Ki +5.", icon: "iconShinai", ki: 5 },
  deerKote: { name: "Deerskin kote", price: 150, line: "Soft palms and a sure grip. Ki +5.", icon: "iconKote", ki: 5 },
  lacquerDo: { name: "Lacquered do", price: 300, line: "It rings when it's struck, and you stand taller in it. Ki +10.", icon: "iconDo", ki: 10 },
  inkColors: { name: "Ink armor", price: 120, line: "Black lacquer and black cords. Just for looks.", icon: "iconDo" },
  charm: { name: "Omamori charm", price: 60, line: "Tied inside your tare, for luck. Ki +3.", icon: "iconCharm", ki: 3 },
  festivalColors: { name: "Festival armor", price: 200, line: "Gold trim for big days. Just for looks.", icon: "iconDo" },
  ownColors: { name: "Your own colors", price: 40, line: "The armor you always pictured. Just for looks.", icon: "iconDo" },
  raccoonColors: { name: "Raccoon colors", price: 60, line: "Sleepy Raccoon's grey. Just for looks.", icon: "iconDo" },
  gooseColors: { name: "Goose colors", price: 60, line: "Angry Goose's orange trim. Just for looks.", icon: "iconDo" },
  heronColors: { name: "Heron colors", price: 60, line: "Iron Heron's blue. Just for looks.", icon: "iconDo" },
  otterColors: { name: "Otter colors", price: 60, line: "Soggy Otter's brown. Just for looks.", icon: "iconDo" },
  radishColors: { name: "Radish colors", price: 60, line: "Thunder Radish's dark red. Just for looks.", icon: "iconDo" },
  tideColors: { name: "Tide armor", price: 90, line: "Blue-green like the shallows. Just for looks.", icon: "iconDo" },
  coralColors: { name: "Coral armor", price: 110, line: "Warm pink in the lakeside sun. Just for looks.", icon: "iconDo" },
  blossomColors: { name: "Blossom armor", price: 100, line: "Cherry-petal pink. Just for looks.", icon: "iconDo" },
  mossColors: { name: "Moss armor", price: 85, line: "Soft green from a shady path. Just for looks.", icon: "iconDo" },
  copperColors: { name: "Copper armor", price: 110, line: "Bright as the foundry's old roof. Just for looks.", icon: "iconDo" },
  slateColors: { name: "Slate armor", price: 95, line: "Cool grey with a blue sheen. Just for looks.", icon: "iconDo" },
  mistColors: { name: "Mist armor", price: 100, line: "Pale blue like the spray. Just for looks.", icon: "iconDo" },
  cascadeColors: { name: "Cascade armor", price: 125, line: "Deep water blue. Just for looks.", icon: "iconDo" },
  lanternColors: { name: "Lantern colors", price: 60, line: "A warm lantern glow. Just for looks.", icon: "iconDo" },
  bambooColors: { name: "Bamboo colors", price: 60, line: "Fresh bamboo green. Just for looks.", icon: "iconDo" },
};

export const OWN_COLORS: ShopItemId = "ownColors";
/** Armor colors, worn over your dojo's. Wearing them changes nothing but how you look. */
export const LOOKS: Partial<Record<ShopItemId, Record<string, string>>> = {
  inkColors: { I: "#26262C", i: "#4A4A55", N: "#101014" },
  festivalColors: { I: "#8A6A1E", i: "#E6C46A", N: "#463410" },
  // Whatever suits whoever's wearing it. See `playerColors`.
  ownColors: {},
  raccoonColors: RACCOON_COLORS,
  gooseColors: GOOSE_COLORS,
  heronColors: HERON_COLORS,
  otterColors: OTTER_COLORS,
  radishColors: RIVAL_COLORS,
  tideColors: { I: "#286A73", i: "#66A9A5", N: "#17414B" },
  coralColors: { I: "#9A4652", i: "#D78380", N: "#582B37" },
  blossomColors: { I: "#92566F", i: "#DC9EB6", N: "#593247" },
  mossColors: { I: "#4C6C43", i: "#8FAA6E", N: "#2C432E" },
  copperColors: { I: "#9A542D", i: "#D89A60", N: "#5A3020" },
  slateColors: { I: "#515F70", i: "#94A3B2", N: "#303B49" },
  mistColors: { I: "#628A9B", i: "#A8CFD9", N: "#385768" },
  cascadeColors: { I: "#285688", i: "#719DCC", N: "#183557" },
  lanternColors: TEAM_COLORS.lantern!,
  bambooColors: TEAM_COLORS.bamboo!,
};

/** What's on sale where. A new stall is one more row here. */
export const STALLS: Record<StallId, ShopItemId[]> = {
  store: ["fineShinai", "deerKote", "lacquerDo", "inkColors"],
  cup: ["charm", "festivalColors"],
  pinecone: ["ownColors"],
  raccoon: ["raccoonColors"],
  goose: ["gooseColors"],
  heron: ["heronColors"],
  otter: ["otterColors"],
  radish: ["radishColors"],
  beachShop: ["tideColors", "coralColors"],
  parkShop: ["blossomColors", "mossColors"],
  steelShop: ["copperColors", "slateColors"],
  fallsShop: ["mistColors", "cascadeColors"],
  lantern: ["lanternColors"],
  bamboo: ["bambooColors"],
};

export const isShopItem = (id: string): id is ShopItemId => Object.hasOwn(SHOP_ITEMS, id);
export const owns = (run: RunState, id: ShopItemId): boolean => run.owned.includes(id);
export const hasFine = (run: RunState): boolean => owns(run, "fineShinai");
export const canBuy = (run: RunState, id: ShopItemId): boolean => !owns(run, id) && run.money >= SHOP_ITEMS[id].price;

/** Takes the money and hands it over. New colors go on straight away. */
export function buy(run: RunState, id: ShopItemId): RunState {
  if (!canBuy(run, id)) return run;
  return { ...run, money: run.money - SHOP_ITEMS[id].price, owned: [...run.owned, id], look: LOOKS[id] ? id : run.look };
}

/** Puts on colors you own, or takes them off if you're already wearing them. */
export function wear(run: RunState, id: ShopItemId): RunState {
  if (!owns(run, id) || !LOOKS[id]) return run;
  return { ...run, look: run.look === id ? "" : id };
}

export const shopKi = (run: RunState): number => run.owned.reduce((sum, id) => sum + (isShopItem(id) ? SHOP_ITEMS[id].ki ?? 0 : 0), 0);
