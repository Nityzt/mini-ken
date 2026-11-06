// For the owner: loads a backup into a local scratch database, to prove the backup works.
// Usage: node server/scripts/restore.ts <in.json> <file:scratch.db>
// It only accepts file: targets and empty databases, so it can't overwrite the real one.
import { readFileSync } from "node:fs";
import { migrate, openDb } from "../db.ts";
import { loadDump, TABLES, type DbDump } from "./backup-lib.ts";

const [source, target] = process.argv.slice(2);
if (!source || !target?.startsWith("file:")) {
  console.error("Usage: restore.ts <in.json> <file:scratch.db>. The target must be a file: URL.");
  process.exit(2);
}
const db = openDb(target);
try {
  await migrate(db);
  await loadDump(db, JSON.parse(readFileSync(source, "utf8")) as DbDump);
  for (const table of TABLES) {
    const { rows } = await db.execute(`SELECT count(*) AS n FROM ${table}`);
    console.log(`${table}: ${rows[0].n}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Restore failed.");
  process.exitCode = 1;
} finally {
  db.close();
}
