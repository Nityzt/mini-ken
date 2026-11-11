import test from "node:test";
import assert from "node:assert/strict";
import { STAGE_W } from "../core/scale.ts";
import { createTournament, recordMatch } from "../world/tournament.ts";
import { bracketLayout } from "./tournament.ts";

const overlaps = (a: { x: number; y: number; w: number }, b: { x: number; y: number; w: number }) => a.x - 2 < b.x + b.w + 2 && b.x - 2 < a.x + a.w + 2 && Math.abs(a.y - b.y) < 10;

test("a loss shows on the bracket: whoever lost a match is struck out, you included (late-game playtest)", () => {
  const start = createTournament("grand", 7, "Haru");
  const won = recordMatch(start, true);
  const { slots } = bracketLayout(won.rounds);
  const first = slots.filter((slot) => slot.round === 0);
  assert.equal(first.filter((slot) => slot.state === "out").length, 4);
  assert.equal(first.find((slot) => slot.player)!.state, "in");
  // Losing ends your cup before the round's played out, so you're the one struck out.
  const lost = recordMatch(won, false);
  const after = bracketLayout(lost.rounds, "you").slots.filter((slot) => slot.round === 1);
  assert.equal(after.find((slot) => slot.player)!.state, "out");
  assert.equal(after.filter((slot) => slot.state === "out").length, 1);
});

test("the champion's place waits over the final, and fills in when someone wins", () => {
  for (const cup of ["pinecone", "grand"] as const) {
    let t = createTournament(cup, 3, "Haru");
    const empty = bracketLayout(t.rounds).champion;
    assert.equal(empty.state, "open");
    while (t.status === "playing") t = recordMatch(t, true);
    const { slots, champion } = bracketLayout(t.rounds);
    assert.equal(champion.name, "Haru");
    assert.equal(champion.player, true);
    assert.ok(champion.x >= 0 && champion.x + champion.w <= STAGE_W);
    for (const slot of slots) assert.ok(!overlaps(slot, champion), `${cup}: ${slot.name} under the champion`);
    // The final's loser is struck out too.
    assert.equal(slots.filter((slot) => slot.round === Math.log2(t.rounds[0].length) - 1 && slot.state === "out").length, 1);
  }
});
