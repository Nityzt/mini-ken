import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { parseServerMessage, PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from "../game/net/protocol.ts";
import { createSession, signUp } from "./accounts.ts";
import { createRelay } from "./relay.ts";
import { tempDb } from "./test-db.ts";
import { DEFAULT_INSIGNIA } from "../game/insignia.ts";

const ORIGIN = "https://kendo.example";

async function setup(t: TestContext) {
  const { db, done } = await tempDb();
  const relay = createRelay({ db, now: Date.now, publicOrigin: ORIGIN });
  const server = createServer();
  server.on("upgrade", (req, socket, head) => relay.handleUpgrade(req, socket, head));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
  const sockets: WebSocket[] = [];
  t.after(() => {
    for (const socket of sockets) socket.terminate();
    relay.close();
    server.close();
    done();
  });
  const account = async (name: string) => {
    const result = await signUp(db, name, "correct horse");
    assert.ok("account" in result);
    return { ...result.account, token: await createSession(db, result.account.id, Date.now()) };
  };
  const open = (token?: string, origin: string | null = ORIGIN) => {
    const socket = new WebSocket(url, { headers: { ...(token ? { cookie: `tk_session=${token}` } : {}), ...(origin ? { origin } : {}) } });
    sockets.push(socket);
    return socket;
  };
  return { db, account, open };
}

/** A connection that keeps what it's been told, and can wait for something in particular. */
function client(socket: WebSocket) {
  const got: ServerMessage[] = [];
  const waiting: { want: ServerMessage["t"]; resolve(message: ServerMessage): void }[] = [];
  socket.on("message", (data) => {
    const message = parseServerMessage(String(data));
    assert.ok(message, String(data));
    got.push(message);
    for (const wait of [...waiting]) {
      if (wait.want === message.t) {
        waiting.splice(waiting.indexOf(wait), 1);
        wait.resolve(message);
      }
    }
  });
  return {
    got,
    send: (message: ClientMessage) => socket.send(JSON.stringify(message)),
    next<T extends ServerMessage["t"]>(want: T) {
      const seen = got.find((message) => message.t === want);
      if (seen) {
        got.splice(got.indexOf(seen), 1);
        return Promise.resolve(seen as Extract<ServerMessage, { t: T }>);
      }
      return new Promise<Extract<ServerMessage, { t: T }>>((resolve) => {
        waiting.push({
          want,
          resolve(message) {
            got.splice(got.indexOf(message), 1);
            resolve(message as Extract<ServerMessage, { t: T }>);
          },
        });
      });
    },
  };
}
const refused = (socket: WebSocket) =>
  new Promise<number>((resolve, reject) => {
    socket.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    socket.once("open", () => reject(new Error("It let them in")));
    socket.once("error", () => {});
  });
const closed = (socket: WebSocket) => new Promise<void>((resolve) => socket.once("close", () => resolve()));
const opened = (socket: WebSocket) => new Promise<void>((resolve) => socket.once("open", () => resolve()));

test("no session, an expired session or another website gets no connection", async (t) => {
  const { account, open } = await setup(t);
  assert.equal(await refused(open()), 401);
  assert.equal(await refused(open("made-up-token")), 401);
  const emi = await account("Emi");
  assert.equal(await refused(open(emi.token, "https://evil.example")), 403);
  assert.equal(await refused(open(emi.token, null)), 403);
});

test("identity comes from the session, whatever a client says", async (t) => {
  const { account, open } = await setup(t);
  const emi = await account("Emi");
  const socket = open(emi.token);
  const me = client(socket);
  await opened(socket);
  socket.send(JSON.stringify({ t: "hello", version: PROTOCOL_VERSION, identity: { id: "someone-else", name: "Ken", dan: 8 } }));
  const { identity } = await me.next("welcome");
  assert.equal(identity.id, emi.id);
  assert.equal(identity.name, "Emi");
  assert.equal(identity.dan, 1);
  assert.equal(identity.guest, false);
});

test("the relay limits an appearance to colors unlocked by the account record", async (t) => {
  const { account, open } = await setup(t);
  const socket = open((await account("Emi")).token);
  const me = client(socket);
  await opened(socket);
  const appearance = { character: "emi", armor: "radish", insignia: DEFAULT_INSIGNIA } as const;
  me.send({ t: "hello", version: PROTOCOL_VERSION, appearance });
  const { identity } = await me.next("welcome");
  assert.deepEqual(identity.appearance, { ...appearance, armor: "pine" });
});

test("an old client is asked to refresh", async (t) => {
  const { account, open } = await setup(t);
  const socket = open((await account("Emi")).token);
  const me = client(socket);
  await opened(socket);
  const gone = closed(socket);
  me.send({ t: "hello", version: PROTOCOL_VERSION - 1 });
  assert.match((await me.next("rejected")).reason, /refresh/i);
  await gone;
});

test("nothing happens before hello", async (t) => {
  const { account, open } = await setup(t);
  const socket = open((await account("Emi")).token);
  const me = client(socket);
  await opened(socket);
  const gone = closed(socket);
  me.send({ t: "create-lobby" });
  await me.next("rejected");
  await gone;
});

test("two players go from a lobby to a recorded result", async (t) => {
  const { db, account, open } = await setup(t);
  const emi = await account("Emi");
  const ken = await account("Ken");
  const emiSocket = open(emi.token);
  const kenSocket = open(ken.token);
  const a = client(emiSocket);
  const b = client(kenSocket);
  await Promise.all([opened(emiSocket), opened(kenSocket)]);
  const appearance = { character: "emi", armor: "ink", insignia: { symbol: "star", cloth: "red", mark: "cream" } } as const;
  for (const player of [a, b]) {
    player.send({ t: "hello", version: PROTOCOL_VERSION, appearance });
    player.send({ t: "visible", visible: true });
  }
  await Promise.all([a.next("welcome"), b.next("welcome")]);
  a.send({ t: "create-lobby" });
  const { code } = await a.next("lobby");
  assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
  b.send({ t: "join-lobby", code });
  const [matchA, matchB] = await Promise.all([a.next("match"), b.next("match")]);
  assert.equal(matchA.seed, matchB.seed);
  assert.notEqual(matchA.side, matchB.side);
  assert.deepEqual(matchA.opponent.appearance, appearance);
  assert.deepEqual(matchB.opponent.appearance, appearance);
  a.send({ t: "input", frame: 3, bits: 5 });
  assert.deepEqual(await b.next("input"), { t: "input", frame: 3, bits: 5 });
  a.send({ t: "result", report: "won" });
  b.send({ t: "result", report: "lost" });
  const [outcomeA, outcomeB] = await Promise.all([a.next("outcome"), b.next("outcome")]);
  assert.deepEqual(outcomeA, { t: "outcome", winner: "you", reason: "played", wins: 1, losses: 0 });
  assert.deepEqual(outcomeB, { t: "outcome", winner: "them", reason: "played", wins: 0, losses: 1 });
  const { rows } = await db.execute("SELECT * FROM matches");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].winner, emi.id);
});

