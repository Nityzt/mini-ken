import { playerColors } from "../characters.ts";
import { drawHall } from "../art/backdrops.ts";
import { drawEveryoneThere } from "../art/courtside-art.ts";
import { drawFighter } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { AKI_COLORS, BO_COLORS, NAO_COLORS, PALETTE, RIKU_COLORS, UI, YUI_COLORS } from "../art/palette.ts";
import { onGui, stageY, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { createLine, LINE_TIERS, lineCleans, linePassed, lineTierFor, stepLine, type LineState } from "../duel/line.ts";
import { legsFor } from "../duel/footwork.ts";
import { targetPrompt } from "../duel/hud.ts";
import { OPENING_POSE, poseFor } from "../duel/poses.ts";
import type { Target } from "../duel/rules.ts";
import { LINE_PASSES_TO_UNLOCK } from "../progress.ts";
import { playerKiMax } from "../run-state.ts";
import { kihonOutcome } from "../grading.ts";
import { lineOutcome } from "./club-story.ts";
import { FORFEIT_LINE, HELP_TITLE, KIHON_LEFT, KIHON_TITLE, LINE_HELP, LINE_LEFT, LINE_MISSED, LINE_PASSED_BY, LINE_SLOW, LINE_TITLE, LINE_TOO_CLOSE, LINE_WRONG, NO_STOMP, NO_ZANSHIN } from "./content.ts";
import { createPlayerControl, drawKeyPrompt, drawZanshinMeter, KIAI } from "./duel.ts";
import { createTeachCards } from "./teach-card.ts";
import { LINE_CARD, LINE_NO_KEYS_CARD, teachOnce } from "./teaching.ts";
import { drawTag } from "./ui.ts";

const GROUND = 128;
/** How far across the window you stand as the hall scrolls by. */
const CAMERA_AT = 0.35;
const FINISH_TICKS = 60;
const STRIKE_POSE_TICKS = 12;
const FLOATER_TICKS = 42;
const SHAKE_TICKS = 6;
const COLORS = [AKI_COLORS, BO_COLORS, YUI_COLORS, NAO_COLORS, RIKU_COLORS];

type Floater = { text: string; x: number; y: number; ticks: number; color: string };

/** A row of senpai in bogu, each offering one opening. Hit it, slide through, and you're at the next one. */
export function createLineScene(): Scene {
  const cards = createTeachCards();
  let state: LineState;
  let control = createPlayerControl({ openings: false });
  let tick = 0;
  let camX = 0;
  let finishing = 0;
  let striking: Target | null = null;
  let strikeTicks = 0;
  let floaters: Floater[] = [];
  let sparks: { x: number; y: number; ticks: number }[] = [];
  let lastX = 0;
  let moving = false;
  let shake = 0;

  const float = (text: string, color: string) => floaters.push({ text, x: state.brawl.player.x, y: GROUND - 54, ticks: FLOATER_TICKS, color });

  /** At a grading, this is the panel's demonstration: the hardest run, no key shown, and it doesn't count as practice. */
  const examining = (game: Game) => game.grading === "kihon";

  const leave = (game: Game) => {
    game.helping = false;
    if (examining(game)) {
      game.grading = null;
      game.message = [KIHON_LEFT];
      game.go("grading-hall");
      return;
    }
    game.message = [LINE_LEFT];
    game.go("club");
  };

  const react = (game: Game) => {
    const play = (name: "swing" | "stomp" | "clean" | "flag" | "blocked") => game.audio.play(name);
    const before = floaters.length;
    for (const e of state.events) {
      if (e.type === "kiai" && e.target) {
        striking = e.target;
        strikeTicks = STRIKE_POSE_TICKS;
        float(KIAI[e.target], UI.text);
        play("swing");
      } else if (e.type === "stomp" || e.type === "launch") play("stomp");
      else if (e.type === "hit" && e.bully !== undefined) {
        sparks.push({ x: state.brawl.bullies[e.bully].x, y: GROUND - 26, ticks: 10 });
        play("clean");
        if (!game.reducedMotion) shake = SHAKE_TICKS;
      } else if (e.type === "clean") play("flag");
      else if (e.type === "blocked") {
        float(LINE_WRONG, UI.bad);
        play("blocked");
      } else if (e.type === "flat") {
        float(NO_STOMP, UI.accent);
        play("blocked");
      } else if (e.type === "nozanshin") {
        float(NO_ZANSHIN, UI.accent);
        play("blocked");
      } else if (e.type === "whiff") float("Too far", UI.dim);
      else if (e.type === "lock") float(LINE_TOO_CLOSE, UI.accent);
    }
    for (const note of state.notes) {
      if (note === "slow") {
        float(LINE_SLOW, UI.accent);
        play("blocked");
      } else if (note === "passed") {
        float(LINE_PASSED_BY, UI.accent);
        play("blocked");
      }
    }
    // Every miss says so. Anything that didn't already give its reason just says it missed.
    if (state.notes.includes("missed") && floaters.length === before) {
      float(LINE_MISSED, UI.bad);
      play("blocked");
    }
  };

  const drawSenpai = (ctx: CanvasRenderingContext2D, index: number, cx: number) => {
    const senpai = state.brawl.bullies[index];
    const x = senpai.x - cx;
    const result = state.results[index];
    const pose = result ? "sageto" : senpai.state === "stagger" ? "stunned" : senpai.opening ? OPENING_POSE[senpai.opening] : "guard";
    drawFighter(ctx, x, GROUND, pose, "rival", 0, undefined, { colors: COLORS[index % COLORS.length] });
    if (result) {
      drawTag(ctx, result === "clean" ? "O" : "X", x, GROUND - 47, result === "clean" ? UI.good : UI.bad);
    }
  };

  /** What the active senpai is offering, how long is left, and on the early runs, which key answers it. */
  const drawPrompt = (ctx: CanvasRenderingContext2D, cx: number, game: Game) => {
    if (state.active === null) return;
    const senpai = state.brawl.bullies[state.active];
    if (!senpai.opening) return;
    drawKeyPrompt(ctx, senpai.x - cx, GROUND, state.spec.labels ? targetPrompt(senpai.opening, game.input) : null, state.windowLeft / state.spec.window);
  };

  return {
    forfeitLabel: () => (state.done ? null : FORFEIT_LINE),
    forfeit: leave,
    enter(game) {
      state = createLine({ tier: examining(game) ? LINE_TIERS.length - 1 : game.helping ? 0 : lineTierFor(game.run.linePasses), seed: Math.floor(Math.random() * 2 ** 31), kiMax: playerKiMax(game.run) });
      control = createPlayerControl({ openings: false });
      tick = 0;
      camX = 0;
      finishing = FINISH_TICKS;
      striking = null;
      strikeTicks = 0;
      floaters = [];
      sparks = [];
      lastX = state.brawl.player.x;
      game.debug.line = state;
      cards.clear(game);
      teachOnce(game, cards, "line", LINE_CARD);
      if (!state.spec.labels) teachOnce(game, cards, "lineNoKeys", LINE_NO_KEYS_CARD);
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
      for (const s of sparks) s.ticks--;
      sparks = sparks.filter((s) => s.ticks > 0);
      if (shake > 0) shake--;
      if (strikeTicks > 0 && --strikeTicks === 0) striking = null;

      if (state.done) {
        if (finishing > 0 && --finishing === 0) {
          if (state.left) leave(game);
          else if (examining(game)) {
            const reply = kihonOutcome(linePassed(state));
            game.grading = reply.next;
            game.message = reply.lines;
            game.go("grading-hall");
          } else {
            const reply = lineOutcome(game.run, { passed: linePassed(state), cleans: lineCleans(state), count: state.spec.count }, game.helping, Math.random());
            game.helping = false;
            game.run = reply.run;
            game.message = reply.lines;
            game.go("club");
          }
        }
        return;
      }
      state = stepLine(state, control(game.input, state.brawl.player, false));
      game.debug.line = state;
      react(game);
      moving = Math.abs(state.brawl.player.x - lastX) > 0.01;
      lastX = state.brawl.player.x;
    },
    render(ctx, game) {
      const { brawl } = state;
      const worldW = Math.max(viewW, brawl.worldEnd + 24);
      const target = Math.max(0, Math.min(worldW - viewW, brawl.player.x - viewW * CAMERA_AT));
      camX += (target - camX) * 0.15;
      const cx = Math.round(camX) + (shake > 0 ? (shake % 2 === 0 ? 1 : -1) : 0);

      // The hall runs on past the edge of the screen, one stretch of wall after another.
      ctx.save();
      ctx.translate(0, stageY());
      const hall = examining(game) ? "hall" : "pinecone";
      drawHall(ctx, hall, cx, (c) => drawEveryoneThere(c, hall, false, "aki"));

      brawl.bullies.forEach((_, i) => drawSenpai(ctx, i, cx));

      const p = brawl.player;
      const pose = poseFor(p, { phase: brawl.zanshin ? "zanshin" : "fight", striking, scored: !!brawl.zanshin });
      const legs = legsFor(tick, moving);
      drawFighter(ctx, p.x - cx, GROUND, pose, "player", legs === "step" ? 1 : legs === "close" ? 2 : 0, game.run.gear, { flip: p.facing < 0, colors: playerColors(game.run) });

      drawPrompt(ctx, cx, game);
      for (const s of sparks) {
        const r = 10 - s.ticks;
        ctx.fillStyle = PALETTE.W;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(s.x - cx + dx * r, s.y + dy * r, 2, 2);
      }
      for (const f of floaters) {
        drawTag(ctx, f.text, f.x - cx, f.y + 9, f.color);
      }

      ctx.restore();

      onGui(ctx, () => {
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 20);
        const passes = game.run.linePasses;
        const title = examining(game) ? KIHON_TITLE : game.helping ? HELP_TITLE : passes < LINE_PASSES_TO_UNLOCK ? `${LINE_TITLE} ${passes + 1}/${LINE_PASSES_TO_UNLOCK}` : LINE_TITLE;
        drawText(ctx, title, 5, 1, UI.text);
        const score = `Clean ${lineCleans(state)}  Need ${state.spec.need}`;
        drawText(ctx, score, viewW - 5 - measureText(score), 1, UI.accent);
        state.results.forEach((result, i) => {
          ctx.fillStyle = result === "clean" ? UI.good : result === "miss" ? UI.bad : UI.track;
          ctx.fillRect(5 + i * 9, 13, 7, 4);
        });

        if (brawl.zanshin) drawZanshinMeter(ctx, "D", brawl.zanshin.traveled / brawl.zanshin.needed);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 11, viewW, 11);
        drawTextCentered(ctx, LINE_HELP, viewW / 2, viewH - 10, UI.dim);
      });
      cards.render(ctx);
    },
  };
}
