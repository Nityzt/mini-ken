import test from "node:test";
import assert from "node:assert/strict";
import { createDuel, distance, type DuelEvent, type DuelState, type FighterInput } from "../duel/rules.ts";
import { createRival, nextRandom, rivalAct, rivalConfig } from "../duel/rival.ts";
import { createGuestAuth } from "./auth.ts";
import { bracketChampion, bracketStatus, createBracket, finishRound, nextOpponentIn } from "./bracket.ts";
import { createOnlineHub } from "./hub.ts";
import { createLockstep, hashDuel, HASH_EVERY, INPUT_DELAY, liveResult, STALL_LIMIT } from "./lockstep.ts";
import { createProfile, identityOf, onlineAccess, ONLINE_MIN_DAN, PROFILE_KEY, readProfile, withResult, writeProfile } from "./profile.ts";
import { cleanName, decodeInput, encodeInput, parseServerMessage, type BracketEntrant, type LinkMessage } from "./protocol.ts";
import { createStandInService, createOnlineService } from "./service.ts";
import { createStandIn, ONLINE_RULES } from "./stand-in.ts";
import { fakeSocket } from "./test-socket.ts";
import { createLoopback, createSocketLink } from "./transport.ts";
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

test("everything in the rules stays in step over a connection: locks and parries", () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 12; seed++) {
    const { one, two, eventsOne } = playOver(2, seed);
    assert.equal(one.status, "finished", `seed ${seed}`);
    assert.equal(hashDuel(one.state), hashDuel(two.state), `seed ${seed}`);
    for (const e of eventsOne) seen.add(e.type);
  }
  for (const type of ["lock", "parry", "hit", "clean"]) assert.ok(seen.has(type), `never saw ${type}: ${[...seen].join()}`);
});

// Random players chase each other until they're too close to pass, so this one stands off and swings on purpose.
test("crossings stay in step over a connection too", () => {
  const [a, b] = createLoopback<LinkMessage>(2);
  const one = createLockstep({ initial: createDuel(ONLINE_RULES), side: 0, link: a });
  const two = createLockstep({ initial: createDuel(ONLINE_RULES), side: 1, link: b });
  const standOffAndSwing = (state: DuelState, toward: -1 | 1): FighterInput => {
    if (distance(state) > 44) return { move: toward, block: false, attack: null };
    return { move: 0, block: false, attack: "men", stomp: true };
  };
  const hashes = new Map<number, string>();
  let crossings = 0;
  let compared = 0;
  for (let i = 0; i < 3000 && one.status === "running" && two.status === "running"; i++) {
    const first = one.tick(standOffAndSwing(one.state, 1));
    two.tick(standOffAndSwing(two.state, -1));
    if (first.events.some((e) => e.type === "cross")) crossings++;
    for (const lock of [one, two]) {
      const hash = String(hashDuel(lock.state));
      const known = hashes.get(lock.frame);
      if (known === undefined) hashes.set(lock.frame, hash);
      else {
        assert.equal(hash, known, `frame ${lock.frame}`);
        compared++;
      }
    }
  }
  assert.ok(crossings >= 2, `saw ${crossings} crossings`);
  assert.ok(compared > 100, `only compared ${compared} frames`);
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
  assert.equal(createOnlineService(auth).lobby(), null);
  assert.equal(createOnlineService(auth, "wss://example.test").live, true);
});

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

test("a live match only reports what was actually played out", () => {
  assert.equal(liveResult("finished", 0, 0), "won");
  assert.equal(liveResult("finished", 1, 0), "lost");
  assert.equal(liveResult("finished", 1, 1), "won");
  assert.equal(liveResult("finished", null, 0), "void");
  assert.equal(liveResult("desynced", 0, 0), "void");
  assert.equal(liveResult("left", null, 0), null);
  assert.equal(liveResult("running", null, 0), null);
});

test("signing out with no connection still finishes here, and the next load ends the session first", async () => {
  const store = memoryStore();
  let online = false;
  const calls: string[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (!online) throw new TypeError("offline");
    return new Response(JSON.stringify(url === "/api/me" ? { problem: "Please sign in." } : {}), { status: url === "/api/me" ? 401 : 200 });
  }) as typeof fetch;
  const reloads: unknown[] = [];
  const options = { store, readRun: () => null, serverUrl: "/ws", fetcher, schedule() {}, reloadRun: (run: unknown) => void reloads.push(run) };
  const hub = createOnlineHub(options);
  const account = hub.account!;
  (account as unknown as { current(): unknown }).current = () => ({ id: "e", username: "Emi", tutorial: false });
  store.setItem(SAVE_KEY, JSON.stringify({ version: 1, run: createRunState() }));
  hub.signOut();
  await new Promise((resolve) => setImmediate(resolve));
  const warning = hub.accountUi();
  assert.ok(warning === null || warning.kind === "sign-out");
  if (warning?.kind === "sign-out") warning.confirm();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(reloads, [null]);
  assert.equal(store.getItem(SAVE_KEY), null);
  online = true;
  calls.length = 0;
  const next = createOnlineHub(options);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls[0], "POST /api/signout");
  assert.equal(next.account!.status(), "signed-out");
});

test("the account's state says whether someone's a guest, and a server that can't be reached counts as one", async () => {
  assert.equal(createOnlineHub({ store: memoryStore(), readRun: () => null }).accountState(), "none");
  const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const base = { store: memoryStore(), readRun: () => null, serverUrl: "/ws", schedule() {} };
  const out = createOnlineHub({ ...base, fetcher: reply(401, {}) });
  assert.equal(out.accountState(), "checking");
  await settle();
  await settle();
  assert.equal(out.accountState(), "guest");
  const offline = createOnlineHub({ ...base, fetcher: (async () => {
    throw new TypeError("offline");
  }) as unknown as typeof fetch });
  await settle();
  await settle();
  assert.equal(offline.accountState(), "guest");
  const signedIn = createOnlineHub({ ...base, store: memoryStore(), fetcher: reply(200, { account: { id: "e", username: "Emi", tutorial: false }, wins: 0, losses: 0, revision: 0, data: null, updatedAt: 0 }) });
  await settle();
  await settle();
  assert.equal(signedIn.accountState(), "signed-in");
});

test("the guest warning goes on only if accepted, offers signing in instead, and is asked once", () => {
  const hub = createOnlineHub({ store: memoryStore(), readRun: () => null, serverUrl: "/ws", fetcher: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch, schedule() {} });
  let went = 0;
  hub.warnGuest(() => went++);
  const first = hub.accountUi();
  assert.ok(first?.kind === "guest");
  first.cancel();
  assert.equal(hub.accountUi(), null);
  assert.equal(went, 0);
  hub.warnGuest(() => went++);
  const second = hub.accountUi();
  assert.ok(second?.kind === "guest");
  second.signIn();
  assert.equal(hub.accountUi()?.kind, "form");
  assert.equal(went, 0);
  const form = hub.accountUi();
  assert.ok(form?.kind === "form");
  form.cancel();
  hub.warnGuest(() => went++);
  const third = hub.accountUi();
  assert.ok(third?.kind === "guest");
  third.proceed();
  assert.equal(went, 1);
  assert.equal(hub.accountUi(), null);
  hub.warnGuest(() => went++);
  assert.equal(went, 2);
  assert.equal(hub.accountUi(), null);
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
