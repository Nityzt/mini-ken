import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunState } from '../run-state.ts';
import { doorWelcome, genWelcome } from './welcome.ts';

test('the door welcome plays once before meeting Momo, including after a reload', () => {
  const first = doorWelcome(createRunState());
  assert.ok(first);
  assert.match(first.lines.join(' '), /Momo/);
  assert.equal(doorWelcome(first.run), null);
  assert.equal(doorWelcome({ ...createRunState(), metSenpai: true }), null);
});

test('Old Gen greets you as a stranger once, and after that just starts again', () => {
  const first = genWelcome(createRunState());
  assert.match(first.lines[0], /A visitor!/);
  const again = genWelcome(first.run);
  assert.doesNotMatch(again.lines.join(' '), /A visitor!/);
  assert.equal(again.lines.length, 1);
  assert.deepEqual(genWelcome(again.run).lines, again.lines);
});
