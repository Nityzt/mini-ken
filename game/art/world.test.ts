import test from "node:test";
import assert from "node:assert/strict";
import { MAP_COLORS, PATH_EDGE, PATH_FILL, shaded } from "./world.ts";

const luminance = (hex: string) => {
  const channel = (start: number) => {
    const v = parseInt(hex.slice(start, start + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("the city is darker than it used to be", () => {
  for (const [name, color] of Object.entries(MAP_COLORS)) assert.ok(luminance(shaded(color)) < luminance(color), name);
});

test("shading stays a real color", () => {
  assert.match(shaded("#FFFFFF"), /^#[0-9A-F]{6}$/);
});

test("the path stands out from everything the city puts under it", () => {
  for (const [name, color] of Object.entries(MAP_COLORS)) {
    const ratio = contrast(PATH_FILL, shaded(color));
    assert.ok(ratio >= 3, `${name}: ${ratio.toFixed(2)}`);
  }
});

test("the path's edge separates it from the bright fill", () => {
  assert.ok(contrast(PATH_FILL, PATH_EDGE) >= 7);
});
