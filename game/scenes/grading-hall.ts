import { keyLabel } from "../core/key-labels.ts";
import { drawKendoka, NO_GEAR } from "../art/kendoka.ts";
import { EXAMINER_COLORS, HALL_CROWD_COLORS, PALETTE } from "../art/palette.ts";
import { drawPresence, drawRankTag } from "../art/presence.ts";
import { TILE } from "../art/tiles.ts";
import type { TileMap } from "../core/collision.ts";
import { viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { playerColors } from "../characters.ts";
import { hasTicket, payGradingFee, talkToPanel } from "../grading.ts";
import { personDan, presenceOf } from "../ranks.ts";
import type { OpponentId } from "../world/dojos.ts";
import { interactionLabel } from "./club-story.ts";
import { GRADING_HALL_NAME, HALL_ARRIVAL, HALL_DONE, HALL_OBJECTIVE } from "./content.ts";
import { crowdDrawings, nearestShown } from "./crowd.ts";
import { figureAt, speakersIn, type Figure } from "./bubble.ts";
import { createDialogue } from "./dialogue.ts";
import { createEntrance, createStride, personAhead } from "./moves.ts";
import { findTiles, HALL_MAP, HALL_SOLID } from "./levels.ts";
import { cameraFor, createWalker, drawRoom, drawWalker, tileInFront, updateWalker, type Walker } from "./topdown.ts";
import { drawInteractPrompt, drawObjective, drawTopBar } from "./ui.ts";
import { walkingGear } from "../run-state.ts";

const MAP: TileMap = { rows: HALL_MAP, solid: HALL_SOLID, tile: TILE };
/** Ono sits in the middle, with a 7th dan on either side. */
const SIDE_EXAMINER_DAN = 7;

/** Where your ticket takes you: nobody gets here any other way, and it isn't on the map. */
export function createGradingHallScene(nameOf: () => string): Scene {
  const dialogue = createDialogue(nameOf);
  let walker: Walker;
  let tick = 0;
  let seed = 0;
  /** You coming in through the door, and going up to the panel. */
  let entrance: { update(): boolean } | null = null;
  let stride: { update(walker: Walker, map: TileMap): boolean } | null = null;

  const startBout = (game: Game, fight: OpponentId) => {
    game.versus = fight;
    game.go("duel");
  };
  const talkPanel = (game: Game) => {
    const reply = talkToPanel(game.run, game.grading);
    const { fight, next } = reply;
    dialogue.open(reply.lines, next ? () => {
      // Backing out of the conversation costs nothing. Starting is what you pay for.
      if (next === "kihon") game.run = payGradingFee(game.run);
      game.grading = next;
      if (fight) startBout(game, fight);
      else game.go("line");
    } : undefined);
  };
  const leaveHall = (game: Game) => {
    game.grading = null;
    game.ride = "fromHall";
    game.go("travel");
  };

  return {
    busy: () => dialogue.active,
    enter(game) {
      seed = Math.floor(Math.random() * 2 ** 31);
      const [start] = findTiles(HALL_MAP, "@");
      // Back from a bout or the demonstration, you're still standing in front of the panel where you were.
      const stayed = game.returning && walker !== undefined;
      if (!stayed) walker = createWalker(start.col, start.row);
      entrance = null;
      stride = null;
      if (game.message) {
        const lines = game.message;
        game.message = null;
        // Past the demonstration, the bout follows straight on. Backing out just means walking back up to them.
        if (game.grading === "tachiai") {
          const reply = talkToPanel(game.run, "tachiai");
          dialogue.open([...lines, ...reply.lines], reply.fight ? () => startBout(game, reply.fight!) : undefined);
        } else dialogue.open(lines);
      } else if (!stayed) entrance = createEntrance(walker, findTiles(HALL_MAP, "D")[0], start, { rows: HALL_MAP, solid: "", tile: TILE });
    },
    update(game) {
      tick++;
      game.debug.talking = dialogue.active;
      if (dialogue.active) {
        dialogue.update(game.input, game.audio);
        return;
      }
      if (entrance) {
        if (entrance.update()) {
          entrance = null;
          dialogue.open(HALL_ARRIVAL);
        }
        return;
      }
      if (stride) {
        if (stride.update(walker, MAP)) {
          stride = null;
          talkPanel(game);
        }
        return;
      }
      updateWalker(walker, game.input, MAP);
      game.debug.walker = walker.box;
      const front = tileInFront(walker, HALL_MAP);
      if (!game.input.wasPressed("confirm")) return;
      const ahead = personAhead(walker, HALL_MAP, HALL_SOLID, "P");
      if (ahead) stride = createStride(walker, ahead.stand);
      else if (front === "D") leaveHall(game);
    },
    render(ctx, game) {
      const cam = cameraFor(walker, HALL_MAP);
      ctx.fillStyle = PALETTE.K;
      ctx.fillRect(0, 0, viewW, viewH);
      drawRoom(ctx, HALL_MAP, cam, true, "hall");
      const you = { x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y - cam.y };
      const tags: (() => void)[] = [];
      const panel = findTiles(HALL_MAP, "P");
      const tagged = nearestShown(you, panel.map((spot) => ({ x: spot.col * TILE - cam.x + 8, y: spot.row * TILE + 12 - cam.y })));
      const examiners = panel.map((spot, i) => {
        const x = spot.col * TILE - cam.x;
        const y = spot.row * TILE - 4 - cam.y;
        const dan = i === 1 ? personDan("examiner") : SIDE_EXAMINER_DAN;
        if (i === tagged) tags.push(() => drawRankTag(ctx, i === 1 ? "Ono" : "Examiner", x + 8, y - 8, true));
        return {
          y: spot.row * TILE,
          draw: () => {
            drawPresence(ctx, x + 8, y + 20, tick, presenceOf(dan), game.reducedMotion);
            drawKendoka(ctx, x, y, "down", 0, NO_GEAR, { colors: EXAMINER_COLORS });
          },
        };
      });
      const people = [
        ...examiners,
        ...crowdDrawings(ctx, HALL_MAP, cam, tick, game.reducedMotion, (i) => HALL_CROWD_COLORS[i % HALL_CROWD_COLORS.length], seed, (draw) => tags.push(draw)),
        { y: walker.box.y - 8, draw: () => drawWalker(ctx, walker, cam, walkingGear(game.run), playerColors(game.run)) },
      ];
      people.sort((a, b) => a.y - b.y).forEach((who) => who.draw());
      if (!dialogue.active) tags.forEach((tag) => tag());
      drawTopBar(ctx, GRADING_HALL_NAME, game.run);
      if (!dialogue.active) {
        // Passing retires the ticket, so without one you've done what you came for.
        drawObjective(ctx, hasTicket(game.run) ? HALL_OBJECTIVE : HALL_DONE);
        const label = interactionLabel(personAhead(walker, HALL_MAP, HALL_SOLID, "P")?.char ?? tileInFront(walker, HALL_MAP), "hall");
        if (label) drawInteractPrompt(ctx, label, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - cam.y, keyLabel(game.input, "confirm", "e"));
      }
      const yours: Figure = figureAt(ctx, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - 12 - cam.y, walker.box.y + 8 - cam.y);
      // Ono does the talking, from the middle of the panel.
      const ono = panel[1];
      const figures = { P: figureAt(ctx, ono.col * TILE - cam.x + 8, ono.row * TILE - 4 - cam.y, ono.row * TILE + 16 - cam.y) };
      dialogue.render(ctx, speakersIn(figures, { "Examiner Ono": "P" }, yours, "P"));
    },
  };
}
