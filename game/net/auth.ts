import type { Identity } from "./protocol.ts";

/**
 * Who someone is, and how to prove it to the server. Real accounts are one more of these: sign in however
 * you like, return the identity, and return a token the server can check. Nothing else in the game changes.
 */
export type AuthProvider = {
  identity(): Identity;
  /** What to send the server to prove it. Guests have nothing to prove. */
  token(): string | null;
};

export const createGuestAuth = (identity: () => Identity): AuthProvider => ({ identity, token: () => null });
