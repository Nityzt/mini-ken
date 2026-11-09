> **Historical.** Written while the game lived inside the club's website repo. `components/game/` is now `game/`, and `/game` is now `/`. The design doc is the current source of truth.

# Tiny Kendo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an unlisted, keyboard-played pixel kendo game at `/game`: club, road, rival dojo, duel, win, in about 5 minutes.

**Architecture:** A client-only canvas game lazy-loaded from a noindex page. A small core (fixed-step loop, input, scenes, collision) runs code-drawn art at 320×180. Duel rules and the rival's AI are pure TypeScript with no browser code, so they can be simulated in tests.

**Tech Stack:** Next.js 16.2.7, React 19, TypeScript, Canvas 2D, Web Audio, `node --test` (Node 24.18). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md`

> **Superseded in part on 2026-11-05.** The owner replaced the gear hunt, training lessons and road (Tasks 6 to 8) with a first-day story, combo drills, fumikomi and zanshin. The spec holds the current design. This plan is kept as a record.

## Global Constraints

- **No commits.** The owner commits. Finish each task with the changes uncommitted and report what changed.
- **Stop at each OWNER CHECKPOINT** (Tasks 2, 5 and 9). Wait for the owner's feedback, because fun and cuteness can't be verified by a tool.
- **No new dependencies.** Only `package.json` (test script) and `tsconfig.json` (`allowImportingTsExtensions`) change among existing files.
- **Do not touch** `Nav.tsx`, `sitemap.ts`, `SmoothScroll.tsx`, `section-scroll-stops.ts`, or any file already showing as modified in `git status`.
- **Links between `/game` and `/` are plain `<a href>`, never `next/link`.**
- **Game art is code only.** Sprites are text grids and the font is code-drawn. The one image is the existing `public/media/yu-kendo-pixel64.png` in the sticky logo.
- **Fictional world:** no real people or clubs. Names used: Pinecone Dojo, Thunder Radish Dojo, Senpai Momo, Ren (the rival).
- **Not an advert:** the only club mentions are the sticky logo and one quiet line on the win screen.
- **Canvas:** 320×180 internal, 60 ticks per second, palette of about 16 colors around `#E8192C`, `#1A1A1A`, `#FAF7F2`.
- **Relative imports use the `.ts` extension, and no TypeScript `enum`,** so Node can run the pure modules directly. No module may touch `window` or `document` at import time, so tests can import any of them.
- **Dev server:** `npx next dev --hostname 127.0.0.1 --port 3210`. Port 3200 belongs to the owner's `Kendo-web-3d` server, so leave that running.
- **Next.js:** read `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` before writing the page (`AGENTS.md` requires reading the docs first).

## Review Focus

- A key held while the window loses focus must not stay stuck. Keys clear and the game pauses (Task 1 test, pause behavior in Task 10).
- Browser shortcuts (Ctrl+R, Cmd+L) must keep working, and Enter on the focused sticky logo must follow the link. The game only captures unmodified keys aimed at the page (Task 1 test).
- Returning from a backgrounded tab must not fast-forward the game, because a duel could be lost while away (Task 1 test).
- Small, resized or zoomed windows must still fit the whole canvas with crisp pixels and no scrolling (Task 1 test).
- Many rematches in a row must not leak state: score 0–0, full ki, tsuba kept, and easing capped (Task 4 test).

---

## File Structure

```
app/game/page.tsx               server page: metadata, renders GameEntry
components/game/
  GameEntry.tsx                 client: phone gate, sticky logo, lazy-loads GameCanvas
  GameCanvas.tsx                client: mounts canvas, starts the game, win-screen links
  game.ts                       createGame(): wires loop, input, scenes, shared state
  run-state.ts                  gear, training, tsuba, losses (pure)
  core/  loop.ts input.ts scale.ts scene.ts collision.ts audio.ts
  art/   palette.ts sprite.ts font.ts kendoka.ts duel-sprites.ts tiles.ts
  duel/  constants.ts rules.ts rival.ts tips.ts
  scenes/ art-sheet.ts title.ts topdown.ts dialogue.ts club.ts training.ts
          road.ts road-physics.ts rival-dojo.ts duel.ts win.ts content.ts levels.ts
```

Tests sit next to their module as `*.test.ts`.

---

### Task 1: Page, phone gate, sticky logo and game shell

**Files:**
- Create: `app/game/page.tsx`, `components/game/GameEntry.tsx`, `components/game/GameCanvas.tsx`, `components/game/game.ts`, `components/game/core/{loop,input,scale,scene}.ts` and tests for loop, input and scale
- Modify: `package.json` (add `"test": "node --test \"components/game/**/*.test.ts\""`), `tsconfig.json` (add `"allowImportingTsExtensions": true`)

