import test from "node:test";
import assert from "node:assert/strict";
import { createDuel, type DuelEvent, type FighterInput } from "../duel/rules.ts";
import { createRival, nextRandom, rivalAct, rivalConfig } from "../duel/rival.ts";
import { createGuestAuth } from "./auth.ts";
import { bracketChampion, bracketStatus, createBracket, finishRound, nextOpponentIn } from "./bracket.ts";
import { createOnlineHub } from "./hub.ts";
import { createLockstep, hashDuel, HASH_EVERY, INPUT_DELAY, STALL_LIMIT } from "./lockstep.ts";
import { createProfile, identityOf, onlineAccess, ONLINE_MIN_DAN, PROFILE_KEY, readProfile, withResult, writeProfile } from "./profile.ts";
import { cleanName, decodeInput, encodeInput, parseServerMessage, PROTOCOL_VERSION, type BracketEntrant, type ClientMessage, type LinkMessage } from "./protocol.ts";
import { createRemoteService, createStandInService, createOnlineService } from "./service.ts";
import { createStandIn, ONLINE_RULES } from "./stand-in.ts";
import { createLoopback, createSocketLink, type SocketLike } from "./transport.ts";
import { createRunState } from "../run-state.ts";
import { readSave, SAVE_KEY, writeSave } from "../save.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const memoryStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data };
};

test("every input survives being squeezed into a number", () => {
  const inputs: FighterInput[] = [
    IDLE,
    { move: 1, block: false, attack: "men", stomp: true },
    { move: -1, block: true, attack: null, parry: true, seme: true, dash: -1 },
    { move: 0, block: false, attack: "quickMen", dash: 1 },
    { move: 0, block: false, attack: "bigMen" },
    { move: 0, block: false, attack: "do" },
    { move: 0, block: false, attack: "kote" },
  ];
  for (const input of inputs) {
    const back = decodeInput(encodeInput(input));
    for (const key of ["move", "block", "attack"] as const) assert.equal(back[key], input[key], key);
    for (const key of ["stomp", "parry", "seme"] as const) assert.equal(!!back[key], !!input[key], key);
    assert.equal(back.dash ?? 0, input.dash ?? 0);
  }
});

test("rubbish from the wire can't become a bad input", () => {
  const nasty = decodeInput(2 ** 30 - 1);
  assert.ok([-1, 0, 1].includes(nasty.move));
  assert.equal(nasty.attack, null);
});

test("nothing from outside is believed without checking", () => {
  assert.equal(parseServerMessage("not json"), null);
  assert.equal(parseServerMessage("[]"), null);
  assert.equal(parseServerMessage(JSON.stringify({ t: "wat" })), null);
  assert.equal(parseServerMessage(JSON.stringify({ t: "input", frame: -1, bits: 3 })), null);
  assert.equal(parseServerMessage(JSON.stringify({ t: "input", frame: 1.5, bits: 3 })), null);
  assert.equal(parseServerMessage(JSON.stringify({ t: "match", seed: 1, side: 7, opponent: { id: "x", name: "y", dan: 1 } })), null);
  assert.deepEqual(parseServerMessage(JSON.stringify({ t: "input", frame: 4, bits: 3 })), { t: "input", frame: 4, bits: 3 });
});

test("someone else's name can't break the screen", () => {
  assert.equal(cleanName("a very very long name indeed yes"), "a very very lo");
  assert.equal(cleanName("Sum\u0000i\u{1F600}"), "Sumi");
  assert.equal(cleanName(42), "Player");
  assert.equal(cleanName("   "), "Player");
  const message = parseServerMessage(JSON.stringify({ t: "match", seed: 1, side: 1, opponent: { id: "x", name: "\u0000\u0000", dan: 1 } }));
  assert.equal(message?.t === "match" && message.opponent.name, "Player");
});

/** Someone mashing everything at random, which gets into every corner of the rules: locks, parries, crossings, the lot. */
function chaos(seed: number): () => FighterInput {
  let rng = seed;
  let held: FighterInput = IDLE;
  let left = 0;
  const roll = () => {
    const r = nextRandom(rng);
    rng = r.seed;
    return r.value;
  };
  return () => {
    if (--left > 0) return { ...held, attack: null, parry: false, dash: 0 };
    left = 2 + Math.floor(roll() * 30);
    const kind = roll();
    held = {
      move: roll() < 0.7 ? 1 : roll() < 0.5 ? -1 : 0,
      block: roll() < 0.2,
      parry: roll() < 0.2,
      attack: kind < 0.25 ? "men" : kind < 0.4 ? "kote" : kind < 0.5 ? "do" : null,
      stomp: roll() < 0.7,
      seme: roll() < 0.1,
      dash: roll() < 0.15 ? 1 : 0,
    };
    return held;
  };
}

