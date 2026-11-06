# Tiny Kendo multiplayer: how it works and how to run it

The design and the reasons behind it are in `docs/superpowers/specs/2026-11-06-accounts-multiplayer-design.md`.

One Node process (`server/index.ts`) serves the game, the account API at `/api/*`, and the match relay at `/ws`. Accounts, stories and match history are in Turso. Lobbies and live matches are in memory, so a restart drops them and nothing else.

## Running it

| Command | What it does |
|---|---|
| `pnpm dev` | The game alone. No server, so multiplayer is stand-ins. |
| `pnpm dev:online` | The real server in development, on `127.0.0.1:3210`, with a local database in `.local/`. |
| `pnpm build`, then `pnpm start` | Production. Build with `NEXT_PUBLIC_TINY_KENDO_SERVER=/ws`, since that's read at build time. |
| `pnpm test`, `pnpm typecheck` | Tests and types. |

Only one Next dev server can run in this folder at a time, so stop `pnpm dev` before `pnpm dev:online`.

`NODE_ENV=production` also makes the session cookie `Secure`. A plain `http://` address other than `127.0.0.1` or `localhost` won't stay signed in.

## Environment

| Variable | Meaning |
|---|---|
| `HOST` | Bind address. Defaults to `127.0.0.1`. Only the host's own environment should set `0.0.0.0`. |
| `PORT` | Defaults to 3210. |
| `PUBLIC_ORIGIN` | The site's address, exactly as browsers send it, like `https://tiny-kendo.onrender.com`. Posts and WebSockets from anywhere else are refused, so **sign-in fails until this is right**. |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | The database. Without them, development uses a local file, and production refuses to start, since a host's disk is wiped on each deploy. Secrets: never `NEXT_PUBLIC_`. |
| `ALLOW_LOCAL_DATABASE` | `1` lets production use a local file, only for testing a production build on this machine. |
| `TRUST_PROXY` | `1` behind Render, to read the visitor's address for rate limits. |
| `NEXT_PUBLIC_TINY_KENDO_SERVER` | Build time. `/ws` turns on real multiplayer. Unset means stand-ins. |

## Deploying to Render

`render.yaml` describes the service: free plan, Ohio. Render deploys from GitHub, so what's deployed is what's committed.

1. Create a Turso database in the region closest to Ohio, and get its URL and a token.
2. Create the service from `render.yaml`, and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Set `PUBLIC_ORIGIN` to the address Render gives you, and redeploy.
4. Point UptimeRobot at `/health`, every 5 minutes, so the server doesn't sleep. Keep this the only free web service in that Render workspace: staying awake uses up to 744 of the 750 free hours a month, and running out suspends every free service there until the next month.

## Owner scripts

Run these with the production database settings in `.env`.

```
node --env-file-if-exists=.env server/scripts/reset-password.ts <username>
node --env-file-if-exists=.env server/scripts/backup.ts <out.json>
node server/scripts/restore.ts <in.json> file:scratch.db
```

Players have no email, so `reset-password` is the only way back from a forgotten password. It asks for the new password without echoing it, and signs that account out everywhere.

A backup holds password hashes, so keep it private. `restore` only accepts a `file:` target and an empty database, so it can't overwrite the real one. It's how to prove a backup works: restore it, compare the counts, and sign in against the copy.

## The conversation over `/ws`

JSON over a WebSocket. `game/net/protocol.ts` is the contract. The connection needs a valid session cookie and the site's own `Origin`, and identity comes only from the session.

| When | Client sends | Server sends |
|---|---|---|
| On connecting | `hello { version }`, `visible { visible }` | `welcome { identity }` or `rejected { reason }` |
| Making a lobby | `create-lobby` | `lobby { code }` |
| Joining | `join-lobby { code }` | `lobby-error { reason }`, or `opponent-joined { opponent }` to both |
| Tab shown or hidden | `visible { visible }` | `match { seed, side, opponent }`, once both are visible |
| While waiting | `ping` | |
| During a match | `input`, `hash`, `leave` | The other player's, passed on unchanged |
| A match ends | `result { report }` | `outcome { winner, reason, wins, losses }` |
| Between matches | `rematch`, `leave-lobby` | `rematch-wanted`, `lobby-closed { reason }` |

Everything on the client that has to work in a hidden tab runs from socket events and timers, never the game loop (`game/net/lobby-client.ts`).

**Bump `PROTOCOL_VERSION` whenever two clients on different versions couldn't play each other, and that includes any change to the duel rules or their timings.** Old tabs are then asked to refresh, rather than falling out of step.

## Who won

The server decides (`server/outcome.ts`), and the table is in the design. Silence needs care: lockstep stops the player left waiting from sending too, so whoever's on the lower frame is the one who's blamed (`server/lobby.ts`). A client whose lockstep says the other player left reports nothing, and waits for the server's word.

## How matches stay in sync

Lockstep. Both players run the same pure rules (`duel/rules.ts`) on the same inputs and only ever send each other inputs, so a match costs about 60 tiny messages a second each way.

- Your input is scheduled 3 frames ahead (`INPUT_DELAY`, about 50ms), which hides ordinary lag.
- If someone's input is late, the match waits for it. Lag slows the match down for both players, and it can't make them disagree.
- Every 60 frames both send a fingerprint of the match. If they ever differ, the match doesn't count.
- Each live match logs to the browser console how much of it was spent waiting. The target is no more than 5%. Over that, raise `INPUT_DELAY` to 4 or 5, which feels slightly heavier.

The rules must stay deterministic: no `Math.random`, no clocks and nothing about a player's screen.

**Cheating.** A modified client can't change the score without the fingerprints disagreeing, but it can send perfect inputs, fake its rank through its saved story, or claim a higher frame to shift the blame for going silent. If that ever matters, the server can import `duel/rules.ts` and replay the inputs to check a result.

## Known limits, on purpose for now

- **No reconnecting.** A dropped connection loses the match. A server restart during a match records nothing.
- **A hidden tab can't keep running,** so being away from a live match for over 10 seconds loses it.
- **Everyone looks like a dojo.** Your opponent wears a dojo's colors chosen from the match seed. Sending real looks needs one more field on `Identity`.
- **Tournaments are practice,** against stand-ins.
- **Rate limits are per server process, in memory,** so they reset on a restart.
