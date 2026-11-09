import test from "node:test";
import assert from "node:assert/strict";
import { stepSpot, type Spot } from "./return-spot.ts";
import type { SceneName } from "./scene.ts";
import type { NodeId } from "../world/map.ts";

/** Walks through a list of scene changes, saying which arrivals were coming back to where you'd stood. */
function travel(scenes: SceneName[], nodes?: NodeId[]) {
  let spot: Spot = null;
  const back: boolean[] = [];
  for (let i = 1; i < scenes.length; i++) {
    const step = stepSpot(spot, scenes[i - 1], scenes[i], nodes?.[i] ?? "pinecone");
    spot = step.spot;
    back.push(step.returning);
  }
  return back;
}

test("a drill started at home comes back to where you were standing", () => {
  for (const drill of ["training", "line", "kirikaeshi", "duel"] as const) {
    assert.deepEqual(travel(["club", drill, "club"]), [false, true], drill);
  }
});

test("a rival's dojo and the grading hall remember the spot too", () => {
  assert.deepEqual(travel(["rival-dojo", "duel", "rival-dojo"], ["radish", "radish", "radish"]), [false, true]);
  assert.deepEqual(travel(["rival-dojo", "dungeon", "rival-dojo"], ["radish", "radish", "radish"]), [false, true]);
  assert.deepEqual(travel(["grading-hall", "line", "grading-hall"]), [false, true]);
  assert.deepEqual(travel(["grading-hall", "duel", "grading-hall"]), [false, true]);
});

test("a whole cup, match after match, still ends where you signed up", () => {
  assert.deepEqual(travel(["rival-dojo", "tournament", "duel", "tournament", "duel", "tournament", "rival-dojo"], Array(7).fill("radish")), [false, false, false, false, false, true]);
});

test("ending up somewhere other than where you started isn't coming back", () => {
  // A grading bout asked for at a rival dojo, but finished at home.
  assert.deepEqual(travel(["rival-dojo", "duel", "club"], ["radish", "radish", "pinecone"]), [false, false]);
  // The same room, but at another dojo.
  assert.deepEqual(travel(["rival-dojo", "duel", "rival-dojo"], ["radish", "radish", "otter"]), [false, false]);
});

test("coming in off the map is always a fresh arrival", () => {
  assert.deepEqual(travel(["club", "map", "club"]), [false, false]);
  // Even having fought out on the road since.
  assert.deepEqual(travel(["club", "map", "brawl", "map", "club"]), [false, false, false, false]);
  // A drill begun somewhere else doesn't put you anywhere at home.
  assert.deepEqual(travel(["map", "training", "map", "club"]), [false, false, false]);
});

test("a spot is only good for one return", () => {
  assert.deepEqual(travel(["club", "duel", "club", "travel", "club"]), [false, true, false, false]);
});

test("multiplayer isn't a drill, so coming back from it is a fresh arrival", () => {
  assert.deepEqual(travel(["club", "online", "club"]), [false, false]);
});
