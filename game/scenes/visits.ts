import { isOpen } from "../progress.ts";
import type { RunState } from "../run-state.ts";
import { DOJOS, dojoFor, type DojoId } from "../world/dojos.ts";
import { REN_AT_OTTER_LESSON, REN_AT_OTTER_NO_LESSON, REN_BOGU, REN_FINAL_GAZE, REN_FIRST, renNoticesTare, REN_POINT_LESSON, REN_POINT_LESSON_AFTER, REN_POINT_LOST, REN_POINT_WON, REN_READY, REN_TEA, SORA_NAP, SORA_NAP_AGAIN, SORA_REMEMBERS, VISITOR_LINES } from "./content.ts";

/** You meet the people you'll fight long before you fight them. All of it is plain state, so it survives a refresh. */

export type HomeVisitor = "ren" | "sora";
export type Talk = {
  lines: string[];
  run: RunState;
  /** Ren's one point starts when this conversation ends. */
  fight: boolean;
  /** The far-mountain gaze is yours when these lines end. */
  teaches: boolean;
  /** What gets said once you've got it. */
  after?: string[];
};

const SEEN_FIRST = "ren-tare";
const SEEN_BOGU = "ren-bogu";
const SEEN_POINT_LOST = "ren-point-lost";
const SEEN_POINT_WON = "ren-point-won";
const SEEN_SORA_WOKEN = "sora-woken";

const hasSeen = (run: RunState, id: string) => run.seen.includes(id);
const markSeen = (run: RunState, id: string): RunState => (hasSeen(run, id) ? run : { ...run, seen: [...run.seen, id] });

/** Who's standing around at home right now, if anyone. */
export function homeVisitor(run: RunState): HomeVisitor | null {
  if (run.beaten.includes("radish")) return null;
  if (run.trained && !run.gaze) return "ren";
  if (run.gear.tare && !run.gear.do && !run.trained) return "ren";
  if (run.trained && isOpen(run, "door") && !run.beaten.includes("raccoon")) return "sora";
  return null;
}

/** Once that one point's been played, Ren explains it. It stays unlearned until they've finished, so a refresh can't lose it. */
function lessonFor(run: RunState): Talk | null {
  const won = hasSeen(run, SEEN_POINT_WON);
  if (run.gaze || !(won || hasSeen(run, SEEN_POINT_LOST))) return null;
  return { lines: [won ? REN_POINT_WON : REN_POINT_LOST, ...REN_POINT_LESSON], after: REN_POINT_LESSON_AFTER, run, fight: false, teaches: true };
}

/** What plays by itself the first time you walk in on a visitor. Sora's asleep, so nothing does. */
export function homeArrival(run: RunState): Talk | null {
  if (homeVisitor(run) !== "ren") return null;
  const lesson = lessonFor(run);
  if (lesson) return lesson;
  if (run.trained) return hasSeen(run, SEEN_BOGU) ? null : { lines: REN_BOGU, run: markSeen(run, SEEN_BOGU), fight: true, teaches: false };
  if (hasSeen(run, SEEN_FIRST)) return null;
  // Ren walks over, says who they are, and only then looks you up and down.
  const [walksOver, introduces, ...after] = REN_FIRST;
  return { lines: [walksOver, introduces, renNoticesTare(run.insignia.symbol), ...after], run: markSeen(run, SEEN_FIRST), fight: false, teaches: false };
}

/** Walking up to a visitor and pressing E. */
export function talkToVisitor(run: RunState): Talk {
  // Sora says it all the first time, and after that just rolls over.
  if (homeVisitor(run) === "sora") return { lines: hasSeen(run, SEEN_SORA_WOKEN) ? [SORA_NAP_AGAIN] : SORA_NAP, run: markSeen(run, SEEN_SORA_WOKEN), fight: false, teaches: false };
  const lesson = lessonFor(run);
  if (lesson) return lesson;
  if (run.trained) return { lines: [REN_READY], run: markSeen(run, SEEN_BOGU), fight: true, teaches: false };
  return { lines: [REN_TEA], run: markSeen(run, SEEN_FIRST), fight: false, teaches: false };
}

/** However that one point went, Ren will show you how it was done. It never counts as a win or a loss. */
export const renPointOutcome = (run: RunState, won: boolean): RunState => markSeen(run, won ? SEEN_POINT_WON : SEEN_POINT_LOST);
export const learnGaze = (run: RunState): RunState => ({ ...run, gaze: true });

/** In each dojo, once you've beaten its head, whoever's next has come to have a look at you. */
type Visiting = "goose" | "heron" | "otter" | "radish";
const NEXT_BOSS: Partial<Record<DojoId, Visiting>> = { raccoon: "goose", goose: "heron", heron: "otter", otter: "radish" };

/** A patch of floor that's free in every rival's dojo, and high enough that you can see who's talking over the dialogue box. */
export const VISITOR_SPOT = { col: 13, row: 3 };
export const roomWithVisitor = (room: string[]): string[] =>
  room.map((line, row) => (row === VISITOR_SPOT.row ? line.slice(0, VISITOR_SPOT.col) + "V" + line.slice(VISITOR_SPOT.col + 1) : line));

export function dojoVisitor(run: RunState, host: DojoId): Visiting | null {
  const next = NEXT_BOSS[host];
  return next && run.beaten.includes(host) && !run.beaten.includes(next) ? next : null;
}

const visitorLines = (run: RunState, visitor: Visiting): string[] =>
  visitor === "radish" ? (run.gaze ? REN_AT_OTTER_LESSON : REN_AT_OTTER_NO_LESSON) : VISITOR_LINES[visitor];

/** What a dojo's visitor says when you walk up to them. */
export const talkToDojoVisitor = visitorLines;

/** What plays by itself the first time you meet them, just after your win. */
export function dojoArrival(run: RunState, host: DojoId): { lines: string[]; run: RunState } | null {
  const visitor = dojoVisitor(run, host);
  const id = `visit:${host}`;
  if (!visitor || hasSeen(run, id)) return null;
  return { lines: visitorLines(run, visitor), run: markSeen(run, id) };
}

/** How a dojo's head greets you. Ren remembers. */
export function challengeLines(run: RunState, id: DojoId): string[] {
  if (id === "radish" && run.gaze) return REN_FINAL_GAZE;
  // Sora told you to come at Pinecone, so a Sora who's met you knows who's turned up.
  if (id === "raccoon" && hasSeen(run, SEEN_SORA_WOKEN)) return [SORA_REMEMBERS, ...DOJOS.raccoon.challenge.slice(1)];
  return DOJOS[id].challenge;
}
