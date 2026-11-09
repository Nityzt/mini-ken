import { stageX, stageY, STAGE_H, STAGE_W, viewH, viewW } from "../core/scale.ts";
import type { District } from "../world/map.ts";
import { PALETTE } from "./palette.ts";
import { drawSprite, grid } from "./sprite.ts";

const t = (rows: string[]) => grid(16, 16, rows);

/** A needle tower: a long antenna, a small upper deck, the main deck, and a tapering concrete shaft. */
function towerRows(): string[] {
  const row = (halfWidth: number, fill: string, edge = "w") => {
    const pad = ".".repeat(8 - halfWidth);
    return pad + edge + fill.repeat(Math.max(0, 2 * halfWidth - 2)) + edge + pad;
  };
  const rows: string[] = [];
  for (let i = 0; i < 11; i++) rows.push(row(1, "W", i < 6 ? "w" : "W"));
  rows.push(row(2, "W"), row(2, "W"), row(3, "w", "k"), row(2, "W"));
  for (let i = 0; i < 2; i++) rows.push(row(2, "W"));
  rows.push(row(5, "W", "k"), row(6, "C", "k"), row(6, "C", "k"), row(6, "w", "k"), row(5, "w", "k"));
  while (rows.length < 44) rows.push(row(2, "W"));
  for (let i = 0; i < 3; i++) rows.push(row(3, "W"));
  rows.push(row(4, "W"), row(5, "w"), row(6, "w", "k"));
  return grid(16, 50, rows);
}

export const WORLD_GRIDS: Record<string, string[]> = {
  tower: towerRows(),
  tree: t([
    "................",
    "......gGGg......",
    "....gGGGGGGg....",
    "...gGGGGGGGGg...",
    "..gGGGGGGGGGGg..",
    "..gGGGgGGGGGGg..",
    "...gGGGGGGgGg...",
    "....ggGGGGgg....",
    "......ggg.......",
    ".......bb.......",
    ".......bb.......",
    "......bbbb......",
  ]),
  dojoPine: t([
    "....rrrrrrrr....",
    "...rRRRRRRRRr...",
    "..rRRRRRRRRRRr..",
    ".rrrrrrrrrrrrrr.",
    "...OOOOOOOOOO...",
    "...OwwOOOOwwO...",
    "...OwwObbOwwO...",
    "...OOOObbOOOO...",
    "...DDDDbbDDDD...",
    "...bbbbbbbbbb...",
    "................",
  ]),
  dojoRadish: t([
    "....kkkkkkkk....",
    "...kKKKKKKKKk...",
    "..kKKKKKKKKKKk..",
    ".kkkkkkkkkkkkkk.",
    "...OOOOOOOOOO...",
    "...ORROOOORRO...",
    "...ORRObbORRO...",
    "...OOOObbOOOO...",
    "...DDDDbbDDDD...",
    "...bbbbbbbbbb...",
    "................",
  ]),
  dojoGoose: t([
    ".........WW.....",
    "....iiiiiiWYi...",
    "...iIIIIIIWWIi..",
    "..iIIIIIIIIIIIi.",
    ".iiiiiiiiiiiiii.",
    "...OOOOOOOOOO...",
    "...OCCOOOOCCO...",
    "...OCCObbOCCO...",
    "...OOOObbOOOO...",
    "...bbbbbbbbbb...",
  ]),
  dojoRaccoon: t([
    "....kkkkkkkk....",
    "...kwwkkwwkkk...",
    "..kkkwwkkwwkkk..",
    ".kkkkkkkkkkkkkk.",
    "...OOOOOOOOOO...",
    "...OKKOOOOKKO...",
    "...OKKObbOKKO...",
    "...OOOObbOOOO...",
    "...DDDDbbDDDD...",
    "...bbbbbbbbbb...",
    "................",
  ]),
  dojoHeron: t([
    "..........kk....",
    "..........kk....",
    "....iiiiiiiiii..",
    "...iIIIIIIIIIIi.",
    ".iiiiiiiiiiiiii.",
    "...wwwwwwwwwww..",
    "...wCCwwwwwCCw..",
    "...wCCwKKwwCCw..",
    "...wwwwKKwwwww..",
    "...kkkkkkkkkkk..",
    "................",
  ]),
  dojoOtter: t([
    "....bbbbbbbb....",
    "...bBBBBBBBBb...",
    "..bBBCBBBBCBBb..",
    ".bbbbbbbbbbbbbb.",
    "...OOOOOOOOOO...",
    "...OCCOOOOCCO...",
    "...OCCObbOCCO...",
    "...OOOObbOOOO...",
    "...CCCCbbCCCC...",
    "..CCCCCCCCCCCC..",
    "................",
  ]),
  dojoLantern: t([
    "....rrrrrrrr....", "...rRRRRRRRRr...", "..rRRRRRRRRRRr..", ".rrrrrrrrrrrrrr.",
    "...OOOOOOOOOO...", "...OYYOOOOYYO...", "..rOYYObbOYYOr..", "..ROOOObbOOOOR..", "...DDDDbbDDDD...", "...bbbbbbbbbb...",
  ]),
  dojoBamboo: t([
    "....gggggggg....", "...gGGGGGGGGg...", "..gGGGGGGGGGGg..", ".gggggggggggggg.",
    "...OOOOOOOOOO...", "...OwwOOOOwwO...", "...OwwObbOwwO...", "...OOOObbOOOO...", "...GGGGbbGGGG...", "...bbbbbbbbbb...",
  ]),
  station: t([
    "......KKKK......",
    ".....KWWWWK.....",
    ".....KWKKWK.....",
    ".....KWWWWK.....",
    "..KKKKKKKKKKKK..",
    ".KggggggggggggK.",
    ".KGGGGGGGGGGGGK.",
    "..KWWWWWWWWWWK..",
    "..KWCCWKKWCCWK..",
    "..KWCCWKKWCCWK..",
    "..KWWWWKKWWWWK..",
    "..KKKKKKKKKKKK..",
  ]),
  gang: t([
    "................",
    "...KKK...KKK....",
    "..KSSSK.KSSSK...",
    "..KKSKK.KKSKK...",
    "..KSSSK.KSSSK...",
    "...KKK...KKK....",
    "..KRRRK.KCCCK...",
    "..KRRRK.KCCCK...",
    "..KNNNK.KNNNK...",
    "...K.K...K.K....",
  ]),
  hut: grid(16, 12, [
    "......kkkk......",
    "....kkbbbbkk....",
    "..kkbbDbbDbbkk..",
    ".kbbDbbbbbbDbbk.",
    "kkkkkkkkkkkkkkkk",
    "..BBBBBBBBBBBB..",
    "..BLLBBKKBBLLB..",
    "..BLLBBKKBBLLB..",
    "..BBBBBKKBBBBB..",
    "..bbbbbKKbbbbb..",
  ]),
  person: grid(7, 10, [
    "..KKK..",
    ".KSSSK.",
    ".KSSSK.",
    "..KKK..",
    ".KWWWK.",
    "KWWWWWK",
    ".KWWWK.",
    ".KNNNK.",
    ".KN.NK.",
    "..K.K..",
  ]),
  // A speech bubble with a shout in it.
  padlock: grid(7, 9, [
    "..KKK..",
    ".KwwwK.",
    ".Kw.wK.",
    ".Kw.wK.",
    "KKKKKKK",
    "KYYYYYK",
    "KYYKYYK",
    "KYYYYYK",
    "KKKKKKK",
  ]),
  bubbleAlert: grid(9, 10, [
    ".KKKKKKK.",
    "KWWWRWWWK",
    "KWWWRWWWK",
    "KWWWRWWWK",
    "KWWWWWWWK",
    "KWWWRWWWK",
    ".KKKKKKK.",
    "...KWK...",
    "....K....",
  ]),
  bubbleHeart: grid(9, 10, [
    ".KKKKKKK.",
    "KWRRWRRWK",
    "KWRRRRRWK",
    "KWWRRRWWK",
    "KWWWRWWWK",
    ".KKKKKKK.",
    "...KWK...",
    "....K....",
  ]),
  stop: t([
    "......KKKK......",
    "......KRRK......",
    "......KWWK......",
    "......KRRK......",
    "...KKKKKKKKKK...",
    "..KRRRRRRRRRRK..",
    "..KkCCCCkkCCCK..",
    "..KkCCCCkkCCCK..",
    "..KkCCCCkkCCCK..",
    "..KkkkkkkkkkkK..",
    "..K..........K..",
    "..K..........K..",
  ]),
};