/** Plays a match over a connection, each side with their own copy, and checks both saw the same thing. */
function playOver(latency: number, seed = 1) {
  const [a, b] = createLoopback<LinkMessage>(latency);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  const two = createLockstep({ initial: createDuel(ONLINE_RULES), side: 1, link: b });
  const them = chaos(seed);
  const me = chaos(seed + 1000);
  const eventsOne: DuelEvent[] = [];
  const eventsTwo: DuelEvent[] = [];
  let ticks = 0;
  for (; ticks < 40000 && (one.status === "running" || two.status === "running"); ticks++) {
    eventsOne.push(...one.tick(me()).events);
    eventsTwo.push(...two.tick(them()).events);
  }
  return { one, two, eventsOne, eventsTwo, ticks };
}

test("two players with their own copies see exactly the same match", () => {
  const { one, two, eventsOne, eventsTwo } = playOver(0);
  assert.equal(one.status, "finished");
  assert.equal(two.status, "finished");
  assert.equal(one.frame, two.frame);
  assert.equal(hashDuel(one.state), hashDuel(two.state));
  assert.deepEqual(eventsOne, eventsTwo);
  assert.ok(one.state.winner !== null);
});

test("lag slows a match down, but nothing comes apart", () => {
  for (const latency of [1, 3, 8, 20]) {
    const { one, two } = playOver(latency, latency);
    assert.equal(one.status, "finished", `latency ${latency}`);
    assert.equal(two.status, "finished", `latency ${latency}`);
    assert.equal(hashDuel(one.state), hashDuel(two.state), `latency ${latency}`);
  }
});

test("everything in the rules stays in step over a connection: crossings, locks and parries", () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 12; seed++) {
    const { one, two, eventsOne } = playOver(2, seed);
    assert.equal(one.status, "finished", `seed ${seed}`);
    assert.equal(hashDuel(one.state), hashDuel(two.state), `seed ${seed}`);
    for (const e of eventsOne) seen.add(e.type);
  }
  for (const type of ["cross", "lock", "parry", "hit", "clean"]) assert.ok(seen.has(type), `never saw ${type}: ${[...seen].join()}`);
});

test("your own input waits out the delay, so a key press lands the same frame for both", () => {
  const [a, b] = createLoopback<LinkMessage>(0);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  one.tick({ ...IDLE, move: 1 });
  const sent = b.receive();
  assert.deepEqual(sent[0], { t: "input", frame: INPUT_DELAY, bits: encodeInput({ ...IDLE, move: 1 }) });
});

test("nothing moves on without the other player's input", () => {
  const [a] = createLoopback<LinkMessage>(0);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  for (let i = 0; i < INPUT_DELAY + 20; i++) one.tick(IDLE);
  assert.equal(one.frame, INPUT_DELAY);
  assert.ok(one.waiting > 0);
  assert.equal(one.status, "running");
});

test("someone who goes quiet for long enough counts as gone", () => {
  const [a] = createLoopback<LinkMessage>(0);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  for (let i = 0; i < STALL_LIMIT + INPUT_DELAY + 5; i++) one.tick(IDLE);
  assert.equal(one.status, "left");
});

test("someone leaving is noticed right away, and it's not held against the one still there", () => {
  const [a, b] = createLoopback<LinkMessage>(0);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  const two = createLockstep({ initial: createDuel(ONLINE_RULES), side: 1, link: b });
  two.leave();
  one.tick(IDLE);
  assert.equal(one.status, "left");
});

test("a dropped connection counts as leaving", () => {
  const [a] = createLoopback<LinkMessage>(0);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  a.close();
  one.tick(IDLE);
  assert.equal(one.status, "left");
});

test("if two copies ever disagree, it's caught rather than played on", () => {
  const [a, b] = createLoopback<LinkMessage>(0);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  const other = createDuel(ONLINE_RULES);
  other.fighters[0].ki = 1;
  const two = createLockstep({ initial: other, side: 1, link: b });
  for (let i = 0; i < HASH_EVERY * 3 && one.status === "running"; i++) {
    one.tick(IDLE);
    two.tick(IDLE);
  }
  assert.equal(one.status, "desynced");
});

