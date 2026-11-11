import { NO_GEAR, type Gear } from './art/kendoka.ts';
import { parseDungeonState, FINAL_ROOM, type DungeonState } from './dungeon.ts';
import { isOpen } from './progress.ts';
import type { RunState } from './run-state.ts';
import { OBJECTIVES, RAIKO_DOUBTS, RAIKO_REFUSES, RAIKO_REFUSES_AGAIN } from './scenes/content.ts';

/**
 * Once you're good enough to beat Ren, Ren goes missing, and the only way to find out where is to beat Sensei
 * Raiko, who has his doubts and a key to the door below (owner, 2026-11-11). `discovered` means you hold that key.
 */
export type DungeonStage = 'locked' | 'discovered' | 'caught' | 'active' | 'escaped';
export const ESCROW_FIELDS = ['gear', 'owned', 'equipped', 'mods', 'wielded', 'durability', 'look', 'menOn', 'gi', 'madeShinai', 'shinaiQuest', 'hp'] as const;
export type DungeonEscrow = Pick<RunState, typeof ESCROW_FIELDS[number]>;
export type DungeonTrial = { stage: DungeonStage; progress: DungeonState | null; escrow: DungeonEscrow | null };
export const createDungeonTrial = (): DungeonTrial => ({ stage: 'locked', progress: null, escrow: null });
export const dungeonStage = (run: RunState): DungeonStage => run.dungeon.stage;

/** The low door on Thunder Radish's north wall, which Raiko's key opens. */
export const IRON_DOOR = 'I';
/** You've walked in on Ren's empty spot, or looked at what Ren left there. */
export const REN_MISSING_SEEN = 'ren-missing';
/** You've asked Raiko where Ren is, and heard his price. */
export const RAIKO_ASKED = 'raiko-asked-ren';

const markSeen = (run: RunState, id: string): RunState => (run.seen.includes(id) ? run : { ...run, seen: [...run.seen, id] });

/**
 * Ren isn't on the floor at Thunder Radish once you qualify for them, until you've beaten them. A save that did
 * the trial under the old rules, before Ren hid, finds Ren back in the usual spot.
 */
export const renMissing = (run: RunState): boolean => isOpen(run, 'radish') && !run.beaten.includes('radish') && dungeonStage(run) !== 'escaped';
/** Only someone who qualifies for Ren gets anywhere asking Raiko, and only until he's handed over the key. */
export const raikoOffersRen = (run: RunState): boolean => run.node === 'radish' && isOpen(run, 'radish') && dungeonStage(run) === 'locked';
/** The key's yours from Raiko's word until Ren takes everything you've got, and it comes back with the rest. */
export const hasDungeonKey = (run: RunState): boolean => ['discovered', 'caught', 'escaped'].includes(dungeonStage(run));

/** Asking Raiko about Ren. He'll only tell someone who's beaten him. */
export function askRaikoAboutRen(run: RunState): { run: RunState; lines: string[]; fight: boolean } {
 const asked = markSeen(run, RAIKO_ASKED);
 if (run.beaten.includes('raiko')) return { run: discoverDungeon(asked), lines: RAIKO_DOUBTS, fight: false };
 return { run: asked, lines: run.seen.includes(RAIKO_ASKED) ? RAIKO_REFUSES_AGAIN : RAIKO_REFUSES, fight: true };
}
/** Beaten, having been asked, Raiko keeps his word. Called with the win already recorded. */
export function raikoKeepsHisWord(run: RunState): { run: RunState; lines: string[] } | null {
 if (!raikoOffersRen(run) || !run.seen.includes(RAIKO_ASKED)) return null;
 return { run: discoverDungeon(run), lines: RAIKO_DOUBTS };
}

/** What the objective line says while you're looking for Ren and before Raiko has told you anything. */
export function renHuntObjective(run: RunState): string | null {
 if (!renMissing(run) || dungeonStage(run) !== 'locked') return null;
 if (!run.seen.includes(REN_MISSING_SEEN)) return OBJECTIVES.findRen;
 return run.seen.includes(RAIKO_ASKED) ? OBJECTIVES.beatRaiko : OBJECTIVES.askRaiko;
}

export const canDiscoverDungeon = (run: RunState): boolean => run.node === 'radish' && run.beaten.includes('raiko') && dungeonStage(run) === 'locked';
export const canEnterDungeon = (run: RunState, tile: string): boolean => run.node === 'radish' && run.dungeon.stage === 'discovered' && tile === IRON_DOOR;
export const renBeatenBelow = (run: RunState): boolean => run.dungeon.progress?.renBeaten === true;
export function dungeonObjective(run: RunState): string | null {
 if (run.dungeon.stage === 'discovered') return OBJECTIVES.ironDoor;
 if (run.dungeon.stage === 'caught') return OBJECTIVES.passage;
 if (run.dungeon.stage === 'active') {
  const progress = run.dungeon.progress;
  if (progress?.room !== FINAL_ROOM) return OBJECTIVES.scavenge;
  return !progress.renBeaten ? OBJECTIVES.faceRen : progress.recovered ? null : OBJECTIVES.takeGear;
 }
 return null;
}
/** Raiko's key changes hands. */
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

/** The final duel is fought in the trial: the duel scene asks this to know where it is. */
export const duelBelow = (run: RunState): boolean => dungeonStage(run) === 'active';
/** The duel itself records the win as it would anywhere. This is the trial remembering it happened down here. */
export function winRenBelow(run: RunState): RunState {
 const progress = run.dungeon.progress;
 if (!duelBelow(run) || !progress) return run;
 return { ...run, dungeon: { ...run.dungeon, progress: { ...progress, renBeaten: true } } };
}
/**
 * Who you are in the duel below: your own ki, the same as on any dojo floor, since Ren's duel is tuned for it.
 * What you're wearing is what you scavenged.
 */
export function fighterBelow(run: RunState): RunState {
 if (!duelBelow(run) || !run.dungeon.escrow) return run;
 return { ...run, ...run.dungeon.escrow };
}
export function scavengedGear(run: RunState): Gear {
 const pieces = run.dungeon.progress?.pieces ?? [];
 return { ...NO_GEAR, shinai: true, do: pieces.includes('do'), tare: pieces.includes('do'), kote: pieces.includes('kote') };
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
