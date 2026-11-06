import { drawText, LINE_HEIGHT, measureText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import type { Input } from "../core/input.ts";
import { onGui, STAGE_H, STAGE_W, stageX, viewH } from "../core/scale.ts";
import { CHOICE_HINT } from "./content.ts";

export type ChoiceOption<Id extends string = string> = { id: Id; label: string };
export type Choice<Id extends string = string> = { options: ChoiceOption<Id>[]; at: number };
export type ChoiceKeys = { up: boolean; down: boolean; confirm: boolean; cancel: boolean };

export const createChoice = <Id extends string>(options: ChoiceOption<Id>[]): Choice<Id> => ({ options, at: 0 });

export function stepChoice<Id extends string>(choice: Choice<Id>, keys: ChoiceKeys): { choice: Choice<Id>; picked: Id | null; closed: boolean } {
  if (keys.cancel) return { choice, picked: null, closed: true };
  if (keys.confirm) return { choice, picked: choice.options[choice.at].id, closed: true };
  const size = choice.options.length;
  const at = (choice.at + (keys.down ? 1 : 0) + (keys.up ? size - 1 : 0)) % size;
  return { choice: { ...choice, at }, picked: null, closed: false };
}

const MAX_ROWS = 6;

/** Which rows of a long list are showing, keeping the selected one in view. */
export function visibleRows(size: number, at: number): { first: number; count: number } {
  const count = Math.min(size, MAX_ROWS);
  return { first: Math.max(0, Math.min(at - count + 1, size - count)), count };
}

/** The same box as a conversation, along the bottom of the stage. */
export function drawChoice(ctx: CanvasRenderingContext2D, choice: Choice): void {
  onGui(ctx, () => {
    const { first, count } = visibleRows(choice.options.length, choice.at);
    const height = count * LINE_HEIGHT + 10;
    const top = STAGE_H - height - 12;
    ctx.save();
    ctx.translate(stageX(), viewH - STAGE_H);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(6, top - 1, STAGE_W - 12, height + 2);
    ctx.fillStyle = UI.edge;
    ctx.fillRect(7, top, STAGE_W - 14, height);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(8, top + 1, STAGE_W - 16, height - 2);
    const hintX = STAGE_W - 12 - measureText(CHOICE_HINT);
    ctx.fillRect(hintX - 2, top - 10, measureText(CHOICE_HINT) + 6, 10);
    drawText(ctx, CHOICE_HINT, hintX, top - 9, UI.dim);
    choice.options.slice(first, first + count).forEach((option, i) => {
      const y = top + 5 + i * LINE_HEIGHT;
      const selected = first + i === choice.at;
      if (selected) drawText(ctx, ">", 13, y, UI.accent);
      drawText(ctx, option.label, 22, y, selected ? UI.accent : UI.text);
    });
    // There's more than fits, up or down.
    if (first > 0) drawText(ctx, "^", STAGE_W - 18, top + 4, UI.dim);
    if (first + count < choice.options.length) drawText(ctx, "v", STAGE_W - 18, top + height - 11, UI.dim);
    ctx.restore();
  });
}

export type Menu = {
  readonly active: boolean;
  open(options: ChoiceOption[], pick: (id: string) => void): void;
  update(input: Input): void;
  render(ctx: CanvasRenderingContext2D): void;
};

/** A question on the table, and what picking an answer does. X just closes it. */
export function createMenu(): Menu {
  let current: { choice: Choice; pick: (id: string) => void } | null = null;
  return {
    get active() {
      return current !== null;
    },
    open(options, pick) {
      current = { choice: createChoice(options), pick };
    },
    update(input) {
      if (!current) return;
      const step = stepChoice(current.choice, { up: input.wasPressed("up"), down: input.wasPressed("down"), confirm: input.wasPressed("confirm"), cancel: input.wasPressed("cancel") });
      const { pick } = current;
      current = step.closed ? null : { choice: step.choice, pick };
      if (step.picked) pick(step.picked);
    },
    render(ctx) {
      if (current) drawChoice(ctx, current.choice);
    },
  };
}
