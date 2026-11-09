import test from "node:test";
import assert from "node:assert/strict";
import { createDuel, type FighterInput } from "../duel/rules.ts";
import { createRival, rivalAct, rivalConfig } from "../duel/rival.ts";
import { createLobbyClient, HEARTBEAT_MS, pageAway, resolveServerUrl, type LobbyClient } from "./lobby-client.ts";
import { createLockstep } from "./lockstep.ts";
import { PROTOCOL_VERSION, type ClientMessage } from "./protocol.ts";
import { ONLINE_RULES } from "./stand-in.ts";
import { fakeSocket } from "./test-socket.ts";

const opponent = { id: "o", name: "Other", dan: 1, guest: false };

function setup(options: { join?: string; hidden?: boolean } = {}) {
  const socket = fakeSocket();
  const alerts: number[] = [];
  let hidden = options.hidden ?? false;
  let visibilityChanged: (() => void) | null = null;
  let unsubscribed = false;
  const intervals = new Map<number, () => void>();
  let nextInterval = 1;
  const delays: number[] = [];
  const client = createLobbyClient({
    url: "wss://x/ws",
    open: () => socket,
    join: options.join,
    alert: () => void alerts.push(1),
    visibility: {
      hidden: () => hidden,
      subscribe(cb) {
        visibilityChanged = cb;
        return () => {
          unsubscribed = true;
        };
      },
    },
    setInterval: (run, ms) => {
      intervals.set(nextInterval, run);
      delays.push(ms);
      return nextInterval++;
    },
    clearInterval: (id) => void intervals.delete(id),
  });
  socket.opened();
  return {
    socket,
    client,
    alerts,
    intervals,
    delays,
    sent: () => socket.sent.map((text) => JSON.parse(text) as ClientMessage),
    setHidden(value: boolean) {
      hidden = value;
      visibilityChanged?.();
    },
    wasUnsubscribed: () => unsubscribed,
  };
}
const reachMatch = (world: ReturnType<typeof setup>) => {
  world.socket.arrive({ t: "lobby", code: "ABC23" });
  world.socket.arrive({ t: "opponent-joined", opponent });
  world.socket.arrive({ t: "match", seed: 9, side: 1, opponent });
  const state = world.client.state();
  assert.equal(state.kind, "match");
  return (state as Extract<ReturnType<LobbyClient["state"]>, { kind: "match" }>).match;
};

test("it says hello, whether the tab's in view, and asks for a lobby", () => {
  const { sent, client, socket } = setup();
  assert.deepEqual(sent(), [{ t: "hello", version: PROTOCOL_VERSION }, { t: "visible", visible: true }, { t: "create-lobby" }]);
  assert.equal(client.state().kind, "connecting");
  socket.arrive({ t: "lobby", code: "ABC23" });
  assert.deepEqual(client.state(), { kind: "waiting", code: "ABC23" });
});

test("with an invite it joins instead", () => {
  const { sent, client } = setup({ join: "ABC23" });
  assert.deepEqual(sent()[2], { t: "join-lobby", code: "ABC23" });
  assert.equal(client.state().kind, "joining");
});

test("with the game loop stopped, a join still raises the alert, from the socket alone", () => {
  const { socket, alerts, client } = setup({ hidden: true });
  socket.arrive({ t: "lobby", code: "ABC23" });
  socket.arrive({ t: "opponent-joined", opponent });
  assert.equal(alerts.length, 1);
  assert.deepEqual(client.state(), { kind: "opponent-here", opponent, waitingForVisible: true });
});

test("whoever's joining isn't alerted, since they're the one looking", () => {
  const { socket, alerts } = setup({ join: "ABC23" });
  socket.arrive({ t: "opponent-joined", opponent });
  assert.equal(alerts.length, 0);
});

test("with the game loop stopped, heartbeats and visibility reports keep going", () => {
  const { sent, intervals, delays, setHidden } = setup();
  assert.equal(intervals.size, 1);
  assert.equal(delays[0], HEARTBEAT_MS);
  assert.ok(HEARTBEAT_MS < 60_000);
  [...intervals.values()][0]();
  assert.deepEqual(sent().at(-1), { t: "ping" });
  setHidden(true);
  assert.deepEqual(sent().at(-1), { t: "visible", visible: false });
  setHidden(false);
  assert.deepEqual(sent().at(-1), { t: "visible", visible: true });
});

