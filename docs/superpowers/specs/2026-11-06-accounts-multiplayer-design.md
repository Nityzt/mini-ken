# Tiny Kendo: accounts, lobbies and hosting

Status: approved by the owner, 2026-11-06. Uncommitted, because this project only commits when the owner asks.

Labels: **(owner)** means the owner decided it. **(my call)** means it was Claude's suggestion, which the owner approved as part of the whole design and can still overrule.

## Why

The client can already play real matches, but nothing is running behind it, so everyone online plays stand-ins. The owner wants real people to play each other, starting with people around one city or region, at no hosting cost. An account should be as small as possible and should let someone keep their progress.

## Goals

- **Accounts (owner):** a unique username and a password. No other personal information.
- **What an account keeps (owner):** story progress if they play the story, and win/loss record and match history if they play multiplayer. Someone who only plays multiplayer has no story data.
- **Finding a match (owner):** lobby codes or invite links.
- **On the web, for free (owner):** the game and multiplayer are publicly reachable, with no monthly bill.

## Not in this version

- Email, password reset by the player, social sign-in. (Owner: username and password only.)
- Random matchmaking. (My call: the owner said lobbies "for now".)
- Real online tournaments. The tournament option keeps playing stand-ins, is labeled practice, and doesn't touch the account record. (My call.)
- Leaderboards, friend lists, chat, spectating, betting on other people's matches, sending real character looks, rollback netcode, replay-checking results on the server. (My call.)

## What would make this a failure, even if it works

- A player silently loses story progress.
- Passwords can be read by anyone with the database, or by anyone on the same wifi.
- A published port or a stored field goes beyond what's listed here.
- The bill stops being zero without the owner choosing that.

## Hosting (my call, from the owner's answers: free, players in one city or region)

- **One Node process on Render's free web service** serves the game, the account API and the match relay from one address. The address is `*.onrender.com` to begin with. A custom domain is optional and later.
- **Turso's free database** holds accounts, saves and match history. Render's own free Postgres can't be used, because it expires after 30 days and is then deleted. Render's free services also have no permanent disk.
- **Lobbies and live matches are in memory only.** A restart drops them, and nothing else is lost. The database is never touched during play, so its distance can't add lag.
- **Region:** the Render region closest to the players, and the Turso region closest to that. Players are around Toronto (owner), which suggests Render's Ohio region. The available regions get checked at setup. Vercel isn't used, for the reasons the owner was given: its WebSockets are in beta, close at a time limit, and may put two players on different instances.

Known consequences of the free tier, accepted for now:

- After 15 minutes without traffic the server sleeps, and the next visitor would wait about a minute. **The owner will keep it awake with UptimeRobot (owner).** It pings a `/health` path at an interval under 15 minutes. `/health` answers without touching the database, so pings don't use up Turso's allowance or wake anything else.
- Render includes 750 instance hours a month per workspace. Staying awake uses up to 744 of them, so this must stay the only free web service in that Render workspace. Running out suspends all of the workspace's free services until the next month.
- A ping keeps it awake but doesn't guarantee it's never down. Deploys and restarts still drop lobbies and live matches, as described above.
- If the wait becomes annoying, the same code moves to a small paid host (about $5/month, price to be confirmed then). This is why the design avoids anything tied to Render.

### Server shape

- A custom Next.js server (`node_modules/next/dist/docs/01-app/02-guides/custom-server.md`), so one process serves the page and accepts the WebSocket upgrade on one path, `/ws`. Other upgrades go to Next, so hot reload keeps working.
- The guide says a custom server can't be combined with `output: "standalone"`, so production runs the custom server after `next build`.
- `pnpm dev` keeps working on `127.0.0.1:3210`. The bind address defaults to `127.0.0.1` and only becomes `0.0.0.0` through an environment variable set on Render.
- With no server configured, the game keeps playing stand-ins as it does today.
- Secrets (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) live only in Render's environment and a git-ignored local `.env`. They're never exposed through `NEXT_PUBLIC_`.
- Without Turso credentials locally, the server uses a local SQLite file through the same client. (Builder to confirm the client supports this.)

