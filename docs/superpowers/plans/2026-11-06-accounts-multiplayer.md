# Accounts, Lobbies and Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real people can sign in with a username and password, play each other through a lobby code or invite link, and keep their record, match history and story, on free public hosting.

**Architecture:** One Node process (a custom Next.js server) serves the page, a small `/api` and a `/ws` match relay from one address on Render. Accounts, saves and match history live in Turso, reached through `@libsql/client`. Lobbies and live matches are in memory, and the database is never touched during play. The lobby rules and the who-won rules are pure, clock-injected modules, so they're tested without sockets.

**Tech Stack:** Next.js 16.2.7, Node 24 running `.ts` directly, `ws` 8, `@libsql/client` 0.18, `node:crypto` scrypt, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-06-accounts-multiplayer-design.md`

## Global Constraints

- **Never commit unless the owner specifically asks.** This overrides the usual commit step, so tasks end at green tests.
- Read `node_modules/next/dist/docs/01-app/02-guides/custom-server.md` before Task 2. Don't use `output: "standalone"`.
- Test with `pnpm test` and `pnpm typecheck`. Every task ends with both passing.
- Bind `127.0.0.1` by default, on port 3210. `0.0.0.0` only through `HOST`, set on Render.
- `pnpm dev` keeps working and keeps playing stand-ins when no server is configured.
- Server secrets never use `NEXT_PUBLIC_`. They live in Render's environment or a git-ignored `.env`.
- Store only what the spec's data table lists. No email, no plain passwords, no password in logs.
- The rules must stay deterministic. Don't change `duel/rules.ts`.
- Import paths use the `.ts` extension, and server code must run under Node's type stripping (no `enum`, no parameter properties).
- Render and Turso accounts are the owner's. Creating them, committing, and any paid plan are the owner's decisions.
- Keep these docs true: the new spec, `docs/multiplayer.md`, and `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md`.
- **Shared tree:** another session is reworking duel pacing and visuals in `game/duel/constants.ts`, `game/duel/rules.ts`, `game/scenes/duel.ts`, `game/art/duel-sprites.ts` and `game/duel/poses.ts`. Don't edit those files. This plan owns `game/net/*`, `server/*`, the online scenes and `online-duel.ts`. Before changing a shared file, re-read it, make small edits, and treat test failures in their files as theirs to check with them, not yours to fix.

## Review Focus

Each has its test in the named task.

1. **Tab hidden while waiting in a lobby.** The game loop stops, but the heartbeat, the join alert and the visibility report still work, and the match waits rather than recording a loss. (Task 7)
2. **The same account in two tabs or devices.** A second connection replaces the first, and a player can't join their own lobby from another tab. (Task 4)
3. **An invite link opened signed out, without the tutorial, or after expiry.** The code survives sign-in and the tutorial. An expired code gets a plain message, and the player lands in the multiplayer menu. (Task 8)
4. **A server restart or sleep mid-lobby or mid-match.** The client says the connection was lost, nothing is recorded, and unsent saves retry later. (Tasks 6, 7)
5. **A browser holding another account's save.** Signing in as someone else never uploads that save to the new account without asking. (Task 6)

---

### Task 0: Removed

The owner chose not to deploy a separate lag test. Lag is measured on the deployed game in Task 11.

### Task 1: Protocol version 2

**Files:**
- Modify: `game/net/protocol.ts`, `game/net/net.test.ts`

**Interfaces:**
- Produces, from `protocol.ts`:

```ts
export const PROTOCOL_VERSION = 2;
export type MatchReport = "won" | "lost" | "void";
export type OutcomeReason = "played" | "disagreed" | "out-of-step" | "left" | "silent" | "unreported";
export type LobbyClosedReason = "expired" | "creator-left" | "opponent-left" | "not-back-in-time" | "server";
export type LobbyErrorReason = "no-such-lobby" | "full" | "own-lobby";
export type ClientMessage =
  | { t: "hello"; version: number }
  | { t: "create-lobby" } | { t: "join-lobby"; code: string } | { t: "leave-lobby" }
  | { t: "visible"; visible: boolean } | { t: "ping" }
  | { t: "rematch" } | { t: "result"; report: MatchReport } | LinkMessage;
export type ServerMessage =
  | { t: "welcome"; identity: Identity } | { t: "rejected"; reason: string }
  | { t: "lobby"; code: string } | { t: "lobby-error"; reason: LobbyErrorReason }
  | { t: "opponent-joined"; opponent: Identity }
  | { t: "match"; seed: number; side: 0 | 1; opponent: Identity }
  | { t: "outcome"; winner: "you" | "them" | null; reason: OutcomeReason; wins: number; losses: number }
  | { t: "rematch-wanted" } | { t: "lobby-closed"; reason: LobbyClosedReason } | LinkMessage;
export function parseClientMessage(text: string): ClientMessage | null;
export function parseLobbyCode(raw: unknown): string | null;
export const LOBBY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; export const LOBBY_CODE_LENGTH = 5;
```

- Removes: `queue`, `queued`, `cancel`, `bracket`, `MatchMode`, and the `token` and `identity` fields on `hello`. `Bracket` and `BracketEntrant` types stay, because `bracket.ts` and stand-ins use them.

- [ ] **Step 1: Write failing tests** in `net.test.ts`: `parseServerMessage` and `parseClientMessage` round-trip every message above. `parseClientMessage('{"t":"hello"}')`, unknown `t`, oversized code, and bad JSON all return null. `parseLobbyCode("abc23")` returns `"ABC23"`, and `parseLobbyCode("O0I1L")` returns null. Delete tests for removed messages only as Task 7 replaces the remote service: until then, mark them `test.skip` with a `// Task 7` comment.
- [ ] **Step 2: Run** `node --test game/net/net.test.ts`. Expected: FAIL, `parseClientMessage` not exported.
- [ ] **Step 3: Implement** in `protocol.ts`, following the existing `parseServerMessage` style, passing names through `cleanName`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS. `pnpm typecheck` may fail only in `service.ts` until Task 7, so give `createRemoteService` a `// Task 7` stub that throws and keep typecheck green.

### Task 2: Server skeleton, database and `/health`

**Files:**
- Create: `server/index.ts`, `server/db.ts`, `server/db.test.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces:

```ts
// server/db.ts
export type Db = { execute(sql: string, args?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; close(): void };
export function openDb(url?: string, authToken?: string): Db; // defaults to file:.local/tiny-kendo.db
export async function migrate(db: Db): Promise<void>; // safe to run on every start
// server/index.ts: no exports. Starts the process.
```

- Tables, exactly: `accounts(id TEXT PK, username TEXT, username_key TEXT UNIQUE, password_hash TEXT, tutorial INTEGER, created_at INTEGER)`, `sessions(token_hash TEXT PK, account_id TEXT, expires_at INTEGER)`, `story_saves(account_id TEXT PK, revision INTEGER, data TEXT NULL, updated_at INTEGER)`, `matches(id TEXT PK, player_a TEXT, player_b TEXT, winner TEXT NULL, reason TEXT, played_at INTEGER)`. Index `matches` on each player. `data` is null once a story's been removed, so the revision survives.

- [ ] **Step 1: Install.** `pnpm add ws @libsql/client` and `pnpm add -D @types/ws`. Check `pnpm-workspace.yaml`'s `allowBuilds`, and confirm `file:` URLs work by running Step 3's test.
- [ ] **Step 2: Write failing test** `migrate is safe to run twice, and a username_key can only exist once`, on a temp `file:` database. Change the `test` script to `node --test "game/**/*.test.ts" "server/**/*.test.ts"`.
- [ ] **Step 3: Implement `db.ts`.** Run the test. Expected: PASS.
- [ ] **Step 4: Implement `index.ts`** per the custom-server guide: `next({ dev, hostname, port })`, `createServer` where `/health` answers `200 ok` with no database use, `/api/*` goes to Task 3's handler, and everything else goes to `getRequestHandler()`. `upgrade` on `/ws` goes to Task 4; all others go to `getUpgradeHandler()`, so hot reload works. `dev` in `next()` is true unless `NODE_ENV` is `production`. Scripts: `"start": "NODE_ENV=production node --env-file-if-exists=.env server/index.ts"` and `"dev:online": "NEXT_PUBLIC_TINY_KENDO_SERVER=/ws node --env-file-if-exists=.env server/index.ts"`. `pnpm dev` stays as it is. Ignore `.local/` and `Kendo Kirikaeshi*.mp4` in `.gitignore`.
- [ ] **Step 5: Verify.** Run `pnpm dev:online`, then `curl -s -o /dev/null -w '%{http_code} ' http://127.0.0.1:3210/health http://127.0.0.1:3210/`. Expected: `200 200`. Check `ss -ltn | grep 3210` shows `127.0.0.1`, not `0.0.0.0`. Open the page and confirm the game loads and hot reload connects.

