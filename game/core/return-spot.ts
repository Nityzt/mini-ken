import type { NodeId } from "../world/map.ts";
import type { SceneName } from "./scene.ts";

/** Rooms you walk around in, which remember where you were standing while you're away at a drill or a fight. */
const ROOMS: SceneName[] = ["club", "rival-dojo", "grading-hall"];
/** Drills and fights, which happen right where you were and then hand you back. */
const SET_PIECES: SceneName[] = ["training", "line", "kirikaeshi", "duel", "tournament", "dungeon"];

/** The room you stepped out of for a drill or a fight, and at which place on the map. */
export type Spot = { room: SceneName; node: NodeId } | null;

/**
 * Follows one change of scene. Leaving a room for a drill or fight notes where it was, and drills or fights in a row
 * (a cup's matches, say) keep the note. Arriving back in that same room at that same place is `returning`, so you're
 * still standing where you were. Going anywhere else, like the map, forgets it: the next arrival is a fresh one.
 */
export function stepSpot(spot: Spot, from: SceneName, to: SceneName, node: NodeId): { spot: Spot; returning: boolean } {
  if (SET_PIECES.includes(to)) {
    if (ROOMS.includes(from)) return { spot: { room: from, node }, returning: false };
    if (SET_PIECES.includes(from)) return { spot, returning: false };
    return { spot: null, returning: false };
  }
  const returning = SET_PIECES.includes(from) && spot !== null && spot.room === to && spot.node === node;
  return { spot: null, returning };
}
