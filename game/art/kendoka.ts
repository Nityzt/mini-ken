import { PALETTE } from "./palette.ts";
import { drawSprite, grid } from "./sprite.ts";

export const KENDOKA_WIDTH = 16;
export const KENDOKA_HEIGHT = 20;
const g = (rows: string[]) => grid(KENDOKA_WIDTH, KENDOKA_HEIGHT, rows);

export type Gear = { tare: boolean; do: boolean; men: boolean; kote: boolean; shinai: boolean };
export type Facing = "down" | "up" | "side";

export const NO_GEAR: Gear = { tare: false, do: false, men: false, kote: false, shinai: false };
export const FULL_GEAR: Gear = { tare: true, do: true, men: true, kote: true, shinai: true };

const HEAD_DOWN = [
  "....HHHHHHHH",
  "...HHHHHHHHHH",
  "..HHhhHHHHHHHH",
  "..HhhHHHHHHHHH",
  "..HHSSSSSSSSHH",
  "..HSSSSSSSSSSH",
  "..HSSKSSSSKSSH",
  "..HSSKSSSSKSSH",
  "..HPSSSSSSSSPH",
  "...HSSSssSSSH",
  "....KKKKKKKK",
];
const BODY_DOWN = [
  "...KWWWIIWWWK",
  "..KWWWWIIWWWWK",
  "..KSKwWWWWwKSK",
  "...KNNNNNNNNK",
  "...KNIKNNKINK",
  "...KNNKNNKNNK",
];
const HEAD_UP = [
  "....HHHHHHHH",
  "...HHHHHHHHHH",
  "..HHhhHHHHHHHH",
  "..HhhHHHHHHHHH",
  "..HHHHHHHHHHHH",
  "..HHHHHHHHHHHH",
  "..HHHHHHHHHHHH",
  "..HHHHHHHHHHHH",
  "..HHHHHHHHHHHH",
  "...HHHHHHHHHH",
  "....KKKKKKKK",
];
const BODY_UP = [
  "...KWWWWWWWWK",
  "..KWWWWWWWWWWK",
  "..KSKwWWWWwKSK",
  "...KNNIIIINNK",
  "...KNNKNNKNNK",
  "...KNNKNNKNNK",
];
const HEAD_SIDE = [
  "....HHHHHHHH",
  "...HHHHHHHHHH",
  "..HHhhHHHHHHHH",
  "..HhhHHHHHHHHH",
  "..HHHHHSSSSSSH",
  "..HHHHSSSSSSSH",
  "..HHHHSSSSKSSH",
  "..HHHHSSSSKSSH",
  "..HHHSSSSSSPSH",
  "...HHSSSSSSSH",
  "....KKKKKKKK",
];
const BODY_SIDE = [
  "....KWWWIIWK",
  "...KWWWWWIIWK",
  "...KwWWKSKWWK",
  "....KNNNNNNK",
  "....KNIKNNNK",
  "....KNNKNNNK",
];
const LEGS = [
  ["...KNNNKKNNNK", "...KSSK..KNNK", "....KK....KK"],
  ["...KNNNKKNNNK", "...KNNK..KSSK", "....KK....KK"],
];
const LEGS_SIDE = [
  ["....KNNKKNNK", "....KSSK.KSSK", ".....KK...KK"],
  ["....KNNNNNNK", ".....KSSSSK", "......KKKK"],
];

export const KENDOKA_GRIDS: Record<string, string[]> = {
  down0: g([...HEAD_DOWN, ...BODY_DOWN, ...LEGS[0]]),
  down1: g([...HEAD_DOWN, ...BODY_DOWN, ...LEGS[1]]),
  up0: g([...HEAD_UP, ...BODY_UP, ...LEGS[0]]),
  up1: g([...HEAD_UP, ...BODY_UP, ...LEGS[1]]),
  side0: g([...HEAD_SIDE, ...BODY_SIDE, ...LEGS_SIDE[0]]),
  side1: g([...HEAD_SIDE, ...BODY_SIDE, ...LEGS_SIDE[1]]),
};

// Overlays. Row numbers line up with the base sprite: head 0-10, body 11-16, legs 17-19.
const blank = (count: number) => Array<string>(count).fill("");