**Interfaces:**
- Produces:
  - `ticksToRun(accumulatorMs: number, elapsedMs: number): { ticks: number; accumulatorMs: number }`, with at most 5 ticks per frame
  - `createLoop(update: () => void, render: () => void): { start(): void; stop(): void }`
  - `type Action = 'left'|'right'|'up'|'down'|'men'|'kote'|'do'|'jump'|'confirm'|'pause'|'mute'`
  - `createInput(target: EventTarget): Input` where `Input = { isDown(a: Action): boolean; wasPressed(a: Action): boolean; endTick(): void; clear(): void; dispose(): void }`
  - `shouldCaptureKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; targetTag: string | null }): boolean`
  - `canvasCssSize(viewW: number, viewH: number, dpr: number): { width: number; height: number }`
  - `type Scene = { update(game: Game): void; render(ctx: CanvasRenderingContext2D, game: Game): void; enter?(game: Game): void }`
  - `type SceneName = 'art'|'title'|'club'|'training'|'road'|'rival-dojo'|'duel'|'win'`
  - `createGame(canvas: HTMLCanvasElement, options: { onOverlay(o: 'win' | null): void }): { start(): void; dispose(): void }` where `Game` exposes `input`, `go(sceneName: SceneName, params?)` and `reducedMotion`. Task 5 adds `run: RunState`

**Key map:** arrows and WASD move (S and Down also block in duels). J men, K kote, L do. Space or W or Up jump on the road. E, Enter or Space confirm. Esc pause. M mute.

- [ ] **Step 1: Baseline the build.** Run `npm run build` and record the result. If it already fails from the owner's uncommitted work, tell the owner before continuing, so later failures aren't blamed on the game.

- [ ] **Step 2: Write failing tests**

```ts
// loop.test.ts
test('runs one tick per 16.67ms', () => assert.equal(ticksToRun(0, 1000 / 60 + 0.01).ticks, 1));
test('a long gap never fast-forwards', () => {
  const r = ticksToRun(0, 60_000);
  assert.equal(r.ticks, 5); assert.equal(r.accumulatorMs, 0);
});

// input.test.ts (use a plain EventTarget and dispatch Event objects carrying key)
test('blur clears held keys');                 // keydown 'j', dispatch blur, isDown('men') === false
test('wasPressed is true for one tick only');  // true before endTick(), false after
test('ignores key repeat for wasPressed');     // e.repeat === true does not re-trigger
test('shortcuts are not captured', () => {
  assert.equal(shouldCaptureKey({ key: 'r', ctrlKey: true, metaKey: false, altKey: false, targetTag: null }), false);
  assert.equal(shouldCaptureKey({ key: 'l', ctrlKey: false, metaKey: true, altKey: false, targetTag: null }), false);
});
test('keys on a focused link or button are not captured', () => {
  assert.equal(shouldCaptureKey({ key: 'Enter', ctrlKey: false, metaKey: false, altKey: false, targetTag: 'A' }), false);
  assert.equal(shouldCaptureKey({ key: ' ', ctrlKey: false, metaKey: false, altKey: false, targetTag: 'BUTTON' }), false);
});
test('Tab is never captured');
test('game keys on the page are captured');    // 'j' with targetTag 'BODY' -> true

// scale.test.ts
test('1280x720 at dpr 1 is exactly 4x', () => assert.deepEqual(canvasCssSize(1280, 720, 1), { width: 1280, height: 720 }));
test('never overflows the window');            // 1000x700 -> width <= 1000 and height <= 700
test('whole device pixels at fractional dpr'); // at dpr 1.25, width * 1.25 / 320 is an integer
test('tiny window never scales below 1 device pixel');
```

- [ ] **Step 3: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, modules not found.

- [ ] **Step 4: Implement the core modules** so the tests pass. `createLoop` uses `requestAnimationFrame` and `ticksToRun`.

- [ ] **Step 5: Build the page**
  - `app/game/page.tsx`: server component with `metadata = { title: 'Tiny Kendo | YU Kendo', robots: { index: false, follow: false } }`, following `app/hero-styles/page.tsx:6-9`. It renders `<GameEntry />`.
  - `GameEntry.tsx`: `"use client"`. Reads `matchMedia('(pointer: coarse) and (hover: none)')` through `useSyncExternalStore`, with a server snapshot of `'unknown'` so hydration matches. On phones it renders the message "Tiny Kendo needs a keyboard. Come back on a computer!" and a link back. Otherwise it renders `GameCanvas` through `dynamic(() => import('./GameCanvas'), { ssr: false })`, so phones never request it.
  - Wrapper is `position: fixed; inset: 0`, background `#1A1A1A`, `touch-action: none`, canvas centered with `image-rendering: pixelated`.
  - Sticky logo: `<a href="/" aria-label="Back to York University Kendo Club">` containing the 64×64 PNG shown at 32px, pixelated, fixed at bottom-right, above the canvas.
  - Placeholder scene: clears the canvas to dark and draws a moving red square, proving the loop runs.
  - Development only: expose `window.__tinyKendo = { scene }` read-only for verification, removed from production by a `process.env.NODE_ENV` check. Task 5 adds `run` and `duel` to it.

