import type { Game } from "../core/scene.ts";
import { knockOut, whoHolds } from "../health.ts";
import { wakeUpLines } from "./chatter.ts";

/** Out of health. Everything you were doing stops, and you come round at home. */
export function goDown(game: Game, holder: string): void {
  const { run, taken } = knockOut(game.run, holder);
  const wake = wakeUpLines(run, taken, whoHolds(holder));
  game.run = wake.run;
  game.message = wake.lines;
  game.wokeUp = true;
  game.autoTo = null;
  game.versus = null;
  game.grading = null;
  game.go("club");
}
