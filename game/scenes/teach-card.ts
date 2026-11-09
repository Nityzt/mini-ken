import { drawText, GLYPH_HEIGHT, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, STAGE_H, STAGE_W, viewH, viewW } from "../core/scale.ts";
import type { Game } from "../core/scene.ts";
import type { Input } from "../core/input.ts";
import { instructionText, keyLabel, teachingKeys } from "../core/key-labels.ts";
import { dimScreen, drawHints, drawKeycap } from "./ui.ts";

/** A key, or keys pressed together, and what it does. */
export type TeachKey = [key: string, does: string];
export type TeachCard = { title: string; text: string; keys: TeachKey[] };

export const CARD_W = 236;
const PADDING = 8;
export const CARD_TEXT_W = CARD_W - PADDING * 2;
const TITLE_SCALE = 2;
const TITLE_H = GLYPH_HEIGHT * TITLE_SCALE;
const KEY_ROW = 11;
const KEY_GAP = 5;
const FOOT_H = 10;
const DIM = 0.72;
/** Half a second, so a Space meant for the fight can't wave away the card that just stopped it. */
export const READ_TICKS = 30;
const CONTINUE: TeachKey = ["E", "or Space: continue"];

export const cardHeight = (card: TeachCard): number =>
  7 + TITLE_H + 5 + wrapText(card.text, CARD_TEXT_W).length * LINE_HEIGHT + (card.keys.length ? 4 + card.keys.length * KEY_ROW : 0) + 5 + FOOT_H + 6;

const capWidth = (key: string) => measureText(key) + 5;
/** How wide the block of keys comes out, with their descriptions lined up. */
export const keysWidth = (keys: TeachKey[]): number => Math.max(0, ...keys.map(([key]) => capWidth(key))) + KEY_GAP + Math.max(0, ...keys.map(([, does]) => measureText(does)));

const LINE_ROOM = STAGE_W - 8;
const LINE_TICKS = 180;
/** The same keys for along the bottom of a drill, in as many lines as it takes to fit the narrowest screen. */
export const keysLines = (keys: TeachKey[]): string[] => {
  const lines: string[] = [];
  for (const [key, does] of keys) {
    const entry = `${key} ${does}`;
    const joined = lines.length ? `${lines[lines.length - 1]}  ${entry}` : entry;
    if (lines.length && measureText(joined) <= LINE_ROOM) lines[lines.length - 1] = joined;
    else lines.push(entry);
  }
  return lines;
};
/** The line to show now: they take turns, like the rest of the controls do. */
export const keysLine = (keys: TeachKey[], tick: number): string => {
  const lines = keysLines(keys);
  return lines[Math.floor(tick / LINE_TICKS) % lines.length] ?? "";
};

/** Drawn at the stage's size however fine the interface's pixels are, because it's the one thing on screen that matters. */
function drawCard(ctx: CanvasRenderingContext2D, original: TeachCard, ready: boolean, input: Input): void {
  const card = { ...original, text: instructionText(input, original.text), keys: original.keys.map(([key, does]): TeachKey => [teachingKeys(input, key), does]) };
  onGui(ctx, () => {
    dimScreen(ctx, DIM);
    const scale = Math.max(1, Math.floor(Math.min(viewW / STAGE_W, viewH / STAGE_H)));
    const height = cardHeight(card);
    ctx.save();
    ctx.translate(Math.round((viewW - CARD_W * scale) / 2), Math.round((viewH - height * scale) / 2));
    ctx.scale(scale, scale);
    ctx.fillStyle = UI.accent;
    ctx.fillRect(0, 0, CARD_W, height);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(1, 1, CARD_W - 2, height - 2);

    let y = 7;
    drawText(ctx, card.title, Math.round((CARD_W - measureText(card.title) * TITLE_SCALE) / 2), y, UI.accent, TITLE_SCALE);
    y += TITLE_H + 5;
    const lines = wrapText(card.text, CARD_TEXT_W);
    const named = /^[^:]{1,20}:/.exec(lines[0])?.[0] ?? "";
    lines.forEach((line, i) => {
      const x = Math.round((CARD_W - measureText(line)) / 2);
      drawText(ctx, line, x, y, UI.text);
      if (i === 0 && named) drawText(ctx, named, x, y, UI.accent);
      y += LINE_HEIGHT;
    });

    if (card.keys.length) {
      y += 4;
      const left = Math.round((CARD_W - keysWidth(card.keys)) / 2);
      const column = left + Math.max(...card.keys.map(([key]) => capWidth(key))) + KEY_GAP;
      for (const [key, does] of card.keys) {
        drawKeycap(ctx, key, column - KEY_GAP - capWidth(key), y);
        drawText(ctx, does, column, y + 1, UI.text);
        y += KEY_ROW;
      }
    }
    if (ready) drawHints(ctx, [[keyLabel(input, "confirm", "e"), "continue"]], y + 5, CARD_W);
    ctx.restore();
  });
}

/** Stops everything to explain something, and doesn't carry on until you say so. A scene does nothing else while one's up. */
export function createTeachCards() {
  let queue: TeachCard[] = [];
  let ticks = 0;
  let input = {} as Input;
  return {
    get active() {
      return queue.length > 0;
    },
    get showing(): TeachCard | null {
      return queue[0] ?? null;
    },
    get ready() {
      return ticks >= READ_TICKS;
    },
    clear(game: Pick<Game, "debug">) {
      queue = [];
      game.debug.teachCard = null;
    },
    show(game: Pick<Game, "audio" | "debug"> & Partial<Pick<Game, "input">>, card: TeachCard) {
      if (game.input) input = game.input;
      if (!queue.length) {
        ticks = 0;
        game.audio.play("flag");
        game.debug.teachCard = card.title;
      }
      queue.push(card);
    },
    update(game: Pick<Game, "input" | "debug">) {
      if (!queue.length) return;
      input = game.input;
      if (ticks < READ_TICKS) {
        ticks++;
        return;
      }
      if (!game.input.wasPressed("confirm")) return;
      queue = queue.slice(1);
      ticks = 0;
      game.debug.teachCard = queue[0]?.title ?? null;
    },
    render(ctx: CanvasRenderingContext2D) {
      if (queue.length) drawCard(ctx, queue[0], ticks >= READ_TICKS, input);
    },
  };
}
export type TeachCards = ReturnType<typeof createTeachCards>;
