import { playerColors } from "../characters.ts";
import { CUPS } from "../world/tournament.ts";
import { drawAuraBack, drawAuraFront } from "../art/aura.ts";
import { drawDuelBackdrop, type Crest } from "../art/backdrops.ts";
import { drawShinpan, drawWatchers } from "../art/courtside-art.ts";
import { drawFighter, drawSwingTrail, type DuelPose } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, LINE_HEIGHT, measureText, wrapText } from "../art/font.ts";
import type { Gear } from "../art/kendoka.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { drawHpBar, drawTag } from "./ui.ts";
import type { GameAudio } from "../core/audio.ts";
import type { Input } from "../core/input.ts";
import { guiPoint, onGui, onStage, STAGE_H, STAGE_W, stageX, stageY, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { KI_LOW, POINTS_TO_WIN, RANGE_MAX, RANGE_MIN, SEME_TICKS, TSUBA_BREAK } from "../duel/constants.ts";
import { createDashDetector, legsFor } from "../duel/footwork.ts";
import { counterPrompt, kiBarFill, kiBarWidth, promptsShown } from "../duel/hud.ts";
import { ceremonyAt, closingAt, poseFor, WALK_OFF_SPEED, type TsubaAction } from "../duel/poses.ts";
import { createRival, moodOf, rivalAct, withMood, type RivalState } from "../duel/rival.ts";
import { ATTACKS, createDuel, distance, faceDir, screenX, skipBow, skipClosing, startX, step, type AttackKind, type DuelEvent, type DuelState, type Fighter, type FighterInput, type Target } from "../duel/rules.ts";
import { tipFor } from "../duel/tips.ts";
import { gradingOutcome, recommendationOutcome, verificationOutcome, type GradingStage } from "../grading.ts";
import { payBet, withFeat } from "../money.ts";
import { danLabel, personDan, rankLabel } from "../ranks.ts";
import { duelOptionsFor, lossesHere, recordCupMatch, recordLoss, recordWin, rivalConfigFor } from "../run-state.ts";
import { courtside } from "../world/courtside.ts";
import { DOJOS, opponentById, opponentIdFor, type DojoId, type OpponentId } from "../world/dojos.ts";
import { hpAfterMatch, HP_PER_POINT, matchHurts, reclaim, whoHolds } from "../health.ts";
import { afterWinLines } from "./chatter.ts";
import { goDown } from "./knockout.ts";
import { recordMatch } from "../world/tournament.ts";
import { challengerHome, challengerWin, isChallenger } from "./challengers.ts";
import { sparOutcome } from "./club-story.ts";
import { renPointOutcome } from "./visits.ts";
import type { SenpaiId } from "./curriculum.ts";
import { betHud, betLost, betWon, CALL_HAJIME, CALL_NIHONME, CALL_SHOBU, CALL_WAKARE, CHALLENGER_WALKED, CLOSING_LINE, CROSSED, LOCK_CALL, PARRIED, SHOVED, TSUBA_LABEL, FLINCH, FORFEIT_MATCH, GOT_YOU, GRADING_BOW, GRADING_WALKED, moodLine, RECOMMEND_BOW, RECOMMEND_WALKED, VERIFY_BOW, VERIFY_WALKED, KIAI_SHOUT, TAIKAI_LOST, MOMO_BEATEN, MOMO_CRUSHED, MOMO_KEEP_TRYING, MOMO_LOSE_NO_SEME, MOMO_LOSE_SEME, NO_STOMP, NO_ZANSHIN, REN_BOW_GAZE, REN_LATER, REN_POINT_NEXT, REN_POINT_TIP, SENPAI_LINES, STOPPED_SHORT, ZANSHIN_PROMPT, CANT_GO_ON, HP_LABEL, hpLost, reclaimed } from "./content.ts";

const GROUND = 128;
const STRIKE_POSE_TICKS = 12;
const ATTACK_BUFFER_TICKS = 6;
const FLOATER_TICKS = 42;
const FLOATER_ROW = 10;
const SHAKE_TICKS = 8;
const KI_BAR_WIDTH = 60;
const OVER_MIN_TICKS = 30;

type Floater = { text: string; x: number; y: number; ticks: number; color: string };
type Spark = { x: number; y: number; ticks: number; color: string; reach: number };
type Dust = { x: number; ticks: number };

const HELP_LINES = ["J men K kote L do Space stomp S block", "Hold I: seme   Space while holding: kiai", "Double-tap toward them: launch", "Tap S just as they strike: parry", "Both swing together? Pass, turn, go on"];
const HELP_NO_SEME = HELP_LINES[3];
/** The controls while hilt to hilt, which are nothing like the usual ones. Which key pushes depends on which side you're on. */
export const lockHelp = (towardThemIsRight: boolean): string => (towardThemIsRight ? "D push  S hold  JKL cut back  A out" : "A push  S hold  JKL cut back  D out");
const HELP_LINE_TICKS = 300;

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
export function createPlayerControl(): (input: Input, me: Pick<Fighter, "stance">, canSeme?: boolean, crossed?: boolean) => FighterInput {
  let buffered: AttackKind | null = null;
  let bufferTicks = 0;
  const detectDash = createDashDetector();
  return (input, me, canSeme = true, crossed = false) => {
    const pressed = readPlayerAttack(input);
    if (pressed) {
      buffered = pressed;
      bufferTicks = ATTACK_BUFFER_TICKS;
    } else if (bufferTicks > 0 && --bufferTicks === 0) {
      buffered = null;
    }
    const canAct = me.stance === "guard" || me.stance === "block" || me.stance === "tsuba";
    const attack = canAct ? buffered : null;
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
    return { move: mirrored(onScreen), block: input.isDown("down"), parry: input.wasPressed("down"), attack, stomp: input.wasPressed("stomp"), seme: canSeme && input.isDown("seme"), dash: mirrored(dash) };
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
    else if (event.type === "flat" || event.type === "nozanshin") audio.play("blocked");
    else if (event.type === "blocked" || event.type === "aiuchi" || event.type === "stepout") audio.play("blocked");
    else if (event.type === "parry") audio.play("parry");
    else if (event.type === "lock" || event.type === "shove" || event.type === "taiatari") audio.play("clash");
    else if (event.type === "wakare") audio.play("flag");
    else if (event.type === "broken") audio.play("break");
  }
}

export type DuelView = {
  duel: DuelState;
  striking: [Target | null, Target | null];
  strikeTicks: [number, number];
  floaters: Floater[];
  sparks: Spark[];
  dust: Dust[];
  flags: "red" | "white" | null;
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
};
type PoseTrack = { now: DuelPose; was: DuelPose; age: number };

export function createDuelView(duel: DuelState): DuelView {
  return {
    duel,
    striking: [null, null],
    strikeTicks: [0, 0],
    floaters: [],
    sparks: [],
    dust: [],
    flags: null,
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
  };
}

const track = (duel: DuelState, i: 0 | 1): PoseTrack => {
  const pose = poseFor(duel.fighters[i], { phase: duel.phase, striking: null, scored: false, bowTicksLeft: duel.phase === "bow" ? duel.phaseTicks : undefined });
  return { now: pose, was: pose, age: 0 };
};

const TIP_LINGER_TICKS = 150;
const HIT_REACTION_TICKS = 16;
const PARRY_REACTION_TICKS = 14;
const LUNGE = 8;
const KNOCK_HIT = 7;
const KNOCK_BLOCK = 3;
const EXCITEMENT_TICKS = 90;
/** How close to the line someone has to be to turn and face the other way again. */
const FACE_LINE_WITHIN = 8;
const SHINAI_REACH = 12;

/** How many ticks a pose takes to arrive. A cut is quick and walking off isn't. */
const BLEND_TICKS: Partial<Record<DuelPose, number>> = {
  strikeMen: 3, strikeKote: 3, strikeDo: 3, hikiMen: 3, hikiKote: 3, hikiDo: 3,
  hit: 2, suriage: 2, deflected: 2, parry: 3, stumble: 3,
  sonkyo: 12, sonkyoSheathe: 14, taito: 10, sageto: 8, bow: 10, draw: 10, walkHome: 10, guard: 7, recover: 6, block: 4, zanshin: 5,
  tellBigRaise: 8, tellHandsUp: 5, tellTipDip: 5,
  tsuba: 5, tsubaPush: 6, tsubaGuard: 5, tsubaPull: 6,
};
const DEFAULT_BLEND_TICKS = 4;
const blendOf = (track: PoseTrack) => Math.min(1, track.age / (BLEND_TICKS[track.now] ?? DEFAULT_BLEND_TICKS));

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
    let y = GROUND - 54;
    while (inTheWay(y)) y -= FLOATER_ROW;
    view.floaters.push({ text, x, y, ticks: FLOATER_TICKS, color });
  };
  const heightOf = (target?: Target | null) => (target === "men" ? 34 : target === "kote" ? 20 : 14);
  /** Where one fighter's shinai meets the other. */
  const contact = (by: 0 | 1) => at(by === 0 ? 1 : 0) - faceDir(view.duel, by) * SHINAI_REACH;
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
      view.sparks.push({ x: contact(event.by), y: GROUND - heightOf(event.target), ticks: 10, color: PALETTE.W, reach: 10 });
      view.reaction[victim] = { pose: "hit", ticks: HIT_REACTION_TICKS };
      view.knock[victim] = KNOCK_HIT;
      if (!reducedMotion) {
        view.shake = SHAKE_TICKS;
        view.flash = 3;
      }
    } else if (event.type === "clean" && event.by !== undefined) {
      view.flags = event.by === 0 ? "red" : "white";
      view.excitement = EXCITEMENT_TICKS;
    } else if (event.type === "shout") {
      float(KIAI_SHOUT, event.by, UI.accent);
      if (!reducedMotion) view.shake = SHAKE_TICKS;
    } else if (event.type === "shaken") {
      float(FLINCH, event.by, UI.accent);
      if (!reducedMotion) view.shake = SHAKE_TICKS;
    } else if (event.type === "flat") {
      float(NO_STOMP, event.by, UI.accent);
    } else if (event.type === "nozanshin") {
      float(NO_ZANSHIN, event.by, UI.accent);
    } else if (event.type === "stomp" && event.by !== undefined) {
      view.dust.push({ x: at(event.by) + faceDir(view.duel, event.by) * 8, ticks: 8 });
    } else if (event.type === "whiff") {
      float("Too far", event.by, UI.dim);
    } else if (event.type === "lock") {
      float(view.duel.lock ? LOCK_CALL : "Too close!", view.duel.lock ? undefined : event.by, view.duel.lock ? UI.accent : UI.dim);
    } else if (event.type === "taiatari" && event.by !== undefined) {
      view.dust.push({ x: at(event.by), ticks: 8 });
      if (!reducedMotion) view.shake = SHAKE_TICKS / 2;
    } else if (event.type === "shove" && event.by !== undefined) {
      float(SHOVED, event.by === 0 ? 1 : 0, UI.accent);
      view.dust.push({ x: at(event.by === 0 ? 1 : 0), ticks: 8 });
      if (!reducedMotion) view.shake = SHAKE_TICKS / 2;
    } else if (event.type === "wakare") {
      float(CALL_WAKARE, undefined, UI.text);
    } else if (event.type === "parry" && event.by !== undefined) {
      const striker = event.by === 0 ? 1 : 0;
      float(PARRIED, event.by, UI.accent);
      view.sparks.push({ x: at(), y: GROUND - 34, ticks: 10, color: PALETTE.Y, reach: 9 });
      view.reaction[event.by] = { pose: "suriage", ticks: PARRY_REACTION_TICKS };
      view.knock[striker] = KNOCK_BLOCK;
      if (!reducedMotion) view.flash = 2;
    } else if (event.type === "blocked" && event.by !== undefined) {
      float("Blocked", event.by, UI.dim);
      view.sparks.push({ x: contact(event.by), y: GROUND - heightOf(view.striking[event.by]), ticks: 6, color: PALETTE.y, reach: 5 });
      view.knock[event.by === 0 ? 1 : 0] = KNOCK_BLOCK;
    } else if (event.type === "aiuchi") {
      float("Aiuchi! Both hit", undefined, UI.accent);
    } else if (event.type === "cross") {
      float(CROSSED, undefined, UI.accent);
      view.sparks.push({ x: at(), y: GROUND - 32, ticks: 10, color: PALETTE.Y, reach: 7 });
      view.excitement = EXCITEMENT_TICKS / 2;
    } else if (event.type === "broken") {
      float("Guard broken!", event.by, UI.bad);
    }
  }
}

