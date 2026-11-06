import { drawAuraBack, drawAuraFront } from "../art/aura.ts";
import { BACKDROP_GRIDS, drawDuelBackdrop, type Crest } from "../art/backdrops.ts";
import { drawShinpan, drawWatchers } from "../art/courtside-art.ts";
import { BULLY_DOWN, drawFighter, drawReferee, POSES, type DuelPose } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered } from "../art/font.ts";
import { drawKendoka, FULL_GEAR, NO_GEAR, type Facing, type Gear } from "../art/kendoka.ts";
import { BULLY_COLORS, GEN_COLORS, MOMO_COLORS, NAO_COLORS, PALETTE, PERSON_COLORS, RIKU_COLORS, RIVAL_COLORS, SENIOR_COLORS, STREET_COLORS } from "../art/palette.ts";
import { drawSprite } from "../art/sprite.ts";
import { TILE, TILE_GRIDS } from "../art/tiles.ts";
import { drawMiniTrain, drawStreet, drawStreetcar, drawWorldBackdrop, WORLD_GRIDS, type StreetPlace } from "../art/world.ts";
import { setView, STAGE_H, STAGE_W, stageX, stageY, viewH, viewW } from "../core/scale.ts";
import type { Scene } from "../core/scene.ts";
import { drawPresence, drawRankTag } from "../art/presence.ts";
import { danLabel, presenceOf } from "../ranks.ts";
import { courtside } from "../world/courtside.ts";
import { DOJOS, MEMBERS, MOMO, SPAR_PARTNERS, type DojoId } from "../world/dojos.ts";
import { drawRoom } from "./topdown.ts";
import { crowdPose } from "./crowd.ts";
import { DISTRICTS, GANGS } from "../world/map.ts";
import { CHARACTERS, playerColors } from "../characters.ts";
import { DEFAULT_INSIGNIA } from "../insignia.ts";
import { createRunState } from "../run-state.ts";
import { drawInsigniaCard } from "./insignia-card.ts";
import { drawItemCard } from "./item-card.ts";
import { drawRide } from "./travel.ts";

const DRESSING: Gear[] = [
  NO_GEAR,
  { ...NO_GEAR, tare: true },
  { ...NO_GEAR, tare: true, do: true },
  { ...NO_GEAR, tare: true, do: true, men: true },
  { ...NO_GEAR, tare: true, do: true, men: true, kote: true },
  FULL_GEAR,
];
const POSE_NAMES = Object.keys(POSES) as DuelPose[];

/** Everyone with a face in the game. Rivals and senpai come straight from the game's own lists. */
export const ART_CAST: { name: string; colors?: Record<string, string>; gear: Gear }[] = [
  { name: "You", gear: FULL_GEAR },
  { name: "Street", colors: STREET_COLORS, gear: NO_GEAR },
  { name: "Kuma", colors: SENIOR_COLORS, gear: FULL_GEAR },
  ...[MOMO, ...Object.values(SPAR_PARTNERS)].map((who) => ({ name: who.rival, colors: who.colors, gear: FULL_GEAR })),
  { name: "Nao", colors: NAO_COLORS, gear: FULL_GEAR },
  { name: "Riku", colors: RIKU_COLORS, gear: FULL_GEAR },
  { name: "Gen", colors: GEN_COLORS, gear: FULL_GEAR },
  ...Object.values(DOJOS).map((who) => ({ name: who.rival, colors: who.colors, gear: FULL_GEAR })),
];

/** The tower stands apart, because it's far taller than the rest. */
export const CITY_SPRITES = Object.keys(WORLD_GRIDS).filter((name) => name !== "tower");

/** Where the nth small sprite goes on a page, with room for its name underneath. */
export const sheetCell = (index: number) => ({ x: 8 + (index % 5) * 40, y: 16 + Math.floor(index / 5) * 40 });

function renderDressing(ctx: CanvasRenderingContext2D, tick: number) {
  const frame = (Math.floor(tick / 15) % 2) as 0 | 1;
  const facings: Facing[] = ["down", "side", "up"];
  facings.forEach((facing, row) => {
    DRESSING.forEach((gear, col) => {
      drawKendoka(ctx, 6 + col * 26, 18 + row * 28, facing, frame, gear);
    });
  });
  drawText(ctx, "Momo", 170, 18, PALETTE.W);
  drawKendoka(ctx, 174, 30, "down", frame, FULL_GEAR, { colors: MOMO_COLORS });
  drawText(ctx, "Ren", 214, 18, PALETTE.W);
  drawKendoka(ctx, 216, 30, "down", frame, FULL_GEAR, { colors: RIVAL_COLORS });
  drawKendoka(ctx, 174, 64, "side", frame, FULL_GEAR);
  drawKendoka(ctx, 216, 64, "side", frame, FULL_GEAR, { flip: true });
  drawText(ctx, "Tare, do, men, kote, shinai", 6, 110, PALETTE.w);
}

