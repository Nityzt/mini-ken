import type { Game } from "../core/scene.ts";
import { betStakes, placeBet } from "../money.ts";
import type { OpponentId } from "../world/dojos.ts";
import type { Menu } from "./choice.ts";
import { BET_NONE, betLabel } from "./content.ts";

/** Before a match you've chosen, a chance to put money on yourself. With nothing to bet, it goes straight to the match. */
export function offerBet(menu: Menu, game: Game, opponent: OpponentId, start: () => void): void {
  const stakes = betStakes(game.run, opponent);
  if (!stakes.length) {
    start();
    return;
  }
  menu.open([{ id: "0", label: BET_NONE }, ...stakes.map((stake) => ({ id: `${stake}`, label: betLabel(stake) }))], (id) => {
    const stake = Number(id);
    if (stake) {
      game.run = placeBet(game.run, stake);
      game.bet = stake;
    }
    start();
  });
}
