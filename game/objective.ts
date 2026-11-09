import { gradingReady, hasTicket } from "./grading.ts";
import { dungeonObjective } from './dungeon-story.ts';
import { heldObjective } from "./health.ts";
import { gradingFee } from "./money.ts";
import { nextGoal, shortNeeds } from "./progress.ts";
import { hasLetter, danLabel } from "./ranks.ts";
import type { RunState } from "./run-state.ts";
import { pendingChallenge } from "./scenes/club-story.ts";
import { OBJECTIVES } from "./scenes/content.ts";
import { shinaiObjective } from "./scenes/shinai-story.ts";
import { homeVisitor } from "./scenes/visits.ts";

/** One short line saying what to do next. Empty when there's nothing left to chase. */
export function currentObjective(run: RunState): string {
  const dungeon = dungeonObjective(run);
  if (dungeon) return dungeon;
  if (!run.metSenpai) return OBJECTIVES.meetMomo;
  if (!run.gi) return OBJECTIVES.getGi;
  if (!run.gear.shinai) return OBJECTIVES.greetSensei;
  if (run.senseiRounds === 0) return OBJECTIVES.firstDrill;
  if (pendingChallenge(run) !== null) return OBJECTIVES.senpaiChallenge;
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
  const shinai = shinaiObjective(run);
  if (shinai) return shinai;
  const goal = nextGoal(run);
  if (goal) return `${goal.label}: ${shortNeeds(run, goal)}`;
  return run.champion ? "" : OBJECTIVES.grandTaikai;
}
