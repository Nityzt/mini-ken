import { findEgg } from "../money.ts";
import type { RunState } from "../run-state.ts";
import type { DojoId } from "../world/dojos.ts";

/** Practice notes tucked beside ordinary dojo furnishings, available even after a stash is collected. */
const NOTES: Record<DojoId, { tile: string; lines: string[] }> = {
  lantern: { tile: "r", lines: ["A salt-stained note: Tama keeps a steady rhythm. Watch the opening before committing your cut."] },
  bamboo: { tile: "p", lines: ["A note among the leaves: Hoshi waits patiently. Vary your timing and avoid rushing into a parry."] },
  goose: { tile: "p", lines: ["A crumpled practice note: Kan favors big men and often charges. Watch for an open side, then strike do and slide through."] },
  raccoon: { tile: "p", lines: ["A sleepy student's note: Nemu often goes for kote, with a long tell. Watch your wrist and answer their opening before the cut."] },
  heron: { tile: "r", lines: ["A note wedged in the rack: Hagane waits and parries. Vary your timing; show an opening, then block if they take the bait."] },
  otter: { tile: "p", lines: ["A damp note: Mizu keeps up a fast rhythm. Guard the rush, then answer an exposed target instead of chasing."] },
  radish: { tile: "r", lines: ["A folded note: Raiko mixes openings and attacks. The opening shows the target, not a promise of the next strike. Watch before committing."] },
};

export const senseiNote = (dojo: DojoId, tile: string): string[] | null => NOTES[dojo].tile === tile ? NOTES[dojo].lines : null;

/** A note and an unclaimed stash can share a furnishing without hiding either. */
export function inspectDojo(run: RunState, dojo: DojoId, tile: string): { run: RunState; lines: string[]; foundStash: boolean } | null {
  const egg = findEgg(run, dojo, tile);
  const note = senseiNote(dojo, tile);
  if (!egg && !note) return null;
  return { run: egg?.run ?? run, lines: [...(egg?.lines ?? []), ...(note ?? [])], foundStash: !!egg };
}
