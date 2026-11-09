import { equipmentHeld, equipmentInfo, isEquipment, isMod, MODS, EQUIPMENT_SLOTS } from "./equipment.ts";
import { cleanPlayerName, isCharacter } from "./characters.ts";
import type { SceneName } from "./core/scene.ts";
import { isInsignia } from "./insignia.ts";
import { impliedDan } from "./ranks.ts";
import { createRunState, type RunState } from "./run-state.ts";
import { NODES } from "./world/map.ts";
import { CUP_IDS } from "./world/tournament.ts";

export const SAVE_KEY = "tiny-kendo-save";
const SAVE_VERSION = 1;

export type SaveStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isStringList = (value: unknown): boolean => Array.isArray(value) && value.every((item) => typeof item === "string");

/** Rebuilds a run from saved data, or returns null if any of it can't be trusted. Missing fields keep their starting values. */
export function parseRun(raw: unknown): RunState | null {
  if (!isRecord(raw)) return null;
  const run = createRunState();
  const out: Record<string, unknown> = { ...run };
  for (const key of Object.keys(run) as (keyof RunState)[]) {
    const value = raw[key];
    if (value === undefined) continue;
    const start = run[key];
    if (key === "node") {
      if (typeof value !== "string" || !Object.hasOwn(NODES, value)) return null;
    } else if (key === "character") {
      if (!isCharacter(value)) return null;
    } else if (key === "name") {
      if (typeof value !== "string") return null;
      out.name = cleanPlayerName(value);
      continue;
    } else if (key === "insignia") {
      if (!isInsignia(value)) return null;
    } else if (key === "cups") {
      if (!Array.isArray(value) || !value.every((cup) => CUP_IDS.includes(cup))) return null;
    } else if (key === "gear") {
      if (!isRecord(value)) return null;
      const gear: Record<string, boolean> = { ...run.gear };
      for (const piece of Object.keys(run.gear)) {
        if (value[piece] === undefined) continue;
        if (typeof value[piece] !== "boolean") return null;
        gear[piece] = value[piece] as boolean;
      }
      out.gear = gear;
      continue;
    } else if (key === "equipped" || key === "mods") {
      if (!isRecord(value) || !Object.values(value).every(v => typeof v === "string")) return null;
    } else if (key === "hp") {
      if (!isCount(value)) return null;
      out.hp = Math.min(value, run.hp);
      continue;
    } else if (key === "losses" || key === "held" || key === "talked" || key === "durability") {
      if (!isRecord(value) || !Object.values(value).every(isCount)) return null;
    } else if (Array.isArray(start)) {
      if (!isStringList(value)) return null;
    } else if (typeof start === "number") {
      if (!isCount(value)) return null;
    } else if (typeof value !== typeof start) {
      return null;
    }
    out[key] = value;
  }
  const parsed = out as RunState;
  if (parsed.shinaiQuest === "returned" && parsed.equipped.shinai === "shinai") {
    parsed.equipped = { ...parsed.equipped };
    delete parsed.equipped.shinai;
  }
  const held = equipmentHeld(parsed);
  for (const [slot,id] of Object.entries(parsed.equipped)) {
    if (!EQUIPMENT_SLOTS.includes(slot as typeof EQUIPMENT_SLOTS[number]) || !isEquipment(id) || equipmentInfo(id).slot !== slot || !held.includes(id)) return null;
  }
  for (const [id,mod] of Object.entries(parsed.mods)) {
    if (!isEquipment(id) || !isMod(mod) || (!held.includes(id) && !(id === "shinai" && parsed.shinaiQuest === "returned" && parsed.gear.shinai)) || !MODS[mod].slots.includes(equipmentInfo(id).slot)) return null;
  }
  // Saved before gradings existed, so nobody's locked out of what they'd already reached.
  return raw.dan === undefined ? { ...parsed, dan: impliedDan(parsed) } : parsed;
}

/** Storage can be missing, blocked or full. None of that should ever stop the game. */
export function readSave(store: SaveStore | null): RunState | null {
  try {
    const text = store?.getItem(SAVE_KEY);
    if (!text) return null;
    const saved: unknown = JSON.parse(text);
    if (!isRecord(saved) || saved.version !== SAVE_VERSION) return null;
    return parseRun(saved.run);
  } catch {
    return null;
  }
}

export function writeSave(store: SaveStore | null, run: RunState): void {
  try {
    store?.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, run }));
  } catch {
    // The game carries on unsaved.
  }
}

export function clearSave(store: SaveStore | null): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    // Nothing more can be done.
  }
}

/** Fights aren't saved partway through. You pick up from wherever you'd walked to. */
export const resumeScene = (run: RunState): SceneName => (run.node === "pinecone" ? "club" : "map");
