import type { Crest } from "../art/backdrops.ts";
import { senseiColors, seniorColors, TEAM_COLORS } from "../art/looks.ts";
import { AKI_COLORS, ASA_COLORS, BO_COLORS, UME_COLORS, GORO_COLORS, MOMO_COLORS, SENIOR_COLORS, SHIN_COLORS, TETSU_COLORS, YUI_COLORS } from "../art/palette.ts";
import type { RivalStyle } from "../duel/rival.ts";
import type { Kamae } from "../duel/rules.ts";
import {
  ARRIVAL, GOOSE_ARRIVAL, GOOSE_ARRIVALS, HANA_LINES, HANA_WIN_LINES, HERON_ARRIVAL, HERON_ARRIVALS, KENJI_LINES, KENJI_WIN_LINES, MIKA_LINES, MIKA_WIN_LINES, OTTER_ARRIVAL, OTTER_ARRIVALS, RACCOON_ARRIVALS, RADISH_ARRIVALS,
  RACCOON_ARRIVAL, REN_LINES, SORA_LINES, SORA_WIN_LINES, WIN_LINES,
} from "../scenes/content.ts";
import type { SenpaiId } from "../scenes/curriculum.ts";
import { GOOSE_MAP, HERON_MAP, OTTER_MAP, RACCOON_MAP, RIVAL_MAP, RIVAL_SOLID } from "../scenes/levels.ts";
import type { NodeId } from "./map.ts";

export type DojoId = "radish" | "goose" | "raccoon" | "heron" | "otter";
export type MemberId = "kei" | "dai" | "ida" | "pip" | "niko" | "rio" | "teo" | "uma" | "val" | "wes" | "tetsu" | "shin";
/** The heads of the rival dojos. They watch, they talk, and they'll fight you if you've got the rank. */
export type DojoSenseiId = "raiko" | "kan" | "nemu" | "hagane" | "mizu";
/** Whoever you're paired with at a grading. */
export type CandidateId = "asa" | "ume" | "goro";
export type OpponentId = DojoId | SenpaiId | MemberId | CandidateId | DojoSenseiId | "momo" | "renVisit" | "sensei";
export type Opponent = {
  rival: string;
  crest: Crest;
  style: RivalStyle;
  colors: Record<string, string>;
  /** Their ki, if it isn't the usual. */
  ki?: number;
  /** How hard they press just by standing there, if at all. */
  presence?: number;
  /** How many points end the match, if it isn't the usual. */
  points?: number;
  /** How they stand, if it isn't chudan. */
  kamae?: Kamae;
};
export type Dojo = Opponent & {
  name: string;
  room: string[];
  solid: string;
  arrival: string[];
  /** Other things you might walk in on. */
  arrivals: string[];
  /** Who the two helpers on the tiles G and E are. */
  helperIds: { G: MemberId; E: MemberId };
  /** Whoever runs the place, who stands on the tile X, under the crest. */
  sensei: { id: DojoSenseiId; name: string; colors: Record<string, string> };
  /** Someone with a stance of their own, who stands on the tile J. */
  challenger?: "tetsu" | "shin";
  challenge: string[];
  winLines: string[];
};

