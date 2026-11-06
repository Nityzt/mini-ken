import { stageX, stageY, STAGE_H, STAGE_W, viewH, viewW } from "../core/scale.ts";
import { lookOf, type DojoLook } from "./looks.ts";
import { PALETTE } from "./palette.ts";
import { drawSprite, grid } from "./sprite.ts";
import { TILE_GRIDS } from "./tiles.ts";

/** Every place a match can happen, each with a mark of its own. */
export type Crest = "pinecone" | "radish" | "goose" | "raccoon" | "heron" | "otter" | "arena" | "hall" | "hut";

export const FLOOR_Y = 92;

const CREST_GRIDS: Record<Crest, string[]> = {
  pinecone: grid(14, 16, [
    "......gg",
    ".....gGGg",
    "....bBBBBb",
    "...bBDBBDBb",
    "..bDBBDDBBDb",
    "..bBBDBBDBBb",
    "..bBDBBDBBDb",
    "..bDBBDDBBDb",
    "...bBDBBDBb",
    "...bDBBDDBb",
    "....bBDBBb",
    ".....bBBb",
    "......bb",
  ]),
  radish: grid(14, 16, [
    "...gG..Gg",
    "...gGGGGg",
    "....gGGg",
    ".....GG",
    "...WWWWWW",
    "..WWWWWWWW",
    "..WWWwWWWW",
    "..WWWWWWwW",
    "...WWWWWw",
    "...WWwWWw",
    "....WWWw",
    ".....WW",
    ".....Ww",
    "......w",
  ]),
  goose: grid(14, 16, [
    "...kkk",
    "..kkkkYY",
    "..kKkkYYy",
    "..kkk",
    "...kk",
    "...kW",
    "...kW",
    "...WW",
    "..wWWWWW",
    ".wWWWWWWWW",
    ".wwWWWWWWWw",
    "..wwwWWWWw",
    "...wwwwww",
    "....Y..Y",
    "...YY.YY",
  ]),
  raccoon: grid(14, 16, [
    "...k......k",
    "..kKk....kKk",
    "..kkkkkkkkkk",
    ".kkkWWWWWWkkk",
    "kkKKKWWWWKKKkk",
    "kKKWKWWWWKWKKk",
    "kkKKKWWWWKKKkk",
    ".kkWWWWWWWWkk",
    "..kkWWKKWWkk",
    "...kkWWWWkk",
    "....kkkkkk",
    ".....kkkk",
  ]),
  heron: grid(14, 16, [
    "...iiK",
    "..iWWiYYYYY",
    "..iWKiYY",
    "...iWi",
    "...iWi",
    "....iWi",
    "....iWi",
    "...iiWWii",
    "..iIIWWWWi",
    ".iIIIIWWWWi",
    "..iIIIIWWi",
    "....iiiii",
    ".....Y.Y",
    ".....Y.Y",
    ".....Y.Y",
    "....YY.YY",
  ]),
  otter: grid(14, 16, [
    "...bb....bb",
    "..bBBbbbbBBb",
    ".bBBBBBBBBBBb",
    ".bBKKBBBBKKBb",
    ".bBBBBBBBBBBb",
    ".bBBLLKKLLBBb",
    ".bBBLLLLLLBBb",
    "..bBBLLLLBBb",
    "...bBBBBBBb",
    "..bBBBBBBBBb",
    ".bBLBBBBBBLBb",
    ".bBLBBBBBBLBb",
    "..bbBBBBBBbb",
    "..C.bbbbbb.C",
    ".CC........CC",
  ]),
  // The grading hall's mark: a rank certificate, with its seal.
  hall: grid(14, 16, [
    "..bbbbbbbbbb",
    "...KKKKKKKK",
    "...K......K",
    "...K.KKKK.K",
    "...K......K",
    "...K.KKK..K",
    "...K......K",
    "...K.KKKK.K",
    "...K......K",
    "...K....RRK",
    "...K....RRK",
    "...KKKKKKKK",
    "..bbbbbbbbbb",
  ]),
  // Old Gen's mark, if a hermit had one: a bent old pine.
  hut: grid(14, 16, [
    "......gg",
    "....gggggg",
    "...gggGgggg",
    "..gggggGgg",
    "......bb",
    ".....bb",
    "....bb",
    "....bb",
    ".....bb",
    "......bb",
    ".....bbbb",
  ]),
  arena: grid(14, 16, [
    "Y............Y",
    ".Y..........Y",
    "..Y........Y",
    "...Y......Y",
    "....Y....Y",
    ".....Y..Y",
    "......YY",
    "......YY",
    ".....Y..Y",
    "....Y....Y",
    "...y......y",
    "..y........y",
    ".KK........KK",
    "KKK........KKK",
  ]),
};

