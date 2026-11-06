import test from "node:test";
import assert from "node:assert/strict";
import { roomWithVisitor } from "./visits.ts";
import { CLUB_HALL_ROWS, CLUB_MAP, CLUB_SOLID, clubRows, findTiles, GOOSE_MAP, HALL_MAP, HALL_SOLID, HERON_MAP, OTTER_MAP, RACCOON_MAP, RIVAL_MAP, RIVAL_SOLID } from "./levels.ts";

/** Which tiles can be reached on foot, moving through anything not listed as solid. */
export function floodFill(rows: string[], solid: string, startCol: number, startRow: number): Set<string> {
  const seen = new Set<string>();
  const stack = [[startCol, startRow]];
  while (stack.length) {
    const [col, row] = stack.pop()!;
    const key = `${col},${row}`;
    if (seen.has(key) || row < 0 || row >= rows.length || col < 0 || col >= rows[0].length) continue;
    if (solid.includes(rows[row][col])) continue;
    seen.add(key);
    stack.push([col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]);
  }
  return seen;
}

/** A tile is reachable to talk to if any tile beside it can be walked on. */
const besideReachable = (seen: Set<string>, col: number, row: number) =>
  [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${col + dx},${row + dy}`));

const START = () => findTiles(CLUB_MAP, "@")[0];
const reachableIn = (rows: string[]) => floodFill(rows, CLUB_SOLID, START().col, START().row);
const key = (char: string, rows = CLUB_MAP) => {
  const [spot] = findTiles(rows, char);
  return `${spot.col},${spot.row}`;
};

test("map rows are all the same width", () => {
  for (const row of CLUB_MAP) assert.equal(row.length, CLUB_MAP[0].length, row);
});

test("the club has one of everything the story needs", () => {
  for (const char of "@MXDQGCU") assert.equal(findTiles(CLUB_MAP, char).length, 1, char);
});

test("Momo guarding the screen keeps you from it, but you can still reach Momo", () => {
  const rows = clubRows({ storageOpen: true, screenBroken: false, momoGuards: true });
  const [screen] = findTiles(rows, "C");
  const [momo] = findTiles(rows, "M");
  assert.equal(findTiles(rows, "M").length, 1);
  assert.equal(besideReachable(reachableIn(rows), screen.col, screen.row), false);
  assert.ok(besideReachable(reachableIn(rows), momo.col, momo.row));
});

test("Momo steps aside once beaten", () => {
  const rows = clubRows({ storageOpen: true, screenBroken: false, momoGuards: false });
  const [screen] = findTiles(rows, "C");
  assert.ok(besideReachable(reachableIn(rows), screen.col, screen.row));
  assert.equal(findTiles(rows, "M")[0].row, findTiles(CLUB_MAP, "M")[0].row);
});

test("all three senpai can be reached from the start", () => {
  const seen = reachableIn(CLUB_MAP);
  for (const char of "ABY") {
    const [spot] = findTiles(CLUB_MAP, char);
    assert.ok(spot, char);
    assert.ok(besideReachable(seen, spot.col, spot.row), char);
  }
});

test("the gear hunt is gone: no armor lies around the club", () => {
  for (const char of "TOHKS") assert.equal(findTiles(CLUB_MAP, char).length, 0, char);
});

test("the map's edge is entirely solid", () => {
  const last = CLUB_MAP.length - 1;
  CLUB_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (y === 0 || y === last || x === 0 || x === row.length - 1) assert.ok(CLUB_SOLID.includes(row[x]), `${x},${y}`);
    }
  });
});

test("Momo, Sensei, the door and the storage door can be reached from the start", () => {
  const seen = reachableIn(CLUB_MAP);
  for (const char of "MXDQ") {
    const [spot] = findTiles(CLUB_MAP, char);
    assert.ok(besideReachable(seen, spot.col, spot.row), char);
  }
});

test("the spare gi can't be reached until the storage room is unlocked", () => {
  assert.equal(reachableIn(CLUB_MAP).has(key("G")), false);
  assert.equal(reachableIn(clubRows({ storageOpen: true, screenBroken: false, momoGuards: false })).has(key("G")), true);
});

test("the tsuba can't be reached until the screen is broken", () => {
  assert.equal(reachableIn(clubRows({ storageOpen: true, screenBroken: false, momoGuards: false })).has(key("U")), false);
  assert.equal(reachableIn(clubRows({ storageOpen: true, screenBroken: true, momoGuards: false })).has(key("U")), true);
});

test("the cracked screen is reachable once storage is open", () => {
  const rows = clubRows({ storageOpen: true, screenBroken: false, momoGuards: false });
  const [screen] = findTiles(rows, "C");
  assert.ok(besideReachable(reachableIn(rows), screen.col, screen.row));
});

test("nothing below the hall shows until storage opens", () => {
  const [door] = findTiles(CLUB_MAP, "Q");
  assert.equal(CLUB_HALL_ROWS, door.row + 1);
  assert.ok(findTiles(CLUB_MAP, "G")[0].row >= CLUB_HALL_ROWS);
});

test("rival dojo has one Ren, two hinting characters and a start, all reachable", () => {
  for (const row of RIVAL_MAP) assert.equal(row.length, RIVAL_MAP[0].length, row);
  for (const char of "RGE@D") assert.equal(findTiles(RIVAL_MAP, char).length, 1, char);
  assert.equal(findTiles(RIVAL_MAP, "C").length, 0, "C draws the club's cracked screen");
  const [start] = findTiles(RIVAL_MAP, "@");
  const seen = floodFill(RIVAL_MAP, RIVAL_SOLID, start.col, start.row);
  for (const char of "RGE") {
    const [spot] = findTiles(RIVAL_MAP, char);
    assert.ok(besideReachable(seen, spot.col, spot.row), char);
  }
});

test("every dojo has a notice board you can walk up to", () => {
  for (const rows of [CLUB_MAP, RIVAL_MAP, GOOSE_MAP, RACCOON_MAP, HERON_MAP, OTTER_MAP]) {
    const boards = findTiles(rows, "N");
    assert.equal(boards.length, 1);
    assert.equal(rows[boards[0].row + 1][boards[0].col], ".", "floor right below it");
  }
  assert.ok(CLUB_SOLID.includes("N"));
  assert.ok(RIVAL_SOLID.includes("N"));
});

test("the panel isn't at home any more, and the hall has one", () => {
  assert.equal(findTiles(CLUB_MAP, "P").length, 0);
  assert.equal(findTiles(HALL_MAP, "P").length, 3);
  for (const row of HALL_MAP) assert.equal(row.length, HALL_MAP[0].length, row);
});

test("the people practicing never get in the way of anything you need", () => {
  const talkTo = (rows: string[], solid: string, chars: string) => {
    const [start] = findTiles(rows, "@");
    const seen = floodFill(rows, solid, start.col, start.row);
    for (const char of chars) for (const spot of findTiles(rows, char)) assert.ok(besideReachable(seen, spot.col, spot.row), `${char} at ${spot.col},${spot.row}`);
  };
  talkTo(clubRows({ storageOpen: true, screenBroken: false, momoGuards: false, visitor: true }), CLUB_SOLID, "MXABYNVDCQ");
  talkTo(clubRows({ storageOpen: false, screenBroken: false, momoGuards: false, visitor: false }), CLUB_SOLID, "MXABYNDQ");
  talkTo(HALL_MAP, HALL_SOLID, "PD");
  for (const room of [CLUB_MAP, RIVAL_MAP, RACCOON_MAP, HERON_MAP, OTTER_MAP, GOOSE_MAP]) assert.equal(findTiles(room, "$").length, 1, "one merch table");
  const home = clubRows({ storageOpen: false, screenBroken: false, momoGuards: false });
  talkTo(home, CLUB_SOLID, "$");
  for (const room of [RIVAL_MAP, RACCOON_MAP, HERON_MAP, OTTER_MAP, GOOSE_MAP]) talkTo(room, RIVAL_SOLID, "$");
  for (const room of [RIVAL_MAP, RACCOON_MAP, HERON_MAP, OTTER_MAP, GOOSE_MAP]) talkTo(roomWithVisitor(room), RIVAL_SOLID, "RGENDV");
  for (const room of [RIVAL_MAP, RACCOON_MAP, HERON_MAP, OTTER_MAP, GOOSE_MAP]) talkTo(roomWithVisitor(room), RIVAL_SOLID, "X");
  talkTo(GOOSE_MAP, RIVAL_SOLID, "J");
  talkTo(HERON_MAP, RIVAL_SOLID, "J");
});
