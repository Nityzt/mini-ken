import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { PROGRESS_TABS, type PauseMenu } from "../core/pause-menu.ts";
import { STAGE_H, STAGE_W } from "../core/scale.ts";
import { DOJOS } from "../world/dojos.ts";
import { levelOf, levelProgress, rankLabel, xpToNextLevel } from "../ranks.ts";
import { KI_GOAL, LADDER, needs, nextGoal, shortNeeds, TECHNIQUE_INFO, techniques, unlockKind, unmet, type UnlockKind } from "../progress.ts";
import { playerKiMax, type RunState } from "../run-state.ts";
import { HINT_BACK, HINT_PAGE, HINT_PICK, MAP_LOCKED, MAP_NEXT, MAP_NOTHING_NEEDED, MAP_OPEN, PROGRESS_CHAMPION, PROGRESS_OPEN_DONE, RANK_LEVEL, RANK_STATS, RANK_XP_LEFT, TECHNIQUES_TITLE } from "./content.ts";
import { drawCheck, drawCross, drawHints, drawMeter } from "./ui.ts";

const HINTS_Y = STAGE_H - 12;
const BODY_TOP = 18;

/** What color each kind of thing is on the map, so a glance down the list tells fights from dojos from cups. */
export const KIND_COLORS: Record<UnlockKind, string> = {
  city: UI.text,
  fight: UI.bad,
  dojo: UI.good,
  cup: UI.accent,
  grading: "#B79AE6",
  travel: "#7FB2E5",
  online: "#7ADBD0",
};

function drawTabs(ctx: CanvasRenderingContext2D, tab: number): void {
  let x = 8;
  PROGRESS_TABS.forEach((label, i) => {
    const width = measureText(label) + 10;
    ctx.fillStyle = i === tab ? UI.accent : UI.track;
    ctx.fillRect(x, 2, width, 11);
    drawText(ctx, label, x + 5, 4, i === tab ? UI.panel : UI.dim);
    x += width + 3;
  });
}

function drawRank(ctx: CanvasRenderingContext2D, run: RunState): void {
  const rank = rankLabel(run);
  const rankX = Math.round((STAGE_W - measureText(rank) * 2) / 2);
  drawText(ctx, rank, rankX + 1, BODY_TOP + 2, UI.track, 2);
  drawText(ctx, rank, rankX, BODY_TOP + 1, UI.accent, 2);
  drawTextCentered(ctx, `${RANK_LEVEL} ${levelOf(run.xp)}`, STAGE_W / 2, BODY_TOP + 21, UI.text);
  if (run.champion) drawTextCentered(ctx, PROGRESS_CHAMPION, STAGE_W / 2, BODY_TOP + 31, UI.good);
  drawMeter(ctx, 36, 54, 184, 7, levelProgress(run.xp), UI.accent);
  drawTextCentered(ctx, `${xpToNextLevel(run.xp)} ${RANK_XP_LEFT}`, STAGE_W / 2, 64, UI.dim);

  const ki = playerKiMax(run);
  drawText(ctx, "Ki", 36, 77, UI.good);
  drawMeter(ctx, 52, 78, 140, 6, ki / KI_GOAL, UI.good);
  drawText(ctx, `${ki}`, 198, 77, UI.text);

  const heads = Object.keys(DOJOS).filter((id) => run.beaten.includes(id as keyof typeof DOJOS)).length;
  const stats = [run.beaten.length, run.cups.length, heads];
  stats.forEach((value, i) => {
    const x = 26 + i * 70;
    ctx.fillStyle = UI.slot;
    ctx.fillRect(x, 92, 64, 28);
    ctx.fillStyle = [UI.bad, UI.accent, UI.good][i];
    ctx.fillRect(x, 92, 64, 2);
    drawTextCentered(ctx, `${value}`, x + 32, 96, UI.text);
    drawTextCentered(ctx, RANK_STATS[i], x + 32, 109, UI.dim);
  });
}

function drawTechniques(ctx: CanvasRenderingContext2D, run: RunState): void {
  const known = techniques(run);
  drawText(ctx, `${TECHNIQUES_TITLE} ${known.length}/${TECHNIQUE_INFO.length}`, 8, BODY_TOP, UI.dim);
  TECHNIQUE_INFO.forEach((technique, i) => {
    const y = 30 + i * 13;
    const have = known.includes(technique.id);
    ctx.fillStyle = have ? UI.slot : UI.panel;
    ctx.fillRect(6, y - 2, 244, 12);
    ctx.fillStyle = have ? technique.color : UI.track;
    ctx.fillRect(9, y, 8, 8);
    drawText(ctx, technique.name, 22, y, have ? UI.text : UI.faint);
    drawText(ctx, have ? technique.line : technique.hint, 134, y, have ? UI.dim : UI.faint);
  });
}

