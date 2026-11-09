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
  const progress = createDungeon(1, { shinai: true, armor: false, collected: ['cell-shinai'] });
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
  progress.player.x = 280;
  progress.player.y = 68;
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
  assert.ok(state.collected.includes('cell-egg'));
  assert.equal(state.player.y, 68, 'interaction keeps the player on the shelf');
  assert.equal(state.player.grounded, true);
  assert.equal(state.player.attackTicks, 0, 'interaction suppresses the overlapping attack');
});
