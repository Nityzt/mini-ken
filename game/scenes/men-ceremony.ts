import { spriteFor } from "../art/sprite.ts";
import { TILE, TILE_GRIDS } from "../art/tiles.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { drawText, LINE_HEIGHT, measureText } from "../art/font.ts";
import { onGui, viewW } from "../core/scale.ts";
import type { RunState } from "../run-state.ts";
import { MEN_TOAST_OPEN, MEN_TOAST_TITLE, MEN_TOAST_WEAR } from "./content.ts";
import { drawKeycap } from "./ui.ts";

/**
 * Being given your men (owner, issue #12). The senpai reaches into their gi, draws the men out in one
 * hand, and it glows. They walk over and set it on your head, and only then does its card come up.
 */
export type CeremonyBeat = "reach" | "draw" | "glow" | "approach" | "place" | "worn";
export const CEREMONY_BEATS: { beat: CeremonyBeat; ticks: number }[] = [
  { beat: "reach", ticks: 36 },
  { beat: "draw", ticks: 40 },
  { beat: "glow", ticks: 75 },
  { beat: "approach", ticks: 50 },
  { beat: "place", ticks: 45 },
  { beat: "worn", ticks: 40 },
];
export const CEREMONY_TICKS = CEREMONY_BEATS.reduce((sum, { ticks }) => sum + ticks, 0);
/** E can cut it short, but not with the press that closed the line before it. */
export const CEREMONY_SKIP_AFTER = 30;
/** The white burst as the men first catches the light. */
const FLASH_TICKS = 8;
const PULSE_TICKS = 24;

export type Ceremony = { tick: number; done: boolean };
export const createCeremony = (): Ceremony => ({ tick: 0, done: false });

/** One tick on. `skip` is the confirm key, which only counts once the opening press can't be what it is. */
export function stepCeremony(ceremony: Ceremony, skip: boolean): Ceremony {
  if (ceremony.done) return ceremony;
  const tick = ceremony.tick + 1;
  return { tick, done: tick >= CEREMONY_TICKS || (skip && tick > CEREMONY_SKIP_AFTER) };
}

/** Which beat a tick falls in, and how far through it, from 0 to 1. */
export function beatAt(tick: number): { beat: CeremonyBeat; t: number } {
  let start = 0;
  for (const { beat, ticks } of CEREMONY_BEATS) {
    if (tick < start + ticks) return { beat, t: (tick - start) / ticks };
    start += ticks;
  }
  return { beat: "worn", t: 1 };
}

const ease = (t: number) => t * t * (3 - 2 * t);

export type CeremonyFrame = {
  beat: CeremonyBeat;
  /** The men's in the senpai's hand from `draw` until it's on your head. */
  held: boolean;
  /** 0 at the pocket, 1 held up high. */
  lift: number;
  /** How far the senpai has walked over to you, 0 to 1. */
  approach: number;
  /** 0 held up high, 1 sitting on your head. */
  place: number;
  /** How bright the glow is. With reduced motion it's steady, never pulsing. */
  glow: number;
  /** A burst of white as it first glows. Never with reduced motion. */
  flash: boolean;
  /** You've got it on. */
  worn: boolean;
};

/** Everything needed to draw one tick of it. Reduced motion keeps every beat and drops the flash and the pulse. */
export function ceremonyFrame(tick: number, reducedMotion: boolean): CeremonyFrame {
  const { beat, t } = beatAt(tick);
  const order = CEREMONY_BEATS.findIndex((b) => b.beat === beat);
  const after = (name: CeremonyBeat) => order > CEREMONY_BEATS.findIndex((b) => b.beat === name);
  const lift = beat === "draw" ? ease(t) : after("draw") ? 1 : 0;
  const approach = beat === "approach" ? ease(t) : after("approach") ? 1 : 0;
  const place = beat === "place" ? ease(t) : after("place") ? 1 : 0;
  const glowing = beat === "glow" || beat === "approach" || beat === "place";
  const glowTick = beat === "glow" ? Math.round(t * CEREMONY_BEATS[order].ticks) : PULSE_TICKS;
  const pulse = reducedMotion ? 1 : 0.6 + 0.4 * Math.abs(Math.cos((glowTick / PULSE_TICKS) * Math.PI));
  // It fades in at the start of the glow, and out as it settles on your head.
  const fade = beat === "glow" ? Math.min(1, t * 4) : beat === "place" ? 1 - t * 0.5 : 1;
  return {
    beat,
    held: beat !== "reach" && beat !== "worn",
    lift,
    approach,
    place,
    glow: glowing ? (reducedMotion ? 0.6 : pulse * fade) : 0,
    flash: !reducedMotion && beat === "glow" && glowTick < FLASH_TICKS,
    worn: beat === "worn",
  };
}