/** What the city's painted in, before dusk falls on it. */
export const MAP_COLORS = {
  land: "#C9C4B3",
  sideStreet: "#AAA79D",
  road: "#7A7873",
  concrete: "#9AA3A8",
  grass: PALETTE.G,
  darkGrass: PALETTE.g,
  water: PALETTE.C,
  sand: "#EFC877",
};
const LAND = MAP_COLORS.land;
const SIDE_STREET = MAP_COLORS.sideStreet;
const ROAD = MAP_COLORS.road;
const CONCRETE = MAP_COLORS.concrete;
const SAND = MAP_COLORS.sand;
const GLASS = "#6F8FA8";
const GLASS_DARK = "#566F85";
const SHORE_Y = 118;
const MAIN_ROAD_Y = 60;
const LAKESHORE_Y = 110;
const RAVINE_X = 168;

/** The walkable line stays bright against the dusk. */
export const PATH_FILL = "#FFE27A";
export const PATH_EDGE = PALETTE.K;

const DUSK = [20, 28, 56];
const DUSK_AMOUNT = 0.52;

/** The same color at dusk. Baked in as a plain color, so the art keeps hard pixels. */
export function shaded(color: string): string {
  const part = (i: number) => {
    const value = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(value + (DUSK[i] - value) * DUSK_AMOUNT).toString(16).padStart(2, "0");
  };
  return `#${part(0)}${part(1)}${part(2)}`.toUpperCase();
}

const DUSK_TREE = { G: shaded("#4C8A50"), g: shaded("#2C5C3E"), b: shaded(PALETTE.b) };