test("a dropped connection mid-match reaches the other player as a win", async (t) => {
  const { account, open } = await setup(t);
  const emi = await account("Emi");
  const ken = await account("Ken");
  const emiSocket = open(emi.token);
  const kenSocket = open(ken.token);
  const a = client(emiSocket);
  const b = client(kenSocket);
  await Promise.all([opened(emiSocket), opened(kenSocket)]);
  for (const player of [a, b]) {
    player.send({ t: "hello", version: PROTOCOL_VERSION });
    player.send({ t: "visible", visible: true });
  }
  a.send({ t: "create-lobby" });
  b.send({ t: "join-lobby", code: (await a.next("lobby")).code });
  await a.next("match");
  await b.next("match");
  emiSocket.terminate();
  const outcome = await b.next("outcome");
  assert.equal(outcome.winner, "you");
  assert.equal(outcome.reason, "left");
  assert.equal((await b.next("lobby-closed")).reason, "opponent-left");
});

test("an oversized message ends the connection", async (t) => {
  const { account, open } = await setup(t);
  const socket = open((await account("Emi")).token);
  socket.on("error", () => {});
  await opened(socket);
  const gone = closed(socket);
  socket.send("x".repeat(2000));
  await gone;
});

test("sending faster than a match ever could ends the connection", async (t) => {
  const { account, open } = await setup(t);
  const socket = open((await account("Emi")).token);
  const me = client(socket);
  await opened(socket);
  me.send({ t: "hello", version: PROTOCOL_VERSION });
  await me.next("welcome");
  const gone = closed(socket);
  for (let i = 0; i < 400; i++) me.send({ t: "ping" });
  await gone;
});

test("a normal match's rate is fine", async (t) => {
  const { account, open } = await setup(t);
  const socket = open((await account("Emi")).token);
  const me = client(socket);
  await opened(socket);
  me.send({ t: "hello", version: PROTOCOL_VERSION });
  await me.next("welcome");
  for (let i = 0; i < 120; i++) me.send({ t: "ping" });
  me.send({ t: "create-lobby" });
  await me.next("lobby");
  assert.equal(socket.readyState, WebSocket.OPEN);
});

test("a higher rank from the stored story counts", async (t) => {
  const { db, account, open } = await setup(t);
  const emi = await account("Emi");
  const { createRunState } = await import("../game/run-state.ts");
  const run = { ...createRunState(), dan: 3, waza: true };
  await db.execute("INSERT INTO story_saves (account_id, revision, data, updated_at) VALUES (?, 1, ?, 1)", [emi.id, JSON.stringify({ version: 1, run })]);
  const socket = open(emi.token);
  const me = client(socket);
  await opened(socket);
  me.send({ t: "hello", version: PROTOCOL_VERSION });
  assert.equal((await me.next("welcome")).identity.dan, 3);
});

test("a fractional rank from a crafted save can't break an opponent's screen", async (t) => {
  const { db, account, open } = await setup(t);
  const emi = await account("Emi");
  const { createRunState } = await import("../game/run-state.ts");
  await db.execute("INSERT INTO story_saves (account_id, revision, data, updated_at) VALUES (?, 1, ?, 1)", [emi.id, JSON.stringify({ version: 1, run: { ...createRunState(), dan: 1.5, waza: true } })]);
  const socket = open(emi.token);
  const me = client(socket);
  await opened(socket);
  me.send({ t: "hello", version: PROTOCOL_VERSION });
  assert.equal((await me.next("welcome")).identity.dan, 1);
});