/** The ceremony only plays for the men, the once. Its tag also lets the dojo know to mention the inventory afterwards. */
export const MEN_CEREMONY_SEEN = "ceremony:men";
export const MEN_TOAST_SEEN = "toast:men";

/** Back home after the ceremony, a note that the men's in your inventory, once, unless you've already put it on. */
export const menToastDue = (run: RunState): boolean =>
  run.gear.men && run.seen.includes(MEN_CEREMONY_SEEN) && !run.seen.includes(MEN_TOAST_SEEN) && !run.menOn;
export const markMenToast = (run: RunState): RunState => (run.seen.includes(MEN_TOAST_SEEN) ? run : { ...run, seen: [...run.seen, MEN_TOAST_SEEN] });

/** How long the note stays, and how long it takes to slide in or out. */
export const TOAST_TICKS = 330;
const TOAST_SLIDE = 14;
/** Under the top bar and the objective line, so it covers neither. */
const TOAST_TOP = 25;

/** How far off the side the note is, from 0 (fully in) to 1 (out of sight). Reduced motion just shows it. */
export function toastSlide(age: number, reducedMotion: boolean): number {
  if (age >= TOAST_TICKS) return 1;
  if (reducedMotion) return 0;
  if (age < TOAST_SLIDE) return 1 - age / TOAST_SLIDE;
  if (age > TOAST_TICKS - TOAST_SLIDE) return (age - (TOAST_TICKS - TOAST_SLIDE)) / TOAST_SLIDE;
  return 0;
}

/** Where things are, on the stage, for drawing a frame. */
export type CeremonyStage = { senpaiX: number; playerX: number; ground: number; headTop: number };

/** The hand and the men, drawn over the fighters. The men is drawn in your own colors, because it's yours. */
export function drawCeremonyProps(ctx: CanvasRenderingContext2D, frame: CeremonyFrame, stage: CeremonyStage, colors: { player: Record<string, string>; senpai: Record<string, string> }, tick: number): void {
  const { senpaiX, playerX, headTop } = stage;
  // The arm comes from the senpai's shoulder on your side. The pocket is the fold of their gi at the chest.
  const shoulder = { x: senpaiX - 3, y: headTop + 13 };
  const pocket = { x: senpaiX - 5, y: headTop + 19 };
  // Held up at arm's length, beside their head, where everyone can see it.
  const raised = { x: senpaiX - 14, y: headTop + 2 };
  // The men sits with its bottom edge at your chin, so the hand holding it ends up there.
  const head = { x: playerX, y: headTop + 12 };
  const reaching = frame.beat === "reach" ? Math.round(2 * Math.abs(Math.sin(tick / 6))) : 0;
  const handX = frame.held ? raised.x + (pocket.x - raised.x) * (1 - frame.lift) : pocket.x + reaching;
  const handY = frame.held ? raised.y + (pocket.y - raised.y) * (1 - frame.lift) : pocket.y;
  // Set down: from up high, across, and down onto your head in a little arc.
  const menX = Math.round(handX + (head.x - handX) * frame.place);
  const menY = Math.round(handY + (head.y - handY) * frame.place - Math.sin(frame.place * Math.PI) * 6);

  if (frame.glow > 0) drawGlow(ctx, menX, menY - 7, frame.glow);
  if (frame.held) {
    const sprite = spriteFor(TILE_GRIDS.iconMen, colors.player);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, menX - TILE / 2, menY - TILE + 1);
  }
  if (frame.beat !== "worn") {
    // One arm, in its sleeve and kote, reaching in or holding the men out by its chin. It lets go once it's on your head.
    drawArm(ctx, shoulder, frame.held ? { x: menX, y: menY } : { x: handX, y: handY }, colors.senpai);
  }
  if (frame.flash) {
    ctx.fillStyle = PALETTE.W;
    ctx.fillRect(menX - 1, menY - 24, 3, 32);
    ctx.fillRect(menX - 16, menY - 9, 33, 3);
  }
}

