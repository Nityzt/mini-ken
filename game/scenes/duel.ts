import { keyLabel, teachingKeys } from "../core/key-labels.ts";
import { wearFrom } from "../durability.ts";
import { gearName } from "../items.ts";
import { playerColors, playerName } from "../characters.ts";
import { CUPS } from "../world/tournament.ts";
import { drawAuraBack, drawAuraFront } from "../art/aura.ts";
import { drawFx, drawGroundStrip, drawGuardPlate, drawStatusBar, FX_BEHIND, FX_LIFE, SPIRIT, type Fx, type FxKind } from "../art/duel-fx.ts";
import { drawDuelBackdrop, FLOOR_Y, type Crest } from "../art/backdrops.ts";
import { drawShinpan, drawWatchers } from "../art/courtside-art.ts";
import { drawFighter, drawShine, drawSwingTrail, shinaiTip, type DuelPose } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import type { Gear } from "../art/kendoka.ts";
import type { Insignia } from "../insignia.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { drawHpBar, drawTag } from "./ui.ts";
import type { GameAudio } from "../core/audio.ts";
import type { Input } from "../core/input.ts";
import { guiPoint, onGui, onStage, STAGE_H, STAGE_W, stageX, stageY, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { FLAG_AFTER_HIT, KI_LOW, POINTS_TO_WIN, RANGE_MAX, RANGE_MIN, SEME_TICKS, TSUBA_BREAK } from "../duel/constants.ts";
import { createDashDetector, legsFor } from "../duel/footwork.ts";
import { clockLabel, fighterStatus, kiBarFill, kiBarWidth, promptsShown, targetPrompt, type StatusKind } from "../duel/hud.ts";
import { ceremonyAt, closingAt, parryShine, poseFor, WALK_OFF_SPEED, windupCoil, type TsubaAction } from "../duel/poses.ts";
import { createRival, moodOf, rivalAct, withMood, type RivalState } from "../duel/rival.ts";
import { ATTACKS, createDuel, distance, exposedTargets, faceDir, presencePressing, screenX, skipBow, skipClosing, startX, step, type AttackKind, type DuelEvent, type DuelState, type Fighter, type FighterInput, type Opening, type Target } from "../duel/rules.ts";
import { tipFor } from "../duel/tips.ts";
import { gradingOutcome, recommendationOutcome, saidBy, verificationOutcome, type GradingStage } from "../grading.ts";
import { payBet, withFeat } from "../money.ts";
import { danLabel, personDan, rankLabel } from "../ranks.ts";
import { duelOptionsFor, lossesHere, recordCupMatch, recordLoss, recordWin, rivalConfigFor } from "../run-state.ts";
import { duelBelow, fighterBelow, scavengedGear, winRenBelow } from "../dungeon-story.ts";
import { courtside } from "../world/courtside.ts";
import { DOJOS, opponentById, opponentIdFor, type DojoId, type OpponentId } from "../world/dojos.ts";
import { hpAfterMatch, HP_PER_POINT, matchHurts, reclaim, whoHolds } from "../health.ts";
import { afterWinLines } from "./chatter.ts";
import { goDown } from "./knockout.ts";
import { createTeachCards } from "./teach-card.ts";
import { duelMoments, momentCard, teachOnce, tipCard, wasTaught } from "./teaching.ts";
import { recordMatch } from "../world/tournament.ts";
import { challengerHome, challengerWin, isChallenger } from "./challengers.ts";
import { sparLeft, sparOutcome } from "./club-story.ts";
import { renPointOutcome } from "./visits.ts";
import type { SenpaiId } from "./curriculum.ts";
import { betHud, betLost, betWon, CALL_ENCHO, CALL_HAJIME, CALL_NIHONME, CALL_SHOBU, CALL_TIME, CALL_WAKARE, NEEDS_OPENING, STATUS_SHOWS_DO, STATUS_SHOWS_KOTE, STATUS_SHOWS_MEN, CHALLENGER_WALKED, CLOSING_LINE, CROSSED, LOCK_CALL, PARRIED, SHOVED, TSUBA_LABEL, FLINCH, FORFEIT_MATCH, GOT_YOU, GRADING_BOW, GRADING_WALKED, moodLine, RECOMMEND_BOW, RECOMMEND_WALKED, VERIFY_BOW, VERIFY_WALKED, KIAI_SHOUT, TAIKAI_LOST, MOMO_BEATEN, MOMO_CRUSHED, MOMO_KEEP_TRYING, MOMO_LOSE_NO_SEME, MOMO_LOSE_SEME, NO_STOMP, NO_ZANSHIN, REN_BOW_GAZE, REN_LATER, REN_POINT_NEXT, REN_POINT_TIP, SENPAI_LINES, STATUS_COUNTER, STATUS_HOLD, STATUS_OPEN, STATUS_PARRYING, STATUS_PULL, STATUS_PUSH, STATUS_STUMBLING, STATUS_STUNNED, STATUS_WIDE_OPEN, STOPPED_SHORT, ZANSHIN_PROMPT, CANT_GO_ON, HP_LABEL, hpLost, reclaimed, wornOutLine } from "./content.ts";

const GROUND = 128;
// The arms are only fully out for a moment before they go back up, but it's long enough to see which cut it was.
const STRIKE_POSE_TICKS = 20;
// In frames, and the rules can be holding still for longer than the old window, so this has to outlast the longest freeze.
const ATTACK_BUFFER_TICKS = 18;
const FLOATER_TICKS = 60;
/** Only the newest few words stay up, so an old exchange's words are never lying over the next one's. */
const FLOATERS_SHOWN = 3;
const FLOATER_ROW = 10;
/** Words start above where a fighter's status goes, so neither covers the other. */
const FLOATER_OVER_GROUND = 62;
/** How many frames pass for each pixel a floater rises. */
const FLOATER_RISE_EVERY = 6;
const SHAKE_TICKS = 12;
/** The screen changes direction this often while it shakes. */
const SHAKE_HOLD = 2;
/** Everything in a duel animates on threes: each drawing holds for this many frames, like a hand-drawn cut, so it reads as clear steps. */
const ANIMATION_HOLD = 3;
/** Holds a running count on the same drawing for a few frames. */
const held = (tick: number) => Math.floor(tick / ANIMATION_HOLD) * ANIMATION_HOLD;
/** How many stages a strike's gathering goes through. */
const COIL_STEPS = 3;
/** Walking takes this long a stride, compared with the street fights it shares its feet with. */
const STRIDE_SLOWDOWN = 2 / 3;
const GHOST_EVERY = 6;
const GHOST_TICKS = 18;
const GHOST_ALPHA = 0.3;
/** How dark the room goes behind a landed cut or a lock, so the fighters are all that's left to look at. */
const IMPACT_DIM = 0.35;
const LOCK_DIM = 0.22;
const IMPACT_DIM_TICKS = 14;
const KI_BAR_WIDTH = 60;
/** The last ten seconds stand out. */
const LOW_TIME_TICKS = 400;
const OVER_MIN_TICKS = 30;

type Floater = { text: string; x: number; y: number; ticks: number; color: string };
type Dust = { x: number; ticks: number };
type Ghost = { i: 0 | 1; x: number; pose: DuelPose; flip: boolean; ticks: number };

const HELP_LINES = ["Hold W Q E to open, then J K L + Space. S block", "Hold I: seme   Space while holding: kiai", "Double-tap toward them, then J K L: no opening", "Tap S when their tip shines: parry", "Both swing together? Pass, turn, go on"];
const HELP_NO_SEME = HELP_LINES[3];
/** The controls while hilt to hilt, which are nothing like the usual ones. Which key pushes depends on which side you're on. */
export const lockHelp = (towardThemIsRight: boolean): string => (towardThemIsRight ? "D push  S hold  JKL cut back  A out" : "A push  S hold  JKL cut back  D out");
const HELP_LINE_TICKS = 300;
const OPENING_KEYS: Opening[] = ["raise", "wrist", "drop"];
/** How many times a match reminds you that strikes come from an opening. */
const OPENING_HINTS = 3;

/** The controls don't all fit at once, so the line takes turns. */
export const helpLine = (tick: number, seme = true): string => {
  const index = Math.floor(tick / HELP_LINE_TICKS) % HELP_LINES.length;
  return index === 1 && !seme ? HELP_NO_SEME : HELP_LINES[index];
};
const SEME_HUM_TICKS = 14;

/** A low rumble while powering up. */
export function playSemeHum(audio: GameAudio, charging: boolean, tick: number): void {
  if (charging && tick % SEME_HUM_TICKS === 0) audio.play("charge");
}

export const KIAI: Record<Target, string> = { men: "MEN!", kote: "KOTE!", do: "DO!" };

function readPlayerAttack(input: Input): AttackKind | null {
  if (input.wasPressed("men")) return "men";
  if (input.wasPressed("kote")) return "kote";
  if (input.wasPressed("do")) return "do";
  return null;
}

/** Reads the keyboard into a fighter's input. A strike pressed just before recovery ends still counts. */
export function createPlayerControl({ openings = true }: { openings?: boolean } = {}): (input: Input, me: Pick<Fighter, "stance"> & Partial<Pick<Fighter, "counterTicks" | "launchStrikeTicks">>, canSeme?: boolean, crossed?: boolean) => FighterInput {
  let buffered: AttackKind | null = null;
  let bufferTicks = 0;
  let opening: Opening | null = null;
  const detectDash = createDashDetector();
  return (input, me, canSeme = true, crossed = false) => {
    const pressed = readPlayerAttack(input);
    if (pressed) {
      buffered = pressed;
      bufferTicks = ATTACK_BUFFER_TICKS;
    } else if (bufferTicks > 0 && --bufferTicks === 0) {
      buffered = null;
    }
    for (const shown of OPENING_KEYS) if (input.wasPressed(shown)) opening = shown;
    if (opening && !input.isDown(opening)) opening = OPENING_KEYS.find((shown) => input.isDown(shown)) ?? null;
    const canAct = me.stance === "guard" || me.stance === "block" || me.stance === "tsuba" || me.stance === "opening";
    // Hilt to hilt, a parry's answer and a strike off a launch need no opening. Otherwise the strike waits a moment for one, and the rules get to hear about it once.
    const ready = !openings || me.stance === "tsuba" || me.stance === "opening" || !!opening || (me.counterTicks ?? 0) > 0 || (me.launchStrikeTicks ?? 0) > 0;
    const attack = canAct && ready ? buffered : null;
    if (attack) {
      buffered = null;
      bufferTicks = 0;
    }
    const left = input.isDown("left");
    const right = input.isDown("right");
    const onScreen = left === right ? 0 : left ? -1 : 1;
    const dash = detectDash(input.wasPressed("left"), input.wasPressed("right"));
    // Keys always mean left and right on the screen, whichever side you've ended up on.
    const mirrored = (n: -1 | 0 | 1): -1 | 0 | 1 => (crossed && n !== 0 ? (-n as -1 | 1) : n);
    return { move: mirrored(onScreen), block: input.isDown("down"), parry: input.wasPressed("down"), attack: attack ?? (canAct ? pressed : null), opening, stomp: input.wasPressed("stomp"), seme: canSeme && input.isDown("seme"), dash: mirrored(dash) };
  };
}

export function playDuelSounds(audio: GameAudio, events: DuelEvent[]): void {
  for (const event of events) {
    if (event.type === "kiai") audio.play("swing");
    else if (event.type === "stomp" || event.type === "launch") audio.play("stomp");
    else if (event.type === "shout") audio.play("kiai");
    else if (event.type === "shaken") audio.play("flag");
    else if (event.type === "hit") audio.play("clean");
    else if (event.type === "clean") audio.play("flag");
    else if (event.type === "flat" || event.type === "nozanshin" || event.type === "whiff") audio.play("dud");
    else if (event.type === "blocked" || event.type === "stepout") audio.play("blocked");
    else if (event.type === "aiuchi" || event.type === "cross") audio.play("clash");
    else if (event.type === "parry") audio.play("parry");
    else if (event.type === "lock" || event.type === "shove" || event.type === "taiatari") audio.play("clash");
    else if (event.type === "wakare" || event.type === "time" || event.type === "encho") audio.play("flag");
    else if (event.type === "broken") audio.play("break");
  }
}

/** The shine's sound, once per strike as it first appears, because that's the moment to react to. */
export function playShineTing(audio: GameAudio, view: DuelView, you: 0 | 1 = 0): void {
  const shining = parryShine(view.duel, you === 0 ? 1 : 0) > 0;
  if (shining && !view.shining) audio.play("ting");
  view.shining = shining;
}

export type DuelView = {
  duel: DuelState;
  striking: [Target | null, Target | null];
  strikeTicks: [number, number];
  floaters: Floater[];
  /** Who gets reminded that strikes come from an opening, and how many times they have been. */
  hintFor: 0 | 1;
  openingHints: number;
  /** Each thing that's happened, in its own shape. */
  fx: Fx[];
  dust: Dust[];
  /** The fading copies someone leaves behind as they drive through. */
  ghosts: Ghost[];
  /** How much longer the room stays dark behind a big hit. */
  impact: number;
  /** The longest each fighter's current status has been, so a bar can show how much is left. */
  statusTotal: [number, number];
  flags: "red" | "white" | null;
  /** A flag on its way up after a hit, which only happens if the striker's still going by then. */
  flagComing: { color: "red" | "white"; ticks: number } | null;
  shake: number;
  flash: number;
  walkTick: number;
  lastX: [number, number];
  moving: [boolean, boolean];
  /** The strike showing is pulled back out of a lock. */
  hikiStrike: [boolean, boolean];
  /** A moment of something that's just happened to each fighter, like being hit. */
  reaction: [{ pose: DuelPose; ticks: number } | null, { pose: DuelPose; ticks: number } | null];
  /** How far each fighter's been knocked back, for show. */
  knock: [number, number];
  /** Which pose each fighter was last in, and how long they've been moving out of it. */
  poses: [PoseTrack, PoseTrack];
  /** The crowd's interest, which fades. */
  excitement: number;
  /** Which part of the match this was on the last tick, so a change of phase can be noticed. */
  lastPhase: DuelState["phase"];
  /** How long the fighters have been off the court, once it's over. */
  overTicks: number;
  /** How long ago the last point finished walking back. */
  sincePoint: number;
  /** Whether the strike coming at you was shining on the last tick, so its ting only plays once. */
  shining: boolean;
};
type PoseTrack = { now: DuelPose; was: DuelPose; age: number };

export function createDuelView(duel: DuelState): DuelView {
  return {
    duel,
    striking: [null, null],
    strikeTicks: [0, 0],
    floaters: [],
    hintFor: 0,
    openingHints: 0,
    fx: [],
    dust: [],
    ghosts: [],
    impact: 0,
    statusTotal: [0, 0],
    flags: null,
    flagComing: null,
    shake: 0,
    flash: 0,
    walkTick: 0,
    lastX: [duel.fighters[0].x, duel.fighters[1].x],
    moving: [false, false],
    hikiStrike: [false, false],
    reaction: [null, null],
    knock: [0, 0],
    poses: [track(duel, 0), track(duel, 1)],
    excitement: 0,
    lastPhase: duel.phase,
    overTicks: 0,
    sincePoint: TIP_LINGER_TICKS,
    shining: false,
  };
}

const track = (duel: DuelState, i: 0 | 1): PoseTrack => {
  const pose = poseFor(duel.fighters[i], { phase: duel.phase, striking: null, scored: false, bowTicksLeft: duel.phase === "bow" ? duel.phaseTicks : undefined });
  return { now: pose, was: pose, age: 0 };
};

const TIP_LINGER_TICKS = 150;
const HIT_REACTION_TICKS = 30;
const PARRY_REACTION_TICKS = 28;
const LUNGE = 8;
// Nobody's knocked back by a hit in real kendo. It's only enough to feel it.
const KNOCK_HIT = 2;
const KNOCK_BLOCK = 3;
const EXCITEMENT_TICKS = 90;
/** How close to the line someone has to be to turn and face the other way again. */
const FACE_LINE_WITHIN = 8;
const SHINAI_REACH = 12;

/** How many ticks a pose takes to arrive. A cut is quick and walking off isn't. */
const BLEND_TICKS: Partial<Record<DuelPose, number>> = {
  strikeMen: 6, strikeKote: 6, strikeDo: 6, hikiMen: 6, hikiKote: 6, hikiDo: 6,
  hit: 3, suriage: 3, deflected: 3, parry: 6, stumble: 6,
  sonkyo: 22, sonkyoTurn: 18, sonkyoTuck: 21, sonkyoSheathe: 15, taitoFree: 12, bowTaito: 12, taito: 10, sageto: 8, bow: 10, draw: 10, walkHome: 12, guard: 12, recover: 9, block: 6, zanshin: 9,
  tellBigRaise: 15, tellHandsUp: 9, tellTipDip: 9,
  tsuba: 9, tsubaPush: 9, tsubaGuard: 9, tsubaPull: 9, tsubaPart: 24,
};
const DEFAULT_BLEND_TICKS = 6;
/** Settling back into guard from these takes its time: rising out of sonkyo, and the tip coming down after parting. */
const SLOW_TO_GUARD: Partial<Record<DuelPose, number>> = { sonkyo: 20, tsubaPart: 16 };
/** How far a pose has arrived. It goes in held steps, with each new drawing up from its first frame. */
export const blendOf = (track: PoseTrack) => Math.min(1, (held(track.age) + ANIMATION_HOLD) / ((track.now === "guard" ? SLOW_TO_GUARD[track.was] : undefined) ?? BLEND_TICKS[track.now] ?? DEFAULT_BLEND_TICKS));

const STATUS_LOOK: Record<StatusKind, { label: string; color: string }> = {
  showsMen: { label: STATUS_SHOWS_MEN, color: PALETTE.Y },
  showsKote: { label: STATUS_SHOWS_KOTE, color: PALETTE.Y },
  showsDo: { label: STATUS_SHOWS_DO, color: PALETTE.Y },
  open: { label: STATUS_OPEN, color: UI.bad },
  wideOpen: { label: STATUS_WIDE_OPEN, color: UI.accent },
  stunned: { label: STATUS_STUNNED, color: SPIRIT },
  stumbling: { label: STATUS_STUMBLING, color: UI.bad },
  parrying: { label: STATUS_PARRYING, color: PALETTE.C },
  counter: { label: STATUS_COUNTER, color: UI.good },
  push: { label: STATUS_PUSH, color: UI.bad },
  hold: { label: STATUS_HOLD, color: PALETTE.C },
  pull: { label: STATUS_PULL, color: UI.accent },
};
const STRIP_FOR: Partial<Record<Fighter["stance"], string>> = {
  opening: PALETTE.L,
  windup: PALETTE.Y,
  block: PALETTE.i,
  parry: PALETTE.C,
  recovery: PALETTE.r,
  deflected: PALETTE.y,
  broken: SPIRIT,
  shaken: SPIRIT,
  stumble: PALETTE.r,
  seme: SPIRIT,
};

const tsubaAction = (duel: DuelState, i: 0 | 1): TsubaAction | undefined => {
  const { lock } = duel;
  if (!lock) return undefined;
  return lock.pulling[i] ? "pull" : lock.pushing[i] ? "push" : lock.guarding[i] ? "guard" : "hold";
};

/** Whether someone's on their way back to the line. */
const walkingHomeNow = (duel: DuelState, i: 0 | 1) => duel.phase === "point" && duel.fighters[i].x !== startX(i);

function fighterPose(view: DuelView, i: 0 | 1): DuelPose {
  const { duel } = view;
  return poseFor(duel.fighters[i], {
    phase: duel.phase,
    striking: view.striking[i],
    hiki: view.hikiStrike[i],
    scored: duel.phase === "zanshin" ? duel.zanshin?.by === i : duel.lastScore?.by === i,
    bowTicksLeft: duel.phase === "bow" ? duel.phaseTicks : undefined,
    closingTicksLeft: duel.phase === "closing" ? duel.phaseTicks : undefined,
    walkingHome: walkingHomeNow(duel, i),
    tsuba: tsubaAction(duel, i),
    reaction: view.reaction[i]?.pose,
  });
}

/** What the referee calls as the next point begins. */
export function refereeCall(duel: DuelState, from: DuelState["phase"]): string | null {
  if (from === "wakare" || from === "bow") return CALL_HAJIME;
  if (from !== "point") return null;
  if (duel.encho && duel.fighters.every((f) => f.points === 0)) return CALL_ENCHO;
  const toWin = duel.options.pointsToWin ?? POINTS_TO_WIN;
  return duel.fighters.every((f) => f.points === toWin - 1) ? CALL_SHOBU : CALL_NIHONME;
}

/** Turns one tick's rule events into things to see. */
export function applyEvents(view: DuelView, events: DuelEvent[], reducedMotion: boolean, gear?: Gear): void {
  const fighters = view.duel.fighters;
  /** Where someone is on the screen, or the middle of the two if it's nobody in particular. */
  const at = (by?: 0 | 1) => screenX(view.duel, by === undefined ? (fighters[0].x + fighters[1].x) / 2 : fighters[by].x);
  const float = (text: string, by: 0 | 1 | undefined, color: string) => {
    const x = at(by);
    // Anything said at the same moment goes above whatever's already there.
    const width = measureText(text);
    const inTheWay = (y: number) => view.floaters.some((f) => Math.abs(f.y - y) < FLOATER_ROW && Math.abs(f.x - x) < (measureText(f.text) + width) / 2 + 4);
    let y = GROUND - FLOATER_OVER_GROUND;
    while (inTheWay(y)) y -= FLOATER_ROW;
    view.floaters.push({ text, x, y, ticks: FLOATER_TICKS, color });
    view.floaters = view.floaters.slice(-FLOATERS_SHOWN);
  };
  const heightOf = (target?: Target | null) => (target === "men" ? 34 : target === "kote" ? 20 : 14);
  /** Where one fighter's shinai meets the other. */
  const contact = (by: 0 | 1) => at(by === 0 ? 1 : 0) - faceDir(view.duel, by) * SHINAI_REACH;
  const fx = (kind: FxKind, x: number, y: number, dir: -1 | 1 = 1, color?: string) => view.fx.push({ kind, x, y, dir, age: 0, color });
  const strikerColor = (by: 0 | 1) => (by === 0 ? PALETTE.R : PALETTE.W);
  for (const event of events) {
    if (event.type === "kiai" && event.by !== undefined && event.target) {
      view.striking[event.by] = event.target;
      view.strikeTicks[event.by] = STRIKE_POSE_TICKS;
      view.hikiStrike[event.by] = !!event.hiki;
      float(KIAI[event.target], event.by, UI.text);
    } else if (event.type === "clean" && event.by !== undefined && view.duel.options.harmless?.[event.by]) {
      // A drill partner stops short of anything you aren't armored for.
      const real = !!gear && !!event.target && gear[event.target];
      float(real ? GOT_YOU : STOPPED_SHORT, event.by, real ? UI.bad : UI.dim);
    } else if (event.type === "hit" && event.by !== undefined) {
      const victim = event.by === 0 ? 1 : 0;
      fx("strike", contact(event.by), GROUND - heightOf(event.target), faceDir(view.duel, event.by), strikerColor(event.by));
      view.impact = IMPACT_DIM_TICKS;
      view.flagComing = { color: event.by === 0 ? "red" : "white", ticks: FLAG_AFTER_HIT };
      view.reaction[victim] = { pose: "hit", ticks: HIT_REACTION_TICKS };
      view.knock[victim] = KNOCK_HIT;
      if (!reducedMotion) {
        view.shake = SHAKE_TICKS;
        view.flash = 3;
      }
    } else if (event.type === "clean" && event.by !== undefined) {
      view.flags = event.by === 0 ? "red" : "white";
      view.excitement = EXCITEMENT_TICKS;
      fx("ippon", at(event.by), GROUND);
    } else if (event.type === "shout") {
      float(KIAI_SHOUT, event.by, SPIRIT);
      fx("shout", at(event.by), GROUND - 24);
      if (!reducedMotion) view.shake = SHAKE_TICKS;
    } else if (event.type === "shaken") {
      float(FLINCH, event.by, SPIRIT);
      fx("shaken", at(event.by), GROUND - 40);
      if (!reducedMotion) view.shake = SHAKE_TICKS;
    } else if (event.type === "flat") {
      float(NO_STOMP, event.by, UI.dim);
      if (event.by !== undefined) fx("dud", contact(event.by), GROUND - heightOf(view.striking[event.by]));
    } else if (event.type === "nozanshin") {
      float(NO_ZANSHIN, event.by, UI.dim);
      if (event.by !== undefined) fx("fade", at(event.by), GROUND - 44);
    } else if (event.type === "stomp" && event.by !== undefined) {
      view.dust.push({ x: at(event.by) + faceDir(view.duel, event.by) * 8, ticks: 8 });
      fx("stomp", at(event.by) + faceDir(view.duel, event.by) * 8, GROUND);
    } else if (event.type === "launch" && event.by !== undefined) {
      fx("launch", at(event.by), GROUND, faceDir(view.duel, event.by));
    } else if (event.type === "whiff") {
      float("Too far", event.by, UI.dim);
      if (event.by !== undefined) fx("miss", at(event.by) + faceDir(view.duel, event.by) * 20, GROUND - 26, faceDir(view.duel, event.by));
    } else if (event.type === "lock") {
      float(view.duel.lock ? LOCK_CALL : "Too close!", view.duel.lock ? undefined : event.by, view.duel.lock ? UI.accent : UI.dim);
      if (view.duel.lock) fx("bind", at(), GROUND - 26);
    } else if (event.type === "taiatari" && event.by !== undefined) {
      view.dust.push({ x: at(event.by), ticks: 8 });
      fx("shove", at(event.by), GROUND - 22, faceDir(view.duel, event.by));
      if (!reducedMotion) view.shake = SHAKE_TICKS / 2;
    } else if (event.type === "shove" && event.by !== undefined) {
      float(SHOVED, event.by === 0 ? 1 : 0, UI.accent);
      view.dust.push({ x: at(event.by === 0 ? 1 : 0), ticks: 8 });
      fx("shove", at(event.by === 0 ? 1 : 0), GROUND - 22, faceDir(view.duel, event.by));
      if (!reducedMotion) view.shake = SHAKE_TICKS / 2;
    } else if (event.type === "time" || event.type === "encho") {
      float(CALL_TIME, undefined, UI.text);
    } else if (event.type === "noopening") {
      if (event.by === view.hintFor && view.openingHints < OPENING_HINTS) {
        view.openingHints++;
        float(NEEDS_OPENING, undefined, UI.dim);
      }
    } else if (event.type === "wakare") {
      float(CALL_WAKARE, undefined, UI.text);
    } else if (event.type === "parry" && event.by !== undefined) {
      const striker = event.by === 0 ? 1 : 0;
      float(PARRIED, event.by, UI.accent);
      fx("deflect", at(), GROUND - 34, faceDir(view.duel, event.by));
      view.impact = IMPACT_DIM_TICKS / 2;
      view.reaction[event.by] = { pose: "suriage", ticks: PARRY_REACTION_TICKS };
      view.knock[striker] = KNOCK_BLOCK;
      if (!reducedMotion) view.flash = 2;
    } else if (event.type === "blocked" && event.by !== undefined) {
      float("Blocked", event.by, PALETTE.C);
      fx("clank", contact(event.by), GROUND - heightOf(view.striking[event.by]), faceDir(view.duel, event.by));
      view.knock[event.by === 0 ? 1 : 0] = KNOCK_BLOCK;
    } else if (event.type === "aiuchi") {
      float("Aiuchi! Both hit", undefined, UI.accent);
      fx("mutual", at(), GROUND - 30);
    } else if (event.type === "cross") {
      float(CROSSED, undefined, UI.accent);
      fx("passing", at(), GROUND - 22);
      view.excitement = EXCITEMENT_TICKS / 2;
    } else if (event.type === "broken") {
      float("Guard broken!", event.by, UI.bad);
      if (event.by !== undefined) fx("shatter", at(event.by), GROUND - 30);
      view.impact = IMPACT_DIM_TICKS;
      if (!reducedMotion) view.shake = SHAKE_TICKS;
    }
  }
}

export function tickView(view: DuelView): void {
  const { duel } = view;
  view.walkTick++;
  if (duel.phase !== view.lastPhase) {
    if (duel.phase === "fight") {
      const call = refereeCall(duel, view.lastPhase);
      // A new point is a clean slate: nothing said in the last one is still in the air.
      if (call) view.floaters = [{ text: call, x: screenX(duel, (duel.fighters[0].x + duel.fighters[1].x) / 2), y: GROUND - FLOATER_OVER_GROUND - FLOATER_ROW, ticks: FLOATER_TICKS, color: UI.text }];
    }
    view.lastPhase = duel.phase;
  }
  // Between ticks and during a freeze nothing's moved, but nobody's stopped walking either.
  for (const i of [0, 1] as const) {
    if (duel.ticked) {
      view.moving[i] = Math.abs(view.duel.fighters[i].x - view.lastX[i]) > 0.01;
      view.lastX[i] = view.duel.fighters[i].x;
    }
    // Feet skidding on the floor, on a launch or sliding through.
    const skidding = duel.fighters[i].launchTicks > 0 || (duel.zanshin?.by === i && view.moving[i]);
    const through = duel.phase === "crossing" && view.moving[i];
    if ((skidding || through) && view.walkTick % 3 === 0) view.dust.push({ x: screenX(duel, duel.fighters[i].x), ticks: 6 });
    if ((skidding || through) && duel.ticked && view.walkTick % GHOST_EVERY === 0) {
      view.ghosts.push({ i, x: screenX(duel, duel.fighters[i].x), pose: view.poses[i].now, flip: faceDir(duel, i) < 0, ticks: GHOST_TICKS });
    }
  }
  // In a freeze the strike stays out and the reaction stays on, while the pose finishes arriving. That's the picture being held.
  const freezing = duel.freeze > 0;
  for (const i of [0, 1] as const) {
    if (!freezing) {
      if (view.strikeTicks[i] > 0 && --view.strikeTicks[i] === 0) {
        view.striking[i] = null;
        view.hikiStrike[i] = false;
      }
      const reaction = view.reaction[i];
      if (reaction && --reaction.ticks <= 0) view.reaction[i] = null;
      if (view.knock[i] > 0) view.knock[i] = Math.max(0, view.knock[i] - 0.25);
    }
    const pose = fighterPose(view, i);
    const track = view.poses[i];
    if (pose !== track.now) view.poses[i] = { now: pose, was: track.now, age: 0 };
    else track.age++;
    const status = fighterStatus(duel, i);
    view.statusTotal[i] = status?.ticks === undefined ? 0 : Math.max(view.statusTotal[i], status.total ?? status.ticks);
  }
  for (const effect of view.fx) effect.age++;
  view.fx = view.fx.filter((effect) => effect.age < FX_LIFE[effect.kind]);
  for (const ghost of view.ghosts) ghost.ticks--;
  view.ghosts = view.ghosts.filter((ghost) => ghost.ticks > 0);
  if (view.impact > 0) view.impact--;
  if (view.excitement > 0) view.excitement--;
  if (duel.phase === "point") view.sincePoint = 0;
  else if (view.sincePoint < TIP_LINGER_TICKS) view.sincePoint++;
  if (duel.phase === "over") view.overTicks++;
  for (const floater of view.floaters) {
    floater.ticks--;
    if (floater.ticks % FLOATER_RISE_EVERY === 0) floater.y--;
  }
  view.floaters = view.floaters.filter((f) => f.ticks > 0);
  for (const puff of view.dust) puff.ticks--;
  view.dust = view.dust.filter((d) => d.ticks > 0);
  if (view.shake > 0) view.shake--;
  if (view.flash > 0) view.flash--;
  if (duel.phase !== "zanshin") view.flagComing = null;
  else if (view.flagComing && duel.ticked && --view.flagComing.ticks <= 0) {
    view.flags = view.flagComing.color;
    view.flagComing = null;
  }
  // Stopping short lands back here too, and the point's taken back.
  if (view.duel.phase === "fight" || view.duel.phase === "closing") view.flags = null;
}

export function drawKiBar(ctx: CanvasRenderingContext2D, x: number, y: number, ki: number, kiMax: number, tick: number): void {
  const fullWidth = kiBarWidth(kiMax);
  const left = x < viewW / 2 ? x : x - fullWidth;
  ctx.fillStyle = UI.panel;
  ctx.fillRect(left - 1, y - 1, fullWidth + 2, 6);
  ctx.fillStyle = UI.track;
  ctx.fillRect(left, y, fullWidth, 4);
  const filled = kiBarFill(ki, kiMax);
  const tired = ki < KI_LOW;
  ctx.fillStyle = tired && Math.floor(tick / 8) % 2 === 0 ? UI.bad : tired ? PALETTE.r : UI.accent;
  ctx.fillRect(x < viewW / 2 ? left : left + fullWidth - filled, y, filled, 4);
}

function drawPips(ctx: CanvasRenderingContext2D, x: number, y: number, points: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const px = x + i * 9;
    ctx.fillStyle = UI.panel;
    ctx.fillRect(px, y, 7, 7);
    ctx.fillStyle = i < points ? color : UI.track;
    ctx.fillRect(px + 1, y + 1, 5, 5);
  }
}