const scatter = (x: number, y: number) => ((Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0) % 100;

type Paint = (x: number, y: number, w: number, h: number, color: string) => void;

/** Everything goes on in dusk colors, except the lights, which stay bright. */
function dusk(c: CanvasRenderingContext2D): { fill: Paint; light: Paint } {
  const light: Paint = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  return { light, fill: (x, y, w, h, color) => light(x, y, w, h, shaded(color)) };
}

/** A lakeside city seen from above: downtown, a green river ravine, and the harbour to the south. */
function paintDowntown(c: CanvasRenderingContext2D): void {
  const { fill, light } = dusk(c);
  fill(0, 0, STAGE_W, STAGE_H, LAND);

  // The street grid, with a house or two on each block.
  for (let y = 12; y < SHORE_Y; y += 16) fill(0, y, STAGE_W, 1, SIDE_STREET);
  for (let x = 8; x < STAGE_W; x += 20) fill(x, 11, 1, SHORE_Y - 11, SIDE_STREET);
  const roofs = [PALETTE.r, "#8C6A52", "#6E7A80", PALETTE.b];
  for (let by = 12; by < SHORE_Y - 8; by += 16) {
    for (let bx = 8; bx < STAGE_W; bx += 20) {
      for (let i = 0; i < 2; i++) {
        const hx = bx + 3 + i * 9;
        const roof = roofs[scatter(hx, by) % roofs.length];
        if (scatter(hx, by + 3) > 70) continue;
        fill(hx, by + 3, 7, 3, roof);
        fill(hx, by + 6, 7, 3, PALETTE.O);
        fill(hx + 3, by + 7, 1, 2, PALETTE.b);
      }
    }
  }

  // A big park in the northwest, and a green strip along the waterfront.
  for (let y = 12; y < 44; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 256 - (y - 28) * (y - 28))) * 1.8);
    fill(30 - half, y, half * 2, 1, PALETTE.G);
  }

  // The ravine: a wide green valley, with the river winding down to the lake.
  for (let y = 11; y < SHORE_Y; y++) {
    const wander = Math.round(Math.sin(y / 11) * 4);
    fill(RAVINE_X - 19 + wander, y, 38, 1, PALETTE.G);
    for (let x = RAVINE_X - 19 + wander; x < RAVINE_X + 19 + wander; x++) {
      if ((x + y) % 2 === 0 && scatter(x >> 2, y >> 2) > 55) fill(x, y, 1, 1, PALETTE.g);
    }
    fill(RAVINE_X - 4 + wander, y, 8, 1, PALETTE.C);
  }

  // Main roads.
  fill(0, MAIN_ROAD_Y - 4, STAGE_W, 8, ROAD);
  fill(0, LAKESHORE_Y - 3, STAGE_W, 6, ROAD);
  fill(88, 11, 8, SHORE_Y - 11, ROAD);
  for (let x = 2; x < STAGE_W; x += 10) fill(x, MAIN_ROAD_Y, 5, 1, PALETTE.Y);
  // The streetcar's rails, and streetlights along the main road.
  fill(0, LAKESHORE_Y - 1, STAGE_W, 1, PALETTE.w);
  fill(0, LAKESHORE_Y + 1, STAGE_W, 1, PALETTE.w);
  for (let x = 6; x < STAGE_W; x += 20) light(x, MAIN_ROAD_Y - 6, 1, 1, PALETTE.Y);

  // The viaduct carries the main road over the ravine on tall arches.
  fill(RAVINE_X - 24, MAIN_ROAD_Y - 6, 48, 12, CONCRETE);
  fill(RAVINE_X - 24, MAIN_ROAD_Y - 4, 48, 8, ROAD);
  for (let x = RAVINE_X - 24; x < RAVINE_X + 24; x += 2) fill(x, MAIN_ROAD_Y - 6, 1, 2, PALETTE.w);
  for (let x = RAVINE_X - 22; x < RAVINE_X + 22; x += 11) {
    fill(x, MAIN_ROAD_Y + 6, 9, 6, CONCRETE);
    fill(x + 2, MAIN_ROAD_Y + 8, 5, 4, PALETTE.g);
  }

  // Downtown: glass towers, drawn back to front so the near ones overlap.
  const towerAt = (x: number, ground: number, w: number, h: number, glass: string) => {
    fill(x, ground - h, w, h, glass);
    fill(x + w - 2, ground - h, 2, h, GLASS_DARK);
    fill(x, ground - h, w, 1, PALETTE.W);
    for (let wy = ground - h + 2; wy < ground - 1; wy += 3) {
      for (let wx = x + 1; wx < x + w - 2; wx += 2) {
        if (scatter(wx, wy) > 60) light(wx, wy, 1, 1, PALETTE.Y);
        else fill(wx, wy, 1, 1, PALETTE.C);
      }
    }
    fill(x, ground, w, 1, PALETTE.K);
  };
  for (const [x, ground, w, h, tint] of [
    [99, 90, 9, 22, GLASS], [120, 88, 10, 20, GLASS_DARK], [134, 90, 8, 18, GLASS],
    [62, 104, 8, 16, GLASS_DARK], [72, 106, 9, 26, GLASS], [99, 104, 8, 12, GLASS_DARK],
    [121, 104, 7, 14, GLASS], [130, 102, 9, 10, GLASS_DARK],
  ] as const) towerAt(x, ground, w, h, tint);

  // A twin-towered city hall, curved around its low domed chamber.
  fill(45, 74, 6, 18, CONCRETE);
  fill(55, 78, 6, 14, CONCRETE);
  fill(51, 74, 1, 18, GLASS_DARK);
  fill(54, 78, 1, 14, GLASS_DARK);
  fill(48, 88, 10, 4, PALETTE.W);
  fill(50, 86, 6, 2, PALETTE.W);
  fill(40, 92, 26, 2, CONCRETE);

  // The stadium's big white dome, near the water.
  for (let y = 0; y < 12; y++) {
    const half = Math.round(Math.sqrt(144 - y * y) * 1.1);
    fill(138 - half, 108 - y, half * 2, 1, y % 3 === 2 ? PALETTE.w : PALETTE.W);
  }
  fill(124, 108, 28, 1, PALETTE.k);

  // The shore, the lake and the islands.
  fill(0, SHORE_Y - 2, STAGE_W, 2, CONCRETE);
  fill(0, SHORE_Y, STAGE_W, STAGE_H - SHORE_Y, PALETTE.C);
  for (let x = 4; x < STAGE_W; x += 23) fill(x, 121 + (x % 3) * 3, 5, 1, PALETTE.W);
  for (let y = 124; y < 133; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 25 - (y - 128) * (y - 128))) * 9);
    fill(66 - half, y, half * 2, 1, y < 125 || y > 131 ? PALETTE.L : PALETTE.G);
  }
  fill(58, 125, 12, 5, PALETTE.C);
  for (const [x, y] of [[38, 126], [50, 128], [80, 127]]) {
    fill(x, y, 4, 3, PALETTE.g);
  }

  // Harbour piers, and a ferry heading out to the islands.
  for (const x of [156, 170, 184]) {
    fill(x, SHORE_Y, 8, 9, PALETTE.b);
    for (let y = SHORE_Y + 1; y < SHORE_Y + 9; y += 2) fill(x, y, 8, 1, PALETTE.D);
  }
  fill(112, 123, 12, 3, PALETTE.W);
  fill(114, 121, 7, 2, PALETTE.w);
  fill(116, 119, 2, 2, PALETTE.R);

  // Market stalls on the street north of the crossing.
  for (const [x, y, roof] of [[60, 18, PALETTE.R], [102, 16, PALETTE.Y], [68, 40, PALETTE.C], [104, 38, PALETTE.G]] as const) {
    fill(x, y, 16, 3, roof);
    fill(x + 2, y + 3, 12, 6, PALETTE.O);
    fill(x + 6, y + 5, 4, 4, PALETTE.b);
  }
  for (const [x, y] of [[6, 16], [28, 14], [44, 24], [14, 30], [150, 14], [178, 18], [148, 70], [180, 70], [150, 92], [180, 90]]) {
    drawSprite(c, WORLD_GRIDS.tree, x, y, { colors: DUSK_TREE });
  }
}

