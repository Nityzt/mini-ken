import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawText, drawTextCentered, measureText, wrapText, LINE_HEIGHT } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_W, stageX, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { danLabel } from "../ranks.ts";
import { resumeScene } from "../save.ts";
import type { Search } from "../net/service.ts";
import { createMenu } from "./choice.ts";
import { ONLINE_BACK, ONLINE_CANCEL, ONLINE_DUEL, ONLINE_GATE, ONLINE_LIVE, ONLINE_PRACTICE, ONLINE_RECORD, ONLINE_SEARCHING, ONLINE_TITLE, ONLINE_TOURNAMENT, ONLINE_TUTORIAL, ONLINE_TUTORIAL_AGAIN } from "./content.ts";

const TITLE_Y = 26;

/** Choosing a kind of match, or being sent off to earn the right to. */
export function createOnlineScene(): Scene {
  const menu = createMenu();
  let search: Search | null = null;
  let failure: string | null = null;

  const back = (game: Game) => {
    const home = game.online.returnTo === "story" ? resumeScene(game.run) : "title";
    game.online.returnTo = "title";
    game.go(home);
  };
  const tutorial = (game: Game) => {
    game.session = { kind: "quick" };
    game.go("training");
  };
  const openMenu = (game: Game) => {
    const pick = (id: string) => {
      failure = null;
      if (id === "duel") search = game.online.service.findDuel();
      else if (id === "tournament") game.go("online-bracket");
      else if (id === "tutorial") tutorial(game);
      else back(game);
    };
    menu.open(
      game.online.access().open
        ? [{ id: "duel", label: ONLINE_DUEL }, { id: "tournament", label: ONLINE_TOURNAMENT }, { id: "tutorial", label: ONLINE_TUTORIAL_AGAIN }, { id: "back", label: ONLINE_BACK }]
        : [{ id: "tutorial", label: ONLINE_TUTORIAL }, { id: "back", label: ONLINE_BACK }],
      pick,
    );
  };

  return {
    outsideStory: () => true,
    enter(game) {
      search = null;
      failure = null;
      game.online.match = null;
      game.online.tournament = null;
      game.online.lastWon = null;
      openMenu(game);
    },
    update(game) {
      game.debug.online = { searching: !!search, open: game.online.access().open, failure };
      if (search) {
        if (game.input.wasPressed("cancel")) {
          search.cancel();
          search = null;
          openMenu(game);
          return;
        }
        const state = search.poll();
        if (state.kind === "found") {
          game.online.match = state.match;
          search = null;
          game.go("online-duel");
        } else if (state.kind === "failed") {
          failure = state.reason;
          search = null;
          openMenu(game);
        }
        return;
      }
      if (menu.active) menu.update(game.input);
      // Cancelling a menu with nowhere else to go just puts it back.
      else openMenu(game);
    },
    render(ctx, game) {
      drawDuelBackdrop(ctx, "arena");
      const { open } = game.online.access();
      const me = game.online.identity();
      const profile = game.online.profile();
      onGui(ctx, () => {
        const notice = open ? wrapText(failure ?? (game.online.service.live ? ONLINE_LIVE : ONLINE_PRACTICE), STAGE_W - 16) : wrapText(ONLINE_GATE, STAGE_W - 16);
        const noticeTop = TITLE_Y + (open ? 25 : 15);
        onStage(ctx, () => {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(-stageX(), TITLE_Y - 8, viewW, noticeTop + notice.length * LINE_HEIGHT - TITLE_Y + 12);
          drawText(ctx, ONLINE_TITLE, (STAGE_W - measureText(ONLINE_TITLE) * 2) / 2, TITLE_Y - 4, UI.text, 2);
          if (open) drawTextCentered(ctx, `${me.name}  ${danLabel(me.dan)}  ${ONLINE_RECORD(profile.wins, profile.losses)}`, STAGE_W / 2, TITLE_Y + 15, UI.accent);
          notice.forEach((line, i) => drawTextCentered(ctx, line, STAGE_W / 2, noticeTop + i * LINE_HEIGHT, failure ? UI.bad : UI.dim));
        });
        if (search) {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, viewH - 22, viewW, 22);
          drawTextCentered(ctx, ONLINE_SEARCHING, viewW / 2, viewH - 21, UI.accent);
          drawTextCentered(ctx, ONLINE_CANCEL, viewW / 2, viewH - 11, UI.dim);
          return;
        }
        menu.render(ctx);
      });
    },
  };
}