/** How wide a long message runs across the interface before wrapping, room permitting. */
export const WIDE_TEXT = 340;
const PROMPT_TIMER_WIDTH = 34;
/** In the world's pixels: just over a fighter's head. */
const PROMPT_OVER_GROUND = 56;

/** Which key answers what's coming, or just how long is left when `label` is null. Centered over `x`. */
/** A key prompt over someone's head. `left` is how much of its timer is left, and null leaves the timer off. */
export function drawKeyPrompt(ctx: CanvasRenderingContext2D, x: number, ground: number, label: string | null, left: number | null): void {
  const at = guiPoint(ctx, x, ground - PROMPT_OVER_GROUND);
  onGui(ctx, () => {
    const width = Math.max(PROMPT_TIMER_WIDTH, label ? measureText(label) : 0) + 4;
    const boxLeft = Math.round(Math.max(2, Math.min(viewW - width - 2, at.x - width / 2)));
    const top = Math.round(at.y) - (label ? 15 : 6);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(boxLeft, top, width, label ? 15 : 6);
    if (label) drawTextCentered(ctx, label, boxLeft + width / 2, top + 1, UI.accent);
    if (left === null) return;
    const barY = top + (label ? 11 : 2);
    ctx.fillStyle = UI.track;
    ctx.fillRect(boxLeft + 2, barY, PROMPT_TIMER_WIDTH, 2);
    ctx.fillStyle = UI.accent;
    ctx.fillRect(boxLeft + 2, barY, Math.ceil(PROMPT_TIMER_WIDTH * Math.max(0, Math.min(1, left))), 2);
  });
}

