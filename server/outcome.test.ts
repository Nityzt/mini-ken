import test from "node:test";
import assert from "node:assert/strict";
import { decideOutcome, type Facts } from "./outcome.ts";

const facts = (partial: Partial<Facts>): Facts => ({ reports: [null, null], left: null, silent: [false, false], waitExpired: false, ...partial });

test("both reporting the same winner settles it", () => {
  assert.deepEqual(decideOutcome(facts({ reports: ["won", "lost"] })), { done: true, winner: 0, reason: "played" });
  assert.deepEqual(decideOutcome(facts({ reports: ["lost", "won"] })), { done: true, winner: 1, reason: "played" });
});

test("disagreeing doesn't count", () => {
  assert.deepEqual(decideOutcome(facts({ reports: ["won", "won"] })), { done: true, winner: null, reason: "disagreed" });
  assert.deepEqual(decideOutcome(facts({ reports: ["lost", "lost"] })), { done: true, winner: null, reason: "disagreed" });
});

test("either side falling out of step doesn't count, straight away", () => {
  assert.deepEqual(decideOutcome(facts({ reports: ["void", null] })), { done: true, winner: null, reason: "out-of-step" });
  assert.deepEqual(decideOutcome(facts({ reports: ["won", "void"] })), { done: true, winner: null, reason: "out-of-step" });
});

test("leaving during a match loses it", () => {
  assert.deepEqual(decideOutcome(facts({ left: 1 })), { done: true, winner: 0, reason: "left" });
  assert.deepEqual(decideOutcome(facts({ left: 0 })), { done: true, winner: 1, reason: "left" });
});

test("going silent loses it, and both going silent doesn't count", () => {
  assert.deepEqual(decideOutcome(facts({ silent: [false, true] })), { done: true, winner: 0, reason: "silent" });
  assert.deepEqual(decideOutcome(facts({ silent: [true, false] })), { done: true, winner: 1, reason: "silent" });
  assert.deepEqual(decideOutcome(facts({ silent: [true, true] })), { done: true, winner: null, reason: "silent" });
});

test("one report stands if the other player disconnects before reporting", () => {
  assert.deepEqual(decideOutcome(facts({ reports: ["won", null], left: 1 })), { done: true, winner: 0, reason: "played" });
  assert.deepEqual(decideOutcome(facts({ reports: ["lost", null], left: 1 })), { done: true, winner: 1, reason: "played" });
});

test("reporting and then leaving still waits for the other player's report", () => {
  assert.deepEqual(decideOutcome(facts({ reports: ["won", null], left: 0 })), { done: false });
  assert.deepEqual(decideOutcome(facts({ reports: ["won", "lost"], left: 0 })), { done: true, winner: 0, reason: "played" });
});

test("refusing to report can't win or lose a match", () => {
  assert.deepEqual(decideOutcome(facts({ reports: ["won", null] })), { done: false });
  assert.deepEqual(decideOutcome(facts({ reports: ["won", null], waitExpired: true })), { done: true, winner: null, reason: "unreported" });
  assert.deepEqual(decideOutcome(facts({ reports: [null, "lost"], waitExpired: true })), { done: true, winner: null, reason: "unreported" });
});

test("a match nobody's finished goes on", () => {
  assert.deepEqual(decideOutcome(facts({})), { done: false });
});