test("coming back to the tab is reflected while waiting for the start", () => {
  const { socket, client, setHidden } = setup({ hidden: true });
  socket.arrive({ t: "opponent-joined", opponent });
  setHidden(false);
  assert.deepEqual(client.state(), { kind: "opponent-here", opponent, waitingForVisible: false });
});

test("each refusal and closure says why", () => {
  for (const reason of ["no-such-lobby", "full", "own-lobby"]) {
    const { socket, client } = setup({ join: "ABC23" });
    socket.arrive({ t: "lobby-error", reason });
    assert.deepEqual(client.state(), { kind: "closed", reason });
  }
  const { socket, client } = setup();
  socket.arrive({ t: "lobby-closed", reason: "expired" });
  assert.deepEqual(client.state(), { kind: "closed", reason: "expired" });
  const old = setup();
  old.socket.arrive({ t: "rejected", reason: "Please refresh" });
  assert.deepEqual(old.client.state(), { kind: "closed", reason: "rejected", detail: "Please refresh" });
});

test("a server restart at any point just says the connection's gone", () => {
  for (const prepare of [(w: ReturnType<typeof setup>) => w, (w: ReturnType<typeof setup>) => (w.socket.arrive({ t: "lobby", code: "ABC23" }), w), (w: ReturnType<typeof setup>) => (reachMatch(w), w)]) {
    const world = prepare(setup());
    world.socket.drop();
    assert.deepEqual(world.client.state(), { kind: "closed", reason: "lost-connection" });
    assert.equal(world.intervals.size, 0);
    assert.equal(world.wasUnsubscribed(), true);
  }
});

test("a reason already given isn't replaced by the connection then closing", () => {
  const { socket, client } = setup();
  socket.arrive({ t: "lobby-closed", reason: "expired" });
  socket.drop();
  assert.deepEqual(client.state(), { kind: "closed", reason: "expired" });
});

test("leaving closes the socket and stops everything, so nothing leaks", () => {
  const { client, socket, intervals, sent, wasUnsubscribed } = setup();
  socket.arrive({ t: "lobby", code: "ABC23" });
  client.leave();
  assert.deepEqual(sent().at(-1), { t: "leave-lobby" });
  assert.equal(intervals.size, 0);
  assert.equal(wasUnsubscribed(), true);
  assert.equal(socket.readyState === 1 && client.state().kind, "closed");
});

test("a match carries its seed and side, and relays over the same connection", () => {
  const world = setup();
  const match = reachMatch(world);
  assert.equal(match.seed, 9);
  assert.equal(match.side, 1);
  assert.equal(match.opponent.name, "Other");
  world.socket.arrive({ t: "input", frame: 3, bits: 1 });
  assert.deepEqual(match.link.receive(), [{ t: "input", frame: 3, bits: 1 }]);
  match.link.send({ t: "input", frame: 3, bits: 2 });
  assert.deepEqual(world.sent().at(-1), { t: "input", frame: 3, bits: 2 });
});

test("two matches run on one connection, and ending one doesn't close it", () => {
  const world = setup();
  const first = reachMatch(world);
  first.live!.report("won");
  assert.deepEqual(world.sent().at(-1), { t: "result", report: "won" });
  assert.equal(first.live!.outcome(), null);
  world.socket.arrive({ t: "outcome", winner: "you", reason: "played", wins: 1, losses: 0 });
  assert.equal(first.live!.outcome()?.winner, "you");
  first.link.close();
  assert.equal(first.link.closed, false);
  assert.deepEqual(world.client.state(), { kind: "between", opponent, theyWantRematch: false, iWantRematch: false });
  world.socket.arrive({ t: "rematch-wanted" });
  assert.deepEqual(world.client.state(), { kind: "between", opponent, theyWantRematch: true, iWantRematch: false });
  world.client.rematch();
  assert.deepEqual(world.sent().at(-1), { t: "rematch" });
  assert.deepEqual(world.client.state(), { kind: "between", opponent, theyWantRematch: true, iWantRematch: true });
  world.socket.arrive({ t: "match", seed: 10, side: 0, opponent });
  const state = world.client.state();
  assert.ok(state.kind === "match");
  assert.equal(state.match.seed, 10);
  assert.equal(state.match.live!.outcome(), null);
  assert.equal(world.client.outcome(), null);
});