export const BACKDROP_GRIDS: Record<string, string[]> = {
  crestPinecone: CREST_GRIDS.pinecone,
  crestRadish: CREST_GRIDS.radish,
  crestGoose: CREST_GRIDS.goose,
  crestRaccoon: CREST_GRIDS.raccoon,
  crestHeron: CREST_GRIDS.heron,
  crestOtter: CREST_GRIDS.otter,
  crestArena: CREST_GRIDS.arena,
  crestHall: CREST_GRIDS.hall,
  crestHut: CREST_GRIDS.hut,
  // A club member in seiza along the wall, in their armor with their men off, wearing whatever their dojo wears.
  spectator: grid(14, 14, [
    "...HHHHHHHH",
    "..HHhHHHHHHH",
    "..HHSSSSSSHH",
    "..HSKSSSSKSH",
    "..HSKSSSSKSH",
    "..HPSSSSSSPH",
    "...KKKKKKKK",
    "...KWIIIIWK",
    "..KIIiIIiIIK",
    "..KIIIIIIIIK",
    "..KNNZZZZNNK",
    ".KNNNZzzZNNNK",
    ".KNNNNNNNNNNK",
    ".KKKKKKKKKKKK",
  ]),
};

type Fill = (x: number, y: number, w: number, h: number, color: string) => void;
/** How far the hall reaches past the stage, in the stage's own coordinates. */
type Bounds = { left: number; right: number; top: number; bottom: number };
/** Any color from the shared palette, as this place has it. */
type Tint = (key: string) => string;

const tintOf = (look: DojoLook): Tint => (key) => look.room[key] ?? PALETTE[key];
const viewTint = (look: DojoLook): Tint => (key) => look.window[key] ?? PALETTE[key];