test("input from impossibly far ahead is ignored, so nobody can fill up memory", () => {
  const [a, b] = createLoopback<LinkMessage>(0);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  b.send({ t: "input", frame: 10_000_000, bits: 1 });
  one.tick(IDLE);
  assert.equal(one.status, "running");
});

test("the stand-in plays a whole match through the same connection, at any lag", () => {
  for (const latency of [0, 2, 8]) {
    const [a, b] = createLoopback<LinkMessage>(latency);
    const me = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
    const standIn = createStandIn(b, 5, "steady");
    for (let i = 0; i < 20000 && me.status === "running"; i++) {
      standIn.tick();
      me.tick(IDLE);
    }
    assert.equal(me.status, "finished", `latency ${latency}`);
    assert.equal(me.state.winner, 1, "standing still loses");
  }
});

const entrants = (n: number): BracketEntrant[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, controller: i === 0 ? "player" : "bot" }));

test("a bracket runs from a full field to one champion", () => {
  let b = createBracket(entrants(8), 3);
  assert.equal(b.rounds[0].length, 8);
  assert.equal(new Set(b.rounds[0].map((e) => e.id)).size, 8);
  const pickFirst = (x: BracketEntrant) => x;
  b = finishRound(b, pickFirst);
  assert.equal(b.rounds[1].length, 4);
  b = finishRound(finishRound(b, pickFirst), pickFirst);
  assert.ok(bracketChampion(b));
  assert.equal(finishRound(b, pickFirst), b, "nothing after the final");
});

test("the same seed draws the same bracket", () => {
  assert.deepEqual(createBracket(entrants(8), 9), createBracket(entrants(8), 9));
  assert.notDeepEqual(createBracket(entrants(8), 9), createBracket(entrants(8), 10));
});

test("a bracket has to be a power of two", () => {
  assert.throws(() => createBracket(entrants(6), 1));
});

test("your next opponent is whoever you're paired with, until you're out", () => {
  let b = createBracket(entrants(4), 1);
  const at = b.rounds[0].findIndex((e) => e.id === "p0");
  assert.equal(nextOpponentIn(b, "p0")?.id, b.rounds[0][at % 2 === 0 ? at + 1 : at - 1].id);
  assert.equal(bracketStatus(b, "p0"), "playing");
  b = finishRound(b, (x, y) => (x.id === "p0" ? y : y.id === "p0" ? x : x));
  assert.equal(nextOpponentIn(b, "p0"), null);
  assert.equal(bracketStatus(b, "p0"), "out");
});

test("a tournament against stand-ins runs start to finish", () => {
  const auth = createGuestAuth(() => ({ id: "me", name: "Me", dan: 1, guest: true }));
  let seed = 11;
  const session = createStandInService(auth, () => seed++).enterTournament();
  assert.equal(session.status(), "playing");
  assert.equal(session.bracket()?.size, 8);
  let rounds = 0;
  while (session.status() === "playing" && rounds < 5) {
    const search = session.nextMatch();
    let state = search.poll();
    for (let i = 0; i < 200 && state.kind === "searching"; i++) state = search.poll();
    assert.equal(state.kind, "found");
    session.report(true);
    rounds++;
  }
  assert.equal(rounds, 3);
  assert.equal(session.status(), "champion");
});

test("losing in a stand-in tournament puts you out", () => {
  const auth = createGuestAuth(() => ({ id: "me", name: "Me", dan: 1, guest: true }));
  const session = createStandInService(auth, () => 7).enterTournament();
  session.report(false);
  assert.equal(session.status(), "out");
});

test("searching for a duel can be called off", () => {
  const auth = createGuestAuth(() => ({ id: "me", name: "Me", dan: 1, guest: true }));
  const search = createStandInService(auth, () => 7).findDuel();
  search.cancel();
  for (let i = 0; i < 300; i++) assert.equal(search.poll().kind, "searching");
});

test("with no server set up it's practice, and with one it's live", () => {
  const auth = createGuestAuth(() => ({ id: "me", name: "Me", dan: 1, guest: true }));
  assert.equal(createOnlineService(auth).live, false);
  assert.equal(createOnlineService(auth, "").live, false);
  assert.equal(createOnlineService(auth, "wss://example.test").live, true);
});

