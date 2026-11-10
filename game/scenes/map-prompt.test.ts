import test from "node:test";
import assert from "node:assert/strict";
import { createRunState, recordTower } from "../run-state.ts";
import { promptAt } from "./map.ts";

test("the tower only offers the ride up until you've been", () => {
  const run = createRunState();
  assert.match(promptAt("tower", run), /ride to the top/);
  const been = recordTower(run);
  assert.doesNotMatch(promptAt("tower", been), /ride to the top/);
  assert.match(promptAt("tower", been), /view/);
});