/** What's outside. The sky and hills are the same idea everywhere, and each place has something of its own in front of them. */
function paintWindow(fill: Fill, x: number, y: number, w: number, h: number, look: DojoLook): void {
  const see = viewTint(look);
  const frame = tintOf(look)("b");
  fill(x, y, w, h, see("C"));
  if (look.view !== "night" && look.view !== "sky") {
    // A cloud.
    fill(x + 6, y + 8, 12, 3, see("W"));
    fill(x + 9, y + 6, 7, 2, see("W"));
  }
  if (look.view !== "sky") {
    // Far hills, with the near ground in front.
    fill(x, y + h - 22, w, 22, see("G"));
    for (let i = 0; i < w; i += 6) fill(x + i, y + h - 24 - (i % 4), Math.min(6, w - i), 3, see("G"));
    fill(x, y + h - 10, w, 10, see("g"));
  }
  const stalks = (spacing: number, top: number, knots: boolean) => {
    for (let i = 4; i < w - 2; i += spacing) {
      fill(x + i, y + top, 2, h - top - 2, see("g"));
      if (knots) for (let knot = y + 8; knot < y + h - 4; knot += 11) fill(x + i, knot, 2, 1, see("G"));
      fill(x + i + 2, y + top + 8 + (i % 5), 3, 1, see("g"));
    }
  };
  if (look.view === "bamboo") stalks(9, 2, true);
  else if (look.view === "garden") {
    // One carefully kept pine.
    fill(x + 12, y + h - 22, 2, 14, see("g"));
    fill(x + 6, y + h - 26, 14, 4, see("g"));
    fill(x + 9, y + h - 30, 8, 4, see("g"));
  } else if (look.view === "pond") {
    // Still water, and reeds at the edge of it.
    for (let i = 3; i < w - 2; i += 7) fill(x + i, y + h - 18, 1, 9, PALETTE.g);
    fill(x + 8, y + h - 6, 10, 1, see("W"));
    fill(x + 28, y + h - 4, 8, 1, see("W"));
  } else if (look.view === "night") {
    // The moon, and it's later than you thought.
    fill(x + 30, y + 7, 8, 8, see("W"));
    fill(x + 33, y + 7, 5, 5, see("C"));
    for (const [sx, sy] of [[8, 6], [18, 12], [12, 20], [24, 4], [42, 20]]) fill(x + sx, y + sy, 1, 1, see("W"));
  } else if (look.view === "storm") {
    // Here comes the weather.
    fill(x, y + 4, w, 5, see("G"));
    const bolt = [[30, 9], [28, 13], [31, 13], [27, 19], [30, 19], [26, 27]];
    for (const [bx, by] of bolt) fill(x + bx, y + by, 3, 4, PALETTE.Y);
    for (let i = 3; i < w - 2; i += 8) for (let d = 12; d < h - 12; d += 9) fill(x + i - Math.floor(d / 6), y + d, 1, 3, see("W"));
  } else if (look.view === "smoke") {
    // The foundry, going day and night.
    for (const [cx, ch, cw] of [[8, 30, 6], [22, 22, 8], [38, 34, 6]]) {
      fill(x + cx, y + h - ch, cw, ch, see("g"));
      fill(x + cx + 1, y + h - ch - 5, cw + 2, 3, see("W"));
      fill(x + cx + 4, y + h - ch - 9, cw, 3, see("W"));
    }
  } else if (look.view === "rain") {
    for (let i = 3; i < w - 1; i += 5) for (let d = 3 + (i % 7); d < h - 4; d += 8) fill(x + i, y + d, 1, 4, see("W"));
  } else if (look.view === "sky") {
    fill(x + 6, y + 10, 16, 3, see("W"));
    fill(x + 30, y + 20, 14, 3, see("W"));
    fill(x, y + h - 8, w, 8, see("g"));
  } else if (look.view === "ravine") {
    // The other side of the ravine, a long way off.
    fill(x, y + h - 32, 16, 22, see("g"));
    fill(x + w - 14, y + h - 28, 14, 18, see("g"));
  }
  // Lattice over the opening.
  fill(x, y, w, 2, frame);
  fill(x, y + h - 2, w, 2, frame);
  fill(x, y, 2, h, frame);
  fill(x + w - 2, y, 2, h, frame);
  fill(x + Math.floor(w / 2) - 1, y, 2, h, frame);
}

/** The hall is built in bays, each between two pillars, and it goes on for as many as the window shows. */
const BAY = 76;
const RIGHT_BAY = STAGE_W - 82;
type Bay = { pillar: number; window: number; shaft: number };

/** Working outward from the stage. Bays on the right mirror those on the left, so the two sides frame the banner. */
function eachBay(bounds: Bounds, at: (bay: Bay) => void): void {
  for (let pillar = 0; pillar + BAY + 6 > bounds.left; pillar -= BAY) at({ pillar, window: pillar + 18, shaft: pillar + 22 });
  for (let pillar = RIGHT_BAY; pillar < bounds.right; pillar += BAY) at({ pillar, window: pillar + 14, shaft: pillar + 16 });
}

/** The first x at or left of `from` that lands on this spacing. */
const firstAt = (from: number, spacing: number, offset = 0) => Math.floor((from - offset) / spacing) * spacing + offset;

const RAIL_TOP = 74;
const WALL_TOP = 10;

