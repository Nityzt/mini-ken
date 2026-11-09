import test from "node:test";
import assert from "node:assert/strict";
import type { ServerOutcome } from "../net/lobby-client.ts";
import type { OutcomeReason } from "../net/protocol.ts";
import { closedLine, CONNECTION_LOST, historyLine, outcomeLine } from "./online-lines.ts";

const outcome = (winner: ServerOutcome["winner"], reason: OutcomeReason): ServerOutcome => ({ t: "outcome", winner, reason, wins: 0, losses: 0 });

test("every outcome says plainly what happened, from your side", () => {
  assert.equal(outcomeLine(outcome("you", "played"), "Ken"), "You win!");
  assert.equal(outcomeLine(outcome("them", "played"), "Ken"), "You lost");
  assert.match(outcomeLine(outcome("you", "left"), "Ken"), /Ken left/);
  assert.match(outcomeLine(outcome("them", "left"), "Ken"), /You left/);
  assert.match(outcomeLine(outcome("you", "silent"), "Ken"), /Ken went quiet/);
  assert.match(outcomeLine(outcome("them", "silent"), "Ken"), /away too long/);
  for (const reason of ["disagreed", "out-of-step", "unreported", "silent"] as const) assert.match(outcomeLine(outcome(null, reason), "Ken"), /won't count/);
});

test("every way a lobby can close has its own line", () => {
  const reasons = ["expired", "creator-left", "opponent-left", "not-back-in-time", "server", "no-such-lobby", "full", "own-lobby", "lost-connection"] as const;
  const lines = reasons.map((reason) => closedLine(reason));
  assert.equal(new Set(lines).size, reasons.length);
  assert.equal(closedLine("rejected", "Please refresh"), "Please refresh");
});

test("no message would run off the font", () => {
  const printable = /^[\x20-\x7e]+$/;
  for (const reason of ["expired", "not-back-in-time", "no-such-lobby"] as const) assert.match(closedLine(reason), printable);
});

test("history reads as a short line, and what didn't count says so", () => {
  const playedAt = Date.UTC(2026, 10, 6, 12);
  assert.equal(historyLine({ opponent: "Ken", result: "won", reason: "played", playedAt }), `Won   Ken  ${new Date(playedAt).toLocaleDateString("en-CA")}`);
  assert.match(historyLine({ opponent: "Ken", result: "void", reason: "disagreed", playedAt }), /^Didn't count/);
  assert.match(historyLine({ opponent: "Ken", result: "lost", reason: "silent", playedAt }), /^Lost/);
});

test("a lost connection doesn't promise what the server may have recorded", () => {
  assert.doesNotMatch(CONNECTION_LOST, /won't count/);
  assert.match(CONNECTION_LOST, /history/i);
});