### Task 3: Accounts, sessions and the account API

**Files:**
- Create: `server/accounts.ts`, `server/accounts.test.ts`, `server/rate-limit.ts`, `server/api.ts`, `server/api.test.ts`, `server/scripts/reset-password.ts`

**Interfaces:**
- Consumes: `Db`, `migrate`.
- Produces:

```ts
// accounts.ts
export type Account = { id: string; username: string; tutorial: boolean };
export function usernameProblem(name: string): string | null;
export function passwordProblem(password: string): string | null;
export async function hashPassword(password: string): Promise<string>;
export async function checkPassword(password: string, stored: string): Promise<boolean>;
export async function signUp(db: Db, username: string, password: string): Promise<{ account: Account } | { problem: string }>;
export async function signIn(db: Db, username: string, password: string): Promise<Account | null>;
export async function createSession(db: Db, accountId: string, now: number): Promise<string>; // the raw token
export async function accountForSession(db: Db, token: string | undefined, now: number): Promise<Account | null>;
export async function endSession(db: Db, token: string): Promise<void>;
export async function setPassword(db: Db, username: string, password: string): Promise<boolean>; // and ends that account's sessions
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
// rate-limit.ts
export function createRateLimit(max: number, windowMs: number): { hit(key: string, now: number): boolean }; // false once over
// api.ts
export function createApi(deps: { db: Db; now(): number; publicOrigin: string; secureCookies: boolean; trustProxy: boolean }): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export function sessionToken(req: IncomingMessage): string | undefined;
export function originAllowed(origin: string | undefined, publicOrigin: string): boolean;
```

