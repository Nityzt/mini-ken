import test from "node:test";
import assert from "node:assert/strict";
import type { ClientMessage, Identity, ServerMessage } from "../game/net/protocol.ts";
import { createLobbyHub, LOBBY_EMPTY_MS, REPORT_WAIT_MS, SILENCE_MS, START_COUNTDOWN_MS, VISIBLE_WAIT_MS, type MatchResult, type Player } from "./lobby.ts";

type TestPlayer = Player & { got: ServerMessage[]; closed: boolean; last(t: ServerMessage["t"]): ServerMessage | undefined };

const player = (id: string): TestPlayer => {
  const identity: Identity = { id, name: id.toUpperCase(), dan: 1, guest: false };
  const self: TestPlayer = {
    id,
    identity,
    got: [],
    closed: false,
    send: (message) => void self.got.push(message),
    close: () => void (self.closed = true),
    last: (t) => self.got.findLast((message) => message.t === t),
  };
  return self;
};

function setup() {
  const results: MatchResult[] = [];
  let codes = 0;
  let seeds = 0;
  const hub = createLobbyHub({
    rollCode: () => `CODE${++codes}`,
    rollSeed: () => ++seeds,
    record: async (result) => {
      results.push(result);
      return { wins: [1, 0], losses: [0, 1] };
    },
  });
  const a = player("a");
  const b = player("b");
  hub.connect(a, 0);
  hub.connect(b, 0);
  const lobby = () => {
    hub.message(a, { t: "create-lobby" }, 0);
    const created = a.last("lobby");
    assert.ok(created?.t === "lobby");
    return created.code;
  };
  const inMatch = () => {
    hub.message(a, { t: "visible", visible: true }, 0);
    hub.message(b, { t: "visible", visible: true }, 0);
    hub.message(b, { t: "join-lobby", code: lobby() }, 0);
    const match = a.last("match");
    assert.ok(match?.t === "match");
    const [first, second] = match.side === 0 ? [a, b] : [b, a];
    return { first, second };
  };
  return { hub, a, b, results, lobby, inMatch };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));

test("creating a lobby gives a code, and joining works in any case", () => {
  const { hub, a, b, lobby } = setup();
  const code = lobby();
  hub.message(b, { t: "join-lobby", code }, 0);
  const seenByA = a.last("opponent-joined");
  const seenByB = b.last("opponent-joined");
  assert.ok(seenByA?.t === "opponent-joined" && seenByA.opponent.id === "b");
  assert.ok(seenByB?.t === "opponent-joined" && seenByB.opponent.id === "a");
});

test("wrong codes, full lobbies and your own lobby are each refused", () => {
  const { hub, a, b, lobby } = setup();
  hub.message(b, { t: "join-lobby", code: "NOPE2" }, 0);
  assert.deepEqual(b.last("lobby-error"), { t: "lobby-error", reason: "no-such-lobby" });
  const code = lobby();
  hub.message(a, { t: "join-lobby", code }, 0);
  assert.deepEqual(a.last("lobby-error"), { t: "lobby-error", reason: "own-lobby" });
  hub.message(b, { t: "join-lobby", code }, 0);
  const c = player("c");
  hub.connect(c, 0);
  hub.message(c, { t: "join-lobby", code }, 0);
  assert.deepEqual(c.last("lobby-error"), { t: "lobby-error", reason: "full" });
});

test("opening your own invite in a second tab refuses it, and your lobby is untouched", () => {
  const { hub, a, b, lobby } = setup();
  const code = lobby();
  const again = player("a");
  hub.connect(again, 1);
  assert.equal(a.closed, false);
  hub.message(again, { t: "join-lobby", code }, 1);
  assert.deepEqual(again.last("lobby-error"), { t: "lobby-error", reason: "own-lobby" });
  assert.equal(a.closed, false);
  assert.equal(a.last("lobby-closed"), undefined);
  hub.disconnect(again, 2);
  hub.message(b, { t: "join-lobby", code }, 3);
  assert.ok(a.last("opponent-joined"));
});

test("a second connection replaces the first once it does something, and not before", () => {
  const { hub, a, lobby } = setup();
  lobby();
  const again = player("a");
  hub.connect(again, 1);
  hub.message(again, { t: "visible", visible: true }, 1);
  hub.message(again, { t: "ping" }, 1);
  assert.equal(a.closed, false);
  hub.message(again, { t: "create-lobby" }, 2);
  assert.equal(a.closed, true);
  assert.ok(again.last("lobby"));
});

