import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { FULL_GEAR } from "../art/kendoka.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { onGui, onStage, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { createDuel, faceDir, screenX } from "../duel/rules.ts";
import { createLockstep, type Lockstep } from "../net/lockstep.ts";
import type { FoundMatch } from "../net/service.ts";
import { ONLINE_RULES } from "../net/stand-in.ts";
import { danLabel } from "../ranks.ts";
import { DOJOS } from "../world/dojos.ts";
import { CLOSING_LINE, ONLINE_BOW, ONLINE_CONTINUE, ONLINE_FORFEIT, ONLINE_LEFT, ONLINE_LOST, ONLINE_OUT_OF_STEP, ONLINE_WAITING, ONLINE_WON, YOU } from "./content.ts";
import { applyEvents, createDuelView, createPlayerControl, drawDuelHud, drawDuelStage, drawPanel, helpLine, lockHelp, playDuelSounds, playSemeHum, tickView, type DuelView } from "./duel.ts";
import { drawTag } from "./ui.ts";

const GROUND = 128;
const OVER_MIN_TICKS = 30;
/** How long it takes before a hold-up is worth saying anything about. */
const SHOW_WAITING_AFTER = 20;
/** Until there are real looks to send, whoever you're playing wears some dojo's colors. */
const OPPONENT_LOOKS = Object.values(DOJOS).map((dojo) => dojo.colors);

/** A match against someone else: the usual duel, except that it can't be skipped, and the rules only move when both players' inputs are in. */
export function createOnlineDuelScene(): Scene {
  let view: DuelView;
  let match: FoundMatch | null = null;
  let lock: Lockstep | null = null;
  let control = createPlayerControl();
  let overTicks = 0;
  let recorded = false;
  let won = false;

  /** What happens to the record: an out-of-step match is nobody's fault, so it doesn't count. */
  const record = (game: Game) => {
    if (recorded || !lock) return;
    recorded = true;
    if (lock.status === "finished") won = lock.state.winner === match!.side;
    else won = lock.status === "left";
    if (lock.status !== "desynced") game.online.recordResult(won);
    game.online.lastWon = won;
    game.audio.play(won ? "secret" : "flag");
  };
  const moveOn = (game: Game) => {
    match?.link.close();
    match = null;
    lock = null;
    game.go(game.online.tournament ? "online-bracket" : "online");
  };

  return {
    outsideStory: () => true,
    forfeitLabel: () => (lock?.status === "running" ? ONLINE_FORFEIT : null),
    forfeit(game) {
      lock?.leave();
      recorded = true;
      won = false;
      game.online.recordResult(false);
      game.online.lastWon = false;
      moveOn(game);
    },
    enter(game) {
      match = game.online.match;
      if (!match) {
        game.go("online");
        return;
      }
      const initial = createDuel(ONLINE_RULES);
      lock = createLockstep({ initial, side: match.side, link: match.link });
      view = createDuelView(initial);
      control = createPlayerControl();
      overTicks = 0;
      recorded = false;
      won = false;
      game.debug.duel = initial;
      game.debug.onlineStatus = lock.status;
    },
    update(game) {
      if (!lock || !match) return;
      match.pump?.();
      if (lock.status !== "running") {
        game.debug.onlineStatus = lock.status;
        record(game);
        tickView(view);
        if (++overTicks > OVER_MIN_TICKS && game.input.wasPressed("confirm")) moveOn(game);
        return;
      }
      const me = lock.state.fighters[match.side];
      const input = control(game.input, me, true, lock.state.crossed);
      const { advanced, events } = lock.tick(input);
      view.duel = lock.state;
      game.debug.duel = lock.state;
      game.debug.onlineStatus = lock.status;
      if (!advanced) return;
      applyEvents(view, events, game.reducedMotion);
      playDuelSounds(game.audio, events);
      playSemeHum(game.audio, lock.state.fighters[match.side].stance === "seme", view.walkTick);
      tickView(view);
    },
    render(ctx, game) {
      if (!lock || !match) return;
      const { status, waiting } = lock;
      const { side, opponent, seed } = match;
      const { duel } = view;
      const mine = game.online.look();
      const theirs = OPPONENT_LOOKS[seed % OPPONENT_LOOKS.length];
      drawDuelStage(ctx, view, "arena", {
        playerColors: side === 0 ? mine : theirs,
        opponentColors: side === 0 ? theirs : mine,
        gear: FULL_GEAR,
        reducedMotion: game.reducedMotion,
      });
      const self = game.online.identity();
      const label = (who: { name: string; dan: number }) => `${who.name} ${danLabel(who.dan)}`;
      const names: [string, string] = side === 0 ? [label(self), label(opponent)] : [label(opponent), label(self)];
      const help = duel.lock ? lockHelp(faceDir(duel, side) > 0) : helpLine(view.walkTick, true);
      drawDuelHud(ctx, view, names, help, side);

      // There's nothing else to say which one you are.
      if (duel.phase === "bow" || duel.phase === "turning") {
        onStage(ctx, () => {
          drawTag(ctx, YOU, screenX(duel, duel.fighters[side].x), GROUND - 47, UI.accent);
        });
      }
      onGui(ctx, () => {
        const strip = duel.phase === "bow" ? ONLINE_BOW : duel.phase === "closing" ? CLOSING_LINE : null;
        if (strip) {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, 22, viewW, 12);
          drawTextCentered(ctx, strip, viewW / 2, 24, UI.text);
        }
        if (duel.phase === "point" && duel.lastScore) {
          const text = "IPPON!";
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, 22, viewW, 30);
          drawText(ctx, text, (viewW - measureText(text) * 3) / 2, 26, duel.lastScore.by === side ? UI.bad : UI.text, 3);
        }
        if (status === "running" && waiting > SHOW_WAITING_AFTER) {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, viewH / 2 - 7, viewW, 14);
          drawTextCentered(ctx, ONLINE_WAITING, viewW / 2, viewH / 2 - 4, UI.accent);
        }
        if (status !== "running") {
          const title = status === "desynced" ? ONLINE_OUT_OF_STEP : status === "left" ? ONLINE_LEFT(opponent.name) : won ? ONLINE_WON : ONLINE_LOST;
          onStage(ctx, () => drawPanel(ctx, [
            { text: title, color: won ? UI.bad : UI.text, big: status === "finished" },
            { text: ONLINE_CONTINUE, color: UI.text },
          ]));
        }
      });
    },
  };
}