- Routes: `POST /api/signup`, `POST /api/signin`, `POST /api/signout`, `GET /api/me` (returns `{account, wins, losses}`), `POST /api/me/tutorial`. Tasks 5 and 6 add history and save routes.
- Values: username 3–12 characters of `[A-Za-z0-9_-]`, unique case-insensitively, display capitalization preserved. Reserved: `guest`, `player`, and `guest` followed by digits. Password 8–128 characters. `scrypt` N=2^15, r=8, p=3, 32-byte key, 16-byte random salt, with parameters stored in the hash string and `timingSafeEqual` for checks. Token is 32 random bytes, stored as SHA-256. Cookie is `HttpOnly; SameSite=Lax; Path=/`, plus `Secure` when `secureCookies`. Rate limits are 5 failed sign-ins per username per 15 minutes, and 20 per IP per 15 minutes, and 5 sign-ups per IP per hour. POST bodies are capped at 4 KB, except saves.

- [ ] **Step 1: Write failing tests** in `accounts.test.ts`:
  - `usernameProblem` accepts `Emi_2` and refuses `ab`, a 13-character name, `a b`, `Guest12`, `PLAYER`.
  - `signUp` as `Emi` then `emi` gives a problem, and `Emi` displays as typed.
  - The stored `password_hash` doesn't contain the password, and two accounts with one password have different hashes.
  - `signIn` with a wrong password or unknown name returns null.
  - `accountForSession` works before 30 days and returns null after, and the database holds no raw token.
  - `endSession` ends it, and `setPassword` changes the password and ends sessions.
- [ ] **Step 2: Run** `node --test server/accounts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `accounts.ts` and `rate-limit.ts`. Use async `crypto.scrypt` with an explicit `maxmem`. Expected: PASS.
- [ ] **Step 4: Write failing tests** in `api.test.ts`, on a real local `http.Server`:
  - Sign-up sets a cookie with the expected flags, and `/api/me` then returns the account.
  - A wrong password and an unknown username give the same status and body.
  - A POST with a foreign `Origin` gets 403.
  - The sixth failed sign-in is refused even with the right password.
  - An over-size body gets 413, and malformed JSON gets 400.
  - `/api/me/tutorial` sets the flag.
- [ ] **Step 5: Implement `api.ts`** and wire it into `index.ts`. `publicOrigin` is `process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3210"`. `trustProxy` is `TRUST_PROXY === "1"`, which reads the first `X-Forwarded-For` entry. Expected: PASS.
- [ ] **Step 6: Implement `reset-password.ts`:** `node --env-file-if-exists=.env server/scripts/reset-password.ts <username>`, reading the new password from a no-echo stdin prompt, never from argv. Verify on the local database by signing in with the new password.

### Task 4: Lobbies and the relay

**Files:**
- Create: `server/lobby.ts`, `server/lobby.test.ts`, `server/outcome.ts`, `server/outcome.test.ts`, `server/relay.ts`, `server/relay.test.ts`
- Modify: `server/index.ts`, spec's "Who won" table

**Interfaces:**
- Consumes: `accountForSession`, `sessionToken`, `originAllowed`, `parseClientMessage`, protocol types.
- Produces:

```ts
// outcome.ts
export type Facts = { reports: [MatchReport | null, MatchReport | null]; left: 0 | 1 | null; silent: [boolean, boolean]; waitExpired: boolean };
export type Decision = { done: false } | { done: true; winner: 0 | 1 | null; reason: OutcomeReason };
export function decideOutcome(facts: Facts): Decision;
// lobby.ts: no sockets, no timers
export type Player = { id: string; identity: Identity; send(message: ServerMessage): void; close(): void };
export type LobbyHub = {
  connect(player: Player, now: number): void;
  message(playerId: string, message: ClientMessage, now: number): void;
  disconnect(playerId: string, now: number): void;
  tick(now: number): void; // the relay calls this once a second
};
export function createLobbyHub(deps: { rollCode(): string; rollSeed(): number; record(result: MatchResult): Promise<{ wins: [number, number]; losses: [number, number] }> }): LobbyHub;
export type MatchResult = { players: [string, string]; winner: string | null; reason: OutcomeReason; playedAt: number };
export const LOBBY_EMPTY_MS = 600_000, VISIBLE_WAIT_MS = 120_000, SILENCE_MS = 10_000, REPORT_WAIT_MS = 15_000;
// relay.ts
export function createRelay(deps: { db: Db; now(): number; publicOrigin: string }): { handleUpgrade(req, socket, head): void; close(): void };
```

