import test from "node:test";
import assert from "node:assert/strict";
import { DIRECTIONS, DISTRICTS, EDGES, exitsFrom, GANGS, neighbor, nodesIn, NODES, routesFrom, TOWER_HEIGHT, type NodeId } from "./map.ts";
import { createHallTrip } from "./trip.ts";

const ALL = Object.keys(NODES) as NodeId[];
const reachable = (cleared: string[]) => {
  const seen = new Set<NodeId>(["pinecone"]);
  const stack: NodeId[] = ["pinecone"];
  while (stack.length) {
    const at = stack.pop()!;
    const nexts = [...DIRECTIONS.map((dir) => neighbor(at, dir, cleared)), ...routesFrom(at).map((r) => r.to)];
    for (const next of nexts) {
      if (next && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
};

test("the two dojos are on the map", () => {
  assert.equal(NODES.pinecone.kind, "dojo");
  assert.equal(NODES.radish.kind, "dojo");
});

test("you can walk from dojo to dojo without clearing a single gang", () => {
  assert.ok(reachable([]).has("radish"));
});

test("every path goes both ways", () => {
  for (const at of ALL) {
    for (const dir of DIRECTIONS) {
      const next = neighbor(at, dir, Object.keys(GANGS));
      if (!next) continue;
      const opposite = { left: "right", right: "left", up: "down", down: "up" } as const;
      assert.equal(neighbor(next, opposite[dir], Object.keys(GANGS)), at, `${at} ${dir}`);
    }
  }
});

test("a direction on the map points the way it looks", () => {
  for (const at of ALL) {
    for (const dir of DIRECTIONS) {
      const next = neighbor(at, dir, Object.keys(GANGS));
      if (!next) continue;
      const dx = NODES[next].x - NODES[at].x;
      const dy = NODES[next].y - NODES[at].y;
      if (dir === "left") assert.ok(dx < 0, `${at} ${dir}`);
      if (dir === "right") assert.ok(dx > 0, `${at} ${dir}`);
      if (dir === "up") assert.ok(dy < 0, `${at} ${dir}`);
      if (dir === "down") assert.ok(dy > 0, `${at} ${dir}`);
    }
  }
});

test("every place can be reached once everything is cleared", () => {
  const seen = reachable(Object.keys(GANGS));
  for (const id of ALL) assert.ok(seen.has(id), id);
});

test("every gang is a node, and every gang node has a gang", () => {
  for (const id of ALL) {
    if (NODES[id].kind === "gang") assert.ok(GANGS[id], id);
  }
  for (const id of Object.keys(GANGS)) assert.equal(NODES[id as NodeId].kind, "gang", id);
});

test("the tower's path stays hidden until its gang is gone", () => {
  assert.equal(reachable([]).has("tower"), false);
  const locked = EDGES.filter((e) => e.requires);
  assert.equal(locked.length, 1);
  assert.ok(reachable([locked[0].requires!]).has("tower"));
});

test("it's laid out like a lakeside city", () => {
  assert.equal(NODES.tower.kind, "tower");
  // The tower and the harbour stand on the waterfront, south of the main road.
  for (const id of ["tower", "wharf"] as const) assert.ok(NODES[id].y > NODES.crossroads.y + 40, id);
  // The two dojos are out at either end of the main road.
  assert.ok(NODES.pinecone.x < NODES.crossroads.x);
  assert.ok(NODES.radish.x > NODES.bridge.x);
  assert.equal(NODES.pinecone.y, NODES.radish.y);
});

test("the tower can stand tall without covering the main road", () => {
  assert.ok(NODES.tower.y - TOWER_HEIGHT > NODES.crossroads.y);
});

test("exits list only the ways you can actually go", () => {
  assert.deepEqual(exitsFrom("pinecone", []), ["right"]);
  assert.equal(exitsFrom("stop", []).includes("right"), false);
  assert.equal(exitsFrom("stop", ["market"]).includes("right"), true);
});

test("most bullies are unarmed, and every gang outnumbers you", () => {
  const all = Object.values(GANGS).flat();
  assert.ok(all.filter((b) => b.kind === "fist").length > all.filter((b) => b.kind === "stick").length);
  for (const gang of Object.values(GANGS)) assert.ok(gang.length >= 3);
});

test("everything fits on the screen, clear of the top and bottom bars", () => {
  for (const id of ALL) {
    assert.ok(NODES[id].x >= 12 && NODES[id].x <= 244, id);
    assert.ok(NODES[id].y >= 22 && NODES[id].y <= 122, id);
  }
});

test("the streetcar stop is open from the very start", () => {
  assert.equal(neighbor("crossroads", "down", []), "stop");
  assert.equal(NODES.stop.kind, "stop");
});

test("the streetcar runs in two directions from downtown", () => {
  assert.deepEqual(routesFrom("stop").map((r) => r.to).sort(), ["beachStop", "parkStop"]);
  assert.ok(routesFrom("stop").every((r) => r.mode === "streetcar"));
});

test("the commuter train goes to two other cities and the tournament", () => {
  assert.equal(NODES.station.kind, "station");
  assert.deepEqual(routesFrom("station").map((r) => r.to).sort(), ["arenaStation", "fallsStation", "steelStation"]);
  assert.ok(routesFrom("station").every((r) => r.mode === "train"));
});

test("every ride has a way back", () => {
  for (const id of ALL) {
    for (const route of routesFrom(id)) {
      const back = routesFrom(route.to).find((r) => r.to === id);
      assert.ok(back, `${route.to} back to ${id}`);
      assert.equal(back.mode, route.mode, id);
      assert.notEqual(back.east, route.east, `${id}: there and back go opposite ways`);
    }
  }
});

test("you can only catch a ride at a stop or a station, and only the right kind", () => {
  for (const id of ALL) {
    const { kind } = NODES[id];
    assert.equal(routesFrom(id).length > 0, kind === "stop" || kind === "station", id);
    for (const route of routesFrom(id)) assert.equal(route.mode, kind === "stop" ? "streetcar" : "train", id);
  }
});

test("rides go to another district, and walking never does", () => {
  for (const id of ALL) {
    for (const route of routesFrom(id)) assert.notEqual(NODES[route.to].district, NODES[id].district, id);
    for (const dir of DIRECTIONS) {
      const next = neighbor(id, dir, Object.keys(GANGS));
      if (next) assert.equal(NODES[next].district, NODES[id].district, `${id} ${dir}`);
    }
  }
});

test("there are at least five dojos to visit, for the tournament to make sense", () => {
  const rivals = ALL.filter((id) => NODES[id].kind === "dojo" && id !== "pinecone");
  assert.ok(rivals.length >= 5, String(rivals));
});

test("the tournament has a place of its own", () => {
  assert.equal(NODES.grandArena.kind, "tournament");
  assert.equal(NODES.grandArena.district, "arena");
  assert.ok(reachable([]).has("grandArena"));
});

test("every district has a way in and out", () => {
  for (const district of DISTRICTS) {
    if (district === "downtown") continue;
    assert.ok(nodesIn(district).some((id) => routesFrom(id).length > 0), district);
  }
});

test("every dojo can be reached without fighting anyone", () => {
  const seen = reachable([]);
  for (const id of ALL) if (NODES[id].kind === "dojo") assert.ok(seen.has(id), id);
});

test("each district lists only its own places", () => {
  assert.ok(nodesIn("beach").includes("goose"));
  assert.ok(!nodesIn("beach").includes("radish"));
  assert.ok(nodesIn("downtown").includes("radish"));
  assert.equal(DISTRICTS.reduce((sum, d) => sum + nodesIn(d).length, 0), ALL.length);
});

test("no two places in a district sit on top of each other", () => {
  for (const district of DISTRICTS) {
    const places = nodesIn(district);
    for (const a of places) for (const b of places) {
      if (a !== b) assert.ok(Math.hypot(NODES[a].x - NODES[b].x, NODES[a].y - NODES[b].y) >= 20, `${a} ${b}`);
    }
  }
});

test("the hermit who teaches seme lives on Ravine Trail, and can be reached without fighting", () => {
  assert.equal(NODES.ravine.kind, "master");
  assert.ok(reachable([]).has("ravine"));
});

test("the ride to the grading hall isn't on the map: it starts where you are and comes back there", () => {
  const there = createHallTrip("goose", "there");
  assert.equal(there.from, "goose");
  assert.equal(there.to, "goose");
  assert.equal(there.hall, "there");
  assert.equal(there.mode, "train");
  assert.equal(createHallTrip("goose", "back").east, !there.east);
});

test("the store is on the map, on foot, and past the gang on Market Street", () => {
  assert.equal(NODES.store.kind, "store");
  assert.ok(reachable([]).has("store"));
});
