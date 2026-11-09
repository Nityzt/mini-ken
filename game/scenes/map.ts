import { keyLabel } from "../core/key-labels.ts";
import { playerColors } from "../characters.ts";
import { currentObjective } from "../objective.ts";
import { createShop } from "./shop.ts";
import { drawObjective, drawStatus, fitTitle, statusWidth } from "./ui.ts";
import { drawKendoka, type Facing } from "../art/kendoka.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { GEN_COLORS, PALETTE, PERSON_COLORS, UI } from "../art/palette.ts";
import { drawSprite, spriteFor } from "../art/sprite.ts";
import { TILE_GRIDS } from "../art/tiles.ts";
import { drawMiniTrain, drawStreetcar, PATH_EDGE, PATH_FILL, STREETCAR_Y, TRAIN_Y, WORLD_GRIDS, drawWorldBackdrop } from "../art/world.ts";
import { onGui, onStage, STAGE_H, STAGE_W, stageX, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { lockedLine, lockFor, unmet } from "../progress.ts";
import { recordTower, type RunState, walkingGear } from "../run-state.ts";
import { DIRECTIONS, EDGES, exitsFrom, neighbor, NODES, nodesIn, routesFrom, TOWER_HEIGHT, type Direction, type District, type NodeId, type Route, type WorldNode } from "../world/map.ts";
import { stepsTo } from "../world/routes.ts";
import { benchJobs, durabilityOf, fixGear, type GearKey } from "../durability.ts";
import { gearName } from "../items.ts";
import { AUTO_LOST, AUTO_WALK, benchLabel, BENCH_BROWSE, BENCH_FIXED_FUMI, BENCH_FIXED_SELF, BENCH_TOO_DEAR, CHOOSE_HELP, CHOOSE_TITLE, FUMI_BUILD_DONE, GANG_STORIES, GEN_LINES, MAP_HELP, SHINAI_STEPS, TOWER_AGAIN, TOWER_FIRST } from "./content.ts";
import { finishBuilding, genOnBamboo, shopArrival, stepIsRight } from "./shinai-story.ts";
import { openTopics } from "./chatter.ts";
import { createMenu } from "./choice.ts";
import { figureAt, type Figure } from "./bubble.ts";
import { createDialogue } from "./dialogue.ts";
import { canRide } from "./exit.ts";

const SPEED = 1.5;
/** Quicker when you've said where you're going, so a long way doesn't drag, but you still see all of it. */
const AUTO_SPEED = 2.25;
const ENTERS_ON_ARRIVAL: WorldNode["kind"][] = ["dojo", "store", "tournament", "master"];
const ARROW: Record<Direction, [number, number]> = { left: [-13, -3], right: [13, -3], up: [0, -25], down: [0, 7] };
const DOJO_ART: Partial<Record<NodeId, string[]>> = {
  pinecone: WORLD_GRIDS.dojoPine,
  radish: WORLD_GRIDS.dojoRadish,
  goose: WORLD_GRIDS.dojoGoose,
  raccoon: WORLD_GRIDS.dojoRaccoon,
  heron: WORLD_GRIDS.dojoHeron,
  otter: WORLD_GRIDS.dojoOtter,
};
const MARKER_WIDTHS = [9, 13, 15, 15, 15, 13, 9];
const MARKER_COLORS: Record<string, string> = { dojo: PALETTE.Y, stop: PALETTE.C, station: "#7FD1AE", tower: PALETTE.W, path: PALETTE.W, master: PALETTE.G, tournament: "#C08CF0", store: "#F0A04B" };
const LOCKED_MARKER = "#77757E";
const LOCKED_ART_ALPHA = 0.5;

/** A solid bright line with a dark edge, so it reads against anything the city puts under it. */
function drawPaths(ctx: CanvasRenderingContext2D, district: District, cleared: readonly string[]): void {
  const edges = EDGES.filter((edge) => NODES[edge.from].district === district && (!edge.requires || cleared.includes(edge.requires)));
  const trace = (color: string, size: number) => {
    ctx.fillStyle = color;
    for (const edge of edges) {
      const a = NODES[edge.from];
      const b = NODES[edge.to];
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
        const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
        ctx.fillRect(x - (size >> 1), y - (size >> 1), size, size);
      }
    }
  };
  trace(PATH_EDGE, 5);
  trace(PATH_FILL, 3);
}

