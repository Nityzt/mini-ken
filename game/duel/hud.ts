import type { OpponentId } from "../world/dojos.ts";
import { COUNTER_TICKS } from "./constants.ts";
import { exposes, type AttackKind, type DuelState, type Kamae, type Target } from "./rules.ts";

const BAR_PER_KI = 60 / 100;
/** Past this, a bar stops growing and just reads as a fraction. Two of them still fit across the screen. */
export const KI_BAR_LIMIT = 100;

export const kiBarWidth = (kiMax: number): number => Math.min(KI_BAR_LIMIT, Math.round(kiMax * BAR_PER_KI));
export const kiBarFill = (ki: number, kiMax: number): number => Math.round((kiBarWidth(kiMax) * ki) / kiMax);

const KEY_FOR: Record<Target, string> = { men: "J", kote: "K", do: "L" };
/** The key that hits this target, and its name. */
export const targetPrompt = (target: Target): string => `${KEY_FOR[target]} ${target}`;
/** What to press against an attack that's winding up: whatever it leaves open. */
export const counterPrompt = (attack: AttackKind, kamae: Kamae = "chudan"): string => targetPrompt(exposes(attack, kamae));

export type StatusKind = "open" | "wideOpen" | "stunned" | "stumbling" | "parrying" | "counter" | "push" | "hold" | "pull";
/** What state someone's in, and how much of it is left where that matters, or null if there's nothing to say. Only what can be seen in their pose anyway, so it gives nothing away. */
export function fighterStatus(duel: Pick<DuelState, "phase" | "fighters" | "lock">, i: 0 | 1): { kind: StatusKind; ticks?: number; total?: number } | null {
  if (duel.phase !== "fight") return null;
  const f = duel.fighters[i];
  if (duel.lock) {
    const pull = duel.lock.pulling[i];
    if (pull) return { kind: "pull", ticks: pull.ticks, total: pull.total };
    return duel.lock.pushing[i] ? { kind: "push" } : duel.lock.guarding[i] ? { kind: "hold" } : null;
  }
  switch (f.stance) {
    case "recovery":
      return { kind: "open", ticks: f.stanceTicks };
    case "deflected":
      return { kind: "wideOpen", ticks: f.stanceTicks };
    case "broken":
    case "shaken":
      return { kind: "stunned", ticks: f.stanceTicks };
    case "stumble":
      return { kind: "stumbling", ticks: f.stanceTicks };
    case "parry":
      return { kind: "parrying", ticks: f.stanceTicks };
    default:
      return f.counterTicks > 0 ? { kind: "counter", ticks: f.counterTicks, total: COUNTER_TICKS } : null;
  }
}

const REPEAT_LOSSES = 2;

/**
 * Whether a match shows which key answers each tell. Your senpai and the first rival always do.
 * Later rivals only do once they've beaten you a couple of times, and the hardest fights never do.
 * Ren is the exception: once you know the far-mountain gaze, you can see what Ren's about to do.
 */
export function promptsShown(opponent: OpponentId, losses: number, tournament: boolean, gaze = false): boolean {
  if (tournament || opponent === "momo" || opponent === "renVisit") return false;
  if (opponent === "radish") return gaze;
  if (opponent === "aki" || opponent === "bo" || opponent === "yui" || opponent === "raccoon") return true;
  return losses >= REPEAT_LOSSES;
}
