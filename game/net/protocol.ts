import type { AttackKind, FighterInput, Opening } from "../duel/rules.ts";

/** Bumped whenever two clients on different versions couldn't play each other. The server should turn away a mismatch. */
export const PROTOCOL_VERSION = 3;

export type Identity = { id: string; name: string; dan: number; guest: boolean };
export type BracketEntrant = { id: string; name: string; controller: "player" | "remote" | "bot" };
/** Who's left at the start of each round, paired off in order. The last list is the champion. */
export type Bracket = { rounds: BracketEntrant[][]; size: number };

/** What two players send each other during a match. The server only has to pass these along. */
export type LinkMessage = { t: "input"; frame: number; bits: number } | { t: "hash"; frame: number; hash: number } | { t: "leave" };
/** What a player says happened, once a match is over. */
export type MatchReport = "won" | "lost" | "void";
export type OutcomeReason = "played" | "disagreed" | "out-of-step" | "left" | "silent" | "unreported";
export type LobbyClosedReason = "expired" | "creator-left" | "opponent-left" | "not-back-in-time" | "server";
export type LobbyErrorReason = "no-such-lobby" | "full" | "own-lobby";
export type ClientMessage =
  | { t: "hello"; version: number }
  | { t: "create-lobby" }
  | { t: "join-lobby"; code: string }
  | { t: "leave-lobby" }
  | { t: "visible"; visible: boolean }
  | { t: "ping" }
  | { t: "rematch" }
  | { t: "result"; report: MatchReport }
  | LinkMessage;
export type ServerMessage =
  | { t: "welcome"; identity: Identity }
  | { t: "rejected"; reason: string }
  | { t: "lobby"; code: string }
  | { t: "lobby-error"; reason: LobbyErrorReason }
  | { t: "opponent-joined"; opponent: Identity }
  | { t: "match"; seed: number; side: 0 | 1; opponent: Identity }
  /** What the server has decided, and what it does to your record. `winner` is null if it doesn't count. */
  | { t: "outcome"; winner: "you" | "them" | null; reason: OutcomeReason; wins: number; losses: number }
  | { t: "rematch-wanted" }
  | { t: "lobby-closed"; reason: LobbyClosedReason }
  | LinkMessage;

/** No look-alikes, because these get read out and typed in. */
export const LOBBY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LOBBY_CODE_LENGTH = 5;

const ATTACKS: (AttackKind | null)[] = [null, "men", "kote", "do", "bigMen", "quickMen"];
const OPENINGS: (Opening | null)[] = [null, "raise", "wrist", "drop"];
const moveBits = (n: number | undefined) => (n === 1 ? 1 : n === -1 ? 2 : 0);
const bitsMove = (n: number): -1 | 0 | 1 => (n === 1 ? 1 : n === 2 ? -1 : 0);

/** One fighter's input for one frame, in a few bits, since a match sends sixty of these a second. */
export function encodeInput(input: FighterInput): number {
  return (
    moveBits(input.move) |
    (input.block ? 1 << 2 : 0) |
    (input.parry ? 1 << 3 : 0) |
    (input.stomp ? 1 << 4 : 0) |
    (input.seme ? 1 << 5 : 0) |
    (moveBits(input.dash) << 6) |
    (Math.max(0, ATTACKS.indexOf(input.attack)) << 8) |
    (Math.max(0, OPENINGS.indexOf(input.opening ?? null)) << 11)
  );
}

