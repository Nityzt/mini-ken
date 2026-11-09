import { playerColors } from "../characters.ts";
import { drawAuraBack, drawAuraFront } from "../art/aura.ts";
import { drawFighter, BULLY_DOWN } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { NO_GEAR } from "../art/kendoka.ts";
import { BULLY_COLORS, PALETTE, PERSON_COLORS, UI } from "../art/palette.ts";
import { drawSprite } from "../art/sprite.ts";
import { drawStreet, type StreetPlace } from "../art/world.ts";
import { onGui, stageY, viewH, viewW } from "../core/scale.ts";
import type { Scene } from "../core/scene.ts";
import { BRAWL_SEME_TICKS } from "../duel/constants.ts";
import { createBrawl, OPEN_DURING_TELL, stepBrawl, TELL_TICKS, type BrawlEvent, type BrawlState, type Bully } from "../duel/brawl.ts";
import { legsFor } from "../duel/footwork.ts";
import { kiBarFill, kiBarWidth, targetPrompt } from "../duel/hud.ts";
import { poseFor } from "../duel/poses.ts";
import type { Target } from "../duel/rules.ts";
import { GANGS } from "../world/map.ts";
import { maybeTip } from "../money.ts";
import { reclaim } from "../health.ts";
import { recordGangWin, playerKiMax } from "../run-state.ts";
import { BRAWL_HELP, COWER, FORFEIT_GANG, GANG_FLED, HP_LABEL, KIAI_SHOUT, GANG_STORIES, HELP_BUBBLE, NO_STOMP, NO_ZANSHIN, reclaimedFromGang, SAFE_BUBBLE } from "./content.ts";
import { createPlayerControl, drawKeyPrompt, drawZanshinMeter, helpLine, KIAI, playSemeHum } from "./duel.ts";
import { goDown } from "./knockout.ts";
import { createTeachCards } from "./teach-card.ts";
import { BRAWL_CARD, teachOnce } from "./teaching.ts";
import { drawHpBar, drawTag } from "./ui.ts";

const GROUND = 126;
/** How far across the window you stand as the street scrolls by. */
const CAMERA_AT = 0.43;
const FINISH_TICKS = 50;
const HELP_TICKS = 300;
const STRIKE_POSE_TICKS = 12;
const KI_BAR_WIDTH = 60;
const HP_BAR_FULL = 80;
const STREETS: Record<string, StreetPlace> = { market: "market", bridge: "bridge", wharf: "wharf", boardwalk: "boardwalk", picnic: "picnic", foundry: "foundry", gorge: "gorge" };

type Floater = { text: string; x: number; y: number; ticks: number; color: string };

