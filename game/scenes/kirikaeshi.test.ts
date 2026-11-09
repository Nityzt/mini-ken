import test from "node:test";
import assert from "node:assert/strict";
import { STAGE_W } from "../core/scale.ts";
import { KI_BAR_LIMIT } from "../duel/hud.ts";
import { KIRIKAESHI_SEQUENCE } from "../duel/kirikaeshi.ts";
import { markLayout } from "./kirikaeshi.ts";

test("the set's marks never run into the ki bar or off the screen, even at the smallest size with the biggest bar", () => {
  for (const width of [STAGE_W, 300, 384, 512, 900]) {
    for (const kiWidth of [60, 80, KI_BAR_LIMIT]) {
      const { left, stride } = markLayout(width, kiWidth);
      assert.ok(left > 5 + kiWidth, `${width}/${kiWidth}: starts at ${left}`);
      assert.ok(left + KIRIKAESHI_SEQUENCE.length * stride <= width - 4, `${width}/${kiWidth}: ends past the edge`);
      assert.ok(stride >= 4, "and each mark is still big enough to see");
    }
  }
});

test("with room to spare, the marks sit in the middle at full size", () => {
  const { left, stride } = markLayout(512, 60);
  assert.equal(stride, 7);
  assert.equal(left, Math.round((512 - KIRIKAESHI_SEQUENCE.length * 7) / 2));
});
