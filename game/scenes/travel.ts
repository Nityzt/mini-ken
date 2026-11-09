import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { onGui, stageY, viewH, viewW } from "../core/scale.ts";
import type { Scene } from "../core/scene.ts";
import { NODES, routesFrom } from "../world/map.ts";
import { resumeScene } from "../save.ts";
import { createHallTrip, createTrip, stepTrip, tripProgress, type Trip } from "../world/trip.ts";
import { GRADING_HALL_NAME, HEADING_BACK, NEXT_STOP, TRAVELLING } from "./content.ts";
import { walkingGear } from "../run-state.ts";

const ROAD_Y = 112;
const WIRE_Y = 44;
const CAR_WIDTH = 92;
const CAR_TOP = 74;

type Paint = (x: number, y: number, w: number, h: number, color: string) => void;

function drawScenery(fill: Paint, scroll: number, wires: boolean): void {
  // A dusk sky, in hard bands. Night carries on above, however tall the window is.
  fill(0, -stageY(), viewW, stageY(), "#232A52");
  ([[0, "#232A52"], [24, "#3A3468"], [46, "#6B4478"], [64, "#B5616E"], [78, "#E79A67"]] as const).forEach(([y, color]) => fill(0, y, viewW, 112 - y, color));
  for (let x = 0; x < viewW; x += 44) fill(x + 20, 16 + ((x * 3) % 15), 1, 1, PALETTE.W);

  const repeat = (speed: number, spacing: number, draw: (x: number, index: number) => void) => {
    const offset = scroll * speed;
    const first = Math.floor(offset / spacing) - 1;
    for (let i = first; i * spacing - offset < viewW + spacing; i++) draw(i * spacing - offset, i);
  };
  // Far towers with lit windows, and the needle tower coming round now and then.
  repeat(0.15, 22, (x, i) => {
    const h = 18 + ((i * 7 + 40) % 5) * 7;
    fill(x, 104 - h, 18, h, "#4A3F6B");
    for (let wy = 104 - h + 3; wy < 100; wy += 5) if ((wy + i) % 3 !== 0) fill(x + 4 + (i & 7), wy, 2, 2, PALETTE.Y);
  });
  repeat(0.15, 220, (x) => {
    fill(x + 7, 34, 2, 30, "#3B3159");
    fill(x + 3, 62, 10, 5, "#3B3159");
    fill(x + 6, 67, 4, 38, "#3B3159");
  });
  // Trees and low shops close by.
  repeat(0.6, 62, (x, i) => {
    if (i % 3 === 0) {
      fill(x + 6, 94, 3, 14, PALETTE.b);
      fill(x, 82, 15, 13, PALETTE.g);
      fill(x + 2, 79, 11, 3, PALETTE.g);
    } else {
      fill(x, 90, 34, 18, i % 3 === 1 ? "#7A5A62" : "#5F6A7A");
      fill(x, 88, 34, 3, PALETTE.K);
      fill(x + 4, 95, 9, 7, PALETTE.Y);
      fill(x + 20, 95, 8, 13, PALETTE.b);
    }
  });
  // The road, its rails, and the overhead wire on its poles.
  fill(0, 108, viewW, 4, "#55525A");
  fill(0, ROAD_Y, viewW, viewH - stageY() - ROAD_Y, "#3A3A42");
  fill(0, ROAD_Y + 1, viewW, 1, PALETTE.w);
  repeat(1, 20, (x) => fill(x, ROAD_Y + 2, 8, 1, "#55525A"));
  if (!wires) {
    // A train runs on ties, with no wire overhead.
    repeat(1, 8, (x) => fill(x, ROAD_Y, 3, 3, PALETTE.b));
    return;
  }
  fill(0, WIRE_Y, viewW, 1, PALETTE.K);
  repeat(1, 120, (x) => {
    fill(x, WIRE_Y - 2, 2, 66, PALETTE.K);
    fill(x - 8, WIRE_Y - 2, 18, 1, PALETTE.K);
  });
}

