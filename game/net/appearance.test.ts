import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_INSIGNIA } from "../insignia.ts";
import { isAppearance, appearanceColors } from "./appearance.ts";

test("appearance only accepts known characters, palettes and safe insignia", () => {
  const appearance = { character: "saki", armor: "ink", insignia: DEFAULT_INSIGNIA };
  assert.equal(isAppearance(appearance), true);
  assert.equal(isAppearance({ ...appearance, character: "unknown" }), false);
  assert.equal(isAppearance({ ...appearance, armor: "untrusted" }), false);
  assert.equal(isAppearance({ ...appearance, insignia: { ...DEFAULT_INSIGNIA, symbol: "custom" } }), false);
});

test("different selected characters and colors produce their real appearance", () => {
  const base = { character: "haru", armor: "pine", insignia: DEFAULT_INSIGNIA } as const;
  assert.notDeepEqual(appearanceColors(base), appearanceColors({ ...base, character: "saki" }));
  assert.notDeepEqual(appearanceColors(base), appearanceColors({ ...base, armor: "ink" }));
});

test("multiplayer colors unlock from completed-match win rate", async () => {
  const { rankForRecord, canWearOnline } = await import("./appearance.ts");
  assert.equal(rankForRecord({ wins: 0, losses: 0 }), "bronze");
  assert.equal(rankForRecord({ wins: 2, losses: 2 }), "bronze");
  assert.equal(rankForRecord({ wins: 3, losses: 2 }), "silver");
  assert.equal(rankForRecord({ wins: 7, losses: 3 }), "gold");
  assert.equal(rankForRecord({ wins: 6, losses: 4 }), "silver");
  assert.equal(canWearOnline("radish", { wins: 6, losses: 4 }), false);
  assert.equal(canWearOnline("radish", { wins: 7, losses: 3 }), true);
  assert.equal(canWearOnline("ink", { wins: 0, losses: 0 }), true);
});

test("multiplayer appearance persists without changing a story save", async () => {
  const { readProfile, writeProfile, createProfile } = await import("./profile.ts");
  const data = new Map<string, string>([["story", "unchanged"]]);
  const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const look = { character: "emi", armor: "ink", insignia: DEFAULT_INSIGNIA } as const;
  writeProfile(store, { ...createProfile(() => 0), appearance: look });
  assert.deepEqual(readProfile(store).appearance, look);
  assert.equal(data.get("story"), "unchanged");
});

test("the lobby protocol validates and carries the chosen appearance", async () => {
  const { parseClientMessage, parseServerMessage, PROTOCOL_VERSION } = await import("./protocol.ts");
  const appearance = { character: "emi", armor: "ink", insignia: DEFAULT_INSIGNIA };
  assert.deepEqual(parseClientMessage(JSON.stringify({ t: "hello", version: PROTOCOL_VERSION, appearance })), { t: "hello", version: PROTOCOL_VERSION, appearance });
  const identity = { id: "one", name: "Player", dan: 1, guest: false, appearance };
  assert.deepEqual(parseServerMessage(JSON.stringify({ t: "opponent-joined", opponent: identity })), { t: "opponent-joined", opponent: identity });
  assert.equal(parseClientMessage(JSON.stringify({ t: "hello", version: PROTOCOL_VERSION, appearance: { ...appearance, character: "bad" } })), null);
});

test("locked armor falls back safely while keeping the chosen character and insignia", async () => {
  const { allowedAppearance } = await import("./appearance.ts");
  const look = { character: "emi", armor: "radish", insignia: DEFAULT_INSIGNIA } as const;
  assert.deepEqual(allowedAppearance(look, { wins: 0, losses: 0 }), { ...look, armor: "pine" });
  assert.deepEqual(allowedAppearance(look, { wins: 7, losses: 3 }), look);
});

test("the fighter insignia carries the selected symbol and colors", async () => {
  const { duelInsigniaPixels } = await import("../art/duel-sprites.ts");
  const plain = duelInsigniaPixels(DEFAULT_INSIGNIA);
  const star = duelInsigniaPixels({ ...DEFAULT_INSIGNIA, symbol: "star" });
  assert.equal(plain.length, 25);
  assert.notDeepEqual(star, plain);
  assert.equal(new Set(star.map((p) => p.color)).size, 2);
});

test("account appearance storage is isolated from other accounts and guests", async () => {
  const { readAccountAppearance, writeAccountAppearance } = await import("./appearance.ts");
  const data = new Map<string, string>();
  const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const look = { character: "emi", armor: "ink", insignia: DEFAULT_INSIGNIA } as const;
  writeAccountAppearance(store, "one", look);
  assert.deepEqual(readAccountAppearance(store, "one"), look);
  assert.equal(readAccountAppearance(store, "two"), null);
  assert.equal(data.has("tiny-kendo-online"), false);
});
