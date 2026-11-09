import test from "node:test";
import assert from "node:assert/strict";
import { benchJobs, durabilityOf, fixGear, GEAR_WEAR, MEND_COST, wearFrom, wieldedShinai, wornKi, WORN_AT } from "./durability.ts";
import { createRunState, playerKiMax, type RunState } from "./run-state.ts";
import { parseRun } from "./save.ts";
import { DOJOS } from "./world/dojos.ts";

const armed = (over: Partial<RunState> = {}): RunState => ({ ...createRunState(), gi: true, gear: { tare: true, do: true, men: true, kote: true, shinai: true }, ...over });

test("gear starts whole, except for Sensei's tired old shinai", () => {
  assert.equal(durabilityOf(armed(), "shinai"), 50);
  for (const key of ["ownShinai", "fineShinai", "tare", "do", "men", "kote"] as const) assert.equal(durabilityOf(armed(), key), 100, key);
  assert.equal(wornKi(armed()), 0, "the loan alone never hurts");
  assert.equal(playerKiMax(armed()), playerKiMax({ ...armed(), durability: { men: 26 } }));
});

test("most opponents leave your gear exactly as it was", () => {
  for (const opponent of ["aki", "momo", "kei", "raccoon", "asa"] as const) {
    assert.equal(GEAR_WEAR[opponent], undefined, opponent);
    const run = armed();
    assert.equal(wearFrom(run, opponent).run, run);
  }
  assert.ok(Object.keys(GEAR_WEAR).length < Object.keys(DOJOS).length + 8);
});

test("a special opponent wears only what they're hard on, and only the shinai in your hand", () => {
  const run: RunState = { ...armed(), madeShinai: true, wielded: "ownShinai" };
  const after = wearFrom(run, "shin").run;
  assert.equal(durabilityOf(after, "kote"), 85);
  assert.equal(durabilityOf(after, "ownShinai"), 85);
  assert.equal(durabilityOf(after, "shinai"), 50, "Sensei's is safe in the bag");
  assert.equal(durabilityOf(after, "men"), 100);
  assert.equal(durabilityOf(wearFrom({ ...armed(), gear: { ...armed().gear, kote: false } }, "shin").run, "kote"), 100, "not what you haven't got");
});

test("your best shinai is the default, and a choice you've made sticks", () => {
  assert.equal(wieldedShinai(createRunState()), null);
  assert.equal(wieldedShinai(armed()), "shinai");
  assert.equal(wieldedShinai(armed({ owned: ["fineShinai"] })), "fineShinai");
  assert.equal(wieldedShinai(armed({ owned: ["fineShinai"], madeShinai: true })), "ownShinai");
  assert.equal(wieldedShinai(armed({ owned: ["fineShinai"], madeShinai: true, wielded: "shinai" })), "shinai");
  assert.equal(wieldedShinai(armed({ madeShinai: true, wielded: "shinai", shinaiQuest: "returned" })), "ownShinai", "it's gone back");
});

test("worn-out gear costs ki and says so once, and nothing ever quite breaks", () => {
  let run = armed();
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    const step = wearFrom(run, "tetsu");
    run = step.run;
    seen.push(...step.wornOut);
  }
  assert.deepEqual(seen.sort(), ["men", "shinai"]);
  assert.equal(durabilityOf(run, "men"), 5);
  assert.equal(durabilityOf(run, "shinai"), 5);
  assert.equal(wornKi(run), 10);
  assert.equal(playerKiMax(run), playerKiMax(armed()) - 10);
});

test("a shinai worn out but not in your hand doesn't cost you", () => {
  const run = armed({ madeShinai: true, wielded: "ownShinai", durability: { shinai: WORN_AT } });
  assert.equal(wornKi(run), 0);
  assert.equal(wornKi({ ...run, wielded: "shinai" }), 5);
});

test("the shinai bag halves what your shinai takes", () => {
  const run = armed({ madeShinai: true, shinaiQuest: "returned" });
  assert.equal(durabilityOf(wearFrom(run, "shin").run, "ownShinai"), 92);
});

test("Fumi mends armor and shop shinai for kensen, and Sensei's only ever by your own hands", () => {
  const worn = armed({ money: 100, owned: ["fineShinai"], durability: { men: 40, fineShinai: 60 } });
  assert.deepEqual(benchJobs(worn).map((job) => job.key), ["fineShinai", "men"], "Sensei's isn't on the list yet");
  const mended = fixGear(worn, "men");
  assert.equal(durabilityOf(mended, "men"), 100);
  assert.equal(mended.money, 100 - MEND_COST);
  assert.equal(fixGear(worn, "shinai"), worn);
  const broke = { ...worn, money: 0 };
  assert.equal(fixGear(broke, "men"), broke, "not on credit");

  const learned = { ...worn, money: 0, madeShinai: true };
  assert.deepEqual(benchJobs(learned).map((job) => [job.key, job.cost]), [["fineShinai", 0], ["shinai", 0], ["men", MEND_COST]]);
  assert.equal(durabilityOf(fixGear(learned, "shinai"), "shinai"), 100);
});

test("durability survives a save, and bad numbers don't", () => {
  assert.equal(parseRun({ ...createRunState(), durability: { men: 40 } })?.durability.men, 40);
  assert.equal(parseRun({ ...createRunState(), durability: { men: "new" } }), null);
  const { durability: _gone, ...older } = createRunState();
  assert.deepEqual(parseRun(older)?.durability, {});
});
