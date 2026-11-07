import test from "node:test";
import assert from "node:assert/strict";
import { LOBBY_CODE_ALPHABET, LOBBY_CODE_LENGTH, parseClientMessage, parseLobbyCode, parseServerMessage, PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from "./protocol.ts";

const opponent = { id: "o", name: "Other", dan: 2, guest: false };

test("this is the lobby version of the protocol", () => {
  assert.equal(PROTOCOL_VERSION, 3);
});

test("every client message survives the trip to the server", () => {
  const messages: ClientMessage[] = [
    { t: "hello", version: 2 },
    { t: "create-lobby" },
    { t: "join-lobby", code: "ABC23" },
    { t: "leave-lobby" },
    { t: "visible", visible: false },
    { t: "ping" },
    { t: "rematch" },
    { t: "result", report: "won" },
    { t: "result", report: "void" },
    { t: "input", frame: 4, bits: 3 },
    { t: "hash", frame: 60, hash: 99 },
    { t: "leave" },
  ];
  for (const message of messages) assert.deepEqual(parseClientMessage(JSON.stringify(message)), message);
});

test("every server message survives the trip to the client", () => {
  const messages: ServerMessage[] = [
    { t: "welcome", identity: opponent },
    { t: "rejected", reason: "Please refresh" },
    { t: "lobby", code: "ABC23" },
    { t: "lobby-error", reason: "own-lobby" },
    { t: "opponent-joined", opponent },
    { t: "match", seed: 5, side: 1, opponent },
    { t: "outcome", winner: "you", reason: "played", wins: 3, losses: 1 },
    { t: "outcome", winner: null, reason: "disagreed", wins: 0, losses: 0 },
    { t: "rematch-wanted" },
    { t: "lobby-closed", reason: "not-back-in-time" },
    { t: "input", frame: 4, bits: 3 },
    { t: "hash", frame: 60, hash: 99 },
    { t: "leave" },
  ];
  for (const message of messages) assert.deepEqual(parseServerMessage(JSON.stringify(message)), message);
});

test("malformed client messages are refused", () => {
  for (const text of ["not json", "[]", '{"t":"hello"}', '{"t":"wat"}', '{"t":"join-lobby","code":"TOOLONGCODE"}', '{"t":"visible","visible":"yes"}', '{"t":"result","report":"maybe"}', '{"t":"input","frame":-1,"bits":3}', '{"t":"queue","mode":"duel"}']) {
    assert.equal(parseClientMessage(text), null, text);
  }
});

test("malformed server messages are refused, including the old ones", () => {
  for (const text of ['{"t":"queued","mode":"duel"}', '{"t":"bracket","bracket":{"size":2,"rounds":[]}}', '{"t":"lobby","code":"O0I1L"}', '{"t":"lobby-error","reason":"cosmic"}', '{"t":"lobby-closed","reason":"cosmic"}', '{"t":"outcome","winner":"nobody","reason":"played","wins":0,"losses":0}', '{"t":"outcome","winner":"you","reason":"cosmic","wins":0,"losses":0}', '{"t":"outcome","winner":"you","reason":"played","wins":-1,"losses":0}']) {
    assert.equal(parseServerMessage(text), null, text);
  }
});

test("names from the server are cleaned before they can be drawn", () => {
  const message = parseServerMessage(JSON.stringify({ t: "opponent-joined", opponent: { ...opponent, name: "\u0000\u0000" } }));
  assert.equal(message?.t === "opponent-joined" && message.opponent.name, "Player");
});

test("lobby codes ignore case and refuse look-alikes", () => {
  assert.equal(parseLobbyCode("abc23"), "ABC23");
  assert.equal(parseLobbyCode("O0I1L"), null);
  assert.equal(parseLobbyCode("ABC2"), null);
  assert.equal(parseLobbyCode("ABC234"), null);
  assert.equal(parseLobbyCode(5), null);
  assert.equal(LOBBY_CODE_LENGTH, 5);
  for (const lookAlike of "01OIL") assert.ok(!LOBBY_CODE_ALPHABET.includes(lookAlike));
});