- `decideOutcome`'s table is the spec's, plus one row the spec lacks (add it there): **a player still connected who never reports within `REPORT_WAIT_MS`: void, reason `unreported`**, so refusing to report can't win a match. If both players go silent: void.

- [ ] **Step 1: Write failing tests** in `outcome.test.ts`, one per row of the spec's table plus the new one:
  - both `won`/`lost` agreeing → that winner, `played`
  - both claim `won` → null, `disagreed`
  - either `void` → null, `out-of-step`
  - `left: 1` → winner 0, `left`
  - `silent: [false, true]` → winner 0, `silent`; both silent → null
  - one report and the other left after finishing → the report stands, `played`
  - one report, other connected, `waitExpired` → null, `unreported`; `waitExpired` false → `{done:false}`
- [ ] **Step 2: Implement `outcome.ts`.** Expected: PASS.
- [ ] **Step 3: Write failing tests** in `lobby.test.ts`, with a fake clock and players:
  - Create returns a code, and join with a lowercase code works.
  - Unknown code gives `no-such-lobby`, a third player gives `full`, and joining your own gives `own-lobby` (including from a second connection).
  - A second connection for the same account closes the first, ending any match as `left` for that account.
  - `opponent-joined` is sent, but `match` is held until both report visible. Then both get the same seed, opposite sides, and each other's identity.
  - If either stays hidden for `VISIBLE_WAIT_MS`: `lobby-closed` `not-back-in-time`, and `record` is never called.
  - An empty lobby closes at `LOBBY_EMPTY_MS`, and a `ping` doesn't extend it. The creator leaving closes it.
  - `input`, `hash` and `leave` reach only the opponent, unchanged, and only in a running match.
  - Disconnect during a match → `outcome` with the other as winner, and `record` called once.
  - `SILENCE_MS` without input from one player → that player loses. The clock starts at the player's first input or `SILENCE_MS` after `match`, plus 3 seconds for the countdown.
  - After `outcome` the lobby stays. A match starts only when both send `rematch`, with `rematch-wanted` sent to the other. A disconnect then sends `lobby-closed` `opponent-left`, and no second result is recorded.
  - A second `result` from one player is ignored, and `record` is called once even if everything happens at once.
- [ ] **Step 4: Implement `lobby.ts`.** Expected: PASS.
- [ ] **Step 5: Write failing tests** in `relay.test.ts`, with real `ws` clients on a local server and a temp database:
  - No cookie, an expired session, or a foreign `Origin` → refused, and a `hello` naming someone else can't change identity.
  - Wrong `version` → `rejected`.
  - Two signed-in clients play to `outcome`, `matches` has one row, and both get matching `wins`/`losses`.
  - A message over 1 KB (`maxPayload`), or a client over 300 messages in a second, is disconnected.
- [ ] **Step 6: Implement `relay.ts`** with `new WebSocketServer({ noServer: true, maxPayload: 1024 })`. `rollCode` uses `crypto.randomInt` over `LOBBY_CODE_ALPHABET`, retrying collisions. `dan` is `Math.max(1, run && isOpen(run, "online") ? run.dan : 0)` from the account's stored story through `parseRun`, loaded once at connect, never during a match. The rank gate stays a client courtesy. Wire `/ws` in `index.ts`. Expected: PASS.

### Task 5: Match history and record

**Files:**
- Create: `server/matches.ts`, `server/matches.test.ts`
- Modify: `server/api.ts`, `server/relay.ts`

**Interfaces:**
- Produces:

```ts
export async function recordMatch(db: Db, result: MatchResult): Promise<void>;
export async function recordOf(db: Db, accountId: string): Promise<{ wins: number; losses: number }>;
export type HistoryRow = { opponent: string; result: "won" | "lost" | "void"; reason: OutcomeReason; playedAt: number };
export async function historyOf(db: Db, accountId: string, limit?: number): Promise<HistoryRow[]>; // default 20, newest first
```

- Route: `GET /api/history` returns `HistoryRow[]`. `GET /api/me` reads `recordOf`.

- [ ] **Step 1: Write failing tests:** wins and losses count only non-void matches, a void match appears in history as `void`, history is capped at 20 and newest first, and `opponent` is the current display username. There's no stored wins column, per the spec.
- [ ] **Step 2: Implement,** and pass `recordMatch` and `recordOf` to the hub from `relay.ts`. Expected: PASS.
- [ ] **Step 3: Handle a failed database write:** `relay.test.ts` gets a test where `record` rejects. Expected: both players still get `outcome` and the server doesn't crash, with the failure logged without passwords or tokens.