/** The follow-through prompt: which key to hold, and how far along it is. */
export function drawZanshinMeter(ctx: CanvasRenderingContext2D, key: string, progress: number): void {
  const width = 96;
  const left = (viewW - width) / 2;
  ctx.fillStyle = UI.panel;
  ctx.fillRect(left - 4, 24, width + 8, 22);
  drawTextCentered(ctx, `${ZANSHIN_PROMPT} ${key}`, viewW / 2, 27, UI.accent);
  ctx.fillStyle = UI.track;
  ctx.fillRect(left, 38, width, 5);
  ctx.fillStyle = UI.accent;
  ctx.fillRect(left, 38, Math.min(width, Math.round(width * progress)), 5);
}

const HP_ROOM = 54;
export const hudRange = (duel: DuelState): string => distance(duel) > RANGE_MAX ? "Too far" : distance(duel) < RANGE_MIN ? "Too close" : "In range";
const RANGE_LABEL_HALF = 30;
/** Your HP goes after your name and points, unless a long name would run it into the range label in the middle. Then it goes after your ki bar, on the row below. */
export function hpSlot(nameWidth: number, toWin: number, kiWidth: number, width: number): { x: number; y: number } {
  const x = 11 + nameWidth + toWin * 9 + 4;
  return x + HP_ROOM <= width / 2 - RANGE_LABEL_HALF ? { x, y: 2 } : { x: 5 + kiWidth + 6, y: 10 };
}

