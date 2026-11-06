import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, GLYPH_HEIGHT, drawText, measureText, wrapText } from "./font.ts";

/** Records the pixels text would light up. */
function recorder() {
  const pixels: [number, number, number][] = [];
  const ctx = { fillStyle: "", fillRect: (x: number, y: number, size: number) => pixels.push([x, y, size]) } as unknown as CanvasRenderingContext2D;
  return { ctx, pixels };
}

test('measureText("") is 0', () => {
  assert.equal(measureText(""), 0);
});

test("measureText has no trailing gap", () => {
  assert.equal(measureText("A"), 5);
  assert.equal(measureText("AB"), 11);
});

test("narrow letters take less room than wide ones", () => {
  assert.equal(measureText("i"), 3);
  assert.equal(measureText("l"), 3);
  assert.ok(measureText("ill") < measureText("MMM"));
  assert.ok(measureText("!") < measureText("M"));
});

test("digits all take the same room, so counters don't jump around", () => {
  const widths = new Set("0123456789".split("").map((digit) => measureText(digit)));
  assert.deepEqual([...widths], [5]);
});

test("a space is narrower than a letter", () => {
  assert.ok(measureText("a b") - measureText("ab") < measureText("a"));
  assert.ok(measureText("a b") > measureText("ab"));
});

test("drawn text covers exactly what was measured", () => {
  for (const text of ["Pinecone Dojo", "Hill", "M", "go!"]) {
    const { ctx, pixels } = recorder();
    drawText(ctx, text, 0, 0, "#000");
    const xs = pixels.map(([x]) => x);
    assert.equal(Math.min(...xs), 0, text);
    assert.equal(Math.max(...xs) + 1, measureText(text), text);
  }
});

test("scaled text is that much bigger, and lands on whole pixels", () => {
  const { ctx, pixels } = recorder();
  drawText(ctx, "Hi", 3.4, 2.6, "#000", 2);
  assert.ok(pixels.every(([x, y, size]) => Number.isInteger(x) && Number.isInteger(y) && size === 2));
  assert.equal(Math.max(...pixels.map(([x]) => x)) + 2 - 3, measureText("Hi") * 2);
});

test("every glyph has the same height", () => {
  for (const [char, rows] of Object.entries(GLYPHS)) assert.equal(rows.length, GLYPH_HEIGHT, char);
});

test("the font covers letters, digits and common punctuation", () => {
  for (const char of "ABCXYZabcxyz0189 .,!?:'\"-/()+>") assert.ok(GLYPHS[char], char);
});

test("wrapText never exceeds maxWidth", () => {
  const text = "Shinai: four bamboo slats tied together. Never step over one!";
  for (const width of [60, 120, 296]) {
    for (const line of wrapText(text, width)) assert.ok(measureText(line) <= width, line);
  }
});

test("wrapText fills each line as far as it really fits", () => {
  const lines = wrapText("ill ill ill ill ill ill ill ill", 60);
  assert.ok(measureText(`${lines[0]} ill`) > 60, lines[0]);
});

test("wrapText keeps every word in order", () => {
  const text = "Men: the helmet and face grille.";
  assert.equal(wrapText(text, 60).join(" "), text);
});

test("wrapText splits a word too long for the line", () => {
  for (const line of wrapText("Supercalifragilistic", 30)) assert.ok(measureText(line) <= 30);
});
