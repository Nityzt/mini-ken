import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { Db, DbRow } from "./db.ts";
import { createSlots } from "./rate-limit.ts";

export type Account = { id: string; username: string; tutorial: boolean };

export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME = /^[A-Za-z0-9_-]{3,12}$/;
const RESERVED = /^(guest\d*|player)$/i;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const N = 2 ** 15;
const R = 8;
const P = 3;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const TAKEN = "That username is taken.";

const usernameKey = (name: string) => name.toLowerCase();
const toAccount = (row: DbRow): Account => ({ id: String(row.id), username: String(row.username), tutorial: !!row.tutorial });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function usernameProblem(name: string): string | null {
  if (!USERNAME.test(name)) return "Usernames are 3 to 12 letters, digits, _ or -.";
  return RESERVED.test(name) ? "That username is reserved." : null;
}

export const passwordProblem = (password: string): string | null => (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX ? `Passwords are ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.` : null);

/** Each hash takes real memory and CPU on a small server that's also relaying live matches. */
const hashing = createSlots(2);
const derive = (password: string, salt: Buffer, n: number, r: number, p: number, bytes: number) =>
  hashing.run(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password, salt, bytes, { N: n, r, p, maxmem: 256 * n * r * p + 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key)));
      }),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, N, R, P, KEY_BYTES);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function signUp(db: Db, username: string, password: string): Promise<{ account: Account } | { problem: string }> {
  const problem = usernameProblem(username) ?? passwordProblem(password);
  if (problem) return { problem };
  // Saves the costly hash when the name's obviously gone. The insert below still has the last word.
  const { rows } = await db.execute("SELECT 1 FROM accounts WHERE username_key = ?", [usernameKey(username)]);
  if (rows.length) return { problem: TAKEN };
  const account: Account = { id: randomUUID(), username, tutorial: false };
  const passwordHash = await hashPassword(password);
  // The unique column decides who gets a name, so two people can't both take it at once.
  const { rowsAffected } = await db.execute("INSERT OR IGNORE INTO accounts (id, username, username_key, password_hash, tutorial, created_at) VALUES (?, ?, ?, ?, 0, ?)", [account.id, username, usernameKey(username), passwordHash, Date.now()]);
  return rowsAffected ? { account } : { problem: TAKEN };
}

/** Takes as long for an unknown name as a wrong password, so it can't be used to find out who has an account. */
let decoy: Promise<string> | null = null;

export async function signIn(db: Db, username: string, password: string): Promise<Account | null> {
  const { rows } = await db.execute("SELECT * FROM accounts WHERE username_key = ?", [usernameKey(username)]);
  if (!rows.length) {
    decoy ??= hashPassword("not anybody's password");
    await checkPassword(password, await decoy);
    return null;
  }
  return (await checkPassword(password, String(rows[0].password_hash))) ? toAccount(rows[0]) : null;
}

export async function createSession(db: Db, accountId: string, now: number): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  await db.execute("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)", [hashToken(token), accountId, now + SESSION_MS]);
  return token;
}

export async function accountForSession(db: Db, token: string | undefined, now: number): Promise<Account | null> {
  if (!token) return null;
  const { rows } = await db.execute("SELECT accounts.* FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?", [hashToken(token), now]);
  return rows.length ? toAccount(rows[0]) : null;
}

export async function endSession(db: Db, token: string): Promise<void> {
  await db.execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export async function setPassword(db: Db, username: string, password: string): Promise<boolean> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const { rows } = await db.execute("SELECT id FROM accounts WHERE username_key = ?", [usernameKey(username)]);
  if (!rows.length) return false;
  await db.execute("UPDATE accounts SET password_hash = ? WHERE id = ?", [await hashPassword(password), rows[0].id]);
  await db.execute("DELETE FROM sessions WHERE account_id = ?", [rows[0].id]);
  return true;
}

export async function setTutorial(db: Db, accountId: string): Promise<void> {
  await db.execute("UPDATE accounts SET tutorial = 1 WHERE id = ?", [accountId]);
}
