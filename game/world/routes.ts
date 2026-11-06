import type { RunState } from "../run-state.ts";
import { DIRECTIONS, neighbor, NODES, routesFrom, type Direction, type NodeId, type Route, type WorldNode } from "./map.ts";

export type Step = { kind: "walk"; to: NodeId; dir: Direction } | { kind: "ride"; route: Route };

const landing = (step: Step): NodeId => (step.kind === "walk" ? step.to : step.route.to);

/** The fewest steps from one place to another, over roads that are open and lines that are running. Null if there's no way. */
export function stepsTo(from: NodeId, to: NodeId, cleared: readonly string[], canRide: (route: Route) => boolean): Step[] | null {
  const reached = new Map<NodeId, Step[]>([[from, []]]);
  const queue: NodeId[] = [from];
  while (queue.length) {
    const here = queue.shift()!;
    const sofar = reached.get(here)!;
    if (here === to) return sofar;
    const next: Step[] = [
      ...DIRECTIONS.flatMap((dir): Step[] => {
        const there = neighbor(here, dir, cleared);
        return there ? [{ kind: "walk", to: there, dir }] : [];
      }),
      ...routesFrom(here).filter(canRide).map((route): Step => ({ kind: "ride", route })),
    ];
    for (const step of next) {
      const there = landing(step);
      if (reached.has(there)) continue;
      reached.set(there, [...sofar, step]);
      queue.push(there);
    }
  }
  return null;
}

/** Saves from before this was tracked still know about home and anywhere you've won. */
export function placesBeen(run: Pick<RunState, "visited" | "cleared" | "beaten" | "node">): NodeId[] {
  const named: string[] = ["pinecone", run.node, ...run.visited, ...run.cleared, ...run.beaten];
  return [...new Set(named)].filter((id): id is NodeId => Object.hasOwn(NODES, id));
}

/** Somewhere you'd actually set out for. Crossings and stops are just on the way. */
const WORTH_GOING: WorldNode["kind"][] = ["dojo", "store", "master", "tower", "tournament", "gang"];

/** Everywhere you could set off for from here, nearest first. */
export function destinations(run: RunState, canRide: (route: Route) => boolean): NodeId[] {
  return placesBeen(run)
    .filter((id) => id !== run.node && WORTH_GOING.includes(NODES[id].kind))
    .map((id) => ({ id, steps: stepsTo(run.node, id, run.cleared, canRide) }))
    .filter((place): place is { id: NodeId; steps: Step[] } => place.steps !== null)
    .sort((a, b) => a.steps.length - b.steps.length)
    .map((place) => place.id);
}
