import test from "node:test";
import assert from "node:assert/strict";
import { tipFor } from "./tips.ts";

test("each tip matches its scoring situation", () => {
  assert.equal(tipFor({ by: 1, attack: "men", defenderStance: "guard" }), "Their hands rise before they strike. Try kote.");
  assert.equal(tipFor({ by: 1, attack: "kote", defenderStance: "guard" }), "Their shinai tip dips before a kote. Their men is open.");
  assert.equal(tipFor({ by: 1, attack: "bigMen", defenderStance: "guard" }), "When they raise their hands high, their do is open.");
  assert.equal(tipFor({ by: 1, attack: "quickMen", defenderStance: "recovery" }), "That miss left you open. Wait for an opening.");
  assert.equal(tipFor({ by: 1, attack: "quickMen", defenderStance: "broken" }), "Blocking costs ki. Too much and your guard breaks.");
});

test("being hit while powering up gets its own tip", () => {
  assert.equal(tipFor({ by: 1, attack: "men", defenderStance: "seme" }), "Your aura leaves you wide open. Watch for the tell and let go.");
});

test("the fighter's state explains a hit before the attack does", () => {
  assert.equal(tipFor({ by: 1, attack: "men", defenderStance: "recovery" }), "That miss left you open. Wait for an opening.");
});

test("a flinch gets its own tip", () => {
  assert.ok(tipFor({ by: 1, attack: "quickMen", defenderStance: "shaken" }).includes("flinched"));
});

test("once you know seme, a flinch tells you how to answer it", () => {
  assert.ok(tipFor({ by: 1, attack: "men", defenderStance: "shaken" }, true).includes("Hold I"));
});

test("before you know seme, a flinch doesn't send you to a key that does nothing", () => {
  assert.ok(!tipFor({ by: 1, attack: "men", defenderStance: "shaken" }, false).includes("Hold I"));
});