/** The car faces right. Passengers sit in the windows, and yours is the second one along. */
function drawCar(fill: Paint, left: number, bounce: number, face: { hair: string; bob: number }): void {
  const top = CAR_TOP + bounce;
  // Trolley pole up to the wire.
  for (let i = 0; i < top - 2 - WIRE_Y; i++) fill(left + 44 + Math.floor(i * 0.7), top - 2 - i, 2, 1, PALETTE.K);
  fill(left + 8, top - 2, CAR_WIDTH - 16, 2, PALETTE.K);
  fill(left + 1, top, CAR_WIDTH - 2, 34, PALETTE.K);
  fill(left + 2, top + 1, CAR_WIDTH - 4, 32, PALETTE.R);
  fill(left + 2, top + 1, CAR_WIDTH - 4, 3, PALETTE.W);
  fill(left + 2, top + 21, CAR_WIDTH - 4, 3, PALETTE.W);
  fill(left + 2, top + 30, CAR_WIDTH - 4, 3, PALETTE.r);
  // Windows.
  const windows = [8, 22, 36, 62, 76];
  for (const wx of windows) {
    fill(left + wx - 1, top + 5, 13, 15, PALETTE.K);
    fill(left + wx, top + 6, 11, 13, "#F2DFA0");
  }
  // Doors in the middle.
  fill(left + 50, top + 5, 10, 25, PALETTE.K);
  fill(left + 51, top + 6, 8, 23, PALETTE.C);
  fill(left + 55, top + 6, 1, 23, PALETTE.K);
  // Passengers, and you.
  const head = (wx: number, hair: string, skin: string, bob: number) => {
    fill(left + wx + 3, top + 10 + bob, 6, 2, hair);
    fill(left + wx + 3, top + 12 + bob, 6, 4, skin);
    fill(left + wx + 7, top + 13 + bob, 1, 1, PALETTE.K);
    fill(left + wx + 2, top + 16 + bob, 8, 3, PALETTE.k);
  };
  head(8, "#8A5FA8", "#D9A277", 0);
  head(22, face.hair, PALETTE.S, face.bob);
  head(62, "#6E6A66", PALETTE.S, 0);
  // The tip of your shinai pokes out of the window.
  fill(left + 22 + 10, top + 7 + face.bob, 1, 12, PALETTE.Y);
  // Headlight and wheels.
  fill(left + CAR_WIDTH - 3, top + 25, 2, 3, PALETTE.Y);
  for (const wx of [12, 66]) {
    fill(left + wx, CAR_TOP + 34, 14, 4, PALETTE.K);
    fill(left + wx + 4, CAR_TOP + 35, 6, 2, PALETTE.k);
  }
}

const TRAIN_CAR = 92;
const TRAIN_GREEN = "#2E8B57";
const TRAIN_DARK = "#1F6B42";

/** A green and white double-decker commuter train. You're on the upper deck of the middle car. */
function drawTrain(fill: Paint, bounce: number, face: { hair: string; bob: number }): void {
  const top = 62 + bounce;
  const wheelY = 62 + 46;
  // As many cars as it takes to run off both sides of the window. You're in the one in the middle.
  const middle = Math.floor((viewW - TRAIN_CAR) / 2);
  const spare = Math.ceil(viewW / (TRAIN_CAR + 2));
  for (let car = -spare; car <= spare; car++) {
    const left = middle + car * (TRAIN_CAR + 2);
    fill(left, top, TRAIN_CAR, 46, PALETTE.K);
    fill(left + 1, top + 1, TRAIN_CAR - 2, 44, PALETTE.W);
    fill(left + 1, top + 1, TRAIN_CAR - 2, 3, PALETTE.w);
    // The green band low down, and a thin stripe above it.
    fill(left + 1, top + 30, TRAIN_CAR - 2, 15, TRAIN_GREEN);
    fill(left + 1, top + 28, TRAIN_CAR - 2, 1, TRAIN_DARK);
    // Two decks of windows.
    for (let wx = 5; wx < TRAIN_CAR - 12; wx += 14) {
      for (const wy of [6, 18]) {
        fill(left + wx - 1, top + wy - 1, 12, 9, PALETTE.K);
        fill(left + wx, top + wy, 10, 7, "#F2DFA0");
      }
    }
    // The doors.
    fill(left + 40, top + 18, 12, 27, PALETTE.K);
    fill(left + 41, top + 19, 10, 25, PALETTE.C);
    fill(left + 46, top + 19, 1, 25, PALETTE.K);
    for (const wx of [10, TRAIN_CAR - 24]) {
      fill(left + wx, wheelY, 14, 4, PALETTE.K);
      fill(left + wx + 4, wheelY + 1, 6, 2, PALETTE.k);
    }
  }
  // You, on the upper deck of the middle car, with your shinai poking up.
  const you = middle + 33;
  fill(you + 2, top + 8 + face.bob, 6, 2, face.hair);
  fill(you + 2, top + 10 + face.bob, 6, 3, PALETTE.S);
  fill(you + 6, top + 11 + face.bob, 1, 1, PALETTE.K);
  fill(you + 9, top + 6 + face.bob, 1, 7, PALETTE.y);
}