function fakeSocket() {
  const sent: string[] = [];
  const socket: SocketLike & { sent: string[]; arrive(m: unknown): void; opened(): void; drop(): void } = {
    readyState: 0,
    sent,
    send: (text: string) => void sent.push(text),
    close() {
      this.onclose?.({} as never);
    },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    arrive(m: unknown) {
      this.onmessage?.({ data: typeof m === "string" ? m : JSON.stringify(m) });
    },
    opened() {
      (this as { readyState: number }).readyState = 1;
      this.onopen?.({} as never);
    },
    drop() {
      this.onclose?.({} as never);
    },
  };
  return socket;
}

test("a socket link holds messages until it's open, and drops what it can't read", () => {
  const socket = fakeSocket();
  const link = createSocketLink<{ a: number }, { b: number }>(socket, (text) => {
    const v = JSON.parse(text);
    return typeof v.b === "number" ? v : null;
  });
  link.send({ a: 1 });
  assert.deepEqual(socket.sent, []);
  socket.opened();
  assert.deepEqual(socket.sent, ['{"a":1}']);
  link.send({ a: 2 });
  assert.equal(socket.sent.length, 2);
  socket.arrive({ b: 5 });
  socket.arrive({ nope: 1 });
  assert.deepEqual(link.receive(), [{ b: 5 }]);
  assert.deepEqual(link.receive(), []);
});

const meIdentity = { id: "me", name: "Me", dan: 2, guest: false };
function remote() {
  const socket = fakeSocket();
  const auth = { identity: () => meIdentity, token: () => "secret" };
  const service = createRemoteService({ url: "wss://x", auth, open: () => socket });
  return { socket, service };
}
const sentBy = (socket: { sent: string[] }): ClientMessage[] => socket.sent.map((t) => JSON.parse(t));

test("connecting to a server says who you are, proves it, and joins the right queue", () => {
  const { socket, service } = remote();
  service.findDuel();
  socket.opened();
  const sent = sentBy(socket);
  assert.deepEqual(sent[0], { t: "hello", version: PROTOCOL_VERSION, token: "secret", identity: meIdentity });
  assert.deepEqual(sent[1], { t: "queue", mode: "duel" });
});

test("a found match over a socket carries the side and opponent, and relays inputs both ways", () => {
  const { socket, service } = remote();
  const search = service.findDuel();
  socket.opened();
  assert.equal(search.poll().kind, "searching");
  socket.arrive({ t: "match", seed: 9, side: 1, opponent: { id: "o", name: "Other", dan: 1, guest: true } });
  const state = search.poll();
  assert.equal(state.kind, "found");
  if (state.kind !== "found") return;
  assert.equal(state.match.side, 1);
  assert.equal(state.match.opponent.name, "Other");
  socket.arrive({ t: "input", frame: 3, bits: 1 });
  assert.deepEqual(state.match.link.receive(), [{ t: "input", frame: 3, bits: 1 }]);
  state.match.link.send({ t: "input", frame: 3, bits: 2 });
  assert.deepEqual(sentBy(socket).at(-1), { t: "input", frame: 3, bits: 2 });
});

test("a full match runs over that relay", () => {
  // The server's whole job during a match: pass along what each side sends.
  const socketA = fakeSocket();
  const socketB = fakeSocket();
  const relay = (from: typeof socketA, to: typeof socketB) => {
    from.send = (text: string) => {
      const m = JSON.parse(text);
      if (m.t === "input" || m.t === "hash" || m.t === "leave") to.arrive(m);
    };
  };
  relay(socketA, socketB);
  relay(socketB, socketA);
  const peer = (socket: typeof socketA, side: 0 | 1, id: string) => {
    const search = createRemoteService({ url: "wss://x", auth: { identity: () => ({ ...meIdentity, id }), token: () => null }, open: () => socket }).findDuel();
    socket.opened();
    socket.arrive({ t: "match", seed: 1, side, opponent: { id: "o", name: "O", dan: 1, guest: true } });
    const state = search.poll();
    assert.equal(state.kind, "found");
    return createLockstep({ initial: createDuel(ONLINE_RULES), side, link: (state as unknown as { match: { link: Parameters<typeof createLockstep>[0]["link"] } }).match.link });
  };
  const one = peer(socketA, 0, "a");
  const two = peer(socketB, 1, "b");
  let rival = createRival(3, rivalConfig(0, "steady"));
  for (let i = 0; i < 20000 && (one.status === "running" || two.status === "running"); i++) {
    one.tick(IDLE);
    const act = rivalAct(two.state, rival);
    rival = act.rival;
    two.tick(act.input);
  }
  assert.equal(one.status, "finished");
  assert.equal(two.status, "finished");
  assert.equal(hashDuel(one.state), hashDuel(two.state));
  assert.equal(one.state.winner, 1);
});

