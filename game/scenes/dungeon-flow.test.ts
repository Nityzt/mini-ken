import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState } from '../run-state.ts';
import { itemsGained } from '../items.ts';
import { captureDungeon, enterDungeon, discoverDungeon, abandonDungeon } from '../dungeon-story.ts';
import { parseRun, resumeScene } from '../save.ts';

test('a saved captured run resumes the trial and restores its equipment without acquisition cards', () => {
  const original = { ...createRunState(), gi: true, node: 'radish' as const, beaten: ['raiko'] as ReturnType<typeof createRunState>['beaten'], gear: { shinai: true, tare: true, do: true, men: true, kote: true }, owned: ['fineShinai', 'forgeDo'], money: 700 };
  const captive = captureDungeon(enterDungeon(discoverDungeon(original)));
  const restored = parseRun(JSON.parse(JSON.stringify(captive)));
  assert.ok(restored);
  assert.equal(resumeScene(restored), 'dungeon');
  const abandoned = abandonDungeon(restored);
  assert.deepEqual(abandoned.gear, original.gear);
  assert.deepEqual(abandoned.owned, original.owned);
  assert.equal(abandoned.money, original.money);
  assert.deepEqual(itemsGained(restored, abandoned), []);
});