test("what's left unread from one match doesn't reach the next", () => {
  const world = setup();
  const first = reachMatch(world);
  world.socket.arrive({ t: "input", frame: 700, bits: 1 });
  world.socket.arrive({ t: "outcome", winner: null, reason: "silent", wins: 0, losses: 0 });
  world.socket.arrive({ t: "match", seed: 10, side: 0, opponent });
  const state = world.client.state();
  assert.ok(state.kind === "match");
  assert.deepEqual(state.match.link.receive(), []);
  assert.equal(first.seed, 9);
});

test("an outcome survives the lobby closing right after it", () => {
  const world = setup();
  const match = reachMatch(world);
  world.socket.arrive({ t: "outcome", winner: "you", reason: "left", wins: 1, losses: 0 });
  world.socket.arrive({ t: "lobby-closed", reason: "opponent-left" });
  assert.equal(match.live!.outcome()?.reason, "left");
  assert.deepEqual(world.client.state(), { kind: "closed", reason: "opponent-left" });
});

test("nonsense from the server is ignored", () => {
  const { socket, client } = setup();
  socket.arrive("not json");
  socket.arrive({ t: "lobby", code: "O0I1L" });
  assert.equal(client.state().kind, "connecting");
});

test("a whole match stays in step through a relay of two lobby clients", () => {
  // The server's whole job during a match: pass along what each side sends.
  const one = setup();
  const two = setup({ join: "ABC23" });
  const pass = (from: typeof one, to: typeof one) => {
    from.socket.send = (text: string) => {
      const message = JSON.parse(text) as ClientMessage;
      if (message.t === "input" || message.t === "hash" || message.t === "leave") to.socket.arrive(message);
    };
  };
  pass(one, two);
  pass(two, one);
  one.socket.arrive({ t: "match", seed: 1, side: 0, opponent });
  two.socket.arrive({ t: "match", seed: 1, side: 1, opponent });
  const stateA = one.client.state();
  const stateB = two.client.state();
  assert.ok(stateA.kind === "match" && stateB.kind === "match");
  const a = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: stateA.match.link });
  const b = createLockstep({ initial: createDuel(ONLINE_RULES), side: 1, link: stateB.match.link });
  let rival = createRival(3, rivalConfig(0, "steady"));
  const idle: FighterInput = { move: 0, block: false, attack: null };
  for (let i = 0; i < 200_000 && (a.status === "running" || b.status === "running"); i++) {
    const acted = rivalAct(a.state, rival);
    rival = acted.rival;
    a.tick(idle);
    b.tick(acted.input);
  }
  assert.equal(a.status, "finished");
  assert.equal(b.status, "finished");
  assert.equal(a.state.winner, b.state.winner);
});

test("a relative address follows the page, securely when the page is", () => {
  assert.equal(resolveServerUrl("/ws", { protocol: "https:", host: "kendo.example" }), "wss://kendo.example/ws");
  assert.equal(resolveServerUrl("/ws", { protocol: "http:", host: "127.0.0.1:3210" }), "ws://127.0.0.1:3210/ws");
  assert.equal(resolveServerUrl("wss://other.example/ws", { protocol: "http:", host: "x" }), "wss://other.example/ws");
});

test("a window you've switched away from counts as away, even if it's still on screen", () => {
  assert.equal(pageAway({ hidden: false, hasFocus: () => true }), false);
  assert.equal(pageAway({ hidden: false, hasFocus: () => false }), true);
  assert.equal(pageAway({ hidden: true, hasFocus: () => true }), true);
});

test("a closed lobby lets go of its connection, so it can't hold up another tab", () => {
  const { socket, client } = setup({ join: "ABC23" });
  let closes = 0;
  const close = socket.close.bind(socket);
  socket.close = () => {
    closes++;
    close();
  };
  socket.arrive({ t: "lobby-error", reason: "own-lobby" });
  assert.deepEqual(client.state(), { kind: "closed", reason: "own-lobby" });
  assert.equal(closes, 1);
});
