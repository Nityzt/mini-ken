import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawEveryoneThere } from "../art/courtside-art.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { playerName } from "../characters.ts";
import { onGui, onStage, STAGE_W, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene, SceneName } from "../core/scene.ts";
import { recordCup } from "../run-state.ts";
import { createTournament, cupAt, CUPS, nextOpponent, roundName, type CupId, type Tournament } from "../world/tournament.ts";
import { cupLeft, cupWonLine, TAIKAI_CHAMPION, TAIKAI_CHAMPION_AGAIN, TAIKAI_CHAMPION_LINE, TAIKAI_ENDING, TAIKAI_OUT, TAIKAI_STALL, TAIKAI_STEP_UP, TAIKAI_WITHDRAW } from "./content.ts";
import { createDialogue } from "./dialogue.ts";
import { createShop } from "./shop.ts";

const CONFETTI = [PALETTE.R, PALETTE.W, PALETTE.Y, PALETTE.G, PALETTE.C];
const TOP = 34;
const ROW = 19;
const SLOT_HEIGHT = 10;
const TO_COME = "?";
/** Room for the name and its line toward the next round. */
const columnFor = (fieldSize: number) => (fieldSize > 4 ? 42 : 72);

const seed = () => Math.floor(Math.random() * 2 ** 31);
/** Long enough to see the bracket, however fast you were pressing E on the way in. */
const READ_TICKS = 40;

/** Where you go when a cup's over: back where you signed up. */
const homeOf = (cup: CupId): SceneName => (cup === "pinecone" ? "club" : cup === "grand" ? "map" : "rival-dojo");

/** The bracket, drawn from both sides toward the final in the middle. */
export function drawBracket(ctx: CanvasRenderingContext2D, t: { rounds: { id: string; name: string; controller: string }[][] }): void {
  const size = t.rounds[0].length;
  const column = columnFor(size);
  const roundCount = Math.log2(size);
  for (let round = 0; round < roundCount; round++) {
    const fieldSize = size / 2 ** round;
    const field = t.rounds[round];
    const half = fieldSize / 2;
    const gap = ROW * (8 / fieldSize);
    for (let i = 0; i < fieldSize; i++) {
      // Rounds nobody's reached yet still show where they'll go.
      const entrant = field?.[i];
      const left = i < half;
      const index = left ? i : i - half;
      const y = Math.round(TOP + gap * index + (gap - ROW) / 2);
      const name = entrant?.name ?? TO_COME;
      const width = measureText(name);
      const x = left ? 6 + round * column : STAGE_W - 6 - round * column - width;
      const stillIn = !entrant || (t.rounds[round + 1]?.some((e) => e.id === entrant.id) ?? true);
      ctx.fillStyle = UI.panel;
      ctx.fillRect(x - 2, y - 1, width + 4, SLOT_HEIGHT);
      drawText(ctx, name, x, y, entrant?.controller === "player" ? UI.accent : !entrant ? UI.dim : stillIn ? UI.text : UI.faint);
      // A line in toward the next round.
      ctx.fillStyle = stillIn ? UI.dim : UI.faint;
      if (round < roundCount - 1) ctx.fillRect(left ? x + width + 2 : x - 2 - (column - width - 4), y + 4, column - width - 4, 1);
    }
  }
}

