import test from "node:test";
import assert from "node:assert/strict";
import { FULL_GEAR, NO_GEAR } from "../art/kendoka.ts";
import { TILE } from "../art/tiles.ts";
import type { TileMap } from "../core/collision.ts";
import { DOJOS } from "../world/dojos.ts";
import { tileOf } from "./club-intro.ts";
import { CLUB_MAP, CLUB_SOLID, findTiles, HALL_MAP, HALL_SOLID } from "./levels.ts";
import { createEntrance, createStride, createVisit, dressingAt, DRESSING_TICKS, facingToward, gainedGear, personAhead } from "./moves.ts";
import { createWalker, type Walker } from "./topdown.ts";
import { roomWithVisitor } from "./visits.ts";

const walkerAt = (col: number, row: number, facing: Walker["facing"], flip = false): Walker => ({ ...createWalker(col, row), facing, flip });
const PEOPLE = "MXABYV";
const momo = findTiles(CLUB_MAP, "M")[0];

test("you can see someone from a little way off, along the way you're facing", () => {
  for (const distance of [1, 2, 3]) {
    const ahead = personAhead(walkerAt(momo.col + distance, momo.row, "side", true), CLUB_MAP, CLUB_SOLID, PEOPLE);
    assert.equal(ahead?.char, "M", `${distance} tiles off`);
    assert.deepEqual(ahead?.stand, { col: momo.col + 1, row: momo.row });
  }
});

test("not too far, not facing away, and not through a wall", () => {
  assert.equal(personAhead(walkerAt(momo.col + 4, momo.row, "side", true), CLUB_MAP, CLUB_SOLID, PEOPLE), null);
  assert.equal(personAhead(walkerAt(momo.col + 2, momo.row, "side", false), CLUB_MAP, CLUB_SOLID, PEOPLE), null);
  const rows = ["#####", "#M#.#", "#####"];
  assert.equal(personAhead(walkerAt(3, 1, "side", true), rows, "#M", "M"), null);
  assert.equal(personAhead(walkerAt(1, 1, "up"), rows, "#M", "M"), null);
});

test("only people count, not whoever's practicing or the furniture", () => {
  assert.equal(personAhead(walkerAt(5, 2, "up"), CLUB_MAP, CLUB_SOLID, PEOPLE), null);
});

test("walking up to anyone in the club ends right in front of them, still facing them", () => {
  const map: TileMap = { rows: CLUB_MAP, solid: CLUB_SOLID, tile: TILE };
  for (const char of ["M", "X", "A", "B", "Y"]) {
    const spot = findTiles(CLUB_MAP, char)[0];
    for (const [dc, dr, facing, flip] of [[3, 0, "side", true], [-3, 0, "side", false], [0, 2, "up", false], [0, -2, "down", false]] as const) {
      const from = { col: spot.col + dc, row: spot.row + dr };
      if (CLUB_SOLID.includes(CLUB_MAP[from.row]?.[from.col] ?? "#")) continue;
      const walker = walkerAt(from.col, from.row, facing, flip);
      const ahead = personAhead(walker, CLUB_MAP, CLUB_SOLID, PEOPLE);
      if (ahead?.char !== char) continue;
      const stride = createStride(walker, ahead.stand);
      let ticks = 0;
      while (!stride.update(walker, map)) assert.ok(++ticks < 80, `${char} from ${from.col},${from.row}`);
      assert.deepEqual(tileOf(walker), ahead.stand);
      assert.equal(walker.facing, facing);
      assert.equal(walker.flip, flip);
      assert.equal(walker.moving, false);
    }
  }
});

test("people turn to whoever they're talking to", () => {
  assert.deepEqual(facingToward({ x: 50, y: 50 }, { x: 10, y: 52 }), { facing: "side", flip: true });
  assert.deepEqual(facingToward({ x: 50, y: 50 }, { x: 90, y: 52 }), { facing: "side", flip: false });
  assert.deepEqual(facingToward({ x: 50, y: 50 }, { x: 52, y: 90 }), { facing: "down", flip: false });
  assert.deepEqual(facingToward({ x: 50, y: 50 }, { x: 52, y: 10 }), { facing: "up", flip: false });
});

const rooms = [
  { name: "club", rows: CLUB_MAP, solid: CLUB_SOLID },
  { name: "hall", rows: HALL_MAP, solid: HALL_SOLID },
  ...Object.values(DOJOS).map((dojo) => ({ name: dojo.name, rows: roomWithVisitor(dojo.room).map((row) => row.replace("V", ".")), solid: dojo.solid })),
];

function runVisit(rows: string[], solid: string, player: Walker) {
  const door = findTiles(rows, "D")[0];
  const visit = createVisit({ rows, solid, start: door, door, player });
  let ticks = 0;
  while (visit.phase === "coming") {
    visit.update(player);
    assert.ok(++ticks < 2000, "never arrived");
  }
  return { visit };
}