/** A quiet neighbourhood by the beach: a streetcar line, little houses, sand, a boardwalk and the lake. */
function paintBeach(c: CanvasRenderingContext2D): void {
  const { fill, light } = dusk(c);
  const shoreY = 118;
  fill(0, 0, STAGE_W, STAGE_H, LAND);

  // Rows of little houses north of the streetcar line, and a park to the south.
  const roofs = [PALETTE.r, "#8C6A52", "#6E7A80", PALETTE.b];
  for (let by = 14; by < 42; by += 14) {
    for (let bx = 4; bx < STAGE_W; bx += 15) {
      if (scatter(bx, by) > 78) continue;
      fill(bx, by, 11, 4, roofs[scatter(bx, by + 1) % roofs.length]);
      fill(bx, by + 4, 11, 5, PALETTE.O);
      fill(bx + 5, by + 6, 2, 3, PALETTE.b);
      if (scatter(bx, by + 2) > 40) light(bx + 2, by + 5, 2, 2, PALETTE.Y);
    }
  }
  fill(0, 66, STAGE_W, 26, PALETTE.G);
  for (let y = 66; y < 92; y++) {
    for (let x = y % 2; x < STAGE_W; x += 2) if (scatter(x >> 2, y >> 2) > 62) fill(x, y, 1, 1, PALETTE.g);
  }

  // The streetcar's road and rails, the street you walk, and its streetlights.
  fill(0, STREETCAR_Y.beach! - 4, STAGE_W, 8, ROAD);
  fill(0, STREETCAR_Y.beach! - 1, STAGE_W, 1, PALETTE.w);
  fill(0, STREETCAR_Y.beach! + 1, STAGE_W, 1, PALETTE.w);
  fill(0, 56, STAGE_W, 9, SIDE_STREET);
  for (let x = 8; x < STAGE_W; x += 24) light(x, 55, 1, 1, PALETTE.Y);

  // The sand, its umbrellas, and the boardwalk running along it.
  fill(0, 92, STAGE_W, shoreY - 92, SAND);
  fill(0, 99, STAGE_W, 7, PALETTE.B);
  for (let x = 0; x < STAGE_W; x += 4) fill(x, 99, 1, 7, PALETTE.b);
  for (const [x, top] of [[18, PALETTE.R], [62, PALETTE.Y], [168, PALETTE.R], [226, PALETTE.C]] as const) {
    fill(x, 108, 9, 2, top);
    fill(x + 4, 110, 1, 5, PALETTE.b);
  }

  // A lifeguard's chair, a pond for the goose, and the lake.
  fill(84, 108, 5, 1, PALETTE.W);
  fill(85, 109, 1, 6, PALETTE.W);
  fill(87, 109, 1, 6, PALETTE.W);
  for (let y = 0; y < 9; y++) {
    const half = Math.round(Math.sqrt(16 - (y / 2 - 2) * (y / 2 - 2)) * 3.6);
    fill(212 - half, 72 + y, half * 2, 1, PALETTE.C);
  }
  light(214, 74, 3, 2, PALETTE.W);
  light(216, 72, 1, 2, PALETTE.W);
  light(217, 72, 1, 1, PALETTE.Y);
  fill(0, shoreY, STAGE_W, STAGE_H - shoreY, PALETTE.C);
  for (let x = 6; x < STAGE_W; x += 19) fill(x, 121 + (x % 3) * 3, 5, 1, PALETTE.W);

  for (const [x, y] of [[10, 68], [64, 74], [150, 70], [176, 76], [238, 70]]) {
    drawSprite(c, WORLD_GRIDS.tree, x, y, { colors: DUSK_TREE });
  }
}

const CHERRY = { G: "#D98CB0", g: "#A8638A", b: shaded(PALETTE.b) };