/** A cup at any dojo, or the Grand Taikai: one loss and you're out, and the host waiting in the final. */
export function createTournamentScene(): Scene {
  let tick = 0;
  let celebrated = false;
  /** Winning the Grand Taikai for the first time earns a few words on the way out. */
  let firstTitle = false;
  const stall = createShop();
  const ending = createDialogue();

  const start = (game: Game) => {
    const cup = cupAt(game.run.node) ?? "grand";
    game.tournament = createTournament(cup, seed(), playerName(game.run));
    game.debug.tournament = game.tournament;
    celebrated = false;
  };
  const leave = (game: Game, cup: CupId) => {
    game.tournament = null;
    game.go(homeOf(cup));
  };

  return {
    forfeitLabel: (game) => (game.tournament?.status === "playing" ? TAIKAI_WITHDRAW : null),
    forfeit(game) {
      const cup = game.tournament?.cup ?? "grand";
      game.message = [cupLeft(CUPS[cup].name)];
      leave(game, cup);
    },
    enter(game) {
      tick = 0;
      if (!game.tournament) start(game);
      game.debug.tournament = game.tournament;
      const t = game.tournament!;
      if (t.status === "champion" && !celebrated) {
        celebrated = true;
        firstTitle = t.cup === "grand" && !game.run.champion;
        game.run = recordCup(game.run, t.cup);
        game.audio.play("secret");
      }
    },
    leave(game) {
      celebrated = false;
    },
    update(game) {
      tick++;
      const t = game.tournament;
      if (!t) return;
      const { input } = game;
      if (t.status === "champion") {
        if (ending.active) ending.update(input, game.audio);
        else if (input.wasPressed("confirm") && firstTitle) {
          firstTitle = false;
          const done = () => leave(game, t.cup);
          ending.open(TAIKAI_ENDING, done, done);
        } else if (input.wasPressed("confirm")) leave(game, t.cup);
        return;
      }
      if (stall.active) {
        stall.update(game);
        return;
      }
      if (tick < READ_TICKS) return;
      if (t.status === "playing") {
        if (input.wasPressed("cancel")) stall.open("cup");
        else if (input.wasPressed("confirm")) {
          game.versus = nextOpponent(t)?.fighter ?? null;
          game.go("duel");
        }
      } else if (t.status === "out") {
        if (input.wasPressed("confirm")) start(game);
        else if (input.wasPressed("cancel")) leave(game, t.cup);
      }
    },
    render(ctx, game) {
      const t = game.tournament;
      const place = t ? CUPS[t.cup].crest : "arena";
      drawDuelBackdrop(ctx, place);
      onStage(ctx, () => drawEveryoneThere(ctx, place));
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = PALETTE.K;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
      if (!t) return;

      if (t.status === "champion" && !game.reducedMotion) {
        for (let i = 0; i < 40; i++) {
          const x = (i * 47 + Math.sin(tick / 20 + i) * 6 + 256) % viewW;
          const y = ((tick * (0.4 + (i % 5) * 0.12) + i * 37) % (viewH + 6)) - 4;
          ctx.fillStyle = CONFETTI[i % CONFETTI.length];
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
      }

      onGui(ctx, () => {
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 24);
        const title = t.status === "champion" ? TAIKAI_CHAMPION : CUPS[t.cup].name;
        drawText(ctx, title, (viewW - measureText(title) * 2) / 2, 3, t.status === "champion" ? UI.accent : UI.text, 2);
        onStage(ctx, () => drawBracket(ctx, t));

        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 26, viewW, 26);
        const opponent = nextOpponent(t);
        const roundLabel = roundName(t.rounds[t.round].length);
        if (t.status === "playing" && opponent) {
          drawTextCentered(ctx, `${roundLabel}: ${opponent.name}, ${opponent.dojo}`, viewW / 2, viewH - 24, UI.accent);
          drawTextCentered(ctx, `${TAIKAI_STEP_UP}   ${TAIKAI_STALL}`, viewW / 2, viewH - 12, UI.dim);
        } else if (t.status === "out") {
          drawTextCentered(ctx, `Out in the ${roundLabel}.`, viewW / 2, viewH - 24, UI.accent);
          drawTextCentered(ctx, TAIKAI_OUT, viewW / 2, viewH - 12, UI.dim);
        } else if (!ending.active) {
          drawTextCentered(ctx, t.cup === "grand" ? TAIKAI_CHAMPION_LINE : cupWonLine(CUPS[t.cup].name), viewW / 2, viewH - 24, UI.accent);
          drawTextCentered(ctx, TAIKAI_CHAMPION_AGAIN, viewW / 2, viewH - 12, UI.dim);
        }
        stall.render(ctx, game);
      });
      ending.render(ctx);
    },
  };
}