/** Every place stands on its own colored marker, so it can be found at a glance. */
function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, small: boolean): void {
  const scale = small ? 0.6 : 1;
  MARKER_WIDTHS.forEach((full, row) => {
    const width = Math.round(full * scale);
    if (small && (row === 0 || row === 6)) return;
    const top = y - 3 + row;
    ctx.fillStyle = PATH_EDGE;
    ctx.fillRect(x - (width >> 1) - 1, top - 1, width + 2, 3);
  });
  MARKER_WIDTHS.forEach((full, row) => {
    const width = Math.round(full * scale);
    if (small && (row === 0 || row === 6)) return;
    ctx.fillStyle = color;
    ctx.fillRect(x - (width >> 1), y - 3 + row, width, 1);
  });
}

function drawGang(ctx: CanvasRenderingContext2D, id: NodeId, cleared: boolean, locked: boolean, tick: number): void {
  const { x, y } = NODES[id];
  drawMarker(ctx, x, y, locked ? LOCKED_MARKER : cleared ? PALETTE.G : PALETTE.R, false);
  const person = { colors: PERSON_COLORS[id] };
  if (cleared) {
    drawSprite(ctx, WORLD_GRIDS.person, x - 4, y - 21, person);
    drawSprite(ctx, WORLD_GRIDS.bubbleHeart, x - 13, y - 22);
    return;
  }
  const bob = Math.floor(tick / 24) % 2;
  drawSprite(ctx, WORLD_GRIDS.person, x - 17, y - 20, person);
  drawSprite(ctx, WORLD_GRIDS.gang, x + 5, y - 20 - bob);
  if (!locked && Math.floor(tick / 16) % 2 === 0) drawSprite(ctx, WORLD_GRIDS.bubbleAlert, x - 27, y - 22);
}

function drawNode(ctx: CanvasRenderingContext2D, id: NodeId, run: RunState, tick: number): void {
  const node = NODES[id];
  const { blessed, seme } = run;
  const locked = lockFor(run, id) !== null;
  if (node.kind === "gang") {
    drawGang(ctx, id, run.cleared.includes(id), locked, tick);
    if (locked) drawSprite(ctx, WORLD_GRIDS.padlock, node.x - 3, node.y - 12);
    return;
  }
  drawMarker(ctx, node.x, node.y, locked ? LOCKED_MARKER : MARKER_COLORS[node.kind], node.kind === "path");
  // Dojos are drawn large and sit just behind the path, so whoever stands there is out in front.
  const dojo = DOJO_ART[id];
  if (dojo) {
    const art = spriteFor(dojo);
    if (locked) ctx.globalAlpha = LOCKED_ART_ALPHA;
    ctx.drawImage(art, node.x - art.width, node.y - 4 - art.height * 2, art.width * 2, art.height * 2);
    ctx.globalAlpha = 1;
    if (locked) drawSprite(ctx, WORLD_GRIDS.padlock, node.x - 3, node.y - 26);
  } else if (node.kind === "stop") {
    drawSprite(ctx, WORLD_GRIDS.stop, node.x - 8, node.y - 14);
  } else if (node.kind === "station") {
    drawSprite(ctx, WORLD_GRIDS.station, node.x - 8, node.y - 15);
    if (locked) drawSprite(ctx, WORLD_GRIDS.padlock, node.x + 9, node.y - 12);
  }
  else if (node.kind === "store") {
    // A little shop with a striped awning.
    const left = node.x - 8;
    const top = node.y - 18;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(left + 1, top + 5, 14, 9);
    ctx.fillStyle = PALETTE.b;
    ctx.fillRect(left + 6, top + 9, 4, 5);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? PALETTE.W : PALETTE.R;
      ctx.fillRect(left + i * 2, top + 2, 2, 4);
    }
  }
  else if (node.kind === "master") {
    // A hermit's hut, with Old Gen out front waving you over until you've learned what there is to learn.
    drawSprite(ctx, WORLD_GRIDS.hut, node.x + 13, node.y - 13);
    drawSprite(ctx, WORLD_GRIDS.person, node.x + 6, node.y - 8, { colors: GEN_COLORS });
    if (!seme && !locked && Math.floor(tick / 16) % 2 === 0) drawSprite(ctx, WORLD_GRIDS.bubbleAlert, node.x + 12, node.y - 13);
    if (locked) drawSprite(ctx, WORLD_GRIDS.padlock, node.x - 3, node.y - 12);
  } else if (node.kind === "tower") {
    drawSprite(ctx, WORLD_GRIDS.tower, node.x - 8, node.y - TOWER_HEIGHT);
    // The aircraft light on top blinks, and until you've been up, so does the deck.
    if (Math.floor(tick / 30) % 2 === 0) {
      ctx.fillStyle = PALETTE.R;
      ctx.fillRect(node.x - 1, node.y - TOWER_HEIGHT, 2, 2);
    }
    if (!blessed && Math.floor(tick / 20) % 2 === 0) {
      ctx.fillStyle = PALETTE.Y;
      ctx.fillRect(node.x - 5, node.y - TOWER_HEIGHT + 19, 10, 1);
    }
  }
}