function renderCast(ctx: CanvasRenderingContext2D, tick: number) {
  const frame = (Math.floor(tick / 15) % 2) as 0 | 1;
  ART_CAST.forEach(({ name, colors, gear }, i) => {
    const { x, y } = sheetCell(i);
    drawKendoka(ctx, x, y, "down", frame, gear, { colors });
    drawText(ctx, name, x - 4, y + 22, PALETTE.w);
  });
}

function renderPlayable(ctx: CanvasRenderingContext2D, tick: number) {
  const frame = (Math.floor(tick / 15) % 2) as 0 | 1;
  CHARACTERS.forEach((person, i) => {
    const x = 10 + i * 40;
    const colors = (gi: boolean) => playerColors({ character: person.id, insignia: DEFAULT_INSIGNIA, gi });
    drawText(ctx, person.name, x, 16, PALETTE.Y);
    drawKendoka(ctx, x, 28, "down", frame, NO_GEAR, { colors: colors(false) });
    drawKendoka(ctx, x, 52, "down", frame, NO_GEAR, { colors: colors(true) });
    drawKendoka(ctx, x, 76, "side", frame, FULL_GEAR, { colors: colors(true) });
    drawFighter(ctx, x + 8, 140, "guard", "player", 0, FULL_GEAR, { colors: colors(true) });
  });
}

const sheetRun = () => ({ ...createRunState(), insignia: { ...DEFAULT_INSIGNIA, symbol: "pine" as const } });

/** How many fit on a page before they'd run off the bottom. */
const POSES_PER_PAGE = 12;
const renderPoses = (first: number) => (ctx: CanvasRenderingContext2D) => {
  POSE_NAMES.slice(first, first + POSES_PER_PAGE).forEach((pose, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = 22 + col * 42;
    const y = 52 + row * 45;
    drawFighter(ctx, x, y, pose, "player", 0);
    drawTextCentered(ctx, pose.slice(0, 8), x, y - 3, PALETTE.w);
  });
};

function renderTells(ctx: CanvasRenderingContext2D, tick: number) {
  const tells: [DuelPose, string, string][] = [
    ["tellHandsUp", "Hands rise", "Kote open"],
    ["tellTipDip", "Tip dips", "Men open"],
    ["tellBigRaise", "Hands high", "Do open"],
  ];
  tells.forEach(([pose, tell, open], i) => {
    const x = 42 + i * 86;
    drawFighter(ctx, x, 86, pose, "rival", Math.floor(tick / 15));
    drawTextCentered(ctx, tell, x, 96, PALETTE.W);
    drawTextCentered(ctx, open, x, 108, PALETTE.R);
  });
}

function renderStances(ctx: CanvasRenderingContext2D, tick: number) {
  const poses: DuelPose[] = ["guard", "tellHandsUp", "tellTipDip", "block", "strikeMen", "recover"];
  (["jodan", "nito"] as const).forEach((kamae, row) => {
    const person = kamae === "jodan" ? MEMBERS.tetsu : MEMBERS.shin;
    drawText(ctx, `${person.rival}: ${kamae}`, 6, 14 + row * 62, PALETTE.Y);
    poses.forEach((pose, i) => {
      drawFighter(ctx, 26 + i * 41, 70 + row * 62, pose, "player", Math.floor(tick / 15), FULL_GEAR, { colors: person.colors, kamae });
    });
  });
}

function renderPractice(ctx: CanvasRenderingContext2D, tick: number, still: boolean) {
  const member = (col: number, row: number, activity: "suburi" | "keiko", flip: boolean, side: 0 | 1, name: string) => {
    const pose = crowdPose({ col, row, activity, flip, side }, tick, still);
    const x = col * TILE + (flip ? -pose.dx : pose.dx);
    drawKendoka(ctx, x, row * TILE, "side", pose.frame, FULL_GEAR, { flip, colors: name === "a" ? RIVAL_COLORS : undefined, held: pose.held });
  };
  drawText(ctx, "Suburi, in tandem", 6, 14, PALETTE.W);
  [1, 2, 3].forEach((row) => member(2, row + 1, "suburi", false, 0, "b"));
  drawText(ctx, "Keiko", 110, 14, PALETTE.W);
  member(7, 3, "keiko", false, 0, "a");
  member(9, 3, "keiko", true, 1, "b");
  [8, 6, 5, 4, 3].forEach((dan, i) => {
    const x = 28 + i * 48;
    drawPresence(ctx, x, 132, tick, presenceOf(dan), still);
    drawKendoka(ctx, x - 8, 112, "down", 0, { ...FULL_GEAR, men: false }, { colors: SENIOR_COLORS });
    drawRankTag(ctx, danLabel(dan), x, 103, presenceOf(dan) > 0);
  });
}

