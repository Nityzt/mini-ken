import { drawText, measureText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { guiPoint, onGui, viewH, viewW } from "../core/scale.ts";
import { HP_LOW, HP_MAX } from "../health.ts";
import { levelOf, rankLabel } from "../ranks.ts";
import { playerKiMax, type RunState } from "../run-state.ts";
import { HP_LABEL } from "./content.ts";

const CAP_HEIGHT = 9;
const STRIP_TOP = 11;
const STRIP_HEIGHT = 10;

/** A key drawn like a key. Returns how wide it came out. */
export function drawKeycap(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): number {
  const width = measureText(label) + 5;
  ctx.fillStyle = UI.keyEdge;
  ctx.fillRect(x, y + 1, width, CAP_HEIGHT);
  ctx.fillStyle = UI.keyFace;
  ctx.fillRect(x, y, width, CAP_HEIGHT - 1);
  drawText(ctx, label, x + 3, y + 1, UI.panel);
  return width;
}

const hintsWidth = (hints: [string, string][]) => hints.reduce((sum, [key, does]) => sum + measureText(key) + 5 + 3 + measureText(does) + 9, -9);

/** A row of keys and what they do, centered. */
export function drawHints(ctx: CanvasRenderingContext2D, hints: [string, string][], y: number): void {
  let x = Math.round((viewW - hintsWidth(hints)) / 2);
  for (const [key, does] of hints) {
    x += drawKeycap(ctx, key, x, y) + 3;
    drawText(ctx, does, x, y + 1, UI.text);
    x += measureText(does) + 9;
  }
}

const TAG_HEIGHT = 10;

/** A few words over someone in the world, on a small dark backing. `bottom` is where it sits, and it stays on screen. */
export function drawTag(ctx: CanvasRenderingContext2D, text: string, centerX: number, bottom: number, color: string): void {
  const at = guiPoint(ctx, centerX, bottom);
  onGui(ctx, () => {
    const width = measureText(text);
    const left = Math.round(Math.max(3, Math.min(viewW - width - 3, at.x - width / 2)));
    const top = Math.round(at.y) - TAG_HEIGHT;
    ctx.fillStyle = UI.panel;
    ctx.fillRect(left - 2, top, width + 4, TAG_HEIGHT);
    drawText(ctx, text, left, top + 1, color);
  });
}

const COIN_WIDTH = 7;

/** A round coin with a hole in it, like a tiny tsuba. */
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = UI.accent;
  ctx.fillRect(x + 1, y, 3, 1);
  ctx.fillRect(x, y + 1, 5, 3);
  ctx.fillRect(x + 1, y + 4, 3, 1);
  ctx.fillStyle = UI.panel;
  ctx.fillRect(x + 2, y + 2, 1, 1);
}

const STATUS_GAP = 6;
/** In a very small window, your level and the word HP are the first things to go. */
const roomy = () => viewW >= 320;
const COIN_GAP = 5;

/** What goes in the top right, from the right-hand edge in. Ki only means something once you're armored. */
const statusParts = (run: RunState): { text: string; color: string }[] => [
  ...(run.trained ? [{ text: `Ki ${playerKiMax(run)}`, color: UI.accent }] : []),
  ...(roomy() || !run.trained ? [{ text: `Lv ${levelOf(run.xp)}`, color: UI.text }] : []),
  { text: rankLabel(run), color: UI.text },
];

const HP_BAR_WIDTH = 34;
const HP_BAR_HEIGHT = 5;
/** Only worth showing once you can get hurt. */
const hpLabelWidth = (): number => (roomy() ? measureText(HP_LABEL) + 3 : 0);
const hpWidth = (run: RunState): number => (run.trained ? hpLabelWidth() + HP_BAR_WIDTH + STATUS_GAP : 0);

export const statusWidth = (run: RunState): number =>
  measureText(`${run.money}`) + COIN_WIDTH + COIN_GAP + hpWidth(run) + statusParts(run).reduce((sum, { text }) => sum + measureText(text) + STATUS_GAP, -STATUS_GAP);

