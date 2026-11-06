import type { MatchReport, OutcomeReason } from "../game/net/protocol.ts";

export type Facts = { reports: [MatchReport | null, MatchReport | null]; left: 0 | 1 | null; silent: [boolean, boolean]; waitExpired: boolean };
export type Decision = { done: false } | { done: true; winner: 0 | 1 | null; reason: OutcomeReason };

const other = (side: 0 | 1): 0 | 1 => (side === 0 ? 1 : 0);

/** Who won, going by what's known so far. See the "Who won" table in the design. */
export function decideOutcome({ reports, left, silent, waitExpired }: Facts): Decision {
  if (reports.includes("void")) return { done: true, winner: null, reason: "out-of-step" };
  const [a, b] = reports;
  if (a && b) {
    if (a === b) return { done: true, winner: null, reason: "disagreed" };
    return { done: true, winner: a === "won" ? 0 : 1, reason: "played" };
  }
  if (a || b) {
    const reporter: 0 | 1 = a ? 0 : 1;
    if (left === other(reporter)) return { done: true, winner: reports[reporter] === "won" ? reporter : other(reporter), reason: "played" };
    return waitExpired ? { done: true, winner: null, reason: "unreported" } : { done: false };
  }
  if (left !== null) return { done: true, winner: other(left), reason: "left" };
  if (silent[0] && silent[1]) return { done: true, winner: null, reason: "silent" };
  if (silent[0]) return { done: true, winner: 1, reason: "silent" };
  if (silent[1]) return { done: true, winner: 0, reason: "silent" };
  return { done: false };
}