/** A big park: a pond, cherry trees in bloom, and picnic blankets on the grass. */
function paintPark(c: CanvasRenderingContext2D): void {
  const { fill, light } = dusk(c);
  fill(0, 0, STAGE_W, STAGE_H, PALETTE.G);
  for (let y = 11; y < STAGE_H; y++) {
    for (let x = y % 2; x < STAGE_W; x += 2) if (scatter(x >> 2, y >> 2) > 62) fill(x, y, 1, 1, PALETTE.g);
  }
  // Houses along the top, then the streetcar line, then the walk.
  const roofs = [PALETTE.r, "#8C6A52", "#6E7A80"];
  for (let bx = 4; bx < STAGE_W; bx += 15) {
    if (scatter(bx, 20) > 72) continue;
    fill(bx, 20, 11, 4, roofs[scatter(bx, 21) % roofs.length]);
    fill(bx, 24, 11, 5, PALETTE.O);
    if (scatter(bx, 22) > 40) light(bx + 2, 25, 2, 2, PALETTE.Y);
  }
  fill(0, STREETCAR_Y.park! - 4, STAGE_W, 8, ROAD);
  fill(0, STREETCAR_Y.park! - 1, STAGE_W, 1, PALETTE.w);
  fill(0, STREETCAR_Y.park! + 1, STAGE_W, 1, PALETTE.w);
  fill(0, 56, STAGE_W, 9, SAND);
  for (let x = 8; x < STAGE_W; x += 24) light(x, 55, 1, 1, PALETTE.Y);
  // The pond, with a little bridge.
  for (let y = 0; y < 26; y++) {
    const half = Math.round(Math.sqrt(169 - (y - 13) * (y - 13)) * 3);
    fill(44 - half, 92 + y, half * 2, 1, PALETTE.C);
  }
  // A little red bridge, arched over the water.
  fill(30, 104, 28, 2, PALETTE.R);
  fill(34, 102, 20, 2, PALETTE.R);
  fill(38, 100, 12, 2, PALETTE.R);
  for (const x of [30, 38, 49, 57]) fill(x, 104, 1, 4, PALETTE.r);
  // Picnic blankets, in checks.
  for (const [x, y, color] of [[92, 116, PALETTE.R], [140, 118, PALETTE.C], [168, 96, PALETTE.Y]] as const) {
    for (let cy = 0; cy < 6; cy++) for (let cx = 0; cx < 12; cx++) fill(x + cx, y + cy, 1, 1, (cx >> 1) % 2 === (cy >> 1) % 2 ? color : PALETTE.W);
  }
  for (const [x, y] of [[78, 68], [150, 68], [186, 92], [226, 96], [84, 100], [150, 100], [6, 68], [212, 118], [70, 122]]) {
    drawSprite(c, WORLD_GRIDS.tree, x, y, { colors: CHERRY });
  }
}

/** A working harbour: smokestacks, furnaces glowing through the dusk, a rail line and a grey bay. */
function paintSteel(c: CanvasRenderingContext2D): void {
  const { fill, light } = dusk(c);
  fill(0, 0, STAGE_W, STAGE_H, "#8E8C88");
  // The mills along the top, each with its stacks and smoke.
  for (let i = 0; i < 6; i++) {
    const x = 6 + i * 42;
    fill(x, 26, 34, 20, i % 2 ? "#6E5A52" : "#7C6A5E");
    fill(x, 24, 34, 2, PALETTE.K);
    for (let wx = x + 3; wx < x + 30; wx += 7) light(wx, 34, 4, 4, scatter(wx, 34) > 35 ? "#F09A3C" : shaded(PALETTE.k));
    for (const sx of [x + 6, x + 22]) {
      fill(sx, 13, 4, 11, "#55525A");
      fill(sx, 13, 4, 1, PALETTE.R);
      for (let puff = 0; puff < 3; puff++) fill(sx - puff, 12 - puff, 4 + puff, 1, "#B9B4AE");
    }
  }
  // The rail line.
  fill(0, TRAIN_Y.steel! - 3, STAGE_W, 6, ROAD);
  for (let x = 0; x < STAGE_W; x += 4) fill(x, TRAIN_Y.steel! - 2, 1, 4, PALETTE.b);
  fill(0, TRAIN_Y.steel! - 1, STAGE_W, 1, PALETTE.w);
  fill(0, TRAIN_Y.steel! + 1, STAGE_W, 1, PALETTE.w);
  // The street you walk, and the yard below it.
  fill(0, 71, STAGE_W, 10, ROAD);
  for (let x = 4; x < STAGE_W; x += 12) fill(x, 76, 6, 1, PALETTE.Y);
  for (let x = 8; x < STAGE_W; x += 24) light(x, 70, 1, 1, PALETTE.Y);
  // Stacks of steel, and a gantry crane.
  for (const [x, y] of [[20, 90], [60, 96], [150, 92], [190, 100], [226, 90]]) {
    for (let row = 0; row < 3; row++) fill(x + row * 2, y + row * 3, 18 - row * 4, 2, row % 2 ? "#6E7A80" : "#566F85");
  }
  fill(84, 84, 2, 26, PALETTE.Y);
  fill(148, 84, 2, 26, PALETTE.Y);
  fill(84, 84, 66, 3, PALETTE.Y);
  fill(137, 87, 1, 10, PALETTE.K);
  fill(134, 97, 7, 4, "#566F85");
  // The foundry's glowing doors, and the bay.
  fill(96, 120, 40, 4, "#55525A");
  fill(0, 124, STAGE_W, STAGE_H - 124, "#6F8FA8");
  for (let x = 6; x < STAGE_W; x += 17) fill(x, 128 + (x % 3) * 3, 6, 1, PALETTE.w);
}

