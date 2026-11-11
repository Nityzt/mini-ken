import { gradingReady, hasTicket } from "./grading.ts";
import { dungeonObjective, renHuntObjective } from './dungeon-story.ts';
import { heldObjective } from "./health.ts";
import { GEAR_KI_CAP, equipmentKi } from "./equipment.ts";
import { isOpen, LADDER, nextGoal, shortNeeds, unmet, type Unlock } from "./progress.ts";
import { hasLetter, danLabel } from "./ranks.ts";
import { KIRIKAESHI_REWARDED_PASSES, LINE_REWARDED_PASSES, playerKiMax, type RunState } from "./run-state.ts";
import { freeSenpaiNames, pendingChallenge } from "./scenes/club-story.ts";
import { OBJECTIVES } from "./scenes/content.ts";
import { shinaiObjective } from "./scenes/shinai-story.ts";
import { homeVisitor } from "./scenes/visits.ts";
import { routesFrom, type NodeId } from "./world/map.ts";
import { CUP_IDS, CUPS, type CupId } from "./world/tournament.ts";
import { measureText } from "./art/font.ts";
import { STAGE_W } from "./core/scale.ts";
import { CHALLENGES, gradingFee } from "./money.ts";

/** One short line saying what to do next, or after the Grand Taikai, what's still open. */
export function currentObjective(run: RunState): string {
  const dungeon = dungeonObjective(run);
  if (dungeon) return dungeon;
  if (!run.metSenpai) return OBJECTIVES.meetMomo;
  if (!run.gi) return OBJECTIVES.getGi;
  if (!run.gear.shinai) return OBJECTIVES.greetSensei;
  if (run.senseiRounds === 0) return OBJECTIVES.firstDrill;
  if (pendingChallenge(run) !== null) return OBJECTIVES.senpaiChallenge(freeSenpaiNames(run));
  if (!run.trained) return OBJECTIVES.nextLesson;
  if (homeVisitor(run) === "ren") return OBJECTIVES.renPoint;
  const held = heldObjective(run);
  if (held) return held;
  if (hasTicket(run)) {
    const fee = gradingFee(run.dan + 1);
    return run.money < fee ? OBJECTIVES.feeShort(fee, run.money) : OBJECTIVES.useTicket;
  }
  if (hasLetter(run)) return OBJECTIVES.showLetter;
  if (gradingReady(run)) return OBJECTIVES.grading(danLabel(run.dan + 1));
  // Sensei's old shinai is an errand, and nothing on the ladder waits on it, so it never takes the line from the ladder.
  // It's named as a way to more ki, and once the ladder's done, as something left to do.
  // With Ren hidden, the ladder's "beat Ren" isn't something to do yet: finding Ren is.
  const hunt = renHuntObjective(run);
  if (hunt) return hunt;
  const goal = nextGoal(run);
  if (goal) {
    const step = stepBefore(run, goal);
    if (step) return step;
    const left = unmet(run, goal);
    const need = goal.ki ?? 0;
    // A ki number alone isn't something to do, so name somewhere to go and get it.
    if (left.length === 1 && left[0] === `ki ${need}`) return OBJECTIVES.moreKi(playerKiMax(run), need, kiSource(run));
    return `${goal.label}: ${shortNeeds(run, goal)}`;
  }
  if (!run.champion) return OBJECTIVES.grandTaikai;
  return stillOpen(run);
}

const LINE_ROOM = STAGE_W - 14;
/**
 * After the Grand Taikai there's no next step, only what's left: the shinai errand, a cup not won, challenges,
 * the trial at Thunder Radish, and other players online. As many as fit, in that order, with online always last.
 */
export function stillOpen(run: RunState): string {
  const parts: string[] = [];
  if (shinaiObjective(run)) parts.push(OBJECTIVES.leftShinai);
  const cup = CUP_IDS.find((id) => id !== "grand" && !run.cups.includes(id));
  if (cup) parts.push(CUPS[cup].name);
  const challenges = CHALLENGES.filter((challenge) => !challenge.done(run)).length;
  if (challenges) parts.push(OBJECTIVES.leftChallenges(challenges));
  if (run.dungeon.stage !== "escaped") parts.push(run.beaten.includes("raiko") ? OBJECTIVES.leftTrial : OBJECTIVES.leftRaiko);
  const line = (shown: string[]) => OBJECTIVES.stillOpen([...shown, OBJECTIVES.leftOnline]);
  while (parts.length && measureText(line(parts)) > LINE_ROOM) parts.pop();
  return line(parts);
}

const SENPAI = ["aki", "bo", "yui"] as const;
const STOPS: NodeId[] = ["stop", "station"];

/** Where a line goes, and on what, so riding it can be the next thing to do. */
const lineTrip = (line: string) => {
  for (const from of STOPS) for (const route of routesFrom(from)) if (route.line === line) return route;
  return null;
};

/**
 * Something already open on the way to the goal that you haven't done yet: Old Gen, or a ride somewhere new.
 * Without this, winning a cup could skip the line straight past both to a ki number.
 */
function stepBefore(run: RunState, goal: Unlock): string | null {
  for (const unlock of LADDER.slice(0, LADDER.indexOf(goal))) {
    if (!isOpen(run, unlock.id)) continue;
    if (unlock.id === "ravine" && !run.seme) return OBJECTIVES.seeGen;
    const trip = lineTrip(unlock.id);
    if (trip && !run.visited.includes(trip.to)) return OBJECTIVES.ride(unlock.label);
  }
  return null;
}

/** The surest open way to more ki right now, other than a street fight. */
export function kiSource(run: RunState): string {
  if (!run.blessed) return OBJECTIVES.kiTower;
  if (run.kirikaeshiPasses < KIRIKAESHI_REWARDED_PASSES) return OBJECTIVES.kiKirikaeshi;
  if (run.linePasses < LINE_REWARDED_PASSES) return OBJECTIVES.kiLine;
  if (SENPAI.some((id) => !run.beaten.includes(id))) return OBJECTIVES.kiSenpai;
  const cup = LADDER.find((unlock) => unlock.id.startsWith("cup:") && isOpen(run, unlock.id) && !run.cups.includes(unlock.id.slice(4) as CupId));
  if (cup) return OBJECTIVES.kiCup(cup.label);
  if (shinaiObjective(run)) return OBJECTIVES.kiShinai;
  if (equipmentKi(run) < GEAR_KI_CAP) return OBJECTIVES.kiGear;
  return OBJECTIVES.kiLevels;
}
