import { measureText } from "./art/font.ts";
import { STAGE_W } from "./core/scale.ts";
import { danLabel, levelOf, rankLabel, xpToNextLevel } from "./ranks.ts";
import { playerKiMax, type RunState } from "./run-state.ts";
import { PROGRESS_CHAMPION } from "./scenes/content.ts";
import { DOJOS, type DojoId } from "./world/dojos.ts";
import { GANGS, type NodeId, type TransitLine } from "./world/map.ts";
import type { CupId } from "./world/tournament.ts";

/** Sensei wants to see this many good runs of the line drill before you go near a street fight. */
export const LINE_PASSES_TO_UNLOCK = 3;

export type UnlockId = NodeId | TransitLine | "door" | "online" | `cup:${Exclude<CupId, "grand">}` | `shinsa:${number}`;
export type Unlock = {
  id: UnlockId;
  label: string;
  /** How much ki you need. */
  ki?: number;
  /** Needs the line drill passed. */
  line?: boolean;
  /** Needs seme. */
  seme?: boolean;
  /** Needs at least this dan. */
  rank?: number;
  /** Needs Sensei's lesson on the parry, the lock and crossing. */
  waza?: boolean;
  /** Needs a win over any senpai. */
  senpai?: boolean;
  /** Needs a win over each of these rivals. */
  beat?: DojoId[];
  /** Needs this open too, because it's the only way there. */
  via?: UnlockId;
};

/** What opens up, and what it takes, in the order Sensei will point you at it. A new dojo or fight is one more row here. */
export const LADDER: Unlock[] = [
  { id: "door", label: "The city", senpai: true },
  { id: "cup:pinecone", label: "Pinecone Cup", line: true, senpai: true },
  { id: "market", label: "Market Street fight", line: true },
  { id: "ravine", label: "Old Gen", line: true, ki: 125 },
  { id: "parkLine", label: "Streetcar to Cherry Park", line: true },
  { id: "bridge", label: "Viaduct fight", line: true, ki: 135 },
  { id: "raccoon", label: "Sora at Sleepy Raccoon", ki: 145, via: "parkLine" },
  { id: "shinsa:1", label: "1st dan grading", line: true, waza: true, beat: ["raccoon"] },
  { id: "online", label: "Multiplayer", rank: 1, waza: true },
  { id: "cup:raccoon", label: "Raccoon Open", beat: ["raccoon"] },
  { id: "wharf", label: "Harbour fight", line: true, ki: 145 },
  { id: "picnic", label: "Picnic fight", line: true, ki: 155, via: "parkLine" },
  { id: "beachLine", label: "Streetcar to the beach", beat: ["raccoon"] },
  { id: "boardwalk", label: "Boardwalk fight", line: true, ki: 165, via: "beachLine" },
  { id: "goose", label: "Hana at Angry Goose", rank: 1, seme: true, ki: 170, via: "beachLine" },
  { id: "station", label: "Commuter train", beat: ["goose"] },
  { id: "shinsa:2", label: "2nd dan grading", rank: 1, beat: ["goose"] },
  { id: "cup:goose", label: "Goose Open", rank: 1, beat: ["goose"] },
  { id: "foundry", label: "Foundry fight", line: true, ki: 185, via: "station" },
  { id: "heron", label: "Mika at Iron Heron", rank: 2, ki: 190, via: "station" },
  { id: "fallsLine", label: "Train to Misty Falls", beat: ["heron"] },
  { id: "cup:heron", label: "Heron Open", rank: 2, beat: ["heron"] },
  { id: "gorge", label: "Gorge fight", line: true, ki: 205, via: "fallsLine" },
  { id: "otter", label: "Kenji at Soggy Otter", rank: 2, ki: 210, via: "fallsLine" },
  { id: "cup:otter", label: "Otter Open", rank: 2, beat: ["otter"] },
  { id: "shinsa:3", label: "3rd dan grading", rank: 2, beat: ["heron", "otter"] },
  { id: "radish", label: "Ren, the last dojo", rank: 3, seme: true, ki: 230, beat: ["raccoon", "goose", "heron", "otter"] },
  { id: "arenaLine", label: "Train to the Grand Arena", beat: ["radish"] },
  { id: "cup:radish", label: "Thunder Open", beat: ["radish"] },
];

const beatenSenpai = (run: RunState) => run.beaten.some((id) => id === "aki" || id === "bo" || id === "yui");

