import type { OutcomeReason } from "../game/net/protocol.ts";
import { randomUUID } from "node:crypto";
import type { Db } from "./db.ts";
import type { MatchResult } from "./lobby.ts";

export type HistoryRow = { opponent: string; result: "won" | "lost" | "void"; reason: OutcomeReason; playedAt: number };
const HISTORY_LENGTH = 20;

export async function recordMatch(db: Db, result: MatchResult): Promise<void> {
  await db.execute("INSERT INTO matches (id, player_a, player_b, winner, reason, played_at) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), result.players[0], result.players[1], result.winner, result.reason, result.playedAt]);
}

/** Always worked out from the matches themselves, so the two can't drift apart. */
export async function recordOf(db: Db, accountId: string): Promise<{ wins: number; losses: number }> {
  const { rows } = await db.execute("SELECT count(CASE WHEN winner = ?1 THEN 1 END) AS wins, count(CASE WHEN winner IS NOT NULL AND winner <> ?1 THEN 1 END) AS losses FROM matches WHERE player_a = ?1 OR player_b = ?1", [accountId]);
  return { wins: Number(rows[0].wins), losses: Number(rows[0].losses) };
}

export async function historyOf(db: Db, accountId: string, limit = HISTORY_LENGTH): Promise<HistoryRow[]> {
  const { rows } = await db.execute(
    `SELECT accounts.username AS opponent, matches.winner, matches.reason, matches.played_at
     FROM matches JOIN accounts ON accounts.id = CASE WHEN matches.player_a = ?1 THEN matches.player_b ELSE matches.player_a END
     WHERE matches.player_a = ?1 OR matches.player_b = ?1
     ORDER BY matches.played_at DESC LIMIT ?2`,
    [accountId, limit],
  );
  return rows.map((row) => ({
    opponent: String(row.opponent),
    result: row.winner === null ? "void" : row.winner === accountId ? "won" : "lost",
    reason: row.reason as OutcomeReason,
    playedAt: Number(row.played_at),
  }));
}