- [ ] **Step 6: Run tests and build.** `npm test` passes, and `npm run build` matches the Step 1 baseline.

- [ ] **Step 7: Verify in the browser on port 3210**
  - `/game` shows the square, with no console errors and no page scroll.
  - The HTML contains `noindex`.
  - With phone emulation, the message shows and the network log has no `GameCanvas` chunk. Confirm the chunk **is** requested on desktop, so the absence means something.
  - Clicking the logo reaches `/` by full page load, and the hero's scroll stops still work (run `docs/testing/scroll-matrix.cjs` if Playwright is available, otherwise wheel through Welcome, Kendo and About by hand in the browser).

---

### Task 2: Art system and art sheet

**Files:**
- Create: `components/game/art/{palette,sprite,font,kendoka,duel-sprites,tiles}.ts`, `scenes/art-sheet.ts`, and tests for sprite and font

**Interfaces:**
- Consumes: `Scene`, `Game` from Task 1
- Produces:
  - `PALETTE: Record<string, string>`, single-character keys, `.` transparent
  - `validateGrid(grid: string[]): string[]`, returning problems found
  - `buildSprite(grid: string[], colors?: Record<string, string>): HTMLCanvasElement`, with `colors` allowing palette swaps
  - `GLYPHS`, `measureText(s: string): number`, `wrapText(s: string, maxWidth: number): string[]`, `drawText(ctx, s, x, y, color)`
  - `type Gear = { tare: boolean; do: boolean; men: boolean; kote: boolean; shinai: boolean }`
  - `drawKendoka(ctx, x, y, facing: 'down'|'up'|'side', frame: 0|1, gear: Gear, flip?: boolean): void`, a 16×20 sprite with gear as overlays
  - `type DuelPose = 'guard'|'bow'|'block'|'tellHandsUp'|'tellTipDip'|'tellBigRaise'|'strikeMen'|'strikeKote'|'strikeDo'|'zanshin'|'recover'|'stunned'`
  - `drawFighter(ctx, x, y, pose: DuelPose, side: 'player'|'rival', frame: number): void`, about 32×40
  - Tile sprites: dojo floor, wall, door, gear rack; road ground, cracked bamboo, tsuba, background layers

- [ ] **Step 1: Write failing tests**

```ts
test('every sprite grid is rectangular and uses palette keys only'); // loop over all exported grids; validateGrid(g) is []
test('gear overlays match their base sprite size');
test('wrapText never exceeds maxWidth');           // for sample strings, measureText(line) <= maxWidth
test('every glyph has the same height');
test('measureText("") is 0');
```

- [ ] **Step 2: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, modules not found.

- [ ] **Step 3: Implement palette, sprite and font, then draw the art.** Export grids separately from the canvas code so Node can test them. Characters are chunky and big-headed. In `drawFighter`, the three tell poses must be easy to tell apart at a glance, because the duel depends on them: hands up, tip dipped, and hands raised high. Kendoka check: men-gane grille, tare flaps, do curve, and kote cuffs should all be recognisable.

- [ ] **Step 4: Build the art sheet.** In development only, `/game?art=1` shows every sprite, all gear combinations in order, walking and duel poses for both sides, and tiles. Production ignores the parameter.

- [ ] **Step 5: Run tests.** `npm test` passes. Take a screenshot of the art sheet at 1280×720 and check for overlap with the sticky logo.

- [ ] **Step 6: OWNER CHECKPOINT.** Show the owner `/game?art=1`. Ask: "Is this cute enough, and can you tell the three tells apart?" Revise until they say yes.

---

### Task 3: Duel rules

**Files:**
- Create: `components/game/duel/constants.ts`, `duel/rules.ts`, `duel/rules.test.ts`

