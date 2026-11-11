import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, recordWin, type RunState } from './run-state.ts';
import {
 abandonDungeon, askRaikoAboutRen, canEnterDungeon, captureDungeon, discoverDungeon, dungeonObjective, dungeonStage, enterDungeon, finishDungeon, hasDungeonKey,
 raikoOffersRen, renBeatenBelow, renHuntObjective, renMissing, saveDungeonProgress, winRenBelow, REN_MISSING_SEEN,
} from './dungeon-story.ts';
import { createDungeon, FINAL_ROOM } from './dungeon.ts';
import { itemsGained } from './items.ts';
import { isOpen } from './progress.ts';
import { parseRun, resumeScene } from './save.ts';
import { challengerWin } from './scenes/challengers.ts';

const ready = () => ({ ...createRunState(), node: 'radish' as const, beaten: ['raiko'] as ReturnType<typeof createRunState>['beaten'], gi: true, gear: { shinai: true, tare: true, do: true, men: true, kote: true }, owned: ['forgeDo', 'fineShinai'], equipped: { do: 'forgeDo' as const, shinai: 'fineShinai' as const }, mods: { fineShinai: 'reinforced' as const }, durability: { forgeDo: 32 }, wielded: 'fineShinai', madeShinai: true, shinaiQuest: 'returned', look: 'inkColors', menOn: true, hp: 47, money: 750 });
test('Raiko must be defeated before he hands over the key, and going down is optional', () => {
 const start = createRunState();
 assert.equal(discoverDungeon(start), start);
 assert.equal(dungeonStage(discoverDungeon(ready())), 'discovered');
 assert.equal(dungeonStage(enterDungeon(discoverDungeon(ready()))), 'caught');
 assert.equal(canEnterDungeon(ready(), 'I'), false);
 const keyed = discoverDungeon(ready());
 assert.equal(canEnterDungeon(keyed, 'I'), true);
 assert.equal(canEnterDungeon(keyed, 'p'), false);
 assert.equal(canEnterDungeon({ ...keyed, node: 'goose' }, 'Q'), false);
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
 // Progress saved by the first version of the trial restarts it, but keeps the story and the escrowed gear.
 const firstVersion = parseRun(JSON.parse(JSON.stringify({ ...captive, dungeon: { ...captive.dungeon, progress: { room: 1, tick: 9, collected: [], shinai: true, armor: false, materials: 0, phase: 'playing', checkpoint: 1 } } })));
 assert.ok(firstVersion);
 assert.equal(firstVersion.dungeon.stage, 'active');
 assert.equal(firstVersion.dungeon.progress, null);
 assert.deepEqual(firstVersion.dungeon.escrow, captive.dungeon.escrow);
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

// Ren hidden below Thunder Radish (owner, 2026-11-11).

/** Good enough for Ren, standing in Thunder Radish: seme, 3rd dan, ki 230, and the four other rivals beaten. */
const qualified = (): RunState => ({ ...ready(), beaten: ['aki', 'raccoon', 'goose', 'heron', 'otter'], seme: true, dan: 3, waza: true, linePasses: 3, bonusKi: 200 });
const raikoBeaten = (): RunState => ({ ...qualified(), beaten: [...qualified().beaten, 'raiko'] });

test('once you qualify, Ren is missing from Thunder Radish until beaten, unless an older save already did the trial', () => {
 assert.equal(isOpen(qualified(), 'radish'), true);
 assert.equal(renMissing(qualified()), true);
 assert.equal(renMissing({ ...qualified(), seme: false }), false, 'not good enough yet, so nothing is hidden');
 assert.equal(renMissing({ ...qualified(), beaten: [...qualified().beaten, 'radish'] }), false);
 assert.equal(renMissing({ ...qualified(), dungeon: { stage: 'escaped', progress: null, escrow: null } }), false, 'an old trial already done leaves Ren on the floor');
});

test('Raiko only talks about Ren to someone who qualifies, and only once beaten', () => {
 assert.equal(raikoOffersRen({ ...qualified(), seme: false }), false);
 assert.equal(raikoOffersRen({ ...qualified(), node: 'goose' }), false);
 const fresh = qualified();
 assert.equal(raikoOffersRen(fresh), true);
 const asked = askRaikoAboutRen(fresh);
 assert.equal(asked.fight, true);
 assert.equal(hasDungeonKey(asked.run), false);
 assert.equal(dungeonStage(asked.run), 'locked');
 // Losing costs nothing: you can just ask again.
 assert.equal(askRaikoAboutRen(asked.run).fight, true);
 const won = challengerWin(asked.run, 'raiko');
 assert.ok(won.run.beaten.includes('raiko'));
 assert.equal(dungeonStage(won.run), 'discovered');
 assert.equal(hasDungeonKey(won.run), true);
 assert.ok(won.lines.some((line) => line.includes('below')), 'Raiko shares his doubts');
 assert.equal(raikoOffersRen(won.run), false, 'once told, there is nothing more to ask');
 assert.deepEqual(itemsGained(asked.run, won.run), ['key']);
});

test('a Raiko already beaten, by an older save or a plain challenge, tells you straight away', () => {
 const told = askRaikoAboutRen(raikoBeaten());
 assert.equal(told.fight, false);
 assert.equal(hasDungeonKey(told.run), true);
 // A plain challenge, never having asked, doesn't hand over the key by itself.
 const plain = challengerWin(qualified(), 'raiko');
 assert.equal(hasDungeonKey(plain.run), false);
 assert.equal(askRaikoAboutRen(plain.run).fight, false);
});

test('the key opens the iron door, and nothing else does', () => {
 const keyed = askRaikoAboutRen(raikoBeaten()).run;
 assert.equal(canEnterDungeon(qualified(), 'I'), false);
 assert.equal(canEnterDungeon(keyed, 'I'), true);
 assert.equal(canEnterDungeon(keyed, 'r'), false, 'the old way behind the rack is gone');
 assert.equal(canEnterDungeon({ ...keyed, node: 'goose' }, 'Q'), false);
 // An older save told about the cold draft already holds the key.
 const old = parseRun(JSON.parse(JSON.stringify({ ...ready(), dungeon: { stage: 'discovered', progress: null, escrow: null } })));
 assert.ok(old && hasDungeonKey(old) && canEnterDungeon(old, 'I'));
 // Ren takes it with everything else, and getting it back isn't a new find.
 const captive = captureDungeon(enterDungeon(keyed));
 assert.equal(hasDungeonKey(captive), false);
 assert.deepEqual(itemsGained(captive, abandonDungeon(captive)), []);
});

test('the objective line follows the hunt for Ren', () => {
 const fresh = qualified();
 assert.match(renHuntObjective(fresh)!, /Find Ren/);
 const looked = { ...fresh, seen: [...fresh.seen, REN_MISSING_SEEN] };
 assert.match(renHuntObjective(looked)!, /Raiko/);
 const asked = askRaikoAboutRen(looked).run;
 assert.match(renHuntObjective(asked)!, /Beat Sensei Raiko/);
 assert.equal(renHuntObjective({ ...fresh, beaten: [...fresh.beaten, 'radish'] }), null);
 assert.equal(renHuntObjective({ ...fresh, seme: false }), null);
 const keyed = challengerWin(asked, 'raiko').run;
 assert.equal(renHuntObjective(keyed), null);
 assert.match(dungeonObjective(keyed)!, /iron door/);
});

test('beating Ren below counts everywhere, and the escape hands your things back', () => {
 const keyed = askRaikoAboutRen(raikoBeaten()).run;
 const captive = captureDungeon(enterDungeon(keyed));
 const atRen = saveDungeonProgress(captive, createDungeon(FINAL_ROOM, { shinai: true, pieces: ['do'] }));
 assert.equal(renBeatenBelow(atRen), false);
 assert.match(dungeonObjective(atRen)!, /Ren/);
 // The duel records the win as it would anywhere, and the trial remembers it was won here.
 const won = winRenBelow(recordWin(atRen));
 assert.equal(renBeatenBelow(won), true);
 assert.ok(won.beaten.includes('radish'));
 assert.ok(won.bonusKi > atRen.bonusKi);
 assert.equal(isOpen(won, 'arenaLine'), true);
 assert.equal(isOpen(won, 'cup:radish'), true);
 // A save between the duel and the escape keeps the win.
 const saved = parseRun(JSON.parse(JSON.stringify(won)));
 assert.ok(saved && renBeatenBelow(saved));
 assert.equal(saved.dungeon.progress?.room, FINAL_ROOM);
 assert.equal(resumeScene(saved), 'dungeon');
 // Outside the trial there's nothing to remember.
 assert.equal(winRenBelow(keyed), keyed);
 const out = finishDungeon(saveDungeonProgress(won, { ...won.dungeon.progress!, recovered: true, phase: 'escaped' }));
 assert.equal(dungeonStage(out), 'escaped');
 assert.deepEqual(out.owned, ready().owned);
 assert.equal(renMissing(out), false, 'back on the floor as if nothing happened');
 assert.equal(hasDungeonKey(out), true);
});

test('a save in the last room from before the duel still has Ren to face', () => {
 const captive = captureDungeon(enterDungeon(askRaikoAboutRen(raikoBeaten()).run));
 const older = JSON.parse(JSON.stringify(saveDungeonProgress(captive, createDungeon(FINAL_ROOM, { shinai: true }))));
 delete older.dungeon.progress.renBeaten;
 const parsed = parseRun(older);
 assert.ok(parsed);
 assert.equal(parsed.dungeon.progress?.room, FINAL_ROOM);
 assert.equal(renBeatenBelow(parsed), false);
});
