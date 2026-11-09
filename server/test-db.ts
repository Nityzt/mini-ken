import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate, openDb, type Db } from "./db.ts";

/** A real database in a temporary file, for tests. */
export async function tempDb(): Promise<{ db: Db; path: string; done(): void }> {
  const dir = mkdtempSync(join(tmpdir(), "tiny-kendo-db-"));
  const path = join(dir, "test.db");
  const db = openDb(`file:${path}`);
  await migrate(db);
  return { db, path, done: () => (db.close(), rmSync(dir, { recursive: true, force: true })) };
}