/** Your health. It turns red when you ought to go and rest. */
export function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, width = HP_BAR_WIDTH, height = HP_BAR_HEIGHT): void {
  ctx.fillStyle = UI.track;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = hp < HP_LOW ? UI.bad : UI.good;
  ctx.fillRect(x, y, Math.ceil((width * Math.max(0, hp)) / HP_MAX), height);
}

/** A place's name for the top bar. If it won't fit beside your status, the word Dojo is the first thing to go. */
export const fitTitle = (name: string, width: number, status: number): string =>
  measureText(name) + status + STATUS_GAP <= width ? name : name.replace(/ Dojo$/, "");

/** Your rank, level, ki and kensen, in the top right. */
export function drawStatus(ctx: CanvasRenderingContext2D, run: RunState): void {
  let x = viewW - 3 - measureText(`${run.money}`);
  drawText(ctx, `${run.money}`, x, 1, UI.accent);
  drawCoin(ctx, x - COIN_WIDTH + 1, 2);
  x -= COIN_WIDTH + COIN_GAP;
  if (run.trained) {
    x -= HP_BAR_WIDTH;
    drawHpBar(ctx, x, 2, run.hp);
    x -= hpLabelWidth();
    if (roomy()) drawText(ctx, HP_LABEL, x, 1, run.hp < HP_LOW ? UI.bad : UI.dim);
    x -= STATUS_GAP;
  }
  for (const { text, color } of statusParts(run)) {
    x -= measureText(text);
    drawText(ctx, text, x, 1, color);
    x -= STATUS_GAP;
  }
}

/** The whole top bar: where you are, and how you stand. */
export function drawTopBar(ctx: CanvasRenderingContext2D, name: string, run: RunState): void {
  onGui(ctx, () => {
    ctx.fillStyle = UI.panel;
    ctx.fillRect(0, 0, viewW, 11);
    drawText(ctx, fitTitle(name, viewW, statusWidth(run)), 3, 1, UI.text);
    drawStatus(ctx, run);
  });
}

/** What's next, under the top bar, so nobody has to remember. */
export function drawObjective(ctx: CanvasRenderingContext2D, text: string): void {
  if (!text) return;
  onGui(ctx, () => {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = UI.panel;
    ctx.fillRect(0, STRIP_TOP, measureText(text) + 16, STRIP_HEIGHT);
    ctx.globalAlpha = 1;
    drawText(ctx, ">", 3, STRIP_TOP + 1, UI.accent);
    drawText(ctx, text, 11, STRIP_TOP + 1, UI.text);
  });
}

const PROMPT_HEIGHT = 12;
/** In the world's pixels, from the top of the walker's box: just clear of the head, or just under the feet. */
const PROMPT_OVER_HEAD = -16;
const PROMPT_UNDER_FEET = 10;
/** The top bar and the objective line under it. */
const BARS_BOTTOM = STRIP_TOP + STRIP_HEIGHT + 2;

/** "E Talk" floating over your head when there's something in front of you. */
export function drawInteractPrompt(ctx: CanvasRenderingContext2D, label: string, centerX: number, feetY: number): void {
  const overHead = guiPoint(ctx, centerX, feetY + PROMPT_OVER_HEAD);
  const underFeet = guiPoint(ctx, centerX, feetY + PROMPT_UNDER_FEET);
  onGui(ctx, () => {
    const width = measureText("E") + 5 + 3 + measureText(label) + 4;
    const x = Math.round(Math.max(2, Math.min(viewW - width - 2, overHead.x - width / 2)));
    const above = overHead.y - PROMPT_HEIGHT;
    const y = Math.round(above < BARS_BOTTOM ? Math.min(viewH - PROMPT_HEIGHT, underFeet.y) : above);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(x - 1, y - 1, width + 2, PROMPT_HEIGHT);
    const cap = drawKeycap(ctx, "E", x + 1, y);
    drawText(ctx, label, x + 1 + cap + 3, y + 1, UI.text);
  });
}

/** Darkens everything behind a card or menu. */
export function dimScreen(ctx: CanvasRenderingContext2D, amount: number): void {
  ctx.globalAlpha = amount;
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.globalAlpha = 1;
}
