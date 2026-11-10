import type { SceneName } from "./core/scene.ts";
import { lockFor, lockedLine, type UnlockId } from "./progress.ts";
import { gradingFee } from "./money.ts";
import { atLeastDan, danLabel, hasLetter, hasTicket, MAX_DAN, personDan } from "./ranks.ts";
import { gainXp, type RunState } from "./run-state.ts";
import {
  awayLost, awayOffer, awayTooJunior, awayWon, GRADING_DONE, GRADING_FAILED, gradingNotYet, gradingPassed, GRADING_ROUTES, KIHON_FAILED, KIHON_PASSED, LETTER_HELD, letterNo, letterTest, letterYes, panelNoFee, PANEL_NO_TICKET, panelOffer, RECOMMEND_LOST, recommendOffer, recommendRedirect, RECOMMEND_WON, TACHIAI_READY, TICKET_HELD, VERIFY_LOST, VERIFY_WON,
} from "./scenes/content.ts";
import type { SenpaiId } from "./scenes/curriculum.ts";
import { opponentById, type OpponentId } from "./world/dojos.ts";

export { hasTicket };

/** Where you are in getting a grade: the bout to earn a ticket, the one point that proves a letter, then the panel's two parts. */
export type GradingStage = "recommendation" | "verification" | "kihon" | "tachiai";
export type Asker = SenpaiId | "sensei";

/** Who you're paired with in front of the panel: another candidate, as in a real grading. */
const PARTNERS: Record<number, OpponentId> = { 1: "asa", 2: "ume", 3: "goro" };
const XP_RECOMMENDED = 30;
const XP_GRADING = 100;
/** Senpai can vouch for 1st dan. Past that, only Sensei can, and Sensei decides who tests you. */
const SENSEI_SENDS: Record<number, OpponentId> = { 1: "yui", 2: "momo", 3: "sensei" };
const ASKER_NAME: Record<SenpaiId, string> = { aki: "Aki", bo: "Bo", yui: "Yui" };
const TICKET_PLACES: SceneName[] = ["club", "map", "rival-dojo"];

export const gradingPartner = (dan: number): OpponentId => PARTNERS[dan];
export const canUseTicketIn = (scene: SceneName): boolean => TICKET_PLACES.includes(scene);

const rowFor = (dan: number) => `shinsa:${dan}` as UnlockId;
/** Whether it's worth asking about a grading right now. */
export const gradingReady = (run: RunState): boolean => run.dan < MAX_DAN && !hasTicket(run) && lockFor(run, rowFor(run.dan + 1)) === null;

/** Whether it's too soon to be sent for this rank, and what gets said about it if so. Being asked politely changes nothing. */
function gradingLock(run: RunState, next: number): string[] | null {
  const rank = danLabel(next);
  const lock = lockFor(run, rowFor(next));
  return lock ? [gradingNotYet(rank), lockedLine(run, lock), GRADING_ROUTES[next]] : null;
}

/** Asking someone at home to send you for grading. They'll want to see for themselves that you can represent the dojo. */
export function askToGrade(run: RunState, asker: Asker): { lines: string[]; fight: OpponentId | null } {
  if (run.dan >= MAX_DAN) return { lines: GRADING_DONE, fight: null };
  if (hasTicket(run)) return { lines: [TICKET_HELD], fight: null };
  const next = run.dan + 1;
  const lock = gradingLock(run, next);
  if (lock) return { lines: lock, fight: null };
  if (asker !== "sensei" && next > 1) return { lines: [recommendRedirect(ASKER_NAME[asker])], fight: null };
  if (asker === "sensei") return { lines: recommendOffer("Sensei Kuma", SENSEI_SENDS[next]), fight: SENSEI_SENDS[next] };
  return { lines: recommendOffer(ASKER_NAME[asker], asker), fight: asker };
}

/** Asking someone at another dojo. Whoever writes you a letter has to be at the rank you're after, or above it. */
export function askAway(run: RunState, who: OpponentId): { lines: string[]; fight: OpponentId | null } {
  if (run.dan >= MAX_DAN) return { lines: GRADING_DONE, fight: null };
  if (hasTicket(run)) return { lines: [TICKET_HELD], fight: null };
  if (hasLetter(run)) return { lines: [LETTER_HELD], fight: null };
  const next = run.dan + 1;
  const lock = gradingLock(run, next);
  if (lock) return { lines: lock, fight: null };
  const name = opponentById(who).rival;
  if (personDan(who) < next) return { lines: [awayTooJunior(name, danLabel(next))], fight: null };
  return { lines: [awayOffer(name)], fight: who };
}

