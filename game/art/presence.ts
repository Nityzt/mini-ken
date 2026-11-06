import { guiPoint, onGui, viewW } from "../core/scale.ts";
import { drawText, measureText } from "./font.ts";
import { UI } from "./palette.ts";

const GLOW = "#F6D55C";
const FAINT = "#FFF4B8";
const RISE = 26;
const SPREAD = 11;

/** Tags stay clear of the top bar and the objective line. */
const TAG_TOP = 23;
const TAG_HEIGHT = 9;
/** How far below the spot it's given, in the world's pixels, a tag's bottom edge goes: right over the head. */
const TAG_BOTTOM = 7;

const noise = (a: number, b: number) => (Math.imul(a * 31 + b * 17 + 7, 2654435761) >>> 0) / 4294967296;

/**
 * The air around someone of real rank. It should be easy to miss at first, and hard to ignore on the
 * highest of them: a few motes drifting up, and a faint ring on the floor. `feet` is the sprite's bottom edge.
 */
export function drawPresence(ctx: CanvasRenderingContext2D, centerX: number, feet: number, tick: number, strength: number, reducedMotion: boolean): void {
  if (strength <= 0) return;
  const cx = Math.round(centerX);
  ctx.globalAlpha = 0.14 + strength * 0.2;
  ctx.fillStyle = GLOW;
  const ring = 8 + Math.round(strength * 3);
  for (let dx = -ring; dx <= ring; dx += 2) {
    const dy = Math.round(Math.sqrt(1 - (dx / (ring + 1)) ** 2) * 3);
    ctx.fillRect(cx + dx, feet - 1 - dy, 2, 1);
    ctx.fillRect(cx + dx, feet - 1 + dy, 2, 1);
  }
  ctx.globalAlpha = 0.45 + strength * 0.4;
  const motes = 2 + Math.round(strength * 7);
  const time = reducedMotion ? 37 : tick;
  for (let i = 0; i < motes; i++) {
    const speed = 0.12 + noise(i, 2) * 0.14;
    const height = (time * speed + noise(i, 5) * RISE) % RISE;
    const side = Math.round((noise(i, 9) - 0.5) * 2 * SPREAD);
    ctx.fillStyle = i % 3 === 0 ? FAINT : GLOW;
    ctx.fillRect(cx + side, Math.round(feet - 2 - height), 1, 1);
  }
  ctx.globalAlpha = 1;
}

/** Someone's rank, floating over their head. Serious ranks stand out. */
export function drawRankTag(ctx: CanvasRenderingContext2D, label: string, centerX: number, y: number, senior: boolean): void {
  const at = guiPoint(ctx, centerX, y + TAG_BOTTOM);
  onGui(ctx, () => {
    const width = measureText(label);
    const x = Math.round(Math.max(2, Math.min(viewW - width - 2, at.x - width / 2)));
    const top = Math.round(Math.max(TAG_TOP, at.y - TAG_HEIGHT));
    ctx.fillStyle = UI.panel;
    ctx.fillRect(x - 2, top - 1, width + 4, TAG_HEIGHT);
    drawText(ctx, label, x, top, senior ? UI.accent : UI.dim);
  });
}
