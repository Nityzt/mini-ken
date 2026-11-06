import test from "node:test";
import assert from "node:assert/strict";
import { ATTACKS, type AttackKind } from "./rules.ts";
import { counterPrompt, KI_BAR_LIMIT, kiBarFill, kiBarWidth, promptsShown } from "./hud.ts";

test("the ki bar grows with your ki, up to a point", () => {
  assert.equal(kiBarWidth(100), 60);
  assert.equal(kiBarWidth(125), 75);
  assert.equal(kiBarWidth(1000), KI_BAR_LIMIT);
});

test("two full bars never overlap, however much ki you've got", () => {
  assert.ok(kiBarWidth(400) * 2 + 10 < 256);
});

test("the filled part of a bar is true to the fraction left", () => {
  assert.equal(kiBarFill(50, 100), 30);
  assert.equal(kiBarFill(300, 300), KI_BAR_LIMIT);
  assert.equal(kiBarFill(150, 300), KI_BAR_LIMIT / 2);
  assert.equal(kiBarFill(0, 300), 0);
});

test("the prompt names the key for what each attack leaves open", () => {
  assert.deepEqual(counterPrompt("men"), "K kote");
  assert.deepEqual(counterPrompt("quickMen"), "K kote");
  assert.deepEqual(counterPrompt("kote"), "J men");
  assert.deepEqual(counterPrompt("do"), "J men");
  assert.deepEqual(counterPrompt("bigMen"), "L do");
});

test("the prompts always agree with the rules", () => {
  for (const attack of Object.keys(ATTACKS) as AttackKind[]) assert.ok(counterPrompt(attack).endsWith(ATTACKS[attack].exposes), attack);
});

test("senpai and the first rival always show the key", () => {
  for (const id of ["aki", "bo", "yui", "raccoon"] as const) assert.equal(promptsShown(id, 0, false), true, id);
});

test("later rivals only show it after you've lost to them twice", () => {
  for (const id of ["goose", "heron", "otter"] as const) {
    assert.equal(promptsShown(id, 0, false), false, id);
    assert.equal(promptsShown(id, 1, false), false, id);
    assert.equal(promptsShown(id, 2, false), true, id);
  }
});

test("Ren and Momo never help, and neither does a tournament", () => {
  assert.equal(promptsShown("radish", 9, false), false);
  assert.equal(promptsShown("momo", 9, false), false);
  assert.equal(promptsShown("aki", 9, true), false);
});

test("Ren never shows which key answers a strike, until you've learned the far-mountain gaze", () => {
  assert.equal(promptsShown("radish", 9, false), false);
  assert.equal(promptsShown("radish", 0, false, true), true);
});

test("the gaze doesn't help in a tournament, or against anyone else", () => {
  assert.equal(promptsShown("radish", 0, true, true), false);
  assert.equal(promptsShown("momo", 0, false, true), false);
  assert.equal(promptsShown("renVisit", 0, false, true), false);
  assert.equal(promptsShown("goose", 0, false, true), false);
});