test("a second connection joining someone else's lobby replaces the first", () => {
  const { hub, a, b } = setup();
  hub.message(b, { t: "create-lobby" }, 0);
  const created = b.last("lobby");
  assert.ok(created?.t === "lobby");
  const again = player("a");
  hub.connect(again, 1);
  hub.message(again, { t: "join-lobby", code: created.code }, 2);
  assert.equal(a.closed, true);
  assert.ok(again.last("opponent-joined"));
});

test("a replaced connection's late goodbye doesn't remove the new one", () => {
  const { hub, a } = setup();
  const again = player("a");
  hub.connect(again, 1);
  hub.message(again, { t: "create-lobby" }, 1);
  hub.disconnect(a, 2);
  assert.ok(again.last("lobby"));
  hub.message(a, { t: "create-lobby" }, 4);
  assert.equal(a.last("lobby"), undefined);
  hub.message(again, { t: "ping" }, 5);
  assert.equal(again.closed, false);
});

test("a replaced connection in a match loses it", async () => {
  const { hub, inMatch, results } = setup();
  const { first, second } = inMatch();
  const again = player(first.id);
  hub.connect(again, 1);
  hub.message(again, { t: "create-lobby" }, 1);
  await settled();
  assert.equal(results.length, 1);
  assert.equal(results[0].winner, second.id);
  assert.equal(results[0].reason, "left");
});

test("a third tab supersedes a second that's done nothing", () => {
  const { hub, a } = setup();
  const second = player("a");
  const third = player("a");
  hub.connect(second, 1);
  hub.connect(third, 2);
  assert.equal(second.closed, true);
  assert.equal(a.closed, false);
});

test("the match waits until both tabs are in view, then both get the same seed and opposite sides", () => {
  const { hub, a, b, lobby } = setup();
  hub.message(b, { t: "join-lobby", code: lobby() }, 0);
  assert.equal(a.last("match"), undefined);
  hub.message(a, { t: "visible", visible: true }, 1);
  assert.equal(a.last("match"), undefined);
  hub.message(b, { t: "visible", visible: true }, 2);
  const one = a.last("match");
  const two = b.last("match");
  assert.ok(one?.t === "match" && two?.t === "match");
  assert.equal(one.seed, two.seed);
  assert.notEqual(one.side, two.side);
  assert.equal(one.opponent.id, "b");
  assert.equal(two.opponent.id, "a");
});

test("hiding the tab again before the start keeps it waiting", () => {
  const { hub, a, b, lobby } = setup();
  hub.message(a, { t: "visible", visible: true }, 0);
  hub.message(a, { t: "visible", visible: false }, 0);
  hub.message(b, { t: "visible", visible: true }, 0);
  hub.message(b, { t: "join-lobby", code: lobby() }, 0);
  assert.equal(a.last("match"), undefined);
});

test("each player only has to have been looking once, so two windows on one computer can still start", () => {
  const { hub, a, b, lobby } = setup();
  hub.message(b, { t: "join-lobby", code: lobby() }, 0);
  hub.message(a, { t: "visible", visible: true }, 1);
  hub.message(a, { t: "visible", visible: false }, 2);
  assert.equal(a.last("match"), undefined);
  hub.message(b, { t: "visible", visible: true }, 3);
  assert.ok(a.last("match"));
  assert.ok(b.last("match"));
});

test("having looked before anyone joined doesn't count as having seen them arrive", () => {
  const { hub, a, b, lobby } = setup();
  hub.message(a, { t: "visible", visible: true }, 0);
  hub.message(a, { t: "visible", visible: false }, 0);
  hub.message(b, { t: "visible", visible: true }, 0);
  hub.message(b, { t: "join-lobby", code: lobby() }, 1);
  assert.equal(a.last("match"), undefined);
  hub.message(a, { t: "visible", visible: true }, 2);
  assert.ok(a.last("match"));
});