function renderAura(ctx: CanvasRenderingContext2D, tick: number, still: boolean) {
  [0.25, 0.6, 1].forEach((power, i) => {
    const x = 42 + i * 86;
    drawAuraBack(ctx, x, 110, tick, power, still);
    drawFighter(ctx, x, 110, "seme", "player", 0);
    drawAuraFront(ctx, x, 110, tick, power, still);
    drawTextCentered(ctx, `Power ${Math.round(power * 100)}`, x, 118, PALETTE.W);
  });
}

function renderAlleyCats(ctx: CanvasRenderingContext2D) {
  BULLY_COLORS.forEach((colors, i) => {
    drawFighter(ctx, 24 + i * 44, 58, i % 2 ? "tellHandsUp" : "guard", "rival", 0, NO_GEAR, { colors, weapon: i % 2 ? "stick" : "none" });
  });
  drawSprite(ctx, BULLY_DOWN, 196, 46, { colors: BULLY_COLORS[0] });
  Object.entries(PERSON_COLORS).forEach(([place, colors], i) => {
    const x = 20 + i * 36;
    drawFighter(ctx, x, 112, "stunned", "rival", 0, NO_GEAR, { colors, weapon: "none" });
    drawTextCentered(ctx, place.slice(0, 5), x, 116, PALETTE.w);
  });
}

function renderTiles(ctx: CanvasRenderingContext2D) {
  const names = Object.keys(TILE_GRIDS);
  names.forEach((name, i) => {
    drawSprite(ctx, TILE_GRIDS[name], 6 + (i % 12) * 20, 18 + Math.floor(i / 12) * 22);
  });
  Object.keys(BACKDROP_GRIDS)
    .filter((name) => name.startsWith("crest"))
    .forEach((name, i) => drawSprite(ctx, BACKDROP_GRIDS[name], 8 + i * 18, 66));
  drawSprite(ctx, BACKDROP_GRIDS.spectator, 150, 66);
  drawReferee(ctx, 90, 122, null);
  drawReferee(ctx, 126, 122, "red");
  drawReferee(ctx, 162, 122, "white");
}

function renderCitySprites(ctx: CanvasRenderingContext2D) {
  CITY_SPRITES.forEach((name, i) => {
    const { x, y } = sheetCell(i);
    drawSprite(ctx, WORLD_GRIDS[name], x, y);
    drawText(ctx, name.slice(0, 6), x - 4, y + 18, PALETTE.w);
  });
  drawSprite(ctx, WORLD_GRIDS.tower, 226, 40);
}

function renderSmallRides(ctx: CanvasRenderingContext2D, tick: number, still: boolean) {
  const x = still ? 90 : (tick % (STAGE_W + 80)) - 60;
  drawText(ctx, "On the map", 8, 30, PALETTE.W);
  drawStreetcar(ctx, x, 60);
  drawMiniTrain(ctx, x, 100);
}

function renderDojoPeek(ctx: CanvasRenderingContext2D, tick: number) {
  const frame = (Math.floor(tick / 15) % 2) as 0 | 1;
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 16; x++) {
      const tile = y === 0 ? "wallTop" : y === 1 ? "wall" : "floor";
      drawSprite(ctx, TILE_GRIDS[tile], x * TILE, y * TILE);
    }
  }
  drawSprite(ctx, TILE_GRIDS.doorClosed, 8 * TILE, TILE);
  drawSprite(ctx, TILE_GRIDS.window, 4 * TILE, TILE);
  drawSprite(ctx, TILE_GRIDS.window, 11 * TILE, TILE);
  drawSprite(ctx, TILE_GRIDS.rack, 2 * TILE, TILE);
  drawSprite(ctx, TILE_GRIDS.plant, 14 * TILE, TILE);
  drawSprite(ctx, TILE_GRIDS.iconMen, 4 * TILE, 4 * TILE);
  drawSprite(ctx, TILE_GRIDS.iconShinai, 12 * TILE, 6 * TILE);
  drawKendoka(ctx, 8 * TILE, 5 * TILE, "down", frame, { ...NO_GEAR, tare: true, do: true });
  drawKendoka(ctx, 10 * TILE, 3 * TILE, "down", 0, FULL_GEAR, { colors: SENIOR_COLORS });
}

