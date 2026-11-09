import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readStory, SAVE_LIMIT_BYTES, writeStory } from "./saves.ts";
import { tempDb } from "./test-db.ts";

const opened = async (t: TestContext) => {
  const { db, done } = await tempDb();
  t.after(done);
  return db;
};

test("no story is revision 0 with nothing in it", async (t) => {
  assert.deepEqual(await readStory(await opened(t), "a"), { revision: 0, data: null, updatedAt: 0 });
});

test("the first write from nothing is revision 1, and each after moves on one", async (t) => {
  const db = await opened(t);
  assert.deepEqual(await writeStory(db, "a", 0, "one", 10), { ok: true, revision: 1 });
  assert.deepEqual(await writeStory(db, "a", 1, "two", 20), { ok: true, revision: 2 });
  assert.deepEqual(await readStory(db, "a"), { revision: 2, data: "two", updatedAt: 20 });
});

test("a write based on an old revision is refused and nothing changes", async (t) => {
  const db = await opened(t);
  await writeStory(db, "a", 0, "one", 10);
  await writeStory(db, "a", 1, "two", 20);
  assert.deepEqual(await writeStory(db, "a", 1, "stale", 30), { ok: false, current: { revision: 2, data: "two", updatedAt: 20 } });
  assert.deepEqual(await writeStory(db, "a", 0, "stale", 30), { ok: false, current: { revision: 2, data: "two", updatedAt: 20 } });
});

test("removing a story keeps its revision moving, so a stale device can't bring it back", async (t) => {
  const db = await opened(t);
  await writeStory(db, "a", 0, "one", 10);
  assert.deepEqual(await writeStory(db, "a", 1, null, 20), { ok: true, revision: 2 });
  assert.deepEqual(await readStory(db, "a"), { revision: 2, data: null, updatedAt: 20 });
  const stale = await writeStory(db, "a", 1, "one", 30);
  assert.equal(stale.ok, false);
});

test("a stale removal is refused too", async (t) => {
  const db = await opened(t);
  await writeStory(db, "a", 0, "one", 10);
  await writeStory(db, "a", 1, "two", 20);
  assert.equal((await writeStory(db, "a", 1, null, 30)).ok, false);
  assert.equal((await readStory(db, "a")).data, "two");
});

test("two writes at once: exactly one wins", async (t) => {
  const db = await opened(t);
  await writeStory(db, "a", 0, "one", 10);
  const results = await Promise.all([writeStory(db, "a", 1, "x", 20), writeStory(db, "a", 1, "y", 20)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
});

test("a late-game save fits comfortably", () => {
  assert.equal(SAVE_LIMIT_BYTES, 256 * 1024);
});