export function tickView(view: DuelView): void {
  const { duel } = view;
  view.walkTick++;
  if (duel.phase !== view.lastPhase) {
    if (duel.phase === "fight") {
      const call = refereeCall(duel, view.lastPhase);
      if (call) view.floaters.push({ text: call, x: screenX(duel, (duel.fighters[0].x + duel.fighters[1].x) / 2), y: GROUND - 62, ticks: FLOATER_TICKS, color: UI.text });
    }
    view.lastPhase = duel.phase;
  }
  for (const i of [0, 1] as const) {
    view.moving[i] = Math.abs(view.duel.fighters[i].x - view.lastX[i]) > 0.01;
    view.lastX[i] = view.duel.fighters[i].x;
    // Feet skidding on the floor, on a launch or sliding through.
    const skidding = duel.fighters[i].launchTicks > 0 || (duel.zanshin?.by === i && view.moving[i]);
    const through = duel.phase === "crossing" && view.moving[i];
    if ((skidding || through) && view.walkTick % 3 === 0) view.dust.push({ x: screenX(duel, duel.fighters[i].x), ticks: 6 });
  }
  for (const i of [0, 1] as const) {
    if (view.strikeTicks[i] > 0 && --view.strikeTicks[i] === 0) {
      view.striking[i] = null;
      view.hikiStrike[i] = false;
    }
    const reaction = view.reaction[i];
    if (reaction && --reaction.ticks <= 0) view.reaction[i] = null;
    if (view.knock[i] > 0) view.knock[i] = Math.max(0, view.knock[i] - 0.5);
    const pose = fighterPose(view, i);
    const track = view.poses[i];
    if (pose !== track.now) view.poses[i] = { now: pose, was: track.now, age: 0 };
    else track.age++;
  }
  if (view.excitement > 0) view.excitement--;
  if (duel.phase === "point") view.sincePoint = 0;
  else if (view.sincePoint < TIP_LINGER_TICKS) view.sincePoint++;
  if (duel.phase === "over") view.overTicks++;
  for (const floater of view.floaters) {
    floater.ticks--;
    if (floater.ticks % 3 === 0) floater.y--;
  }
  view.floaters = view.floaters.filter((f) => f.ticks > 0);
  for (const spark of view.sparks) spark.ticks--;
  view.sparks = view.sparks.filter((s) => s.ticks > 0);
  for (const puff of view.dust) puff.ticks--;
  view.dust = view.dust.filter((d) => d.ticks > 0);
  if (view.shake > 0) view.shake--;
  if (view.flash > 0) view.flash--;
  if (view.duel.phase === "fight" || view.duel.phase === "closing") view.flags = null;
}

