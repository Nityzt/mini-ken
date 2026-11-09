import test from "node:test";
import assert from "node:assert/strict";
import { createRunState } from "../run-state.ts";
import { SAVE_KEY } from "../save.ts";
import { PROFILE_KEY } from "./profile.ts";
import { createSaveSync, decideSync, SYNC_KEY, UPLOAD_EVERY_MS, type SaveApi, type StoredSave, type SyncMeta } from "./save-sync.ts";

const meta = (partial: Partial<SyncMeta> = {}): SyncMeta => ({ accountId: "me", baseRevision: 3, dirty: false, savedAt: 1, ...partial });
const remote = (revision: number, data: string | null = revision ? "B" : null): StoredSave => ({ revision, data, updatedAt: 5 });
const decide = (data: string | null, m: SyncMeta, r: StoredSave) => decideSync({ data, meta: m }, r, "me");

test("what happens when a browser and an account's story meet", () => {
  assert.equal(decide("B", meta({ dirty: true, baseRevision: 1 }), remote(3)), "nothing");
  assert.equal(decide("A", meta(), remote(3)), "nothing");
  assert.equal(decide("A", meta({ dirty: true }), remote(3)), "upload");
  assert.equal(decide("A", meta({ baseRevision: 2 }), remote(3)), "download");
  assert.equal(decide("A", meta({ baseRevision: 2, dirty: true }), remote(3)), "ask");
  assert.equal(decide(null, meta({ baseRevision: 2 }), remote(3)), "download");
  assert.equal(decide("A", meta({ baseRevision: 2 }), remote(3, null)), "remove-local");
  assert.equal(decide("A", meta({ accountId: null, baseRevision: 0 }), remote(0)), "upload");
  assert.equal(decide("A", meta({ accountId: null, baseRevision: 0 }), remote(3)), "ask");
  assert.equal(decide(null, meta({ accountId: null, baseRevision: 0 }), remote(3)), "download");
});

test("someone else's save is never uploaded without asking", () => {
  assert.equal(decide("A", meta({ accountId: "them" }), remote(0)), "ask");
  assert.equal(decide("A", meta({ accountId: "them", dirty: true, baseRevision: 3 }), remote(3)), "ask");
  assert.equal(decide(null, meta({ accountId: "them" }), remote(3)), "download");
});

test("a restart waiting to be sent removes the account's story", () => {
  assert.equal(decide(null, meta({ dirty: true }), remote(3)), "upload");
  assert.equal(decide(null, meta({ dirty: true, baseRevision: 2 }), remote(3)), "ask");
  assert.equal(decide(null, meta({ dirty: true, baseRevision: 3 }), remote(3, null)), "nothing");
});

test("having nothing anywhere is nothing to do", () => {
  assert.equal(decide(null, meta({ accountId: null, baseRevision: 0 }), remote(0)), "nothing");
  assert.equal(decide(null, meta({ baseRevision: 2 }), remote(3, null)), "nothing");
});

const saveText = (dan: number) => JSON.stringify({ version: 1, run: { ...createRunState(), dan } });