### Task 6: Story save sync

**Files:**
- Create: `server/saves.ts`, `server/saves.test.ts`, `game/net/save-sync.ts`, `game/net/save-sync.test.ts`
- Modify: `server/api.ts`, `game/game.ts:191,210-221,267,371-376`

**Interfaces:**
- Consumes: `parseRun` from `game/save.ts`.
- Produces:

```ts
// server/saves.ts
export const SAVE_LIMIT_BYTES = 256 * 1024; // builder confirms against a real late-game save
export type StoredSave = { revision: number; data: string | null; updatedAt: number };
export async function readStory(db: Db, accountId: string): Promise<StoredSave>; // revision 0 and null data if none
export async function writeStory(db: Db, accountId: string, baseRevision: number, data: string | null, now: number): Promise<{ ok: true; revision: number } | { ok: false; current: StoredSave }>;
// game/net/save-sync.ts
export type SyncMeta = { accountId: string | null; baseRevision: number; dirty: boolean; savedAt: number | null };
export const SYNC_KEY = "tiny-kendo-sync";
export type SyncDecision = "nothing" | "upload" | "download" | "remove-local" | "ask";
export function decideSync(local: { data: string | null; meta: SyncMeta }, remote: StoredSave, accountId: string): SyncDecision;
export type SaveSync = {
  signedIn(accountId: string): Promise<void>;   // runs decideSync, may raise a "which to keep" choice
  changed(data: string): void;                  // marks dirty, throttled to one upload per 30s
  sceneChanged(): void; flushOnClose(): void;   // sendBeacon or keepalive fetch
  removeStory(): void;                          // persisted: retried until the server's answered
  signOut(): Promise<{ sent: boolean }>;        // clears local story and profile only once sent, or when forced
  pendingChoice(): { local: SaveSummary; account: SaveSummary; resolve(keep: "local" | "account"): void } | null;
};
export type SaveSummary = { rank: string; lastPlayed: number | null }; // null shows as "unknown"
export function createSaveSync(deps: { store: SaveStore; api: SaveApi; now(): number; inStory(): boolean; reload(run: RunState | null): void }): SaveSync;
```

- Routes: `GET /api/story` and `PUT /api/story` with `{baseRevision, data}`, returning 409 and `current` when stale. `DELETE` is a `PUT` with `data: null`.

- [ ] **Step 1: Write failing tests** in `saves.test.ts`: first write at base 0 gets revision 1, a stale base is refused and returns `current`, a `null` write keeps the revision moving and clears data, and a stale `null` write is refused. Through the API, invalid data (fails `parseRun`) and over-size data are refused, and another account's story is unreachable.
- [ ] **Step 2: Implement `saves.ts` and the routes,** doing the revision check in one conditional `UPDATE`, so two writers can't both win. Expected: PASS.
- [ ] **Step 3: Write failing tests** for `decideSync`:

| Local | Meta | Remote | Expected |
|---|---|---|---|
| same data | any | same data | `nothing` |
| A | this account, base 3, clean | revision 3 | `nothing` |
| A | this account, base 3, dirty | revision 3 | `upload` |
| A | this account, base 2, clean | revision 3, data B | `download` |
| A | this account, base 2, dirty | revision 3, data B | `ask` |
| none | this account, base 2 | revision 3, data B | `download` |
| A | this account, base 2, clean | revision 3, data null | `remove-local` |
| A | no account (guest) | revision 0 | `upload` |
| A | no account (guest) | revision 3, data B | `ask` |
| none | no account | revision 3, data B | `download` |
| A | **other account** | revision 0 | `ask` |
| A | **other account** | revision 3, data B | `ask` |

- [ ] **Step 4: Write failing tests** for `createSaveSync`, with fake store and API:
  - `changed` called many times within 30s sends one upload.
  - A 409 raises `pendingChoice`, and nothing is overwritten until `resolve`.
  - An unreachable API leaves `dirty` true, loses nothing, and retries.
  - `download` with `inStory()` true becomes a choice rather than swapping the story under the player.
  - `removeStory` survives a reload of the store and sends when the API returns.
  - `signOut` with a failing API returns `sent: false` and clears nothing. Once forced, it clears the story, the profile and the meta.
- [ ] **Step 5: Implement `save-sync.ts`.** Expected: PASS.
- [ ] **Step 6: Wire `game.ts`.** Call `sync.changed` after `writeSave` at line 267 and `sync.removeStory` in the restart branch at line 372. `newGame` keeps its behavior, so the new story's first write replaces the account's. Add `pagehide` → `flushOnClose`. Development links with `?art` or `?scene` have `store = null`, so `sync` must be inert for them. Local play must never wait on a sync call.

### Task 7: Client lobby connection and live match behavior

