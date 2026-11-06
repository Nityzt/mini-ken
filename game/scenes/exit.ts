import type { Game } from "../core/scene.ts";
import { lockFor } from "../progress.ts";
import type { RunState } from "../run-state.ts";
import { NODES, type NodeId, type Route } from "../world/map.ts";
import { destinations } from "../world/routes.ts";
import type { ChoiceOption, Menu } from "./choice.ts";
import { EXIT_WALK, exitOption } from "./content.ts";

/** A line you could actually ride right now. */
export const canRide = (run: RunState) => (route: Route): boolean => !route.line || lockFor(run, route.line) === null;

const OUTSIDE = "outside";

/** Walking out the door, or setting off for anywhere you've already been. */
export const exitChoices = (run: RunState): ChoiceOption[] => [
  { id: OUTSIDE, label: EXIT_WALK },
  ...destinations(run, canRide(run)).filter((id) => lockFor(run, id) === null).map((id) => ({ id, label: exitOption(NODES[id].name) })),
];

/** Pressing E at the door. With nowhere else to go yet, there's nothing to ask. */
export function leaveDojo(game: Game, menu: Menu): void {
  const options = exitChoices(game.run);
  if (options.length === 1) {
    game.go("map");
    return;
  }
  menu.open(options, (id) => {
    if (id !== OUTSIDE) game.autoTo = id as NodeId;
    game.go("map");
  });
}
