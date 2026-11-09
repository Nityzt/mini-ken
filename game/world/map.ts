import type { BrawlSpec } from "../duel/brawl.ts";

export type NodeId =
  | "pinecone" | "crossroads" | "market" | "store" | "ravine" | "stop" | "tower" | "bridge" | "wharf" | "radish" | "station"
  | "beachStop" | "beachStrip" | "boardwalk" | "goose" | "beachShop" | "beachGarden" | "lantern"
  | "parkStop" | "cherryWalk" | "picnic" | "raccoon" | "parkShop" | "parkGrove" | "bamboo"
  | "steelStation" | "millRow" | "foundry" | "heron" | "steelShop" | "steelAlley"
  | "fallsStation" | "lookout" | "gorge" | "otter" | "fallsShop" | "fallsPool"
  | "arenaStation" | "grandArena";
export type Direction = "left" | "right" | "up" | "down";
/** Each district is its own map. Streetcars and trains are the only way between them. */
export type District = "downtown" | "beach" | "park" | "steel" | "falls" | "arena";
export const DISTRICTS: District[] = ["downtown", "beach", "park", "steel", "falls", "arena"];
export type WorldNode = { name: string; kind: "dojo" | "path" | "gang" | "tower" | "stop" | "station" | "master" | "tournament" | "store"; district: District; x: number; y: number };
export type Edge = { from: NodeId; to: NodeId; dir: Direction; requires?: NodeId };

export const DIRECTIONS: Direction[] = ["left", "right", "up", "down"];
const OPPOSITE: Record<Direction, Direction> = { left: "right", right: "left", up: "down", down: "up" };

/** How tall the tower stands above its base, in game pixels. */
export const TOWER_HEIGHT = 50;

/** A lakeside city: the main road runs east to west, with the waterfront to the south. */
export const NODES: Record<NodeId, WorldNode> = {
  pinecone: { name: "Pinecone Dojo", kind: "dojo", district: "downtown", x: 30, y: 60 },
  crossroads: { name: "Downtown Crossing", kind: "path", district: "downtown", x: 92, y: 60 },
  market: { name: "Market Street", kind: "gang", district: "downtown", x: 92, y: 36 },
  store: { name: "Bogu Shop", kind: "store", district: "downtown", x: 58, y: 30 },
  ravine: { name: "Ravine Trail", kind: "master", district: "downtown", x: 168, y: 32 },
  stop: { name: "Lakeshore Stop", kind: "stop", district: "downtown", x: 92, y: 110 },
  tower: { name: "The Tower", kind: "tower", district: "downtown", x: 122, y: 116 },
  bridge: { name: "The Viaduct", kind: "gang", district: "downtown", x: 168, y: 60 },
  wharf: { name: "The Harbour", kind: "gang", district: "downtown", x: 168, y: 116 },
  radish: { name: "Thunder Radish Dojo", kind: "dojo", district: "downtown", x: 226, y: 60 },
  station: { name: "Central Station", kind: "station", district: "downtown", x: 216, y: 108 },
  beachStop: { name: "Beach Stop", kind: "stop", district: "beach", x: 36, y: 60 },
  beachStrip: { name: "Beach Strip", kind: "path", district: "beach", x: 120, y: 60 },
  boardwalk: { name: "The Boardwalk", kind: "gang", district: "beach", x: 120, y: 102 },
  goose: { name: "Angry Goose Dojo", kind: "dojo", district: "beach", x: 210, y: 60 },
  beachShop: { name: "Shell Market", kind: "store", district: "beach", x: 120, y: 30 },
  beachGarden: { name: "Dune Garden", kind: "path", district: "beach", x: 58, y: 30 },
  lantern: { name: "Lantern Dojo", kind: "dojo", district: "beach", x: 210, y: 30 },
  parkStop: { name: "Park Stop", kind: "stop", district: "park", x: 36, y: 60 },
  cherryWalk: { name: "Cherry Walk", kind: "path", district: "park", x: 120, y: 60 },
  picnic: { name: "Picnic Grounds", kind: "gang", district: "park", x: 120, y: 104 },
  raccoon: { name: "Sleepy Raccoon Dojo", kind: "dojo", district: "park", x: 210, y: 60 },
  parkShop: { name: "Blossom Shop", kind: "store", district: "park", x: 120, y: 30 },
  parkGrove: { name: "Quiet Grove", kind: "path", district: "park", x: 58, y: 30 },
  bamboo: { name: "Bamboo Dojo", kind: "dojo", district: "park", x: 210, y: 30 },
  steelStation: { name: "Steel Bay Station", kind: "station", district: "steel", x: 36, y: 76 },
  millRow: { name: "Mill Row", kind: "path", district: "steel", x: 116, y: 76 },
  foundry: { name: "The Foundry", kind: "gang", district: "steel", x: 116, y: 112 },
  heron: { name: "Iron Heron Dojo", kind: "dojo", district: "steel", x: 206, y: 76 },
  steelShop: { name: "Forge Shop", kind: "store", district: "steel", x: 116, y: 38 },
  steelAlley: { name: "Foundry Alley", kind: "path", district: "steel", x: 60, y: 38 },
  fallsStation: { name: "Misty Falls Station", kind: "station", district: "falls", x: 36, y: 104 },
  lookout: { name: "The Lookout", kind: "path", district: "falls", x: 110, y: 104 },
  gorge: { name: "The Gorge", kind: "gang", district: "falls", x: 110, y: 72 },
  otter: { name: "Soggy Otter Dojo", kind: "dojo", district: "falls", x: 204, y: 104 },
  fallsShop: { name: "Falls Outfitters", kind: "store", district: "falls", x: 125, y: 122 },
  fallsPool: { name: "Moss Pool", kind: "path", district: "falls", x: 55, y: 122 },
  arenaStation: { name: "Arena Station", kind: "station", district: "arena", x: 36, y: 104 },
  grandArena: { name: "The Grand Arena", kind: "tournament", district: "arena", x: 160, y: 104 },
};