/** How the bout went. At home, winning earns the ticket. Anywhere else, it earns a letter to bring home. It doesn't go on your record as anything else. */
export function recommendationOutcome(run: RunState, won: boolean, awayFrom?: string, by?: string): { run: RunState; lines: string[] } {
  if (awayFrom) return won ? { run: gainXp({ ...run, letter: run.dan + 1, letterFrom: awayFrom }, XP_RECOMMENDED), lines: [awayWon(awayFrom)] } : { run, lines: [awayLost(awayFrom)] };
  if (!won) return { run, lines: saidBy(by, RECOMMEND_LOST) };
  return { run: gainXp({ ...run, ticket: run.dan + 1 }, XP_RECOMMENDED), lines: saidBy(by, RECOMMEND_WON) };
}

/** Whoever just tested you says how it went, so it isn't you saying it. */
export const saidBy = (by: string | undefined, lines: string[]): string[] => (by ? lines.map((line) => `${by}: ${line}`) : lines);

/** How likely each person at home is to take a letter at its word, or want to test it. Whatever's left over is a no. */
const LETTER_ODDS: Record<Asker, { yes: number; test: number }> = {
  sensei: { yes: 0.45, test: 0.4 },
  aki: { yes: 0.6, test: 0.3 },
  bo: { yes: 0.35, test: 0.5 },
  yui: { yes: 0.2, test: 0.6 },
};

/** Showing someone at home your letter. They might take its word, or want one point to see for themselves, or say no. `roll` is a random number from 0 to 1. */
export function showLetter(run: RunState, asker: Asker, roll: number): { run: RunState; lines: string[]; fight: OpponentId | null } {
  const rank = run.letter;
  if (asker !== "sensei" && rank > 1) return { run, lines: [recommendRedirect(ASKER_NAME[asker])], fight: null };
  const odds = LETTER_ODDS[asker];
  const cleared = { ...run, letter: 0, letterFrom: "" };
  if (roll < odds.yes) return { run: { ...cleared, ticket: rank }, lines: [letterYes(asker, run.letterFrom)], fight: null };
  if (roll < odds.yes + odds.test) return { run, lines: [letterTest(asker, run.letterFrom)], fight: asker === "sensei" ? SENSEI_SENDS[rank] : asker };
  return { run: cleared, lines: [letterNo(asker, run.letterFrom)], fight: null };
}

/** How the one point went. Losing keeps your letter, so you can always ask again. */
export function verificationOutcome(run: RunState, won: boolean, by?: string): { run: RunState; lines: string[] } {
  return won ? { run: gainXp({ ...run, ticket: run.letter, letter: 0, letterFrom: "" }, XP_RECOMMENDED), lines: saidBy(by, VERIFY_WON) } : { run, lines: saidBy(by, VERIFY_LOST) };
}

/** What the panel says, and what comes next. It wants to see your basics, and then a bout. */
export function talkToPanel(run: RunState, stage: GradingStage | null): { lines: string[]; next: GradingStage | null; fight: OpponentId | null } {
  if (!hasTicket(run)) return { lines: PANEL_NO_TICKET, next: null, fight: null };
  const rank = run.dan + 1;
  if (stage === "tachiai") return { lines: TACHIAI_READY, next: "tachiai", fight: gradingPartner(rank) };
  const fee = gradingFee(rank);
  if (run.money < fee) return { lines: [panelNoFee(fee, run.money)], next: null, fight: null };
  return { lines: panelOffer(danLabel(rank), fee), next: "kihon", fight: null };
}

/** Paid when an attempt starts, and not given back whichever way it goes. The ticket stays yours until you pass. */
export const payGradingFee = (run: RunState): RunState => ({ ...run, money: run.money - gradingFee(run.dan + 1) });

export function kihonOutcome(passed: boolean): { lines: string[]; next: GradingStage | null } {
  return passed ? { lines: KIHON_PASSED, next: "tachiai" } : { lines: KIHON_FAILED, next: null };
}

/** How the bout went. Failing keeps your ticket, so you can try again without going home. */
export function gradingOutcome(run: RunState, passed: boolean): { run: RunState; lines: string[] } {
  if (!passed) return { run, lines: GRADING_FAILED };
  const dan = run.dan + 1;
  return { run: gainXp(atLeastDan(run, dan), XP_GRADING), lines: gradingPassed(danLabel(dan)) };
}
