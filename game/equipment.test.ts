import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, playerKiMax } from './run-state.ts';
import { buy, shopKi } from './shop.ts';
import { EQUIPMENT, EQUIPMENT_SLOTS, GEAR_KI_CAP, MODS, equip, equipmentInfo, equippedAt, modify, modOn, equipmentEffects, equipmentKi, equipmentKiUncapped, type EquipmentId, type ModId, type PurchasedEquipmentId } from './equipment.ts';
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
 assert.equal(fitted.money, run.money - MODS.balancedGrip.price);
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

test('gear and mods together stay within the cap, however much of it you own', () => {
 let run = armed();
 const pieces = (Object.keys(EQUIPMENT) as EquipmentId[]).filter((id): id is PurchasedEquipmentId => equipmentInfo(id).price !== undefined);
 for (const id of pieces) run = buy(run, id);
 // The best piece in each slot, with the best ki mod on it, is the most anyone can carry.
 for (const slot of EQUIPMENT_SLOTS) {
  const best = pieces.filter(id => EQUIPMENT[id].slot === slot).sort((a, b) => EQUIPMENT[b].ki - EQUIPMENT[a].ki)[0];
  run = equip(run, best);
  run = modify(run, best, slot === 'shinai' ? 'balancedGrip' : 'softLining');
 }
 assert.ok(equipmentKiUncapped(run) > GEAR_KI_CAP, 'this loadout is over the cap before it applies');
 assert.equal(equipmentKi(run), GEAR_KI_CAP);
 assert.equal(GEAR_KI_CAP, 20);
 assert.equal(shopKi(buy(run, 'charm')), GEAR_KI_CAP + 3, 'the charm is on top of the cap');
});

test('better gear costs more, counting mods fitted at the bench', () => {
 // Every way to fill a slot: a piece as sold, or a plain piece with one mod fitted.
 type Option = { name: string; slot: string; ki: number; wear: number; cost: number; premod: boolean };
 const options: Option[] = [];
 for (const id of Object.keys(EQUIPMENT) as EquipmentId[]) {
  const piece = equipmentInfo(id);
  if (piece.price === undefined) continue;
  const sold = piece.premod ? MODS[piece.premod] : null;
  options.push({ name: piece.name, slot: piece.slot, ki: piece.ki + (sold?.ki ?? 0), wear: piece.wearReduction + (sold?.wearReduction ?? 0), cost: piece.price, premod: !!sold });
  if (sold) continue;
  for (const mod of Object.keys(MODS) as ModId[]) {
   if (!MODS[mod].slots.includes(piece.slot)) continue;
   options.push({ name: `${piece.name} + ${MODS[mod].name}`, slot: piece.slot, ki: piece.ki + MODS[mod].ki, wear: piece.wearReduction + MODS[mod].wearReduction, cost: piece.price + MODS[mod].price, premod: false });
  }
 }
 for (const a of options) for (const b of options) {
  if (a === b || a.slot !== b.slot || a.ki < b.ki || a.wear < b.wear) continue;
  const same = a.ki === b.ki && a.wear === b.wear;
  if (!same) assert.ok(a.cost > b.cost, `${a.name} (ki ${a.ki}, wear -${a.wear}) costs ${a.cost}, no more than ${b.name} (ki ${b.ki}, wear -${b.wear}) at ${b.cost}`);
  // A piece sold with its mod already fitted is never dearer than building the same thing yourself.
  else if (b.premod && !a.premod) assert.ok(b.cost <= a.cost, `${b.name} costs ${b.cost}, more than ${a.name} at ${a.cost}`);
 }
 assert.ok(options.length > 30);
});
