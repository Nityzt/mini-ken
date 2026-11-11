import { durabilityOf, FULL_DURABILITY, shinaiReturned } from "../durability.ts";
import { equipmentInfo, type EquipmentId } from "../equipment.ts";
import type { RunState } from "../run-state.ts";
import { FUMI_BUILD_START, FUMI_OFFER, FUMI_RETURNED, FUMI_WAITING, fumiElsewhere, fumiOwnWork, GEN_BAMBOO, OBJECTIVES, returnLines, SENSEI_MINE_STILL_CRACKED, SENSEI_STILL_WAITING, SENSEI_WANTS_IT_BACK, SHINAI_STEPS } from "./content.ts";

/** Your own shinai, a step at a time. Empty means nobody's raised it yet. */
export type ShinaiQuest = "" | "asked" | "toldHow" | "gotBamboo" | "returned";
const REWARD_KI = 10;
const REWARD_MONEY = 100;
const questOf = (run: RunState): ShinaiQuest => run.shinaiQuest as ShinaiQuest;

export const oldShinaiFixed = (run: RunState): boolean => durabilityOf(run, "shinai") >= FULL_DURABILITY;
/** A dan grade is when Sensei starts to mind. */
export const senseiWantsItBack = (run: RunState): boolean => run.dan >= 1 && questOf(run) === "";
/** Fixing it is the only way back: having a better one of your own doesn't change what you owe. */
const canReturn = (run: RunState): boolean => !shinaiReturned(run) && run.madeShinai && oldShinaiFixed(run);

/** What Sensei has to say about the old shinai right now, if anything. Takes over from the usual menu when it does. */
export function senseiOnShinai(run: RunState): { lines: string[]; run: RunState } | null {
  if (senseiWantsItBack(run)) return { lines: SENSEI_WANTS_IT_BACK, run: { ...run, shinaiQuest: "asked" } };
  if (!canReturn(run)) return null;
  return { lines: returnLines(run.whyKendo), run: { ...run, shinaiQuest: "returned", wielded: "", bonusKi: run.bonusKi + REWARD_KI, money: run.money + REWARD_MONEY } };
}

/** A word in passing from Sensei, while you've still got it. */
export function senseiReminder(run: RunState): string | null {
  if (!questOf(run) || shinaiReturned(run)) return null;
  return run.madeShinai ? SENSEI_MINE_STILL_CRACKED : SENSEI_STILL_WAITING;
}

/** What Fumi says as you walk in. `build` means it's time to put your shinai together. */
export function shopArrival(run: RunState): { lines: string[]; run: RunState; build: boolean } | null {
  if (run.madeShinai) return null;
  const quest = questOf(run);
  if (quest === "asked") return { lines: FUMI_OFFER, run: { ...run, shinaiQuest: "toldHow" }, build: false };
  if (quest === "toldHow") return { lines: [FUMI_WAITING], run, build: false };
  if (quest === "gotBamboo") return { lines: FUMI_BUILD_START, run, build: true };
  return null;
}

/** What the Bogu Shop sells, and the regional shops' own pieces, which Fumi can tell apart at a glance. */
const FUMI_MADE: EquipmentId[] = ["fineShinai", "deerKote", "lacquerDo", "guardedShinai", "linedDo", "tunedShinai"];
const MADE_ELSEWHERE: EquipmentId[] = ["tideShinai", "blossomTare", "forgeDo", "mistMen"];

/**
 * Fumi noticing something as you walk in, once the shinai's been made: Sensei's shinai going home, and then what
 * you're wearing. Each is said once, and only about gear you've actually got equipped.
 */
export function fumiNotices(run: RunState): { lines: string[]; run: RunState } | null {
  if (!run.madeShinai) return null;
  const said = (key: string, line: string) => ({ lines: [line], run: { ...run, seen: [...run.seen, key] } });
  if (shinaiReturned(run) && !run.seen.includes("fumi:returned")) return said("fumi:returned", FUMI_RETURNED);
  const worn = Object.values(run.equipped).filter((id): id is EquipmentId => !!id);
  const mine = worn.find((id) => FUMI_MADE.includes(id));
  if (mine && !run.seen.includes("fumi:own")) return said("fumi:own", fumiOwnWork(equipmentInfo(mine).name));
  const theirs = worn.find((id) => MADE_ELSEWHERE.includes(id));
  if (theirs && !run.seen.includes("fumi:elsewhere")) return said("fumi:elsewhere", fumiElsewhere(equipmentInfo(theirs).name));
  return null;
}

/** Old Gen hands over the bamboo, if that's what you came for. */
export function genOnBamboo(run: RunState): { lines: string[]; run: RunState } | null {
  if (questOf(run) !== "toldHow") return null;
  return { lines: GEN_BAMBOO, run: { ...run, shinaiQuest: "gotBamboo" } };
}

export const stepIsRight = (step: number, answer: string): boolean => SHINAI_STEPS[step].right === answer;
/** You've made one, so it's the one you carry from now on. */
export const finishBuilding = (run: RunState): RunState => ({ ...run, madeShinai: true, wielded: "ownShinai" });

/** One short line saying what's next with the shinai, or null when there's nothing to do. */
export function shinaiObjective(run: RunState): string | null {
  if (shinaiReturned(run)) return null;
  if (run.madeShinai) return oldShinaiFixed(run) ? OBJECTIVES.shinaiReturn : OBJECTIVES.shinaiFix;
  if (senseiWantsItBack(run)) return OBJECTIVES.shinaiSeeSensei;
  if (questOf(run) === "asked") return OBJECTIVES.shinaiAskShop;
  if (questOf(run) === "toldHow") return OBJECTIVES.shinaiChoose;
  if (questOf(run) === "gotBamboo") return OBJECTIVES.shinaiBamboo;
  return null;
}
