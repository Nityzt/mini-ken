import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, onStage, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import type { Search } from "../net/service.ts";
import { ONLINE_CHAMPION, ONLINE_CONTINUE, ONLINE_DRAW_WAIT, ONLINE_NEXT, ONLINE_OUT, ONLINE_SEARCHING, ONLINE_TOURNAMENT, ONLINE_WITHDRAW, YOU } from "./content.ts";
import { drawBracket } from "./tournament.ts";

const NAME_ROOM = 7;

/** A tournament between matches: where you stand, and on to the next one. */
export function createOnlineBracketScene(): Scene {
  let search: Search | null = null;
  let tick = 0;

  const done = (game: Game) => {
    game.online.tournament = null;
    game.go("online");
  };

  return {
    outsideStory: () => true,
    forfeitLabel: (game) => (game.online.tournament?.status() === "playing" ? ONLINE_WITHDRAW : null),
    forfeit(game) {
      game.online.tournament?.leave();
      done(game);
    },
    enter(game) {
      tick = 0;
      search = null;
      if (!game.online.tournament) game.online.tournament = game.online.service.enterTournament();
      if (game.online.lastWon !== null) {
        game.online.tournament.report(game.online.lastWon);
        game.online.lastWon = null;
      }
    },
    update(game) {
      tick++;
      const session = game.online.tournament;
      if (!session) return;
      game.debug.onlineBracket = { status: session.status(), rounds: session.bracket()?.rounds.length ?? 0, searching: !!search };
      if (search) {
        const state = search.poll();
        if (state.kind === "found") {
          game.online.match = state.match;
          search = null;
          game.go("online-duel");
        } else if (state.kind === "failed") {
          search = null;
          done(game);
        }
        return;
      }
      if (session.status() === "waiting") return;
      if (!game.input.wasPressed("confirm")) return;
      if (session.status() === "playing") search = session.nextMatch();
      else done(game);
    },
    render(ctx, game) {
      drawDuelBackdrop(ctx, "arena");
      onGui(ctx, () => {
        const session = game.online.tournament;
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 20);
        drawText(ctx, ONLINE_TOURNAMENT, (viewW - measureText(ONLINE_TOURNAMENT) * 2) / 2, 2, UI.text, 2);
        if (!session) return;
        const bracket = session.bracket();
        const me = game.online.identity().id;
        if (bracket) {
          // Names have to fit a slot, and you're simply you.
          const rounds = bracket.rounds.map((round) => round.map((e) => (e.id === me ? { ...e, name: YOU, controller: "player" as const } : { ...e, name: e.name.slice(0, NAME_ROOM), controller: e.controller === "player" ? ("remote" as const) : e.controller })));
          onStage(ctx, () => drawBracket(ctx, { rounds }));
        }
        const status = session.status();
        const line = search ? ONLINE_SEARCHING : status === "champion" ? ONLINE_CHAMPION : status === "out" ? ONLINE_OUT : status === "waiting" ? ONLINE_DRAW_WAIT : ONLINE_NEXT;
        const hint = status === "playing" || status === "waiting" || search ? "" : ONLINE_CONTINUE;
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 22, viewW, 22);
        if (status !== "playing" || search || Math.floor(tick / 30) % 2 === 0) drawTextCentered(ctx, line, viewW / 2, viewH - 21, status === "champion" ? UI.accent : UI.text);
        if (hint) drawTextCentered(ctx, hint, viewW / 2, viewH - 11, UI.dim);
      });
    },
  };
}
