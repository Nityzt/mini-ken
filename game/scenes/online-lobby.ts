import { instructionText } from "../core/key-labels.ts";
import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawText, drawTextCentered, measureText, wrapText, LINE_HEIGHT } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_W, stageX, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { inviteLink, stepCodeEntry } from "../net/invite.ts";
import { ONLINE_TITLE } from "./content.ts";
import { closedLine, LOBBY_CONTINUE, LOBBY_COPIED, LOBBY_COPY, LOBBY_JOINING, LOBBY_LEAVE, LOBBY_OPPONENT_HERE, LOBBY_REMATCH, LOBBY_REMATCH_ASKED, LOBBY_THEY_WANT, LOBBY_TYPE_CODE, LOBBY_TYPE_HELP, LOBBY_WAITING, LOBBY_WAITING_VISIBLE, ONLINE_CONNECTING, outcomeLine } from "./online-lines.ts";

const TOP = 34;

/** Waiting for a friend, typing their code, or between matches. The socket carries on regardless of this screen. */
export function createOnlineLobbyScene(): Scene {
  let typing = false;
  let code = "";
  let copied = false;
  let copiedLink = "";

  const leave = (game: Game) => {
    game.online.lobby?.leave();
    game.online.lobby = null;
    game.go("online");
  };
  const copy = (lobbyCode: string) => {
    const link = inviteLink(location.origin, lobbyCode);
    copiedLink = link;
    copied = false;
    // Without a clipboard, the link stays on screen to copy by hand.
    void navigator.clipboard?.writeText(link).then(() => {
      copied = true;
    }, () => {});
  };

  return {
    outsideStory: () => true,
    neverPauses: () => true,
    typing: () => typing,
    enter(game) {
      copied = false;
      copiedLink = "";
      const intent = game.online.lobbyIntent;
      typing = intent.kind === "type-code";
      code = "";
      if (intent.kind === "create") game.online.lobby = game.online.service.lobby();
      else if (intent.kind === "join") game.online.lobby = game.online.service.lobby(intent.code);
      game.online.lobbyIntent = { kind: "return" };
    },
    update(game) {
      if (typing) {
        const step = stepCodeEntry(code, game.input.typed());
        code = step.text;
        if (step.done === "back") {
          typing = false;
          game.go("online");
        } else if (step.done === "join") {
          typing = false;
          game.online.lobby = game.online.service.lobby(code);
        }
        return;
      }
      const lobby = game.online.lobby;
      if (!lobby) {
        game.go("online");
        return;
      }
      const state = lobby.state();
      game.debug.lobby = state.kind;
      const { input } = game;
      if (state.kind === "match") {
        // It's a new match only until the duel's been shown it.
        if (game.online.match !== state.match) {
          game.online.match = state.match;
          game.go("online-duel");
        }
        return;
      }
      if (state.kind === "closed") {
        if (input.wasPressed("confirm") || input.wasPressed("cancel")) {
          game.online.lobby = null;
          game.go("online");
        }
        return;
      }
      if (input.wasPressed("cancel")) {
        leave(game);
        return;
      }
      if (state.kind === "waiting" && input.wasPressed("copy")) copy(state.code);
      if (state.kind === "between" && input.wasPressed("confirm") && !state.iWantRematch) lobby.rematch();
    },
    render(ctx, game) {
      drawDuelBackdrop(ctx, "arena");
      const lobby = game.online.lobby;
      const state = typing ? null : lobby?.state();
      onGui(ctx, () => {
        onStage(ctx, () => {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(-stageX(), TOP - 8, viewW, 80);
          drawText(ctx, ONLINE_TITLE, (STAGE_W - measureText(ONLINE_TITLE) * 2) / 2, TOP - 4, UI.text, 2);
          const middle = STAGE_W / 2;
          const line = (text: string, y: number, color: string = UI.dim) => drawTextCentered(ctx, text, middle, TOP + y, color);
          const big = (text: string) => drawText(ctx, text, (STAGE_W - measureText(text) * 3) / 2, TOP + 26, UI.accent, 3);
          if (typing) {
            line(LOBBY_TYPE_CODE, 15, UI.text);
            big(code.padEnd(5, "_"));
            line(LOBBY_TYPE_HELP, 50);
            return;
          }
          if (!state) return;
          switch (state.kind) {
            case "connecting":
              line(ONLINE_CONNECTING, 26);
              break;
            case "joining":
              line(LOBBY_JOINING, 26);
              break;
            case "waiting":
              line(LOBBY_WAITING, 15, UI.text);
              big(state.code);
              line(copied ? LOBBY_COPIED : copiedLink || LOBBY_COPY, 50, copied ? UI.accent : UI.dim);
              line(LOBBY_LEAVE, 60);
              break;
            case "opponent-here":
              line(LOBBY_OPPONENT_HERE(state.opponent.name), 18, UI.accent);
              line(LOBBY_WAITING_VISIBLE, 32);
              break;
            case "between": {
              const outcome = lobby?.outcome();
              if (outcome) line(outcomeLine(outcome, state.opponent.name), 18, UI.text);
              if (state.iWantRematch) line(LOBBY_REMATCH_ASKED, 34);
              else line(instructionText(game.input, LOBBY_REMATCH), 34, UI.accent);
              if (state.theyWantRematch && !state.iWantRematch) line(LOBBY_THEY_WANT(state.opponent.name), 44, UI.accent);
              line(LOBBY_LEAVE, 58);
              break;
            }
            case "closed": {
              const text = closedLine(state.reason, state.detail);
              wrapText(text, STAGE_W - 24).forEach((wrapped, i) => line(wrapped, 18 + i * LINE_HEIGHT, UI.bad));
              line(instructionText(game.input, LOBBY_CONTINUE), 50);
              break;
            }
            default:
              break;
          }
        });
      });
    },
  };
}