function drawKiBar(ctx: CanvasRenderingContext2D, x: number, y: number, ki: number, kiMax: number, tick: number): void {
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
export function drawKeyPrompt(ctx: CanvasRenderingContext2D, x: number, ground: number, label: string | null, left: number): void {
  const at = guiPoint(ctx, x, ground - PROMPT_OVER_GROUND);
  onGui(ctx, () => {
    const width = Math.max(PROMPT_TIMER_WIDTH, label ? measureText(label) : 0) + 4;
    const boxLeft = Math.round(Math.max(2, Math.min(viewW - width - 2, at.x - width / 2)));
    const top = Math.round(at.y) - (label ? 15 : 6);
    ctx.fillStyle = UI.panel;
    ctx.fillRect(boxLeft, top, width, label ? 15 : 6);
    if (label) drawTextCentered(ctx, label, boxLeft + width / 2, top + 1, UI.accent);
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

export function drawDuelHud(ctx: CanvasRenderingContext2D, view: DuelView, names: [string, string], helpLine: string, me: 0 | 1 = 0, hp?: number): void {
  onGui(ctx, () => {
    const [you, rival] = view.duel.fighters;
    ctx.fillStyle = UI.panel;
    ctx.fillRect(0, 0, viewW, 20);
    drawText(ctx, names[0], 5, 2, UI.text);
    const toWin = view.duel.options.pointsToWin ?? POINTS_TO_WIN;
    drawPips(ctx, 11 + measureText(names[0]), 2, you.points, PALETTE.R, toWin);
    drawKiBar(ctx, 5, 13, you.ki, you.kiMax, view.walkTick);
    if (hp !== undefined) {
      const hpX = 11 + measureText(names[0]) + toWin * 9 + 4;
      drawText(ctx, HP_LABEL, hpX, 2, UI.dim);
      drawHpBar(ctx, hpX + measureText(HP_LABEL) + 3, 3, hp);
    }
    const rivalNameX = viewW - 5 - measureText(names[1]);
    drawText(ctx, names[1], rivalNameX, 2, UI.text);
    drawPips(ctx, rivalNameX - 4 - toWin * 9, 2, rival.points, UI.text, toWin);
    drawKiBar(ctx, viewW - 5, 13, rival.ki, rival.kiMax, view.walkTick);

    if (view.duel.phase === "fight") {
      const dist = distance(view.duel);
      const [label, color] = view.duel.lock ? [TSUBA_LABEL, UI.accent] : dist > RANGE_MAX ? ["Too far", UI.dim] : dist < RANGE_MIN ? ["Too close", UI.dim] : ["In range", UI.good];
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
    if (z && z.by === me) drawZanshinMeter(ctx, z.dir * (view.duel.crossed ? -1 : 1) > 0 ? "D" : "A", z.traveled / z.needed);

    ctx.fillStyle = UI.panel;
    ctx.fillRect(0, viewH - 11, viewW, 11);
    drawTextCentered(ctx, helpLine, viewW / 2, viewH - 10, UI.dim);
  });
}

const BREATH_TICKS = 36;
const SWAY_TICKS = 26;
const SWAY_DEGREES = 3;
const TRAIL_TICKS = 5;
const SWEAT_TICKS = 28;
const SWEAT = "#9CD3F0";
const LOCK_METER_WIDTH = 44;
/** Enough to feel the hit, not enough to make anyone blink. */
const HIT_FLASH = 0.18;
const FLOATER_BOTTOM = 9;

/** Which way the lock is going. It leans toward whoever's about to be shoved. */
function drawLockMeter(ctx: CanvasRenderingContext2D, x: number, balance: number, crossed: boolean): void {
  const left = Math.round(x - LOCK_METER_WIDTH / 2);
  const top = GROUND - 48;
  ctx.fillStyle = PALETTE.K;
  ctx.fillRect(left - 1, top - 1, LOCK_METER_WIDTH + 2, 5);
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(left, top, LOCK_METER_WIDTH, 3);
  const middle = left + LOCK_METER_WIDTH / 2;
  const reach = Math.round((Math.min(1, Math.abs(balance) / TSUBA_BREAK) * LOCK_METER_WIDTH) / 2);
  ctx.fillStyle = balance > 0 ? PALETTE.R : PALETTE.W;
  ctx.fillRect(balance > 0 !== crossed ? middle : middle - reach, top, reach, 3);
  ctx.fillStyle = PALETTE.Y;
  ctx.fillRect(middle, top - 1, 1, 5);
}

export function drawDuelStage(
  ctx: CanvasRenderingContext2D,
  view: DuelView,
  crest: Crest,
  options: { opponent?: "rival" | "senior"; opponentColors?: Record<string, string>; playerColors?: Record<string, string>; gear?: Gear; referees?: boolean; reducedMotion?: boolean; facing?: OpponentId | null } = {},
): void {
  const { opponent = "rival", opponentColors, playerColors: playerLook, gear, referees = true, reducedMotion = false, facing = null } = options;
  const { duel } = view;
  const shakeX = view.shake > 0 ? (view.shake % 2 === 0 ? 1 : -1) : 0;
  ctx.save();
  ctx.translate(shakeX, 0);
  drawDuelBackdrop(ctx, crest);
  ctx.translate(stageX(), stageY());
  const side = courtside(crest, facing);
  drawWatchers(ctx, crest, side, view.walkTick, reducedMotion, true, view.excitement > 0);
  if (referees) drawShinpan(ctx, side, view.flags);

  const order: (0 | 1)[] = view.strikeTicks[0] > 0 ? [1, 0] : [0, 1];
  const ceremony = duel.phase === "bow" ? ceremonyAt(duel.phaseTicks) : null;
  const closing = duel.phase === "closing" ? closingAt(duel.phaseTicks) : duel.phase === "over" ? closingAt(1) : null;
  for (const i of order) {
    const fighter = duel.fighters[i];
    const track = view.poses[i];
    const pose = track.now;
    const walking = view.moving[i] || (ceremony !== null && ceremony.pose === "taito") || (closing?.walking ?? false);
    const legs = legsFor(view.walkTick, walking);
    const frame = legs === "step" ? 1 : legs === "close" ? 2 : 0;
    const inward = faceDir(duel, i);
    const homeward = -inward;
    const offCourt = duel.phase === "over" ? view.overTicks * WALK_OFF_SPEED : 0;
    const back = (ceremony?.stepBack ?? 0) + (closing?.stepBack ?? 0) + offCourt;
    const lunge = view.strikeTicks[i] > 0 && !view.hikiStrike[i] ? LUNGE * (view.strikeTicks[i] / STRIKE_POSE_TICKS) : 0;
    const x = screenX(duel, fighter.x) + back * homeward + (lunge - view.knock[i]) * inward;
    const other = duel.fighters[i === 0 ? 1 : 0];
    // Walking back, you face where you're going until you're nearly there. Leaving, you've turned your back.
    const toLine = startX(i) - fighter.x;
    const flip = closing?.away ? i === 0 : duel.phase === "point" && Math.abs(toLine) > FACE_LINE_WITHIN ? toLine < 0 : undefined;
    // A commanding presence glows all the time, not just when charging.
    const pressing = !!duel.options.presence?.[i] && (fighter.stance === "guard" || fighter.stance === "block");
    const charging = fighter.stance === "seme" || (pressing && duel.phase === "fight");
    const power = charging ? Math.min(1, Math.max(pressing ? 0.5 : 0, other.pressure / SEME_TICKS)) : 0;
    const tremble = charging && !reducedMotion && power > 0.5 && view.walkTick % 2 === 0 ? 1 : 0;
    // Standing in guard, nobody is completely still: a breath, and the tip wandering a little.
    const resting = pose === "guard" && track.age > 8 && !reducedMotion && duel.phase === "fight";
    const bob = resting && Math.floor((view.walkTick + i * 17) / BREATH_TICKS) % 2 === 1 ? 1 : 0;
    const sway = resting ? Math.sin((view.walkTick + i * 29) / SWAY_TICKS) * SWAY_DEGREES : 0;
    const shaking = duel.lock && duel.lock.ticks % 2 === 0 && duel.lock.pushing[i] && !reducedMotion ? 1 : 0;
    if (charging) drawAuraBack(ctx, x, GROUND, view.walkTick, power, reducedMotion);
    const blend = blendOf(track);
    const facesLeft = flip ?? inward < 0;
    if (!reducedMotion && view.strikeTicks[i] > STRIKE_POSE_TICKS - TRAIL_TICKS) {
      drawSwingTrail(ctx, x, GROUND, track.was, pose, facesLeft, fighter.kamae);
    }
    drawFighter(ctx, x + tremble + shaking, GROUND, pose, i === 0 ? "player" : opponent, frame, i === 0 ? gear : undefined, { flip: facesLeft, colors: i === 1 ? opponentColors : playerLook, kamae: fighter.kamae, from: track.was, blend, bob, sway });
    if (charging) drawAuraFront(ctx, x, GROUND, view.walkTick, power, reducedMotion);
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
  if (duel.lock) drawLockMeter(ctx, screenX(duel, (duel.fighters[0].x + duel.fighters[1].x) / 2), duel.lock.balance, duel.crossed);

  for (const puff of view.dust) {
    const spread = 8 - puff.ticks;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(Math.round(puff.x - spread - 2), GROUND - 2, 2, 2);
    ctx.fillRect(Math.round(puff.x + spread + 2), GROUND - 2, 2, 2);
    ctx.fillRect(Math.round(puff.x), GROUND - 3 - Math.floor(spread / 2), 2, 2);
  }
  for (const spark of view.sparks) {
    const r = (spark.reach * (10 - spark.ticks)) / 10;
    ctx.fillStyle = spark.color;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.4], [0, 1.4], [-1.4, 0], [1.4, 0]]) {
      ctx.fillRect(Math.round(spark.x + dx * r), Math.round(spark.y + dy * r), 2, 2);
    }
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
  /** What's riding on this match. It's already been paid, so walking away just loses it. */
  let stake = 0;
  /** Whether this match costs you health, and whether what it cost has been taken yet. */
  let hurts = false;
  let hitsTaken = false;
  /** What the match took, for the panel at the end. */
  let hpLoss = 0;
  /** The first time you beat someone, they've got more to say about it. */
  let firstWin = false;

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
    if (knockedOut(game)) goDown(game, opposing);
    else if (game.tournament) finishTournamentMatch(game, false);
    else if (facingRenVisit(game)) {
      game.message = [REN_LATER];
      game.versus = null;
      game.go("club");
    } else if (stage === "recommendation" || stage === "verification") {
      game.message = [stage === "verification" ? VERIFY_WALKED : RECOMMEND_WALKED];
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
      game.message = [SENPAI_LINES[game.versus as SenpaiId].sparAgain];
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
    hurts = matchHurts(game.run, { cup: !!game.tournament, stage });
    hitsTaken = false;
    hpLoss = 0;
    firstWin = !game.run.beaten.includes(opposing);
    // A letter's tested with one point, whoever's testing it.
    const options = duelOptionsFor(game.run, game.versus, fullStrength);
    view = createDuelView(createDuel(stage === "verification" ? { ...options, pointsToWin: 1 } : options));
    const seed = Math.floor(Math.random() * 2 ** 31);
    const config = rivalConfigFor(game.run, game.versus, fullStrength);
    const mood = moodOf(config, seed ^ 0x5bd1e995);
    moodText = mood ? moodLine(opponentById(opposing).rival, mood.pace, mood.favourite) : null;
    rival = createRival(seed, withMood(config, seed ^ 0x5bd1e995));
    control = createPlayerControl();
    outcomeRecorded = false;
    overTicks = 0;
    game.debug.duel = view.duel;
  };

  return {
    enter: startMatch,
    // Once the last point's in, nothing's left to walk away from.
    forfeitLabel: () => (view.duel.winner !== null ? null : FORFEIT_MATCH),
    forfeit: walkAway,
    update(game) {
      const { input } = game;
      if (view.duel.phase === "over") {
        const won = view.duel.winner === 0;
        // A senpai win is recorded when you carry on, along with what it earned. A tournament keeps its own score.
        if (!outcomeRecorded) {
          outcomeRecorded = true;
          game.run = payBet(game.run, stake, won);
          takeHits(game, won);
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
          else if (facingRenVisit(game)) {
            game.run = renPointOutcome(game.run, won);
            game.versus = null;
            game.go("club");
          } else if (stage) {
            const home = game.run.node === "pinecone";
            const reply = stage === "recommendation" ? recommendationOutcome(game.run, won, home ? undefined : opponentById(opposing).rival) : stage === "verification" ? verificationOutcome(game.run, won) : gradingOutcome(game.run, won);
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
      playSemeHum(game.audio, view.duel.fighters[0].stance === "seme", view.walkTick);
      tickView(view);
    },
    render(ctx, game) {
      const dojo = opponentById(opposing);
      const scripted = opposing === "renVisit";
      const inTournament = !!game.tournament;
      const crest = game.tournament ? CUPS[game.tournament.cup].crest : dojo.crest;
      drawDuelStage(ctx, view, crest, { opponentColors: dojo.colors, playerColors: playerColors(game.run), gear: game.run.gear, reducedMotion: game.reducedMotion, facing: opposing });
      const theirDan = personDan(opposing);
      drawDuelHud(ctx, view, [`You ${rankLabel(game.run)}`, theirDan ? `${dojo.rival} ${danLabel(theirDan)}` : dojo.rival], view.duel.lock ? lockHelp(!view.duel.crossed) : helpLine(view.walkTick, game.run.seme), 0, hurts && !hitsTaken ? Math.max(0, game.run.hp - view.duel.fighters[1].points * HP_PER_POINT) : hurts ? game.run.hp : undefined);
      const { duel } = view;
      // On the easier fights, show which key answers the tell that's coming.
      const them = duel.fighters[1];
      if (duel.phase === "fight" && them.stance === "windup" && them.attack && promptsShown(opposing, lossesHere(game.run, opposing), inTournament && game.tournament?.cup !== "pinecone", game.run.gaze)) {
        const windup = duel.options.windups?.[1]?.[them.attack] ?? ATTACKS[them.attack].windup;
        const left = them.stanceTicks / windup;
        onStage(ctx, () => drawKeyPrompt(ctx, screenX(duel, them.x), GROUND, counterPrompt(them.attack!, them.kamae), left));
      }
      onGui(ctx, () => {
        if (stake && view.duel.phase !== "over") drawTextCentered(ctx, betHud(stake), viewW / 2, 12, UI.accent);
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
        if (duel.phase === "point" && duel.lastScore) {
          const scorer = duel.lastScore.by === 0;
          const label = "IPPON!";
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, 22, viewW, 30);
          drawText(ctx, label, (viewW - measureText(label) * 3) / 2, 26, scorer ? UI.bad : UI.text, 3);
        }
        // There's no wait after a point any more, so what to try next stays up a little way into the next one.
        const showTip = duel.lastScore?.by === 1 && duel.winner === null && (duel.phase === "point" || (duel.phase === "fight" && view.sincePoint < TIP_LINGER_TICKS));
        if (showTip && duel.lastScore) {
          const room = Math.min(viewW - 16, WIDE_TEXT);
          const lines = wrapText(scripted ? REN_POINT_TIP : tipFor(duel.lastScore, game.run.seme, them.kamae), room - 8);
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
            { text: stage === "tachiai" ? (won ? "Passed!" : "Not today") : stage === "recommendation" ? (won ? "Vouched for!" : "Not yet") : won ? "You win!" : `${dojo.rival} wins`, color: won ? UI.bad : UI.text, big: true },
            ...tip.map((text) => ({ text, color: UI.accent })),
            ...(stake ? [{ text: won ? betWon(stake) : betLost(stake), color: won ? UI.good : UI.bad }] : []),
            ...(hpLoss > 0 ? [{ text: hpLost(hpLoss, game.run.hp), color: UI.bad }] : []),
            ...(knockedOut(game) ? [{ text: CANT_GO_ON, color: UI.bad }] : []),
            ...(knockedOut(game) ? [] : [{ text: won ? "Well fought." : scripted ? REN_POINT_NEXT : inTournament ? TAIKAI_LOST : !inTournament && lossesHere(game.run, opposing) > 1 ? `${dojo.rival} looks tired. Go again?` : "Rei, and go again.", color: UI.dim }]),
            { text: won || inTournament || scripted || stage || knockedOut(game) ? "E or Space: continue" : "E: rematch   S: walk away", color: UI.text },
          ]));
        }
      });
    },
  };
}
