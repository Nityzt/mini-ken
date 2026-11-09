import { isCharacter, playerColors, type CharacterId } from "../characters.ts";
import { DEFAULT_INSIGNIA, isInsignia, type Insignia } from "../insignia.ts";

/** Known palette names only: network messages never carry arbitrary canvas colors. */
export const ONLINE_ARMOR = ["pine", "own", "ink", "raccoon", "goose", "heron", "otter", "radish"] as const;
export type OnlineArmor = (typeof ONLINE_ARMOR)[number];
export type Appearance = { character: CharacterId; armor: OnlineArmor; insignia: Insignia };
export const DEFAULT_APPEARANCE: Appearance = { character: "haru", armor: "pine", insignia: DEFAULT_INSIGNIA };

export function isAppearance(value: unknown): value is Appearance {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return isCharacter(candidate.character) && (ONLINE_ARMOR as readonly unknown[]).includes(candidate.armor) && isInsignia(candidate.insignia);
}

const LOOK: Record<OnlineArmor, string> = {
  pine: "", own: "ownColors", ink: "inkColors", raccoon: "raccoonColors", goose: "gooseColors", heron: "heronColors", otter: "otterColors", radish: "radishColors",
};
export const onlineArmorForStory = (look: string): OnlineArmor => ONLINE_ARMOR.find((armor) => LOOK[armor] === look) ?? "pine";
export const appearanceColors = (appearance: Appearance): Record<string, string> => playerColors({ ...appearance, gi: true, look: LOOK[appearance.armor] });
export type OnlineRank = "bronze" | "silver" | "gold";
export type OnlineRecord = { wins: number; losses: number };
export function rankForRecord({ wins, losses }: OnlineRecord): OnlineRank {
  const played = wins + losses;
  if (played >= 10 && wins / played >= 0.65) return "gold";
  if (played >= 5 && wins / played >= 0.5) return "silver";
  return "bronze";
}
const REQUIRED: Record<OnlineArmor, number> = { pine: 0, own: 0, ink: 0, raccoon: 0, goose: 0, heron: 1, otter: 1, radish: 2 };
const RANK_LEVEL: Record<OnlineRank, number> = { bronze: 0, silver: 1, gold: 2 };
export const canWearOnline = (armor: OnlineArmor, record: OnlineRecord): boolean => RANK_LEVEL[rankForRecord(record)] >= REQUIRED[armor];
export const allowedAppearance = (appearance: Appearance, record: OnlineRecord): Appearance => canWearOnline(appearance.armor, record) ? appearance : { ...appearance, armor: "pine" };
type AppearanceStore = Pick<Storage, "getItem" | "setItem">;
const accountAppearanceKey = (accountId: string) => `tiny-kendo-appearance:${accountId}`;
export function readAccountAppearance(store: AppearanceStore | null, accountId: string): Appearance | null {
  try {
    const text = store?.getItem(accountAppearanceKey(accountId));
    const saved: unknown = text ? JSON.parse(text) : null;
    return isAppearance(saved) ? saved : null;
  } catch { return null; }
}
export function writeAccountAppearance(store: AppearanceStore | null, accountId: string, appearance: Appearance): void {
  try { store?.setItem(accountAppearanceKey(accountId), JSON.stringify(appearance)); } catch { /* Storage may be unavailable. */ }
}
