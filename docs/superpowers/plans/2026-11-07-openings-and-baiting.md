# Openings and Baiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every ordinary duel strike needs a visible, cancellable opening, ki decides when you can rest, and a 2-minute clock ends matches, for the story and online.

**Architecture:** All rules stay in the pure `step` in `game/duel/rules.ts`, so lockstep carries them with one more input field. Bots produce the same inputs through a plan in `rival.ts`. Scenes only read the new state.

**Tech Stack:** TypeScript on Node 24's test runner, Canvas 2D, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-07-openings-and-baiting-design.md`

## Global Constraints

- Never commit or push unless the owner asks. So this plan has no commit steps.
- Don't touch `ceremonyAt`, `closingAt`, `BOW_TICKS`, `CLOSING_TICKS`: another agent is working on the sonkyo and the pre and post-fight animations.
- Every number lives in `game/duel/constants.ts`.
- Rules stay deterministic, with no clock or `Math.random` in them.

## Decisions the spec leaves to the builder

- **`DuelOptions.direct: [boolean, boolean]`**: this fighter's strikes need no opening, use `windups` and expose by the old table. Lesson partners use it, so a drill's slow tell and its lines stay true. Tests of mechanics unrelated to openings use it too, through `directDuel` in `game/duel/test-support.ts`, so their promises don't need rewriting.
- **`windups` applies only to direct strikes and hiki.** A strike from an opening uses `ATTACKS[attack].windup`. A rival's planned hold is `max(OPENING_MIN, tell - windup + OPENING_MIN)`.
- **`STOMP_WINDOW` goes to 28,** because the stomp may now come with W+J together.
- **Queueing:** an input with both `opening` and `attack` from guard enters the opening and queues the strike. Tests and bots use this too.

## Review Focus

- Holding W, Q or E while something else happens (stunned, in a lock, in zanshin): the opening starts only once you can act, and a key still held then opens.
- Releasing the opening key with a strike queued: the strike still fires. S cancels it.
- Running out of ki in an opening or block, including at the moment a strike is queued.
- The clock running out during a windup, a lock or a zanshin: nothing in flight is lost, and the result is right.
- Both sides of an online match after a crossing: keys mirror, and hashes agree through openings, cancels and counter-parries.

---

### Task 1: Openings, ki drain and the rule changes

**Files:** Modify `game/duel/constants.ts`, `game/duel/rules.ts`, `game/net/protocol.ts`. Create `game/duel/openings.test.ts`, `game/duel/test-support.ts`. Modify existing test imports.

**Produces:** `type Opening = "raise" | "wrist" | "drop"`; `FighterInput.opening?: Opening | null`; `Fighter.opening`, `openingTicks`, `queued`; `Stance` gains `"opening"`; `openingTarget(opening, kamae): Target`; `DuelOptions.direct`, `steadyGuard`.

- [ ] Write `openings.test.ts`: a strike with no opening does nothing; any opening leads to any strike; only the opening's target is exposed; a strike can't start before `OPENING_MIN` and a queued one fires even after release; S, I and release all cancel; walking and dashing work in an opening; block and opening drain ki; guard is the only place ki recharges; a block at 0 breaks, an opening at 0 drops to guard; opening needs 10 ki; `steadyGuard` doesn't drain.
- [ ] Run `node --test game/duel/openings.test.ts` and see it fail.
- [ ] Implement in `rules.ts`. Constants: `OPENING_MIN` 10, `OPENING_START_KI` 10, `OPENING_DRAIN` 0.15, `BLOCK_DRAIN` 0.1, `RECOVERY_TICKS` 36, `STOMP_WINDOW` 28.
- [ ] Add two opening bits to `encodeInput`/`decodeInput`, and set `PROTOCOL_VERSION` to 3.
- [ ] Point the existing mechanics tests at `directDuel`, then run `pnpm test` and triage what's left into the tasks below.

### Task 2: Counter-parry, close parries and the seme standoff

**Files:** Modify `game/duel/rules.ts`, `game/duel/constants.ts`, `game/duel/parry.test.ts`, `game/duel/rules.test.ts`.

