import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { DEFAULT_BINDINGS } from "../game/core/input.ts";
import { createRunState } from "../game/run-state.ts";
import { clientAddress, createApi, originAllowed, sessionToken } from "./api.ts";
import { recordMatch } from "./matches.ts";
import { createRateLimit, createSlots } from "./rate-limit.ts";
import { tempDb } from "./test-db.ts";

const ORIGIN = "https://kendo.example";

async function apiServer(t: TestContext, options: { secureCookies?: boolean; now?: () => number } = {}) {
  const { db, done } = await tempDb();
  const api = createApi({ db, now: options.now ?? Date.now, publicOrigin: ORIGIN, secureCookies: options.secureCookies ?? false, trustProxy: false });
  const server = createServer((req, res) => void api(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.close();
    done();
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const send = (path: string, init: RequestInit & { json?: unknown; cookie?: string; origin?: string | null } = {}) => {
    const headers: Record<string, string> = {};
    if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
    if (init.cookie) headers.cookie = init.cookie;
    if (init.json !== undefined) headers["content-type"] = "application/json";
    return fetch(`${base}${path}`, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  };
  return { db, send };
}
const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0];
const ME = { username: "Emi", password: "correct horse" };

test("signing up sets a safe cookie, and it then says who you are", async (t) => {
  const { send } = await apiServer(t, { secureCookies: true });
  const res = await send("/api/signup", { json: ME });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /Secure/i);
  const me = await send("/api/me", { cookie: cookieOf(res) });
  assert.equal(me.status, 200);
  const body = await me.json();
  assert.equal(body.account.username, "Emi");
  assert.equal(body.wins, 0);
  assert.equal(body.losses, 0);
});

test("the cookie isn't marked secure on this machine, or sign-in wouldn't work over http", async (t) => {
  const { send } = await apiServer(t);
  const res = await send("/api/signup", { json: ME });
  assert.doesNotMatch(res.headers.get("set-cookie")!, /Secure/i);
});

test("no session means you're signed out", async (t) => {
  const { send } = await apiServer(t);
  assert.equal((await send("/api/me")).status, 401);
});

test("a taken name gets told why", async (t) => {
  const { send } = await apiServer(t);
  await send("/api/signup", { json: ME });
  const res = await send("/api/signup", { json: { ...ME, username: "emi" } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).problem, /taken/);
});

test("a wrong password and an unknown username look exactly the same", async (t) => {
  const { send } = await apiServer(t);
  await send("/api/signup", { json: ME });
  const wrong = await send("/api/signin", { json: { ...ME, password: "wrong horse" } });
  const unknown = await send("/api/signin", { json: { username: "Nobody", password: "wrong horse" } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(await wrong.text(), await unknown.text());
});

test("signing in and out", async (t) => {
  const { send } = await apiServer(t);
  await send("/api/signup", { json: ME });
  const res = await send("/api/signin", { json: ME });
  assert.equal(res.status, 200);
  const cookie = cookieOf(res);
  assert.equal((await send("/api/me", { cookie })).status, 200);
  const out = await send("/api/signout", { json: {}, cookie });
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie")!, /Max-Age=0/i);
  assert.equal((await send("/api/me", { cookie })).status, 401);
});

test("another website can't post on someone's behalf", async (t) => {
  const { send } = await apiServer(t);
  assert.equal((await send("/api/signup", { json: ME, origin: "https://evil.example" })).status, 403);
  assert.equal((await send("/api/signup", { json: ME, origin: null })).status, 403);
});

test("the sixth failed sign-in for a name is refused, even with the right password", async (t) => {
  const { send } = await apiServer(t);
  await send("/api/signup", { json: ME });
  for (let i = 0; i < 5; i++) assert.equal((await send("/api/signin", { json: { ...ME, password: "wrong horse" } })).status, 401);
  assert.equal((await send("/api/signin", { json: ME })).status, 429);
});

test("failed sign-ins wear off", async (t) => {
  let clock = 1_000_000;
  const { send } = await apiServer(t, { now: () => clock });
  await send("/api/signup", { json: ME });
  for (let i = 0; i < 5; i++) await send("/api/signin", { json: { ...ME, password: "wrong horse" } });
  clock += 15 * 60 * 1000 + 1;
  assert.equal((await send("/api/signin", { json: ME })).status, 200);
});

test("guessing all at once gets no more tries than guessing one at a time", async (t) => {
  const { send } = await apiServer(t);
  await send("/api/signup", { json: ME });
  const replies = await Promise.all(Array.from({ length: 12 }, () => send("/api/signin", { json: { ...ME, password: "wrong horse" } })));
  const statuses = replies.map((reply) => reply.status);
  assert.equal(statuses.filter((status) => status === 401).length, 5);
  assert.equal(statuses.filter((status) => status === 429).length, 7);
});

test("signing in properly doesn't use up any tries", async (t) => {
  const { send } = await apiServer(t);
  await send("/api/signup", { json: ME });
  for (let i = 0; i < 8; i++) assert.equal((await send("/api/signin", { json: ME })).status, 200);
});

test("making accounts all at once doesn't get past the limit", async (t) => {
  const { send } = await apiServer(t);
  const replies = await Promise.all(Array.from({ length: 8 }, (_, i) => send("/api/signup", { json: { username: `player_${i}x`, password: "correct horse" } })));
  assert.equal(replies.filter((reply) => reply.status === 200).length, 5);
});

test("probing for taken names runs out too", async (t) => {
  const { send } = await apiServer(t);
  await send("/api/signup", { json: ME });
  const statuses: number[] = [];
  for (let i = 0; i < 25; i++) statuses.push((await send("/api/signup", { json: ME })).status);
  assert.ok(statuses.includes(429));
  assert.equal(statuses[0], 400);
});

test("only so many accounts can be made from one address", async (t) => {
  const { send } = await apiServer(t);
  for (let i = 0; i < 5; i++) assert.equal((await send("/api/signup", { json: { username: `player_${i}x`, password: "correct horse" } })).status, 200);
  assert.equal((await send("/api/signup", { json: { username: "one_more", password: "correct horse" } })).status, 429);
});

test("bad bodies are refused", async (t) => {
  const { send } = await apiServer(t);
  assert.equal((await send("/api/signup", { method: "POST", body: "{nope" })).status, 400);
  assert.equal((await send("/api/signup", { json: [] })).status, 400);
  assert.equal((await send("/api/signup", { json: { username: 5, password: null } })).status, 400);
  assert.equal((await send("/api/signup", { method: "POST", body: JSON.stringify({ username: "x".repeat(5000) }) })).status, 413);
  assert.equal((await send("/api/nothing-here")).status, 404);
});

test("finishing the tutorial is remembered on the account", async (t) => {
  const { send } = await apiServer(t);
  const cookie = cookieOf(await send("/api/signup", { json: ME }));
  assert.equal((await send("/api/me/tutorial", { json: {} })).status, 401);
  assert.equal((await send("/api/me/tutorial", { json: {}, cookie })).status, 200);
  assert.equal((await (await send("/api/me", { cookie })).json()).account.tutorial, true);
});

test("the cookie can be found among others", () => {
  const req = (cookie?: string) => ({ headers: { cookie } }) as unknown as IncomingMessage;
  assert.equal(sessionToken(req("a=1; tk_session=abc; b=2")), "abc");
  assert.equal(sessionToken(req("a=1")), undefined);
  assert.equal(sessionToken(req()), undefined);
});

test("only the game's own address counts as the origin", () => {
  assert.equal(originAllowed(ORIGIN, ORIGIN), true);
  assert.equal(originAllowed("https://kendo.example.evil.com", ORIGIN), false);
  assert.equal(originAllowed(undefined, ORIGIN), false);
});

test("a rate limit counts within its window", () => {
  const limit = createRateLimit(2, 100);
  assert.equal(limit.hit("a", 0), true);
  assert.equal(limit.hit("a", 1), true);
  assert.equal(limit.over("a", 1), true);
  assert.equal(limit.hit("a", 2), false);
  assert.equal(limit.over("b", 2), false);
  assert.equal(limit.over("a", 101), false);
});

test("signing in brings your real record, and history's yours alone", async (t) => {
  const { db, send } = await apiServer(t);
  const emi = await (await send("/api/signup", { json: ME })).json();
  const kenRes = await send("/api/signup", { json: { username: "Ken", password: "correct horse" } });
  const ken = await kenRes.json();
  await recordMatch(db, { players: [emi.account.id, ken.account.id], winner: emi.account.id, reason: "played", playedAt: 5 });
  const signedIn = await send("/api/signin", { json: ME });
  const body = await signedIn.json();
  assert.equal(body.wins, 1);
  assert.equal(body.losses, 0);
  const mine = await (await send("/api/history", { cookie: cookieOf(signedIn) })).json();
  assert.deepEqual(mine, [{ opponent: "Ken", result: "won", reason: "played", playedAt: 5 }]);
  assert.equal((await (await send("/api/me", { cookie: cookieOf(kenRes) })).json()).losses, 1);
  assert.equal((await send("/api/history")).status, 401);
});

const validSave = (dan = 2) => JSON.stringify({ version: 1, run: { ...createRunState(), dan } });

test("a story goes up and comes back, and only for its owner", async (t) => {
  const { send } = await apiServer(t);
  const cookie = cookieOf(await send("/api/signup", { json: ME }));
  const other = cookieOf(await send("/api/signup", { json: { username: "Ken", password: "correct horse" } }));
  assert.equal((await send("/api/story")).status, 401);
  assert.equal((await (await send("/api/story", { cookie })).json()).revision, 0);
  const put = await send("/api/story", { method: "PUT", json: { baseRevision: 0, data: validSave() }, cookie });
  assert.equal(put.status, 200);
  assert.equal((await put.json()).revision, 1);
  assert.equal((await (await send("/api/story", { cookie })).json()).data, validSave());
  assert.equal((await (await send("/api/story", { cookie: other })).json()).data, null);
});

test("a stale story gets a 409 with what's there now", async (t) => {
  const { send } = await apiServer(t);
  const cookie = cookieOf(await send("/api/signup", { json: ME }));
  await send("/api/story", { method: "PUT", json: { baseRevision: 0, data: validSave(1) }, cookie });
  const stale = await send("/api/story", { method: "PUT", json: { baseRevision: 0, data: validSave(2) }, cookie });
  assert.equal(stale.status, 409);
  const body = await stale.json();
  assert.equal(body.current.revision, 1);
  assert.equal(body.current.data, validSave(1));
});

test("a story can be removed by writing nothing", async (t) => {
  const { send } = await apiServer(t);
  const cookie = cookieOf(await send("/api/signup", { json: ME }));
  await send("/api/story", { method: "PUT", json: { baseRevision: 0, data: validSave() }, cookie });
  const removed = await send("/api/story", { method: "PUT", json: { baseRevision: 1, data: null }, cookie });
  assert.equal(removed.status, 200);
  assert.equal((await (await send("/api/story", { cookie })).json()).data, null);
});

test("what isn't a real save is refused", async (t) => {
  const { send } = await apiServer(t);
  const cookie = cookieOf(await send("/api/signup", { json: ME }));
  for (const data of ["not json", JSON.stringify({ version: 1, run: { node: "nowhere" } }), JSON.stringify({ version: 99, run: {} }), 5]) {
    assert.equal((await send("/api/story", { method: "PUT", json: { baseRevision: 0, data }, cookie })).status, 400, String(data));
  }
  assert.equal((await send("/api/story", { method: "PUT", json: { data: validSave() }, cookie })).status, 400);
  assert.equal((await send("/api/story", { method: "PUT", body: JSON.stringify({ baseRevision: 0, data: "x".repeat(300 * 1024) }), cookie })).status, 413);
  assert.equal((await (await send("/api/story", { cookie })).json()).revision, 0);
});

test("another website can't overwrite a story", async (t) => {
  const { send } = await apiServer(t);
  const cookie = cookieOf(await send("/api/signup", { json: ME }));
  assert.equal((await send("/api/story", { method: "PUT", json: { baseRevision: 0, data: validSave() }, cookie, origin: "https://evil.example" })).status, 403);
});

test("a limit's use can be handed back", () => {
  const limit = createRateLimit(1, 100);
  assert.equal(limit.hit("a", 0), true);
  limit.undo("a", 1);
  assert.equal(limit.hit("a", 2), true);
  assert.equal(limit.hit("a", 3), false);
});

test("only so many of a costly job run at once, and the rest wait their turn", async () => {
  const slots = createSlots(2);
  let running = 0;
  let peak = 0;
  const job = () =>
    slots.run(async () => {
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setImmediate(resolve));
      running--;
      return "done";
    });
  assert.deepEqual(await Promise.all(Array.from({ length: 6 }, job)), Array(6).fill("done"));
  assert.equal(peak, 2);
  await assert.rejects(slots.run(() => Promise.reject(new Error("boom"))));
  assert.equal(await job(), "done");
});

test("behind the host, the address comes from what Cloudflare sets, because a visitor can fake the rest", () => {
  assert.deepEqual(clientAddress({ "cf-connecting-ip": "1.1.1.1", "true-client-ip": "2.2.2.2", "x-forwarded-for": "6.6.6.6, 1.1.1.1" }, "10.0.0.1", true), { address: "1.1.1.1", source: "cf-connecting-ip" });
  assert.deepEqual(clientAddress({ "true-client-ip": "2.2.2.2", "x-forwarded-for": "6.6.6.6" }, "10.0.0.1", true), { address: "2.2.2.2", source: "true-client-ip" });
  assert.deepEqual(clientAddress({ "x-forwarded-for": "6.6.6.6, 1.1.1.1" }, "10.0.0.1", true), { address: "6.6.6.6", source: "x-forwarded-for" });
  assert.deepEqual(clientAddress({}, "10.0.0.1", true), { address: "10.0.0.1", source: "socket" });
});

test("not behind a proxy, every such header is ignored, so nobody can fake one", () => {
  assert.deepEqual(clientAddress({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6" }, "10.0.0.1", false), { address: "10.0.0.1", source: "socket" });
  assert.deepEqual(clientAddress({}, undefined, false), { address: "unknown", source: "socket" });
});

test('keybindings are authenticated, isolated by account, and reject malformed or misdirected writes', async (t) => {
  const { send } = await apiServer(t);
  const first = await send('/api/signup', { json: ME });
  const second = await send('/api/signup', { json: { username: 'Ken', password: 'battery staple' } });
  const a = cookieOf(first), b = cookieOf(second);
  const accountId = (await first.json()).account.id;
  assert.equal((await send('/api/keybindings')).status, 401);
  assert.equal((await (await send('/api/keybindings', { cookie: a })).json()).bindings, null);
  const bindings = { ...DEFAULT_BINDINGS, men: ['u'] };
  assert.equal((await send('/api/keybindings', { method: 'PUT', cookie: a, json: { accountId, bindings } })).status, 200);
  assert.deepEqual((await (await send('/api/keybindings', { cookie: a })).json()).bindings, bindings);
  assert.equal((await (await send('/api/keybindings', { cookie: b })).json()).bindings, null);
  assert.equal((await send('/api/keybindings', { method: 'PUT', cookie: b, json: { accountId, bindings } })).status, 409);
  assert.equal((await send('/api/keybindings', { method: 'PUT', cookie: a, json: { accountId, bindings: { ...bindings, men: [] } } })).status, 400);
});
