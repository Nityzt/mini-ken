import { drawText, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import type { GameAudio } from "../core/audio.ts";
import { babble, type Syllable } from "../core/babble.ts";
import type { Input } from "../core/input.ts";
import { instructionText, keyLabel } from "../core/key-labels.ts";
import { onGui, STAGE_H, STAGE_W, stageX, viewH, viewW } from "../core/scale.ts";
import { placeBubble, speakerOf, type Bubble, type Figure } from "./bubble.ts";
import { DIALOGUE_LINES, DIALOGUE_WIDTH, fillName } from "./content.ts";
import { voiceOf } from "./voices.ts";

const BOX_HEIGHT = DIALOGUE_LINES * LINE_HEIGHT + 10;
const BOX_TOP = STAGE_H - BOX_HEIGHT - 12;
const PADDING = 5;
const TAIL = 4;

/** Who's in the room, so that what's said can be said next to them. */
export type SpeakerStage = {
  /** Whoever goes by this name, or who a line with no name should be next to. Null puts it along the bottom. */
  at(name: string | null): Figure | null;
  /** Whoever shouldn't be covered up. */
  avoid: Figure[];
};

export type Dialogue = {
  readonly active: boolean;
  /** What X says it will do. */
  readonly cancelHint: string;
  /** `onCancel` runs instead of `onDone` when X closes it. With neither, X just closes it. */
  open(lines: string[], onDone?: () => void, onCancel?: () => void): void;
  /** With audio, whoever's speaking talks as the words appear. */
  update(input: Input, audio?: Pick<GameAudio, "say">): void;
  render(ctx: CanvasRenderingContext2D, stage?: SpeakerStage): void;
};

function drawTail(ctx: CanvasRenderingContext2D, bubble: Bubble): void {
  const { tail, side } = bubble;
  for (let i = 0; i < TAIL; i++) {
    const reach = TAIL - i;
    const color = i === TAIL - 1 ? UI.edge : UI.panel;
    ctx.fillStyle = color;
    if (side === "above" || side === "below") ctx.fillRect(tail.x - reach + 1, side === "above" ? tail.y + i : tail.y - 1 - i, reach * 2 - 1, 1);
    else ctx.fillRect(side === "right" ? tail.x - 1 - i : tail.x + i, tail.y - reach + 1, 1, reach * 2 - 1);
  }
}

/** One page of text at a time. Confirm finishes the typing, then moves on. X closes it, and backs out of whatever it led to. Anyone speaking can use your name. */
export function createDialogue(nameOf: () => string = () => "you"): Dialogue {
  let pages: string[][] = [];
  let sourceLines: string[] = [];
  let page = 0;
  let shown = 0;
  let tick = 0;
  let onDone: (() => void) | undefined;
  let onCancel: (() => void) | undefined;

  let keys = {} as Input;
  const hintText = () => `${keyLabel(keys, "cancel", "x")} ${onDone && !onCancel ? "back out" : "skip"}`;
  const pageLength = () => pages[page].reduce((sum, line) => sum + line.length, 0);
  let speech: Syllable[] = [];
  let spoken = 0;
  /** The speaker's name is only a label, so what's said starts after it. */
  const startPage = () => {
    shown = 0;
    spoken = 0;
    const voice = voiceOf(speakerOf(pages[page][0]));
    const named = /^[^:]{1,20}:/.exec(pages[page][0])?.[0].length ?? 0;
    speech = voice ? babble(pages[page].join(""), voice, named) : [];
  };

  return {
    get active() {
      return pages.length > 0;
    },
    get cancelHint() {
      return hintText();
    },
    open(lines, done, cancel) {
      sourceLines = lines.map((line) => fillName(line, nameOf()));
      pages = sourceLines.map((line) => wrapText(instructionText(keys, line), DIALOGUE_WIDTH));
      page = 0;
      startPage();
      onDone = done;
      onCancel = cancel;
    },
    update(input, audio) {
      if (!pages.length) return;
      keys = input;
      pages = sourceLines.map((line) => wrapText(instructionText(keys, line), DIALOGUE_WIDTH));
      tick++;
      if (shown < pageLength()) {
        shown++;
        if (speech[spoken]?.at === shown - 1) audio?.say(speech[spoken++]);
      }
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
        startPage();
      }
    },
    render(ctx, stage) {
      if (!pages.length) return;
      onGui(ctx, () => {
        const figure = stage?.at(speakerOf(pages[page][0]));
        if (stage && figure) {
          // Next to whoever's talking, and just big enough for what they're saying.
          const hint = `${keyLabel(keys, "confirm", "e")} next   ${hintText()}`;
          const w = Math.max(measureText(hint), ...pages[page].map(measureText)) + PADDING * 2;
          const h = (pages[page].length + 1) * LINE_HEIGHT + PADDING + 3;
          const bubble = placeBubble({ w, h }, figure, [figure, ...stage.avoid], { w: viewW, h: viewH });
          ctx.fillStyle = UI.edge;
          ctx.fillRect(bubble.x, bubble.y, w, h);
          ctx.fillStyle = UI.panel;
          ctx.fillRect(bubble.x + 1, bubble.y + 1, w - 2, h - 2);
          drawTail(ctx, bubble);
          let typedLeft = shown;
          const named = /^[^:]{1,20}:/.exec(pages[page][0])?.[0].length ?? 0;
          pages[page].forEach((line, i) => {
            const y = bubble.y + PADDING - 1 + i * LINE_HEIGHT;
            const typed = line.slice(0, Math.max(0, typedLeft));
            drawText(ctx, typed, bubble.x + PADDING, y, UI.text);
            if (i === 0 && named) drawText(ctx, typed.slice(0, named), bubble.x + PADDING, y, UI.accent);
            typedLeft -= line.length;
          });
          const hintY = bubble.y + h - LINE_HEIGHT;
          drawText(ctx, hint, bubble.x + w - PADDING - measureText(hint), hintY, UI.dim);
          if (shown >= pageLength() && Math.floor(tick / 20) % 2 === 0) {
            ctx.fillStyle = UI.accent;
            ctx.fillRect(bubble.x + PADDING, hintY + 2, 5, 2);
            ctx.fillRect(bubble.x + PADDING + 1, hintY + 4, 3, 1);
            ctx.fillRect(bubble.x + PADDING + 2, hintY + 5, 1, 1);
          }
          return;
        }
        // As wide as the stage, whatever the window, and always along the bottom of it.
        ctx.save();
        ctx.translate(stageX(), viewH - STAGE_H);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(6, BOX_TOP - 1, STAGE_W - 12, BOX_HEIGHT + 2);
        ctx.fillStyle = UI.edge;
        ctx.fillRect(7, BOX_TOP, STAGE_W - 14, BOX_HEIGHT);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(8, BOX_TOP + 1, STAGE_W - 16, BOX_HEIGHT - 2);
        const hint = `${keyLabel(keys, "confirm", "e")} next   ${hintText()}`;
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
