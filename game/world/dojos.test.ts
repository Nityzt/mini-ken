import { wrapText } from "../art/font.ts";
import { DIALOGUE_LINES, DIALOGUE_WIDTH } from "../scenes/content.ts";
import { PEOPLE } from "../scenes/chatter-lines.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { measureText } from "../art/font.ts";
import { STAGE_W } from "../core/scale.ts";
import { findTiles } from "../scenes/levels.ts";
import { DOJOS, dojoFor, MEMBERS, opponentById, type DojoId, type MemberId } from "./dojos.ts";
import { NODES, type NodeId } from "./map.ts";
import { CHARACTERS } from "../characters.ts";
import { personDan } from "../ranks.ts";
import { arrivalLine } from "./dojos.ts";

const IDS = Object.keys(DOJOS) as DojoId[];

function floodFill(rows: string[], solid: string, startCol: number, startRow: number): Set<string> {
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

test("every dojo on the map other than home has a rival in it", () => {
  for (const id of Object.keys(NODES) as NodeId[]) {
    if (NODES[id].kind === "dojo" && id !== "pinecone") assert.ok(DOJOS[id as DojoId], id);
  }
  for (const id of IDS) assert.equal(NODES[id].kind, "dojo", id);
});

test("each dojo's name matches the map", () => {
  for (const id of IDS) assert.equal(DOJOS[id].name, NODES[id].name);
});

test("no two rivals share a name, a crest or colors", () => {
  assert.equal(new Set(IDS.map((id) => DOJOS[id].rival)).size, IDS.length);
  assert.equal(new Set(IDS.map((id) => DOJOS[id].crest)).size, IDS.length);
  assert.equal(new Set(IDS.map((id) => DOJOS[id].colors)).size, IDS.length);
});

test("every room has one rival, two helpers, a start and a way out, all reachable", () => {
  for (const id of IDS) {
    const { room, solid } = DOJOS[id];
    for (const row of room) assert.equal(row.length, room[0].length, row);
    for (const char of "RGE@D") assert.equal(findTiles(room, char).length, 1, `${id} ${char}`);
    assert.equal(findTiles(room, "C").length, 0, "C draws the club's cracked screen");
    const [start] = findTiles(room, "@");
    const seen = floodFill(room, solid, start.col, start.row);
    for (const char of "RGE") {
      const [spot] = findTiles(room, char);
      const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${spot.col + dx},${spot.row + dy}`));
      assert.ok(beside, `${id} ${char}`);
    }
  }
});

test("the rival's helpers hint at habits without spelling out the counters", () => {
  for (const id of IDS) {
    for (const line of [PEOPLE[DOJOS[id].helperIds.G].advice[0], PEOPLE[DOJOS[id].helperIds.E].advice[0]]) assert.equal(/\b(kote|do)\b/i.test(line), false, line);
  }
});

test("there are five rival dojos", () => {
  assert.equal(IDS.length, 5);
});

test("a duel's dojo follows where you're standing", () => {
  for (const id of IDS) assert.equal(dojoFor(id), id);
});

test("anyone can be looked up by id", () => {
  assert.equal(opponentById("momo").rival, "Momo");
  assert.equal(opponentById("aki").rival, "Aki");
  assert.equal(opponentById("heron").rival, DOJOS.heron.rival);
});

test("development jumps from anywhere else face Ren", () => {
  assert.equal(dojoFor("pinecone"), "radish");
});

test("what happens after you beat a dojo's head fits in the box", () => {
  for (const id of IDS) assert.ok(wrapText(DOJOS[id].winLines[0], DIALOGUE_WIDTH).length <= DIALOGUE_LINES, DOJOS[id].winLines[0]);
});

test("every rival dojo has a sensei of its own, senior to everyone else there", () => {
  const taken = [...IDS.map((id) => DOJOS[id].rival), ...Object.values(MEMBERS).map((member) => member.rival), ...CHARACTERS.map((c) => c.name), "Kuma", "Momo", "Aki", "Bo", "Yui", "Gen", "Ono", "Asa", "Ume", "Goro", "Nao", "Riku"];
  const names = IDS.map((id) => DOJOS[id].sensei.name);
  assert.equal(new Set(names).size, IDS.length);
  for (const name of names) assert.ok(!taken.includes(name), name);
  for (const id of IDS) {
    const { sensei } = DOJOS[id];
    assert.ok(PEOPLE[sensei.id].small.every((line) => line.startsWith(`Sensei ${sensei.name}:`)), id);
    assert.ok(personDan(sensei.id) > personDan(id), id);
    for (const member of Object.keys(MEMBERS) as MemberId[]) if (MEMBERS[member].home === id) assert.ok(personDan(sensei.id) > personDan(member), member);
  }
});

test("every dojo's a little different each time you walk in", () => {
  for (const id of IDS) {
    const lines = new Set<string>();
    for (let roll = 0; roll < 1; roll += 0.05) lines.add(arrivalLine(DOJOS[id], roll));
    assert.ok(lines.size >= 3, id);
    assert.ok(lines.has(DOJOS[id].arrival[0]), id);
  }
});