export const EDGES: Edge[] = [
  { from: "pinecone", to: "crossroads", dir: "right" },
  { from: "crossroads", to: "market", dir: "up" },
  { from: "crossroads", to: "bridge", dir: "right" },
  { from: "crossroads", to: "stop", dir: "down" },
  { from: "stop", to: "tower", dir: "right", requires: "market" },
  { from: "market", to: "ravine", dir: "right" },
  { from: "market", to: "store", dir: "left" },
  { from: "ravine", to: "bridge", dir: "down" },
  { from: "bridge", to: "radish", dir: "right" },
  { from: "bridge", to: "wharf", dir: "down" },
  { from: "beachStop", to: "beachStrip", dir: "right" },
  { from: "beachStrip", to: "boardwalk", dir: "down" },
  { from: "beachStrip", to: "goose", dir: "right" },
  { from: "beachStrip", to: "beachShop", dir: "up" },
  { from: "beachShop", to: "beachGarden", dir: "left" },
  { from: "goose", to: "lantern", dir: "up" },
  { from: "wharf", to: "station", dir: "right" },
  { from: "parkStop", to: "cherryWalk", dir: "right" },
  { from: "cherryWalk", to: "picnic", dir: "down" },
  { from: "cherryWalk", to: "raccoon", dir: "right" },
  { from: "cherryWalk", to: "parkShop", dir: "up" },
  { from: "parkShop", to: "parkGrove", dir: "left" },
  { from: "raccoon", to: "bamboo", dir: "up" },
  { from: "steelStation", to: "millRow", dir: "right" },
  { from: "millRow", to: "foundry", dir: "down" },
  { from: "millRow", to: "heron", dir: "right" },
  { from: "millRow", to: "steelShop", dir: "up" },
  { from: "steelShop", to: "steelAlley", dir: "left" },
  { from: "fallsStation", to: "lookout", dir: "right" },
  { from: "lookout", to: "gorge", dir: "up" },
  { from: "lookout", to: "otter", dir: "right" },
  { from: "lookout", to: "fallsShop", dir: "down" },
  { from: "fallsShop", to: "fallsPool", dir: "left" },
  { from: "arenaStation", to: "grandArena", dir: "right" },
];