**Produces:** `Fighter.countering`, `Fighter.reparryTicks`, `Fighter.reparryUsed`. Constants `REPARRY_WINDOW` 4, `REPARRY_MISS` 14, `PARRY_LOCK_WITHIN` 22, `REPARRY_LOCK_WITHIN` 32, `COUNTER_DRIVE_TICKS` 2.

- [ ] Write tests: a counter can be parried only in its last 4 ticks; one try per deflection; a miss adds 14 ticks; a second parry gives no counter or ki, and both return to guard from far off; it locks at 32 or closer; a first parry locks at 22 or closer; a non-counter strike can't be re-parried; a counter drives forward about 8; both holding seme build nothing, and a kiai adds nothing; bars hold their value.
- [ ] Run and see them fail, then implement, then run them to pass.

### Task 3: The match clock

**Files:** Modify `game/duel/rules.ts`, `game/duel/constants.ts`. Create `game/duel/clock.test.ts`.

**Produces:** `DuelState.clock: number | null`, `firstPoint`, `encho`; `DuelOptions.noClock`; events `"time"` and `"encho"`. Constant `MATCH_TICKS` 4800.

- [ ] Write tests: it counts only in `fight`, including a lock; 1-0 wins on time; 1-1 goes to whoever scored first; 0-0 goes to encho, which resets to the lines and ends on the next point; a strike in flight lands first; a zanshin in flight finishes first; `noClock` never ends.
- [ ] Run and see them fail, then implement, then run them to pass.

### Task 4: Bots

**Files:** Modify `game/duel/rival.ts`, `game/duel/rival.test.ts`, `game/duel/pace.test.ts`, `game/net/stand-in.ts`.

**Produces:** `RivalConfig.bait`, `bites`, `openingMix`; `RivalState.plan`.

- [ ] Write tests: a planned strike shows an opening for its full hold before it starts; an easier rival holds longer; punishes and meets use the minimum; a bait cancels and parries if bitten; bait never replaces every attack; senpai and rigged never bait; rigged guards don't drain; jodan and nito only show what their stance can.
- [ ] Run and see them fail, then implement, then re-tune so that the existing promises in `rival.test.ts` and `pace.test.ts` hold, with the simulated player opening first.

### Task 5: Player-versus-player balance

**Files:** Create `game/duel/balance.test.ts`.

- [ ] Write the seven scripted styles and every check in the spec's balance section, plus both owner exchanges as exact-input tests, and report the runner-with-a-lead figure.
- [ ] Run it and tune constants until it holds. Any number that has to move from the spec gets written back to the spec.

### Task 6: Controls, poses, HUD, tips and scenes

**Files:** Modify `game/core/input.ts`, `game/scenes/duel.ts`, `game/scenes/online-duel.ts`, `game/duel/poses.ts` (only `poseFor`), `game/art/duel-sprites.ts`, `game/duel/hud.ts`, `game/duel/tips.ts`, `game/scenes/teaching.ts`, `game/scenes/training.ts`.

- [ ] Write tests: W, Q and E hold openings and the latest pressed wins; a held strike key buffers; `poseFor` shows each opening; the prompt names the opening's target; the status label shows it; the clock's HUD text is right.
- [ ] Run and see them fail, then implement, including the hint for a strike with no opening, and the time and encho calls.

### Task 7: Teaching and online gating

**Files:** Modify `game/scenes/curriculum.ts`, `game/scenes/content.ts`, `game/scenes/training.ts`, `game/scenes/online.ts`, `game/scenes/teach-card.test.ts`, `game/scenes/curriculum.test.ts`.

- [ ] Write tests: Sensei's first round starts with an opening lesson; the short tutorial has opening and seme steps; the seme step doesn't set `run.seme`; a story player without seme or openings gets a decline-able offer before online; an existing save sees the opening card once.
- [ ] Run and see them fail, then implement.

### Task 8: Finish

**Files:** Modify `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md`, `docs/multiplayer.md`, the openings spec.

- [ ] Update the docs to match what was built.
- [ ] Run `pnpm test` and `pnpm typecheck`, and expect zero failures.
- [ ] Drive a real duel on `127.0.0.1:3210` with real keys, and check the openings, a strike, a cancel, the clock and the console.