export function drawDuelHud(ctx: CanvasRenderingContext2D, view: DuelView, names: [string, string], helpLine: string, me: 0 | 1 = 0, hp?: number, input?: Input, flipped = false): void {
  onGui(ctx, () => {
    const [you, rival] = flipped ? [view.duel.fighters[1], view.duel.fighters[0]] : view.duel.fighters;
    ctx.fillStyle = UI.panel;
    ctx.fillRect(0, 0, viewW, 20);
    drawText(ctx, names[0], 5, 2, UI.text);
    const toWin = view.duel.options.pointsToWin ?? POINTS_TO_WIN;
    drawPips(ctx, 11 + measureText(names[0]), 2, you.points, flipped ? UI.text : PALETTE.R, toWin);
    drawKiBar(ctx, 5, 13, you.ki, you.kiMax, view.walkTick);
    if (hp !== undefined) {
      const slot = hpSlot(measureText(names[0]), toWin, kiBarWidth(you.kiMax), viewW);
      drawText(ctx, HP_LABEL, slot.x, slot.y, UI.dim);
      drawHpBar(ctx, slot.x + measureText(HP_LABEL) + 3, slot.y + 1, hp);
    }
    const rivalNameX = viewW - 5 - measureText(names[1]);
    drawText(ctx, names[1], rivalNameX, 2, UI.text);
    drawPips(ctx, rivalNameX - 4 - toWin * 9, 2, rival.points, flipped ? PALETTE.R : UI.text, toWin);
    drawKiBar(ctx, viewW - 5, 13, rival.ki, rival.kiMax, view.walkTick);
    const clock = view.duel.phase === "bow" ? null : clockLabel(view.duel);
    if (clock) drawTextCentered(ctx, clock, viewW / 2, 11, view.duel.clock !== null && view.duel.clock <= LOW_TIME_TICKS ? UI.accent : UI.dim);

    if (view.duel.phase === "fight") {
      const range = hudRange(view.duel);
      const [label, color] = view.duel.lock ? [TSUBA_LABEL, UI.accent] : [range, range === "In range" ? UI.good : UI.dim];
      drawTextCentered(ctx, label, viewW / 2, 3, color);
    }

    // How close each fighter is to flinching.
    if (rival.pressure > 0) {
      const width = Math.round((KI_BAR_WIDTH * rival.pressure) / SEME_TICKS);
      ctx.fillStyle = UI.bad;
      ctx.fillRect(viewW - 5 - width, 18, width, 2);
    }
    if (you.pressure > 0) {
      ctx.fillStyle = UI.bad;
      ctx.fillRect(5, 18, Math.round((KI_BAR_WIDTH * you.pressure) / SEME_TICKS), 2);
    }

    const z = view.duel.zanshin;
    if (z && z.by === me) drawZanshinMeter(ctx, input ? keyLabel(input, z.dir * (view.duel.crossed ? -1 : 1) > 0 ? "right" : "left", z.dir * (view.duel.crossed ? -1 : 1) > 0 ? "d" : "a") : (z.dir * (view.duel.crossed ? -1 : 1) > 0 ? "D" : "A"), z.traveled / z.needed);

    ctx.fillStyle = UI.panel;
    ctx.fillRect(0, viewH - 11, viewW, 11);
    drawTextCentered(ctx, helpLine, viewW / 2, viewH - 10, UI.dim);
  });
}

