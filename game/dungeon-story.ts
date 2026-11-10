import { NO_GEAR } from './art/kendoka.ts';
import { parseDungeonState, type DungeonState } from './dungeon.ts';
import type { RunState } from './run-state.ts';

export type DungeonStage = 'locked' | 'discovered' | 'caught' | 'active' | 'escaped';
export const ESCROW_FIELDS = ['gear', 'owned', 'equipped', 'mods', 'wielded', 'durability', 'look', 'menOn', 'gi', 'madeShinai', 'shinaiQuest', 'hp'] as const;
export type DungeonEscrow = Pick<RunState, typeof ESCROW_FIELDS[number]>;
export type DungeonTrial = { stage: DungeonStage; progress: DungeonState | null; escrow: DungeonEscrow | null };
export const createDungeonTrial = (): DungeonTrial => ({ stage: 'locked', progress: null, escrow: null });
export const dungeonStage = (run: RunState): DungeonStage => run.dungeon.stage;
export const canDiscoverDungeon = (run: RunState): boolean => run.node === 'radish' && run.beaten.includes('raiko') && dungeonStage(run) === 'locked';
export const canEnterDungeon = (run: RunState, tile: string): boolean => run.node === 'radish' && run.dungeon.stage === 'discovered' && tile === 'r';
export function dungeonObjective(run: RunState): string | null {
 if (run.dungeon.stage === 'discovered') return 'Radish Dojo: inspect the north rack';
 if (run.dungeon.stage === 'caught') return 'Explore the hidden passage';
 if (run.dungeon.stage === 'active') return 'Scavenge gear and escape';
 return null;
}
export function discoverDungeon(run: RunState): RunState {
 return canDiscoverDungeon(run) ? { ...run, dungeon: { ...run.dungeon, stage: 'discovered' } } : run;
}
export function enterDungeon(run: RunState): RunState {
 return run.node === 'radish' && dungeonStage(run) === 'discovered' ? { ...run, dungeon: { stage: 'caught', progress: null, escrow: null } } : run;
}
export function captureDungeon(run: RunState): RunState {
 if (dungeonStage(run) !== 'caught') return run;
 const escrow = Object.fromEntries(ESCROW_FIELDS.map(key => [key, structuredClone(run[key])])) as DungeonEscrow;
 return { ...run, gear: { ...NO_GEAR }, owned: [], equipped: {}, mods: {}, wielded: '', durability: {}, look: '', menOn: false, madeShinai: false, shinaiQuest: '', dungeon: { stage: 'active', progress: null, escrow } };
}
export function saveDungeonProgress(run: RunState, state: DungeonState): RunState {
 return dungeonStage(run) === 'active' ? { ...run, dungeon: { ...run.dungeon, progress: state } } : run;
}
function restore(run: RunState, stage: 'escaped' | 'discovered'): RunState {
 return { ...run, ...(run.dungeon.escrow ? structuredClone(run.dungeon.escrow) : {}), node: 'radish', dungeon: { stage, progress: null, escrow: null } };
}
export function finishDungeon(run: RunState): RunState {
 if (dungeonStage(run) !== 'active' || !run.dungeon.escrow || run.dungeon.progress?.phase !== 'escaped') return run;
 return { ...restore(run, 'escaped'), xp: run.xp + 120, money: run.money + 100 };
}
export function abandonDungeon(run: RunState): RunState {
 return dungeonStage(run) === 'active' || dungeonStage(run) === 'caught' ? restore(run, 'discovered') : run;
}

/** The caller validates escrow through the ordinary run parser with dungeon reset to locked. */
export function parseDungeonTrial(raw: unknown, validateEscrow: (value: Record<string, unknown>) => boolean): DungeonTrial | null {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
 const value = raw as Record<string, unknown>;
 if (!['locked', 'discovered', 'caught', 'active', 'escaped'].includes(value.stage as string)) return null;
 const stage = value.stage as DungeonStage;
 let escrow: DungeonEscrow | null = null;
 if (value.escrow !== null) {
  if (!value.escrow || typeof value.escrow !== 'object' || Array.isArray(value.escrow)) return null;
  const saved = value.escrow as Record<string, unknown>;
  if (!ESCROW_FIELDS.every(key => Object.hasOwn(saved, key)) || Object.keys(saved).some(key => !(ESCROW_FIELDS as readonly string[]).includes(key)) || !validateEscrow(saved)) return null;
  escrow = saved as DungeonEscrow;
 }
 if ((stage === 'active') !== (escrow !== null)) return null;
 let progress: DungeonState | null = null;
 if (value.progress !== null) {
  if (stage !== 'active') return null;
  // Progress from an older trial, or one that can't be trusted, only costs the trial: it starts again from
  // the cell, and the escrowed equipment and the rest of the story are kept.
  progress = parseDungeonState(value.progress);
 }
 return { stage, progress, escrow };
}
