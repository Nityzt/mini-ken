import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunState } from '../run-state.ts';
import { doorWelcome, genWelcome } from './welcome.ts';
import { DOOR_WELCOME, MOMO_WELCOME } from './content.ts';

test('the door welcome plays once before meeting Momo, including after a reload', () => {
  const first = doorWelcome(createRunState());
  assert.ok(first);
  assert.match(first.lines.join(' '), /Momo/);
  assert.equal(doorWelcome(first.run), null);
  assert.equal(doorWelcome({ ...createRunState(), metSenpai: true }), null);
});

test("Nao says how to walk and talk, Momo doesn't welcome you all over again, and neither drags on", () => {
  assert.match(DOOR_WELCOME.join(' '), /arrow keys/);
  assert.match(DOOR_WELCOME.join(' '), /press E to talk/);
  assert.doesNotMatch(MOMO_WELCOME.join(' '), /Welcome to Pinecone/);
  assert.ok(DOOR_WELCOME.length <= 3);
  assert.ok(MOMO_WELCOME.length <= 5, `Momo's welcome is ${MOMO_WELCOME.length} lines`);
});

test('Old Gen greets you as a stranger once, and after that just starts again', () => {
  const first = genWelcome(createRunState());
  assert.match(first.lines[0], /A visitor!/);
  const again = genWelcome(first.run);
  assert.doesNotMatch(again.lines.join(' '), /A visitor!/);
  assert.equal(again.lines.length, 1);
  assert.deepEqual(genWelcome(again.run).lines, again.lines);
});
