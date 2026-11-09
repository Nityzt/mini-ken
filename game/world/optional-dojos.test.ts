import test from 'node:test';
import assert from 'node:assert/strict';
import { DOJOS, opponentById } from './dojos.ts';
import { createRunState, recordWin } from '../run-state.ts';
import { AFTER_WINS, PEOPLE } from '../scenes/chatter-lines.ts';
import { talkToChallenger } from '../scenes/challengers.ts';

test('the optional dojos have distinct playable rivals, helpers, and senseis', () => {
  for (const id of ['lantern', 'bamboo'] as const) {
    const dojo = DOJOS[id];
    assert.ok(dojo, id);
    assert.equal(opponentById(id).rival, dojo.rival);
    assert.ok(PEOPLE[id]?.small.length);
    assert.ok(PEOPLE[dojo.helperIds.G]?.advice.length);
    assert.ok(PEOPLE[dojo.helperIds.E]?.advice.length);
    assert.ok(PEOPLE[dojo.sensei.id]?.small.length);
    assert.equal(talkToChallenger({ ...createRunState(), dan: 3 }, dojo.sensei.id).fight, true);
    assert.ok(AFTER_WINS[id]?.first.length);
    assert.ok(recordWin({ ...createRunState(), node: id }).beaten.includes(id));
  }
});
