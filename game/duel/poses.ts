import type { DuelPose } from "../art/duel-sprites.ts";
import { BOW_TICKS, CLOSING_TICKS } from "./constants.ts";
import type { DuelState, Fighter, Target } from "./rules.ts";

const STRIKE_POSE: Record<Target, DuelPose> = { men: "strikeMen", kote: "strikeKote", do: "strikeDo" };
const HIKI_POSE: Record<Target, DuelPose> = { men: "hikiMen", kote: "hikiKote", do: "hikiDo" };
const TSUBA_POSE = { hold: "tsuba", push: "tsubaPush", guard: "tsubaGuard", pull: "tsubaPull" } as const;
export type TsubaAction = keyof typeof TSUBA_POSE;

/** How a line-drill partner offers each target. Each matches the duel tell that leaves that target open. */
export const OPENING_POSE: Record<Target, DuelPose> = { men: "tellTipDip", kote: "tellHandsUp", do: "tellBigRaise" };

const STEP_DISTANCE = 18;

/**
 * The opening of a match: bow with the shinai held in the left hand, bring it to the hip, take
 * three steps in, draw while settling into sonkyo, then rise into guard.
 */
export function ceremonyAt(ticksLeft: number): { pose: DuelPose; stepBack: number } {
  const elapsed = BOW_TICKS - ticksLeft;
  const stepBack = elapsed < 44 ? STEP_DISTANCE : Math.max(0, Math.ceil(STEP_DISTANCE * (1 - (elapsed - 44) / 40)));
  if (elapsed < 10) return { pose: "sageto", stepBack };
  if (elapsed < 34) return { pose: "bow", stepBack };
  if (elapsed < 44) return { pose: "sageto", stepBack };
  if (elapsed < 66) return { pose: "taito", stepBack };
  if (elapsed < 84) return { pose: "draw", stepBack };
  if (elapsed < 124) return { pose: "sonkyo", stepBack: 0 };
  return { pose: "guard", stepBack: 0 };
}

const CLOSING_STEPS_START = 66;
const CLOSING_STEPS_END = 104;
const CLOSING_LEAVE = 154;
/** How fast someone walks off once they've bowed. */
export const WALK_OFF_SPEED = 1.1;

/**
 * The end of a match, at the starting lines: into sonkyo, sheathe while still down, rise, five small
 * steps back with the shinai at the hip, lower it, bow, and walk away.
 */
export function closingAt(ticksLeft: number): { pose: DuelPose; stepBack: number; walking: boolean; away: boolean } {
  const elapsed = CLOSING_TICKS - ticksLeft;
  const stepping = elapsed >= CLOSING_STEPS_START && elapsed < CLOSING_STEPS_END;
  const stepBack = Math.min(STEP_DISTANCE, Math.max(0, Math.ceil((STEP_DISTANCE * (elapsed - CLOSING_STEPS_START)) / (CLOSING_STEPS_END - CLOSING_STEPS_START))));
  const still = { stepBack, walking: false, away: false };
  if (elapsed < 12) return { ...still, pose: "guard" };
  if (elapsed < 32) return { ...still, pose: "sonkyo" };
  if (elapsed < 58) return { ...still, pose: "sonkyoSheathe" };
  if (elapsed < CLOSING_STEPS_END) return { ...still, pose: "taito", walking: stepping };
  if (elapsed < 114) return { ...still, pose: "sageto" };
  if (elapsed < 142) return { ...still, pose: "bow" };
  if (elapsed < CLOSING_LEAVE) return { ...still, pose: "sageto" };
  return { pose: "sageto", stepBack: STEP_DISTANCE + (elapsed - CLOSING_LEAVE) * WALK_OFF_SPEED, walking: true, away: true };
}

/** Maps the rules' state to what the player sees. A tell here must match what the attack really exposes. */
export function poseFor(
  fighter: Pick<Fighter, "stance" | "attack" | "launchTicks">,
  view: {
    phase: DuelState["phase"];
    striking: Target | null;
    scored: boolean;
    bowTicksLeft?: number;
    closingTicksLeft?: number;
    /** On the way back to the line after a point. */
    walkingHome?: boolean;
    /** The strike showing is pulled back out of a lock. */
    hiki?: boolean;
    /** What they're doing in the lock. */
    tsuba?: TsubaAction;
    /** Something that's just happened to them, which shows for a moment over everything but a strike. */
    reaction?: DuelPose | null;
  },
): DuelPose {
  if (view.phase === "bow" && view.bowTicksLeft !== undefined) return ceremonyAt(view.bowTicksLeft).pose;
  if (view.phase === "bow") return "bow";
  if (view.phase === "closing" && view.closingTicksLeft !== undefined) return closingAt(view.closingTicksLeft).pose;
  if (view.phase === "over") return "sageto";
  if (view.striking) return (view.hiki ? HIKI_POSE : STRIKE_POSE)[view.striking];
  if (view.reaction) return view.reaction;
  if (view.phase === "point") return view.walkingHome ? "walkHome" : "guard";
  if (view.phase === "wakare" || view.phase === "turning") return "guard";
  if (view.phase === "crossing") return "zanshin";
  if (view.phase === "zanshin") return view.scored ? "zanshin" : "guard";
  switch (fighter.stance) {
    case "parry":
      return "parry";
    case "deflected":
      return "deflected";
    case "stumble":
      return "stumble";
    case "tsuba":
      return TSUBA_POSE[view.tsuba ?? "hold"];
    case "block":
      return "block";
    case "recovery":
      return "recover";
    case "broken":
    case "shaken":
      return "stunned";
    case "seme":
      return "seme";
    case "windup":
      if (fighter.attack === "kote" || fighter.attack === "do") return "tellTipDip";
      if (fighter.attack === "bigMen") return "tellBigRaise";
      return "tellHandsUp";
    default:
      return fighter.launchTicks > 0 ? "launch" : "guard";
  }
}
