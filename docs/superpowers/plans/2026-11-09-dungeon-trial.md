# Dungeon Trial Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. No commits unless the owner asks.

**Goal:** Implement issue #10's first dungeon trial, from Raiko's secret through Ren's capture, platforming escape and ninja-spy reveal.

**Architecture:** A pure side-view model in `game/dungeon.ts` drives a dedicated scene. `game/dungeon-story.ts` manages durable story transitions and equipment escrow. Existing movement/combat art, configurable input, dialogue and save infrastructure remain the integration seams.

**Tech Stack:** Existing TypeScript, Canvas, fixed-tick scene loop and node:test; no dependencies.

**Spec:** https://github.com/Nityzt/mini-ken/issues/10 and `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md`.

## Global Constraints

- Dungeon trial first; generalized city runners, transport gates and replacing Alley Cats are deferred.
- No copying existing games' art, characters or layouts. Create original dungeon rooms and ninja designs.
- Never commit unless the owner specifically asks.
- Run `pnpm test` and `pnpm typecheck`; browser uses `127.0.0.1:3210`.
- Read local Next documentation before any Next changes; this feature should stay in game modules.

## Review Focus

- Reload, death, abandonment and escape must preserve original owned gear, selected variants, mods, durability and shinai story flags.
- Capture must be inevitable for idle and strong players without awarding ordinary Ren wins/losses or applying home knockout and money penalties.
- Mandatory crafting resources and reachable checkpoints must prevent softlocks on death/reload.
- Existing configurable controls overlap: consume interaction before movement/combat when default Space/E trigger multiple actions.
- Escrow restoration must not announce original equipment as newly acquired items or grant repeated rewards.

## Story Sequence

1. Defeat Sensei Raiko (`beaten.includes('raiko')`), then ask him about a hidden passage. This option exists only in Radish Dojo. Ren's normal defeat is not required.
2. Raiko's hint enables inspection of an actual furnishing. Discover and optionally enter the secret lair; declining leaves it available.
3. Inspect suspicious dispatches. Ren catches the player. Allow an interactive exchange, then scripted defeat/capture even if the player scores. Hidden allies/smoke make the forced outcome explicit.
4. Equipment is stolen and preserved in saved escrow. Wake in the dungeon with temporary scavenged kit, independent trial HP and checkpoint retry.
5. Traverse several original rooms with horizontal movement, gravity, grounded jumping, landings, pits, timed traps and ninja guards. Collect bamboo/materials, craft a weapon and scavenge armor with real effects. Include an optional easter egg.
6. Reveal Ren as a ninja spy through dispatches/dialogue. A winnable final encounter gates the escape; losing retries locally.
7. Escape restores the complete original loadout, grants a once-only reward and leaves a hook for the next chapter. Safe abandonment also restores gear and permits retry.

## Task 1 — Model and Original Rooms (dungeon_model worker)

**Files:** `game/dungeon.ts`, model tests; model-owned room data if split.

**Interfaces:** `DungeonState`, `DungeonProgress`, `createDungeon(room = 0, progress?)`, `stepDungeon(state, input)` and `parseDungeonState(unknown): DungeonState | null` (coordinate exact parser name).

State includes room, tick, player body/velocity/HP/grounded/invulnerability, enemies, collected pickup IDs, weapon/armor/materials, checkpoint, phase and transient events. Inputs expose left/right/jump/guard/strike/interact. Events drive pickup, crafting, checkpoint, damage, death, enemy defeat and escape feedback.

- [ ] Write movement/collision tests, then implement real vertical platforming using existing collision helpers or deterministic substeps.
- [ ] Test grounded jumping, blocked air jumps, wall/head collisions, landing, pits and bounds.
- [ ] Build original rooms with reachable mandatory paths, trap telegraphs and enemy encounters; verify actual reachable landings/routes.
- [ ] Test attack cooldowns, guarding, invulnerability, enemy defeat, scavenging/crafting requirements and actual armor/weapon effects.
- [ ] Test checkpoint retry keeps required resources obtainable, secret/pickup grants are idempotent, and final Ren is winnable.
- [ ] Validate persisted model fields against known rooms/pickups/enemies; clear transient events when loading.

## Task 2 — Dungeon Scene and Presentation (dungeon_scene worker)

**Files:** `game/scenes/dungeon.ts`, scene tests, original dungeon art/content modules as needed.

