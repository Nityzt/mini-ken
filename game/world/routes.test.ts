import test from "node:test";
import assert from "node:assert/strict";
import { createRunState, type RunState } from "../run-state.ts";
import { destinations, placesBeen, stepsTo } from "./routes.ts";
import { neighbor, routesFrom } from "./map.ts";

const anyRide = () => true;
const noRide = () => false;

test("walking along a road takes one step per stretch, in the right direction", () => {
  const steps = stepsTo("pinecone", "market", [], anyRide);
  assert.deepEqual(steps, [{ kind: "walk", to: "crossroads", dir: "right" }, { kind: "walk", to: "market", dir: "up" }]);
});

test("each step can really be walked or ridden from where the one before ended", () => {
  for (const [from, to] of [["pinecone", "goose"], ["otter", "pinecone"], ["heron", "raccoon"], ["grandArena", "store"]] as const) {
    let at: string = from;
    for (const step of stepsTo(from, to, ["market"], anyRide)!) {
      if (step.kind === "walk") assert.equal(neighbor(at as never, step.dir, ["market"]), step.to);
      else assert.ok(routesFrom(at as never).some((route) => route.to === step.route.to));
      at = step.kind === "walk" ? step.to : step.route.to;
    }
    assert.equal(at, to);
  }
});

test("other districts are reached by riding, and a locked line closes the way", () => {
  const steps = stepsTo("pinecone", "goose", [], anyRide)!;
  assert.ok(steps.some((step) => step.kind === "ride"));
  assert.equal(stepsTo("pinecone", "goose", [], noRide), null);
});

test("a road that needs clearing first isn't used until it's clear", () => {
  assert.equal(stepsTo("stop", "tower", [], anyRide), null);
  assert.equal(stepsTo("stop", "tower", ["market"], anyRide)?.length, 1);
});

test("being where you already are takes no steps", () => {
  assert.deepEqual(stepsTo("goose", "goose", [], anyRide), []);
});

const run = (over: Partial<RunState>): RunState => ({ ...createRunState(), ...over });

test("home always counts as somewhere you've been, and so does anywhere you've won", () => {
  assert.deepEqual(placesBeen(run({})), ["pinecone"]);
  const been = placesBeen(run({ cleared: ["market"], beaten: ["goose", "aki"], visited: ["store"] }));
  for (const place of ["pinecone", "market", "goose", "store"]) assert.ok(been.includes(place as never), place);
  assert.ok(!been.includes("aki" as never));
});

test("a saved place that no longer exists is ignored", () => {
  assert.ok(!placesBeen(run({ visited: ["atlantis"] })).includes("atlantis" as never));
});

test("you can only pick places worth going to, and never the one you're at", () => {
  const list = destinations(run({ node: "radish", visited: ["pinecone", "crossroads", "stop", "store", "radish", "market"], cleared: ["market"] }), anyRide);
  assert.ok(list.includes("pinecone"));
  assert.ok(list.includes("store"));
  assert.ok(list.includes("market"));
  assert.ok(!list.includes("radish"));
  assert.ok(!list.includes("crossroads"));
  assert.ok(!list.includes("stop"));
});

test("the nearest places come first", () => {
  const list = destinations(run({ node: "pinecone", visited: ["goose", "store"] }), anyRide);
  assert.deepEqual(list, ["store", "goose"]);
});

test("a place you can't currently reach isn't offered", () => {
  assert.deepEqual(destinations(run({ node: "pinecone", visited: ["goose", "store"] }), noRide), ["store"]);
});
