import type { RunState } from './run-state.ts';

export type EquipmentSlot = 'shinai' | 'tare' | 'do' | 'men' | 'kote';
export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['shinai', 'tare', 'do', 'men', 'kote'];
export type ModId = 'balancedGrip' | 'softLining' | 'reinforced';
export const MODS: Record<ModId, { name: string; price: number; line: string; slots: EquipmentSlot[]; ki: number; wearReduction: number }> = {
 balancedGrip: { name: 'Balanced grip', price: 60, line: 'Shinai: Ki +3 while carried.', slots: ['shinai'], ki: 3, wearReduction: 0 },
 softLining: { name: 'Soft lining', price: 75, line: 'Armor: Ki +3 while equipped.', slots: ['tare', 'do', 'men', 'kote'], ki: 3, wearReduction: 0 },
 reinforced: { name: 'Reinforcement', price: 90, line: 'Any gear: wear per fight reduced by 2.', slots: [...EQUIPMENT_SLOTS], ki: 0, wearReduction: 2 },
};
type Equipment = { name: string; slot: EquipmentSlot; ki: number; wearReduction: number; price?: number; icon: string; line: string; premod?: ModId; colors?: Record<string, string> };
const piece = (name: string, slot: EquipmentSlot, ki: number, price?: number, wearReduction = 0, premod?: ModId, colors?: Record<string,string>): Equipment => ({ name, slot, ki, wearReduction, price, premod, colors, icon: slot === 'shinai' ? 'iconShinai' : slot === 'tare' ? 'iconTare' : slot === 'men' ? 'iconMen' : slot === 'kote' ? 'iconKote' : 'iconDo', line: `Ki +${ki} while equipped.${wearReduction ? ` Wear -${wearReduction} per fight.` : ''}${premod ? ` Fitted: ${MODS[premod].name}. ${MODS[premod].line}` : ''}` });
/** Original earned pieces and shop variants share the same slot rules. */
export const EQUIPMENT = {
 shinai: piece("Sensei's old shinai", 'shinai', 0), ownShinai: piece('Your own shinai', 'shinai', 0),
 tare: piece('Your tare', 'tare', 0), do: piece('Your do', 'do', 0), men: piece('Your men', 'men', 0), kote: piece('Your kote', 'kote', 0),
 fineShinai: piece('Fine shinai', 'shinai', 5, 80), deerKote: piece('Deerskin kote', 'kote', 5, 150), lacquerDo: piece('Lacquered do', 'do', 10, 300),
 tideShinai: piece('Tide shinai', 'shinai', 4, 110, 1),
 blossomTare: piece('Blossom tare', 'tare', 4, 120, 0, undefined, { I: '#92566F', i: '#DC9EB6', N: '#593247' }),
 forgeDo: piece('Forge do', 'do', 6, 180, 2, undefined, { I: '#9A542D', i: '#D89A60', N: '#5A3020' }),
 mistMen: piece('Mist men', 'men', 4, 140, 1, undefined, { M: '#A8CFD9', T: '#628A9B', t: '#385768' }),
 pineTare: piece('Pinecone tare', 'tare', 3, 90), raccoonKote: piece('Raccoon kote', 'kote', 4, 110),
 gooseShinai: piece('Goose shinai', 'shinai', 6, 150), heronDo: piece('Heron do', 'do', 8, 220, 1),
 otterMen: piece('Otter men', 'men', 5, 160), radishShinai: piece('Radish shinai', 'shinai', 7, 190),
 lanternKote: piece('Lantern kote', 'kote', 3, 100, 1), bambooTare: piece('Bamboo tare', 'tare', 3, 100, 1),
 festivalMen: piece('Festival men', 'men', 6, 190, 0, undefined, { M: '#E6C46A', T: '#8A6A1E', t: '#463410' }),
 guardedShinai: piece('Guarded shinai', 'shinai', 5, 180, 0, 'reinforced'),
 linedDo: piece('Lined do', 'do', 6, 230, 0, 'softLining'),
 tunedShinai: piece('Tuned shinai', 'shinai', 4, 160, 0, 'balancedGrip'),
} satisfies Record<string, Equipment>;
export type EquipmentId = keyof typeof EQUIPMENT;
export type PurchasedEquipmentId = Exclude<EquipmentId, 'shinai' | 'ownShinai' | 'tare' | 'do' | 'men' | 'kote'>;
export const isEquipment = (id: string): id is EquipmentId => Object.hasOwn(EQUIPMENT, id);
export const isMod = (id: string): id is ModId => Object.hasOwn(MODS, id);
export const equipmentInfo = (id: EquipmentId): Equipment => EQUIPMENT[id];
export function equipmentHeld(run: RunState): EquipmentId[] {
 return (Object.keys(EQUIPMENT) as EquipmentId[]).filter(id => id === 'shinai' ? run.gear.shinai && run.shinaiQuest !== 'returned' : id === 'ownShinai' ? run.madeShinai : equipmentInfo(id).price !== undefined ? run.owned.includes(id) : run.gear[id as Exclude<EquipmentSlot,'shinai'>]);
}
export function equippedAt(run: RunState, slot: EquipmentSlot): EquipmentId | null {
 if (!run.gear[slot]) return null;
 const held = equipmentHeld(run).filter(id => equipmentInfo(id).slot === slot);
 const chosen = slot === 'shinai' ? run.wielded || run.equipped?.shinai : run.equipped?.[slot];
 if (chosen && held.includes(chosen as EquipmentId)) return chosen as EquipmentId;
 // Old saves had passive bonuses for these purchases. Prefer them until the player chooses.
 const legacy: Partial<Record<EquipmentSlot,EquipmentId>> = { shinai: run.madeShinai ? 'ownShinai' : 'fineShinai', kote: 'deerKote', do: 'lacquerDo' };
 return held.find(id => id === legacy[slot]) ?? held[0] ?? null;
}
export function equip(run: RunState, id: EquipmentId): RunState {
 const slot = equipmentInfo(id).slot;
 if (!run.gear[slot] || !equipmentHeld(run).includes(id)) return run;
 return { ...run, equipped: { ...run.equipped, [slot]: id }, ...(slot === 'shinai' ? { wielded: id } : {}) };
}
export const modOn = (run: RunState, id: EquipmentId): ModId | null => run.mods?.[id] ?? equipmentInfo(id).premod ?? null;
export const canModify = (run: RunState, id: EquipmentId, mod: ModId): boolean => equipmentHeld(run).includes(id) && MODS[mod].slots.includes(equipmentInfo(id).slot) && modOn(run,id) !== mod && run.money >= MODS[mod].price;
export function modify(run: RunState, id: EquipmentId, mod: ModId): RunState {
 if (!canModify(run,id,mod)) return run;
 return { ...run, money: run.money - MODS[mod].price, mods: { ...run.mods, [id]: mod } };
}
export function equipmentKi(run: RunState): number {
 return EQUIPMENT_SLOTS.reduce((sum,slot) => { const id = equippedAt(run,slot); if (!id) return sum; const mod = modOn(run,id); return sum + equipmentInfo(id).ki + (mod ? MODS[mod].ki : 0); },0);
}
export const equipmentWear = (run: RunState, id: EquipmentId, amount: number): number => {
 const mod = modOn(run,id);
 return Math.max(0, amount - equipmentInfo(id).wearReduction - (mod ? MODS[mod].wearReduction : 0));
};
export function equipmentDescription(run: RunState, id: EquipmentId): string {
 const item = equipmentInfo(id), mod = modOn(run,id);
 return `Ki +${item.ki + (mod ? MODS[mod].ki : 0)}. Wear -${item.wearReduction + (mod ? MODS[mod].wearReduction : 0)} per fight. ${mod ? `Mod: ${MODS[mod].name}.` : 'No mod fitted.'}`;
}
