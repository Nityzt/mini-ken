import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState } from '../run-state.ts';
import { parseRun } from '../save.ts';
import { findCityEgg } from './city-eggs.ts';

test('each district secret pays once and survives in the run', () => {
  let run = createRunState();
  for (const node of ['beachGarden', 'parkGrove', 'steelAlley', 'fallsPool'] as const) {
    const found = findCityEgg(run, node);
    assert.ok(found, node);
    assert.equal(found.run.money, run.money + 25);
    run = found.run;
    assert.equal(findCityEgg(run, node), null);
  }
  const restored = parseRun(JSON.parse(JSON.stringify(run)));
  assert.ok(restored);
  assert.equal(findCityEgg(restored, 'beachGarden'), null);
  assert.equal(findCityEgg(run, 'crossroads'), null);
});