/** A great waterfall, the gorge below it, and a little tourist strip with a big wheel. */
function paintFalls(c: CanvasRenderingContext2D): void {
  const { fill, light } = dusk(c);
  fill(0, 0, STAGE_W, STAGE_H, PALETTE.G);
  for (let y = 82; y < STAGE_H; y++) {
    for (let x = y % 2; x < STAGE_W; x += 2) if (scatter(x >> 2, y >> 2) > 66) fill(x, y, 1, 1, PALETTE.g);
  }
  // The river above, pouring over the lip in a long curve.
  fill(0, 11, STAGE_W, 28, PALETTE.C);
  for (let x = 4; x < STAGE_W; x += 13) fill(x, 15 + (x % 4) * 4, 7, 1, PALETTE.W);
  for (let x = 0; x < STAGE_W; x++) {
    const lip = 33 + Math.round(Math.sin((x - 40) / 40) * 4);
    // The falls stay bright through the dusk: they're the whole reason anyone comes here.
    light(x, lip, 1, 58 - lip, x % 3 === 0 ? "#EAF4FA" : x % 3 === 1 ? "#BAD6E8" : "#D6E8F2");
    light(x, lip - 1, 1, 1, PALETTE.W);
  }
  // The gorge, thick with mist.
  fill(0, 58, STAGE_W, 24, "#5F8FAF");
  for (let i = 0; i < 40; i++) {
    const x = scatter(i, 1) * 2.56;
    const y = 54 + scatter(i, 2) % 16;
    fill(Math.round(x), y, 6 + scatter(i, 3) % 8, 2, PALETTE.W);
  }
  fill(0, 80, STAGE_W, 3, "#8C8780");
  // A viewing platform out over the water, for everyone to stand on and gawp.
  fill(68, 50, 84, 32, "#8C8780");
  fill(68, 50, 84, 2, PALETTE.K);
  for (let x = 70; x < 152; x += 6) fill(x, 47, 1, 4, PALETTE.K);
  fill(68, 47, 84, 1, PALETTE.K);
  // The street you walk, and the rail line below it.
  fill(0, 100, STAGE_W, 9, SIDE_STREET);
  for (let x = 8; x < STAGE_W; x += 24) light(x, 99, 1, 1, PALETTE.Y);
  fill(0, TRAIN_Y.falls! - 3, STAGE_W, 6, ROAD);
  for (let x = 0; x < STAGE_W; x += 4) fill(x, TRAIN_Y.falls! - 2, 1, 4, PALETTE.b);
  fill(0, TRAIN_Y.falls! - 1, STAGE_W, 1, PALETTE.w);
  fill(0, TRAIN_Y.falls! + 1, STAGE_W, 1, PALETTE.w);
  // A big wheel with its lights on, and a hotel or two.
  const wheelX = 150;
  const wheelY = 90;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    light(Math.round(wheelX + Math.cos(a) * 8), Math.round(wheelY + Math.sin(a) * 8), 2, 2, i % 2 ? PALETTE.R : PALETTE.Y);
  }
  fill(wheelX, wheelY, 1, 10, PALETTE.w);
  for (const [x, h] of [[60, 14], [72, 10], [226, 15], [240, 11]]) {
    fill(x, 99 - h, 10, h, GLASS);
    for (let wy = 99 - h + 2; wy < 97; wy += 3) light(x + 2, wy, 2, 1, PALETTE.Y);
  }
  for (const [x, y] of [[8, 84], [28, 84], [176, 84], [10, 118], [90, 118], [200, 120]]) drawSprite(c, WORLD_GRIDS.tree, x, y, { colors: DUSK_TREE });
}

/** The tournament's home: a huge hall, flags flying, crowds on the plaza. */
function paintArena(c: CanvasRenderingContext2D): void {
  const { fill, light } = dusk(c);
  fill(0, 0, STAGE_W, STAGE_H, "#A8A49A");
  for (let y = 12; y < 100; y += 8) fill(0, y, STAGE_W, 1, "#8E8A82");
  for (let x = 6; x < STAGE_W; x += 16) fill(x, 96, 1, 16, "#8E8A82");
  // The hall.
  const cx = 160;
  for (let y = 0; y < 34; y++) {
    const half = Math.round(Math.sqrt(1156 - y * y) * 2);
    fill(cx - half, 76 - y, half * 2, 1, y % 5 === 4 ? "#7A5A62" : "#8E6F76");
  }
  fill(cx - 66, 76, 132, 20, PALETTE.O);
  for (let x = cx - 62; x < cx + 60; x += 12) {
    fill(x, 80, 8, 12, PALETTE.b);
    light(x + 1, 81, 6, 5, PALETTE.Y);
  }
  fill(cx - 12, 82, 24, 14, PALETTE.K);
  light(cx - 10, 84, 20, 12, "#F0B060");
  // Flags along the roofline, one for each dojo.
  ([[-58, PALETTE.R], [-34, PALETTE.Y], [-12, PALETTE.C], [12, PALETTE.G], [34, "#C08CF0"], [58, PALETTE.W]] as const).forEach(([dx, color]) => {
    const top = 42 + Math.abs(dx) / 3;
    fill(cx + dx, top, 1, 12, PALETTE.K);
    light(cx + dx + 1, top, 8, 4, color);
  });
  // Crowds on the plaza, all heading in.
  for (let i = 0; i < 70; i++) {
    const x = scatter(i, 4) * 2.5;
    const y = 98 + scatter(i, 5) % 14;
    fill(Math.round(x), y, 2, 2, [PALETTE.R, PALETTE.I, PALETTE.Y, PALETTE.W, PALETTE.G][scatter(i, 6) % 5]);
    fill(Math.round(x), y - 1, 2, 1, PALETTE.S);
  }
  // The street you walk, and the rail line.
  fill(0, 100, STAGE_W, 9, ROAD);
  for (let x = 8; x < STAGE_W; x += 24) light(x, 99, 1, 1, PALETTE.Y);
  fill(0, TRAIN_Y.arena! - 3, STAGE_W, 6, ROAD);
  for (let x = 0; x < STAGE_W; x += 4) fill(x, TRAIN_Y.arena! - 2, 1, 4, PALETTE.b);
  fill(0, TRAIN_Y.arena! - 1, STAGE_W, 1, PALETTE.w);
  fill(0, TRAIN_Y.arena! + 1, STAGE_W, 1, PALETTE.w);
}