/** A line that has to be earned before it'll take you anywhere. */
export type TransitLine = "parkLine" | "beachLine" | "fallsLine" | "arenaLine";
export type Route = {
  to: NodeId;
  mode: "streetcar" | "train";
  /** Which way the car faces on the Travelling screen. */
  east: boolean;
  /** Left out, it's always running. Rides home are never locked. */
  line?: TransitLine;
};

/** Where you can ride from each stop or station. More directions are one more row here. */
const ROUTES: Partial<Record<NodeId, Route[]>> = {
  stop: [
    { to: "parkStop", mode: "streetcar", east: false, line: "parkLine" },
    { to: "beachStop", mode: "streetcar", east: true, line: "beachLine" },
  ],
  beachStop: [{ to: "stop", mode: "streetcar", east: false }],
  parkStop: [{ to: "stop", mode: "streetcar", east: true }],
  station: [
    { to: "steelStation", mode: "train", east: false },
    { to: "fallsStation", mode: "train", east: true, line: "fallsLine" },
    { to: "arenaStation", mode: "train", east: true, line: "arenaLine" },
  ],
  steelStation: [{ to: "station", mode: "train", east: true }],
  fallsStation: [{ to: "station", mode: "train", east: false }],
  arenaStation: [{ to: "station", mode: "train", east: false }],
};

export const routesFrom = (from: NodeId): Route[] => ROUTES[from] ?? [];
export const nodesIn = (district: District): NodeId[] =>
  (Object.keys(NODES) as NodeId[]).filter((id) => NODES[id].district === district);

/** Every gang can be walked past. Fighting is always the player's choice. */
export const GANGS: Partial<Record<NodeId, BrawlSpec[]>> & Record<string, BrawlSpec[]> = {
  market: [{ kind: "fist", x: 200 }, { kind: "fist", x: 290 }, { kind: "fist", x: 380 }],
  bridge: [{ kind: "fist", x: 190 }, { kind: "fist", x: 260 }, { kind: "stick", x: 350 }, { kind: "fist", x: 430 }],
  wharf: [{ kind: "fist", x: 180 }, { kind: "stick", x: 250 }, { kind: "fist", x: 310 }, { kind: "stick", x: 390 }, { kind: "fist", x: 460 }],
  boardwalk: [{ kind: "fist", x: 190 }, { kind: "fist", x: 270 }, { kind: "stick", x: 340 }, { kind: "fist", x: 420 }],
  picnic: [{ kind: "fist", x: 190 }, { kind: "fist", x: 260 }, { kind: "stick", x: 330 }, { kind: "fist", x: 400 }, { kind: "stick", x: 470 }],
  foundry: [{ kind: "stick", x: 180 }, { kind: "fist", x: 250 }, { kind: "stick", x: 320 }, { kind: "fist", x: 380 }, { kind: "stick", x: 450 }, { kind: "fist", x: 520 }],
  gorge: [{ kind: "stick", x: 180 }, { kind: "stick", x: 250 }, { kind: "fist", x: 310 }, { kind: "stick", x: 380 }, { kind: "fist", x: 440 }, { kind: "stick", x: 510 }, { kind: "fist", x: 570 }],
};

export function neighbor(from: NodeId, dir: Direction, cleared: readonly string[]): NodeId | null {
  for (const edge of EDGES) {
    if (edge.requires && !cleared.includes(edge.requires)) continue;
    if (edge.from === from && edge.dir === dir) return edge.to;
    if (edge.to === from && OPPOSITE[edge.dir] === dir) return edge.from;
  }
  return null;
}

export const exitsFrom = (from: NodeId, cleared: readonly string[]): Direction[] =>
  DIRECTIONS.filter((dir) => neighbor(from, dir, cleared) !== null);
