import test from "node:test";
import assert from "node:assert/strict";
import * as palette from "./palette.ts";
import { TEAM_COLORS } from "./looks.ts";
import { CHARACTERS } from "../characters.ts";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** A cheap perceptual distance between two colors ("redmean"), good enough to tell armor apart at a glance. */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const r = (r1 + r2) / 2;
  return Math.sqrt((2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2);
}

test("the grading candidates each wear armor nobody else does, so Asa never looks like you (late-game playtest)", () => {
  const candidates = { Asa: palette.ASA_COLORS, Ume: palette.UME_COLORS, Goro: palette.GORO_COLORS };
  const mine = new Set(Object.values(candidates));
  const armor = [
    ...Object.entries(palette).filter(([, colors]) => typeof colors === "object" && colors && "I" in colors && !mine.has(colors as Record<string, string>)).map(([name, colors]) => [name, (colors as Record<string, string>).I] as const),
    ...Object.entries(TEAM_COLORS).map(([crest, colors]) => [`team ${crest}`, colors!.I] as const),
    ...CHARACTERS.map((c) => [`player as ${c.name}`, c.armor.I] as const),
  ];
  for (const [name, colors] of Object.entries(candidates)) {
    for (const [other, color] of armor) assert.ok(distance(colors.I, color) >= 60, `${name} looks like ${other}: ${colors.I} and ${color}`);
    for (const [otherName, others] of Object.entries(candidates)) if (otherName !== name) assert.ok(distance(colors.I, others.I) >= 60, `${name} and ${otherName}`);
  }
});