const PAINTERS: Record<District, (c: CanvasRenderingContext2D) => void> = {
  downtown: paintDowntown,
  beach: paintBeach,
  park: paintPark,
  steel: paintSteel,
  falls: paintFalls,
  arena: paintArena,
};
const backdrops = new Map<District, HTMLCanvasElement>();

const BEYOND_DIM = 0.4;

export function worldBackdrop(district: District): HTMLCanvasElement {
  let canvas = backdrops.get(district);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = STAGE_W;
    canvas.height = STAGE_H;
    PAINTERS[district](canvas.getContext("2d")!);
    backdrops.set(district, canvas);
  }
  return canvas;
}

/**
 * The district, with the city carrying on around it for however much the window shows. Past the stage
 * it's reflected, so roads and water line up at the seams, and dimmed, because nothing out there is a place to go.
 */
export function drawWorldBackdrop(ctx: CanvasRenderingContext2D, district: District): void {
  const art = worldBackdrop(district);
  const left = stageX();
  const top = stageY();
  for (let row = -Math.ceil(top / STAGE_H); top + row * STAGE_H < viewH; row++) {
    for (let col = -Math.ceil(left / STAGE_W); left + col * STAGE_W < viewW; col++) {
      ctx.save();
      ctx.translate(left + col * STAGE_W + (col % 2 ? STAGE_W : 0), top + row * STAGE_H + (row % 2 ? STAGE_H : 0));
      ctx.scale(col % 2 ? -1 : 1, row % 2 ? -1 : 1);
      ctx.drawImage(art, 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = BEYOND_DIM;
  ctx.fillStyle = PALETTE.K;
  ctx.fillRect(0, 0, viewW, top);
  ctx.fillRect(0, top + STAGE_H, viewW, viewH - top - STAGE_H);
  ctx.fillRect(0, top, left, STAGE_H);
  ctx.fillRect(left + STAGE_W, top, viewW - left - STAGE_W, STAGE_H);
  ctx.globalAlpha = 1;
}

/** Where the streetcar line runs on each district that has one. */
export const STREETCAR_Y: Partial<Record<District, number>> = { downtown: LAKESHORE_Y, beach: 48, park: 48 };
/** Where the rail line runs on each district the train serves. */
export const TRAIN_Y: Partial<Record<District, number>> = { steel: 62, falls: 120, arena: 120 };

/** A green and white commuter train, passing through. */
export function drawMiniTrain(ctx: CanvasRenderingContext2D, x: number, lineY: number): void {
  const px = Math.round(x);
  const y = lineY - 7;
  for (let car = 0; car < 3; car++) {
    const left = px + car * 21;
    ctx.fillStyle = PALETTE.W;
    ctx.fillRect(left, y, 20, 7);
    ctx.fillStyle = "#2E8B57";
    ctx.fillRect(left, y + 4, 20, 3);
    ctx.fillStyle = PALETTE.C;
    for (let wx = left + 2; wx < left + 18; wx += 4) ctx.fillRect(wx, y + 1, 2, 2);
    ctx.fillStyle = PALETTE.K;
    ctx.fillRect(left + 3, y + 7, 3, 1);
    ctx.fillRect(left + 14, y + 7, 3, 1);
  }
}

/** A red streetcar, trundling along its line. */
export function drawStreetcar(ctx: CanvasRenderingContext2D, x: number, lineY: number): void {
  const px = Math.round(x);
  const y = lineY - 5;
  ctx.fillStyle = PALETTE.R;
  ctx.fillRect(px, y, 18, 6);
  ctx.fillStyle = PALETTE.W;
  ctx.fillRect(px, y + 3, 18, 1);
  ctx.fillStyle = PALETTE.C;
  for (let wx = px + 2; wx < px + 16; wx += 4) ctx.fillRect(wx, y + 1, 2, 2);
  ctx.fillStyle = PALETTE.K;
  ctx.fillRect(px + 3, y + 6, 3, 1);
  ctx.fillRect(px + 12, y + 6, 3, 1);
  ctx.fillRect(px + 8, y - 2, 1, 2);
}

/** The street behind a gang fight, scrolling at two speeds. */
export type StreetPlace = "market" | "bridge" | "wharf" | "boardwalk" | "picnic" | "foundry" | "gorge";
export function drawStreet(ctx: CanvasRenderingContext2D, camX: number, place: StreetPlace, ground: number): void {
  const fill = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), y, w, h);
  };
  const SKIES: Record<StreetPlace, string> = { wharf: "#F2B880", boardwalk: "#F2B880", bridge: "#B5D5E6", market: PALETTE.C, picnic: "#F5D2DC", foundry: "#D98A5C", gorge: "#BFD8E0" };
  const sky = SKIES[place];
  // However tall the window, the sky carries on up and the ground carries on down.
  const bottom = viewH - stageY();
  fill(0, -stageY(), viewW, ground + stageY(), sky);
  const repeat = (speed: number, spacing: number, draw: (x: number, index: number) => void) => {
    const offset = camX * speed;
    const first = Math.floor(offset / spacing) - 1;
    for (let i = first; i * spacing - offset < viewW + spacing; i++) draw(i * spacing - offset, i);
  };
  // The city's skyline and its tower stand behind every fight at home. Other cities have their own.
  if (place !== "foundry" && place !== "gorge") {
    const skyline = place === "wharf" || place === "boardwalk" ? "#A98C7C" : place === "picnic" ? "#C9B4C2" : "#8FA3B3";
    const towerX = 170 - camX * 0.08;
    fill(towerX + 7, ground - 112, 2, 40, skyline);
    fill(towerX + 4, ground - 78, 8, 3, skyline);
    fill(towerX + 2, ground - 75, 12, 5, skyline);
    fill(towerX + 6, ground - 70, 4, 70, skyline);
    repeat(0.1, 26, (x, i) => fill(x, ground - 34 - ((i * 7 + 21) % 5) * 7, 22, 70, skyline));
  }
  if (place === "picnic") {
    // Rolling grass, and cherry trees in bloom.
    fill(0, ground - 30, viewW, 30, PALETTE.G);
    repeat(0.7, 60, (x, i) => {
      fill(x + 14, ground - 38, 4, 30, PALETTE.b);
      fill(x, ground - 62, 32, 26, "#E9A6C4");
      fill(x + 4, ground - 68, 24, 6, "#E9A6C4");
      fill(x + 6, ground - 44, 20, 6, "#C77D9F");
      if (i % 3 === 0) fill(x + 36, ground - 8, 14, 6, PALETTE.R);
    });
  } else if (place === "foundry") {
    // The mill wall, its stacks, and the furnace glow.
    repeat(0.1, 44, (x) => {
      fill(x + 6, ground - 110, 8, 70, "#6B5A52");
      fill(x + 6, ground - 110, 8, 3, PALETTE.R);
    });
    fill(0, ground - 60, viewW, 60, "#6E5A52");
    repeat(0.7, 70, (x, i) => {
      fill(x, ground - 52, 44, 36, i % 3 === 0 ? "#F09A3C" : "#4A3F3A");
      fill(x, ground - 52, 44, 2, PALETTE.K);
      fill(x + 21, ground - 52, 2, 36, PALETTE.K);
    });
  } else if (place === "gorge") {
    // The falls, thundering down behind a railing.
    fill(0, ground - 96, viewW, 80, PALETTE.W);
    repeat(0.15, 6, (x, i) => fill(x, ground - 96, 3, 80, i % 2 ? PALETTE.C : "#D6E6F0"));
    fill(0, ground - 28, viewW, 12, "#E8F2F6");
    fill(0, ground - 16, viewW, 16, "#8C8780");
    repeat(0.9, 18, (x) => fill(x, ground - 24, 2, 8, PALETTE.K));
    fill(0, ground - 25, viewW, 2, PALETTE.K);
  } else if (place === "market") {
    repeat(0.7, 88, (x, i) => {
      const colors = [PALETTE.R, PALETTE.Y, PALETTE.g, PALETTE.I];
      fill(x, ground - 52, 76, 44, PALETTE.O);
      fill(x - 4, ground - 58, 84, 7, colors[((i % 4) + 4) % 4]);
      fill(x + 8, ground - 42, 18, 22, PALETTE.C);
      fill(x + 16, ground - 42, 2, 22, PALETTE.b);
      fill(x + 44, ground - 36, 20, 28, PALETTE.b);
      fill(x, ground - 8, 76, 8, PALETTE.w);
    });
  } else if (place === "boardwalk") {
    // The lake, the sand, and striped umbrellas going by.
    fill(0, ground - 34, viewW, 16, "#6FA6C4");
    fill(0, ground - 18, viewW, 18, SAND);
    repeat(0.7, 70, (x, i) => {
      fill(x + 8, ground - 34, 2, 28, PALETTE.b);
      fill(x, ground - 40, 18, 5, i % 2 === 0 ? PALETTE.R : PALETTE.Y);
      fill(x + 3, ground - 43, 12, 3, i % 2 === 0 ? PALETTE.R : PALETTE.Y);
    });
  } else {
    fill(0, ground - 34, viewW, 34, place === "wharf" ? "#6FA6C4" : PALETTE.C);
    repeat(0.9, 28, (x) => {
      fill(x, ground - 22, 3, 22, PALETTE.b);
    });
    fill(0, ground - 24, viewW, 3, PALETTE.b);
  }
  // The ground, with its stones or boards.
  const GROUNDS: Record<StreetPlace, [string, string, string]> = {
    market: ["#A49C8E", "#7F786C", "#8E8679"],
    bridge: [PALETTE.B, PALETTE.b, PALETTE.D],
    wharf: [PALETTE.B, PALETTE.b, PALETTE.D],
    boardwalk: [PALETTE.B, PALETTE.b, PALETTE.D],
    picnic: ["#7FAE62", "#5F8E4A", "#6F9E56"],
    foundry: ["#55525A", "#3A3A42", "#6B6870"],
    gorge: ["#A49C8E", "#7F786C", "#8E8679"],
  };
  const [surface, seam, fleck] = GROUNDS[place];
  fill(0, ground, viewW, bottom - ground, surface);
  repeat(1, 24, (x, i) => {
    fill(x, ground, 1, bottom - ground, seam);
    fill(x + ((i * 11) % 19), ground + 6, 8, 1, fleck);
  });
  fill(0, ground, viewW, 1, PALETTE.K);
}
