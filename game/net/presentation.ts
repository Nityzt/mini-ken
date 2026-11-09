import type { DuelState } from "../duel/rules.ts";
import { RING_MIN, RING_MAX } from "../duel/constants.ts";
import type { DuelView } from "../scenes/duel.ts";
/** Only presentation rotates. Lockstep keeps the same fighters and simulation on both clients. */
export const onlineFlipped = (state: DuelState): boolean => (state.fighters[0].points + state.fighters[1].points) % 2 === 1;
export const onlineViewDuel = (state: DuelState): DuelState => onlineFlipped(state) ? { ...state, crossed: !state.crossed } : state;

export function onlineRenderView(view: DuelView): DuelView {
  if (!onlineFlipped(view.duel)) return view;
  const mirror = (x: number) => RING_MIN + RING_MAX - x;
  return {
    ...view,
    duel: onlineViewDuel(view.duel),
    fx: view.fx.map((fx) => ({ ...fx, x: mirror(fx.x), dir: (-fx.dir) as -1 | 1 })),
    dust: view.dust.map((puff) => ({ ...puff, x: mirror(puff.x) })),
    ghosts: view.ghosts.map((ghost) => ({ ...ghost, x: mirror(ghost.x), flip: !ghost.flip })),
    floaters: view.floaters.map((floater) => ({ ...floater, x: mirror(floater.x) })),
  };
}
