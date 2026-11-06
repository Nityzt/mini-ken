import test from "node:test";
import assert from "node:assert/strict";
import { STAGE_H, STAGE_W, fitView, guiPixelFor, guiPoint, onGui, onStage, setView, stageX, stageY, viewH, viewW } from "./scale.ts";

const applied = (fit: ReturnType<typeof fitView>) => setView(fit.viewW, fit.viewH, fit);

/** Just enough of a canvas to follow its transform. */
function fakeCtx() {
  let m = { a: 1, d: 1, e: 0, f: 0 };
  const stack: (typeof m)[] = [];
  return {
    save: () => stack.push({ ...m }),
    restore: () => {
      m = stack.pop()!;
    },
    setTransform: (a: number, _b: number, _c: number, d: number, e: number, f: number) => {
      m = { a, d, e, f };
    },
    translate: (x: number, y: number) => {
      m = { ...m, e: m.e + x * m.a, f: m.f + y * m.d };
    },
    getTransform: () => ({ ...m, b: 0, c: 0 }),
  } as unknown as CanvasRenderingContext2D;
}

test("the world is drawn at the largest whole size that still shows the stage", () => {
  assert.equal(fitView(1920, 1080, 1).world, 7);
  assert.equal(fitView(1920, 950, 1).world, 6);
  assert.equal(fitView(1280, 720, 1).world, 5);
  assert.equal(fitView(1280, 720, 2).world, 10);
});

test("the interface's pixels are about half the world's, however big the window", () => {
  assert.deepEqual([3, 4, 5, 6, 7, 8, 10, 12].map(guiPixelFor), [2, 2, 2, 3, 3, 4, 5, 6]);
});

test("in a very small window the interface stops shrinking, so text stays legible", () => {
  assert.equal(guiPixelFor(2), 2);
  assert.equal(guiPixelFor(1), 1);
});

test("the interface never has less room than the stage, at any size", () => {
  for (const [w, h, dpr] of [[1920, 1080, 1], [1920, 950, 1], [1366, 657, 1], [1000, 700, 1], [800, 1200, 1], [640, 360, 2], [333, 777, 1], [5120, 1440, 1], [2560, 1300, 1.25]]) {
    const fit = fitView(w, h, dpr);
    assert.ok(fit.guiW >= STAGE_W && fit.guiH >= STAGE_H, `${w}x${h} squeezes the interface`);
    assert.ok(fit.guiW >= fit.viewW && fit.guiH >= fit.viewH, `${w}x${h} gives the interface less room than the world`);
  }
});

test("every game pixel covers whole device pixels, so nothing is ever blurred", () => {
  for (const [w, h, dpr] of [[1920, 950, 1], [1707, 860, 1.5], [2560, 1300, 1.25], [1366, 657, 1]]) {
    const fit = fitView(w, h, dpr);
    assert.equal(fit.canvasW, fit.viewW * fit.world);
    assert.equal(fit.canvasH, fit.viewH * fit.world);
    assert.ok(Number.isInteger(fit.world) && Number.isInteger(fit.gui));
    assert.ok(fit.guiW * fit.gui >= fit.canvasW && fit.guiH * fit.gui >= fit.canvasH);
  }
});

test("a window that isn't a whole multiple shows a little more world instead of stretching", () => {
  const fit = fitView(1920, 950, 1);
  assert.equal(fit.viewW, 320);
  assert.equal(fit.viewH, 159);
});

test("a wider window shows more of the world instead of side bars", () => {
  const fit = fitView(3440, 1440, 1);
  assert.equal(fit.viewW, 344);
  assert.equal(fit.viewH, STAGE_H);
});

test("a taller window shows more above and below instead of top and bottom bars", () => {
  const fit = fitView(900, 1400, 1);
  assert.equal(fit.viewW, 300);
  assert.ok(fit.viewH > STAGE_H);
});

test("any window is covered completely, the whole stage always fits, and the overhang is under one game pixel", () => {
  for (const [w, h, dpr] of [[1000, 700, 1], [800, 1200, 1], [1366, 657, 1], [2560, 1300, 1.25], [1707, 860, 1.5], [640, 360, 2], [333, 777, 1], [5120, 1440, 1]]) {
    const fit = fitView(w, h, dpr);
    assert.ok(fit.width >= w - 1e-6 && fit.height >= h - 1e-6, `${w}x${h} leaves a gap`);
    assert.ok(fit.viewW >= STAGE_W && fit.viewH >= STAGE_H, `${w}x${h} hides part of the stage`);
    const pixel = fit.width / fit.viewW;
    assert.ok(Math.abs(pixel - fit.height / fit.viewH) < 1e-6, `${w}x${h} stretches pixels`);
    assert.ok(fit.width - w < pixel && fit.height - h < pixel, `${w}x${h} overhangs`);
  }
});

test("a tiny window still shows the whole stage", () => {
  const fit = fitView(128, 72, 1);
  assert.equal(fit.width, 128);
  assert.equal(fit.viewW, STAGE_W);
  assert.equal(fit.world, 1);
});

test("the stage stays centered as the view changes", () => {
  setView(344, 200);
  assert.equal(viewW, 344);
  assert.equal(viewH, 200);
  assert.equal(stageX(), 44);
  assert.equal(stageY(), 28);
  setView(STAGE_W, STAGE_H);
  assert.equal(stageX(), 0);
  assert.equal(stageY(), 0);
});

test("inside the interface layer, the view is the interface's own, and it comes back afterwards", () => {
  applied(fitView(1920, 950, 1));
  const ctx = fakeCtx();
  let seen: number[] = [];
  onGui(ctx, () => {
    seen = [viewW, viewH, stageX(), ctx.getTransform().a];
  });
  assert.deepEqual(seen, [640, 318, 192, 3]);
  assert.deepEqual([viewW, viewH], [320, 159]);
  setView(STAGE_W, STAGE_H);
});

test("the interface layer ignores whatever the world had moved the canvas by", () => {
  applied(fitView(1920, 950, 1));
  const ctx = fakeCtx();
  ctx.setTransform(6, 0, 0, 6, 0, 0);
  ctx.translate(32, 7);
  onGui(ctx, () => assert.equal(ctx.getTransform().e, 0));
  assert.equal(ctx.getTransform().e, 192);
  setView(STAGE_W, STAGE_H);
});

test("opening the interface layer twice doesn't scale it twice", () => {
  applied(fitView(1920, 950, 1));
  const ctx = fakeCtx();
  onGui(ctx, () => onGui(ctx, () => assert.deepEqual([viewW, ctx.getTransform().a], [640, 3])));
  setView(STAGE_W, STAGE_H);
});

test("a spot in the world maps to the same place on the screen in interface coordinates", () => {
  applied(fitView(1920, 950, 1));
  const ctx = fakeCtx();
  ctx.setTransform(6, 0, 0, 6, 0, 0);
  ctx.translate(32, 7);
  assert.deepEqual(guiPoint(ctx, 10, 20), { x: 84, y: 54 });
  setView(STAGE_W, STAGE_H);
});

test("the stage can be used inside the interface layer, to center a menu", () => {
  applied(fitView(1920, 950, 1));
  const ctx = fakeCtx();
  onGui(ctx, () => onStage(ctx, () => assert.deepEqual(guiPoint(ctx, 0, 0), { x: 192, y: 87 })));
  setView(STAGE_W, STAGE_H);
});
