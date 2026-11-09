import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState } from './run-state.ts';
import { abandonDungeon, canEnterDungeon, captureDungeon, discoverDungeon, dungeonStage, enterDungeon, finishDungeon, saveDungeonProgress } from './dungeon-story.ts';
import { createDungeon } from './dungeon.ts';
import { parseRun, resumeScene } from './save.ts';

const ready = () => ({ ...createRunState(), node: 'radish' as const, beaten: ['raiko'] as ReturnType<typeof createRunState>['beaten'], gi: true, gear: { shinai: true, tare: true, do: true, men: true, kote: true }, owned: ['forgeDo', 'fineShinai'], equipped: { do: 'forgeDo' as const, shinai: 'fineShinai' as const }, mods: { fineShinai: 'reinforced' as const }, durability: { forgeDo: 32 }, wielded: 'fineShinai', madeShinai: true, shinaiQuest: 'returned', look: 'inkColors', menOn: true, hp: 47, money: 750 });
test('Raiko must be defeated before discovery and entering is optional', () => {
 const start = createRunState();
 assert.equal(discoverDungeon(start), start);
 assert.equal(dungeonStage(discoverDungeon(ready())), 'discovered');
 assert.equal(dungeonStage(enterDungeon(discoverDungeon(ready()))), 'caught');
 assert.equal(canEnterDungeon(ready(), 'r'), false);
 const hinted = discoverDungeon(ready());
 assert.equal(canEnterDungeon(hinted, 'r'), true);
 assert.equal(canEnterDungeon(hinted, 'p'), false);
 assert.equal(canEnterDungeon({ ...hinted, node: 'goose' }, 'r'), false);
});
test('capture saves independent gear escrow and abandonment restores every loadout field', () => {
 const original = ready(), captive = captureDungeon(enterDungeon(discoverDungeon(original)));
 assert.equal(captive.gear.shinai, false);
 assert.deepEqual(captive.owned, []);
 assert.ok(captive.dungeon.escrow);
 assert.notEqual(captive.dungeon.escrow.owned, original.owned);
 const restored = abandonDungeon(captive);
 for (const key of Object.keys(captive.dungeon.escrow) as (keyof NonNullable<typeof captive.dungeon.escrow>)[]) assert.deepEqual(restored[key], original[key], key);
 assert.equal(dungeonStage(restored), 'discovered');
 assert.equal(restored.money, original.money);
});
test('active escrow and full trial progress survive saves, older saves remain valid', () => {
 const captive = saveDungeonProgress(captureDungeon(enterDungeon(discoverDungeon(ready()))), createDungeon());
 const parsed = parseRun(JSON.parse(JSON.stringify(captive)));
 assert.ok(parsed);
 assert.equal(resumeScene(parsed), 'dungeon');
 assert.deepEqual(parsed.dungeon.escrow, captive.dungeon.escrow);
 assert.equal(parseRun({ ...captive, dungeon: { ...captive.dungeon, escrow: null } }), null);
 const old: Record<string, unknown> = { ...ready() }; delete old.dungeon;
 assert.equal(parseRun(old)?.dungeon.stage, 'locked');
});
test('only a completed model can escape and reward is awarded once', () => {
 const captive = captureDungeon(enterDungeon(discoverDungeon(ready())));
 assert.equal(finishDungeon(captive), captive);
 const escaped = finishDungeon(saveDungeonProgress(captive, { ...createDungeon(2), phase: 'escaped' }));
 assert.equal(escaped.dungeon.stage, 'escaped');
 assert.deepEqual(escaped.owned, ready().owned);
 assert.ok(escaped.xp > captive.xp);
 assert.equal(finishDungeon(escaped), escaped);
});
