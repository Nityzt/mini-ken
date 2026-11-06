import type { AttackKind, FighterInput } from "../duel/rules.ts";

/** Bumped whenever two clients on different versions couldn't play each other. The server should turn away a mismatch. */
export const PROTOCOL_VERSION = 1;

export type Identity = { id: string; name: string; dan: number; guest: boolean };
export type MatchMode = "duel" | "tournament";
export type BracketEntrant = { id: string; name: string; controller: "player" | "remote" | "bot" };
/** Who's left at the start of each round, paired off in order. The last list is the champion. */
export type Bracket = { rounds: BracketEntrant[][]; size: number };

/** What two players send each other during a match. The server only has to pass these along. */
export type LinkMessage = { t: "input"; frame: number; bits: number } | { t: "hash"; frame: number; hash: number } | { t: "leave" };
export type ClientMessage = { t: "hello"; version: number; token: string | null; identity: Identity } | { t: "queue"; mode: MatchMode } | { t: "cancel" } | { t: "result"; won: boolean } | LinkMessage;
export type ServerMessage =
  | { t: "welcome"; identity: Identity }
  | { t: "rejected"; reason: string }
  | { t: "queued"; mode: MatchMode }
  | { t: "match"; seed: number; side: 0 | 1; opponent: Identity }
  | { t: "bracket"; bracket: Bracket }
  | LinkMessage;

const ATTACKS: (AttackKind | null)[] = [null, "men", "kote", "do", "bigMen", "quickMen"];
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
    (Math.max(0, ATTACKS.indexOf(input.attack)) << 8)
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

function parseEntrant(v: unknown): BracketEntrant | null {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  return { id: v.id, name: cleanName(v.name), controller: v.controller === "player" || v.controller === "bot" ? v.controller : "remote" };
}

function parseBracket(v: unknown): Bracket | null {
  if (!isRecord(v) || !isCount(v.size) || !Array.isArray(v.rounds)) return null;
  const rounds: BracketEntrant[][] = [];
  for (const round of v.rounds) {
    if (!Array.isArray(round)) return null;
    const list = round.map(parseEntrant);
    if (list.some((e) => !e)) return null;
    rounds.push(list as BracketEntrant[]);
  }
  return { size: v.size, rounds };
}

/** What the server or another player sent, or null if it doesn't hold up. Nothing from outside is trusted. */
export function parseServerMessage(text: string): ServerMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  switch (raw.t) {
    case "input":
      return isCount(raw.frame) && isCount(raw.bits) ? { t: "input", frame: raw.frame, bits: raw.bits } : null;
    case "hash":
      return isCount(raw.frame) && isCount(raw.hash) ? { t: "hash", frame: raw.frame, hash: raw.hash } : null;
    case "leave":
      return { t: "leave" };
    case "welcome": {
      const identity = parseIdentity(raw.identity);
      return identity && { t: "welcome", identity };
    }
    case "rejected":
      return { t: "rejected", reason: typeof raw.reason === "string" ? raw.reason.slice(0, 80) : "Refused" };
    case "queued":
      return raw.mode === "duel" || raw.mode === "tournament" ? { t: "queued", mode: raw.mode } : null;
    case "match": {
      const opponent = parseIdentity(raw.opponent);
      return opponent && isCount(raw.seed) && (raw.side === 0 || raw.side === 1) ? { t: "match", seed: raw.seed, side: raw.side, opponent } : null;
    }
    case "bracket": {
      const bracket = parseBracket(raw.bracket);
      return bracket && { t: "bracket", bracket };
    }
    default:
      return null;
  }
}