test("someone who never comes back closes the lobby with nothing recorded", async () => {
  const { hub, a, b, lobby, results } = setup();
  hub.message(b, { t: "visible", visible: true }, 0);
  hub.message(b, { t: "join-lobby", code: lobby() }, 0);
  hub.tick(VISIBLE_WAIT_MS - 1);
  assert.equal(a.last("lobby-closed"), undefined);
  hub.tick(VISIBLE_WAIT_MS);
  assert.deepEqual(a.last("lobby-closed"), { t: "lobby-closed", reason: "not-back-in-time" });
  assert.deepEqual(b.last("lobby-closed"), { t: "lobby-closed", reason: "not-back-in-time" });
  await settled();
  assert.equal(results.length, 0);
});

test("an empty lobby closes after ten minutes, and pinging doesn't keep it open", () => {
  const { hub, a, b, lobby } = setup();
  const code = lobby();
  hub.message(a, { t: "ping" }, LOBBY_EMPTY_MS - 1);
  hub.tick(LOBBY_EMPTY_MS - 1);
  assert.equal(a.last("lobby-closed"), undefined);
  hub.tick(LOBBY_EMPTY_MS);
  assert.deepEqual(a.last("lobby-closed"), { t: "lobby-closed", reason: "expired" });
  hub.message(b, { t: "join-lobby", code }, LOBBY_EMPTY_MS);
  assert.deepEqual(b.last("lobby-error"), { t: "lobby-error", reason: "no-such-lobby" });
});

test("the creator leaving closes the lobby for anyone who's joined", () => {
  const { hub, a, b, lobby } = setup();
  hub.message(b, { t: "join-lobby", code: lobby() }, 0);
  hub.message(a, { t: "leave-lobby" }, 1);
  assert.deepEqual(b.last("lobby-closed"), { t: "lobby-closed", reason: "creator-left" });
});

test("match messages reach only the opponent, unchanged, and only during a match", () => {
  const { hub, a, b, inMatch } = setup();
  const { first, second } = inMatch();
  const c = player("c");
  hub.connect(c, 0);
  const messages: ClientMessage[] = [{ t: "input", frame: 3, bits: 9 }, { t: "hash", frame: 60, hash: 7 }];
  for (const message of messages) hub.message(first, message, 1);
  assert.deepEqual(second.got.slice(-2), messages);
  assert.equal(first.last("input"), undefined);
  assert.equal(c.got.length, 0);
  hub.message(c, { t: "input", frame: 3, bits: 9 }, 1);
  assert.equal(a.got.length + b.got.length, first.got.length + second.got.length);
  assert.equal(second.got.filter((message) => message.t === "input").length, 1);
});

test("a match settles when both report, with each player told their side of it", async () => {
  const { hub, inMatch, results } = setup();
  const { first, second } = inMatch();
  hub.message(first, { t: "result", report: "won" }, 5);
  assert.equal(results.length, 0);
  hub.message(second, { t: "result", report: "lost" }, 6);
  await settled();
  assert.deepEqual(results, [{ players: [first.id, second.id], winner: first.id, reason: "played", playedAt: 6 }]);
  assert.deepEqual(first.last("outcome"), { t: "outcome", winner: "you", reason: "played", wins: 1, losses: 0 });
  assert.deepEqual(second.last("outcome"), { t: "outcome", winner: "them", reason: "played", wins: 0, losses: 1 });
});

test("a second result from one player can't change anything, and it's only recorded once", async () => {
  const { hub, inMatch, results } = setup();
  const { first, second } = inMatch();
  hub.message(first, { t: "result", report: "won" }, 5);
  hub.message(first, { t: "result", report: "lost" }, 5);
  hub.message(second, { t: "result", report: "lost" }, 6);
  hub.message(second, { t: "result", report: "won" }, 6);
  hub.disconnect(second, 7);
  await settled();
  assert.equal(results.length, 1);
  assert.equal(results[0].winner, first.id);
});

test("disconnecting during a match loses it", async () => {
  const { hub, inMatch, results } = setup();
  const { first, second } = inMatch();
  hub.disconnect(first, 5);
  await settled();
  assert.equal(results[0].winner, second.id);
  assert.equal(results[0].reason, "left");
  const told = second.last("outcome");
  assert.ok(told?.t === "outcome" && told.winner === "you");
});

test("conceding passes the leave on and loses the match", async () => {
  const { hub, inMatch, results } = setup();
  const { first, second } = inMatch();
  hub.message(first, { t: "leave" }, 5);
  await settled();
  assert.ok(second.last("leave"));
  assert.equal(results[0].winner, second.id);
  assert.equal(results[0].reason, "left");
});