**Files:**
- Create: `game/net/lobby-client.ts`, `game/net/lobby-client.test.ts`
- Modify: `game/net/transport.ts`, `game/net/service.ts`, `game/net/hub.ts`, `game/net/net.test.ts`, `game/scenes/online-duel.ts`, `game/core/scene.ts`, `game/game.ts:385-393,455-460`

**Interfaces:**
- Consumes: protocol types, `Link`, `SocketLike`.
- Produces:

```ts
export type LobbyState =
  | { kind: "connecting" } | { kind: "waiting"; code: string } | { kind: "joining" }
  | { kind: "opponent-here"; opponent: Identity; waitingForVisible: boolean }
  | { kind: "match"; match: FoundMatch }
  | { kind: "between"; opponent: Identity; theyWantRematch: boolean; iWantRematch: boolean }
  | { kind: "closed"; reason: LobbyClosedReason | LobbyErrorReason | "lost-connection" | "rejected"; detail?: string };
export type LobbyClient = { state(): LobbyState; rematch(): void; leave(): void; outcome(): ServerOutcome | null };
export type ServerOutcome = Extract<ServerMessage, { t: "outcome" }>;
export function createLobbyClient(options: { url: string; open?: (url: string) => SocketLike; join?: string; alert(): void; visibility: { hidden(): boolean; subscribe(cb: () => void): () => void }; setInterval: typeof setInterval; clearInterval: typeof clearInterval }): LobbyClient;
// service.ts
export type OnlineService = { readonly live: boolean; findDuel(): Search; enterTournament(): TournamentSession; lobby(join?: string): LobbyClient | null };
// FoundMatch gains:
live?: { report(report: MatchReport): void; outcome(): ServerOutcome | null };
// transport.ts: createSocketLink gains an optional onArrive(message) callback
// scene.ts: Scene gains
liveTick?(game: Game): void; // runs each tick while the menu is open or the tab's unfocused
```

- `createRemoteService` is removed. `createOnlineService` returns stand-ins plus `lobby` when `serverUrl` is set. `findDuel` is only offered when not `live`, and `enterTournament` is always stand-ins. A relative `/ws` resolves to `ws(s)://location.host/ws`.

- [ ] **Step 1: Write failing tests** in `lobby-client.test.ts`, with a fake socket:
  - It sends `hello` then `create-lobby`, or `join-lobby` when `join` is given, and reaches `waiting` with the code.
  - **With the game loop never running** (only socket events and the fake interval): `opponent-joined` calls `alert` once from the arrival callback, heartbeats keep going, and a visibility change sends `visible` immediately. This is Review Focus 1.
  - `visible` is sent as hidden if the tab's hidden when `opponent-joined` arrives, and `waitingForVisible` reflects it.
  - A socket close at any state becomes `closed` `lost-connection`, and `leave` closes the socket and stops the interval, so nothing leaks after a finished lobby.
  - `outcome` then `rematch` behave across two matches on one connection, and `match.link.close()` doesn't close the socket.
- [ ] **Step 2: Implement `lobby-client.ts`,** the `onArrive` callback and the `service.ts` changes. Replace the `// Task 7` skipped tests with stand-in-only equivalents, and delete those that only tested removed messages. Expected: `pnpm test` and `pnpm typecheck` PASS.
- [ ] **Step 3: Write failing tests** in `net.test.ts` for the result logic, extracted from `online-duel.ts` as an exported pure function `liveResult(status: LockstepStatus, winner: 0 | 1 | null, side: 0 | 1): MatchReport`: finished and won gives `won`, finished and lost gives `lost`, desynced gives `void`, and `left` gives `lost`, so a client never reports a win just because the socket said `leave`.
- [ ] **Step 4: Change `online-duel.ts`.**
  - For a live match, wait 3 seconds with an on-screen countdown before creating the lockstep.
  - Send `live.report(liveResult(...))` once on finishing. Show a "settling" line until `live.outcome()` arrives, then show what the server decided, with new copy in `content.ts` for each reason, including "you were away too long". Never call `game.online.recordResult` for a live match. If the connection is lost before an outcome, show "Connection lost. This match won't count" and record nothing locally.
  - Implement `liveTick`, which ticks the lockstep with an idle input.
  - Forfeit sends `leave` and waits for the outcome.
  - When a live match ends, `console.info` the percentage of ticks it spent waiting, for the lag target. No other logging.
  - `moveOn` goes to `online-lobby` for a live match (Task 8).
- [ ] **Step 5: Change `game.ts`.** `pauseIfAway` does nothing when `scene().liveTick` exists. In `update`, when `flow.paused` and `liveTick` exists, call `scene().liveTick(game)` alongside the menu. Add a test on the extracted flow if it's reachable without a canvas, otherwise cover it in Task 10's browser check. Story duels still pause when focus is lost: existing tests must stay green.

### Task 8: Sign-in form and multiplayer screens