const BREATH_TICKS = 36;
const SWAY_TICKS = 26;
const SWAY_DEGREES = 3;
const TRAIL_TICKS = 5;
/** How far the body has driven forward by the time a strike's fully gathered. The strike's own lunge takes it from there. */
const COIL_DRIVE = 4;
/** Both feet leave the floor around the cut. */
const HOP = 2;
const HOP_FROM_COIL = 0.75;
const HOP_INTO_STRIKE = 3;
/** Walking in guard, compared with the full speed of a strike. */
const STROLL_SPEED = 0.3;
const SWEAT_TICKS = 28;
const SWEAT = "#9CD3F0";
const LOCK_METER_WIDTH = 60;
/** Enough to feel the hit, not enough to make anyone blink. */
const HIT_FLASH = 0.18;
const FLOATER_BOTTOM = 9;
const STATUS_OVER_GROUND = 44;
const LOCK_LABEL_APART = 10;

/** Which way the lock is going. It leans toward whoever's about to be shoved. */
function drawLockMeter(ctx: CanvasRenderingContext2D, x: number, balance: number, crossed: boolean): void {
  const left = Math.round(x - LOCK_METER_WIDTH / 2);
  const top = GROUND - 56;
  ctx.fillStyle = PALETTE.K;
  ctx.fillRect(left - 1, top - 1, LOCK_METER_WIDTH + 2, 6);
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(left, top, LOCK_METER_WIDTH, 4);
  const middle = left + LOCK_METER_WIDTH / 2;
  const reach = Math.round((Math.min(1, Math.abs(balance) / TSUBA_BREAK) * LOCK_METER_WIDTH) / 2);
  ctx.fillStyle = balance > 0 ? PALETTE.R : PALETTE.W;
  ctx.fillRect(balance > 0 !== crossed ? middle : middle - reach, top, reach, 4);
  ctx.fillStyle = PALETTE.Y;
  ctx.fillRect(middle, top - 1, 1, 6);
}

/** The Spy Chamber under Thunder Radish, where the last match is fought: stone, two torches, and the maps on the wall. */
function drawSpyChamber(ctx: CanvasRenderingContext2D, tick: number, reducedMotion: boolean): void {
  const floor = stageY() + FLOOR_Y;
  ctx.fillStyle = "#2A2530";
  ctx.fillRect(0, 0, viewW, floor);
  ctx.fillStyle = "#231F29";
  for (let y = floor - 12; y > -12; y -= 12) for (let x = (Math.round((floor - y) / 12) % 2) * 12; x < viewW; x += 24) {
    ctx.fillRect(x, y, 23, 1);
    ctx.fillRect(x, y, 1, 12);
  }
  // The maps of every dojo, pinned up where Ren could study them.
  const middle = Math.round(viewW / 2);
  ctx.fillStyle = "#C9B98F";
  ctx.fillRect(middle - 40, floor - 70, 34, 24);
  ctx.fillRect(middle + 6, floor - 70, 34, 24);
  ctx.fillStyle = "#B8323A";
  for (const [x, y] of [[-32, -62], [-16, -54], [14, -64], [28, -52]]) ctx.fillRect(middle + x, floor + y, 2, 2);
  for (const x of [middle - 90, middle + 88]) {
    ctx.fillStyle = "#4A3A2A";
    ctx.fillRect(x, floor - 50, 3, 8);
    const flicker = reducedMotion ? 0 : (tick >> 2) % 3;
    ctx.fillStyle = "#F2B05A";
    ctx.fillRect(x - 1, floor - 55 - (flicker === 1 ? 1 : 0), 5, 5);
    ctx.fillStyle = "#FBE7A1";
    ctx.fillRect(x, floor - 53, 3, 2);
  }
  ctx.fillStyle = "#1E2330";
  ctx.fillRect(0, floor, viewW, viewH - floor);
  ctx.fillStyle = "#8A8F86";
  ctx.fillRect(0, floor, viewW, 2);
  ctx.fillStyle = "#2A3040";
  for (let y = floor + 6; y < viewH; y += 8) for (let x = ((y >> 3) % 2) * 8; x < viewW; x += 16) ctx.fillRect(x + 1, y, 14, 6);
}