/** The destinations board at a stop or a station. */
function drawChooser(ctx: CanvasRenderingContext2D, routes: Route[], choice: number, run: RunState): void {
  const rowHeight = 11;
  const height = routes.length * rowHeight + 28;
  const top = Math.round((STAGE_H - height) / 2);
  ctx.fillStyle = UI.edge;
  ctx.fillRect(14, top - 1, STAGE_W - 28, height + 2);
  ctx.fillStyle = UI.panel;
  ctx.fillRect(15, top, STAGE_W - 30, height);
  drawTextCentered(ctx, CHOOSE_TITLE, STAGE_W / 2, top + 3, UI.text);
  routes.forEach((route, i) => {
    const y = top + 15 + i * rowHeight;
    const lock = route.line ? lockFor(run, route.line) : null;
    const selected = i === choice;
    if (selected) drawText(ctx, ">", 19, y, UI.accent);
    drawText(ctx, NODES[route.to].name, 27, y, lock ? UI.faint : selected ? UI.accent : UI.text);
    if (lock) {
      const needs = unmet(run, lock).join(", ");
      drawText(ctx, needs, STAGE_W - 19 - measureText(needs), y, UI.dim);
    }
  });
  drawTextCentered(ctx, CHOOSE_HELP, STAGE_W / 2, top + height - 11, UI.dim);
}

function promptAt(id: NodeId, run: RunState): string {
  const { kind } = NODES[id];
  const lock = lockFor(run, id);
  if (lock) return `Locked: ${unmet(run, lock).join(", ")}`;
  if (kind === "gang" && run.cleared.includes(id)) return MAP_HELP.gangDone;
  return MAP_HELP[kind];
}

