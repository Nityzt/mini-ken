import { LOBBY_CODE_ALPHABET, LOBBY_CODE_LENGTH, parseLobbyCode } from "./protocol.ts";

export const inviteFromUrl = (search: string): string | null => parseLobbyCode(new URLSearchParams(search).get("join"));
export const inviteLink = (origin: string, code: string): string => `${origin}/?join=${code}`;
export const clearInvite = (history: Pick<History, "replaceState">, location: Pick<Location, "pathname">): void => history.replaceState(null, "", location.pathname);

export type InviteStep = "sign-in" | "tutorial" | "join";
/** What still stands between someone with an invite and the match. */
export const nextInviteStep = (state: { signedIn: boolean; open: boolean }): InviteStep => (!state.signedIn ? "sign-in" : !state.open ? "tutorial" : "join");

/** Takes what's been typed this tick. Enter only counts once it's a whole code. */
export function stepCodeEntry(text: string, typed: readonly string[]): { text: string; done: "join" | "back" | null } {
  let next = text;
  for (const key of typed) {
    if (key === "Escape") return { text: next, done: "back" };
    if (key === "Enter") {
      if (next.length === LOBBY_CODE_LENGTH) return { text: next, done: "join" };
    } else if (key === "Backspace") next = next.slice(0, -1);
    else if (key.length === 1 && next.length < LOBBY_CODE_LENGTH && LOBBY_CODE_ALPHABET.includes(key.toUpperCase())) next += key.toUpperCase();
  }
  return { text: next, done: null };
}
