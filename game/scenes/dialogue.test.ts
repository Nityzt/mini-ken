import test from "node:test";
import assert from "node:assert/strict";
import type { Action, Input } from "../core/input.ts";
import type { Syllable } from "../core/babble.ts";
import { createDialogue } from "./dialogue.ts";

const pressing = (action?: Action): Input => ({
  typing: false,
  setTyping() {},
  typed: () => [],
  isDown: () => false,
  wasPressed: (a) => a === action,
  endTick() {},
  clear() {},
  dispose() {},
});

test("E pages through to the end, then runs what comes next", () => {
  const d = createDialogue();
  let next = 0;
  d.open(["One."], () => next++);
  d.update(pressing("confirm")); // finishes the typing
  assert.equal(next, 0);
  d.update(pressing("confirm"));
  assert.equal(next, 1);
  assert.equal(d.active, false);
});

test("X closes the dialogue at once, on any page", () => {
  const d = createDialogue();
  d.open(["One.", "Two.", "Three."]);
  d.update(pressing("cancel"));
  assert.equal(d.active, false);
});

test("X backs out of whatever the dialogue was leading to", () => {
  const d = createDialogue();
  let fights = 0;
  d.open(["Rei!"], () => fights++);
  d.update(pressing("cancel"));
  assert.equal(fights, 0);
  assert.equal(d.active, false);
});

test("a dialogue that must lead somewhere still goes there on X", () => {
  const d = createDialogue();
  let left = 0;
  const leave = () => left++;
  d.open(["Well done."], leave, leave);
  d.update(pressing("cancel"));
  assert.equal(left, 1);
});

test("the prompt says backing out when X would skip something", () => {
  const d = createDialogue();
  d.open(["Rei!"], () => {});
  assert.equal(d.cancelHint, "X back out");
  const leave = () => {};
  d.open(["Well done."], leave, leave);
  assert.equal(d.cancelHint, "X skip");
  d.open(["Hello."]);
  assert.equal(d.cancelHint, "X skip");
});

test("X does nothing when no dialogue is open", () => {
  const d = createDialogue();
  d.update(pressing("cancel"));
  assert.equal(d.active, false);
});

/** Types a whole page, and writes down what got said along the way. */
function listen(d: ReturnType<typeof createDialogue>, ticks = 200) {
  const heard: Syllable[] = [];
  for (let i = 0; i < ticks; i++) d.update(pressing(), { say: (s) => heard.push(s) });
  return heard;
}

test("someone with a voice talks as their words get typed", () => {
  const d = createDialogue();
  d.open(["Aki: I talk a lot and I never stand still, so keep up!"]);
  assert.ok(listen(d).length >= 5);
});

test("each syllable comes out on the tick its letter appears", () => {
  const d = createDialogue();
  d.open(["Aki: Yes"]);
  const when: number[] = [];
  for (let tick = 1; tick <= 12; tick++) d.update(pressing(), { say: () => when.push(tick) });
  assert.deepEqual(when, ["Aki: Y".length]);
});

test("the speaker's name is a label, so it isn't read out", () => {
  const d = createDialogue();
  d.open(["Aki: ..."]);
  assert.equal(listen(d).length, 0);
});

test("two people saying the same words don't sound the same", () => {
  const say = (who: string) => {
    const d = createDialogue();
    d.open([`${who}: Wash your gi alone.`]);
    return listen(d)[0].freq;
  };
  assert.notEqual(say("Aki"), say("Bo"));
});

test("narration is silent", () => {
  const d = createDialogue();
  d.open(["A spare gi and hakama. A little big."]);
  assert.equal(listen(d).length, 0);
});

test("a label that happens to have a colon is silent", () => {
  const d = createDialogue();
  d.open(["Rested: your spirit is back to full, and so is your health."]);
  assert.equal(listen(d).length, 0);
});

test("finishing the typing stops the talking", () => {
  const d = createDialogue();
  d.open(["Aki: I talk a lot and I never stand still, so keep up!"]);
  const heard: Syllable[] = [];
  d.update(pressing("confirm"), { say: (s) => heard.push(s) });
  const before = heard.length;
  for (let i = 0; i < 100; i++) d.update(pressing(), { say: (s) => heard.push(s) });
  assert.equal(heard.length, before);
});

test("each page talks from its own start, and a different speaker takes over", () => {
  const d = createDialogue();
  d.open(["Aki: Yes indeed.", "Bo: Yes indeed."]);
  const first = listen(d);
  d.update(pressing("confirm"));
  const second = listen(d);
  assert.equal(first.length > 0, true);
  assert.equal(second.length > 0, true);
  assert.notEqual(first[0].freq, second[0].freq);
});

test("a dialogue with no audio given types along in silence", () => {
  const d = createDialogue();
  d.open(["Aki: Yes indeed."]);
  assert.doesNotThrow(() => d.update(pressing()));
});

test("a page after a long line still lines up with what's being typed", () => {
  const d = createDialogue();
  d.open(["Aki: " + "word ".repeat(30), "Aki: Yes"]);
  listen(d);
  d.update(pressing("confirm"));
  const when: number[] = [];
  for (let tick = 1; tick <= 12; tick++) d.update(pressing(), { say: () => when.push(tick) });
  assert.deepEqual(when, ["Aki: Y".length]);
});