export const DOJOS: Record<DojoId, Dojo> = {
  radish: {
    name: "Thunder Radish Dojo",
    rival: "Ren",
    crest: "radish",
    style: "master",
    colors: seniorColors(TEAM_COLORS.radish!),
    // The final boss: more ki than anyone at a dojo, and a stare that wears you down unless you press back.
    ki: 150,
    presence: 1,
    room: RIVAL_MAP,
    solid: RIVAL_SOLID,
    arrival: ARRIVAL,
    arrivals: RADISH_ARRIVALS,
    helperIds: { G: "kei", E: "dai" },
    sensei: { id: "raiko", name: "Raiko", colors: senseiColors(TEAM_COLORS.radish!) },
    challenge: REN_LINES,
    winLines: WIN_LINES,
  },
  goose: {
    name: "Angry Goose Dojo",
    rival: "Hana",
    crest: "goose",
    style: "fierce",
    colors: seniorColors(TEAM_COLORS.goose!),
    room: GOOSE_MAP,
    solid: RIVAL_SOLID,
    arrival: GOOSE_ARRIVAL,
    arrivals: GOOSE_ARRIVALS,
    helperIds: { G: "ida", E: "pip" },
    sensei: { id: "kan", name: "Kan", colors: senseiColors(TEAM_COLORS.goose!) },
    challenger: "tetsu",
    challenge: HANA_LINES,
    winLines: HANA_WIN_LINES,
  },
  raccoon: {
    name: "Sleepy Raccoon Dojo",
    rival: "Sora",
    crest: "raccoon",
    style: "sneaky",
    colors: seniorColors(TEAM_COLORS.raccoon!),
    room: RACCOON_MAP,
    solid: RIVAL_SOLID,
    arrival: RACCOON_ARRIVAL,
    arrivals: RACCOON_ARRIVALS,
    helperIds: { G: "niko", E: "rio" },
    sensei: { id: "nemu", name: "Nemu", colors: senseiColors(TEAM_COLORS.raccoon!) },
    challenge: SORA_LINES,
    winLines: SORA_WIN_LINES,
  },
  heron: {
    name: "Iron Heron Dojo",
    rival: "Mika",
    crest: "heron",
    style: "patient",
    colors: seniorColors(TEAM_COLORS.heron!),
    ki: 130,
    room: HERON_MAP,
    solid: RIVAL_SOLID,
    arrival: HERON_ARRIVAL,
    arrivals: HERON_ARRIVALS,
    helperIds: { G: "teo", E: "uma" },
    sensei: { id: "hagane", name: "Hagane", colors: senseiColors(TEAM_COLORS.heron!) },
    challenger: "shin",
    challenge: MIKA_LINES,
    winLines: MIKA_WIN_LINES,
  },
  otter: {
    name: "Soggy Otter Dojo",
    rival: "Kenji",
    crest: "otter",
    style: "relentless",
    colors: seniorColors(TEAM_COLORS.otter!),
    ki: 130,
    room: OTTER_MAP,
    solid: RIVAL_SOLID,
    arrival: OTTER_ARRIVAL,
    arrivals: OTTER_ARRIVALS,
    helperIds: { G: "val", E: "wes" },
    sensei: { id: "mizu", name: "Mizu", colors: senseiColors(TEAM_COLORS.otter!) },
    challenge: KENJI_LINES,
    winLines: KENJI_WIN_LINES,
  },
};

/** What it's like walking in today. Most days, it's just how it always is. */
export function arrivalLine(dojo: Dojo, roll: number): string {
  const options = [...dojo.arrival, ...dojo.arrivals];
  return options[Math.min(options.length - 1, Math.floor(roll * options.length))];
}

/** The dojo a duel belongs to. Only a development jump starts one away from a rival's dojo. */
export const dojoFor = (node: NodeId): DojoId => (Object.hasOwn(DOJOS, node) ? (node as DojoId) : "radish");

/** Senpai Momo, who guards the secret at home. */
/** Momo's ki dwarfs yours, and their aura makes you flinch in about a second. */
export const MOMO: Opponent = { rival: "Momo", crest: "pinecone", style: "rigged", colors: MOMO_COLORS, ki: 200, presence: 3 };
/** Sensei Kuma, if you dare. A win is worth an exception from the panel. The stare keeps up however often you lose, so it wants seme. */
export const SENSEI: Opponent = { rival: "Sensei Kuma", crest: "pinecone", style: "sensei", colors: SENIOR_COLORS, ki: 170, presence: 2 };
/** Ren, visiting your dojo long before you could ever beat them. One point, and it's there to teach you something. */
export const REN_VISIT: Opponent = { rival: "Ren", crest: "pinecone", style: "demonstration", colors: DOJOS.radish.colors, ki: 300, presence: 1.5, points: 1 };
export const opponentIdFor = (node: NodeId): OpponentId => (node === "pinecone" ? "momo" : dojoFor(node));
/** The senpai you can spar with at home. Beating any one of them opens the front door. */
export const SPAR_PARTNERS: Record<SenpaiId, Opponent> = {
  aki: { rival: "Aki", crest: "pinecone", style: "restless", colors: AKI_COLORS },
  bo: { rival: "Bo", crest: "pinecone", style: "wall", colors: BO_COLORS },
  yui: { rival: "Yui", crest: "pinecone", style: "exact", colors: YUI_COLORS },
};

