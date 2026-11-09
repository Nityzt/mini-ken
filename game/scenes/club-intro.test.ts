import test from "node:test";
import assert from "node:assert/strict";
import { TILE } from "../art/tiles.ts";
import type { TileMap } from "../core/collision.ts";
import { createEscort, findPath, tileOf, type EscortEvents, type Tile } from "./club-intro.ts";
import { CLUB_MAP, CLUB_SOLID, findTiles } from "./levels.ts";
import { createWalker } from "./topdown.ts";

const home = findTiles(CLUB_MAP, "M")[0];
const door = findTiles(CLUB_MAP, "Q")[0];
const rows = CLUB_MAP.map((row) => row.replace("M", "."));
const map: TileMap = { rows, solid: CLUB_SOLID, tile: TILE };

test("a path goes around what's in the way and ends where asked", () => {
  const path = findPath(rows, CLUB_SOLID, { col: 1, row: 3 }, { col: 1, row: 5 }, [{ col: 1, row: 4 }]);
  assert.ok(path);
  assert.deepEqual(path.at(-1), { col: 1, row: 5 });
  assert.ok(!path.some((t) => t.col === 1 && t.row === 4));
  for (const [i, t] of path.entries()) {
    const before: Tile = i === 0 ? { col: 1, row: 3 } : path[i - 1];
    assert.equal(Math.abs(t.col - before.col) + Math.abs(t.row - before.row), 1, "one tile at a time");
    assert.ok(!CLUB_SOLID.includes(rows[t.row][t.col]));
  }
});

test("there is no path into a wall or through a closed door", () => {
  assert.equal(findPath(rows, CLUB_SOLID, { col: 1, row: 2 }, door), null);
  assert.equal(findPath(rows, CLUB_SOLID, { col: 1, row: 2 }, { col: 3, row: 10 }), null);
});

function run(startCol: number, startRow: number) {
  const player = createWalker(startCol, startRow);
  const log: string[] = [];
  const sounds: string[] = [];
  const events: EscortEvents = { arrived: () => log.push("arrived"), opened: () => log.push("opened"), sound: (name) => sounds.push(name) };
  const escort = createEscort({ rows, solid: CLUB_SOLID, player, home, door, events });
  const until = (done: () => boolean, limit = 2000) => {
    for (let i = 0; i < limit && !done(); i++) escort.update(player, map);
    assert.ok(done(), `stuck in ${escort.phase}`);
  };
  return { player, escort, log, sounds, until };
}

for (const [name, col, row] of [["the front door", 8, 2], ["right in front of Momo", 3, 6], ["by the training area", 9, 6]] as const) {
  test(`Momo leads you from ${name} to the storage door, opens it, and goes home`, () => {
    const { player, escort, log, sounds, until } = run(col, row);
    assert.equal(escort.blocking, true);

    until(() => log.length === 1);
    assert.deepEqual(log, ["arrived"]);
    assert.deepEqual(tileOf(escort.momo), { col: door.col, row: door.row - 1 });
    assert.deepEqual(tileOf(player), { col: door.col + 1, row: door.row - 1 });
    assert.equal(escort.door.slide, 0);

    // Nothing happens while they're still talking.
    for (let i = 0; i < 100; i++) escort.update(player, map);
    assert.equal(escort.phase, "arrived");
    escort.proceed();

    until(() => log.length === 2);
    assert.equal(escort.door.slide, 1);
    assert.deepEqual(sounds, ["blocked", "secret"]);
    assert.equal(escort.blocking, true);

    escort.proceed();
    assert.equal(escort.blocking, false);
    until(() => escort.done);
    assert.deepEqual(tileOf(escort.momo), home);
  });
}

test("Momo waits at her spot while someone is standing on it", () => {
  const { player, escort, log, until } = run(8, 2);
  until(() => log.length === 1);
  escort.proceed();
  until(() => log.length === 2);
  escort.proceed();
  const blocker = createWalker(home.col, home.row);
  for (let i = 0; i < 400; i++) escort.update(blocker, map);
  assert.equal(escort.done, false);
  for (let i = 0; i < 5; i++) escort.update(player, map);
  assert.equal(escort.done, true);
});