**Files:**
- Create: `game/AccountOverlay.tsx`, `game/net/account-client.ts`, `game/net/account-client.test.ts`, `game/net/invite.ts`, `game/net/invite.test.ts`, `game/scenes/online-lobby.ts`, `game/scenes/online-history.ts`
- Modify: `game/core/input.ts:84-96`, `game/core/input.test.ts`, `game/GameCanvas.tsx`, `game/game.ts`, `game/core/scene.ts:12`, `game/net/auth.ts`, `game/net/hub.ts`, `game/net/profile.ts`, `game/scenes/online.ts`, `game/scenes/content.ts`

**Interfaces:**
- Consumes: `LobbyClient`, `SaveSync`, account routes.
- Produces:

```ts
// account-client.ts
export type AccountClient = {
  current(): Account | null; record(): { wins: number; losses: number } | null;
  refresh(): Promise<void>; signUp(username: string, password: string): Promise<string | null>; // the problem, or null
  signIn(username: string, password: string): Promise<string | null>; signOut(): Promise<void>;
  finishTutorial(): Promise<void>; history(): Promise<HistoryRow[]>;
};
export function createAccountClient(fetcher: typeof fetch): AccountClient;
// invite.ts
export function inviteFromUrl(search: string): string | null; // through parseLobbyCode
export function inviteLink(origin: string, code: string): string; // `${origin}/?join=${code}`
export function clearInvite(history: Pick<History, "replaceState">, location: Pick<Location, "pathname">): void;
// hub.ts: OnlineHub gains
account: AccountClient; lobby: LobbyClient | null; invite: string | null; needsAccountForm: "sign-in" | null; save: SaveSync;
// auth.ts: createAccountAuth(account, fallback) gives identity { id, name: username, dan, guest: false }
```

- Scenes: `SceneName` gains `"online-lobby" | "online-history"`. Menu when live and signed out: Sign in or create account, Tournament (practice), Tutorial, Back. Signed in and open: Create lobby, Join lobby, Match history, Tournament (practice), Tutorial again, Sign out, Back. Existing rank gate first, as now.
- Guest profile: on sign-up or sign-in, a local `tutorial: true` calls `finishTutorial`. Local wins and losses are not sent. `ONLINE_RECORD` shows the account's record when signed in.

- [ ] **Step 1: Write failing tests:**
  - `input.test.ts`: a keydown whose target is an `<input>` isn't captured or `preventDefault`ed.
  - `invite.test.ts`: `?join=abc23` gives `ABC23`, junk gives null, and `inviteLink` matches the spec's form.
  - `account-client.test.ts`: server problems come back as text, and a 401 on `refresh` means signed out rather than an error. Network failure leaves the game usable, returning a "can't reach the server" message.
- [ ] **Step 2: Implement** these, plus `createAccountAuth`. Expected: PASS.
- [ ] **Step 3: Write `AccountOverlay.tsx`.** A real `<form>` with `autocomplete="username"` and `current-password` or `new-password`, a masked field, tabs for sign in and create account, and the line that a forgotten password can only be reset by the owner. It also renders the which-to-keep choice from `save.pendingChoice()`, showing each story's rank and last-played time. It uses the game's colors. While open, `game.input.setTyping(true)` so `F` and the like stay off. It closes with Escape and returns focus to the game.
- [ ] **Step 4: Write `online-lobby.ts`.** Create shows the code large, `C: copy invite link` (through `navigator.clipboard`, with a fallback that shows the link), `X: leave`. Join takes a typed code through `game.input.typed()`, in the style of `stepNameEntry`. Each `closed` reason, including "not back in time", gets its own plain line in `content.ts`. Between matches: Rematch and Leave, showing that the other player's waiting. `outsideStory` returns true. Waiting doesn't need `liveTick`, because the socket and timers run without the loop, but `alert` must flash `document.title` and play a sound, restoring the title on focus.
- [ ] **Step 5: Write `online-history.ts`.** The last 20: opponent, result, date, with "out of step" and "disagreed" shown as "didn't count". Empty and can't-reach-server states each get a line.
- [ ] **Step 6: Wire invites and the online menu.** `game.ts` reads `inviteFromUrl` in production as well, outside the `IS_DEV` block, and calls `clearInvite`, so a refresh doesn't rejoin. With an invite, the game goes to `online` after the first key press, and `online.ts` walks it through: sign in if needed, tutorial if the gate's closed, then `online-lobby` joining that code. An expired code shows its message in the multiplayer menu. Add a pure `nextInviteStep({signedIn, open}): "sign-in" | "tutorial" | "join"`, tested for all four combinations, in `invite.test.ts`. Phones still see "needs a keyboard", so an invite opened on a phone gets the existing message.
- [ ] **Step 7: Wire sign-out:** if `save.signOut()` returns `sent: false`, warn and offer to sign out anyway. Sign-in and sign-up call `save.signedIn`.

### Task 9: Backups

**Files:**
- Create: `server/scripts/backup.ts`, `server/scripts/restore.ts`, `server/scripts/backup.test.ts`

