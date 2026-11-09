import { keyLabel, teachingKeys } from "../core/key-labels.ts";
import { playerColors } from "../characters.ts";
import { drawHall } from "../art/backdrops.ts";
import { drawEveryoneThere } from "../art/courtside-art.ts";
import { drawFighter, type DuelPose } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { BO_COLORS, UI } from "../art/palette.ts";
import { onGui, stageY, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { BIG_WINDOW, FOLLOW_NEEDED, createKirikaeshi, KIRIKAESHI_SEQUENCE, kirikaeshiTierFor, MISSES_ALLOWED, stepKirikaeshi, type KirikaeshiState } from "../duel/kirikaeshi.ts";
import { KI_LOW } from "../duel/constants.ts";
import { playerKiMax } from "../run-state.ts";
import { kirikaeshiOutcome } from "./club-story.ts";
import { FORFEIT_LINE, KIRIKAESHI_BIG_KEYS, KIRIKAESHI_EARLY, KIRIKAESHI_HELP, KIRIKAESHI_LATE, KIRIKAESHI_LEFT, KIRIKAESHI_LOW, KIRIKAESHI_NOW, KIRIKAESHI_TITLE, KIRIKAESHI_WRONG, NO_STOMP, SAYU_CALL } from "./content.ts";
import { drawKeyPrompt, drawKiBar, drawZanshinMeter, KIAI } from "./duel.ts";
import { createTeachCards } from "./teach-card.ts";
import { KIRIKAESHI_CARD, teachOnce } from "./teaching.ts";
import { drawTag } from "./ui.ts";

const GROUND = 128;
/** Where you stand at the start of a set, across the window. */
const START_AT = 0.32;
const FINISH_TICKS = 70;
const STRIKE_POSE_TICKS = 9;
const FLOATER_TICKS = 30;
/** How quickly the two of them catch up with where the drill says they are. */
const EASE = 0.28;

type Floater = { text: string; x: number; y: number; ticks: number; color: string };

/** Sensei's stamina drill, with Bo receiving. All the rules are in duel/kirikaeshi.ts. */
export function createKirikaeshiScene(): Scene {
  const cards = createTeachCards();
  let state: KirikaeshiState;
  let tick = 0;
  let finishing = 0;
  let strikeTicks = 0;
  let playerX = 0;
  let partnerX = 0;
  let floaters: Floater[] = [];

  const float = (text: string, color: string) => floaters.push({ text, x: playerX, y: GROUND - 54, ticks: FLOATER_TICKS, color });

  const react = (game: Game) => {
    for (const e of state.events) {
      if (e.type === "kiai") {
        strikeTicks = STRIKE_POSE_TICKS;
        float(KIAI.men, UI.text);
        game.audio.play("kiai");
        game.audio.play("clean");
      } else if (e.type === "call") {
        strikeTicks = STRIKE_POSE_TICKS;
        float(SAYU_CALL, UI.dim);
        game.audio.play("call");
        game.audio.play("clash");
      } else if (e.type === "stomp") game.audio.play("stomp");
      else if (e.type === "windowOpen") game.audio.play("flag");
      else {
        const text = { rushed: KIRIKAESHI_EARLY, wrong: KIRIKAESHI_WRONG, late: KIRIKAESHI_LATE, slow: KIRIKAESHI_LATE, flat: NO_STOMP }[e.type];
        float(text, UI.accent);
        game.audio.play("blocked");
      }
    }
  };

  const playerPose = (): DuelPose => {
    const { phase, lastSide } = state;
    if (state.outcome === "passed" || phase === "follow") return "zanshin";
    if (strikeTicks > 0) {
      if (phase === "rhythm" || phase === "breath") return lastSide === "right" ? "sayuRight" : "sayuLeft";
      return "strikeMen";
    }
    if (phase === "rhythm") return "sayuRaise";
    if (phase === "contact") return "tsuba";
    if (phase === "big") return "tellBigRaise";
    return "guard";
  };

  const partnerPose = (): DuelPose => {
    if (state.phase === "contact") return "tsuba";
    if (state.phase === "rhythm") return state.lastSide === "left" ? "receiveRight" : "receiveLeft";
    return "guard";
  };

  /** Which key is next, and on sayu men, how long until it lands. */
  const drawPrompt = (ctx: CanvasRenderingContext2D, at: number, game: Game) => {
    const { phase, spec, dueIn, beat } = state;
    if (phase === "big") drawKeyPrompt(ctx, at, GROUND, teachingKeys(game.input, KIRIKAESHI_BIG_KEYS), state.ticks / BIG_WINDOW);
    else if (phase === "rhythm") {
      const key = KIRIKAESHI_SEQUENCE[beat].side === "left" ? keyLabel(game.input, "left", "a") : keyLabel(game.input, "right", "d");
      const inWindow = dueIn <= spec.window;
      drawKeyPrompt(ctx, at, GROUND, inWindow ? `${key} ${KIRIKAESHI_NOW}` : key, Math.max(0, dueIn) / spec.interval);
    }
  };

  return {
    forfeitLabel: () => (state.outcome ? null : FORFEIT_LINE),
    forfeit(game) {
      game.message = [KIRIKAESHI_LEFT];
      game.go("club");
    },
    enter(game) {
      state = createKirikaeshi({ tier: kirikaeshiTierFor(game.run.kirikaeshiPasses), kiMax: playerKiMax(game.run) });
      tick = 0;
      finishing = FINISH_TICKS;
      strikeTicks = 0;
      playerX = state.playerX;
      partnerX = state.partnerX;
      floaters = [];
      game.debug.kirikaeshi = state;
      cards.clear(game);
      teachOnce(game, cards, "kirikaeshi", KIRIKAESHI_CARD);
    },
    update(game) {
      if (cards.active) {
        cards.update(game);
        return;
      }
      tick++;
      for (const f of floaters) {
        f.ticks--;
        if (f.ticks % 3 === 0) f.y--;
      }
      floaters = floaters.filter((f) => f.ticks > 0);
      if (strikeTicks > 0) strikeTicks--;
      playerX += (state.playerX - playerX) * EASE;
      partnerX += (state.partnerX - partnerX) * EASE;

      if (state.outcome) {
        if (--finishing === 0) {
          const reply = kirikaeshiOutcome(game.run, { outcome: state.outcome, misses: state.misses });
          game.run = reply.run;
          game.message = reply.lines;
          game.go("club");
        }
        return;
      }
      const { input } = game;
      state = stepKirikaeshi(state, {
        left: input.wasPressed("left"),
        right: input.wasPressed("right"),
        men: input.wasPressed("men"),
        stomp: input.wasPressed("stomp"),
        hold: input.isDown("right"),
      });
      game.debug.kirikaeshi = state;
      react(game);
    },
    render(ctx, game) {
      const origin = Math.round(viewW * START_AT);
      ctx.save();
      ctx.translate(0, stageY());
      drawHall(ctx, "pinecone", 0, (c) => drawEveryoneThere(c, "pinecone", false, "aki"));
      const you = origin + Math.round(playerX);
      const bo = origin + Math.round(partnerX);
      const moving = Math.abs(state.playerX - playerX) > 0.5;
      const frame = moving ? (Math.floor(tick / 6) % 2 === 0 ? 1 : 2) : 0;
      const turned = state.outcome === "passed";
      drawFighter(ctx, bo, GROUND, partnerPose(), "rival", frame, undefined, { flip: !turned, colors: BO_COLORS });
      drawFighter(ctx, you, GROUND, playerPose(), "player", frame, game.run.gear, { flip: turned, colors: playerColors(game.run) });
      drawPrompt(ctx, you, game);
      for (const f of floaters) drawTag(ctx, f.text, origin + Math.round(f.x), f.y + 9, f.color);
      ctx.restore();

      onGui(ctx, () => {
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 20);
        drawText(ctx, KIRIKAESHI_TITLE, 5, 1, UI.text);
        const slips = `Slips ${state.misses}/${MISSES_ALLOWED}`;
        drawText(ctx, slips, viewW - 5 - measureText(slips), 1, state.misses >= MISSES_ALLOWED ? UI.bad : UI.accent);
        drawKiBar(ctx, 5, 13, state.ki, state.kiMax, tick);
        // The set, one mark a strike, so you can see how much of it is left to breathe through.
        const stride = 7;
        const left = (viewW - KIRIKAESHI_SEQUENCE.length * stride) / 2;
        KIRIKAESHI_SEQUENCE.forEach((beat, i) => {
          ctx.fillStyle = i < state.beat ? UI.good : beat.kind === "big" ? UI.accent : beat.dir > 0 ? UI.track : UI.dim;
          const height = beat.kind === "big" ? 6 : 3;
          ctx.fillRect(left + i * stride, 12 + (6 - height) / 2, stride - 2, height);
        });
        if (state.ki < KI_LOW && !state.outcome) drawTextCentered(ctx, KIRIKAESHI_LOW, viewW / 2, 1, UI.bad);
        if (state.phase === "follow" && !state.outcome) drawZanshinMeter(ctx, keyLabel(game.input, "right", "d"), state.traveled / FOLLOW_NEEDED);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 11, viewW, 11);
        drawTextCentered(ctx, teachingKeys(game.input, KIRIKAESHI_HELP), viewW / 2, viewH - 10, UI.dim);
      });
      cards.render(ctx);
    },
  };
}
