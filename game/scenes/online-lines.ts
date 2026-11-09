import type { HistoryRow } from "../net/account-client.ts";
import type { LobbyState, ServerOutcome } from "../net/lobby-client.ts";
import { ONLINE_LOST, ONLINE_LEFT, ONLINE_OUT_OF_STEP, ONLINE_WON } from "./content.ts";

export const ONLINE_SIGN_IN = "Sign in or create account";
export const ONLINE_SIGN_OUT = "Sign out";
export const ONLINE_CREATE_LOBBY = "Create lobby";
export const ONLINE_JOIN_LOBBY = "Join lobby";
export const ONLINE_HISTORY = "Match history";
export const ONLINE_PRACTICE_CUP = "Tournament (practice)";
export const ONLINE_CONNECTING = "Connecting to the server...";
export const ONLINE_UNREACHABLE = "Can't reach the server right now. It may be waking up.";
export const ONLINE_SIGN_IN_NOTE = "Sign in to play real people. Your story and record stay with your account.";
export const ONLINE_SIGNED_IN = "Create a lobby, then send a friend the code or link.";
export const LOBBY_WAITING = "Waiting for someone to join. Send them this code.";
export const LOBBY_COPY = "C: copy invite link";
export const LOBBY_COPIED = "Copied! Send it to a friend.";
export const LOBBY_LEAVE = "X: leave";
export const LOBBY_JOINING = "Joining...";
export const LOBBY_TYPE_CODE = "Type the lobby code";
export const LOBBY_TYPE_HELP = "Enter: join   Escape: back";
export const LOBBY_OPPONENT_HERE = (name: string): string => `${name} has arrived!`;
export const LOBBY_WAITING_VISIBLE = "Waiting for you both to be looking at the game...";
export const LOBBY_REMATCH = "E or Space: rematch";
export const LOBBY_REMATCH_ASKED = "Waiting for the other player...";
export const LOBBY_THEY_WANT = (name: string): string => `${name} wants a rematch!`;
export const LOBBY_CONTINUE = "E or Space: continue";
export const COUNTDOWN = (seconds: number): string => `Starting in ${seconds}...`;
export const SETTLING = "Waiting for the result...";
export const CONNECTION_LOST = "Connection lost. Check Match history for the result.";
export const HISTORY_EMPTY = "No matches yet.";
export const HISTORY_LOADING = "Loading...";
export const HISTORY_FAILED = "Can't reach the server right now.";
export const HISTORY_BACK = "X: back";
export const TITLE_SIGN_OUT = "Sign out";
export const TITLE_START_GUEST = "Start as guest";
export const TITLE_CONTINUE_GUEST = "Continue as guest";
export const TITLE_NEW_GUEST = "New game as guest";
export const TITLE_CONNECTING = "Connecting...";
export const TITLE_SIGNED_IN = (name: string): string => `Signed in as ${name}. E or Space to choose`;
export const TITLE_GUEST_NOTE = "Sign in to keep your progress. E or Space to choose";
export const SAVE_CHOICE_NOTE = "Pick which story to keep. The other one is replaced.";
export const JOIN_ALERT_TITLE = "Someone joined! - Tiny Kendo";

export function outcomeLine(outcome: ServerOutcome, name: string): string {
  const { winner, reason } = outcome;
  if (winner === null) {
    if (reason === "out-of-step") return ONLINE_OUT_OF_STEP;
    if (reason === "disagreed") return "You each reported a different result. It won't count.";
    if (reason === "silent") return "Neither of you was there. It won't count.";
    return "The result never arrived. It won't count.";
  }
  if (reason === "left") return winner === "you" ? ONLINE_LEFT(name) : "You left the match.";
  if (reason === "silent") return winner === "you" ? `${name} went quiet, so it's yours` : "You were away too long, so it's theirs.";
  return winner === "you" ? ONLINE_WON : ONLINE_LOST;
}

const CLOSED: Record<Exclude<Extract<LobbyState, { kind: "closed" }>["reason"], "rejected">, string> = {
  expired: "That lobby timed out. Create a new one.",
  "creator-left": "Whoever made that lobby has left.",
  "opponent-left": "The other player has left.",
  "not-back-in-time": "Someone didn't come back in time, so nothing was played.",
  server: "The server closed that lobby.",
  "no-such-lobby": "There's no lobby with that code. It may have expired.",
  full: "That lobby is already full.",
  "own-lobby": "That's your own lobby. Send the code to someone else.",
  "lost-connection": "Connection lost.",
};

export const closedLine = (reason: Extract<LobbyState, { kind: "closed" }>["reason"], detail?: string): string => (reason === "rejected" ? (detail ?? "The server refused.") : CLOSED[reason]);

export function historyLine(row: HistoryRow): string {
  const date = new Date(row.playedAt).toLocaleDateString("en-CA");
  if (row.result === "void") return `Didn't count  ${row.opponent}  ${date}`;
  return `${row.result === "won" ? "Won " : "Lost"}  ${row.opponent}  ${date}`;
}
