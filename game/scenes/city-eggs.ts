import { earn } from '../money.ts';
import type { RunState } from '../run-state.ts';
import type { NodeId } from '../world/map.ts';

/** Unmarked discoveries reward a closer look at the quieter corners of the city. */
const CITY_EGGS: Partial<Record<NodeId, string>> = {
  beachGarden: 'A tiny paper lantern tucked among the beach grass. Under it: 25 kensen!',
  parkGrove: 'A painted pebble under the cherry tree. Someone left 25 kensen beside it!',
  steelAlley: 'A little clockwork bird chirps from a crate. Its nest holds 25 kensen!',
  fallsPool: 'A smooth stone skips across the pool all by itself. On the bank: 25 kensen!',
};

export function findCityEgg(run: RunState, node: NodeId): { run: RunState; lines: string[] } | null {
  const line = CITY_EGGS[node];
  const key = `city-egg:${node}`;
  if (!line || run.seen.includes(key)) return null;
  const paid = earn(run, 25);
  return { run: { ...paid, seen: [...paid.seen, key] }, lines: [line] };
}