export function drawDuelStage(
  ctx: CanvasRenderingContext2D,
  view: DuelView,
  crest: Crest,
  options: { opponent?: "rival" | "senior"; opponentColors?: Record<string, string>; playerColors?: Record<string, string>; insignias?: [Insignia | undefined, Insignia | undefined]; gear?: Gear; referees?: boolean; reducedMotion?: boolean; facing?: OpponentId | null; you?: 0 | 1; presentationFlipped?: boolean; showRibbons?: boolean; underground?: boolean } = {},
): void {
  const { opponent = "rival", opponentColors, playerColors: playerLook, gear, referees = true, reducedMotion = false, facing = null, you = 0, underground = false } = options;
  const { duel } = view;
  const shakeX = view.shake > 0 ? (Math.floor(view.shake / SHAKE_HOLD) % 2 === 0 ? 1 : -1) : 0;
  ctx.save();
  ctx.translate(shakeX, 0);
  if (underground) drawSpyChamber(ctx, view.walkTick, reducedMotion);
  else drawDuelBackdrop(ctx, crest);
  ctx.translate(stageX(), stageY());
  const side = courtside(crest, facing);
  // Nobody's watching down there, and nobody's judging.
  if (!underground) drawWatchers(ctx, crest, side, view.walkTick, reducedMotion, true, view.excitement > 0);
  if (referees && !underground) drawShinpan(ctx, side, view.flags);

  // The room goes dark behind a big hit, and stays a little dark for as long as they're locked.
  const dim = view.impact > 0 && !reducedMotion ? IMPACT_DIM : duel.lock ? LOCK_DIM : 0;
  if (dim > 0) {
    ctx.fillStyle = PALETTE.K;
    ctx.globalAlpha = dim;
    ctx.fillRect(-stageX() - 2, -stageY() - 2, viewW + 4, viewH + 4);
    ctx.globalAlpha = 1;
  }
  for (const effect of view.fx) if (FX_BEHIND.has(effect.kind)) drawFx(ctx, effect, reducedMotion);
  if (!reducedMotion) {
    for (const ghost of view.ghosts) {
      ctx.globalAlpha = (GHOST_ALPHA * ghost.ticks) / GHOST_TICKS;
      drawFighter(ctx, ghost.x, GROUND, ghost.pose, ghost.i === 0 ? "player" : opponent, 0, ghost.i === 0 ? gear : undefined, { flip: ghost.flip, colors: ghost.i === 1 ? opponentColors : playerLook, insignia: options.insignias?.[ghost.i], showRibbon: options.showRibbons, kamae: duel.fighters[ghost.i].kamae });
    }
    ctx.globalAlpha = 1;
  }

  const picture = held(view.walkTick);
  const order: (0 | 1)[] = view.strikeTicks[0] > 0 ? [1, 0] : [0, 1];
  let shine: { x: number; y: number; brightness: number } | null = null;
  const ceremony = duel.phase === "bow" ? ceremonyAt(duel.phaseTicks) : null;
  const closing = duel.phase === "closing" ? closingAt(duel.phaseTicks) : duel.phase === "over" ? closingAt(1) : null;
  for (const i of order) {
    const fighter = duel.fighters[i];
    const track = view.poses[i];
    const pose = track.now;
    const walking = duel.freeze === 0 && (view.moving[i] || (ceremony !== null && ceremony.pose === "taito") || (closing?.walking ?? false));
    const legs = legsFor(Math.floor(view.walkTick * STRIDE_SLOWDOWN), walking);
    const frame = legs === "step" ? 1 : legs === "close" ? 2 : 0;
    const inward = faceDir(duel, i);
    const homeward = -inward;
    const offCourt = duel.phase === "over" ? view.overTicks * WALK_OFF_SPEED : 0;
    const back = (ceremony?.stepBack ?? 0) + (closing?.stepBack ?? 0) + offCourt;
    const lunge = view.strikeTicks[i] > 0 && !view.hikiStrike[i] ? LUNGE * (held(view.strikeTicks[i] + ANIMATION_HOLD - 1) / STRIKE_POSE_TICKS) : 0;
    const coil = Math.ceil(windupCoil(duel, i) * COIL_STEPS) / COIL_STEPS;
    const x = screenX(duel, fighter.x) + back * homeward + (lunge + coil * COIL_DRIVE - view.knock[i]) * inward;
    const striking = view.strikeTicks[i] > STRIKE_POSE_TICKS - HOP_INTO_STRIKE && !view.hikiStrike[i];
    const ground = GROUND - (!reducedMotion && (coil >= HOP_FROM_COIL || striking) ? HOP : 0);
    const flying = view.strikeTicks[i] > 0 || fighter.launchTicks > 0 || ((duel.phase === "zanshin" || duel.phase === "crossing") && view.moving[i]);
    const motion = reducedMotion ? { speed: 0, tick: 0 } : { speed: flying || coil > 0 ? 1 : view.moving[i] ? STROLL_SPEED : 0, tick: picture };
    const other = duel.fighters[i === 0 ? 1 : 0];
    // Walking back, you face where you're going until you're nearly there. Leaving, you've turned your back.
    const toLine = startX(i) - fighter.x;
    const lineFlip = closing?.away ? i === 0 : duel.phase === "point" && Math.abs(toLine) > FACE_LINE_WITHIN ? toLine < 0 : undefined;
    const flip = lineFlip === undefined ? undefined : lineFlip !== !!options.presentationFlipped;
    // A commanding presence glows whenever it's pressing you, opening and swing included, not just when charging (issue #43).
    const pressing = presencePressing(duel, i);
    const charging = fighter.stance === "seme" || (pressing && duel.phase === "fight");
    const power = charging ? Math.min(1, Math.max(pressing ? 0.5 : 0, other.pressure / SEME_TICKS)) : 0;
    const tremble = charging && !reducedMotion && power > 0.5 && picture % (ANIMATION_HOLD * 2) === 0 ? 1 : 0;
    // Standing in guard, nobody is completely still: a breath, and the tip wandering a little.
    const resting = pose === "guard" && track.age > 8 && !reducedMotion && duel.phase === "fight";
    const bob = resting && Math.floor((picture + i * 17) / BREATH_TICKS) % 2 === 1 ? 1 : 0;
    // With the tips crossed they're touching, so they move together, each feeling the other.
    const touching = distance(duel) <= RANGE_MAX;
    const sway = resting ? Math.sin((held(view.walkTick * 2) / 2 + (touching ? 0 : i * 29)) / SWAY_TICKS) * SWAY_DEGREES : 0;
    const shaking = duel.lock && picture % (ANIMATION_HOLD * 2) === 0 && duel.lock.pushing[i] && !reducedMotion ? 1 : 0;
    const strip = duel.phase === "fight" ? STRIP_FOR[fighter.stance] : undefined;
    if (strip) drawGroundStrip(ctx, x, GROUND + 1, strip);
    if (charging) drawAuraBack(ctx, x, GROUND, picture, power, reducedMotion);
    const blend = blendOf(track);
    const facesLeft = flip ?? inward < 0;
    if (!reducedMotion && view.strikeTicks[i] > STRIKE_POSE_TICKS - TRAIL_TICKS) {
      drawSwingTrail(ctx, x, GROUND, track.was, pose, facesLeft, fighter.kamae);
    }
    drawFighter(ctx, x + tremble + shaking, ground, pose, i === 0 ? "player" : opponent, frame, i === 0 ? gear : undefined, { flip: facesLeft, colors: i === 1 ? opponentColors : playerLook, insignia: options.insignias?.[i], showRibbon: options.showRibbons, kamae: fighter.kamae, from: track.was, blend, bob, sway, coil, motion });
    // Only the strike coming at you shines: it's your cue to parry, and your own swing doesn't need one.
    const brightness = i === you ? 0 : parryShine(duel, i);
    if (brightness > 0) {
      const [tipX, tipY] = shinaiTip(x, ground, pose, facesLeft, fighter.kamae, track.was, blend, coil);
      shine = { x: tipX, y: tipY, brightness };
    }
    if (charging) drawAuraFront(ctx, x, GROUND, picture, power, reducedMotion);
    if (duel.phase === "fight" && (fighter.stance === "block" || fighter.stance === "parry")) drawGuardPlate(ctx, x + inward * 13, GROUND - 34, fighter.stance === "parry");
    // Running out of breath shows.
    if (fighter.ki < KI_LOW && !reducedMotion && duel.phase === "fight") {
      const drip = (view.walkTick + i * 11) % SWEAT_TICKS;
      if (drip < SWEAT_TICKS / 2) {
        ctx.fillStyle = SWEAT;
        ctx.fillRect(Math.round(x - inward * 10), GROUND - 38 + Math.floor(drip / 3), 1, 2);
        ctx.fillRect(Math.round(x - inward * 14), GROUND - 34 + Math.floor(drip / 4), 1, 1);
      }
    }
  }
  // On top of everyone, because it's the one thing that mustn't be missed.
  if (shine) drawShine(ctx, shine.x, shine.y, shine.brightness, reducedMotion);
  if (duel.lock) drawLockMeter(ctx, screenX(duel, (duel.fighters[0].x + duel.fighters[1].x) / 2), duel.lock.balance, duel.crossed);

  for (const effect of view.fx) if (!FX_BEHIND.has(effect.kind)) drawFx(ctx, effect, reducedMotion);

  // What state each of them is in, right where you're already looking. In a lock they stand close, so the labels go outward.
  for (const i of [0, 1] as const) {
    const status = fighterStatus(duel, i);
    if (!status) continue;
    const look = STATUS_LOOK[status.kind];
    const x = screenX(duel, duel.fighters[i].x) + (duel.lock ? -faceDir(duel, i) * LOCK_LABEL_APART : 0);
    drawTag(ctx, look.label, x, GROUND - STATUS_OVER_GROUND, look.color);
    if (status.ticks !== undefined && view.statusTotal[i] > 0) drawStatusBar(ctx, x, GROUND - STATUS_OVER_GROUND + 1, status.ticks / view.statusTotal[i], look.color);
  }

  for (const puff of view.dust) {
    const spread = 8 - puff.ticks;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(Math.round(puff.x - spread - 2), GROUND - 2, 2, 2);
    ctx.fillRect(Math.round(puff.x + spread + 2), GROUND - 2, 2, 2);
    ctx.fillRect(Math.round(puff.x), GROUND - 3 - Math.floor(spread / 2), 2, 2);
  }
  for (const floater of view.floaters) {
    drawTag(ctx, floater.text, floater.x, floater.y + FLOATER_BOTTOM, floater.color);
  }
  ctx.restore();

  if (view.flash > 0) {
    ctx.fillStyle = UI.text;
    ctx.globalAlpha = HIT_FLASH;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;
  }
}