/** What this still needs, in a few words each. Empty once it's open. */
export function unmet(run: RunState, unlock: Unlock): string[] {
  const missing: string[] = [];
  if (unlock.senpai && !beatenSenpai(run)) missing.push("beat a senpai");
  if (unlock.line && run.linePasses < LINE_PASSES_TO_UNLOCK) missing.push(`line drill ${run.linePasses}/${LINE_PASSES_TO_UNLOCK}`);
  // Anyone who got their 1st dan before this was asked of them keeps it, and only needs it for what comes with the rank.
  if (unlock.waza && !run.waza && (unlock.rank || run.dan < 1)) missing.push("waza lesson");
  if (unlock.ki !== undefined && playerKiMax(run) < unlock.ki) missing.push(`ki ${unlock.ki}`);
  if (unlock.rank && run.dan < unlock.rank) missing.push(danLabel(unlock.rank));
  if (unlock.seme && !run.seme) missing.push("seme");
  const toBeat = (unlock.beat ?? []).filter((id) => !run.beaten.includes(id));
  if (toBeat.length === 1) missing.push(`beat ${DOJOS[toBeat[0]].rival}`);
  else if (toBeat.length > 1) missing.push(`${toBeat.length} wins`);
  const way = unlock.via && find(unlock.via);
  if (way) for (const need of unmet(run, way)) if (!missing.includes(need)) missing.push(need);
  return missing;
}

const find = (id: UnlockId) => LADDER.find((unlock) => unlock.id === id);

/** The row keeping this shut, or null if it's open. Anything not on the ladder is always open. */
export function lockFor(run: RunState, id: UnlockId): Unlock | null {
  const unlock = find(id);
  return unlock && unmet(run, unlock).length > 0 ? unlock : null;
}
export const isOpen = (run: RunState, id: UnlockId): boolean => lockFor(run, id) === null;

/** What to work toward. Street fights and multiplayer open up along the way, but they're never the thing you're told to do. */
export const nextGoal = (run: RunState): Unlock | null => LADDER.find((unlock) => !GANGS[unlock.id] && unlock.id !== "online" && unmet(run, unlock).length > 0) ?? null;

/** Sensei's way of saying what's next. */
export function needsSentence(run: RunState, unlock: Unlock): string {
  const needs = unmet(run, unlock).map((need) => (need.startsWith("ki ") ? `${need} (you have ${playerKiMax(run)})` : need));
  return `Sensei Kuma: Next for you: ${unlock.label}. Still to do: ${needs.join(", ")}.`;
}

/** The techniques you've picked up so far, in the order they're taught. */
export function techniques(run: RunState): string[] {
  const known: string[] = [];
  if (run.senseiRounds >= 1) known.push("men");
  if (run.senseiRounds >= 2) known.push("do");
  if (run.senseiRounds >= 3) known.push("kote", "launch");
  if (run.seme) known.push("seme", "kiai");
  if (run.gaze) known.push("gaze");
  return known;
}

const ROW_WIDTH = STAGE_W - 16;

/** Where you stand, in one row. A champion has no room for how far it is to the next level, or much need of it. */
export function standingLine(run: RunState): string {
  const level = `Lv ${levelOf(run.xp)}`;
  const ki = `Ki ${playerKiMax(run)}`;
  if (run.champion) return `${rankLabel(run)}  ${level}  ${ki}  ${PROGRESS_CHAMPION}`;
  return `${rankLabel(run)}  ${level} (${xpToNextLevel(run.xp)} to next)  ${ki}`;
}

/** As much of what's needed as fits on one row of the progress page, most immediate first. */
export function shortNeeds(run: RunState, unlock: Unlock): string {
  let text = "";
  for (const need of unmet(run, unlock)) {
    const next = text ? `${text}, ${need}` : need;
    if (measureText(`${unlock.label}  ${next}`) > ROW_WIDTH) break;
    text = next;
  }
  return text;
}

const WINDOW_ROWS = 10;
const WINDOW_LOOKBACK = 2;

/** The part of the ladder worth showing: a little of what you've done, then what's next. */
export function ladderWindow(run: RunState): Unlock[] {
  const next = LADDER.findIndex((unlock) => unmet(run, unlock).length > 0);
  const end = next < 0 ? LADDER.length : next;
  const start = Math.max(0, Math.min(end - WINDOW_LOOKBACK, LADDER.length - WINDOW_ROWS));
  return LADDER.slice(start, start + WINDOW_ROWS);
}

/** What a locked place tells you when you try it. */
export const lockedLine = (run: RunState, unlock: Unlock): string => `Not yet. ${unlock.label}. Still to do: ${unmet(run, unlock).join(", ")}.`;

/** Whatever this change of state just opened up. */
export const newlyOpened = (before: RunState, after: RunState): Unlock[] =>
  LADDER.filter((unlock) => unmet(before, unlock).length > 0 && unmet(after, unlock).length === 0);
