import test from "node:test";
import assert from "node:assert/strict";
import { placeBubble, speakerOf, type Figure } from "./bubble.ts";

const view = { w: 512, h: 288 };
const box = { w: 200, h: 40 };
const figure = (x: number, top: number): Figure => ({ x, top, bottom: top + 40, half: 16 });
const hits = (b: { x: number; y: number; w: number; h: number }, f: Figure) =>
  b.x < f.x + f.half && b.x + b.w > f.x - f.half && b.y < f.bottom && b.y + b.h > f.top;

test("a line says who's speaking, and anything else is narration", () => {
  assert.equal(speakerOf("Senpai Momo: Hello there."), "Senpai Momo");
  assert.equal(speakerOf("A spare gi and hakama. A little big."), null);
  assert.equal(speakerOf("Well, here's a thought that runs on a long way: and then stops."), null);
});

test("a bubble sits right over whoever's speaking, with its tail at them", () => {
  const speaker = figure(256, 150);
  const b = placeBubble(box, speaker, [speaker], view);
  assert.equal(b.side, "above");
  assert.ok(b.y + b.h <= speaker.top);
  assert.ok(speaker.top - (b.y + b.h) < 12, "and close by");
  assert.equal(b.x + b.w / 2, 256);
  assert.equal(b.tail.x, 256);
});

test("with no room above, it goes below", () => {
  const speaker = figure(256, 20);
  const b = placeBubble(box, speaker, [speaker], view);
  assert.equal(b.side, "below");
  assert.ok(b.y >= speaker.bottom);
});

test("it doesn't cover you, if you're standing where it'd go", () => {
  const speaker = figure(256, 150);
  const you = figure(256, 100);
  const b = placeBubble(box, speaker, [speaker, you], view);
  assert.ok(!hits(b, speaker));
  assert.ok(!hits(b, you));
});

test("wherever anyone stands, it's always fully on screen, and the tail's on the bubble", () => {
  for (const [w, h] of [[512, 288], [256, 144], [640, 200]]) {
    for (let x = 0; x <= w; x += 16) {
      for (let top = 0; top <= h; top += 16) {
        const speaker = figure(x, top);
        const b = placeBubble(box, speaker, [speaker], { w, h });
        assert.ok(b.x >= 0 && b.x + b.w <= w, `x at ${x},${top} in ${w}x${h}`);
        assert.ok(b.y >= 0 && b.y + b.h <= h, `y at ${x},${top} in ${w}x${h}`);
        if (b.side === "above" || b.side === "below") assert.ok(b.tail.x >= b.x && b.tail.x <= b.x + b.w);
        else assert.ok(b.tail.y >= b.y && b.tail.y <= b.y + b.h);
      }
    }
  }
});

test("a bubble wider than the window still fits as best it can", () => {
  const speaker = figure(100, 80);
  const b = placeBubble({ w: 238, h: 40 }, speaker, [speaker], { w: 256, h: 144 });
  assert.ok(b.x >= 0 && b.x + b.w <= 256);
});