/** A sleeve from the shoulder to the hand, and a kote on the end of it, outlined so it reads against the armor. */
function drawArm(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, colors: Record<string, string>): void {
  const steps = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y)));
  const along = (i: number) => ({ x: Math.round(from.x + ((to.x - from.x) * i) / steps), y: Math.round(from.y + ((to.y - from.y) * i) / steps) });
  ctx.fillStyle = PALETTE.K;
  for (let i = 0; i <= steps; i++) ctx.fillRect(along(i).x - 2, along(i).y - 2, 4, 4);
  ctx.fillStyle = colors.N ?? PALETTE.N;
  for (let i = 0; i <= steps; i++) ctx.fillRect(along(i).x - 1, along(i).y - 1, 2, 2);
  // The kote: a padded fist, a shade lighter than the sleeve.
  const x = Math.round(to.x);
  const y = Math.round(to.y);
  ctx.fillStyle = PALETTE.K;
  ctx.fillRect(x - 3, y - 2, 6, 5);
  ctx.fillStyle = colors.I ?? PALETTE.I;
  ctx.fillRect(x - 2, y - 1, 4, 3);
  ctx.fillStyle = colors.i ?? PALETTE.i;
  ctx.fillRect(x - 2, y - 1, 2, 1);
}

/**
 * The note at the side of the screen: the men, where to find it, and the keys for it, from your own bindings.
 * It never takes a key press, so walking about carries on underneath it.
 */
export function drawMenToast(ctx: CanvasRenderingContext2D, age: number, reducedMotion: boolean, keys: { pause: string; confirm: string }, playerColors: Record<string, string>): void {
  const slide = toastSlide(age, reducedMotion);
  if (slide >= 1) return;
  onGui(ctx, () => {
    const icon = TILE + 4;
    const hint = measureText(keys.pause) + 5 + 3 + measureText(MEN_TOAST_OPEN) + 8 + measureText(keys.confirm) + 5 + 3 + measureText(MEN_TOAST_WEAR);
    const width = icon + Math.max(measureText(MEN_TOAST_TITLE), hint) + 10;
    const height = 2 * LINE_HEIGHT + 8;
    const x = Math.round(viewW - width - 3 + slide * (width + 6));
    const y = TOAST_TOP;
    ctx.fillStyle = UI.edge;
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = UI.accent;
    ctx.fillRect(x, y, 2, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spriteFor(TILE_GRIDS.iconMen, playerColors), x + 4, y + Math.round((height - TILE) / 2));
    const textX = x + icon + 4;
    drawText(ctx, MEN_TOAST_TITLE, textX, y + 4, UI.accent);
    let hx = textX;
    const hy = y + 4 + LINE_HEIGHT + 1;
    hx += drawKeycap(ctx, keys.pause, hx, hy) + 3;
    drawText(ctx, MEN_TOAST_OPEN, hx, hy + 1, UI.text);
    hx += measureText(MEN_TOAST_OPEN) + 8;
    hx += drawKeycap(ctx, keys.confirm, hx, hy) + 3;
    drawText(ctx, MEN_TOAST_WEAR, hx, hy + 1, UI.text);
  });
}

/** A soft halo in a few rings, each a fat plus, which is about as round as these pixels get. */
function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, amount: number): void {
  const rings: [number, string, number][] = [[17, UI.accent, 0.16], [13, UI.accent, 0.24], [9, PALETTE.W, 0.28]];
  for (const [r, color, alpha] of rings) {
    const short = Math.round(r * 0.6);
    ctx.globalAlpha = alpha * amount;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - r), Math.round(y - short), r * 2, short * 2);
    ctx.fillRect(Math.round(x - short), Math.round(y - r), short * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}
