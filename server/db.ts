import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type InValue } from "@libsql/client";

export type DbRow = Record<string, unknown>;
export type Db = {
  execute(sql: string, args?: unknown[]): Promise<{ rows: DbRow[]; rowsAffected: number }>;
  close(): void;
};

const LOCAL_DB = "file:.local/tiny-kendo.db";

/** A host's disk is wiped on every deploy, so production won't quietly fall back to a local file and lose everyone's accounts. */
export function databaseUrl(env: Record<string, string | undefined>): string | undefined {
  const url = env.TURSO_DATABASE_URL;
  if (env.NODE_ENV === "production" && env.ALLOW_LOCAL_DATABASE !== "1" && (!url || url.startsWith("file:"))) {
    throw new Error("TURSO_DATABASE_URL must point at the real database in production.");
  }
  return url;
}

/** Turso when there's a URL for it, and a file on this machine when there isn't. */
export function openDb(url: string = LOCAL_DB, authToken?: string): Db {
  if (url.startsWith("file:")) mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  const client = createClient({ url, authToken });
  return {
    async execute(sql, args = []) {
      const result = await client.execute({ sql, args: args as InValue[] });
      return { rows: result.rows as unknown as DbRow[], rowsAffected: result.rowsAffected };
    },
    close: () => client.close(),
  };
}

const TABLES = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    tutorial INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id)`,
  `CREATE TABLE IF NOT EXISTS story_saves (
    account_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL,
    data TEXT,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS account_settings (
    account_id TEXT PRIMARY KEY,
    bindings TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    player_a TEXT NOT NULL,
    player_b TEXT NOT NULL,
    winner TEXT,
    reason TEXT NOT NULL,
    played_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS matches_a ON matches (player_a, played_at)`,
  `CREATE INDEX IF NOT EXISTS matches_b ON matches (player_b, played_at)`,
];

export async function migrate(db: Db): Promise<void> {
  for (const sql of TABLES) await db.execute(sql);
}
