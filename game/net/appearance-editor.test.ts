import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_APPEARANCE } from "./appearance.ts";
import { createAppearanceEditor, stepAppearanceEditor } from "./appearance-editor.ts";

const keys = { up: false, down: false, left: false, right: false, confirm: false, cancel: false };
const record = { wins: 0, losses: 0 };
test("players can choose a character, allowed colors and insignia, then save", () => {
  let editor = createAppearanceEditor(DEFAULT_APPEARANCE);
  editor = stepAppearanceEditor(editor, { ...keys, right: true }, record).editor;
  assert.equal(editor.appearance.character, "saki");
  editor = stepAppearanceEditor(editor, { ...keys, down: true }, record).editor;
  editor = stepAppearanceEditor(editor, { ...keys, right: true }, record).editor;
  assert.equal(editor.appearance.armor, "own");
  editor = stepAppearanceEditor(editor, { ...keys, down: true }, record).editor;
  editor = stepAppearanceEditor(editor, { ...keys, right: true }, record).editor;
  assert.equal(editor.appearance.insignia.symbol, "pine");
  assert.equal(stepAppearanceEditor(editor, { ...keys, confirm: true }, record).done, "save");
  assert.equal(stepAppearanceEditor(editor, { ...keys, cancel: true }, record).done, "cancel");
});

test("locked armor is skipped when cycling", () => {
  let editor = createAppearanceEditor(DEFAULT_APPEARANCE);
  editor = stepAppearanceEditor(editor, { ...keys, down: true }, record).editor;
  editor = stepAppearanceEditor(editor, { ...keys, left: true }, record).editor;
  assert.equal(editor.appearance.armor, "goose");
});

test("an unknown account record preserves previously unlocked colors", async () => {
  const { initialEditorAppearance } = await import("./appearance-editor.ts");
  const gold = { ...DEFAULT_APPEARANCE, armor: "radish" as const };
  assert.equal(initialEditorAppearance(gold, null).armor, "radish");
  assert.equal(initialEditorAppearance(gold, { wins: 0, losses: 0 }).armor, "pine");
});
