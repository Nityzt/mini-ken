import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { signUp } from "./accounts.ts";
import { historyOf, recordMatch, recordOf } from "./matches.ts";
import { tempDb } from "./test-db.ts";

const players = async (t: TestContext) => {
  const { db, done } = await tempDb();
  t.after(done);
  const make = async (name: string) => {
    const result = await signUp(db, name, "correct horse");
    assert.ok("account" in result);
    return result.account.id;
  };
  return { db, emi: await make("Emi"), ken: await make("Ken") };
};

test("the record only counts matches that counted", async (t) => {
  const { db, emi, ken } = await players(t);
  await recordMatch(db, { players: [emi, ken], winner: emi, reason: "played", playedAt: 1 });
  await recordMatch(db, { players: [ken, emi], winner: emi, reason: "left", playedAt: 2 });
  await recordMatch(db, { players: [emi, ken], winner: ken, reason: "played", playedAt: 3 });
  await recordMatch(db, { players: [emi, ken], winner: null, reason: "disagreed", playedAt: 4 });
  assert.deepEqual(await recordOf(db, emi), { wins: 2, losses: 1 });
  assert.deepEqual(await recordOf(db, ken), { wins: 1, losses: 2 });
});

test("someone with no matches has an empty record", async (t) => {
  const { db, emi } = await players(t);
  assert.deepEqual(await recordOf(db, emi), { wins: 0, losses: 0 });
  assert.deepEqual(await historyOf(db, emi), []);
});

test("history reads from your side, newest first, including what didn't count", async (t) => {
  const { db, emi, ken } = await players(t);
  await recordMatch(db, { players: [emi, ken], winner: emi, reason: "played", playedAt: 1 });
  await recordMatch(db, { players: [ken, emi], winner: ken, reason: "silent", playedAt: 2 });
  await recordMatch(db, { players: [emi, ken], winner: null, reason: "out-of-step", playedAt: 3 });
  assert.deepEqual(await historyOf(db, emi), [
    { opponent: "Ken", result: "void", reason: "out-of-step", playedAt: 3 },
    { opponent: "Ken", result: "lost", reason: "silent", playedAt: 2 },
    { opponent: "Ken", result: "won", reason: "played", playedAt: 1 },
  ]);
  assert.equal((await historyOf(db, ken))[1].result, "won");
});

test("history stops at the last 20", async (t) => {
  const { db, emi, ken } = await players(t);
  for (let i = 1; i <= 25; i++) await recordMatch(db, { players: [emi, ken], winner: emi, reason: "played", playedAt: i });
  const history = await historyOf(db, emi);
  assert.equal(history.length, 20);
  assert.equal(history[0].playedAt, 25);
  assert.equal(history[19].playedAt, 6);
  assert.deepEqual(await recordOf(db, emi), { wins: 25, losses: 0 });
});
