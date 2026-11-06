import test from "node:test";
import assert from "node:assert/strict";
import { createTrip, stepTrip, tripProgress, TRIP_SKIP_AFTER, TRIP_TICKS } from "./trip.ts";

test("a trip starts at a stop and heads for the other end of the line", () => {
  const trip = createTrip("stop", "beachStop");
  assert.equal(trip?.from, "stop");
  assert.equal(trip?.to, "beachStop");
  assert.equal(trip?.done, false);
  assert.equal(trip?.mode, "streetcar");
  assert.equal(createTrip("station", "steelStation")?.mode, "train");
});

test("there's no trip from a place without a stop", () => {
  assert.equal(createTrip("market", "beachStop"), null);
  assert.equal(createTrip("stop", "steelStation"), null);
});

test("a trip ends by itself", () => {
  let trip = createTrip("beachStop", "stop")!;
  for (let i = 0; i < TRIP_TICKS - 1; i++) trip = stepTrip(trip, false);
  assert.equal(trip.done, false);
  trip = stepTrip(trip, false);
  assert.equal(trip.done, true);
  assert.equal(trip.to, "stop");
});

test("a trip can be skipped, but not by the press that started it", () => {
  let trip = createTrip("stop", "beachStop")!;
  trip = stepTrip(trip, true);
  assert.equal(trip.done, false);
  for (let i = 0; i < TRIP_SKIP_AFTER; i++) trip = stepTrip(trip, false);
  assert.equal(stepTrip(trip, true).done, true);
});

test("progress runs from the start of the line to the end", () => {
  let trip = createTrip("stop", "beachStop")!;
  assert.equal(tripProgress(trip), 0);
  while (!trip.done) trip = stepTrip(trip, false);
  assert.equal(tripProgress(trip), 1);
});

test("stepping is pure", () => {
  const trip = createTrip("stop", "beachStop")!;
  stepTrip(trip, false);
  assert.equal(trip.ticks, 0);
});
