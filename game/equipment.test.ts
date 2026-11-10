import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, playerKiMax } from './run-state.ts';
import { buy } from './shop.ts';
import { equip, equippedAt, modify, modOn, equipmentEffects, equipmentKi } from './equipment.ts';
import { wearFrom, durabilityOf } from './durability.ts';
import { parseRun } from './save.ts';
const armed = () => ({ ...createRunState(), gear: { shinai: true, tare: true, do: true, men: true, kote: true }, money: 5000 });
test('gear bonuses come only from the piece equipped in each slot', () => {
 let run = buy(buy(armed(), 'fineShinai'), 'tideShinai');
 assert.equal(equippedAt(run, 'shinai'), 'tideShinai');
 const ki = equipmentKi(run);
 run = equip(run, 'fineShinai');
 assert.equal(equipmentKi(run), 5);
 assert.notEqual(ki, equipmentKi(run));
 assert.equal(equip(run, 'forgeDo'), run, 'cannot equip unowned armor');
});
test('mods charge once, replace one another, and reject incompatible targets', () => {
 const run = buy(armed(), 'tideShinai');
 const fitted = modify(run, 'tideShinai', 'balancedGrip');
 assert.equal(fitted.money, run.money - 60);
 assert.equal(modOn(fitted, 'tideShinai'), 'balancedGrip');
 assert.equal(modify(fitted, 'tideShinai', 'balancedGrip'), fitted);
 assert.equal(modify(fitted, 'tideShinai', 'softLining'), fitted);
 const replaced = modify(fitted, 'tideShinai', 'reinforced');
 assert.equal(modOn(replaced, 'tideShinai'), 'reinforced');
 assert.equal(equipmentKi(replaced), equipmentKi(run));
});
test('premodded purchases carry the same real modification', () => {
 const run = buy(armed(), 'guardedShinai');
 assert.equal(modOn(run, 'guardedShinai'), 'reinforced');
 const worn = wearFrom(run, 'tetsu').run;
 assert.equal(durabilityOf(worn, 'guardedShinai'), 92);
 assert.equal(durabilityOf(worn, 'shinai'), 50);
});
test('armor variants wear and repair independently of the base armor', () => {
 const run = buy(armed(), 'forgeDo');
 const worn = wearFrom(run, 'heron').run;
 assert.ok(durabilityOf(worn, 'forgeDo') < 100);
 assert.equal(durabilityOf(worn, 'do'), 100);
 assert.equal(equippedAt(equip(worn, 'do'), 'do'), 'do');
});
test('save roundtrips selections and mods, rejects incompatible or unowned selections', () => {
 const run = modify(buy(armed(), 'tideShinai'), 'tideShinai', 'balancedGrip');
 assert.deepEqual(parseRun(JSON.parse(JSON.stringify(run))), run);
 assert.equal(parseRun({ ...run, equipped: { men: 'tideShinai' } }), null);
 assert.equal(parseRun({ ...run, equipped: { do: 'forgeDo' } }), null);
 assert.equal(parseRun({ ...run, mods: { tideShinai: 'softLining' } }), null);
});
test('old saves keep their purchased armor bonuses through default selections', () => {
 const raw: Record<string, unknown> = { ...armed(), owned: ['fineShinai', 'deerKote', 'lacquerDo', 'charm'] };
 delete raw.equipped; delete raw.mods;
 const run = parseRun(raw)!;
 assert.ok(run);
 assert.equal(equipmentKi(run), 20);
 assert.equal(playerKiMax(run) - playerKiMax(armed()), 23);
});

test('buying equipment cannot skip earning the base armor slot', () => {
 const run = buy({ ...createRunState(), money: 500 }, 'forgeDo');
 assert.ok(run.owned.includes('forgeDo'));
 assert.equal(equippedAt(run, 'do'), null);
 assert.equal(equipmentKi(run), 0);
 assert.equal(equip(run, 'forgeDo'), run);
 const earned = { ...run, gear: { ...run.gear, do: true } };
 assert.equal(equippedAt(equip(earned, 'forgeDo'), 'do'), 'forgeDo');
});
test('returning a modified loan keeps the save readable and removes it from use', () => {
 const run = modify(equip(armed(), 'shinai'), 'shinai', 'balancedGrip');
 const returned = { ...run, madeShinai: true, wielded: '', shinaiQuest: 'returned' };
 const parsed = parseRun(returned);
 assert.ok(parsed);
 assert.equal(equippedAt(parsed, 'shinai'), 'ownShinai');
 assert.equal(equipmentKi(parsed), 0);
 assert.equal(modOn(parsed, 'shinai'), 'balancedGrip');
});

test("a piece's effects leave out what it doesn't do, so nothing reads \"Wear -0\"", () => {
  assert.equal(equipmentEffects('shinai', null), 'No ki bonus. No mod.');
  assert.equal(equipmentEffects('tunedShinai', 'balancedGrip'), 'Ki +7. Mod: Balanced grip.');
  assert.equal(equipmentEffects('guardedShinai', 'reinforced'), 'Ki +5. Wears 2 less a fight. Mod: Reinforcement.');
  assert.equal(equipmentEffects('tideShinai', null), 'Ki +4. Wears 1 less a fight. No mod.');
});
