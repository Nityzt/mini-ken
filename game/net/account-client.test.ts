import test from "node:test";
import assert from "node:assert/strict";
import { createAccountAuth, createGuestAuth } from "./auth.ts";
import { createAccountClient, createSaveApi } from "./account-client.ts";

type Reply = { status: number; body?: unknown } | "offline";
function fakeFetch(replies: Record<string, Reply>) {
  const calls: { key: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    calls.push({ key, init });
    const reply = replies[key];
    if (!reply || reply === "offline") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
  }) as typeof fetch;
  return { fetcher, calls };
}
const emi = { id: "e", username: "Emi", tutorial: false };

test("it doesn't claim to know who you are until it's asked", () => {
  const client = createAccountClient(fakeFetch({}).fetcher);
  assert.equal(client.status(), "unknown");
  assert.equal(client.current(), null);
});

test("a refresh finds out who you are and your record", async () => {
  const client = createAccountClient(fakeFetch({ "GET /api/me": { status: 200, body: { account: emi, wins: 2, losses: 1 } } }).fetcher);
  await client.refresh();
  assert.equal(client.status(), "signed-in");
  assert.deepEqual(client.current(), emi);
  assert.deepEqual(client.record(), { wins: 2, losses: 1 });
});

test("a 401 means signed out, not an error", async () => {
  const client = createAccountClient(fakeFetch({ "GET /api/me": { status: 401, body: { problem: "Please sign in." } } }).fetcher);
  await client.refresh();
  assert.equal(client.status(), "signed-out");
});

test("not being able to reach the server is its own thing, and keeps who you were", async () => {
  const world = { reply: { status: 200, body: { account: emi, wins: 1, losses: 0 } } as Reply };
  const fetcher = ((url: string, init?: RequestInit) => fakeFetch({ "GET /api/me": world.reply }).fetcher(url, init)) as typeof fetch;
  const client = createAccountClient(fetcher);
  await client.refresh();
  world.reply = "offline";
  await client.refresh();
  assert.equal(client.status(), "signed-in");
  const fresh = createAccountClient(fakeFetch({ "GET /api/me": "offline" }).fetcher);
  await fresh.refresh();
  assert.equal(fresh.status(), "unreachable");
});

test("signing in or up gives back the server's problem as text", async () => {
  const client = createAccountClient(fakeFetch({ "POST /api/signup": { status: 400, body: { problem: "That username is taken." } }, "POST /api/signin": { status: 200, body: { account: emi, wins: 0, losses: 0 } } }).fetcher);
  assert.equal(await client.signUp("Emi", "correct horse"), "That username is taken.");
  assert.equal(client.current(), null);
  assert.equal(await client.signIn("Emi", "correct horse"), null);
  assert.deepEqual(client.current(), emi);
});

test("no connection is a message, not a crash", async () => {
  const client = createAccountClient(fakeFetch({}).fetcher);
  assert.match((await client.signIn("Emi", "correct horse"))!, /reach the server/);
  assert.deepEqual(await client.history(), null);
});

test("signing out with no connection forgets you here, and says it couldn't end the session", async () => {
  const client = createAccountClient(fakeFetch({ "POST /api/signin": { status: 200, body: { account: emi, wins: 0, losses: 0 } } }).fetcher);
  await client.signIn("Emi", "correct horse");
  assert.equal(await client.signOut(), false);
  assert.equal(client.current(), null);
  assert.equal(client.status(), "signed-out");
});

test("signing out forgets you", async () => {
  const client = createAccountClient(fakeFetch({ "POST /api/signin": { status: 200, body: { account: emi, wins: 0, losses: 0 } }, "POST /api/signout": { status: 200 } }).fetcher);
  await client.signIn("Emi", "correct horse");
  assert.equal(await client.signOut(), true);
  assert.equal(client.current(), null);
  assert.equal(client.status(), "signed-out");
});

test("finishing the tutorial tells the server and remembers it", async () => {
  const world = fakeFetch({ "POST /api/signin": { status: 200, body: { account: emi, wins: 0, losses: 0 } }, "POST /api/me/tutorial": { status: 200 } });
  const client = createAccountClient(world.fetcher);
  await client.signIn("Emi", "correct horse");
  await client.finishTutorial();
  assert.equal(client.current()?.tutorial, true);
  assert.ok(world.calls.some((call) => call.key === "POST /api/me/tutorial"));
});

test("a stale save comes back as the current one", async () => {
  const current = { revision: 4, data: "x", updatedAt: 1 };
  const api = createSaveApi(fakeFetch({ "PUT /api/story": { status: 409, body: { current } } }).fetcher);
  assert.deepEqual(await api.write(1, "y"), { ok: false, current });
});

test("a refused save counts as failing, rather than being mistaken for success", async () => {
  const api = createSaveApi(fakeFetch({ "PUT /api/story": { status: 400, body: { problem: "That isn't a save." } }, "GET /api/story": { status: 500 } }).fetcher);
  await assert.rejects(api.write(1, "y"));
  await assert.rejects(api.read());
});

test("saving as the page closes uses a request that outlives the page", () => {
  const world = fakeFetch({ "PUT /api/story": { status: 200, body: { revision: 2 } } });
  createSaveApi(world.fetcher).writeOnClose(1, "y");
  assert.equal(world.calls[0].init?.keepalive, true);
  assert.deepEqual(JSON.parse(String(world.calls[0].init?.body)), { baseRevision: 1, data: "y" });
});

test("a signed-in identity is the username, and not a guest", () => {
  const guest = { id: "g", name: "Guest 1", dan: 2, guest: true };
  const auth = createAccountAuth(() => emi, () => guest);
  assert.deepEqual(auth.identity(), { id: "e", name: "Emi", dan: 2, guest: false });
  assert.deepEqual(createAccountAuth(() => null, () => guest).identity(), guest);
  assert.deepEqual(createGuestAuth(() => guest).identity(), guest);
});
