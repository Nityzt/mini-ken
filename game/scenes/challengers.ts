import type { SceneName } from "../core/scene.ts";
import { raikoKeepsHisWord } from "../dungeon-story.ts";
import { isOpen } from "../progress.ts";
import { atLeastDan, danLabel } from "../ranks.ts";
import { recordWin, type RunState } from "../run-state.ts";
import type { DojoSenseiId, OpponentId } from "../world/dojos.ts";
import {
  HAGANE_AGAIN, HAGANE_INTRO, HAGANE_WIN, KAN_AGAIN, KAN_INTRO, KAN_WIN, MIZU_AGAIN, MIZU_INTRO, MIZU_WIN, NEMU_AGAIN, NEMU_INTRO, NEMU_WIN, RAIKO_AGAIN, RAIKO_INTRO, RAIKO_WIN,
  SENSEI_REMATCH, SENSEI_INTRO, SENSEI_WIN, SHIN_AGAIN, SHIN_INTRO, SHIN_WIN, TETSU_AGAIN, TETSU_INTRO, TETSU_WIN, challengerNotYet, exceptionLine,
} from "./content.ts";

export type ChallengerId = "sensei" | "tetsu" | "shin" | DojoSenseiId;
type Challenger = {
  name: string;
  /** The dan they want to see before they'll fight you. */
  needs: number;
  /** The dan a win over them is worth: an exception, which skips the grading. 0 if it's worth nothing but the win. */
  grants: number;
  home: SceneName;
  intro: string[];
  again: string[];
  win: string[];
};
const CHALLENGERS: Record<ChallengerId, Challenger> = {
  sensei: { name: "Sensei Kuma", needs: 0, grants: 1, home: "club", intro: SENSEI_INTRO, again: SENSEI_REMATCH, win: SENSEI_WIN },
  tetsu: { name: "Tetsu", needs: 1, grants: 2, home: "rival-dojo", intro: TETSU_INTRO, again: TETSU_AGAIN, win: TETSU_WIN },
  shin: { name: "Shin", needs: 2, grants: 3, home: "rival-dojo", intro: SHIN_INTRO, again: SHIN_AGAIN, win: SHIN_WIN },
  // Nobody's got anything to give you for these but the win. They just won't look at you until you've got a real rank.
  nemu: { name: "Sensei Nemu", needs: 2, grants: 0, home: "rival-dojo", intro: NEMU_INTRO, again: NEMU_AGAIN, win: NEMU_WIN },
  kan: { name: "Sensei Kan", needs: 2, grants: 0, home: "rival-dojo", intro: KAN_INTRO, again: KAN_AGAIN, win: KAN_WIN },
  mizu: { name: "Sensei Mizu", needs: 3, grants: 0, home: "rival-dojo", intro: MIZU_INTRO, again: MIZU_AGAIN, win: MIZU_WIN },
  hagane: { name: "Sensei Hagane", needs: 3, grants: 0, home: "rival-dojo", intro: HAGANE_INTRO, again: HAGANE_AGAIN, win: HAGANE_WIN },
  tama: { name: "Sensei Tama", needs: 1, grants: 0, home: "rival-dojo", intro: ["Sensei Tama: Let the tide come to you. Rei!"], again: ["Sensei Tama: Again, then. Rei!"], win: ["Sensei Tama: Well timed. Well fought."] },
  hoshi: { name: "Sensei Hoshi", needs: 1, grants: 0, home: "rival-dojo", intro: ["Sensei Hoshi: Stand tall and bend when you must. Rei!"], again: ["Sensei Hoshi: We can try again. Rei!"], win: ["Sensei Hoshi: Nicely done. You listened."] },
  raiko: { name: "Sensei Raiko", needs: 3, grants: 0, home: "rival-dojo", intro: RAIKO_INTRO, again: RAIKO_AGAIN, win: RAIKO_WIN },
};

export const isChallenger = (id: OpponentId | null): id is ChallengerId => id !== null && Object.hasOwn(CHALLENGERS, id);
export const challengerHome = (id: ChallengerId): SceneName => CHALLENGERS[id].home;

/** Sensei takes you seriously once you've beaten a senpai, which is also what opens the front door. */
export const canChallengeSensei = (run: RunState): boolean => isOpen(run, "door");

/** They only fight people of a certain rank. */
export function talkToChallenger(run: RunState, id: ChallengerId): { lines: string[]; fight: boolean } {
  const them = CHALLENGERS[id];
  if (run.dan < them.needs) return { lines: [challengerNotYet(them.name, danLabel(them.needs))], fight: false };
  return { lines: run.beaten.includes(id) ? them.again : them.intro, fight: true };
}

export function challengerWin(run: RunState, id: ChallengerId): { run: RunState; lines: string[] } {
  const them = CHALLENGERS[id];
  const next = atLeastDan(recordWin(run, id), them.grants);
  // Asked about Ren and then beaten, Raiko keeps his word, and hands over the key.
  const told = id === "raiko" ? raikoKeepsHisWord(next) : null;
  if (told) return { run: told.run, lines: [...them.win, ...told.lines] };
  return { run: next, lines: next.dan > run.dan ? [...them.win, exceptionLine(danLabel(next.dan))] : them.win };
}
