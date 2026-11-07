import type { DuelState, Kamae } from "./rules.ts";

/** One specific thing to try next, based on what just scored against the player. */
export function tipFor(lastScore: NonNullable<DuelState["lastScore"]>, knowsSeme = false, kamae: Kamae = "chudan"): string {
  if (lastScore.defenderStance === "recovery") return "That miss left you open. Wait for an opening.";
  if (lastScore.defenderStance === "broken") return "Blocking costs ki. Too much and your guard breaks.";
  if (lastScore.defenderStance === "shaken") return knowsSeme ? "You flinched under the pressure. Hold I to push back." : "You flinched, and that left you wide open.";
  if (lastScore.defenderStance === "deflected") return "They parried that. Don't swing from where they're waiting for it.";
  if (lastScore.defenderStance === "stumble") return "Off balance, you're wide open. In a lock, hold S if their hands drop.";
  if (lastScore.defenderStance === "seme") return "Your aura leaves you wide open. Watch for the tell and let go.";
  if (lastScore.defenderStance === "opening") return "They went for what you were showing. Be ready to parry it, or let it drop.";
  if (kamae === "jodan") return "Jodan reaches further, so step inside it. Whatever they show before striking is open: kote or do.";
  if (kamae === "nito") return "Two swords cover the men. When the long one rises for any strike, hit do.";
  if (lastScore.attack === "bigMen") return "Hands raised high means the do is open. Hit it before the swing lands.";
  return "Plain guard leaves everything open. Block, or hit what they show: raised is do, wrist is kote, tip down is men.";
}
