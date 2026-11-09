import { danLabel } from "../ranks.ts";
import type { RunState } from "../run-state.ts";
import { readSave, SAVE_KEY, type SaveStore } from "../save.ts";
import { PROFILE_KEY } from "./profile.ts";

export const SYNC_KEY = "tiny-kendo-sync";
export const UPLOAD_EVERY_MS = 30_000;
/** Scenes can change quickly. Each change doesn't need its own upload. */
const SCENE_UPLOAD_GAP_MS = 5_000;

/** Where this browser's save stands with an account. `dirty` means it has changes the account hasn't got, and with no save at all, that it's been removed. */
export type SyncMeta = { accountId: string | null; baseRevision: number; dirty: boolean; savedAt: number | null };
export type StoredSave = { revision: number; data: string | null; updatedAt: number };
export type WriteResult = { ok: true; revision: number } | { ok: false; current: StoredSave };
export type SaveApi = {
  read(): Promise<StoredSave>;
  write(baseRevision: number, data: string | null): Promise<WriteResult>;
  /** The page is going away, so there's no waiting for an answer. */
  writeOnClose(baseRevision: number, data: string | null): void;
};
export type SyncDecision = "nothing" | "upload" | "download" | "remove-local" | "ask";
export type SaveSummary = { rank: string; lastPlayed: number | null };
export type SaveChoice = { local: SaveSummary | null; account: SaveSummary | null; resolve(keep: "local" | "account"): Promise<void> };
export type SaveSync = {
  signedIn(accountId: string): Promise<void>;
  changed(): void;
  sceneChanged(): void;
  flushOnClose(): void;
  removeStory(): void;
  signOut(options?: { force?: boolean }): Promise<{ sent: boolean }>;
  /** The first comparison with the account's story has finished, whichever way it went. */
  settled(): boolean;
  pendingChoice(): SaveChoice | null;
};

export function decideSync(local: { data: string | null; meta: SyncMeta }, remote: StoredSave, accountId: string): SyncDecision {
  const { data, meta } = local;
  if (data === remote.data) return "nothing";
  if (meta.accountId !== accountId) {
    if (data === null) return "download";
    // A guest's story can move into an empty account. Someone else's never goes anywhere without asking.
    return meta.accountId === null && remote.data === null ? "upload" : "ask";
  }
  if (meta.baseRevision === remote.revision) {
    if (meta.dirty) return "upload";
    return data === null ? "download" : "nothing";
  }
  if (meta.dirty) return "ask";
  return remote.data === null ? "remove-local" : "download";
}

const parseMeta = (text: string | null): SyncMeta => {
  try {
    const raw = text ? (JSON.parse(text) as Partial<SyncMeta>) : null;
    if (raw && Number.isInteger(raw.baseRevision) && typeof raw.dirty === "boolean") {
      return { accountId: typeof raw.accountId === "string" ? raw.accountId : null, baseRevision: raw.baseRevision!, dirty: raw.dirty, savedAt: typeof raw.savedAt === "number" ? raw.savedAt : null };
    }
  } catch {
    // Starts again as a stranger, which only ever means asking.
  }
  return { accountId: null, baseRevision: 0, dirty: false, savedAt: null };
};

const parseSave = (text: string | null): RunState | null => (text ? readSave({ getItem: () => text, setItem() {}, removeItem() {} }) : null);

function summarize(text: string | null, lastPlayed: number | null): SaveSummary | null {
  const run = parseSave(text);
  return run ? { rank: danLabel(run.dan), lastPlayed } : null;
}

