import type { Crest } from "./backdrops.ts";
import { GOOSE_COLORS, HERON_COLORS, OTTER_COLORS, PINECONE_COLORS, RACCOON_COLORS, RIVAL_COLORS } from "./palette.ts";

type Colors = Record<string, string>;
export type FloorKind = "boards" | "tatami" | "parquet" | "plates" | "planks" | "lacquer" | "earth";
export type WallKind = "paper" | "plaster" | "panels" | "steel" | "slats" | "logs";
export type ViewKind = "bamboo" | "storm" | "pond" | "night" | "smoke" | "rain" | "sky" | "garden" | "ravine";
/** Something on the wall or the floor, and how often it comes up. */
type Detail = { tile: string; every: number };

/** What makes one place look like itself, from above and from the side. All of it is just data, so a new dojo is one more row. */
export type DojoLook = {
  floor: FloorKind;
  wall: WallKind;
  view: ViewKind;
  /** Swapped in over the wood and paper of the room's tiles. */
  room: Colors;
  /** Swapped in over the sky and hills outside the windows. */
  window: Colors;
  /** The hanging with the crest on it, if there is one. */
  banner: { cloth: string; edge: string; field: string } | null;
  decor: Detail | null;
  /** Something lying about on the floor of the room. */
  mark: Detail | null;
  /** Whether it's on the court as well. Mostly it isn't, because anything there looks like part of the fight. */
  markOnCourt?: boolean;
};

export const DOJO_LOOKS: Record<Crest, DojoLook> = {
  // Home: warm honey boards, paper screens, and bamboo outside.
  pinecone: {
    floor: "boards", wall: "paper", view: "bamboo",
    room: {}, window: {},
    banner: { cloth: "#E8192C", edge: "#9E1421", field: "#EFE6D4" },
    decor: null, mark: null,
  },
  // The last dojo: dark lacquer, gold trim, and weather on the way. The drum is why they call it Thunder.
  radish: {
    floor: "lacquer", wall: "panels", view: "storm",
    room: { B: "#4A2730", D: "#3B1E27", b: "#1C0F14", L: "#6E3C48", O: "#2E2228", w: "#8A6D3A" },
    window: { C: "#3F4563", G: "#2B2F47", g: "#191C2E", W: "#AEB6D8" },
    banner: { cloth: "#14090D", edge: "#C9A24A", field: "#5E1F2E" },
    decor: { tile: "decorTaiko", every: 5 }, mark: null,
  },
  // Pale ash and clean plaster, kept very tidy by someone with a temper. Orange wherever it'll fit.
  goose: {
    floor: "parquet", wall: "plaster", view: "pond",
    room: { B: "#BDB6A6", D: "#A69F8E", b: "#5F5A50", L: "#D9D2C2", O: "#DDE2DE", w: "#E08A2E" },
    window: { C: "#BFDCE6", G: "#86AE70", g: "#4E7FA3", W: "#FAF7F2" },
    banner: { cloth: "#E08A2E", edge: "#A5601A", field: "#FAF7F2" },
    decor: { tile: "decorPrint", every: 6 }, mark: { tile: "markFeather", every: 13 },
  },
  // Soft mats and lanterns. It's always a little later here than you thought.
  raccoon: {
    floor: "tatami", wall: "paper", view: "night",
    room: { B: "#A9A869", D: "#95945A", b: "#3D3346", L: "#C6C486", O: "#D9C9A6", w: "#AD9A78" },
    window: { C: "#1E2349", G: "#2F3A5E", g: "#161B38", W: "#F4EBBA" },
    banner: { cloth: "#4A4056", edge: "#2A2333", field: "#E8DFC4" },
    decor: { tile: "decorLantern", every: 4 }, mark: { tile: "markCushion", every: 17 },
  },
  // Bolted steel and cold light, with the foundry going outside.
  heron: {
    floor: "plates", wall: "steel", view: "smoke",
    room: { B: "#74858D", D: "#64757D", b: "#28323A", L: "#93A5AD", O: "#A9B7BC", w: "#7F8E94" },
    window: { C: "#CDBDA4", G: "#928F84", g: "#46474A", W: "#ECE5D6" },
    banner: { cloth: "#2B4552", edge: "#16252D", field: "#D8E0E2" },
    decor: { tile: "decorGear", every: 5 }, mark: { tile: "markDrain", every: 19 },
  },
  // Driftwood and rain. Everything here is a little bit wet, and nobody minds.
  otter: {
    floor: "planks", wall: "slats", view: "rain",
    room: { B: "#8D8569", D: "#797158", b: "#352F24", L: "#A9A182", O: "#7CA69E", w: "#5B857D" },
    window: { C: "#8FA9B5", G: "#6E9A8A", g: "#3E6A78", W: "#D8E6EC" },
    banner: { cloth: "#2F6E78", edge: "#173A40", field: "#E4DCC4" },
    decor: { tile: "decorRing", every: 6 }, mark: { tile: "markPuddle", every: 7 }, markOnCourt: true,
  },
  // The Grand Taikai: polished maple, crimson boards, and flags for every dojo in the land.
  arena: {
    floor: "boards", wall: "plaster", view: "sky",
    room: { B: "#D9B57E", D: "#C9A36B", b: "#3A2526", L: "#ECD3A4", O: "#F2EAD8", w: "#C9A24A" },
    window: { C: "#A8D8F0", G: "#A8D8F0", g: "#7FC0E0", W: "#FAF7F2" },
    banner: { cloth: "#8E1B28", edge: "#C9A24A", field: "#FAF7F2" },
    decor: { tile: "decorPennant", every: 3 }, mark: null,
  },
  // The grading hall: quiet green boards and a very straight scroll. Nobody here is in a hurry.
  hall: {
    floor: "boards", wall: "plaster", view: "garden",
    room: { B: "#9E8460", D: "#8B7250", b: "#2E3D34", L: "#B79C76", O: "#E8E4D6", w: "#C4C0AE" },
    window: { C: "#C6E2D4", G: "#7CA882", g: "#3F6A52", W: "#FAF7F2" },
    banner: { cloth: "#2B3A67", edge: "#171F3D", field: "#EFE6D4" },
    decor: { tile: "decorScroll", every: 5 }, mark: null,
  },
  // Old Gen's hut: packed earth, rough logs, and a kettle that's seen things. No banner. Gen answers to nobody.
  hut: {
    floor: "earth", wall: "logs", view: "ravine",
    room: { B: "#8A6F52", D: "#7A6146", b: "#35261A", L: "#A08462", O: "#6A4D34", w: "#4F3825" },
    window: { C: "#D6E2C8", G: "#8FA67A", g: "#566B4E", W: "#F2EEDC" },
    banner: null,
    decor: { tile: "decorPot", every: 5 }, mark: null,
  },
};

