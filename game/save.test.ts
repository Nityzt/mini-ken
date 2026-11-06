import test from "node:test";
import assert from "node:assert/strict";
import { createRunState, type RunState } from "./run-state.ts";
import { clearSave, readSave, resumeScene, SAVE_KEY, writeSave, type SaveStore } from "./save.ts";

const memoryStore = (initial: Record<string, string> = {}): SaveStore & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
};
const broken: SaveStore = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("full"); },
  removeItem() { throw new Error("blocked"); },
};
const played = (): RunState => ({
  ...createRunState(),
  metSenpai: true,
  gi: true,
  gear: { tare: true, do: true, men: false, kote: false, shinai: true },
  senseiRounds: 2,
  linePasses: 2,
  beaten: ["aki"],
  screenBroken: true,
  losses: { radish: 2 },
  node: "market",
  cleared: ["market"],
  bonusKi: 25,
});

test("a saved game comes back exactly as it was", () => {
  const store = memoryStore();
  writeSave(store, played());
  assert.deepEqual(readSave(store), played());
});

test("nothing saved means nothing to continue", () => {
  assert.equal(readSave(memoryStore()), null);
});

test("clearing the save removes it", () => {
  const store = memoryStore();
  writeSave(store, played());
  clearSave(store);
  assert.equal(readSave(store), null);
});

test("damaged saves are ignored rather than crashing the game", () => {
  for (const text of [
    "not json",
    "null",
    "[]",
    "{}",
    JSON.stringify({ version: 999, run: played() }),
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, run: { ...played(), node: "narnia" } }),
    JSON.stringify({ version: 1, run: { ...played(), bonusKi: "lots" } }),
    JSON.stringify({ version: 1, run: { ...played(), gear: { tare: "yes" } } }),
    JSON.stringify({ version: 1, run: { ...played(), cleared: [1, 2] } }),
    JSON.stringify({ version: 1, run: { ...played(), losses: { radish: "two" } } }),
    JSON.stringify({ version: 1, run: { ...played(), linePasses: -1 } }),
  ]) {
    assert.equal(readSave(memoryStore({ [SAVE_KEY]: text })), null, text);
  }
});

test("a save missing newer fields fills them in with their starting values", () => {
  const { linePasses: _l, beaten: _b, screenBroken: _s, ...older } = played();
  const loaded = readSave(memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, run: older }) }));
  assert.equal(loaded?.linePasses, 0);
  assert.deepEqual(loaded?.beaten, []);
  assert.equal(loaded?.bonusKi, 25);
});

test("unknown fields in a save are dropped", () => {
  const loaded = readSave(memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, run: { ...played(), cheat: true } }) }));
  assert.equal(loaded !== null && "cheat" in loaded, false);
});

test("blocked or full storage never stops the game", () => {
  assert.equal(readSave(broken), null);
  assert.doesNotThrow(() => writeSave(broken, played()));
  assert.doesNotThrow(() => clearSave(broken));
  assert.equal(readSave(null), null);
  assert.doesNotThrow(() => writeSave(null, played()));
  assert.doesNotThrow(() => clearSave(null));
});

test("you pick up at home if that's where you were, and on the map otherwise", () => {
  assert.equal(resumeScene(createRunState()), "club");
  assert.equal(resumeScene({ ...createRunState(), node: "radish" }), "map");
});

test("your character, insignia and cups are saved", () => {
  const store = memoryStore();
  const run: RunState = { ...createRunState(), character: "kai", insignia: { symbol: "pine", cloth: "gold", mark: "ink" }, cups: ["raccoon"] };
  writeSave(store, run);
  const back = readSave(store)!;
  assert.equal(back.character, "kai");
  assert.deepEqual(back.insignia, run.insignia);
  assert.deepEqual(back.cups, ["raccoon"]);
});

test("an older save without those fields still loads, with the defaults", () => {
  const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, run: { gi: true } }) });
  const back = readSave(store)!;
  assert.equal(back.gi, true);
  assert.equal(back.character, "haru");
  assert.equal(back.insignia.symbol, "plain");
  assert.deepEqual(back.cups, []);
});

test("a save with a made-up character, design or cup is rejected", () => {
  for (const bad of [{ character: "nobody" }, { insignia: { symbol: "nope", cloth: "red", mark: "white" } }, { cups: ["nope"] }]) {
    const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, run: bad }) });
    assert.equal(readSave(store), null, JSON.stringify(bad));
  }
});

test("a save from before gradings keeps the rank its wins imply, and a newer save keeps what it says", () => {
  const store = memoryStore();
  store.setItem(SAVE_KEY, JSON.stringify({ version: 1, run: { beaten: ["raccoon", "goose"], node: "pinecone" } }));
  assert.equal(readSave(store)?.dan, 1);
  assert.equal(readSave(store)?.xp, 0);
  store.setItem(SAVE_KEY, JSON.stringify({ version: 1, run: { beaten: ["raccoon", "goose"], node: "pinecone", dan: 0, xp: 40 } }));
  assert.equal(readSave(store)?.dan, 0);
  assert.equal(readSave(store)?.xp, 40);
});
