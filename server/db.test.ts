import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { databaseUrl, migrate, openDb } from "./db.ts";

const tempDb = () => {
  const dir = mkdtempSync(join(tmpdir(), "tiny-kendo-db-"));
  const db = openDb(`file:${join(dir, "test.db")}`);
  return { db, done: () => (db.close(), rmSync(dir, { recursive: true, force: true })) };
};

test("migrate is safe to run twice, and a username_key can only exist once", async () => {
  const { db, done } = tempDb();
  try {
    await migrate(db);
    await migrate(db);
    const insert = "INSERT INTO accounts (id, username, username_key, password_hash, tutorial, created_at) VALUES (?, ?, ?, ?, 0, 1)";
    await db.execute(insert, ["a", "Emi", "emi", "hash"]);
    await assert.rejects(db.execute(insert, ["b", "EMI", "emi", "hash"]));
    const { rows } = await db.execute("SELECT username FROM accounts");
    assert.deepEqual(rows.map((row) => row.username), ["Emi"]);
  } finally {
    done();
  }
});

test("a removed story can keep its revision with no data", async () => {
  const { db, done } = tempDb();
  try {
    await migrate(db);
    await db.execute("INSERT INTO story_saves (account_id, revision, data, updated_at) VALUES ('a', 4, NULL, 1)");
    const { rows } = await db.execute("SELECT revision, data FROM story_saves");
    assert.equal(rows[0].revision, 4);
    assert.equal(rows[0].data, null);
  } finally {
    done();
  }
});

test("production won't start without a real database, because a local file there would vanish", () => {
  assert.throws(() => databaseUrl({ NODE_ENV: "production" }), /TURSO_DATABASE_URL/);
  assert.equal(databaseUrl({ NODE_ENV: "production", TURSO_DATABASE_URL: "libsql://x" }), "libsql://x");
  assert.equal(databaseUrl({}), undefined);
  assert.equal(databaseUrl({ NODE_ENV: "production", TURSO_DATABASE_URL: "file:/tmp/x.db", ALLOW_LOCAL_DATABASE: "1" }), "file:/tmp/x.db");
  assert.throws(() => databaseUrl({ NODE_ENV: "production", TURSO_DATABASE_URL: "file:/tmp/x.db" }), /TURSO_DATABASE_URL/);
});