export function decodeInput(bits: number): FighterInput {
  return {
    move: bitsMove(bits & 3),
    block: !!(bits & (1 << 2)),
    parry: !!(bits & (1 << 3)),
    stomp: !!(bits & (1 << 4)),
    seme: !!(bits & (1 << 5)),
    dash: bitsMove((bits >> 6) & 3),
    attack: ATTACKS[(bits >> 8) & 7] ?? null,
    opening: OPENINGS[(bits >> 11) & 3] ?? null,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

const NAME_LIMIT = 14;
/** Anything from another person goes through this before it's drawn: the font only has plain characters, and the box only has so much room. */
export const cleanName = (name: unknown): string => {
  const clean = typeof name === "string" ? name.replace(/[^\x20-\x7e]/g, "").trim().slice(0, NAME_LIMIT) : "";
  return clean || "Player";
};

function parseIdentity(v: unknown): Identity | null {
  if (!isRecord(v) || typeof v.id !== "string" || !isCount(v.dan)) return null;
  return { id: v.id, name: cleanName(v.name), dan: v.dan, guest: !!v.guest };
}

export function parseLobbyCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return code.length === LOBBY_CODE_LENGTH && [...code].every((c) => LOBBY_CODE_ALPHABET.includes(c)) ? code : null;
}

const oneOf = <T extends string>(options: readonly T[], value: unknown): value is T => options.includes(value as T);
const REPORTS: readonly MatchReport[] = ["won", "lost", "void"];
const REASONS: readonly OutcomeReason[] = ["played", "disagreed", "out-of-step", "left", "silent", "unreported"];
const CLOSED: readonly LobbyClosedReason[] = ["expired", "creator-left", "opponent-left", "not-back-in-time", "server"];
const ERRORS: readonly LobbyErrorReason[] = ["no-such-lobby", "full", "own-lobby"];

function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const raw: unknown = JSON.parse(text);
    return isRecord(raw) ? raw : null;
  } catch {
    return null;
  }
}

function parseLinkMessage(raw: Record<string, unknown>): LinkMessage | null {
  if (raw.t === "input") return isCount(raw.frame) && isCount(raw.bits) ? { t: "input", frame: raw.frame, bits: raw.bits } : null;
  if (raw.t === "hash") return isCount(raw.frame) && isCount(raw.hash) ? { t: "hash", frame: raw.frame, hash: raw.hash } : null;
  return raw.t === "leave" ? { t: "leave" } : null;
}

/** What a client sent, or null if it doesn't hold up. The server trusts nothing else. */
export function parseClientMessage(text: string): ClientMessage | null {
  const raw = parseRecord(text);
  if (!raw) return null;
  switch (raw.t) {
    case "hello":
      return isCount(raw.version) ? { t: "hello", version: raw.version } : null;
    case "create-lobby":
    case "leave-lobby":
    case "ping":
    case "rematch":
      return { t: raw.t };
    case "join-lobby": {
      const code = parseLobbyCode(raw.code);
      return code ? { t: "join-lobby", code } : null;
    }
    case "visible":
      return typeof raw.visible === "boolean" ? { t: "visible", visible: raw.visible } : null;
    case "result":
      return oneOf(REPORTS, raw.report) ? { t: "result", report: raw.report } : null;
    default:
      return parseLinkMessage(raw);
  }
}

/** What the server or another player sent, or null if it doesn't hold up. Nothing from outside is trusted. */
export function parseServerMessage(text: string): ServerMessage | null {
  const raw = parseRecord(text);
  if (!raw) return null;
  switch (raw.t) {
    case "welcome": {
      const identity = parseIdentity(raw.identity);
      return identity && { t: "welcome", identity };
    }
    case "rejected":
      return { t: "rejected", reason: typeof raw.reason === "string" ? raw.reason.slice(0, 80) : "Refused" };
    case "lobby": {
      const code = parseLobbyCode(raw.code);
      return code ? { t: "lobby", code } : null;
    }
    case "lobby-error":
      return oneOf(ERRORS, raw.reason) ? { t: "lobby-error", reason: raw.reason } : null;
    case "opponent-joined": {
      const opponent = parseIdentity(raw.opponent);
      return opponent && { t: "opponent-joined", opponent };
    }
    case "match": {
      const opponent = parseIdentity(raw.opponent);
      return opponent && isCount(raw.seed) && (raw.side === 0 || raw.side === 1) ? { t: "match", seed: raw.seed, side: raw.side, opponent } : null;
    }
    case "outcome":
      return (raw.winner === "you" || raw.winner === "them" || raw.winner === null) && oneOf(REASONS, raw.reason) && isCount(raw.wins) && isCount(raw.losses) ? { t: "outcome", winner: raw.winner, reason: raw.reason, wins: raw.wins, losses: raw.losses } : null;
    case "rematch-wanted":
      return { t: "rematch-wanted" };
    case "lobby-closed":
      return oneOf(CLOSED, raw.reason) ? { t: "lobby-closed", reason: raw.reason } : null;
    default:
      return parseLinkMessage(raw);
  }
}