**Interfaces:**
- Produces:
  - `type Target = 'men'|'kote'|'do'`, `type AttackKind = Target | 'bigMen' | 'quickMen'`
  - `type Stance = 'guard'|'block'|'windup'|'recovery'|'broken'`
  - `type FighterInput = { move: -1|0|1; block: boolean; attack: AttackKind | null }`
  - `type Fighter = { x: number; ki: number; kiMax: number; stance: Stance; stanceTicks: number; attack: AttackKind | null; points: number }`
  - `type DuelEvent = { type: 'kiai'|'clean'|'blocked'|'whiff'|'lock'|'aiuchi'|'broken'|'bow'; by?: 0|1; target?: Target }`
  - `type DuelState = { phase: 'bow'|'fight'|'point'|'over'; phaseTicks: number; fighters: [Fighter, Fighter]; winner: 0|1|null; lastScore: { by: 0|1; attack: AttackKind; defenderStance: Stance } | null; events: DuelEvent[] }`
  - `type DuelOptions = { kiMax?: [number, number]; windups?: [Partial<Record<AttackKind, number>>, Partial<Record<AttackKind, number>>]; harmless?: [boolean, boolean] }`
  - `createDuel(options?: DuelOptions): DuelState`
  - `step(state: DuelState, a: FighterInput, b: FighterInput): DuelState`, pure, never mutating its input
  - `skipBow(state: DuelState): DuelState`, `exposedTargets(f: Fighter): Target[]`, `distance(s: DuelState): number`

**Attack table, to be used as written.** Each tell has a real kendo counter behind it.

