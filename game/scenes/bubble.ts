import { guiPoint } from "../core/scale.ts";

/** Someone standing in the world, in interface coordinates. */
export type Figure = { x: number; top: number; bottom: number; half: number };
export type Bubble = { x: number; y: number; w: number; h: number; side: "above" | "below" | "right" | "left"; tail: { x: number; y: number } };

const GAP = 6;
const EDGE = 3;
/** The top bar's there, and whatever's said shouldn't sit on it. */
const TOP = 13;
const TAIL_INSET = 5;

/** "Sensei: Hello" is Sensei talking. Anything else isn't anyone in particular. */
export const speakerOf = (line: string): string | null => /^([^:]{1,20}):/.exec(line)?.[1] ?? null;

/** Where someone drawn at these coordinates is on the interface. Call it while the world's the thing being drawn. */
export function figureAt(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, halfWidth = 8): Figure {
  const head = guiPoint(ctx, x, top);
  const feet = guiPoint(ctx, x + halfWidth, bottom);
  return { x: head.x, top: head.y, bottom: feet.y, half: feet.x - head.x };
}

const clamp = (value: number, low: number, high: number) => (high < low ? (low + high) / 2 : Math.max(low, Math.min(high, value)));

/** Next to whoever's speaking: over them if there's room, and otherwise wherever it doesn't cover anyone. It's always on screen. */
export function placeBubble(size: { w: number; h: number }, speaker: Figure, avoid: Figure[], view: { w: number; h: number }): Bubble {
  const { w, h } = size;
  const centered = Math.round(clamp(speaker.x - w / 2, EDGE, view.w - EDGE - w));
  const level = Math.round(clamp((speaker.top + speaker.bottom - h) / 2, TOP, view.h - EDGE - h));
  const tailX = Math.round(clamp(speaker.x, centered + TAIL_INSET, centered + w - TAIL_INSET));
  const tailY = Math.round(clamp((speaker.top + speaker.bottom) / 2, level + TAIL_INSET, level + h - TAIL_INSET));
  const above = Math.round(speaker.top - GAP - h);
  const below = Math.round(speaker.bottom + GAP);
  const right = Math.round(speaker.x + speaker.half + GAP);
  const left = Math.round(speaker.x - speaker.half - GAP - w);
  const options: Bubble[] = [
    { x: centered, y: above, w, h, side: "above", tail: { x: tailX, y: above + h } },
    { x: centered, y: below, w, h, side: "below", tail: { x: tailX, y: below } },
    { x: right, y: level, w, h, side: "right", tail: { x: right, y: tailY } },
    { x: left, y: level, w, h, side: "left", tail: { x: left + w, y: tailY } },
  ];
  const fits = (b: Bubble) => b.x >= 0 && b.x + b.w <= view.w && b.y >= Math.min(TOP, view.h - h) && b.y + b.h <= view.h;
  const covers = (b: Bubble, f: Figure) => b.x < f.x + f.half && b.x + b.w > f.x - f.half && b.y < f.bottom && b.y + b.h > f.top;
  const clear = options.find((b) => fits(b) && !avoid.some((f) => covers(b, f)));
  if (clear) return clear;
  // Nowhere's free, so at least the one speaking stays in the open, if that's possible.
  const spare = options.find((b) => fits(b) && !covers(b, speaker)) ?? options.find(fits);
  if (spare) return spare;
  const y = Math.round(clamp(above, 0, view.h - h));
  return { x: centered, y, w, h, side: "above", tail: { x: tailX, y: y + h } };
}

/**
 * Who a room's lines belong to. A name nobody here goes by, or a line with no name at all, goes to whoever you're
 * talking to, and failing that to you.
 */
export function speakersIn(figures: Record<string, Figure | undefined>, names: Record<string, string>, you: Figure, talkingTo: string | null): { at(name: string | null): Figure; avoid: Figure[] } {
  return {
    at: (name) => (name ? figures[names[name]] : undefined) ?? (talkingTo ? figures[talkingTo] : undefined) ?? you,
    avoid: [you],
  };
}