export function drawPanel(ctx: CanvasRenderingContext2D, lines: { text: string; color: string; big?: boolean }[]): void {
  const height = lines.reduce((sum, l) => sum + (l.big ? 20 : LINE_HEIGHT), 0) + 10;
  const top = Math.round((STAGE_H - height) / 2);
  ctx.fillStyle = UI.panel;
  ctx.fillRect(16, top - 1, STAGE_W - 32, height + 2);
  ctx.fillStyle = UI.edge;
  ctx.fillRect(17, top, STAGE_W - 34, 1);
  ctx.fillRect(17, top + height - 1, STAGE_W - 34, 1);
  let y = top + 6;
  for (const line of lines) {
    if (line.big) {
      const width = measureText(line.text) * 2;
      drawText(ctx, line.text, (STAGE_W - width) / 2, y, line.color, 2);
      y += 20;
    } else {
      drawTextCentered(ctx, line.text, STAGE_W / 2, y, line.color);
      y += LINE_HEIGHT;
    }
  }
}

/** A match against this place's rival, or a senpai at home. A loss goes straight to a rematch, and a win moves on. */
export function createDuelScene(): Scene {
  const cards = createTeachCards();
  let view: DuelView;
  let rival: RivalState;
  let control = createPlayerControl();
  let outcomeRecorded = false;
  let overTicks = 0;
  /** Who this match is against. The game moves on from it as you leave, while this screen is still fading out. */
  let opposing: OpponentId = "momo";
  /** Whether this match is part of getting a grade, which decides what winning it means. */
  let stage: GradingStage | null = null;
  /** What you can tell about them from across the court, shown as you bow. */
  let moodText: string | null = null;
  /** The point whose tip just had its own card, so it isn't printed under IPPON as well. */
  let tipCarded: DuelState["lastScore"] = null;
  /** What's riding on this match. It's already been paid, so walking away just loses it. */
  let stake = 0;
  /** Whether this match costs you health, and whether what it cost has been taken yet. */
  let hurts = false;
  let hitsTaken = false;
  /** What the match took, for the panel at the end. */
  let hpLoss = 0;
  /** The first time you beat someone, they've got more to say about it. */
  let firstWin = false;
  /** Ren, at the end of the trial under Thunder Radish: a real match, fought in what you scavenged, in the dark. */
  let below = false;

  /** Every point you gave up costs you, however the match ends. */
  const takeHits = (game: Game, won: boolean) => {
    if (!hurts || hitsTaken) return;
    hitsTaken = true;
    const before = game.run.hp;
    game.run = { ...game.run, hp: hpAfterMatch(before, view.duel.fighters[1].points, won) };
    hpLoss = before - game.run.hp;
  };
  const knockedOut = (game: Game) => hurts && game.run.hp <= 0;

  /** Momo guards the secret at home. Senpai matches are also at home, but they're just practice. */
  const facingMomo = (game: Game) => game.run.node === "pinecone" && !game.versus;
  /** Ren's one point at home, which is there to teach you something and doesn't go on the record. */
  const facingRenVisit = (game: Game) => game.versus === "renVisit";

  const finishTournamentMatch = (game: Game, won: boolean) => {
    game.run = recordCupMatch(game.run, won);
    game.tournament = recordMatch(game.tournament!, won);
    game.versus = null;
    game.go("tournament");
  };

  /** Walking away, either after a loss or instead of finishing. No result goes on the record. */
  const walkAway = (game: Game) => {
    takeHits(game, false);
    if (below) game.go("dungeon");
    else if (knockedOut(game)) goDown(game, opposing);
    else if (game.tournament) finishTournamentMatch(game, false);
    else if (facingRenVisit(game)) {
      game.message = [REN_LATER];
      game.versus = null;
      game.go("club");
    } else if (stage === "recommendation" || stage === "verification") {
      game.message = saidBy(opponentById(opposing).rival, [stage === "verification" ? VERIFY_WALKED : RECOMMEND_WALKED]);
      game.versus = null;
      game.grading = null;
      game.go(game.run.node === "pinecone" ? "club" : "rival-dojo");
    } else if (stage === "tachiai") {
      game.message = [GRADING_WALKED];
      game.versus = null;
      game.grading = null;
      game.go("grading-hall");
    } else if (isChallenger(game.versus)) {
      game.message = [CHALLENGER_WALKED];
      game.go(challengerHome(game.versus));
      game.versus = null;
    } else if (game.versus) {
      const left = sparLeft(game.run, game.versus as SenpaiId, view.duel.winner === 1);
      game.run = left.run;
      game.message = left.lines;
      game.versus = null;
      game.go("club");
    } else if (facingMomo(game)) {
      game.message = game.run.seme ? MOMO_KEEP_TRYING : MOMO_CRUSHED;
      game.go("club");
    } else game.go("rival-dojo");
  };

  const startMatch = (game: Game) => {
    const fullStrength = !!game.tournament;
    opposing = game.versus ?? opponentIdFor(game.run.node);
    stage = game.grading;
    stake = game.bet;
    game.bet = 0;
    below = duelBelow(game.run);
    // The trial's health is its own, so the duel down there never knocks you out.
    hurts = !below && matchHurts(game.run, { cup: !!game.tournament, stage });
    hitsTaken = false;
    hpLoss = 0;
    firstWin = !game.run.beaten.includes(opposing);
    // A letter's tested with one point, whoever's testing it.
    // Down there you're the fighter you are anywhere: Ren's match is tuned for your own ki.
    const options = duelOptionsFor(below ? fighterBelow(game.run) : game.run, game.versus, fullStrength);
    view = createDuelView(createDuel(stage === "verification" ? { ...options, pointsToWin: 1 } : options));
    const seed = Math.floor(Math.random() * 2 ** 31);
    const config = rivalConfigFor(game.run, game.versus, fullStrength);
    const mood = moodOf(config, seed ^ 0x5bd1e995);
    moodText = mood ? moodLine(opponentById(opposing).rival, mood.pace, mood.favourite, opponentById(opposing).style) : null;
    rival = createRival(seed, withMood(config, seed ^ 0x5bd1e995));
    control = createPlayerControl();
    outcomeRecorded = false;
    overTicks = 0;
    game.debug.duel = view.duel;
    cards.clear(game);
  };

  /** On the easier fights, which key answers the tell that's coming gets shown. */
  const tellsShown = (game: Game) => promptsShown(opposing, lossesHere(game.run, opposing), !!game.tournament && game.tournament.cup !== "pinecone", game.run.gaze);
  const tipText = (game: Game, lastScore: NonNullable<DuelState["lastScore"]>) => (opposing === "renVisit" ? REN_POINT_TIP : tipFor(lastScore, game.run.seme, view.duel.fighters[1].kamae));

  /** Anything new stops the match right as it happens, once a save. So does the first time each tip comes up, since a point comes straight after. */
  const teachWhatsNew = (game: Game) => {
    const { duel } = view;
    for (const moment of duelMoments(duel, { waza: game.run.waza, tellsShown: tellsShown(game) })) teachOnce(game, cards, moment, momentCard(moment, duel));
    if (duel.phase === "point" && duel.lastScore?.by === 1 && duel.winner === null) {
      const tip = tipText(game, duel.lastScore);
      if (!wasTaught(game.run, `tip:${tip}`)) tipCarded = duel.lastScore;
      teachOnce(game, cards, `tip:${tip}`, tipCard(tip));
    }
  };

  return {
    enter: startMatch,
    // Once the last point's in, nothing's left to walk away from.
    forfeitLabel: () => (view.duel.winner !== null ? null : FORFEIT_MATCH),
    forfeit: walkAway,
    update(game) {
      const { input } = game;
      if (cards.active) {
        cards.update(game);
        return;
      }
      if (view.duel.phase === "over") {
        const won = view.duel.winner === 0;
        // A senpai win is recorded when you carry on, along with what it earned. A tournament keeps its own score.
        if (!outcomeRecorded) {
          outcomeRecorded = true;
          game.run = payBet(game.run, stake, won);
          takeHits(game, won);
          // What you scavenged isn't yours to wear out, and your own gear is in Ren's chest.
          const worn = below ? { run: game.run, wornOut: [] } : wearFrom(game.run, opposing);
          game.run = worn.run;
          if (!game.tournament) for (const key of worn.wornOut) game.after.push(wornOutLine(gearName(key)));
          if (won && !game.tournament) {
            const back = reclaim(game.run, opposing);
            game.run = back.run;
            if (back.amount) game.after.push(reclaimed(back.amount, whoHolds(opposing)));
          }
          if (won && !game.tournament && !stage && Object.hasOwn(DOJOS, opposing) && view.duel.fighters[1].points === 0) game.run = withFeat(game.run, "flawless");
          if (!game.tournament && !facingRenVisit(game)) {
            if (!won) game.run = recordLoss(game.run, game.versus);
            else if (!game.versus) game.run = recordWin(game.run);
          }
        }
        if (++overTicks > OVER_MIN_TICKS && input.wasPressed("confirm")) {
          if (knockedOut(game)) goDown(game, opposing);
          else if (game.tournament) finishTournamentMatch(game, won);
          else if (below && won) {
            // The win's already on the record; the trial remembers it was won down here, and Ren has something to say.
            game.run = winRenBelow(game.run);
            game.go("dungeon");
          } else if (facingRenVisit(game)) {
            game.run = renPointOutcome(game.run, won);
            game.versus = null;
            game.go("club");
          } else if (stage) {
            const home = game.run.node === "pinecone";
            const reply = stage === "recommendation" ? recommendationOutcome(game.run, won, home ? undefined : opponentById(opposing).rival, opponentById(opposing).rival) : stage === "verification" ? verificationOutcome(game.run, won, opponentById(opposing).rival) : gradingOutcome(game.run, won);
            game.run = reply.run;
            game.message = reply.lines;
            game.versus = null;
            game.grading = null;
            game.go(stage === "tachiai" ? "grading-hall" : home ? "club" : "rival-dojo");
          } else if (!won) startMatch(game);
          else if (isChallenger(game.versus)) {
            const reply = challengerWin(game.run, game.versus);
            game.run = reply.run;
            game.message = reply.lines;
            game.go(challengerHome(game.versus));
            game.versus = null;
          } else if (game.versus) {
            const reply = sparOutcome(game.run, game.versus as SenpaiId);
            game.run = reply.run;
            game.message = reply.lines;
            game.versus = null;
            game.go("club");
          } else if (facingMomo(game)) {
            game.run = { ...game.run, momoBeaten: true };
            game.message = MOMO_BEATEN;
            game.go("club");
          } else {
            // You're still standing on their floor, and they've got something to say about it.
            const reply = afterWinLines(game.run, opposing, firstWin, DOJOS[opposing as DojoId].winLines[0]);
            game.run = reply.run;
            game.message = reply.lines;
            game.go("rival-dojo");
          }
        } else if (overTicks > OVER_MIN_TICKS && !won && !knockedOut(game) && !game.tournament && !facingRenVisit(game) && !stage && input.wasPressed("down")) {
          walkAway(game);
        }
        tickView(view);
        return;
      }
      if (view.duel.phase === "bow" && input.wasPressed("confirm")) view.duel = skipBow(view.duel);
      if (view.duel.phase === "closing" && input.wasPressed("confirm")) view.duel = skipClosing(view.duel);

      const player = control(input, view.duel.fighters[0], game.run.seme, view.duel.crossed);

      const act = rivalAct(view.duel, rival);
      rival = act.rival;
      view.duel = step(view.duel, player, act.input);
      game.debug.duel = view.duel;
      applyEvents(view, view.duel.events, game.reducedMotion);
      playDuelSounds(game.audio, view.duel.events);
      playShineTing(game.audio, view);
      playSemeHum(game.audio, view.duel.fighters[0].stance === "seme", view.walkTick);
      tickView(view);
      teachWhatsNew(game);
    },
    render(ctx, game) {
      const dojo = opponentById(opposing);
      const scripted = opposing === "renVisit";
      const inTournament = !!game.tournament;
      const crest = game.tournament ? CUPS[game.tournament.cup].crest : dojo.crest;
      drawDuelStage(ctx, view, crest, { opponentColors: dojo.colors, playerColors: playerColors(below ? fighterBelow(game.run) : game.run), gear: below ? scavengedGear(game.run) : game.run.gear, reducedMotion: game.reducedMotion, facing: opposing, underground: below });
      const theirDan = personDan(opposing);
      drawDuelHud(ctx, view, [`${playerName(game.run)} ${rankLabel(game.run)}`, theirDan ? `${dojo.rival} ${danLabel(theirDan)}` : dojo.rival], teachingKeys(game.input, view.duel.lock ? lockHelp(!view.duel.crossed) : helpLine(view.walkTick, game.run.seme)), 0, hurts && !hitsTaken ? Math.max(0, game.run.hp - view.duel.fighters[1].points * HP_PER_POINT) : hurts ? game.run.hp : undefined, game.input);
      const { duel } = view;
      // On the easier fights, show which key answers the tell that's coming.
      const them = duel.fighters[1];
      if (duel.phase === "fight" && (them.stance === "opening" || (them.stance === "windup" && them.attack)) && tellsShown(game)) {
        // While it's only an opening, nothing's coming yet, so the bar's full. Once the strike starts, it's how long you've got.
        const left = them.stance === "opening" ? 1 : them.stanceTicks / (them.opening ? ATTACKS[them.attack!].windup : (duel.options.windups?.[1]?.[them.attack!] ?? ATTACKS[them.attack!].windup));
        onStage(ctx, () => drawKeyPrompt(ctx, screenX(duel, them.x), GROUND, targetPrompt(exposedTargets(them)[0], game.input), left));
      }
      onGui(ctx, () => {
        if (stake && view.duel.phase !== "over") drawTextCentered(ctx, betHud(stake), viewW / 2, 21, UI.accent);
        if (duel.phase === "bow") {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, 22, viewW, 12);
          const facingRen = dojo.style === "master" && game.run.gaze;
          drawTextCentered(ctx, facingRen ? REN_BOW_GAZE : stage === "tachiai" ? GRADING_BOW : stage === "recommendation" ? RECOMMEND_BOW : stage === "verification" ? VERIFY_BOW : "Rei. Bow, step in, and draw", viewW / 2, 24, UI.text);
          if (moodText) {
            ctx.fillStyle = UI.panel;
            ctx.fillRect(0, 33, viewW, LINE_HEIGHT);
            drawTextCentered(ctx, moodText, viewW / 2, 34, UI.accent);
          }
        }
        if (duel.phase === "point" && duel.lastScore && !duel.timeUp) {
          const scorer = duel.lastScore.by === 0;
          const label = "IPPON!";
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, 22, viewW, 30);
          drawText(ctx, label, (viewW - measureText(label) * 3) / 2, 26, scorer ? UI.bad : UI.text, 3);
        }
        // There's no wait after a point any more, so what to try next stays up a little way into the next one.
        const showTip = duel.lastScore?.by === 1 && duel.winner === null && (duel.phase === "point" || (duel.phase === "fight" && view.sincePoint < TIP_LINGER_TICKS));
        if (showTip && duel.lastScore && duel.lastScore !== tipCarded) {
          const room = Math.min(viewW - 16, WIDE_TEXT);
          const lines = wrapText(tipText(game, duel.lastScore), room - 8);
          const top = duel.phase === "point" ? 52 : 22;
          ctx.fillStyle = UI.panel;
          ctx.fillRect((viewW - room) / 2, top, room, lines.length * LINE_HEIGHT + 3);
          lines.forEach((line, i) => drawTextCentered(ctx, line, viewW / 2, top + 2 + i * LINE_HEIGHT, UI.accent));
        }
        if (duel.phase === "closing") {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, 22, viewW, 12);
          drawTextCentered(ctx, CLOSING_LINE, viewW / 2, 24, UI.text);
        }
        if (duel.phase === "over") {
          const won = duel.winner === 0;
          const advice = scripted ? REN_POINT_TIP : opposing === "momo" ? (game.run.seme ? MOMO_LOSE_SEME : MOMO_LOSE_NO_SEME) : duel.lastScore && tipFor(duel.lastScore, game.run.seme, them.kamae);
          const tip = !won && advice ? wrapText(advice, STAGE_W - 44) : [];
          onStage(ctx, () => drawPanel(ctx, [
            { text: stage === "tachiai" ? (won ? "Passed!" : "Not today") : stage === "recommendation" ? (won ? "Vouched for!" : "Not yet") : won ? `${playerName(game.run)} wins!` : `${dojo.rival} wins`, color: won ? UI.bad : UI.text, big: true },
            ...tip.map((text) => ({ text, color: UI.accent })),
            ...(stake ? [{ text: won ? betWon(stake) : betLost(stake), color: won ? UI.good : UI.bad }] : []),
            ...(hpLoss > 0 ? [{ text: hpLost(hpLoss, game.run.hp), color: UI.bad }] : []),
            ...(knockedOut(game) ? [{ text: CANT_GO_ON, color: UI.bad }] : []),
            ...(knockedOut(game) ? [] : [{ text: won ? "Well fought." : scripted ? REN_POINT_NEXT : inTournament ? TAIKAI_LOST : !inTournament && lossesHere(game.run, opposing) > 1 ? `${dojo.rival} looks tired. Go again?` : "Rei, and go again.", color: UI.dim }]),
            { text: won || inTournament || scripted || stage || knockedOut(game) ? "E or Space: continue" : "E: rematch   S: walk away", color: UI.text },
          ]));
        }
      });
      cards.render(ctx);
    },
  };
}
