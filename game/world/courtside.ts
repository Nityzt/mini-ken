import type { Crest } from "../art/backdrops.ts";
import { HALL_CROWD_COLORS } from "../art/palette.ts";
import { TEAM_COLORS } from "../art/looks.ts";
import { STAGE_W } from "../core/scale.ts";
import { DOJOS, opponentById, type DojoId, type OpponentId } from "./dojos.ts";

type Colors = Record<string, string>;
export type SeatTier = "head" | "senior" | "member";
/** Someone at the side of the court. `who` is null for somebody you don't know by name. */
export type Seat = { who: OpponentId | null; colors: Colors; tier: SeatTier };
/** Who's around for a match: the three judges, chief first, then the people you'd recognize sitting along the wall, and the colors of everyone else. */
export type Courtside = { shinpan: Seat[]; seated: Seat[]; crowd: Colors[] };

const DOJO_IDS = Object.keys(DOJOS) as DojoId[];
const isDojo = (place: Crest): place is DojoId => (DOJO_IDS as string[]).includes(place);
const JUDGE_COUNT = 3;
const JUDGE: Seat = { who: null, colors: {}, tier: "head" };

/** A dojo's sensei sits and watches. Everyone senior below them takes a flag or a good seat. */
function peopleAt(place: Crest): { head: Seat; seniors: OpponentId[] } | null {
  if (place === "pinecone") return { head: { who: "sensei", colors: opponentById("sensei").colors, tier: "head" }, seniors: ["momo", "yui", "bo", "aki"] };
  if (!isDojo(place)) return null;
  const dojo = DOJOS[place];
  return { head: { who: dojo.sensei.id, colors: dojo.sensei.colors, tier: "head" }, seniors: [dojo.helperIds.G, dojo.helperIds.E, ...(dojo.challenger ? [dojo.challenger] : []), place] };
}

function work(place: Crest, opponent: OpponentId | null): Courtside {
  if (place === "hut") return { shinpan: [], seated: [], crowd: [] };
  // Away from any one dojo, the panel judges, and everyone else has come from all over.
  if (place === "hall") return { shinpan: [JUDGE, JUDGE, JUDGE], seated: [], crowd: HALL_CROWD_COLORS.filter((colors) => colors !== (opponent && opponentById(opponent).colors)) };
  if (place === "arena") return { shinpan: [JUDGE, JUDGE, JUDGE], seated: [], crowd: [...DOJO_IDS, "pinecone" as const].map((id) => TEAM_COLORS[id]!) };

  const team = TEAM_COLORS[place]!;
  const people = peopleAt(place)!;
  const named = people.seniors.filter((id) => id !== opponent).map((id): Seat => ({ who: id, colors: opponentById(id).colors, tier: "senior" }));
  const shinpan = named.slice(0, JUDGE_COUNT);
  while (shinpan.length < JUDGE_COUNT) shinpan.push({ who: null, colors: team, tier: "member" });
  const head = people.head.who === opponent ? [] : [people.head];
  return { shinpan, seated: [...head, ...named.slice(JUDGE_COUNT)], crowd: [team] };
}

const known = new Map<string, Courtside>();
/** Who's around for a match here, against this opponent, who obviously isn't also watching. */
export function courtside(place: Crest, opponent: OpponentId | null): Courtside {
  const key = `${place}:${opponent}`;
  let side = known.get(key);
  if (!side) known.set(key, (side = work(place, opponent)));
  return side;
}

const FIRST_SEAT = 60;
const SEAT_SPACING = 17;
const SEAT_WIDTH = 14;
const GAP_EVERY = 6;
/** The left edge of each seat along the wall. They fill in from the middle, one side then the other, leaving the wall behind the fight clear. */
export function seatLeft(n: number): number {
  const distance = FIRST_SEAT + Math.floor(n / 2) * SEAT_SPACING;
  return n % 2 === 0 ? STAGE_W / 2 - distance - SEAT_WIDTH : STAGE_W / 2 + distance;
}
/** The people you know always have a seat. Past them, the row has the odd gap, so it doesn't read as a fence. */
export const seatTaken = (n: number, named: number): boolean => n < named || n % GAP_EVERY !== GAP_EVERY - 1;
