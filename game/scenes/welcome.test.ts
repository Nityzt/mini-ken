import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunState } from '../run-state.ts';
import { doorWelcome } from './welcome.ts';

test('the door welcome plays once before meeting Momo, including after a reload', () => {
  const first = doorWelcome(createRunState());
  assert.ok(first);
  assert.match(first.lines.join(' '), /Momo/);
  assert.equal(doorWelcome(first.run), null);
  assert.equal(doorWelcome({ ...createRunState(), metSenpai: true }), null);
});
