import type { DuelState, Kamae } from "./rules.ts";

/** One specific thing to try next, based on what just scored against the player. */
export function tipFor(lastScore: NonNullable<DuelState["lastScore"]>, knowsSeme = false, kamae: Kamae = "chudan"): string {
  if (lastScore.defenderStance === "recovery") return "That miss left you open. Wait for an opening.";
  if (lastScore.defenderStance === "broken") return "Blocking costs ki. Too much and your guard breaks.";
  if (lastScore.defenderStance === "shaken") return knowsSeme ? "You flinched under the pressure. Hold I to push back." : "You flinched, and that left you wide open.";
  if (lastScore.defenderStance === "deflected") return "They parried that. Don't swing from where they're waiting for it.";
  if (lastScore.defenderStance === "stumble") return "Off balance, you're wide open. In a lock, hold S if their hands drop.";
  if (lastScore.defenderStance === "seme") return "Your aura leaves you wide open. Watch for the tell and let go.";
  if (kamae === "jodan") return lastScore.attack === "kote" ? "Jodan reaches further. When their tip falls, their do is open." : "Jodan reaches further, so step inside it. When their hands pull back, hit kote.";
  if (kamae === "nito") return "Two swords cover the men. When the long one rises for any strike, hit do.";
  if (lastScore.attack === "kote") return "Their shinai tip dips before a kote. Their men is open.";
  if (lastScore.attack === "bigMen") return "When they raise their hands high, their do is open.";
  return "Their hands rise before they strike. Try kote.";
}
