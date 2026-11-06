import { drawText, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import type { Input } from "../core/input.ts";
import { onGui, STAGE_H, STAGE_W, stageX, viewH } from "../core/scale.ts";
import { DIALOGUE_LINES, DIALOGUE_WIDTH } from "./content.ts";

const BOX_HEIGHT = DIALOGUE_LINES * LINE_HEIGHT + 10;
const BOX_TOP = STAGE_H - BOX_HEIGHT - 12;

export type Dialogue = {
  readonly active: boolean;
  /** What X says it will do. */
  readonly cancelHint: string;
  /** `onCancel` runs instead of `onDone` when X closes it. With neither, X just closes it. */
  open(lines: string[], onDone?: () => void, onCancel?: () => void): void;
  update(input: Input): void;
  render(ctx: CanvasRenderingContext2D): void;
};

/** One page of text at a time. Confirm finishes the typing, then moves on. X closes it, and backs out of whatever it led to. */
export function createDialogue(): Dialogue {
  let pages: string[][] = [];
  let page = 0;
  let shown = 0;
  let tick = 0;
  let onDone: (() => void) | undefined;
  let onCancel: (() => void) | undefined;

  const hintText = () => (onDone && !onCancel ? "X back out" : "X skip");
  const pageLength = () => pages[page].reduce((sum, line) => sum + line.length, 0);

  return {
    get active() {
      return pages.length > 0;
    },
    get cancelHint() {
      return hintText();
    },
    open(lines, done, cancel) {
      pages = lines.map((line) => wrapText(line, DIALOGUE_WIDTH));
      page = 0;
      shown = 0;
      onDone = done;
      onCancel = cancel;
    },
    update(input) {
      if (!pages.length) return;
      tick++;
      if (shown < pageLength()) shown++;
      if (input.wasPressed("cancel")) {
        pages = [];
        const cancel = onCancel;
        onDone = undefined;
        onCancel = undefined;
        cancel?.();
        return;
      }
      if (!input.wasPressed("confirm")) return;
      if (shown < pageLength()) {
        shown = pageLength();
      } else if (++page >= pages.length) {
        pages = [];
        const done = onDone;
        onDone = undefined;
        onCancel = undefined;
        done?.();
      } else {
        shown = 0;
      }
    },
    render(ctx) {
      if (!pages.length) return;
      onGui(ctx, () => {
        // As wide as the stage, whatever the window, and always along the bottom of it.
        ctx.save();
        ctx.translate(stageX(), viewH - STAGE_H);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(6, BOX_TOP - 1, STAGE_W - 12, BOX_HEIGHT + 2);
        ctx.fillStyle = UI.edge;
        ctx.fillRect(7, BOX_TOP, STAGE_W - 14, BOX_HEIGHT);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(8, BOX_TOP + 1, STAGE_W - 16, BOX_HEIGHT - 2);
        const hint = `E next   ${hintText()}`;
        const hintX = STAGE_W - 12 - measureText(hint);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(hintX - 2, BOX_TOP - 10, measureText(hint) + 6, 10);
        drawText(ctx, hint, hintX, BOX_TOP - 9, UI.dim);
        let left = shown;
        // Whoever's speaking stands out from what they say.
        const speaker = /^[^:]{1,20}:/.exec(pages[page][0])?.[0].length ?? 0;
        pages[page].forEach((line, i) => {
          const y = BOX_TOP + 5 + i * LINE_HEIGHT;
          const typed = line.slice(0, Math.max(0, left));
          drawText(ctx, typed, 13, y, UI.text);
          if (i === 0 && speaker) drawText(ctx, typed.slice(0, speaker), 13, y, UI.accent);
          left -= line.length;
        });
        if (shown >= pageLength() && Math.floor(tick / 20) % 2 === 0) {
          ctx.fillStyle = UI.accent;
          ctx.fillRect(STAGE_W - 18, BOX_TOP + BOX_HEIGHT - 8, 5, 2);
          ctx.fillRect(STAGE_W - 17, BOX_TOP + BOX_HEIGHT - 6, 3, 1);
          ctx.fillRect(STAGE_W - 16, BOX_TOP + BOX_HEIGHT - 5, 1, 1);
        }
        ctx.restore();
      });
    },
  };
}