## Accounts

- **Username (owner: unique; rules are my call):** 3–12 characters, letters, digits, `_` and `-`, because the HUD and font have limited room. Uniqueness ignores case, and the chosen capitalization is what's displayed. `guest` and `player` are reserved, including `guest` followed by digits.
- **Password (my call):** at least 8 characters, at most 128. Hashed with `scrypt` from `node:crypto` with a random salt per account. It's never logged.
- **Sessions (my call):** a random token in a cookie that's `HttpOnly`, `SameSite=Lax`, and `Secure` in production. The database stores only a hash of the token. Sessions last 30 days. Signing out deletes that session.
- **Abuse protection (my call):** failed sign-ins and sign-ups are rate-limited in memory, per IP and per username. Render's forwarded-address header is read for the IP. Sign-in errors don't say which of the two fields was wrong. POSTs and the WebSocket upgrade check `Origin`, so another website can't act as a signed-in player.
- **Forgotten passwords (my call, a consequence of the owner's no-email rule):** players can't reset their own. An owner-run script sets a new password for a username. Players are told this when they sign up.
- **Sign-in screen (my call):** a small HTML form over the canvas, styled to match, rather than typed on the canvas. Password managers and pasting work, and the input is a real masked password field.
- **Without an account (my call):** the story plays as a guest, exactly as today. Creating a lobby or joining one needs an account, so there's somewhere to keep the record. The existing guest profile's tutorial flag carries over at sign-up. Its wins and losses don't, because they were against stand-ins.
- **Access (my call, keeping the existing design):** multiplayer still needs 1st dan or the short tutorial. Someone arriving by invite link signs in, takes the tutorial if they haven't, and then joins. The tutorial flag lives on the account.

### Data stored

```
accounts      id, username, username_key (unique), password_hash, tutorial, created_at
sessions      token_hash, account_id, expires_at
story_saves   account_id, revision, data, updated_at
matches       id, player_a, player_b, winner (or null if void), reason, played_at
```

`story_saves.data` becomes empty when a story's removed, and the row stays, so its revision keeps stale devices from bringing the story back. Wins and losses are worked out from `matches`, so they can't drift apart. Match history shows the last 20 matches: opponent, result and date, on a new page off the multiplayer menu.

## Story saves (my call on all of this)

- The browser's save stays as it is, so the game still works offline or if the server's asleep. When signed in, the same save data is also sent to the server, at most every 30 seconds, on scene changes, and when the page closes.
- The server checks it with `parseRun` from `game/save.ts`, and rejects anything over a size limit, set by the builder from a real late-game save.
- **Signing up with a save in this browser** uploads it.
- **Signing in when both this browser and the account have a story** asks which to keep, showing each one's rank and last-played time. It never overwrites either without asking. The local save has no timestamp today, so one gets added, and an older save without one shows as "unknown".
- **Every page load while signed in** compares too, because sessions last 30 days and the sign-in prompt alone would rarely appear. The browser remembers the account revision its save is based on, alongside a flag for unsent changes.
  - Same revision: nothing to ask. Unsent local changes upload.
  - Account is newer and this browser has no unsent changes: the newer story downloads without asking.
  - Both have changed: the same which-to-keep prompt.
  - No local save but the account has one (a new device): it downloads.
- **Stale writes are refused.** Each upload names the revision it's based on, and the server rejects it if the account has moved on. The browser then shows the which-to-keep prompt. Nothing is overwritten by "last write wins".
- **If the server's asleep or unreachable,** Continue doesn't wait for it. The game loads the local save, marks it unsent, and these same rules run when the server answers. Never block play on the server.
- **New game** on an account asks as it does today, and replaces the account's story once the new one is actually started.
- **Restarting from the pause menu** asks as it does today. Once confirmed while signed in, it also removes the account's story, so the old one doesn't come back as a "new device" download. If the server can't be reached, the removal waits and is sent later.
- **Signing out** sends any pending save first, then removes the story and profile from this browser, so the next person on a shared computer doesn't get them. If the save can't be sent, sign-out warns first.

## Lobbies

- **Creating:** Multiplayer > Create lobby gives a code and an invite link. (Owner: codes or links. My call: both, since it's the same thing.) The code is 5 characters from an alphabet without look-alikes (no `0`, `O`, `1`, `I`, `L`). The link is `/?join=CODE`, with a Copy button.
- **Joining:** Multiplayer > Join lobby takes a code, or the link does it directly. Wrong, expired and full codes each get a plain message. Joining your own lobby is refused.
- **Waiting away from the tab:** the usual way to invite someone is to copy the link and switch to a chat app, so a waiting lobby must not pause when the tab loses focus. It keeps its connection, and the server sees the join even with the tab hidden. When someone joins, the game plays a sound and flashes the tab title.
- **Starting:** the server picks the seed and which side each player is on. The match starts once both players' tabs report being visible, with a short on-screen countdown. Nobody has a ready button to miss, and nobody loses a match they never saw start. If a player hasn't come back after 2 minutes, the lobby closes and nothing is recorded.
- **Expiry:** an empty lobby closes after 10 minutes, or when its creator leaves. While waiting, the client sends a heartbeat so no proxy closes the connection.
- **Rematch (my call, easy to cut):** the lobby stays open after a match, and a new match starts once both players choose Rematch. Otherwise friends would swap a new code after every match. Either player leaving ends the lobby.

## Protocol changes

`game/net/protocol.ts` remains the contract, and `PROTOCOL_VERSION` becomes 2. A mismatch is refused with a "please refresh" message.

- The server takes identity from the session cookie and ignores whatever `identity` the client sends. No session means `rejected`.
- `dan` comes from the account's stored story, or 1 if there isn't one. A modified client could still fake its story save, so this isn't secure. That's acceptable between people in one region for now. (My call.)
- `queue` and `queued` are replaced for duels by client messages to create and join a lobby and to report tab visibility, and server messages for lobby-created, opponent-joined, opponent-left-lobby and match outcome. Exact shapes are the builder's. `input`, `hash` and `leave` are unchanged, and the server still only passes them along.
- Limits: messages over a small size, or sent faster than a real match could produce, end that connection.

## Who won (my call)

The server decides what's recorded, and the result screen shows what it says. Today each client decides for itself, and the two can both claim a win if one has been away and returns.

| What happens | Recorded |
|---|---|
| Both report the same winner | That winner |
| Both report, and disagree | Void, not counted |
| Either client reports out of step | Void, not counted |
| A player's connection closes or they forfeit during a match | That player loses |
| The server gets no input from a player for 10 seconds | That player loses, matching `STALL_LIMIT` |
| One reports a finished match and the other disconnects before reporting | The one report stands |
| One reports, and the other stays connected but never reports within 15 seconds | Void, not counted, so refusing to report can't win a match |
| Both players go silent | Void, not counted |

A dropped connection counts as a loss, since there's no reconnecting in this version. Losses on bad wifi are accepted for now. A server restart during a match records nothing.

Local `recordResult` no longer applies to live matches.

## Pausing in a live match (my call)

`docs/multiplayer.md` says this must be decided before going live. The pause key still opens the menu, because that's where Forfeit is, but the match keeps running behind it with no input from you. Clicking away from the tab no longer pauses a live match. A hidden browser tab can't be kept running, so being away for more than 10 seconds loses the match. The result screen says why.

## Lag target (my call)

Lockstep hides 3 frames, about 50ms (`INPUT_DELAY`). A move has to get from one player to the server and on to the other inside that, or the match slows for both.

- **Test on the deployed game (owner).** There's no separate test service. The lag check happens on the real site, from two real devices on different networks.
- **Pass:** the match spends no more than 5% of its ticks waiting on the other player, and a full match shows no visible slowdown. Each live match logs that number to the browser console when it ends.
- **If it misses:** raise `INPUT_DELAY` to 4 or 5 frames (about 67–83ms), which is free but makes the controls feel slightly heavier. If that still feels bad, stop and ask the owner. Moving to a paid host is only ever the owner's decision.

## Known fix needed in existing code

`createRemoteService` opens a socket per search and a finished duel doesn't close it, because `matchLink.close()` does nothing. Lobbies need a defined owner for that connection's lifetime, or sockets will leak.

## Deployment (for the owner)

1. Create free Render and Turso accounts. These are the owner's accounts, and Claude won't create them.
2. Commit the current work. Render deploys from the GitHub repo, and much of the game is uncommitted. Commits only happen when the owner asks.
3. Add `Kendo Kirikaeshi*.mp4` to `.gitignore` first. It isn't ignored today, so it could be committed by accident.
4. Create the database, set the environment variables, and deploy.

## Backups (my call)

Free plans can change, and accounts are the one thing that can't be recreated. An owner-run script dumps the database to a file on the owner's machine. It has to be proven by restoring a dump into a scratch database and comparing it. Adding it to the owner's existing daily backup in `~/infra` is the owner's choice and isn't part of this project.

## How we'll know it works

- `pnpm test` and `pnpm typecheck` pass, with new tests covering usernames, password checks, sessions, lobby rules, every row of the "Who won" table, and the save-conflict choice.
- Locally, in two separate browser profiles: sign up, create a lobby, join by link, play to the end, and see the same recorded result in both histories.
- After restarting the server: still signed in, and record and history intact.
- A password hash is confirmed in the actual database row, and no plain password appears in it or in the logs.
- On the deployed site, from two real devices on different networks: a full match, a rematch, and a wake from sleep, meeting the lag target above.
- Creating a lobby, switching to another tab and having a friend join by link: the creator is alerted, and the match waits for them.
- A story played on one device continues on another that already has an older save, with no progress lost. Changes made on both produce the prompt.

## What changed while building

- **Silence blames whoever's behind in frames,** because lockstep makes the waiting player stop sending too. Equal frames don't count for anyone.
- **A client whose lockstep says the other player left reports nothing.** It waits for the server's outcome.
- **The lobby screen can't be paused** (Escape does nothing, X leaves), because a paused lobby would miss the match starting.
- **A lobby idle between matches closes after 10 minutes,** since heartbeats would otherwise keep it, and the server, awake forever.
- **An invite goes straight to the multiplayer screen on load.**
- **A second connection only replaces the first once it does something.** Opening your own invite link in another tab gets told it's your own lobby, and the lobby's untouched.
- **"Looking at the game" means the window has focus, and each player only has to have looked once since the match was about to start.** Hidden alone missed a window covered by a chat app, and needing both at one instant would make two windows on one computer impossible.
- **Production refuses to start without a real database,** since a host's disk is wiped on each deploy.
- **Signing out with no connection finishes here,** and the next load ends the session on the server before doing anything else.
- **A lost connection says to check Match history,** because a one-sided drop records a loss while a server restart records nothing.

- **Accounts are for the whole game, not just multiplayer (owner).** Signed out, the title offers signing in first, and everything else as a guest. Starting or continuing a story as a guest warns once a session that progress may be lost after this session, with signing in offered right there. The story menu has "Sign in to save progress", which keeps the story that's under way.
- **Multiplayer is always offered from the story menu (owner),** wherever leaving the story can actually happen. Being below 1st dan leads to the tutorial rather than hiding the option.
- **The story waits while an account form is open.** A live match doesn't.
- **Rate limits read the address Cloudflare sets** (`cf-connecting-ip`), because the host only adds to `X-Forwarded-For`, so a visitor can fake the front of it. The server logs which header it used, once.

## Documents to keep true

Update `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md` (its "Not in this version" list and Multiplayer section, including the separate guest name) and `docs/multiplayer.md`.

## Left to the builder

Library choices (WebSocket server, Turso client), exact message shapes, file layout under a new `server/` folder, screen layouts and wording in the game's existing style, the save size limit, and the rate-limit numbers.
