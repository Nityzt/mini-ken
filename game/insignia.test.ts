import test from "node:test";
import assert from "node:assert/strict";
import { createInsigniaEditor, DEFAULT_INSIGNIA, INSIGNIA_CLOTHS, INSIGNIA_MARKS, INSIGNIA_SYMBOLS, isInsignia, stepInsigniaEditor, symbolGrid } from "./insignia.ts";

const NONE = { up: false, down: false, left: false, right: false, confirm: false, cancel: false };

test("every symbol is a five by five picture, and no two are alike", () => {
  const pictures = INSIGNIA_SYMBOLS.map((symbol) => {
    const rows = symbolGrid(symbol);
    assert.equal(rows.length, 5, symbol);
    for (const row of rows) assert.equal(row.length, 5, symbol);
    return rows.join("");
  });
  assert.equal(new Set(pictures).size, pictures.length);
});

test("left and right change the row you're on, and it wraps around", () => {
  const start = createInsigniaEditor(DEFAULT_INSIGNIA);
  const next = stepInsigniaEditor(start, { ...NONE, right: true }).editor;
  assert.notEqual(next.insignia.symbol, start.insignia.symbol);
  const back = stepInsigniaEditor(start, { ...NONE, left: true }).editor;
  assert.equal(back.insignia.symbol, INSIGNIA_SYMBOLS[INSIGNIA_SYMBOLS.length - 1]);
});

test("up and down move between symbol, cloth and mark", () => {
  let editor = createInsigniaEditor(DEFAULT_INSIGNIA);
  editor = stepInsigniaEditor(editor, { ...NONE, down: true }).editor;
  const cloth = stepInsigniaEditor(editor, { ...NONE, right: true }).editor;
  assert.notEqual(cloth.insignia.cloth, DEFAULT_INSIGNIA.cloth);
  assert.equal(cloth.insignia.symbol, DEFAULT_INSIGNIA.symbol);
  editor = stepInsigniaEditor(editor, { ...NONE, up: true }).editor;
  assert.equal(editor.row, 0);
});

test("the mark can never be the same color as its cloth, or it would vanish", () => {
  let editor = stepInsigniaEditor(createInsigniaEditor(DEFAULT_INSIGNIA), { ...NONE, down: true }).editor;
  for (let i = 0; i < INSIGNIA_CLOTHS.length * 2; i++) {
    editor = stepInsigniaEditor(editor, { ...NONE, right: true }).editor;
    assert.notEqual(editor.insignia.cloth, editor.insignia.mark);
  }
  editor = stepInsigniaEditor(editor, { ...NONE, down: true }).editor;
  for (let i = 0; i < INSIGNIA_MARKS.length * 2; i++) {
    editor = stepInsigniaEditor(editor, { ...NONE, left: true }).editor;
    assert.notEqual(editor.insignia.cloth, editor.insignia.mark);
  }
});

test("E keeps your design, and X leaves things as they were", () => {
  const changed = stepInsigniaEditor(createInsigniaEditor(DEFAULT_INSIGNIA), { ...NONE, right: true }).editor;
  assert.equal(stepInsigniaEditor(changed, { ...NONE, confirm: true }).done, "keep");
  assert.equal(stepInsigniaEditor(changed, { ...NONE, cancel: true }).done, "skip");
  assert.equal(stepInsigniaEditor(changed, NONE).done, null);
});

test("only a real design is accepted from a save", () => {
  assert.ok(isInsignia(DEFAULT_INSIGNIA));
  assert.equal(isInsignia({ symbol: "nope", cloth: "red", mark: "white" }), false);
  assert.equal(isInsignia({ symbol: "pine", cloth: "red", mark: "red" }), false);
  assert.equal(isInsignia("pine"), false);
  assert.equal(isInsignia(null), false);
});
