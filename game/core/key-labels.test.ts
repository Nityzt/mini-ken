import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from './input.ts';
import { instructionText, keyLabel, teachingKeys } from './key-labels.ts';

test('teaching and interaction instructions show the assigned keys', () => {
  const input = createInput(new EventTarget());
  input.setBindings({ ...input.bindings(), men: ['u'], confirm: ['z'], raise: ['r'] });
  assert.equal(keyLabel(input, 'confirm', 'e'), 'Z');
  assert.equal(teachingKeys(input, 'W Q E, J K L'), 'R Q E, U K L');
  assert.equal(instructionText(input, 'Press E to talk.'), 'Press Z to talk.');
  assert.equal(instructionText(input, 'Hold W Q E, then strike J.'), 'Hold R Q E, then strike U.');
});