export function createBrawlScene(): Scene {
  const cards = createTeachCards();
  let state: BrawlState;
  let control = createPlayerControl({ openings: false });
  let tick = 0;
  let finishing = 0;
  let camX = 0;
  let striking: Target | null = null;
  let strikeTicks = 0;
  let floaters: Floater[] = [];
  let sparks: { x: number; y: number; ticks: number }[] = [];
  let lastX = 0;
  let moving = false;
  let shake = 0;

  const float = (text: string, x: number, color: string) => floaters.push({ text, x, y: GROUND - 54, ticks: 42, color });

  const handleEvents = (events: BrawlEvent[], play: (name: "swing" | "stomp" | "clean" | "flag" | "blocked" | "break" | "kiai") => void, reduced: boolean) => {
    const p = state.player;
    for (const e of events) {
      if (e.type === "kiai" && e.target) {
        striking = e.target;
        strikeTicks = STRIKE_POSE_TICKS;
        float(KIAI[e.target], p.x, UI.text);
        play("swing");
      } else if (e.type === "stomp" || e.type === "launch") play("stomp");
      else if (e.type === "hit" && e.bully !== undefined) {
        sparks.push({ x: state.bullies[e.bully].x, y: GROUND - 26, ticks: 10 });
        play("clean");
        if (!reduced) shake = 8;
      } else if (e.type === "clean") play("flag");
      else if (e.type === "flat") {
        float(NO_STOMP, p.x, UI.accent);
        play("blocked");
      } else if (e.type === "nozanshin") {
        float(NO_ZANSHIN, p.x, UI.accent);
        play("blocked");
      } else if (e.type === "whiff") float("Too far", p.x, UI.dim);
      else if (e.type === "lock") float("Too close!", p.x, UI.dim);
      else if (e.type === "blocked") {
        float("Blocked", p.x, UI.dim);
        play("blocked");
      } else if (e.type === "broken") {
        float("Guard broken!", p.x, UI.bad);
        play("break");
      } else if (e.type === "shout") {
        float(KIAI_SHOUT, p.x, UI.accent);
        play("kiai");
        if (!reduced) shake = 6;
      } else if (e.type === "cower") {
        float(COWER, p.x, UI.accent);
        play("flag");
        if (!reduced) shake = 8;
      } else if (e.type === "hurt") {
        float("Ouch!", p.x, UI.bad);
        play("break");
        if (!reduced) shake = 6;
      }
    }
  };

  const drawBully = (ctx: CanvasRenderingContext2D, b: Bully, x: number) => {
    const colors = BULLY_COLORS[b.id % BULLY_COLORS.length];
    if (b.state === "down") {
      drawSprite(ctx, BULLY_DOWN, x - 16, GROUND - 12, { colors });
      return;
    }
    const pose =
      b.state === "tell" ? "tellHandsUp"
      : b.state === "stagger" || b.state === "cower" ? "stunned"
      : b.state === "recover" && b.ticks > 30 ? "strikeKote"
      : b.state === "recover" ? "recover"
      : "guard";
    const frame = b.state === "walk" ? (Math.floor(tick / 10) % 2) + 1 : 0;
    drawFighter(ctx, x, GROUND, pose, "rival", frame, NO_GEAR, {
      colors,
      flip: b.x > state.player.x,
      weapon: b.kind === "stick" ? "stick" : "none",
    });
  };

  return {
    forfeitLabel: () => (state.phase === "fight" ? FORFEIT_GANG : null),
    forfeit(game) {
      game.run = { ...game.run, hp: state.hp };
      game.message = [GANG_FLED];
      game.go("map");
    },
    enter(game) {
      state = createBrawl({ bullies: GANGS[game.run.node] ?? [], seed: Math.floor(Math.random() * 2 ** 31), kiMax: playerKiMax(game.run), hp: game.run.hp });
      control = createPlayerControl({ openings: false });
      tick = 0;
      finishing = 0;
      camX = 0;
      floaters = [];
      sparks = [];
      striking = null;
      strikeTicks = 0;
      lastX = state.player.x;
      game.debug.brawl = state;
      cards.clear(game);
      teachOnce(game, cards, "brawl", BRAWL_CARD);
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

      if (state.phase !== "fight") {
        if (--finishing <= 0) {
          const here = game.run.node;
          finishing = 9999;
          game.run = { ...game.run, hp: state.hp };
          if (state.phase === "lost") {
            goDown(game, here);
            return;
          }
          if (state.phase === "won") {
            // Someone's always grateful, and some of them have spare change.
            const firstTime = !game.run.cleared.includes(here);
            const tip = maybeTip(recordGangWin(game.run, here), firstTime ? Math.random() : 1);
            const back = reclaim(tip.run, here);
            game.run = back.run;
            game.message = [GANG_STORIES[here].thanks, ...(tip.line ? [tip.line] : []), ...(back.amount ? [reclaimedFromGang(back.amount)] : [])];
          } else {
            game.message = [GANG_FLED];
          }
          game.go("map");
        }
        return;
      }

      const input = control(game.input, state.player, game.run.seme);
      state = stepBrawl(state, input);
      game.debug.brawl = state;
      handleEvents(state.events, (name) => game.audio.play(name), game.reducedMotion);
      playSemeHum(game.audio, state.player.stance === "seme", tick);
      moving = Math.abs(state.player.x - lastX) > 0.01;
      lastX = state.player.x;
      if (state.phase !== "fight") finishing = FINISH_TICKS;
    },
    render(ctx, game) {
      const worldW = Math.max(viewW, state.worldEnd + 24);
      const target = Math.max(0, Math.min(worldW - viewW, state.player.x - viewW * CAMERA_AT));
      camX += (target - camX) * 0.15;
      const cx = Math.round(camX) + (shake > 0 ? (shake % 2 === 0 ? 1 : -1) : 0);
      const here = game.run.node;
      // The street stays in the middle of a tall window, with sky above and road below.
      ctx.save();
      ctx.translate(0, stageY());
      drawStreet(ctx, cx, STREETS[here] ?? "market", GROUND);

      // The one you came to help waits at the far end of the street.
      const safe = state.phase === "won";
      const personX = state.worldEnd - 12 - cx;
      drawFighter(ctx, personX, GROUND, safe ? "bow" : "stunned", "rival", 0, NO_GEAR, { colors: PERSON_COLORS[here], weapon: "none", flip: !safe || undefined });
      if (safe || Math.floor(tick / 24) % 2 === 0) {
        drawTag(ctx, safe ? SAFE_BUBBLE : HELP_BUBBLE, personX, GROUND - 47, safe ? UI.good : UI.text);
      }

      for (const b of state.bullies) if (b.state === "down") drawBully(ctx, b, b.x - cx);
      for (const b of state.bullies) if (b.state !== "down") drawBully(ctx, b, b.x - cx);

      const p = state.player;
      const flicker = state.invulnerable > 0 && Math.floor(tick / 3) % 2 === 0;
      const charging = p.stance === "seme";
      const power = Math.min(1, state.pressure / BRAWL_SEME_TICKS);
      if (charging) drawAuraBack(ctx, p.x - cx, GROUND, tick, power, game.reducedMotion);
      if (!flicker) {
        const pose = state.phase === "lost" ? "stunned" : poseFor(p, {
          phase: state.zanshin ? "zanshin" : "fight",
          striking,
          scored: !!state.zanshin,
        });
        const legs = legsFor(tick, moving);
        drawFighter(ctx, p.x - cx, GROUND, pose, "player", legs === "step" ? 1 : legs === "close" ? 2 : 0, game.run.gear, { flip: p.facing < 0, colors: playerColors(game.run) });
      }
      if (charging) drawAuraFront(ctx, p.x - cx, GROUND, tick, power, game.reducedMotion);

      // Your first street fight shows which key answers a raised fist or stick.
      if (game.run.cleared.length === 0) {
        for (const b of state.bullies) {
          if (b.state === "tell") drawKeyPrompt(ctx, b.x - cx, GROUND, targetPrompt(OPEN_DURING_TELL[b.kind], game.input), b.ticks / TELL_TICKS[b.kind]);
        }
      }
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
        // Hearts, ki, and who's left.
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 20);
        drawText(ctx, HP_LABEL, 5, 2, UI.dim);
        drawHpBar(ctx, 5 + measureText(HP_LABEL) + 3, 3, state.hp, HP_BAR_FULL, 6);
        const barFull = kiBarWidth(p.kiMax);
        ctx.fillStyle = UI.track;
        ctx.fillRect(5, 13, barFull, 4);
        ctx.fillStyle = UI.accent;
        ctx.fillRect(5, 13, kiBarFill(p.ki, p.kiMax), 4);
        if (state.pressure > 0) {
          ctx.fillStyle = UI.bad;
          ctx.fillRect(5, 18, Math.round((KI_BAR_WIDTH * state.pressure) / BRAWL_SEME_TICKS), 2);
        }
        const left = state.bullies.filter((b) => b.state !== "down").length;
        const label = `Alley Cats: ${left} left`;
        drawText(ctx, label, viewW - 4 - measureText(label), 2, UI.text);

        if (state.zanshin) {
          drawZanshinMeter(ctx, p.facing > 0 ? "D" : "A", state.zanshin.traveled / state.zanshin.needed);
        }
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 11, viewW, 11);
        drawTextCentered(ctx, tick < HELP_TICKS ? BRAWL_HELP : helpLine(tick, game.run.seme), viewW / 2, viewH - 10, UI.dim);
      });
      cards.render(ctx);
    },
  };
}