function setup(options: { local?: string | null; meta?: SyncMeta; account?: StoredSave; inStory?: boolean } = {}) {
  const data = new Map<string, string>();
  if (options.local) data.set(SAVE_KEY, options.local);
  if (options.meta) data.set(SYNC_KEY, JSON.stringify(options.meta));
  data.set(PROFILE_KEY, "profile");
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  const world = { account: options.account ?? { revision: 0, data: null, updatedAt: 0 }, offline: false, writes: [] as { base: number; data: string | null }[], closes: [] as (string | null)[] };
  const api: SaveApi = {
    read: async () => {
      if (world.offline) throw new Error("offline");
      return world.account;
    },
    write: async (base, text) => {
      if (world.offline) throw new Error("offline");
      world.writes.push({ base, data: text });
      if (base !== world.account.revision) return { ok: false, current: world.account };
      world.account = { revision: base + 1, data: text, updatedAt: 99 };
      return { ok: true, revision: base + 1 };
    },
    writeOnClose: (_base, text) => void world.closes.push(text),
  };
  let clock = 1000;
  const timers: { at: number; run(): void }[] = [];
  const reloads: unknown[] = [];
  let inStory = options.inStory ?? false;
  const sync = createSaveSync({
    store,
    api,
    now: () => clock,
    inStory: () => inStory,
    reload: (run) => void reloads.push(run),
    schedule: (run, ms) => void timers.push({ at: clock + ms, run }),
  });
  const advance = async (ms: number) => {
    clock += ms;
    for (const timer of timers.splice(0)) {
      if (timer.at <= clock) timer.run();
      else timers.push(timer);
    }
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { sync, data, world, reloads, advance, setInStory: (value: boolean) => (inStory = value), localMeta: () => JSON.parse(data.get(SYNC_KEY) ?? "null") as SyncMeta };
}

test("many changes in thirty seconds send one upload", async () => {
  const { sync, data, world, advance } = setup();
  await sync.signedIn("me");
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  for (let i = 0; i < 20; i++) {
    data.set(SAVE_KEY, saveText(i));
    sync.changed();
  }
  assert.equal(world.writes.length, 0);
  await advance(UPLOAD_EVERY_MS);
  assert.equal(world.writes.length, 1);
  assert.equal(world.writes[0].data, saveText(19));
  await advance(UPLOAD_EVERY_MS);
  assert.equal(world.writes.length, 1);
});

test("changing scene sends what's waiting straight away, but not constantly", async () => {
  const { sync, data, world, advance } = setup();
  await sync.signedIn("me");
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  sync.sceneChanged();
  await advance(0);
  assert.equal(world.writes.length, 1);
  data.set(SAVE_KEY, saveText(2));
  sync.changed();
  sync.sceneChanged();
  await advance(0);
  assert.equal(world.writes.length, 1);
});

test("a guest's changes go nowhere", async () => {
  const { sync, data, world, advance, localMeta } = setup();
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  await advance(UPLOAD_EVERY_MS);
  assert.equal(world.writes.length, 0);
  assert.equal(localMeta().savedAt, 1000);
});

test("signing up with a story in this browser uploads it", async () => {
  const { sync, world, localMeta } = setup({ local: saveText(2) });
  await sync.signedIn("me");
  assert.deepEqual(world.writes, [{ base: 0, data: saveText(2) }]);
  assert.equal(localMeta().accountId, "me");
  assert.equal(localMeta().baseRevision, 1);
  assert.equal(localMeta().dirty, false);
});

test("a newer story on the account comes down by itself", async () => {
  const { sync, data, reloads, localMeta } = setup({ local: saveText(1), meta: meta({ baseRevision: 2 }), account: { revision: 3, data: saveText(4), updatedAt: 5 } });
  await sync.signedIn("me");
  assert.equal(data.get(SAVE_KEY), saveText(4));
  assert.equal(localMeta().baseRevision, 3);
  assert.equal(reloads.length, 1);
});

test("a download never swaps the story under someone who's playing", async () => {
  const { sync, data, reloads } = setup({ local: saveText(1), meta: meta({ baseRevision: 2 }), account: { revision: 3, data: saveText(4), updatedAt: 5 }, inStory: true });
  await sync.signedIn("me");
  assert.equal(data.get(SAVE_KEY), saveText(1));
  assert.equal(reloads.length, 0);
  assert.ok(sync.pendingChoice());
});

test("the choice shows both stories, and nothing's touched until it's made", async () => {
  const { sync, data, world, reloads } = setup({ local: saveText(2), meta: meta({ accountId: null, baseRevision: 0, savedAt: 7 }), account: { revision: 3, data: saveText(4), updatedAt: 5 } });
  await sync.signedIn("me");
  const choice = sync.pendingChoice();
  assert.ok(choice);
  assert.equal(choice.local?.lastPlayed, 7);
  assert.equal(choice.account?.lastPlayed, 5);
  assert.notEqual(choice.local?.rank, choice.account?.rank);
  assert.equal(world.writes.length, 0);
  assert.equal(data.get(SAVE_KEY), saveText(2));
  await choice.resolve("account");
  assert.equal(data.get(SAVE_KEY), saveText(4));
  assert.equal(reloads.length, 1);
  assert.equal(sync.pendingChoice(), null);
});

test("keeping this browser's story overwrites the account's only then", async () => {
  const { sync, world } = setup({ local: saveText(2), meta: meta({ accountId: null, baseRevision: 0 }), account: { revision: 3, data: saveText(4), updatedAt: 5 } });
  await sync.signedIn("me");
  await sync.pendingChoice()!.resolve("local");
  assert.deepEqual(world.writes, [{ base: 3, data: saveText(2) }]);
});

test("an older save with no date shows as unknown", async () => {
  const { sync } = setup({ local: saveText(2), account: { revision: 3, data: saveText(4), updatedAt: 5 } });
  await sync.signedIn("me");
  assert.equal(sync.pendingChoice()?.local?.lastPlayed, null);
});

test("another device moving on while you play raises the choice", async () => {
  const { sync, data, world, advance } = setup();
  await sync.signedIn("me");
  world.account = { revision: 5, data: saveText(6), updatedAt: 50 };
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  await advance(UPLOAD_EVERY_MS);
  assert.ok(sync.pendingChoice());
  assert.equal(world.account.data, saveText(6));
  assert.equal(data.get(SAVE_KEY), saveText(1));
});

test("no connection loses nothing, and it tries again", async () => {
  const { sync, data, world, advance, localMeta } = setup();
  await sync.signedIn("me");
  world.offline = true;
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  await advance(UPLOAD_EVERY_MS);
  assert.equal(localMeta().dirty, true);
  assert.equal(data.get(SAVE_KEY), saveText(1));
  world.offline = false;
  await advance(UPLOAD_EVERY_MS);
  assert.equal(world.account.data, saveText(1));
  assert.equal(localMeta().dirty, false);
});

test("a server that's down at sign-in doesn't stop anything, and catches up", async () => {
  const { sync, world, advance } = setup({ local: saveText(2) });
  world.offline = true;
  await sync.signedIn("me");
  assert.equal(sync.pendingChoice(), null);
  world.offline = false;
  await advance(UPLOAD_EVERY_MS);
  assert.equal(world.account.data, saveText(2));
});

test("a restart is remembered until the server's heard about it", async () => {
  const { sync, data, world, advance, localMeta } = setup({ local: saveText(1), meta: meta({ baseRevision: 1 }), account: { revision: 1, data: saveText(1), updatedAt: 1 } });
  await sync.signedIn("me");
  world.offline = true;
  data.delete(SAVE_KEY);
  sync.removeStory();
  await advance(0);
  assert.equal(localMeta().dirty, true);
  assert.equal(world.account.data, saveText(1));
  world.offline = false;
  await advance(UPLOAD_EVERY_MS);
  assert.equal(world.account.data, null);
  assert.equal(world.account.revision, 2);
  assert.equal(localMeta().dirty, false);
});

test("a restart survives the page closing before it's sent", async () => {
  const first = setup({ local: saveText(1), meta: meta({ baseRevision: 1 }), account: { revision: 1, data: saveText(1), updatedAt: 1 } });
  first.world.offline = true;
  first.data.delete(SAVE_KEY);
  first.sync.removeStory();
  assert.equal(first.localMeta().dirty, true);
  const later = setup({ meta: first.localMeta(), account: { revision: 1, data: saveText(1), updatedAt: 1 } });
  await later.sync.signedIn("me");
  assert.equal(later.world.account.data, null);
});

test("closing the page sends what's waiting, and the next load doesn't ask about it", async () => {
  const { sync, data, world } = setup();
  await sync.signedIn("me");
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  sync.flushOnClose();
  assert.deepEqual(world.closes, [saveText(1)]);
  world.account = { revision: 2, data: saveText(1), updatedAt: 9 };
  await sync.signedIn("me");
  assert.equal(sync.pendingChoice(), null);
});

test("signing out sends first, and clears this browser only once that's worked", async () => {
  const { sync, data, world } = setup();
  await sync.signedIn("me");
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  assert.deepEqual(await sync.signOut(), { sent: true });
  assert.equal(world.account.data, saveText(1));
  assert.equal(data.has(SAVE_KEY), false);
  assert.equal(data.has(PROFILE_KEY), false);
  assert.equal(data.has(SYNC_KEY), false);
});

test("signing out with no connection warns first, and clears nothing unless forced", async () => {
  const { sync, data, world } = setup();
  await sync.signedIn("me");
  data.set(SAVE_KEY, saveText(1));
  sync.changed();
  world.offline = true;
  assert.deepEqual(await sync.signOut(), { sent: false });
  assert.equal(data.get(SAVE_KEY), saveText(1));
  assert.deepEqual(await sync.signOut({ force: true }), { sent: false });
  assert.equal(data.has(SAVE_KEY), false);
});

test("playing while the account's unknown is still marked unsent, so a newer story asks rather than replaces", async () => {
  const { sync, data, reloads, world } = setup({ local: saveText(1), meta: meta({ baseRevision: 5 }), account: { revision: 6, data: saveText(4), updatedAt: 5 } });
  data.set(SAVE_KEY, saveText(2));
  sync.changed();
  await sync.signedIn("me");
  assert.ok(sync.pendingChoice());
  assert.equal(data.get(SAVE_KEY), saveText(2));
  assert.equal(reloads.length, 0);
  assert.equal(world.writes.length, 0);
});

test("playing while the account's unknown uploads when it's known, and isn't deleted by signing out", async () => {
  const { sync, data, world } = setup({ local: saveText(1), meta: meta({ baseRevision: 5 }), account: { revision: 5, data: saveText(1), updatedAt: 5 } });
  data.set(SAVE_KEY, saveText(2));
  sync.changed();
  await sync.signedIn("me");
  assert.equal(world.account.data, saveText(2));
  assert.deepEqual(await sync.signOut(), { sent: true });
});

test("signing out before the story's been compared isn't called sent", async () => {
  const { sync, data, world } = setup({ local: saveText(1) });
  world.offline = true;
  await sync.signedIn("me");
  assert.deepEqual(await sync.signOut(), { sent: false });
  assert.equal(data.get(SAVE_KEY), saveText(1));
});

test("signing out with a choice still open isn't called sent", async () => {
  const { sync, data } = setup({ local: saveText(1), account: { revision: 2, data: saveText(4), updatedAt: 5 } });
  await sync.signedIn("me");
  assert.ok(sync.pendingChoice());
  assert.deepEqual(await sync.signOut(), { sent: false });
  assert.equal(data.get(SAVE_KEY), saveText(1));
});

test("it says when the first comparison's done, so an invite can wait for it, even if it failed", async () => {
  const ok = setup({ account: { revision: 2, data: saveText(4), updatedAt: 5 } });
  assert.equal(ok.sync.settled(), false);
  const pending = ok.sync.signedIn("me");
  assert.equal(ok.sync.settled(), false);
  await pending;
  assert.equal(ok.sync.settled(), true);
  const down = setup();
  down.world.offline = true;
  await down.sync.signedIn("me");
  assert.equal(down.sync.settled(), true);
});
