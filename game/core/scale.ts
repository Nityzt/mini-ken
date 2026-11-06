/** The part of the world every scene is laid out for. Whatever the window's shape, all of it is on screen. */
export const STAGE_W = 256;
export const STAGE_H = 144;

/** How much the window actually shows, in game pixels. It's never smaller than the stage, and it changes with the window. */
export let viewW = STAGE_W;
export let viewH = STAGE_H;

/** The two pixel sizes in use, in device pixels, and how much room the interface gets at its own size. */
type Layers = { world: number; gui: number; guiW: number; guiH: number };
let layers: Layers = { world: 1, gui: 1, guiW: STAGE_W, guiH: STAGE_H };
let inGui = false;

export function setView(width: number, height: number, next?: Layers): void {
  viewW = width;
  viewH = height;
  layers = next ?? { world: 1, gui: 1, guiW: width, guiH: height };
}

/** Where the stage sits inside the view. It's kept in the middle, with the extra world around it. */
export const stageX = (): number => Math.floor((viewW - STAGE_W) / 2);
export const stageY = (): number => Math.floor((viewH - STAGE_H) / 2);

/** Draws in the stage's own coordinates. Anything that doesn't need to reach the window's edges belongs here. */
export function onStage(ctx: CanvasRenderingContext2D, draw: () => void): void {
  ctx.save();
  ctx.translate(stageX(), stageY());
  draw();
  ctx.restore();
}

/**
 * Draws the interface: text, panels, menus and bars. Its pixels are finer than the world's, so it takes up
 * less of the screen. The view reads as the interface's own while this runs, so `viewW`, `onStage` and the
 * rest all work as usual, and a layout made for the stage simply comes out smaller.
 */
export function onGui(ctx: CanvasRenderingContext2D, draw: () => void): void {
  if (inGui) {
    draw();
    return;
  }
  const [width, height] = [viewW, viewH];
  ctx.save();
  ctx.setTransform(layers.gui, 0, 0, layers.gui, 0, 0);
  viewW = layers.guiW;
  viewH = layers.guiH;
  inGui = true;
  try {
    draw();
  } finally {
    inGui = false;
    viewW = width;
    viewH = height;
    ctx.restore();
  }
}

/** Where a spot in the current drawing space lands in interface coordinates, for labels that follow someone around. */
export function guiPoint(ctx: CanvasRenderingContext2D, x: number, y: number): { x: number; y: number } {
  const m = ctx.getTransform();
  return { x: (m.a * x + m.e) / layers.gui, y: (m.d * y + m.f) / layers.gui };
}

export type CanvasFit = Layers & {
  /** How many game pixels the window shows. */
  viewW: number;
  viewH: number;
  /** The canvas's real size, in device pixels. */
  canvasW: number;
  canvasH: number;
  /** The size on the page. It can overhang the window by part of a game pixel, so the pixels stay square. */
  width: number;
  height: number;
};

const CLOSE_ENOUGH = 1e-6;
/** Smaller than this and text stops being comfortable to read, so the interface stops shrinking first. */
const SMALLEST_GUI_PIXEL = 2;

/** The interface's pixel size for a given world pixel: about half, and never so small it's hard to read. */
export const guiPixelFor = (world: number): number => Math.min(world, Math.max(SMALLEST_GUI_PIXEL, Math.floor(world / 2)));

/**
 * Fills any window. The world is scaled up by the largest whole number that still shows the stage, and the
 * view grows along whichever sides have room left, so a different window shape shows more of the world
 * rather than empty bars. Whole numbers mean every game pixel covers the same real pixels, with no blur.
 */
export function fitView(windowW: number, windowH: number, dpr: number): CanvasFit {
  const deviceW = windowW * dpr;
  const deviceH = windowH * dpr;
  const room = Math.min(deviceW / STAGE_W, deviceH / STAGE_H);
  const world = Math.max(1, Math.floor(room + CLOSE_ENOUGH));
  const gui = guiPixelFor(world);
  // A window too small for the stage is the one time the browser has to shrink the canvas.
  const shrink = Math.min(1, room);
  const width = Math.ceil(deviceW / (world * shrink) - CLOSE_ENOUGH);
  const height = Math.ceil(deviceH / (world * shrink) - CLOSE_ENOUGH);
  const canvasW = width * world;
  const canvasH = height * world;
  return {
    viewW: width,
    viewH: height,
    world,
    gui,
    guiW: Math.ceil(canvasW / gui),
    guiH: Math.ceil(canvasH / gui),
    canvasW,
    canvasH,
    width: (canvasW * shrink) / dpr,
    height: (canvasH * shrink) / dpr,
  };
}
