import type { RunState } from "./run-state.ts";
import type { OpponentId } from "./world/dojos.ts";
import type { CupId } from "./world/tournament.ts";

/** The highest dan you can earn for now. One more row in the ladder and in GRADINGS would raise it. */
export const MAX_DAN = 3;

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
export const danLabel = (dan: number): string => `${ordinal(dan)} dan`;
const kyuLabel = (kyu: number): string => `${ordinal(kyu)} kyu`;

const START_KYU = 6;
const SENPAI: OpponentId[] = ["aki", "bo", "yui"];

/** Kyu ranks come with the work: one for each armor piece you earn, and the last for beating a senpai. */
export function kyuOf(run: RunState): number {
  const { tare, do: dou, men, kote } = run.gear;
  const armor = [tare, dou, men, kote].filter(Boolean).length;
  return START_KYU - armor - (run.beaten.some((id) => SENPAI.includes(id)) ? 1 : 0);
}

export const rankLabel = (run: RunState): string => (run.dan > 0 ? danLabel(run.dan) : kyuLabel(kyuOf(run)));

/**
 * The dan a win in each tournament away from home is worth, if you aren't there already.
 * The Pinecone Cup is at home, so it isn't one of them. The last two come after Ren, who needs 3rd dan anyway.
 */
export const CUP_DAN: Partial<Record<CupId, number>> = { raccoon: 1, goose: 2, heron: 3, otter: 3 };

/** Being promoted to a dan you already have, or have passed, changes nothing. */
export const atLeastDan = (run: RunState, dan: number): RunState => (run.dan >= dan ? run : { ...run, dan, ticket: run.ticket > dan ? run.ticket : 0 });

/** A ticket to grade for a rank you've since reached some other way is no use to anyone. */
export const hasTicket = (run: RunState): boolean => run.ticket > run.dan;
/** The same goes for a letter. */
export const hasLetter = (run: RunState): boolean => run.letter > run.dan;

/** The dan a save from before grading existed had already earned, going by who it had beaten and what it had won. */
export function impliedDan(run: RunState): number {
  const fromCups = Math.max(0, ...run.cups.map((cup) => CUP_DAN[cup] ?? 0));
  const fromWins = run.beaten.includes("radish") ? 3 : run.beaten.includes("heron") || run.beaten.includes("otter") ? 2 : run.beaten.includes("goose") ? 1 : 0;
  return Math.max(fromCups, fromWins);
}

export type PersonId = OpponentId | "examiner";
const PERSON_DAN: Partial<Record<PersonId, number>> = {
  examiner: 8,
  raiko: 7,
  sensei: 6,
  hagane: 6,
  kan: 5,
  nemu: 5,
  mizu: 5,
  radish: 5,
  shin: 5,
  momo: 4,
  otter: 4,
  heron: 4,
  tetsu: 4,
  goose: 3,
  raccoon: 3,
  renVisit: 5,
  yui: 2,
  bo: 2,
  kei: 2,
  dai: 2,
  rio: 2,
  uma: 2,
  val: 2,
  ume: 1,
  goro: 2,
  aki: 1,
  niko: 1,
  ida: 1,
  pip: 1,
  teo: 1,
  wes: 1,
};

/** Someone's dan, or 0 if they haven't got one yet. */
export const personDan = (id: PersonId): number => PERSON_DAN[id] ?? 0;

const PRESENCE_FROM_DAN = 3;
const TOP_DAN = 8;

/** How much you feel someone's rank just by standing near them, from 0 (nothing at all) to 1. */
export const presenceOf = (dan: number): number => (dan < PRESENCE_FROM_DAN ? 0 : (dan - PRESENCE_FROM_DAN + 1) / (TOP_DAN - PRESENCE_FROM_DAN + 1));

const XP_SCALE = 25;
const xpForLevel = (level: number) => XP_SCALE * level * (level - 1);

/** Your level comes from all the practice you've ever done. Each one takes longer than the last. */
export function levelOf(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}
/** How far through your current level you are, from 0 to just under 1. */
export function levelProgress(xp: number): number {
  const level = levelOf(xp);
  return (xp - xpForLevel(level)) / (xpForLevel(level + 1) - xpForLevel(level));
}
export const xpToNextLevel = (xp: number): number => xpForLevel(levelOf(xp) + 1) - xp;
/** Every level past the first is worth 1 ki. */
export const levelKi = (xp: number): number => levelOf(xp) - 1;