/** The view from the ride: the city going past and the car you're on. */
export function drawRide(ctx: CanvasRenderingContext2D, ride: { train: boolean; eastbound: boolean; tick: number; still: boolean; hair: string }): void {
  const { train, eastbound, tick, still, hair } = ride;
  const fill: Paint = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const bounce = still ? 0 : Math.floor(tick / 10) % 2;
  const bob = still ? 0 : Math.floor(tick / 20) % 2;
  const left = (viewW - CAR_WIDTH) / 2;
  ctx.save();
  ctx.translate(0, stageY());
  drawScenery(fill, still ? 0 : (eastbound ? tick : -tick) * (train ? 3 : 2), !train);
  if (!eastbound) {
    ctx.translate(viewW, 0);
    ctx.scale(-1, 1);
  }
  if (train) drawTrain(fill, bounce, { hair, bob });
  else drawCar(fill, left, bounce, { hair, bob });
  ctx.restore();
}

/** A little ride between stops or stations. It can be skipped once it's under way. */
export function createTravelScene(): Scene {
  let trip: Trip | null = null;
  let leaving = false;
  let tick = 0;

  return {
    enter(game) {
      const { ride } = game;
      if (ride === "hall") trip = createHallTrip(game.run.node, "there");
      else if (ride === "fromHall") trip = createHallTrip(game.run.node, "back");
      else trip = createTrip(game.run.node, ride ?? routesFrom(game.run.node)[0]?.to ?? game.run.node);
      game.ride = null;
      leaving = false;
      tick = 0;
      if (trip) game.audio.play(trip.mode === "train" ? "horn" : "bell");
      game.debug.trip = trip;
      if (!trip) game.go("map");
    },
    update(game) {
      if (!trip || leaving) return;
      tick++;
      trip = stepTrip(trip, game.input.wasPressed("confirm"));
      game.debug.trip = trip;
      if (trip.done) {
        leaving = true;
        game.audio.play(trip.mode === "train" ? "horn" : "bell");
        game.run = { ...game.run, node: trip.to };
        game.go(trip.hall === "there" ? "grading-hall" : trip.hall === "back" ? resumeScene(game.run) : "map");
      }
    },
    render(ctx, game) {
      if (!trip) return;
      const riding = trip;
      const eastbound = riding.east;
      const train = riding.mode === "train";
      drawRide(ctx, { train, eastbound, tick, still: game.reducedMotion, hair: walkingGear(game.run).men ? PALETTE.I : PALETTE.K });
      const fill: Paint = (x, y, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), w, h);
      };

      onGui(ctx, () => {
        // The title, with dots that count along.
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 28);
        const titleWidth = measureText(TRAVELLING) * 2;
        const titleX = (viewW - titleWidth) / 2 - 8;
        drawText(ctx, TRAVELLING, titleX, 3, UI.text, 2);
        drawText(ctx, ".".repeat(1 + (Math.floor(tick / 20) % 3)), titleX + titleWidth + 2, 3, UI.accent, 2);
        drawTextCentered(ctx, riding.hall === "there" ? `${NEXT_STOP} ${GRADING_HALL_NAME}` : riding.hall === "back" ? HEADING_BACK : `${NEXT_STOP} ${NODES[riding.to].name}`, viewW / 2, 18, UI.accent);

        // A little line map along the bottom, with the car creeping along it.
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 16, viewW, 16);
        const from = 36;
        const to = viewW - 36;
        const start = eastbound ? from : to;
        const end = eastbound ? to : from;
        fill(from, viewH - 9, to - from, 2, UI.faint);
        for (const stop of [from, to]) fill(stop - 2, viewH - 11, 5, 6, UI.text);
        const carX = start + (end - start) * tripProgress(riding);
        fill(carX - 5, viewH - 13, 11, 6, train ? TRAIN_GREEN : PALETTE.R);
        fill(carX - 3, viewH - 12, 2, 2, PALETTE.C);
        fill(carX + 2, viewH - 12, 2, 2, PALETTE.C);
      });
    },
  };
}