test("a server turning you away, or the connection dropping, ends the search with a reason", () => {
  const refused = remote();
  const a = refused.service.findDuel();
  refused.socket.opened();
  refused.socket.arrive({ t: "rejected", reason: "Update your game" });
  assert.deepEqual(a.poll(), { kind: "failed", reason: "Update your game" });
  const dropped = remote();
  const b = dropped.service.findDuel();
  dropped.socket.drop();
  assert.equal(b.poll().kind, "failed");
});

test("a server tournament follows the bracket it's sent", () => {
  const { socket, service } = remote();
  const session = service.enterTournament();
  socket.opened();
  assert.equal(session.status(), "waiting");
  assert.deepEqual(sentBy(socket)[1], { t: "queue", mode: "tournament" });
  const field: BracketEntrant[] = [{ id: "me", name: "Me", controller: "player" }, { id: "o", name: "O", controller: "remote" }];
  socket.arrive({ t: "bracket", bracket: { size: 2, rounds: [field] } });
  assert.equal(session.status(), "playing");
  assert.equal(session.bracket()?.size, 2);
  session.report(true);
  assert.deepEqual(sentBy(socket).at(-1), { t: "result", won: true });
  socket.arrive({ t: "bracket", bracket: { size: 2, rounds: [field, [field[0]]] } });
  assert.equal(session.status(), "champion");
});

test("multiplayer's shut until 1st dan with the lesson, or the short tutorial", () => {
  const profile = createProfile(() => 0.5);
  const fresh = createRunState();
  assert.deepEqual(onlineAccess(profile, null), { open: false, via: null });
  assert.deepEqual(onlineAccess(profile, fresh), { open: false, via: null });
  assert.deepEqual(onlineAccess(profile, { ...fresh, dan: 1 }), { open: false, via: null });
  assert.deepEqual(onlineAccess(profile, { ...fresh, dan: 1, waza: true }), { open: true, via: "story" });
  assert.deepEqual(onlineAccess({ ...profile, tutorial: true }, null), { open: true, via: "tutorial" });
});

test("everyone plays as at least 1st dan, and a higher story rank counts", () => {
  const profile = { ...createProfile(() => 0.5), tutorial: true };
  assert.equal(identityOf(profile, null).dan, ONLINE_MIN_DAN);
  assert.equal(identityOf(profile, { ...createRunState(), dan: 3, waza: true }).dan, 3);
  assert.equal(identityOf(profile, { ...createRunState(), dan: 3 }).dan, ONLINE_MIN_DAN, "no lesson, no credit for it here");
});

test("a profile is remembered, and bad data gets a new one rather than an error", () => {
  const store = memoryStore();
  const first = withResult({ ...createProfile(() => 0.5), tutorial: true }, true);
  writeProfile(store, first);
  assert.deepEqual(readProfile(store), first);
  store.data.set(PROFILE_KEY, "{nope");
  assert.equal(readProfile(store, () => 0.1).tutorial, false);
  store.data.set(PROFILE_KEY, JSON.stringify({ version: 1, profile: { id: 5 } }));
  assert.equal(readProfile(store, () => 0.1).tutorial, false);
  assert.ok(readProfile(null, () => 0.1).id);
});

test("results count up", () => {
  const p = createProfile(() => 0.5);
  assert.equal(withResult(p, true).wins, 1);
  assert.equal(withResult(p, false).losses, 1);
});

test("going straight to multiplayer can't touch a story save", () => {
  const store = memoryStore();
  const story = { ...createRunState(), dan: 2, money: 77 };
  writeSave(store, story);
  const before = store.data.get(SAVE_KEY);
  const hub = createOnlineHub({ store, readRun: () => readSave(store) });
  hub.finishTutorial();
  hub.recordResult(true);
  assert.equal(store.data.get(SAVE_KEY), before);
  assert.equal(hub.profile().wins, 1);
  assert.equal(hub.profile().tutorial, true);
  assert.equal(hub.access().open, true);
});

test("no save and no storage: multiplayer still works, and just isn't remembered", () => {
  const hub = createOnlineHub({ store: null, readRun: () => null });
  assert.equal(hub.access().open, false);
  hub.finishTutorial();
  assert.equal(hub.access().open, true);
  assert.equal(hub.service.live, false);
  assert.ok(hub.look());
});