**Interface:** `createDungeonScene(nameOf: () => string): Scene`. Consume model plus story APIs below.

- [ ] Implement lair/capture story, interactive scripted encounter, wake-up, platforming rooms, checkpoint retry and final spy reveal/escape.
- [ ] On stage `caught`, run the interactive Ren ambush, then call `captureDungeon`; on active resume, use saved progress or create the model when null.
- [ ] Map existing configurable input actions and draw current binding labels. Prioritize interactions over overlapping combat/jump actions.
- [ ] Render original traps, ledges, guards, scavenged kit and readable HUD at minimum viewport; reduced motion removes shake/flashes without changing rules.
- [ ] Make capture bounded even when idle/blocking or scoring early. Do not run normal duel outcome/reward/knockout handling.
- [ ] Save model progress and checkpoint changes; final loss retries locally; final win calls `finishDungeon`.
- [ ] Forfeit calls `abandonDungeon` and returns to Radish. Expose `game.debug.dungeon` for browser verification.
- [ ] Test capture, checkpoint reload, crafting, final retry/win and input precedence with fake Game/Input.

## Task 3 — Story, Save Escrow and World Entry (story worker)

**Files:** `game/dungeon-story.ts`, story tests, `game/run-state.ts`, `game/save.ts`, `game/core/scene.ts`, `game/game.ts`, `game/scenes/rival-dojo.ts`, design document.

**Contract:** `run.dungeon = { stage, progress: DungeonState | null, escrow: DungeonEscrow | null }`, where stage is `locked | discovered | caught | active | escaped`.

Exports: `dungeonStage(run)`, `discoverDungeon(run)`, `enterDungeon(run)`, `captureDungeon(run)`, `saveDungeonProgress(run, state)`, `finishDungeon(run)`, `abandonDungeon(run)`.

`discovered` means Raiko supplied the clue and furnishing can be inspected; entering changes to `caught` for the ambush. Capture stores deep copies of gear, owned, equipped, mods, wielded, durability, look, menOn, gi, madeShinai, shinaiQuest and pretrial HP. Strip normal combat equipment while imprisoned; temporary model kit remains separate. Finish/abandon restores escrow atomically, preserving legitimate XP/reward changes. Abandon returns to discovered; finish sets escaped. Old saves default to locked.

- [ ] Test eligibility, idempotent transitions, all original gear fields restored exactly, deep-copy independence and once-only rewards.
- [ ] Validate nested state/escrow; active saves require recoverable escrow. Validate original loadout compatibility against its owned/earned gear rather than currently stripped gear.
- [ ] Resume caught/active saves in dungeon; ordinary cleared/abandoned runs resume normal world.
- [ ] Add Raiko-only topic, discoverable furnishing prompt and Enter/Leave choice; preserve existing furnishing notes/stashes.
- [ ] Register scene and SceneName; keep dungeon outside healing/ticket/travel/online paths. Add clear local objectives.
- [ ] Document controls, story, checkpoint and escrow policies in the design document.

## Task 4 — Integration and Review (root)

**Files:** `game/scenes/dungeon-flow.test.ts`, `game/items.ts` restoration announcement suppression; shared integration fixes after coordination.

- [ ] Suppress duplicate original item cards when before.dungeon.escrow is populated and after.dungeon.escrow is null.
- [ ] Ensure temporary equipment cannot overwrite original escrow or leak permanent ownership; pause inventory must reflect the stolen-equipment premise.
- [ ] Test natural Raiko trigger, other-sensei exclusion, door deferral, every resume stage, capture without normal Ren records and escape/abandon roundtrips.
- [ ] Run full `pnpm test` and `pnpm typecheck`, fixing failures and rerunning focused checks when changes require it.
- [ ] Browser-play the natural entry, ambush, every room/trap/ninja/crafting interaction, checkpoint refresh, final loss/retry/win and restored modified gear. Inspect 256x144 minimum framing and larger viewport.

## Acceptance Gate

Playable from Raiko's hint to escape; real vertical platforming, avoidable traps, combat against ninjas, useful scavenged/crafted gear, explicit Ren spy reveal and winnable final fight. Capture, death, reload and abandonment never lose original possessions, alter unrelated progression or farm rewards. Tests and typecheck pass. No general city expansion required.
