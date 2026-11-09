import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PEOPLE } from "./chatter-lines.ts";
import { VOICES, voiceOf } from "./voices.ts";

/** Lines that look like "Name: something", where the name is a label and nobody's talking. */
const NOT_PEOPLE = ["Tare", "Men", "Kote", "Do", "Shinai", "Lock", "Ride", "E or Space", "Hold I", "Block. Tap it", "Rested", "Your spirit grows", "Use your ticket", "Sensei's rule", "Ren is the last dojo", "Nobody's online yet", "Learn to fix a shinai", "Notice board", "Grading fee", "Name", "Bet won", "Bet lost", "X"];

test("everyone you can talk to has a voice", () => {
  for (const person of Object.values(PEOPLE)) assert.ok(voiceOf(person.name), `${person.name} has no voice`);
});

test("everyone named in a line of dialogue has a voice", () => {
  const source = ["content.ts", "chatter-lines.ts"].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  const names = new Set([...source.matchAll(/["`]([A-Z][A-Za-z' .]{0,19}): /g)].map((m) => m[1]));
  const missing = [...names].filter((name) => !voiceOf(name) && !NOT_PEOPLE.includes(name));
  assert.deepEqual(missing, []);
});

test("short names are the same person", () => {
  assert.equal(voiceOf("Sensei"), voiceOf("Sensei Kuma"));
  assert.equal(voiceOf("Momo"), voiceOf("Senpai Momo"));
});

test("narration and labels aren't anybody", () => {
  assert.equal(voiceOf(null), null);
  assert.equal(voiceOf("E or Space"), null);
  assert.equal(voiceOf("Tare"), null);
});

test("nobody sounds exactly like anybody else", () => {
  const prints = Object.values(VOICES).map((v) => JSON.stringify(v));
  assert.equal(new Set(prints).size, prints.length);
});

test("voices stay in a range a small speaker can actually carry", () => {
  for (const [name, v] of Object.entries(VOICES)) {
    assert.ok(v.pitch >= 110 && v.pitch <= 700, `${name} pitch ${v.pitch}`);
    assert.ok(v.every >= 4 && v.every <= 8, `${name} pace ${v.every}`);
    assert.ok(v.tract >= 0.75 && v.tract <= 1.5, `${name} tract ${v.tract}`);
  }
});
