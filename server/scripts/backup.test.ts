import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession, signIn, signUp } from "../accounts.ts";
import { recordMatch } from "../matches.ts";
import { writeStory } from "../saves.ts";
import { tempDb } from "../test-db.ts";
import { dumpDb, loadDump, TABLES, writeBackup } from "./backup-lib.ts";

const filled = async () => {
  const world = await tempDb();
  const emi = await signUp(world.db, "Emi", "correct horse");
  const ken = await signUp(world.db, "Ken", "battery staple");
  assert.ok("account" in emi && "account" in ken);
  await createSession(world.db, emi.account.id, 1);
  await writeStory(world.db, emi.account.id, 0, "a story", 2);
  await writeStory(world.db, ken.account.id, 0, null, 2);
  await recordMatch(world.db, { players: [emi.account.id, ken.account.id], winner: null, reason: "disagreed", playedAt: 3 });
  await recordMatch(world.db, { players: [emi.account.id, ken.account.id], winner: emi.account.id, reason: "played", playedAt: 4 });
  return world;
};

test("a dump restored elsewhere is identical, and its passwords still work", async (t) => {
  const from = await filled();
  const to = await tempDb();
  t.after(() => (from.done(), to.done()));
  const dump = await dumpDb(from.db);
  await loadDump(to.db, dump);
  for (const table of TABLES) {
    const query = `SELECT * FROM ${table} ORDER BY 1`;
    assert.deepEqual((await to.db.execute(query)).rows, (await from.db.execute(query)).rows, table);
    assert.ok((await to.db.execute(query)).rows.length > 0, table);
  }
  assert.ok(await signIn(to.db, "emi", "correct horse"));
  assert.equal(await signIn(to.db, "emi", "wrong horse"), null);
});

test("a written backup can be read back, and an empty one is refused unless asked for", async (t) => {
  const from = await filled();
  const empty = await tempDb();
  t.after(() => (from.done(), empty.done()));
  const dir = mkdtempSync(join(tmpdir(), "tiny-kendo-backup-"));
  const path = join(dir, "backup.json");
  const count = await writeBackup(from.db, path, { allowEmpty: false, now: 5 });
  assert.equal(count, 2);
  const read = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(read.takenAt, 5);
  assert.equal(read.tables.accounts.length, 2);
  await assert.rejects(writeBackup(empty.db, join(dir, "empty.json"), { allowEmpty: false, now: 5 }), /no accounts/i);
  assert.equal(await writeBackup(empty.db, join(dir, "empty.json"), { allowEmpty: true, now: 5 }), 0);
});

test("loading refuses a database that already has anything in it", async (t) => {
  const from = await filled();
  t.after(from.done);
  await assert.rejects(loadDump(from.db, await dumpDb(from.db)), /isn't empty/);
});