export function createSaveSync(deps: {
  store: SaveStore;
  api: SaveApi;
  now(): number;
  /** Someone's playing right now, so their story can't be replaced without asking. */
  inStory(): boolean;
  reload(run: RunState | null): void;
  schedule(run: () => void, ms: number): void;
}): SaveSync {
  const { store, api, now, inStory, reload, schedule } = deps;
  const safely = <T>(action: () => T, fallback: T): T => {
    try {
      return action();
    } catch {
      return fallback;
    }
  };
  let meta = parseMeta(safely(() => store.getItem(SYNC_KEY), null));
  let account: string | null = null;
  let synced = false;
  let settled = false;
  let choice: SaveChoice | null = null;
  let timer = false;
  let flushing: Promise<void> | null = null;
  let lastUpload = -Infinity;

  const local = () => safely(() => store.getItem(SAVE_KEY), null);
  const update = (next: Partial<SyncMeta>) => {
    meta = { ...meta, ...next };
    safely(() => store.setItem(SYNC_KEY, JSON.stringify(meta)), undefined);
  };
  const arm = () => {
    if (timer) return;
    timer = true;
    schedule(() => {
      timer = false;
      void flush();
    }, UPLOAD_EVERY_MS);
  };

  const raiseChoice = (remote: StoredSave, id: string) => {
    choice = {
      local: summarize(local(), meta.savedAt),
      account: summarize(remote.data, remote.updatedAt || null),
      async resolve(keep) {
        choice = null;
        if (keep === "account") {
          install(remote, id);
          return;
        }
        update({ accountId: id, baseRevision: remote.revision, dirty: true });
        await flush();
      },
    };
  };

  const install = (remote: StoredSave, id: string) => {
    safely(() => (remote.data === null ? store.removeItem(SAVE_KEY) : store.setItem(SAVE_KEY, remote.data)), undefined);
    update({ accountId: id, baseRevision: remote.revision, dirty: false, savedAt: remote.updatedAt || null });
    reload(parseSave(remote.data));
  };

  const send = async () => {
    const id = account!;
    const text = local();
    try {
      const result = await api.write(meta.baseRevision, text);
      if (account !== id) return;
      if (result.ok) {
        lastUpload = now();
        // Anything saved while that was on its way still has to go.
        update({ baseRevision: result.revision, dirty: local() !== text });
      } else {
        raiseChoice(result.current, id);
      }
    } catch {
      if (account === id) arm();
    }
  };

  function flush(): Promise<void> {
    if (flushing) return flushing;
    if (!account || !synced || !meta.dirty || choice) return Promise.resolve();
    flushing = send().finally(() => {
      flushing = null;
      if (account && meta.dirty && !choice) arm();
    });
    return flushing;
  }

  const meet = async (id: string) => {
    let remote: StoredSave;
    try {
      remote = await api.read();
    } catch {
      settled = true;
      // Play carries on from this browser, and this happens again until it works.
      schedule(() => {
        if (account === id && !synced) void meet(id);
      }, UPLOAD_EVERY_MS);
      return;
    }
    if (account !== id) return;
    settled = true;
    synced = true;
    const decision = decideSync({ data: local(), meta }, remote, id);
    if (decision === "nothing") {
      update({ accountId: id, baseRevision: remote.revision, dirty: false });
    } else if (decision === "upload") {
      update({ accountId: id, baseRevision: remote.revision, dirty: true });
      await flush();
    } else if (decision === "ask" || inStory()) {
      raiseChoice(remote, id);
    } else {
      install(remote, id);
    }
  };

  return {
    signedIn(id) {
      account = id;
      synced = false;
      settled = false;
      choice = null;
      return meet(id);
    },
    changed() {
      // A save tied to an account has unsent changes even when the account's unknown right now,
      // with the server down or a session lapsed. Otherwise, they'd be overwritten without asking.
      if (meta.accountId) {
        update({ savedAt: now(), dirty: true });
        if (synced && account === meta.accountId) arm();
      } else {
        update({ savedAt: now() });
      }
    },
    sceneChanged() {
      if (meta.dirty && now() - lastUpload >= SCENE_UPLOAD_GAP_MS) void flush();
    },
    flushOnClose() {
      if (account && synced && meta.dirty && !choice) api.writeOnClose(meta.baseRevision, local());
    },
    removeStory() {
      if (!meta.accountId) return;
      update({ dirty: true, savedAt: now() });
      void flush();
    },
    async signOut(options) {
      if (account && meta.dirty) await flush();
      const sent = !account || (synced && !meta.dirty && !choice);
      if (sent || options?.force) {
        account = null;
        synced = false;
        choice = null;
        safely(() => {
          store.removeItem(SAVE_KEY);
          store.removeItem(PROFILE_KEY);
          store.removeItem(SYNC_KEY);
        }, undefined);
        meta = parseMeta(null);
      }
      return { sent };
    },
    pendingChoice: () => choice,
    settled: () => settled,
  };
}