/** Walk between places along the paths. Everything off the main road is optional. */
export function createMapScene(nameOf: () => string): Scene {
  const dialogue = createDialogue(nameOf);
  let youOnMap: Figure | null = null;
  const menu = createMenu();
  let tick = 0;
  let walking: { from: NodeId; to: NodeId; dir: Direction; progress: number; length: number } | null = null;
  let facing: Facing = "down";
  let flip = false;
  let choosing: { routes: Route[]; choice: number } | null = null;
  const shop = createShop();

  const ride = (game: Game, route: Route) => {
    game.ride = route.to;
    game.go("travel");
  };

  /** Fumi asks and you answer, one part of the shinai at a time. X puts it down for now, and nothing's lost but the place you'd got to. */
  const buildStep = (game: Game, step: number) => {
    const { question, options, wrong } = SHINAI_STEPS[step];
    dialogue.open([question], () => {
      menu.open(options, (id) => {
        if (!stepIsRight(step, id)) dialogue.open([wrong], () => buildStep(game, step));
        else if (step + 1 < SHINAI_STEPS.length) buildStep(game, step + 1);
        else {
          game.run = finishBuilding(game.run);
          game.showCards(() => dialogue.open(FUMI_BUILD_DONE));
        }
      });
    });
  };
  /** Anything that needs mending comes first, and then the shelves. X just walks out. */
  const openBench = (game: Game) => {
    const jobs = benchJobs(game.run);
    if (!jobs.length) {
      shop.open("store");
      return;
    }
    const options = [...jobs.map(({ key, cost }) => ({ id: key, label: benchLabel(gearName(key), durabilityOf(game.run, key), cost) })), { id: "shelves", label: BENCH_BROWSE }];
    menu.open(options, (id) => {
      if (id === "shelves") {
        shop.open("store");
        return;
      }
      const key = id as GearKey;
      const before = game.run;
      game.run = fixGear(before, key);
      const fixed = durabilityOf(game.run, key) !== durabilityOf(before, key);
      const ownHands = fixed && game.run.money === before.money;
      dialogue.open([!fixed ? BENCH_TOO_DEAR : ownHands ? BENCH_FIXED_SELF(gearName(key)) : BENCH_FIXED_FUMI(gearName(key))], () => openBench(game));
    });
  };
  const enterHere = (game: Game) => {
    const here = game.run.node;
    const node = NODES[here];
    const lock = lockFor(game.run, here);
    if (lock) dialogue.open([lockedLine(game.run, lock)]);
    else if (here === "pinecone") game.go("club");
    else if (node.kind === "dojo") game.go("rival-dojo");
    else if (node.kind === "stop" || node.kind === "station") {
      const routes = routesFrom(here);
      if (routes.length === 1) ride(game, routes[0]);
      else choosing = { routes, choice: 0 };
    } else if (node.kind === "tournament") {
      game.tournament = null;
      game.go("tournament");
    }
    else if (node.kind === "master") {
      const bamboo = genOnBamboo(game.run);
      if (bamboo) dialogue.open(bamboo.lines, () => {
        game.run = bamboo.run;
      });
      else if (game.run.seme) openTopics(game, menu, dialogue, "gen");
      else {
        dialogue.open(GEN_LINES, () => {
          game.session = { kind: "master" };
          game.go("training");
        });
      }
    } else if (node.kind === "store") {
      const arrival = shopArrival(game.run);
      if (!arrival) openBench(game);
      else dialogue.open(arrival.lines, () => {
        game.run = arrival.run;
        if (arrival.build) buildStep(game, 0);
        else openBench(game);
      });
    } else if (node.kind === "gang") {
      const story = GANG_STORIES[here];
      if (game.run.cleared.includes(here)) openTopics(game, menu, dialogue, here);
      else dialogue.open(story.help, () => game.go("brawl"));
    } else if (node.kind === "tower") {
      if (game.run.blessed) dialogue.open([TOWER_AGAIN]);
      else {
        game.run = recordTower(game.run);
        game.audio.play("secret");
        dialogue.open([TOWER_FIRST]);
      }
    }
  };

  const setOff = (game: Game, to: NodeId, dir: Direction) => {
    const a = NODES[game.run.node];
    const b = NODES[to];
    walking = { from: game.run.node, to, dir, progress: 0, length: Math.hypot(b.x - a.x, b.y - a.y) };
    facing = dir === "up" ? "up" : dir === "down" ? "down" : "side";
    flip = dir === "left";
    game.debug.map = { walking: true };
  };

  /** One more stretch of the way to wherever you said you were going, and in through the door once you're there. */
  const keepGoing = (game: Game, target: NodeId) => {
    if (game.run.node === target) {
      game.autoTo = null;
      if (ENTERS_ON_ARRIVAL.includes(NODES[target].kind)) enterHere(game);
      return;
    }
    const step = stepsTo(game.run.node, target, game.run.cleared, canRide(game.run))?.[0];
    if (!step) {
      game.autoTo = null;
      dialogue.open([AUTO_LOST]);
    } else if (step.kind === "walk") setOff(game, step.to, step.dir);
    else ride(game, step.route);
  };

  /** Somewhere new goes on the list of places you can come back to. */
  const noteArrival = (game: Game) => {
    const { node, visited } = game.run;
    if (!visited.includes(node)) game.run = { ...game.run, visited: [...visited, node] };
  };

  return {
    busy: () => dialogue.active || menu.active || choosing !== null,
    enter(game) {
      walking = null;
      choosing = null;
      noteArrival(game);
      if (game.message) {
        dialogue.open(game.message);
        game.message = null;
      }
      game.debug.map = { walking: false };
    },
    update(game) {
      tick++;
      game.debug.talking = dialogue.active || menu.active;
      if (dialogue.active) {
        dialogue.update(game.input, game.audio);
        return;
      }
      if (menu.active) {
        menu.update(game.input);
        return;
      }
      if (shop.active) {
        shop.update(game);
        return;
      }
      const { input } = game;
      if (choosing) {
        const { routes } = choosing;
        if (input.wasPressed("cancel")) choosing = null;
        else if (input.wasPressed("up")) choosing.choice = (choosing.choice + routes.length - 1) % routes.length;
        else if (input.wasPressed("down")) choosing.choice = (choosing.choice + 1) % routes.length;
        else if (input.wasPressed("confirm")) {
          const route = routes[choosing.choice];
          const lock = route.line ? lockFor(game.run, route.line) : null;
          if (lock) dialogue.open([lockedLine(game.run, lock)]);
          else {
            choosing = null;
            ride(game, route);
          }
        }
        game.debug.map = { walking: false, choosing: choosing?.choice ?? null };
        return;
      }
      if (game.autoTo && input.wasPressed("cancel")) game.autoTo = null;
      if (walking) {
        walking.progress += (game.autoTo ? AUTO_SPEED : SPEED) / walking.length;
        if (walking.progress >= 1) {
          game.run = { ...game.run, node: walking.to };
          noteArrival(game);
          walking = null;
        }
        game.debug.map = { walking: !!walking };
        return;
      }
      if (game.autoTo) {
        keepGoing(game, game.autoTo);
        return;
      }
      for (const dir of DIRECTIONS) {
        if (!input.isDown(dir)) continue;
        const to = neighbor(game.run.node, dir, game.run.cleared);
        if (!to) continue;
        setOff(game, to, dir);
        return;
      }
      if (input.wasPressed("confirm")) enterHere(game);
    },
    render(ctx, game) {
      const district = NODES[game.run.node].district;
      drawWorldBackdrop(ctx, district);
      // Everything you can walk to stays on the stage, in the middle of whatever the window shows.
      onStage(ctx, () => {
      const carX = game.reducedMotion ? 60 : ((tick * 0.2) % (viewW + 32)) - 16 - stageX();
      const carY = STREETCAR_Y[district];
      if (carY !== undefined) drawStreetcar(ctx, carX, carY);
      const trainY = TRAIN_Y[district];
      if (trainY !== undefined) drawMiniTrain(ctx, game.reducedMotion ? 90 : ((tick * 0.3) % (viewW + 80)) - 70 - stageX(), trainY);
      drawPaths(ctx, district, game.run.cleared);
      for (const id of nodesIn(district)) drawNode(ctx, id, game.run, tick);

      let x = NODES[game.run.node].x;
      let y = NODES[game.run.node].y;
      if (walking) {
        const a = NODES[walking.from];
        const b = NODES[walking.to];
        x = a.x + (b.x - a.x) * walking.progress;
        y = a.y + (b.y - a.y) * walking.progress;
      }
      const frame = (walking ? Math.floor(tick / 7) % 2 : 0) as 0 | 1;
      drawKendoka(ctx, x - 8, y - 19, facing, frame, walkingGear(game.run), { flip, colors: playerColors(game.run) });
      // On the map, it's all said where you're standing.
      youOnMap = figureAt(ctx, x, y - 19, y + 1);
      // Blinking arrows show which ways you can go.
      if (!walking && Math.floor(tick / 16) % 2 === 0) {
        for (const dir of exitsFrom(game.run.node, game.run.cleared)) {
          const [dx, dy] = ARROW[dir];
          ctx.fillStyle = PATH_EDGE;
          ctx.fillRect(x + dx - 2, y + dy - 2, 5, 5);
          ctx.fillStyle = PALETTE.W;
          ctx.fillRect(x + dx - 1, y + dy - 1, 3, 3);
        }
      }
      });

      onGui(ctx, () => {
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 11);
        const showing = walking ? walking.to : game.run.node;
        const trouble = NODES[showing].kind === "gang" && !game.run.cleared.includes(showing);
        const warning = `${NODES[showing].name}: Alley Cats!`;
        const roomy = measureText(warning) + statusWidth(game.run) + 6 <= viewW;
        const title = trouble && roomy ? warning : fitTitle(NODES[showing].name, viewW, statusWidth(game.run));
        drawText(ctx, title, 3, 1, trouble ? UI.accent : UI.text);
        drawStatus(ctx, game.run);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 11, viewW, 11);
        const prompt = game.autoTo ? AUTO_WALK(NODES[game.autoTo].name) : walking ? "" : promptAt(game.run.node, game.run).replace("Arrows or WASD", `${keyLabel(game.input, "left", "a")} ${keyLabel(game.input, "right", "d")} ${keyLabel(game.input, "up", "w")} ${keyLabel(game.input, "down", "s")}`).replace("E ", `${keyLabel(game.input, "confirm", "e")} `);
        drawTextCentered(ctx, prompt, viewW / 2, viewH - 10, UI.dim);
        if (!dialogue.active && !choosing) drawObjective(ctx, currentObjective(game.run));
        if (choosing) {
          const { routes, choice } = choosing;
          onStage(ctx, () => drawChooser(ctx, routes, choice, game.run));
        }
        const here = youOnMap;
        dialogue.render(ctx, here ? { at: () => here, avoid: [] } : undefined);
        menu.render(ctx);
        shop.render(ctx, game);
      });
    },
  };
}