/** The wall itself, between the ceiling beam and the rail. */
function paintWallFace(fill: Fill, bounds: Bounds, look: DojoLook, tint: Tint): void {
  const { left, right } = bounds;
  const width = right - left;
  const verticals = (spacing: number, color: string, thickness = 1) => {
    for (let x = firstAt(left, spacing); x < right; x += spacing) fill(x, WALL_TOP, thickness, RAIL_TOP - WALL_TOP, color);
  };
  if (look.wall === "paper") {
    // Paper screens: a lattice of soft shadow lines.
    verticals(14, tint("w"));
    for (let y = 14; y < RAIL_TOP; y += 14) fill(left, y, width, 1, tint("w"));
  } else if (look.wall === "plaster") {
    // Plain plaster, with one painted band to show who owns it.
    fill(left, 18, width, 2, tint("w"));
    fill(left, 62, width, 2, tint("w"));
  } else if (look.wall === "panels") {
    // Dark lacquer, framed in gold.
    verticals(30, tint("w"));
    fill(left, 14, width, 1, tint("w"));
    fill(left, 70, width, 1, tint("w"));
  } else if (look.wall === "steel") {
    verticals(28, tint("b"));
    for (let y = 26; y < RAIL_TOP; y += 24) fill(left, y, width, 1, tint("b"));
    for (let x = firstAt(left, 28); x < right; x += 28) for (let y = 14; y < RAIL_TOP; y += 12) fill(x + 3, y, 1, 1, tint("w"));
  } else if (look.wall === "slats") {
    // Weathered boards, with the damp creeping up from the bottom.
    verticals(9, tint("w"));
    for (let x = firstAt(left, 23, 4); x < right; x += 23) fill(x, RAIL_TOP - 14 - (x & 7), 5, 14 + (x & 7), tint("w"));
  } else {
    // Rough logs, stacked.
    for (let y = 18; y < RAIL_TOP; y += 8) fill(left, y, width, 1, tint("w"));
    for (let x = firstAt(left, 41, 9); x < right; x += 41) for (let y = 14; y < RAIL_TOP; y += 16) fill(x + (y & 7), y, 3, 3, tint("w"));
  }
}

function paintWall(fill: Fill, bounds: Bounds, look: DojoLook): void {
  const tint = tintOf(look);
  const { left, right, top } = bounds;
  const width = right - left;
  fill(left, top, width, FLOOR_Y - top, tint("O"));
  paintWallFace(fill, bounds, look, tint);

  eachBay(bounds, (bay) => paintWindow(fill, bay.window, 14, 50, RAIL_TOP - 16, look));

  // Above the ceiling beam, if the window's tall enough to see it: dark rafters.
  if (top < 0) {
    fill(left, top, width, -top, tint("b"));
    for (let y = -14; y > top; y -= 18) fill(left, y, width, 2, PALETTE.K);
  }
  // Ceiling beam.
  fill(left, 0, width, WALL_TOP, tint("b"));
  fill(left, 2, width, 2, tint("D"));
  fill(left, WALL_TOP, width, 1, PALETTE.K);

  // Wainscot boards along the bottom of the wall.
  fill(left, RAIL_TOP, width, FLOOR_Y - RAIL_TOP, tint("D"));
  for (let x = firstAt(left, 11, 5); x < right; x += 11) fill(x, RAIL_TOP, 1, FLOOR_Y - RAIL_TOP, tint("b"));
  fill(left, RAIL_TOP, width, 2, tint("b"));
  fill(left, FLOOR_Y - 1, width, 1, PALETTE.K);

  // Pillars.
  const pillar = (x: number) => {
    fill(x, 0, 6, FLOOR_Y, tint("b"));
    fill(x + 1, 0, 1, FLOOR_Y, tint("B"));
    fill(x + 5, 0, 1, FLOOR_Y, PALETTE.K);
  };
  eachBay(bounds, (bay) => {
    pillar(bay.pillar);
    pillar(bay.pillar + BAY);
  });
}

