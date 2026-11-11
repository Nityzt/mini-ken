import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbush, stepAmbush } from './dungeon.ts';

test('Ren ambush is playable before its scripted capture, even when the player lands hits', () => {
  let state = createAmbush();
  for (let tick = 0; tick < 600; tick++) state = stepAmbush(state, { move: 1, attack: tick % 24 === 0, block: false });
  assert.ok(state.hits > 0, 'attacks can connect during the exchange');
  assert.equal(state.phase, 'captured');
  assert.equal(state.hp, 0);
});

test('standing away or guarding cannot bypass the ambush story outcome', () => {
  for (const block of [false, true]) {
    let state = createAmbush();
    for (let tick = 0; tick < 600; tick++) state = stepAmbush(state, { move: -1, attack: false, block });
    assert.equal(state.phase, 'captured');
  }
});

test('resuming a captive run uses its checkpoint and leaving safely restores the original gear', async () => {
  const { createDungeonScene } = await import('./dungeon.ts');
  const { createRunState } = await import('../run-state.ts');
  const { discoverDungeon, enterDungeon, captureDungeon, saveDungeonProgress } = await import('../dungeon-story.ts');
  const { createDungeon } = await import('../dungeon.ts');
  const original = { ...createRunState(), node: 'radish' as const, beaten: ['raiko'] as const, gear: { shinai: true, tare: true, do: true, men: true, kote: true }, money: 123 };
  const run = captureDungeon(enterDungeon(discoverDungeon({ ...original, beaten: [...original.beaten] })));
  const progress = createDungeon(1, { shinai: true, collected: ['cell-shinai'] });
  const scenes: string[] = [];
  const game = {
    run: saveDungeonProgress(run, progress),
    debug: {},
    input: { isDown: () => false, wasPressed: () => false },
    audio: { play: () => {}, say: () => {} },
    go: (name: string) => scenes.push(name),
  } as unknown as import('../core/scene.ts').Game;
  const scene = createDungeonScene();
  scene.enter!(game);
  scene.update(game);
  assert.equal(game.run.dungeon.stage, 'active');
  assert.equal(game.run.dungeon.progress?.room, 1);
  assert.equal(game.run.dungeon.progress?.shinai, true);
  scene.forfeit!(game);
  assert.deepEqual(game.run.gear, original.gear);
  assert.equal(game.run.money, original.money);
  assert.equal(game.run.dungeon.stage, 'discovered');
  assert.deepEqual(scenes, ['rival-dojo']);
});

test('a shared interaction binding picks up gear without also jumping or attacking', async () => {
  const { createDungeonScene } = await import('./dungeon.ts');
  const { createRunState } = await import('../run-state.ts');
  const { discoverDungeon, enterDungeon, captureDungeon, saveDungeonProgress } = await import('../dungeon-story.ts');
  const { createDungeon } = await import('../dungeon.ts');
  const original = { ...createRunState(), node: 'radish' as const, beaten: ['raiko' as const] };
  const progress = createDungeon(0, { shinai: true, collected: ['cell-shinai'] });
  progress.player.x = 80;
  progress.player.y = 24;
  const game = {
    run: saveDungeonProgress(captureDungeon(enterDungeon(discoverDungeon(original))), progress),
    debug: {},
    input: { isDown: () => false, wasPressed: (action: string) => ['confirm', 'up', 'men'].includes(action) },
    audio: { play: () => {}, say: () => {} },
    go: () => {},
  } as unknown as import('../core/scene.ts').Game;
  const scene = createDungeonScene();
  scene.enter!(game);
  scene.update(game);
  const state = game.run.dungeon.progress!;
  assert.ok(state.collected.includes('cell-crane'));
  assert.equal(state.player.y, 24, 'interaction keeps the player on the shelf');
  assert.equal(state.player.grounded, true);
  assert.equal(state.player.attackTicks, 0, 'interaction suppresses the overlapping attack');
});