const MAP_ROWS = 8;
const MAP_TOP = 49;
const MAP_ROW_H = 9;
const MAP_RIGHT = 240;
const CARD_TOP = 16;

/** The part of the ladder on screen, with the picked row kept in view. */
export const mapWindow = (choice: number, total = LADDER.length): number => Math.min(Math.max(0, choice - 3), Math.max(0, total - MAP_ROWS));

function drawMap(ctx: CanvasRenderingContext2D, menu: PauseMenu, run: RunState): void {
  const picked = LADDER[Math.min(menu.choice, LADDER.length - 1)];
  const goal = nextGoal(run);
  const open = unmet(run, picked).length === 0;
  const status = open ? { text: MAP_OPEN, color: UI.good } : picked === goal ? { text: MAP_NEXT, color: UI.accent } : { text: MAP_LOCKED, color: UI.bad };

  ctx.fillStyle = UI.slot;
  ctx.fillRect(6, CARD_TOP, 244, 30);
  ctx.fillStyle = KIND_COLORS[unlockKind(picked)];
  ctx.fillRect(6, CARD_TOP, 3, 30);
  drawText(ctx, status.text.toUpperCase(), 14, CARD_TOP + 3, status.color);
  drawText(ctx, picked.label, 14 + measureText(status.text) + 10, CARD_TOP + 3, UI.text);
  // What's missing comes first, so it's never what gets cut off.
  const list = [...needs(run, picked)].sort((a, b) => Number(a.met) - Number(b.met));
  if (!list.length) drawText(ctx, MAP_NOTHING_NEEDED, 14, CARD_TOP + 15, UI.dim);
  let x = 14;
  let line = 0;
  for (const need of list) {
    const width = 8 + measureText(need.text);
    if (x + width > 244 && x > 14) {
      x = 14;
      line++;
    }
    if (line > 1) break;
    const y = CARD_TOP + 14 + line * 9;
    (need.met ? drawCheck : drawCross)(ctx, x, y + 1, need.met ? UI.good : UI.bad);
    drawText(ctx, need.text, x + 8, y, need.met ? UI.dim : UI.text);
    x += width + 8;
  }

  const first = mapWindow(menu.choice);
  LADDER.slice(first, first + MAP_ROWS).forEach((unlock, i) => {
    const y = MAP_TOP + i * MAP_ROW_H;
    const here = first + i === menu.choice;
    const isOpen = unmet(run, unlock).length === 0;
    if (here) {
      ctx.fillStyle = UI.track;
      ctx.fillRect(6, y - 1, 238, MAP_ROW_H);
    }
    ctx.fillStyle = KIND_COLORS[unlockKind(unlock)];
    ctx.fillRect(10, y + 1, 4, 5);
    drawText(ctx, unlock.label, 18, y, here ? UI.accent : isOpen ? UI.text : UI.dim);
    if (isOpen) {
      drawText(ctx, PROGRESS_OPEN_DONE, MAP_RIGHT - measureText(PROGRESS_OPEN_DONE), y, UI.good);
      drawCheck(ctx, MAP_RIGHT - measureText(PROGRESS_OPEN_DONE) - 8, y + 1, UI.good);
    } else {
      const text = shortNeeds(run, unlock, MAP_RIGHT - 18);
      drawText(ctx, text, MAP_RIGHT - measureText(text), y, UI.accent);
    }
  });
  const track = MAP_ROWS * MAP_ROW_H;
  ctx.fillStyle = UI.track;
  ctx.fillRect(246, MAP_TOP - 1, 2, track);
  const thumb = Math.max(6, Math.round((track * MAP_ROWS) / LADDER.length));
  ctx.fillStyle = UI.dim;
  ctx.fillRect(246, MAP_TOP - 1 + Math.round(((track - thumb) * first) / Math.max(1, LADDER.length - MAP_ROWS)), 2, thumb);
}

export function drawProgress(ctx: CanvasRenderingContext2D, menu: PauseMenu, run: RunState): void {
  const tab = menu.tab ?? PROGRESS_TABS.length - 1;
  drawTabs(ctx, tab);
  if (tab === 0) drawRank(ctx, run);
  else if (tab === 1) drawTechniques(ctx, run);
  else drawMap(ctx, menu, run);
  drawHints(ctx, tab === PROGRESS_TABS.length - 1 ? [["<>", HINT_PAGE], ["^v", HINT_PICK], ["E", HINT_BACK]] : [["<>", HINT_PAGE], ["E", HINT_BACK]], HINTS_Y, STAGE_W);
}