/** Rows of floor that get deeper toward the viewer, which gives it some depth, whatever it's made of. */
function paintFloorBase(fill: Fill, bounds: Bounds, look: DojoLook, tint: Tint): void {
  const { left, right, bottom } = bounds;
  const width = right - left;
  fill(left, FLOOR_Y, width, bottom - FLOOR_Y, tint("B"));
  let y = FLOOR_Y;
  let height = 5;
  let row = 0;
  while (y < bottom) {
    if (look.floor === "tatami") {
      // Woven mats, each with its dark edge.
      for (let x = firstAt(left, 7, row * 3); x < right; x += 7) fill(x, y + 1, 1, height - 1, tint("D"));
      fill(left, y, width, 1, tint("b"));
      for (let x = firstAt(left, 70, (row % 2) * 35); x < right; x += 70) fill(x, y, 2, height, tint("b"));
    } else if (look.floor === "parquet") {
      for (let x = firstAt(left, 18, row * 9); x < right; x += 18) {
        fill(x, y, 9, height, tint("D"));
        fill(x, y, 1, height, tint("b"));
        fill(x + 9, y, 1, height, tint("b"));
      }
      fill(left, y + height - 1, width, 1, tint("b"));
    } else if (look.floor === "plates") {
      if (row % 2 === 1) fill(left, y, width, height, tint("D"));
      fill(left, y, width, 1, tint("L"));
      fill(left, y + height - 1, width, 1, tint("b"));
      for (let x = firstAt(left, 34, (row * 17) % 34); x < right; x += 34) {
        fill(x, y, 1, height, tint("b"));
        fill(x + 3, y + 1, 1, 1, tint("L"));
        fill(x - 4, y + height - 2, 1, 1, tint("b"));
      }
    } else if (look.floor === "earth") {
      for (let x = firstAt(left, 13, (row * 7) % 13); x < right; x += 13) {
        fill(x + (row & 3), y + 1, 2, 1, tint("b"));
        fill(x + 6, y + height - 2, 3, 1, tint("D"));
      }
    } else {
      // Boards, and planks are just wider, rougher boards. Lacquer has a shine to it.
      const seams = look.floor === "planks" ? 31 : 53;
      if (row % 2 === 1) fill(left, y, width, height, tint("D"));
      fill(left, y + height - 1, width, 1, tint("b"));
      for (let x = firstAt(left, seams, (row * 37) % seams); x < right; x += seams) {
        fill(x, y, 1, height, tint("b"));
        if (look.floor === "planks") fill(x + 4, y + 1, 1, 1, tint("b"));
        if (look.floor === "lacquer") fill(x + 12, y + 1, 18, 1, tint("L"));
      }
    }
    y += height;
    height = Math.min(height + 1, 10);
    row++;
  }
}

function paintFloor(fill: Fill, bounds: Bounds, look: DojoLook): void {
  const tint = tintOf(look);
  const { bottom } = bounds;
  paintFloorBase(fill, bounds, look, tint);

  // Window light falling across the floor, dithered the old-fashioned way.
  const shaft = (from: number, shaftWidth: number) => {
    for (let py = FLOOR_Y; py < bottom; py++) {
      const slide = Math.floor((py - FLOOR_Y) * 0.55);
      for (let px = from + slide; px < from + slide + shaftWidth; px++) {
        if ((px + py) % 2 === 0) fill(px, py, 1, 1, tint("L"));
      }
    }
  };
  eachBay(bounds, (bay) => shaft(bay.shaft, 42));

  // Court tape: the far and near lines, the two starting marks and the center cross. The court itself never grows.
  fill(10, 103, STAGE_W - 20, 1, PALETTE.W);
  fill(4, 137, STAGE_W - 8, 1, PALETTE.W);
  for (let py = 103; py <= 137; py++) {
    const inset = Math.floor((137 - py) / 6);
    fill(4 + inset, py, 1, 1, PALETTE.W);
    fill(STAGE_W - 5 - inset, py, 1, 1, PALETTE.W);
  }
  const mid = STAGE_W / 2;
  for (const side of [-1, 1]) fill(mid + side * 26 - 4, 129, 8, 1, PALETTE.W);
  for (let i = -2; i <= 2; i++) {
    fill(mid + i, 129 + i, 1, 1, PALETTE.R);
    fill(mid + i, 129 - i, 1, 1, PALETTE.R);
  }
}

function paintBanner(ctx: CanvasRenderingContext2D, fill: Fill, crest: Crest, banner: NonNullable<DojoLook["banner"]>): void {
  const x = STAGE_W / 2 - 18;
  fill(x - 3, 11, 42, 2, PALETTE.b);
  fill(x, 13, 36, 44, banner.cloth);
  fill(x, 13, 2, 44, banner.edge);
  fill(x + 34, 13, 2, 44, banner.edge);
  // A notched hem.
  for (let i = 0; i < 36; i += 6) fill(x + i, 57, 4, 2, banner.cloth);
  fill(x + 8, 20, 20, 24, banner.field);
  drawSprite(ctx, CREST_GRIDS[crest], x + 11, 24);
}