test("going silent loses, and the player left waiting isn't blamed even though they've stopped too", async () => {
  const { hub, inMatch, results } = setup();
  const { first, second } = inMatch();
  hub.message(first, { t: "input", frame: 3, bits: 0 }, 1000);
  hub.message(second, { t: "input", frame: 3, bits: 0 }, 1000);
  hub.message(second, { t: "input", frame: 6, bits: 0 }, 1050);
  hub.tick(1000 + SILENCE_MS - 1);
  assert.equal(results.length, 0);
  hub.tick(1050 + SILENCE_MS + 5000);
  await settled();
  assert.equal(results[0].winner, second.id);
  assert.equal(results[0].reason, "silent");
});

test("the silence clock allows for the countdown before the first input", async () => {
  const { hub, inMatch, results } = setup();
  inMatch();
  hub.tick(START_COUNTDOWN_MS + SILENCE_MS - 1);
  await settled();
  assert.equal(results.length, 0);
});

test("nobody sending anything at all doesn't count for either of them", async () => {
  const { hub, inMatch, results } = setup();
  inMatch();
  hub.tick(START_COUNTDOWN_MS + SILENCE_MS);
  await settled();
  assert.equal(results[0].winner, null);
  assert.equal(results[0].reason, "silent");
});

test("once someone's reported, silence is judged by the report wait instead", async () => {
  const { hub, inMatch, results } = setup();
  const { first } = inMatch();
  hub.message(first, { t: "result", report: "won" }, 100);
  hub.tick(100 + REPORT_WAIT_MS - 1);
  await settled();
  assert.equal(results.length, 0);
  hub.tick(100 + REPORT_WAIT_MS);
  await settled();
  assert.equal(results[0].winner, null);
  assert.equal(results[0].reason, "unreported");
});

test("a rematch needs both players, and tells each about the other", async () => {
  const { hub, inMatch } = setup();
  const { first, second } = inMatch();
  const matchesSoFar = first.got.filter((message) => message.t === "match").length;
  hub.message(first, { t: "result", report: "won" }, 5);
  hub.message(second, { t: "result", report: "lost" }, 6);
  await settled();
  hub.message(first, { t: "rematch" }, 7);
  assert.ok(second.last("rematch-wanted"));
  assert.equal(first.got.filter((message) => message.t === "match").length, matchesSoFar);
  hub.message(second, { t: "rematch" }, 8);
  assert.equal(first.got.filter((message) => message.t === "match").length, matchesSoFar + 1);
  assert.equal(second.got.filter((message) => message.t === "match").length, matchesSoFar + 1);
});

test("leaving between matches ends the lobby, without another result", async () => {
  const { hub, inMatch, results } = setup();
  const { first, second } = inMatch();
  hub.message(first, { t: "result", report: "won" }, 5);
  hub.message(second, { t: "result", report: "lost" }, 6);
  await settled();
  hub.disconnect(second, 7);
  assert.deepEqual(first.last("lobby-closed"), { t: "lobby-closed", reason: "opponent-left" });
  await settled();
  assert.equal(results.length, 1);
});

test("a lobby idle between matches eventually closes", async () => {
  const { hub, inMatch } = setup();
  const { first, second } = inMatch();
  hub.message(first, { t: "result", report: "won" }, 5);
  hub.message(second, { t: "result", report: "lost" }, 6);
  await settled();
  hub.tick(6 + LOBBY_EMPTY_MS);
  assert.deepEqual(first.last("lobby-closed"), { t: "lobby-closed", reason: "expired" });
});

test("the outcome still arrives if the record can't be saved", async () => {
  const a = player("a");
  const b = player("b");
  const hub = createLobbyHub({ rollCode: () => "ABCDE", rollSeed: () => 1, record: () => Promise.reject(new Error("database down")) });
  hub.connect(a, 0);
  hub.connect(b, 0);
  hub.message(a, { t: "visible", visible: true }, 0);
  hub.message(b, { t: "visible", visible: true }, 0);
  hub.message(a, { t: "create-lobby" }, 0);
  hub.message(b, { t: "join-lobby", code: "ABCDE" }, 0);
  hub.disconnect(a, 1);
  await settled();
  assert.ok(b.last("outcome"));
});