function renderStage(ctx: CanvasRenderingContext2D, crest: Crest) {
  drawDuelBackdrop(ctx, crest);
  const side = courtside(crest, null);
  drawWatchers(ctx, crest, side, 0, true, false);
  drawShinpan(ctx, side, null);
  drawFighter(ctx, 92, 128, "guard", "player", 0);
  drawFighter(ctx, 164, 128, "tellHandsUp", "rival", 0);
}

type Page = { title: string; render: (ctx: CanvasRenderingContext2D, tick: number, still: boolean) => void };

const CRESTS = Object.keys(BACKDROP_GRIDS)
  .filter((name) => name.startsWith("crest"))
  .map((name) => name.slice("crest".length).toLowerCase() as Crest);

/** One page per thing, built from the game's own lists, so a new dojo or street can't be left off. */
const PAGES: Page[] = [
  { title: "Dressing up", render: renderDressing },
  { title: "The cast", render: renderCast },
  { title: "Playable", render: renderPlayable },
  { title: "Item card", render: (ctx, tick, still) => drawItemCard(ctx, { item: "tare", tick: tick % 150 }, sheetRun(), still) },
  { title: "Insignia", render: (ctx) => drawInsigniaCard(ctx, { insignia: sheetRun().insignia, row: 0 }, sheetRun()) },
  ...Array.from({ length: Math.ceil(POSE_NAMES.length / POSES_PER_PAGE) }, (_, i): Page => ({ title: `Duel poses ${i + 1}`, render: renderPoses(i * POSES_PER_PAGE) })),
  { title: "Three tells", render: renderTells },
  { title: "Seme aura", render: renderAura },
  { title: "Stances", render: renderStances },
  { title: "Practice and rank", render: renderPractice },
  { title: "Alley Cats", render: renderAlleyCats },
  { title: "Tiles", render: renderTiles },
  { title: "The dojo", render: renderDojoPeek },
  { title: "City sprites", render: renderCitySprites },
  { title: "Map rides", render: renderSmallRides },
  { title: "Ride: streetcar", render: (ctx, tick, still) => drawRide(ctx, { train: false, eastbound: true, tick, still, hair: PALETTE.I }) },
  { title: "Ride: train", render: (ctx, tick, still) => drawRide(ctx, { train: true, eastbound: true, tick, still, hair: PALETTE.I }) },
  ...CRESTS.map((crest): Page => ({ title: `Stage: ${crest}`, render: (ctx) => renderStage(ctx, crest) })),
  ...(Object.keys(DOJOS) as DojoId[]).map((id): Page => ({ title: `Room: ${id}`, render: (ctx) => drawRoom(ctx, DOJOS[id].room, { x: 0, y: 0 }, true, id) })),
  ...DISTRICTS.map((district): Page => ({ title: `City: ${district}`, render: (ctx) => drawWorldBackdrop(ctx, district) })),
  ...(Object.keys(GANGS) as StreetPlace[]).map((place): Page => ({ title: `Street: ${place}`, render: (ctx, tick, still) => drawStreet(ctx, still ? 0 : tick % 400, place, 126) })),
];
export const ART_PAGE_TITLES = PAGES.map((page) => page.title);

/** Development only: every sprite in one place, so the owner can react to the art. */
export function createArtSheet(): Scene {
  let page = 0;
  let tick = 0;
  return {
    update(game) {
      tick++;
      if (game.input.wasPressed("right")) page = (page + 1) % PAGES.length;
      if (game.input.wasPressed("left")) page = (page + PAGES.length - 1) % PAGES.length;
    },
    render(ctx, game) {
      ctx.fillStyle = "#3A3F4A";
      ctx.fillRect(0, 0, viewW, viewH);
      // Pages are for looking at the art, so they all use the plain stage, whatever the window.
      const window = [viewW, viewH] as const;
      ctx.save();
      ctx.translate(stageX(), stageY());
      setView(STAGE_W, STAGE_H);
      PAGES[page].render(ctx, tick, game.reducedMotion);
      ctx.fillStyle = PALETTE.K;
      ctx.fillRect(0, 0, STAGE_W, 11);
      drawText(ctx, `${page + 1}/${PAGES.length} ${PAGES[page].title}`, 3, 1, PALETTE.W);
      drawText(ctx, "left/right", 192, 1, PALETTE.w);
      setView(...window);
      ctx.restore();
    },
  };
}
