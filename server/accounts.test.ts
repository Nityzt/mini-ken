import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { accountForSession, checkPassword, createSession, endSession, hashPassword, passwordProblem, SESSION_MS, setPassword, signIn, signUp, usernameProblem } from "./accounts.ts";
import { tempDb } from "./test-db.ts";

const opened = async (t: TestContext) => {
  const { db, done } = await tempDb();
  t.after(done);
  return db;
};
const signedUp = async (db: Awaited<ReturnType<typeof opened>>, name = "Emi", password = "correct horse") => {
  const result = await signUp(db, name, password);
  assert.ok("account" in result);
  return result.account;
};

test("usernames are short, plain, and can't pretend to be guests", () => {
  for (const good of ["Emi_2", "abc", "twelve_chars", "a-b"]) assert.equal(usernameProblem(good), null, good);
  for (const bad of ["ab", "thirteen_char", "a b", "Guest12", "guest", "PLAYER", "émi", ""]) assert.ok(usernameProblem(bad), bad);
});

test("passwords are 8 to 128 characters", () => {
  assert.ok(passwordProblem("1234567"));
  assert.equal(passwordProblem("12345678"), null);
  assert.equal(passwordProblem("x".repeat(128)), null);
  assert.ok(passwordProblem("x".repeat(129)));
});

test("a stored password is salted and can only be checked", async () => {
  const one = await hashPassword("correct horse");
  const two = await hashPassword("correct horse");
  assert.notEqual(one, two);
  assert.ok(!one.includes("correct horse"));
  assert.equal(await checkPassword("correct horse", one), true);
  assert.equal(await checkPassword("wrong horse", one), false);
  assert.equal(await checkPassword("anything", "not a hash"), false);
});

test("a username can only be taken once, whatever its capitals", async (t) => {
  const db = await opened(t);
  const account = await signedUp(db);
  assert.equal(account.username, "Emi");
  assert.equal(account.tutorial, false);
  const again = await signUp(db, "emi", "another password");
  assert.ok("problem" in again);
  const bad = await signUp(db, "x", "another password");
  assert.ok("problem" in bad);
  const { rows } = await db.execute("SELECT count(*) AS n FROM accounts");
  assert.equal(rows[0].n, 1);
});

test("the database only ever holds a hash of the password", async (t) => {
  const db = await opened(t);
  await signedUp(db);
  const { rows } = await db.execute("SELECT * FROM accounts");
  assert.ok(!JSON.stringify(rows).includes("correct horse"));
  assert.match(String(rows[0].password_hash), /^scrypt\$/);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["created_at", "id", "password_hash", "tutorial", "username", "username_key"]);
});

test("signing in takes the right password, whatever capitals the name's typed in", async (t) => {
  const db = await opened(t);
  const account = await signedUp(db);
  assert.equal((await signIn(db, "EMI", "correct horse"))?.id, account.id);
  assert.equal(await signIn(db, "Emi", "wrong horse"), null);
  assert.equal(await signIn(db, "Nobody", "correct horse"), null);
});

test("a session lasts 30 days, and only its hash is stored", async (t) => {
  const db = await opened(t);
  const account = await signedUp(db);
  const token = await createSession(db, account.id, 1000);
  assert.equal((await accountForSession(db, token, 1000 + SESSION_MS - 1))?.id, account.id);
  assert.equal(await accountForSession(db, token, 1000 + SESSION_MS), null);
  assert.equal(await accountForSession(db, "made up", 1000), null);
  assert.equal(await accountForSession(db, undefined, 1000), null);
  const { rows } = await db.execute("SELECT * FROM sessions");
  assert.ok(!JSON.stringify(rows).includes(token));
  assert.equal(SESSION_MS, 30 * 24 * 60 * 60 * 1000);
});

test("signing out ends that session and no other", async (t) => {
  const db = await opened(t);
  const account = await signedUp(db);
  const one = await createSession(db, account.id, 1);
  const two = await createSession(db, account.id, 1);
  await endSession(db, one);
  assert.equal(await accountForSession(db, one, 2), null);
  assert.equal((await accountForSession(db, two, 2))?.id, account.id);
});

test("a reset password replaces the old one and signs everyone out", async (t) => {
  const db = await opened(t);
  const account = await signedUp(db);
  const token = await createSession(db, account.id, 1);
  assert.equal(await setPassword(db, "emi", "brand new secret"), true);
  assert.equal(await signIn(db, "Emi", "correct horse"), null);
  assert.equal((await signIn(db, "Emi", "brand new secret"))?.id, account.id);
  assert.equal(await accountForSession(db, token, 2), null);
  assert.equal(await setPassword(db, "nobody", "brand new secret"), false);
});