const sensei = (home: DojoId, style: RivalStyle, ki: number, presence: number): Opponent & { home: DojoId } => ({ rival: `Sensei ${DOJOS[home].sensei.name}`, home, style, crest: DOJOS[home].crest, colors: DOJOS[home].sensei.colors, ki, presence });
/** Each fights the way their dojo does, only better, and you'll feel them from across the room. It takes seme just to stand up to them. */
export const DOJO_SENSEIS: Record<DojoSenseiId, Opponent & { home: DojoId }> = {
  nemu: sensei("raccoon", "shadow", 170, 2),
  kan: sensei("goose", "fury", 170, 2),
  mizu: sensei("otter", "torrent", 180, 2.5),
  hagane: sensei("heron", "iron", 190, 2),
  raiko: sensei("radish", "sensei", 200, 2.5),
};

/** The people you meet in each rival's dojo. They enter cups for their own dojo, on the same rules as everyone else. */
const member = (home: DojoId, rival: string, style: RivalStyle): Opponent & { home: DojoId } => ({ rival, home, style, crest: DOJOS[home].crest, colors: DOJOS[home].colors });
export const MEMBERS: Record<MemberId, Opponent & { home: DojoId }> = {
  niko: member("raccoon", "Niko", "wall"),
  rio: member("raccoon", "Rio", "exact"),
  ida: member("goose", "Ida", "restless"),
  pip: member("goose", "Pip", "exact"),
  teo: member("heron", "Teo", "steady"),
  uma: member("heron", "Uma", "exact"),
  val: member("otter", "Val", "steady"),
  wes: member("otter", "Wes", "restless"),
  kei: member("radish", "Kei", "steady"),
  dai: member("radish", "Dai", "sneaky"),
  tetsu: { ...member("goose", "Tetsu", "jodan"), kamae: "jodan", colors: TETSU_COLORS, ki: 120 },
  shin: { ...member("heron", "Shin", "nito"), kamae: "nito", colors: SHIN_COLORS, ki: 130 },
};
/** Your partners at a grading, who've come for the same rank you have. */
export const CANDIDATES: Record<CandidateId, Opponent> = {
  asa: { rival: "Asa", crest: "hall", style: "steady", colors: ASA_COLORS },
  ume: { rival: "Ume", crest: "hall", style: "patient", colors: UME_COLORS, ki: 120 },
  goro: { rival: "Goro", crest: "hall", style: "relentless", colors: GORO_COLORS, ki: 130 },
};
export const HOME_DOJO_NAME = "Pinecone Dojo";
/** Where someone trains, for showing on a bracket. */
export function dojoNameOf(id: OpponentId): string {
  if (Object.hasOwn(DOJOS, id)) return DOJOS[id as DojoId].name;
  if (Object.hasOwn(MEMBERS, id)) return DOJOS[MEMBERS[id as MemberId].home].name;
  if (Object.hasOwn(DOJO_SENSEIS, id)) return DOJOS[DOJO_SENSEIS[id as DojoSenseiId].home].name;
  return HOME_DOJO_NAME;
}
export const opponentById = (id: OpponentId): Opponent => {
  if (id === "momo") return MOMO;
  if (id === "renVisit") return REN_VISIT;
  if (id === "sensei") return SENSEI;
  if (Object.hasOwn(SPAR_PARTNERS, id)) return SPAR_PARTNERS[id as SenpaiId];
  if (Object.hasOwn(MEMBERS, id)) return MEMBERS[id as MemberId];
  if (Object.hasOwn(DOJO_SENSEIS, id)) return DOJO_SENSEIS[id as DojoSenseiId];
  if (Object.hasOwn(CANDIDATES, id)) return CANDIDATES[id as CandidateId];
  return DOJOS[id as DojoId];
};
/** Who a match is against: whoever's been set up for it, otherwise whoever waits at this place. */
export const opponentFor = (node: NodeId, versus?: OpponentId | null): Opponent => opponentById(versus ?? opponentIdFor(node));
