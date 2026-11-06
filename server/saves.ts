import type { Db } from "./db.ts";

export const SAVE_LIMIT_BYTES = 256 * 1024;
export type StoredSave = { revision: number; data: string | null; updatedAt: number };
export type WriteResult = { ok: true; revision: number } | { ok: false; current: StoredSave };

export async function readStory(db: Db, accountId: string): Promise<StoredSave> {
  const { rows } = await db.execute("SELECT revision, data, updated_at FROM story_saves WHERE account_id = ?", [accountId]);
  if (!rows.length) return { revision: 0, data: null, updatedAt: 0 };
  const data = rows[0].data;
  return { revision: Number(rows[0].revision), data: typeof data === "string" ? data : null, updatedAt: Number(rows[0].updated_at) };
}

/**
 * Only goes through if the account's still on the revision this was based on. It's one statement,
 * so two devices can't both win. `null` removes the story and keeps the revision moving.
 */
export async function writeStory(db: Db, accountId: string, baseRevision: number, data: string | null, now: number): Promise<WriteResult> {
  const { rowsAffected } =
    baseRevision === 0
      ? await db.execute("INSERT OR IGNORE INTO story_saves (account_id, revision, data, updated_at) VALUES (?, 1, ?, ?)", [accountId, data, now])
      : await db.execute("UPDATE story_saves SET revision = revision + 1, data = ?, updated_at = ? WHERE account_id = ? AND revision = ?", [data, now, accountId, baseRevision]);
  return rowsAffected ? { ok: true, revision: baseRevision + 1 } : { ok: false, current: await readStory(db, accountId) };
}