| Attack | Exposes while winding up | Player windup | Real counter |
|---|---|---|---|
| `men` | `kote` | 8 ticks | debana-kote |
| `kote` | `men` | 6 ticks | kote-nuki-men |
| `do` | `men` | 10 ticks | do-uchi-otoshi-men |
| `bigMen` (rival only, strikes men) | `do` | 46 ticks | nuki-do |
| `quickMen` (rival's punish only, strikes men) | `kote` | 12 ticks | debana-kote |

**Starting values in `constants.ts`, all tuned at the Task 5 checkpoint:** ring x 40–280, start distance 90, minimum body distance 12, strike range 18–48, walk 1.1 px per tick, ki max 100, tsuba ki max 125, low ki 30, swing cost 14, absorbed-strike cost 25, ki recovery 0.25 per tick in guard only, recovery 26 ticks, broken guard 50 ticks, ki after break 35, low-ki slowdown ×1.3 on windup and recovery and ×0.75 on walking, bow 60 ticks, point pause 90 ticks, lock push to distance 34.

**Rules that tests must pin:**
- `move` is ignored while blocking, winding up, in recovery, or broken. New attacks are only accepted from guard. `block` is only accepted from guard or block.
- A strike lands when its windup ends. In range and target exposed: clean, 1 point, `point` phase, positions reset, first to 2 ends the match. Out of range: whiff. Too close: lock, both pushed apart, no recovery. In range but not exposed: blocked. Whiffs and blocks put the striker into recovery.
- Both strikes landing clean on the same tick: `aiuchi`, no points, both enter recovery.
- `harmless[i]` strikes never score, for training.

- [ ] **Step 1: Write failing tests**

```ts
test('each stance exposes exactly the targets in the spec', () => {
  assert.deepEqual(exposedTargets(guard), ['men','kote','do']);
  assert.deepEqual(exposedTargets(blocking), []);
  assert.deepEqual(exposedTargets(windup('men')), ['kote']);
  assert.deepEqual(exposedTargets(windup('kote')), ['men']);
  assert.deepEqual(exposedTargets(windup('do')), ['men']);
  assert.deepEqual(exposedTargets(windup('bigMen')), ['do']);
  assert.deepEqual(exposedTargets(windup('quickMen')), ['kote']);
  assert.deepEqual(exposedTargets(recovering), ['men','kote','do']);
  assert.deepEqual(exposedTargets(broken), ['men','kote','do']);
});
test('in range strike on an exposed target scores');
test('too far whiffs: no point, striker recovers');
test('too close locks: no point, pushed to distance 34, no recovery');
test('wrong target during a tell is blocked, no point');
test('strike on a blocker scores nothing and costs the blocker 25 ki');
test('running out of ki while blocking breaks the guard, and ki becomes 35');
test('no ki recovery while blocking; recovers in guard');
test('swing costs 14 ki');
test('low ki lengthens windup and recovery and slows walking');
test('ki never ends the match by itself');
test('simultaneous clean strikes are aiuchi: no points, both recover');
test('match ends at 2 points with the right winner');
test('positions reset after each point');
test('fighters cannot pass each other or leave the ring');
test('step is pure: input state deep-equals its earlier clone');
test('same inputs replay to the same state');
test('harmless strikes do not score');
test('skipBow moves straight to fight');
test('kiMax option sets starting ki');
```

- [ ] **Step 2: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `rules.ts` and `constants.ts`** so the tests pass. `step` builds a copy with a fresh `events` array each tick.

- [ ] **Step 4: Run tests to verify they pass.** Run `npm test`. Expected: PASS.

---

### Task 4: Rival AI, difficulty and tips

**Files:**
- Create: `components/game/duel/rival.ts`, `duel/tips.ts`, `components/game/run-state.ts`, `duel/rival.test.ts`, `duel/tips.test.ts`, `run-state.test.ts`

**Interfaces:**
- Consumes: everything from `duel/rules.ts`
- Produces:
  - `type RivalConfig = { tell: { men: number; kote: number; bigMen: number } }`
  - `rivalConfig(losses: number): RivalConfig`, with tell lengths `men` 30, `kote` 30, `bigMen` 46 ticks at 0 losses, +4 ticks per loss, capped at +16. `createDuel`'s `windups` takes these for the rival. `quickMen` stays at 12.
  - `createRival(seed: number, config: RivalConfig): RivalState`
  - `rivalAct(duel: DuelState, rival: RivalState): { input: FighterInput; rival: RivalState }`, pure, using a seeded PRNG held in `RivalState`
  - `tipFor(lastScore: NonNullable<DuelState['lastScore']>): string`
  - `type RunState = { gear: Gear; trained: boolean; hasTsuba: boolean; losses: number }`
  - `createRunState(): RunState`, `recordLoss(r): RunState`, `recordWin(r): RunState` (losses back to 0), `duelOptionsFor(r): DuelOptions`

**Rival behavior:**
- Out of range: walk in. In range: hold block by default, and start a habit every 60–110 ticks, chosen by PRNG.
- **Habits:** quick men (tell: hands up), kote poke (tell: tip dips), big raise (tell: hands high).
- **Punish:** when the opponent is in recovery or broken and in range, attack with `quickMen` after a 6-tick reaction. That lands at 18 ticks, inside the 26-tick recovery, which is what makes mashing lose. `quickMen` is used for nothing else.
- **Anti-turtle:** if the opponent has blocked for more than 90 ticks, attack repeatedly.
- **Low ki:** under 25, back away to recover. This is a real opening for an attentive player.

**Tips, used as written:**
- `men`: "Their hands rise before they strike. Try kote."
- `kote`: "Their shinai tip dips before a kote. Their men is open."
- `bigMen`: "When they raise their hands high, their do is open."
- Defender in `recovery`: "That miss left you open. Wait for an opening."
- Defender `broken`: "Blocking costs ki. Too much and your guard breaks."

- [ ] **Step 1: Write failing tests.** Simulations play 20 seeded matches through `step` and `rivalAct`, each capped at 3600 ticks.

```ts
test('an idle player loses every match');
test('mashing strikes wins at most 2 of 20');      // cycle men/kote/do from guard, walking in
test('holding block wins 0 of 20 and the guard breaks at least once');
test('a tell-reader bot wins at least 15 of 20');  // after 18 ticks of reaction: kote vs hands up, men vs tip dip, do vs big raise, otherwise holds block
test('rival uses quickMen only against a recovering or broken opponent; every other attack has its full tell');
test('rival tells grow +4 per loss and cap at +16');
test('same seed gives the same match');
test('each tip matches its scoring situation');
test('rematch state does not leak', () => {
  let r = createRunState(); r = { ...r, hasTsuba: true };
  for (let i = 0; i < 20; i++) r = recordLoss(r);
  const d = createDuel(duelOptionsFor(r));
  assert.deepEqual(d.fighters.map(f => f.points), [0, 0]);
  assert.equal(d.fighters[0].ki, 125);
  assert.equal(d.fighters[0].kiMax, 125);
  assert.equal(rivalConfig(r.losses).tell.men, 46);  // 30 + the 16 cap
});
test('a win resets losses and keeps the tsuba and gear');
```

- [ ] **Step 2: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `rival.ts`, `tips.ts` and `run-state.ts`.** If the mashing or tell-reader tests fail, tune `constants.ts` and the rival's behavior, not the thresholds.

- [ ] **Step 4: Run tests to verify they pass.** Run `npm test`. Expected: PASS.

---

### Task 5: Playable duel

**Files:**
- Create: `components/game/scenes/duel.ts`, `scenes/title.ts`
- Modify: `components/game/game.ts` (register scenes, add `run`, development `?scene=duel` jump)

**Interfaces:**
- Consumes: `step`, `skipBow`, `rivalAct`, `tipFor`, `RunState`, `drawFighter`, `drawText`
- Produces: `scene 'duel'`; `game.run` and the development `window.__tinyKendo.run` and `.duel`. Until Task 9, a win shows a rematch prompt inside the scene. Task 9 changes that to `game.go('win')`.

- [ ] **Step 1: Build the scene**
  - **HUD:** point markers and a ki bar per fighter, no health bars, kept clear of the sticky logo.
  - **Fighters:** poses map from `stance` and `attack`. Referee sprites stand behind, and three flags rise on a clean strike.
  - **Feedback from `events`:** kiai speech bubble ("MEN!") on landing, "IPPON" on clean, zanshin pose during the `point` phase, small shake on clean strikes.
  - **Bow** opens each match. Any confirm key skips it.
  - **Loss screen:** the tip from `tipFor`, then confirm for an instant rematch via `recordLoss`.
  - **Input:** left/right set `move`, S or Down sets `block`, J/K/L set `attack`. Use `wasPressed` for attacks.
  - **Title scene:** title, controls, press a key. It goes straight to the duel for now.

- [ ] **Step 2: Verify in the browser on port 3210.** At `/game?scene=duel`, send real key events, then read `window.__tinyKendo` to confirm state instead of relying on screenshots:
  - Idle: the rival scores twice, and the loss screen shows a tip.
  - In range, press J on a guard-stance rival: confirm the `kiai` event and the outcome.
  - Hold S through a rival strike: ki drops by 25 and no point is scored.
  - The console has no errors.

- [ ] **Step 3: Run `npm test` and `npm run build`.** Both pass.

- [ ] **Step 4: OWNER CHECKPOINT, the most important one.** The owner, and ideally a club member, plays at `/game?scene=duel`. Ask: "Is it fun? Do you want a rematch? Does it feel like kendo? Are the tells readable, and is it too hard or too easy?" Tune `constants.ts` and the rival with them. **Do not start Task 6 until the owner says the duel is worth building on.** If it isn't, rethink the duel with them first.

---

### Task 6: Top-down movement, dialogue and the club

**Files:**
- Create: `components/game/core/collision.ts`, `core/collision.test.ts`, `scenes/topdown.ts`, `scenes/dialogue.ts`, `scenes/club.ts`, `scenes/content.ts`, `scenes/content.test.ts`, `scenes/levels.ts`, `scenes/levels.test.ts`

**Interfaces:**
- Consumes: `Input`, `drawKendoka`, `drawText`, `wrapText`, `RunState`
- Produces:
  - `type Box = { x: number; y: number; w: number; h: number }`, `type TileMap = { rows: string[]; solid: string; tile: number }`
  - `moveAndCollide(box: Box, dx: number, dy: number, map: TileMap): { box: Box; hitX: boolean; hitY: boolean }`
  - `updateWalker(walker, input, map)`, shared by the club and the rival dojo
  - `createDialogue()`: `{ open(lines: string[]): void; active: boolean; update(input): void; render(ctx): void }`
  - `CONTENT`: all dialogue and gear lines
  - `CLUB_MAP` in `levels.ts` (Task 8 adds `ROAD_MAP`, Task 9 adds `RIVAL_MAP`)

**Gear lines, used as written:**
- Tare: "Tare: guards the waist and hips. It goes on first."
- Do: "Do: the chest armor. The strike to its side is also called do."
- Men: "Men: the helmet and face grille. Also the top-of-head target."
- Kote: "Kote: padded gloves for hands and wrists."
- Shinai: "Shinai: four bamboo slats tied together. Never step over one!"

- [ ] **Step 1: Write failing tests**

```ts
test('moves freely in open space');
test('stops flush against a wall on each axis');
test('slides along a wall when moving diagonally');
test('never ends inside a solid tile at speeds up to 8 px per tick');
test('map rows are all the same width');
test('club map holds exactly five gear spawns, one door, one senior');
test('every gear spawn and the senior can be reached from the start'); // flood fill over non-solid tiles
test('every dialogue line can be drawn', ...);  // every character in CONTENT exists in GLYPHS
test('no real club people appear in the content'); // no officer or sensei name from Officers.tsx and Sensei.tsx, nor Toronto, Waterloo or York
```

- [ ] **Step 2: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, modules not found.

- [ ] **Step 3: Implement collision, walker, dialogue, content and the club.** The club is Pinecone Dojo: a main hall with two small side rooms, with gear placed so that at least two pieces need exploring. Each pickup updates `run.gear`, changes the sprite right away, and opens its gear line. Senpai Momo refuses until all five are found, with a line that changes by how many are missing. Two other characters offer short, funny lines. The door stays shut until `run.trained`, which Task 7 sets. Until then, pressing confirm on Momo with full gear sets `trained` directly.

- [ ] **Step 4: Run tests to verify they pass.** Run `npm test`. Expected: PASS.

- [ ] **Step 5: Verify in the browser.** Walk to each gear item with real keys and confirm through `window.__tinyKendo.run.gear` that each changes, and by screenshot that the sprite changes. Confirm the door stays shut before training.

---

### Task 7: Training

**Files:**
- Create: `components/game/scenes/training.ts`, `scenes/training.test.ts`
- Modify: `scenes/club.ts` (Momo starts training; on finish, set `run.trained`), `scenes/content.ts`

**Interfaces:**
- Consumes: `createDuel` with `harmless: [false, true]`, `step`, `drawFighter`, the duel scene's HUD and rendering
- Produces:
  - `type Lesson = { id: 'men'|'kote'|'do'|'block'; prompt: string; partner(tick: number, duel: DuelState): FighterInput; done(events: DuelEvent[], duel: DuelState): boolean }`
  - `LESSONS: Lesson[]`
  - `scene 'training'`

**Lessons, in order:**
1. **Men:** partner stands in guard. Step into range and press J. Done on a clean men.
2. **Kote:** partner slowly raises hands (`men` with a long windup). Done on a clean kote.
3. **Do:** partner raises high (`bigMen`). Done on a clean do.
4. **Block:** partner swings slowly. Hold S. Done when a strike is absorbed. Momo adds one line on ki: blocking and swinging tire you out, and your guard can break.

Extract HUD and fighter rendering from `scenes/duel.ts` into shared functions so training doesn't duplicate them.

- [ ] **Step 1: Write failing tests**

```ts
test('each lesson can be completed by the right input');  // scripted inputs through step until done() is true
test('a wrong-target strike does not complete the kote and do lessons');
test('an unblocked partner strike scores nothing');       // harmless
test('points reset between lessons');
```

- [ ] **Step 2: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement the lessons and scene.** Show one short prompt at a time, using real terms with plain explanations. Finishing returns to the club with the door open.

- [ ] **Step 4: Run tests to verify they pass.** Run `npm test`. Expected: PASS.

- [ ] **Step 5: Verify in the browser.** Complete training with real keys. Confirm `run.trained` is true and the door now opens.

---

### Task 8: The road and its secret

> **Replaced by owner decision on 2026-11-05.** No platformer. The secret moved into the club, as described in the spec. The steps below are kept as a record only.

**Files:**
- Create: `components/game/scenes/road-physics.ts`, `scenes/road-physics.test.ts`, `scenes/road.ts`
- Modify: `scenes/levels.ts` (add `ROAD_MAP`), `scenes/levels.test.ts`

**Interfaces:**
- Consumes: `moveAndCollide`, `Input`, `drawKendoka`, tile sprites, `RunState`
- Produces:
  - `type RoadPlayer = { box: Box; vx: number; vy: number; grounded: boolean; coyote: number; jumpBuffer: number; safe: { x: number; y: number }; strikeTicks: number; facing: 1 | -1 }`
  - `stepRoad(p: RoadPlayer, input: { move: -1|0|1; jumpPressed: boolean; jumpHeld: boolean; strikePressed: boolean }, map: TileMap): { player: RoadPlayer; broke: { x: number; y: number } | null; fell: boolean }`

**Starting values, tuned by feel:** run 1.8 px per tick, gravity 0.28, jump velocity −4.6, jump cut on early release, coyote time 6 ticks, jump buffer 6 ticks, strike reach 18 px for 12 ticks.

- [ ] **Step 1: Write failing tests**

```ts
test('landing sets grounded');
test('jump works within coyote time and not after');
test('a buffered jump fires on landing');
test('releasing jump early gives a lower jump');
test('a strike breaks a cracked bamboo tile in reach and nothing else');
test('falling returns to the last safe ledge, and fell is true');
test('the safe spot is only set with solid ground under both feet'); // standing half over a pit must not record it
test('road map has one barrier, one tsuba and one exit');
test('tsuba cannot be reached without breaking the barrier'); // flood fill treating bamboo as solid
test('exit can be reached without breaking the barrier');     // flood fill treating bamboo as solid
```

The flood fill is a coarse check of open space. The jump-by-jump proof comes from the real playthrough in Step 4.

- [ ] **Step 2: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement physics and the scene.** One short level at about 90 seconds, with a horizontally scrolling camera, cute layered scenery, no enemies and no death. The barrier hides a side path with a visual hint: a crack in the bamboo and a glint that a curious player would notice. Picking up the lucky tsuba sets `run.hasTsuba` and shows a line saying they found something special, with `duelOptionsFor` then giving ki max 125. The exit leads to `rival-dojo`, which is a stub until Task 9.

- [ ] **Step 4: Run tests, then verify in the browser.** `npm test` passes. With real keys, finish the road without the secret, then again with it, confirming `run.hasTsuba`. Fall into a pit and confirm you return to a ledge.

---

### Task 9: Rival dojo, win screen and full flow

**Files:**
- Create: `components/game/scenes/rival-dojo.ts`, `scenes/win.ts`
- Modify: `scenes/duel.ts`, `scenes/title.ts`, `scenes/content.ts`, `scenes/levels.ts` (add `RIVAL_MAP`), `components/game/GameCanvas.tsx`, `components/game/game.ts`

**Interfaces:**
- Consumes: `updateWalker`, `createDialogue`, `recordWin`, `recordLoss`, `createRunState`, `onOverlay` from Task 1
- Produces: final scene order `title → club → training → club → road → rival-dojo → duel → win`

- [ ] **Step 1: Build the rival dojo.** Thunder Radish Dojo is a small room with two characters whose lines hint at Ren's habits without spelling them out. Talking to Ren starts the duel.

- [ ] **Step 2: Build the win scene.** A small celebration, then Rematch (back to the duel with `recordWin` applied, so full strength) or Play Again (fresh `createRunState`, back to title). On enter, call `onOverlay('win')`. `GameCanvas` then renders one quiet DOM line outside the canvas: "Want to chat kendo? Say hi on Discord or by email." Use `<a href="https://discord.gg/3a6xf8yFUe" target="_blank" rel="noopener noreferrer">` and the existing `CopyEmailButton` from `components/ui/CopyEmailButton.tsx`. Call `onOverlay(null)` on leave.

- [ ] **Step 3: Connect the full flow.** Title goes to the club. Add short fades between scenes. Keep the development `?scene=` jumps.

- [ ] **Step 4: Verify the full playthrough with real keyboard events.** Go from title to win, and confirm through `window.__tinyKendo` and screenshots:
  - Each gear pickup changes the sprite, and the barrier breaks.
  - The tsuba raises the player's duel ki to 125.
  - A loss shows a tip, and tells lengthen after it.
  - The Discord link has the right URL and the email button copies the address.
  - The sticky logo is visible in every scene.
  - The console has no errors.

- [ ] **Step 5: Run `npm test` and `npm run build`.** Both pass.

- [ ] **Step 6: OWNER CHECKPOINT.** The owner plays start to finish. Ask: "Does the whole journey hold together, is the secret findable, and does anything feel like an advert?" Time a run against the 5-minute target. Apply their feedback.

---

### Task 10: Sound, pause, reduced motion and final checks

**Files:**
- Create: `components/game/core/audio.ts`, `core/audio.test.ts`
- Modify: `components/game/game.ts`, `scenes/duel.ts`, `scenes/road.ts`, `scenes/club.ts`, `scenes/rival-dojo.ts`, `scenes/training.ts`, `scenes/win.ts`

**Interfaces:**
- Consumes: `Input`, `DuelEvent`
- Produces:
  - `createAudio(ctxFactory?: () => AudioContext | null): { play(name: SoundName): void; toggleMute(): boolean; unlock(): void }`
  - `type SoundName = 'step'|'jump'|'pickup'|'swing'|'clean'|'blocked'|'break'|'secret'|'flag'`

- [ ] **Step 1: Write failing tests**

```ts
test('play does nothing and does not throw when audio is unavailable');
test('muted audio plays nothing');
test('toggleMute flips and returns the new state');
```

- [ ] **Step 2: Run tests to verify they fail.** Run `npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement audio** with small oscillator beeps and a noise burst for shinai hits, unlocked on the first key press. Connect sounds to `DuelEvent`s and scene actions.

- [ ] **Step 4: Add pause, mute and reduced motion**
  - Esc toggles a pause overlay. Window `blur` and `document.hidden` pause automatically and call `input.clear()`.
  - M toggles mute and shows a small icon.
  - When `prefers-reduced-motion` matches, turn off shake and flashes.

- [ ] **Step 5: Run the final verification from the spec**
  - `npm test` and `npm run build` pass.
  - The playthrough from Task 9 Step 4 still passes.
  - Switch away mid-duel with a key held: on return the game is paused, nothing moved, and no key is stuck.
  - Ctrl+R reloads the page. Tab to the logo and press Enter: it reaches `/`.
  - On `/`, the network log requests no `components/game` chunk.
  - Going from `/game` to `/` by the logo leaves the hero's scroll stops working.
  - Phone emulation shows the message and requests no game chunk.
  - The `/game` HTML contains `noindex`.
  - `git status` shows only new game files and docs, plus `package.json` and `tsconfig.json`, on top of the owner's existing changes.

- [ ] **Step 6: Report to the owner.** List what's uncommitted and anything worth tuning further. Do not commit.
