import type { OutcomeReason } from "./protocol.ts";
import type { SaveApi, StoredSave } from "./save-sync.ts";

export type Account = { id: string; username: string; tutorial: boolean };
export type AccountRecord = { wins: number; losses: number };
export type HistoryRow = { opponent: string; result: "won" | "lost" | "void"; reason: OutcomeReason; playedAt: number };
export type AccountStatus = "unknown" | "signed-in" | "signed-out" | "unreachable";
export type AccountClient = {
  status(): AccountStatus;
  current(): Account | null;
  record(): AccountRecord | null;
  refresh(): Promise<void>;
  /** Each of these gives back what's wrong as text, or null if it worked. */
  signUp(username: string, password: string): Promise<string | null>;
  signIn(username: string, password: string): Promise<string | null>;
  /** Forgets you here either way. False means the server couldn't be told, so its session's still there. */
  signOut(): Promise<boolean>;
  finishTutorial(): Promise<void>;
  /** Null if the server can't be reached. */
  history(): Promise<HistoryRow[] | null>;
};

const UNREACHABLE = "Can't reach the server right now. Try again in a moment.";
const json = (body: unknown): RequestInit => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function createAccountClient(fetcher: typeof fetch): AccountClient {
  let status: AccountStatus = "unknown";
  let account: Account | null = null;
  let record: AccountRecord | null = null;

  const adopt = (body: { account: Account; wins: number; losses: number }) => {
    account = body.account;
    record = { wins: body.wins, losses: body.losses };
    status = "signed-in";
  };
  const forget = () => {
    account = null;
    record = null;
    status = "signed-out";
  };
  const enter = async (path: string, username: string, password: string) => {
    try {
      const res = await fetcher(path, { method: "POST", ...json({ username, password }) });
      const body = await res.json();
      if (!res.ok) return String(body.problem ?? "That didn't work.");
      adopt(body);
      return null;
    } catch {
      return UNREACHABLE;
    }
  };

  return {
    status: () => status,
    current: () => account,
    record: () => record,
    async refresh() {
      try {
        const res = await fetcher("/api/me");
        if (res.ok) adopt(await res.json());
        else if (res.status === 401) forget();
        else if (status === "unknown") status = "unreachable";
      } catch {
        // Whoever you were a moment ago, you still are.
        if (!account) status = "unreachable";
      }
    },
    signUp: (username, password) => enter("/api/signup", username, password),
    signIn: (username, password) => enter("/api/signin", username, password),
    async signOut() {
      forget();
      try {
        return (await fetcher("/api/signout", { method: "POST", ...json({}) })).ok;
      } catch {
        return false;
      }
    },
    async finishTutorial() {
      if (!account) return;
      account = { ...account, tutorial: true };
      try {
        await fetcher("/api/me/tutorial", { method: "POST", ...json({}) });
      } catch {
        // It's remembered in this browser too, and sent again next time they sign in.
      }
    },
    async history() {
      try {
        const res = await fetcher("/api/history");
        return res.ok ? ((await res.json()) as HistoryRow[]) : null;
      } catch {
        return null;
      }
    },
  };
}

export function createSaveApi(fetcher: typeof fetch): SaveApi {
  const put = (baseRevision: number, data: string | null, extra: RequestInit = {}) => fetcher("/api/story", { method: "PUT", ...json({ baseRevision, data }), ...extra });
  return {
    async read() {
      const res = await fetcher("/api/story");
      if (!res.ok) throw new Error(`Story read failed: ${res.status}`);
      return (await res.json()) as StoredSave;
    },
    async write(baseRevision, data) {
      const res = await put(baseRevision, data);
      if (res.status === 409) return { ok: false, current: ((await res.json()) as { current: StoredSave }).current };
      if (!res.ok) throw new Error(`Story write failed: ${res.status}`);
      return { ok: true, revision: ((await res.json()) as { revision: number }).revision };
    },
    writeOnClose(baseRevision, data) {
      void put(baseRevision, data, { keepalive: true }).catch(() => {});
    },
  };
}