**Interfaces:**
- Produces: `export async function dumpDb(db: Db): Promise<DbDump>` and `export async function loadDump(db: Db, dump: DbDump): Promise<void>`. `DbDump` is `{ takenAt: number; tables: Record<string, Record<string, unknown>[]> }` for all four tables.
- Scripts: `node --env-file-if-exists=.env server/scripts/backup.ts <out.json>` and `server/scripts/restore.ts <in.json> <file:scratch.db>`. `restore` refuses any target that isn't a `file:` URL, so it can't overwrite production.

- [ ] **Step 1: Write failing test:** create accounts, a session, a story and matches in one temp database, dump, load into another, and assert every table's rows are deep-equal. Then sign in on the restored database with the original password.
- [ ] **Step 2: Implement.** The backup writes to a temp name and renames it only after re-reading and parsing it, and it refuses to succeed on an empty `accounts` table unless given `--allow-empty`. Expected: PASS.

### Task 10: Local end-to-end check, and docs

**Files:**
- Modify: `docs/multiplayer.md`, `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md`, `docs/superpowers/specs/2026-11-06-accounts-multiplayer-design.md`, `README.md`

- [ ] **Step 1: Run** `pnpm test`, `pnpm typecheck`, and `pnpm build`. Expected: all pass.
- [ ] **Step 2: Run the real thing** with `NEXT_PUBLIC_TINY_KENDO_SERVER=/ws pnpm build && pnpm start`, since that variable is read at build time, in two separate browser profiles, driven through Chrome DevTools. Confirm each:
  - Sign up both, create a lobby, switch tab, join by link. The creator is alerted, and the match waits.
  - Play to the end. The same result shows in both histories.
  - Opening the pause menu mid-match doesn't stop it. A hidden tab for over 10 seconds loses it, and the screen says why.
  - Rematch works, and so does forfeit.
  - Restart the server: still signed in, record and history intact. During a live match, a restart shows "won't count" with nothing recorded.
- [ ] **Step 3: Verify the stored data directly.** Query the database file: `password_hash` is a scrypt string, `sessions` has only hashes, and `accounts` has no other personal fields. Search server logs for a test password. Expected: no match.
- [ ] **Step 4: Verify the save rules:** two browser profiles on one account. Play on A, open B with an older save: B downloads. Change both: the prompt appears. Sign out on a shared profile: the story's gone from `localStorage`.
- [ ] **Step 5: Update the docs.** `docs/multiplayer.md` is rewritten for lobbies, protocol 2, the server and scripts. In the main design doc, update "Not in this version", the Multiplayer section (including the separate guest name) and the "Playtesting" hosting line. In the new spec, record what changed during the build.

### Task 11: Deploy (with the owner)

**Files:**
- Create: `render.yaml`, `.node-version` (`24`)
- Modify: `package.json` (`"engines"`)

- [ ] **Step 1: Write `render.yaml`:** free plan, Ohio region, build command `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build`, because TypeScript and Tailwind are dev dependencies needed for the build and `next.config.ts` is loaded at runtime. Start command `pnpm start`, health check `/health`. Environment: `HOST=0.0.0.0`, `NODE_ENV=production`, `TRUST_PROXY=1`, `NEXT_PUBLIC_TINY_KENDO_SERVER=/ws`, `PUBLIC_ORIGIN`, and `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set by hand as secrets. Confirm the current region names at this step. Check the production dependency question by running a clean install and `pnpm start` in a temp copy.
- [ ] **Step 2: Ask the owner to** create the Turso database (closest region to Ohio) and the Render service, and to set the secrets. **Ask whether to commit,** and what. Confirm before the commit that `.gitignore` covers both videos and `.env`, using `git status`. Nothing is pushed without the owner's go-ahead.
- [ ] **Step 3: Verify the deployed site.** `curl -i https://<host>/health` returns 200. The sign-in cookie has `Secure; HttpOnly; SameSite=Lax`. A WebSocket from a foreign `Origin` is refused. Passwords only travel over HTTPS.
- [ ] **Step 4: Owner sets up UptimeRobot** on `/health` at 5 minutes. Confirm the service is the only free web service in that Render workspace. Check the next day that it hasn't slept.
- [ ] **Step 5: Run the spec's real-world check,** on two real devices on different networks: a full match, a rematch, a story continued on another device, all against the lag target. Each live match logs its waiting percentage to the console. Over 5%, raise `INPUT_DELAY` in `game/net/lockstep.ts:6` to 4 then 5 and redeploy. If that still feels bad, stop and ask the owner. Also have a third person sign up during a match, since password hashing shares a small server with the relay. Expected: no visible slowdown. If there is one, reduce `p` and tell the owner the trade-off.
- [ ] **Step 6: Prove the backup.** The owner runs `backup.ts` against production, then `restore.ts` into a scratch file. Compare row counts and sign in against the restored copy. Tell the owner that adding it to the daily `~/infra` backup is their choice.