test("someone arriving walks in the door and ends up next to you, on open floor, wherever you're standing", () => {
  for (const { name, rows, solid } of rooms) {
    rows.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        if (solid.includes(line[col])) continue;
        const player = walkerAt(col, row, "down");
        const { visit } = runVisit(rows, solid, player);
        const at = tileOf(visit.walker);
        assert.equal(Math.abs(at.col - col) + Math.abs(at.row - row), 1, `${name}: at ${at.col},${at.row} for ${col},${row}`);
        assert.ok(!solid.includes(rows[at.row][at.col]), `${name}: standing in ${rows[at.row][at.col]}`);
      }
    });
  }
});

test("they face each other once they get there", () => {
  const player = walkerAt(8, 5, "up");
  const { visit } = runVisit(CLUB_MAP, CLUB_SOLID, player);
  assert.equal(visit.phase, "talking");
  const at = tileOf(visit.walker);
  assert.deepEqual(facingToward({ x: player.box.x, y: player.box.y }, { x: at.col * TILE + 3, y: at.row * TILE + 8 }), { facing: player.facing, flip: player.flip });
  assert.deepEqual(facingToward({ x: at.col * TILE + 3, y: at.row * TILE + 8 }, { x: player.box.x, y: player.box.y }), { facing: visit.walker.facing, flip: visit.walker.flip });
});

test("the player stays put until they've finished talking, then they can move", () => {
  const player = walkerAt(8, 5, "up");
  const { visit } = runVisit(CLUB_MAP, CLUB_SOLID, player);
  assert.equal(visit.blocking, true);
  visit.leave({ col: 6, row: 3 });
  assert.equal(visit.blocking, false);
});

test("afterwards they go to their spot, or back out the door", () => {
  for (const to of [{ col: 6, row: 3 }, findTiles(CLUB_MAP, "D")[0]]) {
    const player = walkerAt(8, 5, "up");
    const { visit } = runVisit(CLUB_MAP, CLUB_SOLID, player);
    visit.leave(to);
    let ticks = 0;
    while (!visit.done) {
      visit.update(player);
      assert.ok(++ticks < 2000, "never got there");
    }
    assert.deepEqual(tileOf(visit.walker), to);
  }
});

test("someone already in the room just walks over", () => {
  const player = walkerAt(8, 5, "up");
  const start = { col: 6, row: 3 };
  const visit = createVisit({ rows: CLUB_MAP, solid: CLUB_SOLID, start, door: findTiles(CLUB_MAP, "D")[0], player });
  assert.deepEqual(tileOf(visit.walker), start);
  while (visit.phase === "coming") visit.update(player);
  assert.equal(visit.phase, "talking");
});

test("someone done talking can leave without having walked anywhere", () => {
  const player = walkerAt(8, 5, "up");
  const start = { col: 6, row: 3 };
  const door = findTiles(CLUB_MAP, "D")[0];
  const visit = createVisit({ rows: CLUB_MAP, solid: CLUB_SOLID, start, door, player, alreadyHere: true });
  assert.equal(visit.phase, "talking");
  visit.leave(door);
  while (!visit.done) visit.update(player);
  assert.deepEqual(tileOf(visit.walker), door);
});

test("you step in through the door and end up where you always started", () => {
  for (const { name, rows } of rooms) {
    const door = findTiles(rows, "D")[0];
    const start = findTiles(rows, "@")[0];
    const walker = createWalker(start.col, start.row);
    const entrance = createEntrance(walker, door, start, { rows, solid: "", tile: TILE });
    assert.deepEqual(tileOf(walker), door, name);
    let ticks = 0;
    while (!entrance.update()) assert.ok(++ticks < 200, name);
    const end = createWalker(start.col, start.row).box;
    assert.deepEqual([walker.box.x, walker.box.y], [end.x, end.y], name);
    assert.equal(walker.moving, false);
  }
});

test("changing clothes spins you round, and the new clothes appear partway, once", () => {
  let flips = 0;
  let last = dressingAt(0, false);
  const turns = new Set<string>();
  assert.equal(last.changed, false);
  for (let t = 1; t <= DRESSING_TICKS; t++) {
    const frame = dressingAt(t, false);
    if (frame.changed !== last.changed) flips++;
    turns.add(frame.facing);
    last = frame;
  }
  assert.equal(flips, 1);
  assert.equal(last.changed, true);
  assert.equal(last.done, true);
  assert.deepEqual([...turns].sort(), ["down", "side", "up"]);
});

test("the clothes held up at the start are put away before the change", () => {
  assert.ok(dressingAt(2, false).held);
  assert.ok(!dressingAt(DRESSING_TICKS - 1, false).held);
});

test("with reduced motion nothing spins, hops or flies about, but you still change", () => {
  let changed = false;
  for (let t = 0; t <= DRESSING_TICKS; t++) {
    const frame = dressingAt(t, true);
    assert.equal(frame.facing, "down");
    assert.equal(frame.hop, 0);
    assert.equal(frame.puffs, false);
    changed ||= frame.changed;
  }
  assert.ok(changed);
  assert.ok(dressingAt(DRESSING_TICKS, true).done);
});

test("only something new counts as getting dressed", () => {
  assert.equal(gainedGear(NO_GEAR, { ...NO_GEAR, tare: true }), true);
  assert.equal(gainedGear(FULL_GEAR, FULL_GEAR), false);
  assert.equal(gainedGear(FULL_GEAR, NO_GEAR), false, "a new game isn't undressing");
});