export const PLACES = Object.keys(DOJO_LOOKS) as Crest[];
export const lookOf = (place: Crest): DojoLook => DOJO_LOOKS[place];

export const FLOOR_TILES: Record<FloorKind, string> = {
  boards: "floor", tatami: "floorTatami", parquet: "floorParquet", plates: "floorPlates", planks: "floorPlanks", lacquer: "floorLacquer", earth: "floorEarth",
};

/** What everyone at a dojo wears, down to the cloth on the front of the tare. The named seniors add to this. */
export const TEAM_COLORS: Partial<Record<Crest, Colors>> = {
  pinecone: { ...PINECONE_COLORS, Z: "#E8192C", z: "#FAF7F2" },
  radish: { ...RIVAL_COLORS, Z: "#E6C46A", z: "#1A1A1A" },
  goose: { ...GOOSE_COLORS, Z: "#E08A2E", z: "#FAF7F2" },
  raccoon: { ...RACCOON_COLORS, Z: "#2A2830", z: "#FAF7F2" },
  heron: { ...HERON_COLORS, Z: "#FAF7F2", z: "#1A1A1A" },
  otter: { ...OTTER_COLORS, Z: "#2F9E9A", z: "#FAF7F2" },
};

const SENIOR_TRIM = "#E6C46A";
const seniors = new Map<Colors, Colors>();
/** The same armor as everyone else, with gold trim, so you can pick out who's senior at a glance. */
export function seniorColors(team: Colors): Colors {
  let colors = seniors.get(team);
  if (!colors) seniors.set(team, (colors = { ...team, i: SENIOR_TRIM }));
  return colors;
}

const SENSEI_HAIR = { H: "#B8B4AE", h: "#D6CEC4" };
const senseis = new Map<Colors, Colors>();
/** A dojo's sensei: the same armor and gold trim as its seniors, and they've earned the grey. */
export function senseiColors(team: Colors): Colors {
  let colors = senseis.get(team);
  if (!colors) senseis.set(team, (colors = { ...seniorColors(team), ...SENSEI_HAIR }));
  return colors;
}

/** Where the crest hangs in a room seen from above: the plain stretch of wall closest to the middle. */
export function bannerColumn(rows: string[]): { col: number; row: number } | null {
  const row = rows.findIndex((line) => line.includes("W"));
  if (row < 0) return null;
  const middle = rows[row].length / 2;
  let best: number | null = null;
  for (let col = 0; col < rows[row].length; col++) {
    if (rows[row][col] === "W" && (best === null || Math.abs(col + 0.5 - middle) < Math.abs(best + 0.5 - middle))) best = col;
  }
  return best === null ? null : { col: best, row };
}

/** Whether this bit of floor has something on it. It only depends on where it is, so nothing moves about between frames. */
export const floorMarked = (col: number, row: number, every: number): boolean => (col * 31 + row * 17) % every === 0;