/** Where each place hangs its own decorations on the wall, either side of the banner. */
const DECOR_SPOTS = [87, STAGE_W - 104];
const DECOR_Y = 42;
const MARK_SPACING = 83;

/** Paints the hall for a canvas this size, with the stage in the middle of it. The people come afterward, since they depend on who's fighting. */
function paintHall(crest: Crest, width: number, height: number, originX: number, originY: number): HTMLCanvasElement {
  const look = lookOf(crest);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  c.translate(originX, originY);
  const fill: Fill = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const bounds: Bounds = { left: -originX, right: width - originX, top: -originY, bottom: height - originY };
  paintWall(fill, bounds, look);
  paintFloor(fill, bounds, look);
  if (look.banner) paintBanner(c, fill, crest, look.banner);
  drawSprite(c, TILE_GRIDS.rack, 87, FLOOR_Y - 16, { colors: look.room });
  drawSprite(c, TILE_GRIDS.plant, STAGE_W - 104, FLOOR_Y - 16, { colors: look.room });
  if (look.decor) for (const x of DECOR_SPOTS) drawSprite(c, TILE_GRIDS[look.decor.tile], x, DECOR_Y);
  if (look.mark && look.markOnCourt) {
    // A few of whatever ends up on the floor here.
    let row = 0;
    for (let x = firstAt(bounds.left, MARK_SPACING, 13); x < bounds.right; x += MARK_SPACING, row++) drawSprite(c, TILE_GRIDS[look.mark.tile], x, row % 2 ? 96 : 122);
  }
  return canvas;
}

/** One painting per place, redone only when the window changes shape. */
const cache = new Map<Crest, { width: number; height: number; canvas: HTMLCanvasElement }>();
const tiles = new Map<Crest, HTMLCanvasElement>();

/** The side-on dojo, reaching all the way to the window's edges. */
export function drawDuelBackdrop(ctx: CanvasRenderingContext2D, crest: Crest): void {
  let painted = cache.get(crest);
  if (!painted || painted.width !== viewW || painted.height !== viewH) {
    painted = { width: viewW, height: viewH, canvas: paintHall(crest, viewW, viewH, stageX(), stageY()) };
    cache.set(crest, painted);
  }
  ctx.drawImage(painted.canvas, 0, 0);
}

const BOARD_HEIGHT = 10;
const BOARD_SEAMS = 53;

/** The same hall scrolling past, one stretch of wall after another, for the drill that runs along it. Drawn in stage height. */
export function drawHall(ctx: CanvasRenderingContext2D, crest: Crest, scroll: number, people?: (c: CanvasRenderingContext2D) => void): void {
  const tint = tintOf(lookOf(crest));
  let tile = tiles.get(crest);
  if (!tile) {
    tile = paintHall(crest, STAGE_W, STAGE_H, 0, 0);
    if (people) people(tile.getContext("2d")!);
    tiles.set(crest, tile);
  }
  // In a tall window, the rafters carry on above and the boards carry on below, scrolling along with the hall.
  const top = -stageY();
  const bottom = viewH - stageY();
  ctx.fillStyle = tint("b");
  ctx.fillRect(0, top, viewW, -top);
  ctx.fillStyle = PALETTE.K;
  for (let y = -14; y > top; y -= 18) ctx.fillRect(0, y, viewW, 2);
  let boardY = STAGE_H;
  for (let row = 0; boardY < bottom; row++, boardY += BOARD_HEIGHT) {
    ctx.fillStyle = tint(row % 2 ? "D" : "B");
    ctx.fillRect(0, boardY, viewW, BOARD_HEIGHT);
    ctx.fillStyle = tint("b");
    ctx.fillRect(0, boardY + BOARD_HEIGHT - 1, viewW, 1);
    const seams = (row * 37) % BOARD_SEAMS;
    for (let x = seams - (((scroll % BOARD_SEAMS) + BOARD_SEAMS) % BOARD_SEAMS) - BOARD_SEAMS; x < viewW; x += BOARD_SEAMS) ctx.fillRect(x, boardY, 1, BOARD_HEIGHT);
  }
  for (let x = -(((scroll % STAGE_W) + STAGE_W) % STAGE_W); x < viewW; x += STAGE_W) ctx.drawImage(tile, x, 0);
}
