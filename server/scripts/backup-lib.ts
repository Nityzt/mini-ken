import { readFileSync, renameSync, writeFileSync } from "node:fs";
import type { Db, DbRow } from "../db.ts";

export const TABLES = ["accounts", "sessions", "story_saves", "matches"] as const;
export type DbDump = { takenAt: number; tables: Record<string, DbRow[]> };

export async function dumpDb(db: Db, now = Date.now()): Promise<DbDump> {
  const tables: Record<string, DbRow[]> = {};
  for (const table of TABLES) tables[table] = (await db.execute(`SELECT * FROM ${table}`)).rows.map((row) => ({ ...row }));
  return { takenAt: now, tables };
}

export async function loadDump(db: Db, dump: DbDump): Promise<void> {
  for (const table of TABLES) {
    const { rows } = await db.execute(`SELECT count(*) AS n FROM ${table}`);
    if (Number(rows[0].n) > 0) throw new Error(`The ${table} table isn't empty, so nothing was restored.`);
  }
  for (const table of TABLES) {
    for (const row of dump.tables[table] ?? []) {
      const columns = Object.keys(row);
      await db.execute(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, columns.map((column) => row[column]));
    }
  }
}

/** Only ever replaces an older backup with one that's been read back and checked. Returns how many accounts it holds. */
export async function writeBackup(db: Db, path: string, options: { allowEmpty: boolean; now?: number }): Promise<number> {
  const dump = await dumpDb(db, options.now);
  const accounts = dump.tables.accounts.length;
  if (!accounts && !options.allowEmpty) throw new Error("There are no accounts in that database, so that's probably the wrong one. Use --allow-empty if it isn't.");
  const temporary = `${path}.partial`;
  writeFileSync(temporary, JSON.stringify(dump), { mode: 0o600 });
  const checked = JSON.parse(readFileSync(temporary, "utf8")) as DbDump;
  if (checked.tables.accounts.length !== accounts) throw new Error("The backup didn't read back the same, so it wasn't kept.");
  renameSync(temporary, path);
  return accounts;
}
