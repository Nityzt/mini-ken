import { playerColors } from "../characters.ts";
import { drawAuraBack, drawAuraFront } from "../art/aura.ts";
import { drawFighter, BULLY_DOWN } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { NO_GEAR } from "../art/kendoka.ts";
import { BULLY_COLORS, PALETTE, PERSON_COLORS, UI } from "../art/palette.ts";
import { drawSprite } from "../art/sprite.ts";
import { drawStreet, type StreetPlace } from "../art/world.ts";
import { onGui, stageY, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { BRAWL_SEME_TICKS } from "../duel/constants.ts";
import { OPEN_DURING_TELL, type Bully } from "../duel/brawl.ts";
import { createStreet, stepLine, STREET_RECOVER_TICKS, streetLabels, type LineState } from "../duel/line.ts";
import { legsFor } from "../duel/footwork.ts";
import { kiBarFill, kiBarWidth, targetPrompt } from "../duel/hud.ts";
import { OPENING_POSE, poseFor } from "../duel/poses.ts";
import type { Target } from "../duel/rules.ts";
import { GANG_PACE, GANGS } from "../world/map.ts";
import { maybeTip } from "../money.ts";
import { reclaim } from "../health.ts";
import { recordGangWin, playerKiMax, type RunState } from "../run-state.ts";
import {
  BRAWL_HELP, BRAWL_SEME_HELP, COWER, FORFEIT_GANG, GANG_FLED, HP_LABEL, KIAI_SHOUT, GANG_STORIES, HELP_BUBBLE, LINE_EARLY, LINE_HELP, LINE_MISSED, LINE_SLOW, LINE_TOO_CLOSE, LINE_WRONG, NO_STOMP,
  NO_ZANSHIN, reclaimedFromGang, SAFE_BUBBLE,
} from "./content.ts";
import { createPlayerControl, drawKeyPrompt, drawZanshinMeter, KIAI, playSemeHum } from "./duel.ts";
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
const FLOATER_TICKS = 42;
/** How long you flash after a bully catches you. */
const HURT_TICKS = 30;
/** How long a bully who's caught you is drawn mid-swing. */
const SWING_POSE_TICKS = 12;
const KI_BAR_WIDTH = 60;
const HP_BAR_FULL = 80;
const STREETS: Record<string, StreetPlace> = { market: "market", bridge: "bridge", wharf: "wharf", boardwalk: "boardwalk", picnic: "picnic", foundry: "foundry", gorge: "gorge" };

type Floater = { text: string; x: number; y: number; ticks: number; color: string };

/** How many street fights you've won, which decides whether this one still shows its keys. */
const fightsWon = (run: RunState): number => run.cleared.filter((id) => GANGS[id]).length;

/** The bottom line, in turns: how to leave, the keys, and seme once you have it. */
const bottomLine = (tick: number, seme: boolean): string => {
  const lines = [BRAWL_HELP, LINE_HELP, ...(seme ? [BRAWL_SEME_HELP] : [])];
  return lines[Math.floor(tick / HELP_TICKS) % lines.length];
};

/** A street fight is the line drill for real: the gang comes at you one at a time, and a miss gets you hit. */
export function createBrawlScene(): Scene {
  const cards = createTeachCards();
  let state: LineState;
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
  let hurt = 0;

  const float = (text: string, color: string) => floaters.push({ text, x: state.brawl.player.x, y: GROUND - 54, ticks: FLOATER_TICKS, color });

  const react = (game: Game) => {
    const play = (name: "swing" | "stomp" | "clean" | "flag" | "blocked" | "break" | "kiai") => game.audio.play(name);
    const reduced = game.reducedMotion;
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
        if (!reduced) shake = 8;
      } else if (e.type === "clean") play("flag");
      else if (e.type === "blocked") float(state.notes.includes("early") ? LINE_EARLY : LINE_WRONG, UI.bad);
      else if (e.type === "flat") float(NO_STOMP, UI.accent);
      else if (e.type === "nozanshin") float(NO_ZANSHIN, UI.accent);
      else if (e.type === "whiff") float("Too far", UI.dim);
      else if (e.type === "lock") float(LINE_TOO_CLOSE, UI.accent);
      else if (e.type === "shout") {
        float(KIAI_SHOUT, UI.accent);
        play("kiai");
        if (!reduced) shake = 6;
      } else if (e.type === "cower") {
        float(COWER, UI.accent);
        play("flag");
        if (!reduced) shake = 8;
      } else if (e.type === "hurt") {
        hurt = HURT_TICKS;
        play("break");
        if (!reduced) shake = 6;
      }
    }
    if (state.notes.includes("slow")) float(LINE_SLOW, UI.accent);
    // Every miss says why. Anything that didn't already give its reason just says it missed.
    if (state.notes.includes("missed") && floaters.length === before) float(LINE_MISSED, UI.bad);
  };

  const drawBully = (ctx: CanvasRenderingContext2D, b: Bully, x: number) => {
    const colors = BULLY_COLORS[b.id % BULLY_COLORS.length];
    if (b.state === "down") {
      drawSprite(ctx, BULLY_DOWN, x - 16, GROUND - 12, { colors });
      return;
    }
    // What they do as they open up is the line drill's opening for the same target, so reading one teaches the other.
    const pose =
      b.state === "tell" ? OPENING_POSE[OPEN_DURING_TELL[b.kind]]
      : b.state === "stagger" || b.state === "cower" ? "stunned"
      : b.state === "recover" && b.ticks > STREET_RECOVER_TICKS - SWING_POSE_TICKS ? "strikeKote"
      : b.state === "recover" ? "recover"
      : "guard";
    const frame = b.state === "walk" ? (Math.floor(tick / 10) % 2) + 1 : 0;
    const toward = b.x > state.brawl.player.x ? -1 : 1;
    // A lunge to grab leans in a step.
    const at = b.state === "tell" && b.kind === "grab" ? x + toward * 3 : x;
    drawFighter(ctx, at, GROUND, pose, "rival", frame, NO_GEAR, { colors, flip: toward < 0, weapon: b.kind === "stick" ? "stick" : "none" });
    if (b.state === "tell" && b.kind !== "stick") drawBareHands(ctx, at, toward, b.kind === "fist" ? "high" : "low");
  };

  /** Without a stick, an arm alone is a few pixels: both fists up high, or both hands out low, say it plainly. */
  const drawBareHands = (ctx: CanvasRenderingContext2D, x: number, toward: number, where: "high" | "low") => {
    // Each one is an elbow and a fist, drawn as a short forearm with the fist at its end.
    const arms: [number, number, number, number][] = where === "high" ? [[-9, -27, -9, -40], [9, -27, 9, -41]] : [[6, -22, 15, -14], [3, -19, 13, -10]];
    for (const pass of [0, 1]) {
      for (const [ex, ey, fx, fy] of arms) {
        const steps = Math.max(Math.abs(fx - ex), Math.abs(fy - ey));
        for (let s = 0; s <= steps; s++) {
          const px = Math.round(x + (ex + ((fx - ex) * s) / steps) * toward);
          const py = Math.round(GROUND + ey + ((fy - ey) * s) / steps);
          const fist = s === steps;
          ctx.fillStyle = pass === 0 ? PALETTE.N : PALETTE.S;
          if (pass === 0) ctx.fillRect(px - (fist ? 2 : 1), py - (fist ? 2 : 1), fist ? 5 : 3, fist ? 5 : 3);
          else ctx.fillRect(px - (fist ? 1 : 0), py - (fist ? 1 : 0), fist ? 3 : 1, fist ? 3 : 1);
        }
      }
    }
  };

  return {
    forfeitLabel: () => (state.brawl.phase === "fight" ? FORFEIT_GANG : null),
    forfeit(game) {
      game.run = { ...game.run, hp: state.brawl.hp };
      game.message = [GANG_FLED];
      game.go("map");
    },
    enter(game) {
      const here = game.run.node;
      state = createStreet({
        gang: GANGS[here] ?? GANGS.market!,
        pace: GANG_PACE[here] ?? GANG_PACE.market,
        labels: streetLabels(fightsWon(game.run)),
        seed: Math.floor(Math.random() * 2 ** 31),
        kiMax: playerKiMax(game.run),
        hp: game.run.hp,
      });
      control = createPlayerControl({ openings: false });
      tick = 0;
      finishing = 0;
      camX = 0;
      floaters = [];
      sparks = [];
      striking = null;
      strikeTicks = 0;
      hurt = 0;
      lastX = state.brawl.player.x;
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
      if (hurt > 0) hurt--;
      if (strikeTicks > 0 && --strikeTicks === 0) striking = null;

      const { brawl } = state;
      if (brawl.phase !== "fight") {
        if (--finishing <= 0) {
          const here = game.run.node;
          finishing = 9999;
          game.run = { ...game.run, hp: brawl.hp };
          if (brawl.phase === "lost") {
            goDown(game, here);
            return;
          }
          if (brawl.phase === "won") {
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

      state = stepLine(state, control(game.input, brawl.player, game.run.seme));
      game.debug.brawl = state;
      react(game);
      playSemeHum(game.audio, state.brawl.player.stance === "seme", tick);
      moving = Math.abs(state.brawl.player.x - lastX) > 0.01;
      lastX = state.brawl.player.x;
      if (state.brawl.phase !== "fight") finishing = FINISH_TICKS;
    },
    render(ctx, game) {
      const { brawl } = state;
      const worldW = Math.max(viewW, brawl.worldEnd + 24);
      const target = Math.max(0, Math.min(worldW - viewW, brawl.player.x - viewW * CAMERA_AT));
      camX += (target - camX) * 0.15;
      const cx = Math.round(camX) + (shake > 0 ? (shake % 2 === 0 ? 1 : -1) : 0);
      const here = game.run.node;
      // The street stays in the middle of a tall window, with sky above and road below.
      ctx.save();
      ctx.translate(0, stageY());
      drawStreet(ctx, cx, STREETS[here] ?? "market", GROUND);

      // The one you came to help waits at the far end of the street.
      const safe = brawl.phase === "won";
      const personX = brawl.worldEnd - 12 - cx;
      drawFighter(ctx, personX, GROUND, safe ? "bow" : "stunned", "rival", 0, NO_GEAR, { colors: PERSON_COLORS[here], weapon: "none", flip: !safe || undefined });
      if (safe || Math.floor(tick / 24) % 2 === 0) {
        drawTag(ctx, safe ? SAFE_BUBBLE : HELP_BUBBLE, personX, GROUND - 47, safe ? UI.good : UI.text);
      }

      // The ones waiting their turn go behind the one coming at you.
      for (const b of brawl.bullies) if (b.state === "down") drawBully(ctx, b, b.x - cx);
      for (const b of brawl.bullies) if (b.state !== "down" && b.id !== state.active) drawBully(ctx, b, b.x - cx);
      if (state.active !== null) drawBully(ctx, brawl.bullies[state.active], brawl.bullies[state.active].x - cx);

      const p = brawl.player;
      const flicker = hurt > 0 && Math.floor(tick / 3) % 2 === 0;
      const charging = p.stance === "seme";
      const power = Math.min(1, brawl.pressure / BRAWL_SEME_TICKS);
      if (charging) drawAuraBack(ctx, p.x - cx, GROUND, tick, power, game.reducedMotion);
      if (!flicker) {
        const pose = brawl.phase === "lost" ? "stunned" : poseFor(p, { phase: brawl.zanshin ? "zanshin" : "fight", striking, scored: !!brawl.zanshin });
        const legs = legsFor(tick, moving);
        drawFighter(ctx, p.x - cx, GROUND, pose, "player", legs === "step" ? 1 : legs === "close" ? 2 : 0, game.run.gear, { flip: p.facing < 0, colors: playerColors(game.run) });
      }
      if (charging) drawAuraFront(ctx, p.x - cx, GROUND, tick, power, game.reducedMotion);

      // The one whose turn it is: how long you have, and in your first fight or two, which key answers them.
      const active = state.active === null ? null : brawl.bullies[state.active];
      if (active?.opening && brawl.phase === "fight") {
        drawKeyPrompt(ctx, active.x - cx, GROUND, state.spec.labels ? targetPrompt(active.opening, game.input) : null, state.windowLeft / state.spec.window);
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
        // Health, ki, and who's left.
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 20);
        drawText(ctx, HP_LABEL, 5, 2, UI.dim);
        drawHpBar(ctx, 5 + measureText(HP_LABEL) + 3, 3, brawl.hp, HP_BAR_FULL, 6);
        const barFull = kiBarWidth(p.kiMax);
        ctx.fillStyle = UI.track;
        ctx.fillRect(5, 13, barFull, 4);
        ctx.fillStyle = UI.accent;
        ctx.fillRect(5, 13, kiBarFill(p.ki, p.kiMax), 4);
        if (brawl.pressure > 0) {
          ctx.fillStyle = UI.bad;
          ctx.fillRect(5, 18, Math.round((KI_BAR_WIDTH * brawl.pressure) / BRAWL_SEME_TICKS), 2);
        }
        const left = brawl.bullies.filter((b) => b.state !== "down").length;
        const label = `Alley Cats: ${left} left`;
        drawText(ctx, label, viewW - 4 - measureText(label), 2, UI.text);
        // One mark a bully, the way the line drill keeps score.
        state.results.forEach((result, i) => {
          ctx.fillStyle = result === "clean" ? UI.good : i === state.active ? UI.text : UI.track;
          ctx.fillRect(viewW - 4 - state.results.length * 9 + i * 9 + 2, 13, 7, 4);
        });

        if (brawl.zanshin) drawZanshinMeter(ctx, p.facing > 0 ? "D" : "A", brawl.zanshin.traveled / brawl.zanshin.needed);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 11, viewW, 11);
        drawTextCentered(ctx, bottomLine(tick, game.run.seme), viewW / 2, viewH - 10, UI.dim);
      });
      cards.render(ctx);
    },
  };
}
