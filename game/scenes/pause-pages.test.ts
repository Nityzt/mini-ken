import test from "node:test";
import assert from "node:assert/strict";
import { measureText, wrapText } from "../art/font.ts";
import { ALL_ITEMS, itemInfo } from "../items.ts";
import { KI_GOAL, LADDER, TECHNIQUE_INFO, unlockKind } from "../progress.ts";
import { MAP_LOCKED, MAP_NEXT, MAP_OPEN, PROGRESS_OPEN_DONE } from "./content.ts";
import { CARD_TEXT_LINES, CARD_TEXT_WIDTH } from "./inventory-page.ts";
import { KIND_COLORS, mapWindow } from "./progress-page.ts";

test("every item's name and description fit on its card in the inventory", () => {
  for (const item of ALL_ITEMS) {
    const { name, line } = itemInfo(item);
    const lines = wrapText(name, CARD_TEXT_WIDTH).length + wrapText(line, CARD_TEXT_WIDTH).length;
    assert.ok(lines <= CARD_TEXT_LINES, `${item}: ${lines} lines`);
    for (const text of [...wrapText(name, CARD_TEXT_WIDTH), ...wrapText(line, CARD_TEXT_WIDTH)]) assert.ok(measureText(text) <= CARD_TEXT_WIDTH, `${item}: ${text}`);
  }
});

test("every technique's row fits the Techniques page, learned or not", () => {
  for (const technique of TECHNIQUE_INFO) {
    assert.ok(22 + measureText(technique.name) < 134 - 4, technique.name);
    for (const text of [technique.line, technique.hint]) assert.ok(134 + measureText(text) <= 248, text);
  }
});

test("every row of the map fits beside its status", () => {
  for (const unlock of LADDER) {
    assert.ok(18 + measureText(unlock.label) + 6 + measureText(PROGRESS_OPEN_DONE) + 8 <= 240, unlock.label);
    const header = 14 + measureText(MAP_NEXT) + 10 + measureText(unlock.label);
    assert.ok(header + Math.max(measureText(MAP_LOCKED) - measureText(MAP_NEXT), measureText(MAP_OPEN) - measureText(MAP_NEXT), 0) <= 248, unlock.label);
  }
});

test("the map keeps the picked row on screen, and never scrolls past the end", () => {
  for (let choice = 0; choice < LADDER.length; choice++) {
    const first = mapWindow(choice);
    assert.ok(first <= choice && choice < first + 8, `row ${choice}`);
    assert.ok(first + 8 <= LADDER.length);
  }
});

test("every kind of row on the map has its own color, and every row has a kind", () => {
  const kinds = new Set(LADDER.map(unlockKind));
  for (const kind of kinds) assert.ok(KIND_COLORS[kind], kind);
  assert.deepEqual([...kinds].sort(), ["city", "cup", "dojo", "fight", "grading", "online", "travel"]);
  assert.equal(unlockKind(LADDER.find((u) => u.id === "market")!), "fight");
  assert.equal(unlockKind(LADDER.find((u) => u.id === "raccoon")!), "dojo");
  assert.equal(unlockKind(LADDER.find((u) => u.id === "parkLine")!), "travel");
});

test("a full ki bar means the most ki anything asks for", () => {
  assert.equal(KI_GOAL, Math.max(...LADDER.map((u) => u.ki ?? 0)));
  assert.ok(KI_GOAL > 0);
});
