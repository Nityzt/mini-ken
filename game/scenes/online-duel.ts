import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { FULL_GEAR } from "../art/kendoka.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { onGui, onStage, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { createDuel, faceDir, screenX, type DuelState, type FighterInput } from "../duel/rules.ts";
import { createLockstep, liveResult, type Lockstep } from "../net/lockstep.ts";
import type { FoundMatch } from "../net/service.ts";
import { ONLINE_RULES } from "../net/stand-in.ts";
import { danLabel } from "../ranks.ts";
import { DOJOS } from "../world/dojos.ts";
import { CLOSING_LINE, ONLINE_BOW, ONLINE_CONTINUE, ONLINE_FORFEIT, ONLINE_LEFT, ONLINE_LOST, ONLINE_OUT_OF_STEP, ONLINE_WAITING, ONLINE_WON, YOU } from "./content.ts";
import { applyEvents, createDuelView, createPlayerControl, drawDuelHud, drawDuelStage, drawPanel, helpLine, lockHelp, playDuelSounds, playSemeHum, playShineTing, tickView, type DuelView } from "./duel.ts";
import { CONNECTION_LOST, COUNTDOWN, outcomeLine, SETTLING } from "./online-lines.ts";
import { drawTag } from "./ui.ts";

const GROUND = 128;
const OVER_MIN_TICKS = 30;
/** How long it takes before a hold-up is worth saying anything about. */
const SHOW_WAITING_AFTER = 20;
/** Until there are real looks to send, whoever you're playing wears some dojo's colors. */
const OPPONENT_LOOKS = Object.values(DOJOS).map((dojo) => dojo.colors);
/** Three seconds, which the server allows for before it expects any input. */
const COUNTDOWN_TICKS = 180;
const TICKS_PER_SECOND = 60;
const IDLE: FighterInput = { move: 0, block: false, attack: null };

/** A match against someone else: the usual duel, except that it can't be skipped, and the rules only move when both players' inputs are in. */
export function createOnlineDuelScene(): Scene {
  let view: DuelView;
  let match: FoundMatch | null = null;
  let lock: Lockstep | null = null;
  let control = createPlayerControl();
  let overTicks = 0;
  let recorded = false;
  let won = false;
  let initial: DuelState;
  let countdown = 0;
  let reported = false;
  let announced = false;
  let ticks = 0;
  let waitedTicks = 0;

  const startLockstep = () => {
    lock = createLockstep({ initial, side: match!.side, link: match!.link });
  };
  /** How a real match ended, by the server's word or the connection's. Null while it's still going. */
  const liveEnd = () => {
    const live = match?.live;
    if (!live) return null;
    const outcome = live.outcome();
    if (outcome) return { outcome, lost: false };
    return match!.link.closed ? { outcome: null, lost: true } : null;
  };
  /** Moves a real match on one tick, whether or not anyone's at the keyboard. */
  const runLive = (game: Game, input: FighterInput) => {
    if (!match?.live || liveEnd()) return;
    if (countdown > 0) {
      if (--countdown === 0) startLockstep();
      return;
    }
    if (lock?.status === "running") advance(game, input);
    if (lock && !reported) {
      const report = liveResult(lock.status, lock.state.winner, match.side);
      if (report) {
        reported = true;
        match.live.report(report);
      }
    }
  };
  const advance = (game: Game, input: FighterInput) => {
    if (!lock || !match) return;
    const { advanced, events } = lock.tick(input);
    ticks++;
    if (!advanced) waitedTicks++;
    view.duel = lock.state;
    game.debug.duel = lock.state;
    game.debug.onlineStatus = lock.status;
    if (!advanced) return;
    applyEvents(view, events, game.reducedMotion);
    playDuelSounds(game.audio, events);
    playShineTing(game.audio, view, match.side);
    playSemeHum(game.audio, lock.state.fighters[match.side].stance === "seme", view.walkTick);
    tickView(view);
  };
  /** Once, when a real match is over: the sound, the record on screen, and how the connection did. */
  const announce = (game: Game, end: NonNullable<ReturnType<typeof liveEnd>>) => {
    if (announced) return;
    announced = true;
    won = end.outcome?.winner === "you";
    game.audio.play(won ? "secret" : "flag");
    void game.online.account?.refresh();
    console.info(`Tiny Kendo: this match spent ${ticks ? ((100 * waitedTicks) / ticks).toFixed(1) : "0.0"}% of its ${ticks} ticks waiting on the other player.`);
  };

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
    const wasLive = !!match?.live;
    match?.link.close();
    match = null;
    lock = null;
    game.go(wasLive ? "online-lobby" : game.online.tournament ? "online-bracket" : "online");
  };

  return {
    outsideStory: () => true,
    keepsRunning: () => !!match?.live,
    liveTick(game) {
      runLive(game, IDLE);
    },
    forfeitLabel: () => (lock?.status === "running" || countdown > 0 ? ONLINE_FORFEIT : null),
    forfeit(game) {
      if (match?.live) {
        // Whatever that does to the record is the server's to say, and it'll say so on this screen.
        if (lock) lock.leave();
        else {
          match.link.send({ t: "leave" });
          countdown = 0;
        }
        return;
      }
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
      initial = createDuel(ONLINE_RULES);
      lock = null;
      countdown = match.live ? COUNTDOWN_TICKS : 0;
      reported = false;
      announced = false;
      ticks = 0;
      waitedTicks = 0;
      if (!match.live) startLockstep();
      view = createDuelView(initial);
      view.hintFor = match.side;
      control = createPlayerControl();
      overTicks = 0;
      recorded = false;
      won = false;
      game.debug.duel = initial;
      game.debug.onlineStatus = match.live ? "countdown" : "running";
    },
    update(game) {
      if (!match) return;
      if (match.live) {
        const me = lock?.state.fighters[match.side];
        runLive(game, me ? control(game.input, me, true, lock!.state.crossed) : IDLE);
        const end = liveEnd();
        if (!end) return;
        announce(game, end);
        tickView(view);
        if (++overTicks > OVER_MIN_TICKS && game.input.wasPressed("confirm")) moveOn(game);
        return;
      }
      if (!lock) return;
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
      advance(game, input);
    },
    render(ctx, game) {
      if (!match) return;
      const status = lock?.status ?? "running";
      const waiting = lock?.waiting ?? 0;
      const end = liveEnd();
      const { side, opponent, seed } = match;
      const { duel } = view;
      const mine = game.online.look();
      const theirs = OPPONENT_LOOKS[seed % OPPONENT_LOOKS.length];
      drawDuelStage(ctx, view, "arena", {
        playerColors: side === 0 ? mine : theirs,
        opponentColors: side === 0 ? theirs : mine,
        gear: FULL_GEAR,
        reducedMotion: game.reducedMotion,
        you: side,
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
        if (duel.phase === "point" && duel.lastScore && !duel.timeUp) {
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
        if (match?.live) {
          if (end) {
            const text = end.outcome ? outcomeLine(end.outcome, opponent.name) : CONNECTION_LOST;
            onStage(ctx, () => drawPanel(ctx, [
              { text, color: won ? UI.accent : UI.text },
              { text: ONLINE_CONTINUE, color: UI.text },
            ]));
          } else if (countdown > 0) {
            onStage(ctx, () => drawPanel(ctx, [{ text: COUNTDOWN(Math.ceil(countdown / TICKS_PER_SECOND)), color: UI.accent }]));
          } else if (status !== "running") {
            onStage(ctx, () => drawPanel(ctx, [{ text: SETTLING, color: UI.text }]));
          }
        } else if (status !== "running") {
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
