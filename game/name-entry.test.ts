import test from "node:test";
import assert from "node:assert/strict";
import { CHARACTERS, cleanPlayerName, NAME_LIMIT, playerName } from "./characters.ts";
import { createNameEntry, stepNameEntry } from "./name-entry.ts";
import { wrapText } from "./art/font.ts";
import { allContentLines, DIALOGUE_LINES, DIALOGUE_WIDTH, fillName, NAME_TOKEN } from "./scenes/content.ts";

const typing = (keys: string[], fallback = "Emi", current = "") => {
  let entry = createNameEntry(fallback, current);
  for (const key of keys) {
    const step = stepNameEntry(entry, [key]);
    if (step.done) return { text: cleanPlayerName(step.entry.text), done: step.done };
    entry = step.entry;
  }
  return { text: entry.text, done: null };
};

test("you go by your character's name unless you've chosen another", () => {
  for (const person of CHARACTERS) {
    assert.equal(playerName({ character: person.id }), person.name);
    assert.equal(playerName({ character: person.id, name: "" }), person.name);
    assert.equal(playerName({ character: person.id, name: "Nit" }), "Nit");
  }
});

test("keys that are controls elsewhere are just letters here", () => {
  assert.deepEqual(typing(["E", "x", "p", "f", "m", "Enter"]), { text: "Expfm", done: "keep" });
});

test("pressing Enter straight away keeps the character's name", () => {
  const { text, done } = typing(["Enter"]);
  assert.equal(done, "keep");
  assert.equal(playerName({ character: "emi", name: text }), "Emi");
});

test("Backspace goes back, and emptying the box goes back to the character's name", () => {
  assert.deepEqual(typing(["N", "i", "x", "Backspace", "t", "Enter"]), { text: "Nit", done: "keep" });
  const cleared = typing(["Backspace", "Backspace", "Backspace", "Backspace", "Enter"], "Emi", "Nit");
  assert.equal(playerName({ character: "emi", name: cleared.text }), "Emi");
});

test("Escape walks away", () => {
  assert.equal(typing(["N", "Escape"]).done, "back");
});

test("a name stays short and drawable", () => {
  const long = typing([..."ABCDEFGHIJKLMNOP"]);
  assert.equal(long.text.length, NAME_LIMIT);
  assert.equal(typing(["<", ":", "é", "A", "{", "Enter"]).text, "A");
  assert.equal(typing([" ", "A", " ", " ", "B", " ", "Enter"]).text, "A B");
  assert.equal(cleanPlayerName("  <name>:  "), "name");
  assert.equal(cleanPlayerName("Mary-Jo O'Neil.Long"), "Mary-Jo O'Ne");
});

test("every line that uses your name still fits with the longest name there is", () => {
  const longest = "W".repeat(NAME_LIMIT);
  const named = allContentLines().filter((line) => line.includes(NAME_TOKEN));
  assert.ok(named.length >= 5, "people do use it");
  for (const line of named) assert.ok(wrapText(fillName(line, longest), DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
});

test("your name goes wherever a line asks for it", () => {
  assert.equal(fillName("Momo: Hi, <name>! Bye, <name>.", "Nit"), "Momo: Hi, Nit! Bye, Nit.");
  assert.equal(fillName("Momo: Hi.", "Nit"), "Momo: Hi.");
});
