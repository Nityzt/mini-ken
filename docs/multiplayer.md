# Tiny Kendo multiplayer: what's ready, and what hosting has to add

The client side is finished and tested. With no server configured, the game plays stand-ins over the same connection code a real match uses. Everything below is what you need to plug in hosting and sign-in.

## Turning it on

Set one environment variable at build time, and the game talks to your server instead of stand-ins:

```
NEXT_PUBLIC_TINY_KENDO_SERVER=wss://your-host/tiny-kendo
```

While developing on this machine, bind the server to `127.0.0.1`, as with every other service here, and use `ws://127.0.0.1:<port>`.

## Sign-in

`game/net/auth.ts` defines the only thing the game needs:

```ts
type AuthProvider = {
  identity(): Identity;    // { id, name, dan, guest }
  token(): string | null;  // proof for your server. Guests send null
};
```

Today everyone's a guest, made in `createGuestAuth`. To add accounts, write another `AuthProvider` and pass it as the `auth` option to `createOnlineHub` in `game/game.ts`. Nothing else changes. The sign-in screen itself would be a new page in `scenes/online.ts`.

**The client's rank can't be trusted.** `dan` comes from the player's own browser. Once accounts exist, the server should keep the real rank, and only let someone in at 1st dan or above. The 1st-dan gate in the game is a courtesy.

## The conversation with the server

JSON over a WebSocket. The types are in `game/net/protocol.ts`, and that file is the contract.

| When | Client sends | Server sends |
|---|---|---|
| On connecting | `hello { version, token, identity }` | `welcome { identity }` or `rejected { reason }` |
| To play | `queue { mode: "duel" or "tournament" }` | `queued { mode }` |
| Giving up | `cancel` | |
| Paired | | `match { seed, side, opponent }` |
| During a match | `input`, `hash`, `leave` | The other player's `input`, `hash`, `leave`, passed on as they are |
| In a tournament | `result { won }` after each match | `bracket { bracket }` whenever it changes, then `match` for the next round |

Reject anyone whose `version` isn't `PROTOCOL_VERSION`.

**During a match, the server's whole job is to pass messages along.** It never has to run the game. The test "a full match runs over that relay" in `net/net.test.ts` is a working example of that relay in about ten lines.

A dropped connection should reach the other player as `leave`, or by closing their socket. Either counts as them walking away.

## How matches stay in sync

Lockstep. Both players run the same pure rules (`duel/rules.ts`) on the same inputs and only ever send each other inputs, so a match costs about 60 tiny messages a second each way.

- Your input is scheduled 3 frames ahead (`INPUT_DELAY`, about 50ms), which hides ordinary lag.
- If someone's input is late, the match waits for it. Lag slows the match down for both players, and it can't make them disagree.
- Every 60 frames both send a fingerprint of the match. If they ever differ, the match ends as "out of step" and doesn't count.
- Ten seconds of silence (`STALL_LIMIT`) counts as the other player leaving.

The rules must stay deterministic: no `Math.random`, no clocks and nothing about a player's screen. There's a test that plays random input over a laggy connection, checking both copies stay identical.

**Cheating.** A modified client can't change the score without the fingerprints disagreeing, but it can still send perfect inputs. If that ever matters, the server can import `duel/rules.ts` and replay the inputs to check a result. That's also how it should confirm tournament `result` messages, which are currently taken on trust.

## Known limits, on purpose for now

- **Pausing stalls a real match.** The pause menu stops your game, so your opponent waits, up to the ten-second limit. Before going live, decide whether pausing should be turned off in a live match. It's also why losing focus on the tab counts as pausing.
- **Lockstep feels the lag.** Past about 50ms each way, the match slows down rather than stutters. Rollback netcode would feel better on bad connections, and it could replace `net/lockstep.ts` without touching anything else, because the rules are already pure.
- **No rematch button.** Finishing a duel goes back to the lobby.
- **Everyone looks like a dojo.** Your opponent wears a dojo's colors chosen from the match seed. Sending real looks needs one more field on `Identity`.
- **No names to choose.** Guests are `Guest 1234` until there are accounts.
- **Bracket results.** The bracket screen trusts what the server sends. Stand-in tournaments decide everyone else's matches with a coin toss.
- **Betting on other people's matches** isn't built yet. It needs a server to hold the money.
