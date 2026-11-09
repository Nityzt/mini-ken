import type { EquipmentSlot } from '../equipment.ts';

const cached = new WeakMap<Record<string,string>, Partial<Record<EquipmentSlot,Record<string,string>>>>();
/** Each piece has its own palette even when its sprite uses the same channels as other armor. */
export function paletteForGear(colors: Record<string,string> | undefined, slot: EquipmentSlot): Record<string,string> | undefined {
 if (!colors) return colors;
 const prefix = `${slot}:`;
 const overrides = Object.entries(colors).filter(([key]) => key.startsWith(prefix));
 if (!overrides.length) return colors;
 let palettes = cached.get(colors);
 if (!palettes) { palettes = {}; cached.set(colors,palettes); }
 return palettes[slot] ??= { ...colors, ...Object.fromEntries(overrides.map(([key,value]) => [key.slice(prefix.length),value])) };
}
