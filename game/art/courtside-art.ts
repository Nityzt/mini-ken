import { stageX, viewW } from "../core/scale.ts";
import { courtside, seatLeft, seatTaken, type Courtside, type Seat } from "../world/courtside.ts";
import type { OpponentId } from "../world/dojos.ts";
import { BACKDROP_GRIDS, FLOOR_Y, type Crest } from "./backdrops.ts";
import { drawReferee } from "./duel-sprites.ts";
import { lookOf } from "./looks.ts";
import { drawPresence } from "./presence.ts";
import { drawSprite } from "./sprite.ts";
import { STAGE_W } from "../core/scale.ts";

const SEAT_Y = FLOOR_Y - 7;
const CUSHION_GOLD = "#E6C46A";
const SEAT_LIMIT = 80;
const HEAD_PRESENCE = 0.4;

function drawSeat(ctx: CanvasRenderingContext2D, x: number, seat: Seat, cushion: string, tick: number, reducedMotion: boolean, lift: number): void {
  // Anyone senior gets a cushion. The head of the dojo also has that feeling about them.
  if (seat.tier !== "member") {
    ctx.fillStyle = seat.tier === "head" ? CUSHION_GOLD : cushion;
    ctx.fillRect(x - 1, SEAT_Y + 12, 16, 3);
  }
  if (seat.tier === "head") drawPresence(ctx, x + 7, SEAT_Y + 14, tick, HEAD_PRESENCE, reducedMotion);
  drawSprite(ctx, BACKDROP_GRIDS.spectator, x, SEAT_Y - lift, { colors: seat.colors });
}

/** Everyone sitting along the wall, in the stage's own coordinates, out to the edges of the window. */
export function drawWatchers(ctx: CanvasRenderingContext2D, place: Crest, side: Courtside, tick = 0, reducedMotion = true, wholeWindow = true, excited = false): void {
  if (!side.seated.length && !side.crowd.length) return;
  const left = wholeWindow ? -stageX() : 0;
  const right = wholeWindow ? viewW - stageX() : STAGE_W;
  const cushion = lookOf(place).banner?.cloth ?? CUSHION_GOLD;
  for (let n = 0; n < SEAT_LIMIT; n++) {
    const x = seatLeft(n);
    if (x + 14 < left || x > right || !seatTaken(n, side.seated.length)) continue;
    const seat: Seat = side.seated[n] ?? { who: null, colors: side.crowd[n % side.crowd.length], tier: "member" };
    // A good point has the row leaning in, though the seniors keep their composure.
    const lift = excited && !reducedMotion && seat.tier === "member" && Math.floor(tick / 6 + n) % 2 === 0 ? 1 : 0;
    drawSeat(ctx, x, seat, cushion, tick, reducedMotion, lift);
  }
}

const JUDGE_SPOTS: [number, number][] = [[STAGE_W / 2, 102], [22, 120], [STAGE_W - 22, 120]];
const judgeLooks = new Map<Record<string, string>, Record<string, string>>();
/** A judge wears their own colors, as a jacket and trousers, so you can tell who's got the flags. */
function judgeLook(colors: Record<string, string>): Record<string, string> | undefined {
  if (!colors.I) return undefined;
  let look = judgeLooks.get(colors);
  if (!look) judgeLooks.set(colors, (look = { N: colors.I, R: colors.i ?? colors.I, w: colors.N ?? colors.I }));
  return look;
}

export function drawShinpan(ctx: CanvasRenderingContext2D, side: Courtside, flags: "red" | "white" | null): void {
  side.shinpan.forEach((seat, i) => drawReferee(ctx, JUDGE_SPOTS[i][0], JUDGE_SPOTS[i][1], flags, judgeLook(seat.colors)));
}

/** The people sitting in a place, for a screen that isn't a match. `busy` is anyone who's up and doing something else. */
export const drawEveryoneThere = (ctx: CanvasRenderingContext2D, place: Crest, wholeWindow = true, busy: OpponentId | null = null): void => drawWatchers(ctx, place, courtside(place, busy), 0, true, wholeWindow);
