import test from "node:test";
import assert from "node:assert/strict";
import { rivalConfig } from "../duel/rival.ts";
import { DOJOS, DOJO_SENSEIS, type DojoId } from "../world/dojos.ts";
import { createRunState } from "../run-state.ts";
import { inspectDojo, senseiNote } from "./sensei-notes.ts";

test("each rival dojo hides a rereadable note at an actual rack or plant", () => {
  for (const id of Object.keys(DOJOS) as DojoId[]) {
    const note = ["r", "p"].map((tile) => ({ tile, lines: senseiNote(id, tile) })).find(({ lines }) => lines !== null);
    assert.ok(note, id);
    assert.ok(DOJOS[id].room.some((row) => row.includes(note.tile)), id);
    assert.deepEqual(senseiNote(id, note.tile), note.lines);
    assert.equal(senseiNote(id, "W"), null);
  }
});

test("a note sharing a stash keeps the reward and remains readable afterwards", () => {
  const start = createRunState();
  const first = inspectDojo(start, "goose", "p")!;
  assert.equal(first.foundStash, true);
  assert.ok(first.run.money > start.money);
  assert.ok(first.lines.length > 1);
  const again = inspectDojo(first.run, "goose", "p")!;
  assert.equal(again.foundStash, false);
  assert.equal(again.run.money, first.run.money);
  assert.deepEqual(again.lines, senseiNote("goose", "p"));
  assert.equal(inspectDojo(start, "goose", "W"), null);
});

test("the senseis have distinctive attack and defensive habits", () => {
  const config = (id: keyof typeof DOJO_SENSEIS) => rivalConfig(0, DOJO_SENSEIS[id].style);
  assert.ok(config("kan").habits.filter((x) => x === "bigMen").length >= 3);
  assert.ok(config("nemu").tell.kote > config("mizu").tell.kote);
  assert.ok(config("nemu").habits.filter((x) => x === "kote").length > config("nemu").habits.filter((x) => x === "men").length);
  assert.ok((config("hagane").parry ?? 0) > (config("kan").parry ?? 0));
  assert.ok(config("mizu").habitMin < config("hagane").habitMin);
  assert.ok(config("raiko").openingMix! > config("kan").openingMix!);
});