test('in the ambush Ren strikes only after a raised tell, and a held guard turns every one aside', () => {
  let state = createAmbush();
  let tells = 0;
  for (let tick = 0; tick < 400; tick++) {
    const before = state.ren;
    state = stepAmbush(state, { move: 0, attack: false, block: true });
    if (before !== 'tell' && state.ren === 'tell') tells++;
    if (state.ren === 'strike') assert.ok(before === 'tell' || before === 'strike');
  }
  assert.ok(tells >= 3);
  assert.equal(state.hp, 3, 'nothing gets through a held guard');
  assert.ok(state.parries >= 3);
  assert.equal(state.phase, 'fight', 'the smoke, not a hit, ends it');
});

test('the Spy Chamber hands you to the real duel with Ren, takes a loss back to its door, and a win on to the reveal and out', async () => {
  const { createDungeonScene } = await import('./dungeon.ts');
  const { createRunState, recordLoss, recordWin } = await import('../run-state.ts');
  const { discoverDungeon, enterDungeon, captureDungeon, saveDungeonProgress, winRenBelow } = await import('../dungeon-story.ts');
  const { createDungeon, FINAL_ROOM, DUNGEON_ROOMS } = await import('../dungeon.ts');
  const original = { ...createRunState(), node: 'radish' as const, beaten: ['raiko' as const], gear: { shinai: true, tare: true, do: true, men: true, kote: true }, owned: ['fineShinai'] };
  const scenes: string[] = [];
  let frame = 0;
  const game = {
    run: saveDungeonProgress(captureDungeon(enterDungeon(discoverDungeon(original))), createDungeon(FINAL_ROOM, { shinai: true, pieces: ['do'] })),
    debug: {} as Record<string, unknown>,
    // Walking right and tapping E every other frame, which also reads every line.
    input: { isDown: (action: string) => action === 'right', wasPressed: (action: string) => action === 'confirm' && frame % 2 === 0 },
    audio: { play: () => {}, say: () => {} },
    versus: 'raiko',
    message: null as string[] | null,
    go: (name: string) => scenes.push(name),
  } as unknown as import('../core/scene.ts').Game;
  const scene = createDungeonScene();
  const play = (until: () => boolean) => {
    for (let i = 0; i < 4000 && !until(); i++, frame++) scene.update(game);
  };
  scene.enter!(game);
  play(() => scenes.length > 0);
  assert.deepEqual(scenes, ['duel']);
  assert.equal(game.versus, null, 'the duel is with Ren, the head here');
  // Lost: back at the chamber's door, not the cell, and Ren is still there to walk up to.
  game.run = recordLoss(game.run);
  scene.enter!(game);
  assert.equal(game.run.dungeon.progress?.room, FINAL_ROOM);
  assert.equal(game.run.dungeon.progress?.player.x, DUNGEON_ROOMS[FINAL_ROOM].start.x);
  play(() => scenes.length > 1);
  assert.deepEqual(scenes, ['duel', 'duel']);
  // Won: Ren kneels and goes, the chest gives everything back, and the stair leads out.
  game.run = winRenBelow(recordWin(game.run));
  scene.enter!(game);
  play(() => scenes.length > 2);
  assert.deepEqual(scenes, ['duel', 'duel', 'rival-dojo']);
  assert.equal(game.run.dungeon.stage, 'escaped');
  assert.ok(game.run.beaten.includes('radish'));
  assert.deepEqual(game.run.gear, original.gear);
  assert.deepEqual(game.run.owned, original.owned);
  assert.ok(game.message?.some((line) => line.includes('Ren stands in the usual spot')));
});

test('you cannot walk through Ren in the ambush', () => {
  let state = createAmbush();
  for (let tick = 0; tick < 200; tick++) state = stepAmbush(state, { move: 1, attack: false, block: true });
  assert.ok(state.renX - state.x >= 19);
});
