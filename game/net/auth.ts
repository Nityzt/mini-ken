import type { Identity } from "./protocol.ts";

/** Who someone is to everyone else. On a real server, the server decides this from their session. */
export type AuthProvider = { identity(): Identity };

export const createGuestAuth = (identity: () => Identity): AuthProvider => ({ identity });

/** Signed in, you go by your username. Everything else about you stays the same. */
export const createAccountAuth = (account: () => { id: string; username: string } | null, fallback: () => Identity): AuthProvider => ({
  identity() {
    const signedIn = account();
    return signedIn ? { ...fallback(), id: signedIn.id, name: signedIn.username, guest: false } : fallback();
  },
});
