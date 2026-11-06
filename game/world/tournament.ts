import type { Crest } from "../art/backdrops.ts";
import { nextRandom } from "../duel/rival.ts";
import { dojoNameOf, HOME_DOJO_NAME, opponentById, type OpponentId } from "./dojos.ts";
import type { NodeId } from "./map.ts";

/**
 * Who's driving each entrant. Bots stand in for the other dojos for now. A real person from
 * another club would be one more value here: the bracket only ever asks who won each match.
 */
export type Controller = "player" | "bot";
export type Entrant = { id: string; name: string; dojo: string; controller: Controller; fighter: OpponentId | null };

export type CupId = "pinecone" | "raccoon" | "goose" | "heron" | "otter" | "radish" | "grand";
export const CUP_IDS: CupId[] = ["pinecone", "raccoon", "goose", "heron", "otter", "radish", "grand"];
export type Cup = {
  name: string;
  venue: NodeId;
  crest: Crest;
  /** Who else enters. */
  field: OpponentId[];
  /** Whoever's always waiting in the final, if anyone. Bots never beat them. */
  host: OpponentId | null;
};

/** Momo stays home, because that fight is rigged. */
export const CUPS: Record<CupId, Cup> = {
  pinecone: { name: "Pinecone Cup", venue: "pinecone", crest: "pinecone", field: ["aki", "bo", "yui"], host: null },
  raccoon: { name: "Raccoon Open", venue: "raccoon", crest: "raccoon", field: ["rio", "bo"], host: "raccoon" },
  goose: { name: "Goose Open", venue: "goose", crest: "goose", field: ["ida", "niko"], host: "goose" },
  heron: { name: "Heron Open", venue: "heron", crest: "heron", field: ["teo", "tetsu"], host: "heron" },
  otter: { name: "Otter Open", venue: "otter", crest: "otter", field: ["val", "shin"], host: "otter" },
  radish: { name: "Thunder Open", venue: "radish", crest: "radish", field: ["dai", "wes"], host: "radish" },
  grand: { name: "Grand Taikai", venue: "grandArena", crest: "arena", field: ["otter", "heron", "goose", "raccoon", "aki", "bo", "yui"], host: "radish" },
};
const GRAND_SENPAI: OpponentId[] = ["aki", "bo", "yui"];

export const cupAt = (node: NodeId): CupId | null => CUP_IDS.find((id) => CUPS[id].venue === node) ?? null;

export type Tournament = {
  cup: CupId;
  /** Who's left at the start of each round, paired off in order. The last list is the champion. */
  rounds: Entrant[][];
  round: number;
  status: "playing" | "out" | "champion";
  rng: number;
};

export const ENTRANT_COUNT = 8;
/** How often the stronger of two others wins their match. */
const FAVOURITE_WINS = 0.75;
const DEFAULT_STRENGTH = 2;
const STRENGTH: Partial<Record<OpponentId, number>> = { radish: 9, otter: 7, shin: 6, heron: 6, tetsu: 5, goose: 5, raccoon: 4, yui: 3, aki: 1 };
const ROUND_NAMES: Record<number, string> = { 8: "Quarterfinal", 4: "Semifinal", 2: "Final" };

/** A round is named by how many are left in it. */
export const roundName = (fieldSize: number): string => ROUND_NAMES[fieldSize] ?? ROUND_NAMES[2];

const botEntrant = (fighter: OpponentId): Entrant => ({
  id: fighter,
  name: opponentById(fighter).rival,
  dojo: dojoNameOf(fighter),
  controller: "bot",
  fighter,
});

/** Everyone else is drawn at random, with you and the host in opposite halves, so you can only meet in the final. */
export function createTournament(cupId: CupId, seed: number, playerName: string): Tournament {
  const cup = CUPS[cupId];
  let rng = seed;
  const roll = (size: number) => {
    const r = nextRandom(rng);
    rng = r.seed;
    return Math.floor(r.value * size);
  };
  // The Grand Taikai takes every rival dojo, and two of the three senpai fill the last places.
  const pool = [...cup.field];
  if (cupId === "grand") pool.splice(pool.indexOf(GRAND_SENPAI[roll(GRAND_SENPAI.length)]), 1);
  const shuffled: OpponentId[] = [];
  while (pool.length) shuffled.push(pool.splice(roll(pool.length), 1)[0]);

  const you: Entrant = { id: "you", name: playerName, dojo: HOME_DOJO_NAME, controller: "player", fighter: null };
  const first: Entrant[] = [you, ...shuffled.map(botEntrant), ...(cup.host ? [botEntrant(cup.host)] : [])];
  // Your place within your own half is drawn too.
  const yourSpot = roll(first.length / 2);
  [first[0], first[yourSpot]] = [first[yourSpot], first[0]];
  return { cup: cupId, rounds: [first], round: 0, status: "playing", rng };
}

const partnerIndex = (at: number) => (at % 2 === 0 ? at + 1 : at - 1);
const isPlayer = (entrant: Entrant) => entrant.controller === "player";
const strength = (entrant: Entrant) => STRENGTH[entrant.fighter!] ?? DEFAULT_STRENGTH;

/** Who you face next, or null if it's all over. */
export function nextOpponent(t: Tournament): Entrant | null {
  if (t.status !== "playing") return null;
  const field = t.rounds[t.round];
  return field[partnerIndex(field.findIndex(isPlayer))];
}

/** Your match is decided, so the others play theirs. The host never loses to anyone but you. */
export function recordMatch(t: Tournament, won: boolean): Tournament {
  if (t.status !== "playing") return t;
  if (!won) return { ...t, status: "out" };
  const { host } = CUPS[t.cup];
  let rng = t.rng;
  const field = t.rounds[t.round];
  const winners: Entrant[] = [];
  for (let i = 0; i < field.length; i += 2) {
    const [a, b] = [field[i], field[i + 1]];
    if (isPlayer(a) || isPlayer(b)) winners.push(isPlayer(a) ? a : b);
    else if (host && (a.fighter === host || b.fighter === host)) winners.push(a.fighter === host ? a : b);
    else {
      const roll = nextRandom(rng);
      rng = roll.seed;
      const [strong, weak] = strength(a) >= strength(b) ? [a, b] : [b, a];
      winners.push(roll.value < FAVOURITE_WINS ? strong : weak);
    }
  }
  const rounds = [...t.rounds, winners];
  if (winners.length === 1) return { ...t, rounds, rng, status: "champion" };
  return { ...t, rounds, rng, round: t.round + 1 };
}