export const GEAR_OVERLAYS: Record<keyof Gear, Record<Facing, string[]>> = {
  tare: {
    down: g([...blank(14), "...KIIIIIIIIK", "...KIIZZZZIIK", "...KIIZzzZIIK", "...KIKIKKIKIK"]),
    up: g([...blank(14), "...KIIIIIIIIK", "...KIiIIIIiIK", "...KIIIKKIIIK"]),
    side: g([...blank(14), "....KIIIIIIK", "....KIIIZZZK", "....KIIIZzZK", "....KIKIKIKK"]),
  },
  do: {
    down: g([...blank(11), "...KIIIIIIIIK", "...KKiKKKKKKK", "...KKiKKKKKKK", "....KKKKKKKK"]),
    up: g([...blank(11), "...KWIWWWWIWK", "..KWWIIWWIIWWK"]),
    side: g([...blank(11), "....KWWIIIIK", "....KWWKiKKKK", "....KWKKiKKKK", ".....KKKKKKK"]),
  },
  men: {
    down: g([
      "....NNNNNNNN",
      "...NIIiiIIIIN",
      "..NIiiIEEIIIIN",
      "..NIAIAEEAIAIN",
      "..NIMMMMMMMMIN",
      "..NIM..MM..MIN",
      "..NIM..MM..MIN",
      "..NIM..MM..MIN",
      "..NIMMMMMMMMIN",
      "..NNIMMMMMMINN",
      "..NUUNNNNNNUUN",
      "..NIN......NIN",
    ]),
    up: g([
      "....NNNNNNNN",
      "...NIIiiIIIIN",
      "..NIiiIEEIIIIN",
      "..NIAIAEEAIAIN",
      "..NIIITTTTIIIN",
      "..NIIIItTIIIIN",
      "..NIAIIIIIIAIN",
      "..NIIIIIIIIIIN",
      "..NIAIIIIIIAIN",
      "..NIIIIIIIIIIN",
      "..NUUUNNNNUUUN",
      "..NIN......NIN",
    ]),
    side: g([
      "....NNNNNNNN",
      "...NIIiiIIIIN",
      "..NIiiIEEIIIIN",
      "..NIAIAEEAIAIN",
      "..NIIIIIMMMMMN",
      "..NIAIIIM..M.N",
      "..NIIEEIM..M.N",
      "..NIAEEIM..M.N",
      "..NIIIIIMMMMMN",
      "..NIAIIIIMMMN",
      "..NUUUNNNNNNN",
      "...NIN",
    ]),
  },
  kote: {
    down: g([...blank(12), "..KIIK.....KIIK", "..KIIK......KIK"]),
    up: g([...blank(12), "..KIIK.....KIIK", "..KIIK......KIK"]),
    side: g([...blank(12), ".......KIIIK", ".......KIIIK"]),
  },
  shinai: {
    down: g([...blank(5), "..............KW", "..............KY", "..............KY", "..............KY", "..............KY", "..............KY", "..............KY", "..............KK", "..............KW", "..............KW"]),
    up: g([...blank(5), ".KW", ".KY", ".KY", ".KY", ".KY", ".KY", ".KY", ".KK", ".KW", ".KW"]),
    side: g([...blank(11), "...............W", "..............YW", "............YY", "..........KY", "........WWK"]),
  },
};

const OVERLAY_ORDER: (keyof Gear)[] = ["tare", "do", "men", "kote", "shinai"];

/** A shinai held some other way than at rest, drawn from the hands out. Only for someone seen side-on. */
export type HeldShinai = "guard" | "raised" | "strike" | "cover" | "jodan" | "nito";
type Blade = { from: [number, number]; to: [number, number] };
const HELD: Record<HeldShinai, Blade[]> = {
  guard: [{ from: [10, 14], to: [20, 8] }],
  raised: [{ from: [9, 3], to: [0, -2] }],
  strike: [{ from: [11, 11], to: [24, 10] }],
  cover: [{ from: [11, 12], to: [15, -1] }],
  jodan: [{ from: [9, 3], to: [0, -8] }],
  nito: [{ from: [9, 8], to: [16, -4] }, { from: [11, 14], to: [19, 11] }],
};

function drawBlade(ctx: CanvasRenderingContext2D, x: number, y: number, blade: Blade, flip: boolean): void {
  const steps = Math.max(Math.abs(blade.to[0] - blade.from[0]), Math.abs(blade.to[1] - blade.from[1]));
  for (let i = 0; i <= steps; i++) {
    const dx = Math.round(blade.from[0] + ((blade.to[0] - blade.from[0]) * i) / steps);
    const dy = Math.round(blade.from[1] + ((blade.to[1] - blade.from[1]) * i) / steps);
    ctx.fillStyle = i < 2 ? PALETTE.W : i === 2 ? PALETTE.K : i >= steps - 1 ? PALETTE.W : PALETTE.Y;
    ctx.fillRect(flip ? x + KENDOKA_WIDTH - 1 - dx : x + dx, y + dy, 1, 1);
  }
}

/** x and y are the sprite's top-left corner. Gear sits on top of the base in dressing order. */
export function drawKendoka(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: Facing,
  frame: 0 | 1,
  gear: Gear,
  options: { flip?: boolean; colors?: Record<string, string>; held?: HeldShinai } = {},
): void {
  drawSprite(ctx, KENDOKA_GRIDS[`${facing}${frame}`], x, y, options);
  for (const piece of OVERLAY_ORDER) {
    if (!gear[piece] || (piece === "shinai" && options.held)) continue;
    drawSprite(ctx, GEAR_OVERLAYS[piece][facing], x, y, options);
  }
  if (options.held && gear.shinai) for (const blade of HELD[options.held]) drawBlade(ctx, x, y, blade, !!options.flip);
}
