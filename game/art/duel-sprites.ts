import { MEN_INHERITS, PALETTE, RIVAL_COLORS, SENIOR_COLORS } from "./palette.ts";
import { FULL_GEAR, type Gear } from "./kendoka.ts";
import type { Kamae } from "../duel/rules.ts";
import { drawSprite, grid } from "./sprite.ts";

export const FIGHTER_WIDTH = 32;
export const FIGHTER_HEIGHT = 40;

export type DuelPose =
  | "guard" | "bow" | "block"
  | "sageto" | "taito" | "draw" | "sonkyo" | "launch" | "seme"
  | "tellHandsUp" | "tellTipDip" | "tellBigRaise"
  | "strikeMen" | "strikeKote" | "strikeDo"
  | "zanshin" | "recover" | "stunned"
  | "walkHome" | "sonkyoSheathe" | "hit"
  | "parry" | "suriage" | "deflected" | "stumble"
  | "tsuba" | "tsubaPush" | "tsubaGuard" | "tsubaPull" | "tsubaPart"
  | "hikiMen" | "hikiKote" | "hikiDo"
  | "sayuRaise" | "sayuLeft" | "sayuRight" | "receiveLeft" | "receiveRight";

/** Drawn facing right. Rows line up so the head, torso and legs can shift independently. */
const HEAD = grid(FIGHTER_WIDTH, 17, [
  ".........NNNNNNNNN",
  ".......NNIIIIIIIIINN",
  "......NIIiiiiiIIIIIIN",
  ".....NIIiiIIIIIIIIIIIN",
  "....TNIIIIIIIIIIIIIIIIN",
  "...TtNIAIIIAIMMMMMMMMMMMN",
  "....TNIIIIIIIMSSSSMSSSSMN",
  ".....NIAIEIAIMSKKSMSKKSMN",
  ".....NIIEEEIIMSKKSMSKKSMN",
  ".....NIAIEIAIMSKKSMSKKSMN",
  ".....NIIIIIIIMMMMMMMMMMMN",
  ".....NIAIIIAIMPPSSMSSPPMN",
  ".....NIIIIIIIMMMMMMMMMMMN",
  "......NIIIIIIIIIIIIIIN",
  ".....NIINUUUUUUUTTTUN",
  "....NIINNUUUUUUUTTTUN",
  "....NIN..NNNNNNNNNNN",
]);

/** The player before the men goes on. */
const HEAD_BARE = grid(FIGHTER_WIDTH, 17, [
  ".........KKKKKKKK",
  ".......KKKKKKKKKKK",
  "......KKKkkKKKKKKKK",
  ".....KKKkkKKKKKKKKKK",
  ".....KKKKKKKKKKKKKKKK",
  ".....KKKKKKKKKSSSSSSSK",
  ".....KKKKKKKKSSSSSSSSK",
  ".....KKKKKKKSSKKSSKKSK",
  ".....KKKKKKKSSKKSSKKSK",
  ".....KKKKKKKSSKKSSKKSK",
  "......KKKKKKSSSSSSSSSK",
  "......KKKKKKPPSSSSPPSK",
  ".......KKKKKSSSSSSSSK",
  "........KKKKSSSKSSSK",
  ".........KKKKSSSSSK",
  "..........KKKKKKK",
]);

const CHEST_DO = grid(FIGHTER_WIDTH, 5, [
  ".......NWWWWWWIIIIIIN",
  "......NWWWWWWKKKKKKKKN",
  "......NWWWWWKKiiKKKKKN",
  "......NWWWWWKiKKKKKKKN",
  ".......NwWWWKKKKKKKKN",
]);
const CHEST_GI = grid(FIGHTER_WIDTH, 5, [
  ".......NWWWWWWWWWWWWN",
  "......NWWWWWWWIIWWWWWN",
  "......NWWWWWWWWIIWWWWN",
  "......NWWWWWWWWWWWWWWN",
  ".......NwWWWWWWWWWWWN",
]);
const WAIST_TARE = grid(FIGHTER_WIDTH, 6, [
  ".......NIIIIIIIIIIIIN",
  "......NIIIiIIIZZZZIIIN",
  "......NIIIiIIIZzzZIIIN",
  "......NIIIiIIIZZZZIIIN",
  ".......NNIIIIIIIIIINN",
  ".......NNNNNNNNNNNNN",
]);
const WAIST_PLAIN = grid(FIGHTER_WIDTH, 6, [
  ".......NNNNNNNNNNNNNN",
  "......NNNNNNNNNNNNNNNN",
  "......NNNNKNNNNKNNNNNN",
  "......NNNNKNNNNKNNNNNN",
  ".......NNNKNNNNKNNNNN",
  ".......NNNNNNNNNNNNNN",
]);

const LEGS_STAND = grid(FIGHTER_WIDTH, 12, [
  ".......NNNKNNNNNKNNNN",
  ".......NNNKNNNNNKNNNN",
  "......NNNNKNNNNNKNNNNN",
  "......NNNNKNNNNNKNNNNN",
  "......NNNKNNNNNNNKNNNN",
  ".....NNNNKNNNNNNNKNNNNN",
  ".....NNNNKNNNNNNNKNNNNN",
  ".....NNNNNNNNNNNNNNNNNN",
  "......NNNN.NNNNN.NNNNN",
  ".......NSSSN......NSSSSN",
  "......KSSSSSK....KSSSSSSK",
  "......KKKKKKK....KKKKKKKK",
]);

const LEGS_STEP = grid(FIGHTER_WIDTH, 12, [
  ".......NNNKNNNNNKNNNN",
  ".......NNNKNNNNNKNNNN",
  "......NNNNKNNNNNKNNNNN",
  "......NNNNKNNNNNKNNNNN",
  ".....NNNNKNNNNNNNKNNNNN",
  ".....NNNNKNNNNNNNKNNNNNN",
  "....NNNNNKNNN.NNNNKNNNNNN",
  "....NNNNNNNN...NNNNNNNNNN",
  ".....NNNNNN.....NNNNNNNN",
  "......NSSSN........NSSSSN",
  ".....KSSSSSK......KSSSSSSK",
  ".....KKKKKKK......KKKKKKKK",
]);

const LEGS_LUNGE = grid(FIGHTER_WIDTH, 12, [
  "........NNNKNNNNNKNNNN",
  "........NNNKNNNNNKNNNNN",
  ".......NNNNKNNNNNNKNNNNN",
  "......NNNNKNNNN.NNNKNNNNN",
  ".....NNNNKNNN...NNNNKNNNNN",
  "....NNNNNKNN.....NNNNKNNNNN",
  "...NNNNNNNN.......NNNNNNNNNN",
  "..NNNNNNN..........NNNNNNNN",
  "..NNNNN..............NNNNNN",
  "..KSSSN................NSSSSN",
  "...KSSSK..............KSSSSSSK",
  "...KKKKK..............KKKKKKKK",
]);

/** Feet drawn together, as the rear foot catches up. */
const LEGS_CLOSE = grid(FIGHTER_WIDTH, 12, [
  ".......NNNKNNNNNKNNNN",
  ".......NNNKNNNNNKNNNN",
  ".......NNNKNNNNNKNNNN",
  ".......NNNKNNNNNKNNNN",
  "......NNNNKNNNNNKNNNN",
  "......NNNNKNNNNNKNNNNN",
  "......NNNNKNNNNNKNNNNN",
  "......NNNNNNNNNNNNNNNN",
  ".......NNNNN..NNNNNNN",
  "........NSSSN.NSSSSN",
  ".......KSSSSKKSSSSSSK",
  ".......KKKKKKKKKKKKKK",
]);

/** Sonkyo: balanced on the balls of the feet, with the knees open. */
const LEGS_SONKYO = grid(FIGHTER_WIDTH, 12, [
  "",
  "",
  "",
  "",
  "",
  "",
  "....NNNNNNNNNNNNNNNNNNNNNN",
  "...NNNNNNNNNNNNNNNNNNNNNNNN",
  "...NNNNNNNN......NNNNNNNNNN",
  ".......NSSN.......NSSN",
  ".......KSSK.......KSSK",
  ".......KKKK.......KKKK",
]);

/** A bully, flat on the ground. */
export const BULLY_DOWN = grid(FIGHTER_WIDTH, 12, [
  "",
  "",
  "",
  "",
  "..............KKKKK",
  "............KKKKKKKKK",
  ".....NNNNNWWWWWKKSSSSK",
  "...NNNNNNWWWWWWKSKSKSK",
  ".SSNNNNNNWWWWWWKSSSSSK",
  ".SSNNNNNNNWWWWWSKKSSK",
  "...NNNNNNNNWWWSSKKKK",
  "...........SSS",
]);

/** A referee in a navy blazer, with the red and white flags drawn separately. */
const REFEREE = grid(16, 22, [
  "....KKKKKKKK",
  "...KKKKKKKKKK",
  "..KKkkKKKKKKKK",
  "..KKSSSSSSSSKK",
  "..KSSSSSSSSSSK",
  "..KSSKSSSSKSSK",
  "..KSSKSSSSKSSK",
  "..KPSSSSSSSSPK",
  "...KSSSSSSSSK",
  "....KKKKKKKK",
  "...KNNNWWNNNK",
  "..KNNNNRRNNNNK",
  "..KNNNNRRNNNNK",
  "..KSKNNNNNNKSK",
  "...KNNNNNNNNK",
  "...KwwwwwwwwK",
  "...KwwwKKwwwK",
  "...KwwwKKwwwK",
  "...KwwwKKwwwK",
  "...KwwK..KwwK",
  "...KKKK..KKKK",
]);

const STARS = grid(16, 6, [
  "..Y........Y",
  ".YYY......YYY",
  "..Y...Y....Y",
  ".....YYY",
  "......Y",
]);

export const DUEL_GRIDS: Record<string, string[]> = {
  duelHead: HEAD,
  duelHeadBare: HEAD_BARE,
  duelChestDo: CHEST_DO,
  duelChestGi: CHEST_GI,
  duelWaistTare: WAIST_TARE,
  duelWaistPlain: WAIST_PLAIN,
  duelLegsStand: LEGS_STAND,
  duelLegsStep: LEGS_STEP,
  duelLegsLunge: LEGS_LUNGE,
  duelLegsClose: LEGS_CLOSE,
  duelLegsSonkyo: LEGS_SONKYO,
  bullyDown: BULLY_DOWN,
  referee: REFEREE,
  stars: STARS,
};

export type PoseDef = {
  /** Hand position, in sprite pixels from the top-left, facing right. */
  hand: [number, number];
  /** Shinai direction in degrees. 0 points forward, negative points up. */
  angle: number;
  head?: [number, number];
  torso?: [number, number];
  legs?: "stand" | "step" | "lunge" | "sonkyo";
  /** Held in the left hand and not yet drawn. */
  sheathed?: boolean;
};

export const POSES: Record<DuelPose, PoseDef> = {
  guard: { hand: [24, 26], angle: -22 },
  // Sageto: arm relaxed, shinai in the left hand with the tip forward and low.
  sageto: { hand: [12, 30], angle: 28, sheathed: true },
  bow: { hand: [13, 31], angle: 30, head: [4, 4], torso: [2, 1], sheathed: true },
  // Taito: brought up to the left hip, as if worn.
  taito: { hand: [13, 26], angle: 14, sheathed: true },
  // The blade comes up high as it's drawn, and only comes down on the way into sonkyo.
  draw: { hand: [24, 17], angle: -64, head: [0, 1], torso: [0, 1] },
  sonkyo: { hand: [23, 33], angle: -24, head: [0, 9], torso: [0, 9], legs: "sonkyo" },
  // Powering up: planted, shoulders back, shinai rising.
  seme: { hand: [23, 24], angle: -42, head: [0, -1], torso: [0, -1] },
  // The rear foot stays planted and drives the lead foot a long way forward.
  launch: { hand: [29, 24], angle: -14, head: [3, 1], torso: [2, 0], legs: "lunge" },
  block: { hand: [25, 19], angle: -82, torso: [-1, 0], head: [-1, 0] },
  // The three tells. They need to read differently at a glance.
  tellHandsUp: { hand: [23, 18], angle: -48, head: [0, -1] },
  tellTipDip: { hand: [25, 28], angle: 24 },
  tellBigRaise: { hand: [13, -2], angle: -155, head: [-1, 1], torso: [-1, 0], legs: "step" },
  strikeMen: { hand: [31, 15], angle: -6, head: [4, 0], torso: [3, 0], legs: "lunge" },
  strikeKote: { hand: [31, 21], angle: 6, head: [4, 1], torso: [3, 0], legs: "lunge" },
  strikeDo: { hand: [32, 25], angle: 16, head: [4, 2], torso: [3, 1], legs: "lunge" },
  // The hands go straight back up after the cut, and stay up all the way through.
  zanshin: { hand: [27, 2], angle: -106, head: [2, -1], torso: [2, 0], legs: "step" },
  recover: { hand: [22, 30], angle: 38, head: [1, 2], torso: [0, 1] },
  stunned: { hand: [20, 31], angle: 50, head: [0, 3], torso: [0, 2] },
  // Walking back to the line, with the tip lowered. It isn't a guard, because nobody's fighting yet.
  walkHome: { hand: [21, 30], angle: 24, head: [0, 1], torso: [0, 1] },
  // Osame-to: still crouched, with the shinai brought back to the left hip.
  sonkyoSheathe: { hand: [13, 33], angle: 14, head: [0, 9], torso: [0, 9], legs: "sonkyo", sheathed: true },
  // Taking one: nobody reels or drops their hands. The head gives a little and the hands come up, too late.
  hit: { hand: [24, 23], angle: -40, head: [-2, 0] },
  // Rising to meet the strike, then knocking it off line.
  parry: { hand: [26, 17], angle: -66, head: [1, 0] },
  suriage: { hand: [28, 10], angle: -104, head: [2, -1], torso: [1, 0] },
  deflected: { hand: [25, 7], angle: -128, head: [-2, 1], torso: [-1, 1] },
  // Thrown off balance, leaning into nothing.
  stumble: { hand: [21, 32], angle: 42, head: [3, 3], torso: [2, 2], legs: "step" },
  // Hilt to hilt: the hands meet at the chest and both shinai stand up between you.
  tsuba: { hand: [25, 20], angle: -86, head: [1, 0], torso: [1, 0], legs: "step" },
  tsubaPush: { hand: [26, 19], angle: -78, head: [3, 1], torso: [3, 1], legs: "lunge" },
  tsubaGuard: { hand: [24, 18], angle: -94, head: [-1, 0], legs: "step" },
  // The tell: shoulders drop and the hands come down, ready to spring back.
  tsubaPull: { hand: [21, 28], angle: -54, head: [-3, 2], torso: [-2, 2], legs: "step" },
  // Coming apart: the bodies go first, and the tip stays up until there's distance.
  tsubaPart: { hand: [25, 19], angle: -66, legs: "step" },
  // Cutting on the way back, so the body leans away from the strike.
  hikiMen: { hand: [27, 15], angle: -6, head: [-2, 0], torso: [-2, 0], legs: "step" },
  hikiKote: { hand: [27, 21], angle: 6, head: [-2, 1], torso: [-2, 0], legs: "step" },
  hikiDo: { hand: [28, 25], angle: 16, head: [-2, 2], torso: [-2, 1], legs: "step" },
  // Kirikaeshi: the shinai goes right back behind the head between strikes.
  sayuRaise: { hand: [14, -1], angle: -168, head: [-1, 0], torso: [-1, 0], legs: "step" },
  // The arms reach full length and the cut lands high, angled in. The sides differ so the alternation shows from side-on.
  sayuLeft: { hand: [31, 12], angle: -36, head: [3, 0], torso: [2, 0], legs: "step" },
  sayuRight: { hand: [30, 15], angle: -22, head: [3, 1], torso: [2, 0], legs: "step" },
  // The partner holds the shinai upright and turns it to meet each one, stepping all the while.
  receiveLeft: { hand: [25, 16], angle: -96, head: [-1, 0], legs: "step" },
  receiveRight: { hand: [22, 18], angle: -82, head: [-1, 0], legs: "step" },
};

/** Jodan's hands stay over the head, so it reads differently at a glance. Anything not listed is as usual. */
const JODAN_POSES: Partial<Record<DuelPose, PoseDef>> = {
  guard: { hand: [25, 5], angle: -138 },
  seme: { hand: [24, 3], angle: -125, head: [0, -1], torso: [0, -1] },
  block: { hand: [26, 8], angle: -105, torso: [-1, 0], head: [-1, 0] },
  launch: { hand: [29, 7], angle: -128, head: [3, 1], torso: [2, 0], legs: "lunge" },
  // Hands pull back before a men, which is your cue for the wrist.
  tellHandsUp: { hand: [19, 1], angle: -168, head: [-1, 1], torso: [-1, 0] },
  // The tip tips forward before a kote, which opens the body.
  tellTipDip: { hand: [28, 4], angle: -58 },
};
/** Nito's long sword rises, while the short one stays out in front. */
const NITO_POSES: Partial<Record<DuelPose, PoseDef>> = {
  guard: { hand: [27, 14], angle: -68 },
  seme: { hand: [26, 11], angle: -80, head: [0, -1], torso: [0, -1] },
  block: { hand: [26, 12], angle: -48, torso: [-1, 0], head: [-1, 0] },
  launch: { hand: [27, 13], angle: -55, head: [3, 1], torso: [2, 0], legs: "lunge" },
  tellHandsUp: { hand: [23, 3], angle: -118, head: [-1, 0] },
  tellTipDip: { hand: [19, 5], angle: -150, head: [-1, 0], torso: [-1, 0] },
};
const KAMAE_POSES: Record<Kamae, Partial<Record<DuelPose, PoseDef>>> = { chudan: {}, jodan: JODAN_POSES, nito: NITO_POSES };
const SHORT_SWORD: { hand: [number, number]; angle: number } = { hand: [25, 26], angle: -16 };
const SHORT_BLOCK: { hand: [number, number]; angle: number } = { hand: [27, 15], angle: -132 };
const SHORT_BLADE = 13;

const poseDef = (pose: DuelPose, kamae: Kamae): PoseDef => KAMAE_POSES[kamae][pose] ?? POSES[pose];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixPair = (a: [number, number] | undefined, b: [number, number] | undefined, t: number): [number, number] => [
  Math.round(mix(a?.[0] ?? 0, b?.[0] ?? 0, t)),
  Math.round(mix(a?.[1] ?? 0, b?.[1] ?? 0, t)),
];

/** Partway from one pose to another. The hands and body move, and the legs and which hand holds it go straight to the new pose. */
export function blendPose(from: PoseDef, to: PoseDef, t: number): PoseDef {
  if (t >= 1) return to;
  return {
    ...to,
    hand: mixPair(from.hand, to.hand, t),
    angle: mix(from.angle, to.angle, t),
    head: mixPair(from.head, to.head, t),
    torso: mixPair(from.torso, to.torso, t),
  };
}

const COIL_LIFT = 4;
const COIL_DEGREES = 18;
const COIL_LEGS_AT = 0.3;

/** A pose with the strike gathering in it: hands higher, blade further back, and the lead foot already going. */
function coiled(def: PoseDef, coil: number): PoseDef {
  if (coil <= 0) return def;
  return {
    ...def,
    hand: [def.hand[0], def.hand[1] - Math.round(coil * COIL_LIFT)],
    angle: def.angle - coil * COIL_DEGREES,
    legs: def.legs ?? (coil >= COIL_LEGS_AT ? "step" : undefined),
  };
}

const SHINAI_BLADE = 25;
const SHINAI_GRIP = 6;
const STICK_LENGTH = 15;

function drawArmAndShinai(
  px: (x: number, y: number, color: string, size?: number) => void,
  shoulder: [number, number],
  hand: [number, number],
  angle: number,
  kote: boolean,
  weapon: "shinai" | "stick" | "none",
  blade = SHINAI_BLADE,
): void {
  const dx = Math.cos((angle * Math.PI) / 180);
  const dy = Math.sin((angle * Math.PI) / 180);
  if (weapon === "shinai") {
    // Grip behind the hand, then the blade forward of it.
    for (let i = -SHINAI_GRIP; i <= blade; i++) {
      const x = Math.round(hand[0] + dx * i);
      const y = Math.round(hand[1] + dy * i);
      let color = PALETTE.Y;
      if (i < 0) color = PALETTE.W;
      else if (i <= 1) color = PALETTE.K;
      else if (i >= blade - 3) color = PALETTE.W;
      else if (i % 6 === 0) color = PALETTE.y;
      px(x, y, color, 2);
    }
  } else if (weapon === "stick") {
    for (let i = -2; i <= STICK_LENGTH; i++) {
      px(Math.round(hand[0] + dx * i), Math.round(hand[1] + dy * i), PALETTE.b, 2);
    }
  }
  // Sleeve from shoulder to wrist: an outline pass first, so it reads as an arm over the armor.
  const steps = Math.max(Math.abs(hand[0] - shoulder[0]), Math.abs(hand[1] - shoulder[1]), 1);
  const along = (s: number): [number, number] => [
    Math.round(shoulder[0] + ((hand[0] - shoulder[0]) * s) / steps),
    Math.round(shoulder[1] + ((hand[1] - shoulder[1]) * s) / steps),
  ];
  for (let s = 0; s <= steps; s++) {
    const [x, y] = along(s);
    px(x - 2, y - 2, PALETTE.N, 5);
  }
  for (let s = 0; s <= steps; s++) {
    const [x, y] = along(s);
    px(x - 1, y - 1, kote && s / steps > 0.55 ? PALETTE.I : PALETTE.W, 3);
  }
  // Kote mitten on the grip, or a bare hand until they're earned.
  px(hand[0] - 2, hand[1] - 2, PALETTE.N, 5);
  px(hand[0] - 1, hand[1] - 1, kote ? PALETTE.I : PALETTE.S, 3);
}

/** x is the fighter's center and y is the ground. The player faces right and the rival faces left. */
export function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: DuelPose,
  side: "player" | "rival" | "senior",
  frame: number,
  gear: Gear = FULL_GEAR,
  options: {
    flip?: boolean;
    colors?: Record<string, string>;
    weapon?: "shinai" | "stick" | "none";
    kamae?: Kamae;
    /** The pose being left behind, and how far through leaving it, from 0 to 1. */
    from?: DuelPose;
    blend?: number;
    /** A breath: this many pixels down for the whole upper body. */
    bob?: number;
    /** The tip wandering, in degrees. */
    sway?: number;
    /** How far a strike has gathered itself, from 0 to 1. */
    coil?: number;
    /** How fast they're going, from 0 to 1, for what streams out behind them, and the tick that ripples it. */
    motion?: { speed: number; tick: number };
  } = {},
): void {
  const kamae = options.kamae ?? "chudan";
  const target = poseDef(pose, kamae);
  const blended = options.from && options.from !== pose ? blendPose(poseDef(options.from, kamae), target, options.blend ?? 1) : target;
  const bob = options.bob ?? 0;
  const swayed: PoseDef = bob || options.sway
    ? {
        ...blended,
        hand: [blended.hand[0], blended.hand[1] + bob],
        angle: blended.angle + (options.sway ?? 0),
        head: [blended.head?.[0] ?? 0, (blended.head?.[1] ?? 0) + bob],
        torso: [blended.torso?.[0] ?? 0, (blended.torso?.[1] ?? 0) + bob],
      }
    : blended;
  const def = coiled(swayed, options.coil ?? 0);
  const flip = options.flip ?? side !== "player";
  const colors = options.colors ?? (side === "rival" ? RIVAL_COLORS : side === "senior" ? SENIOR_COLORS : undefined);
  const weapon = options.weapon ?? "shinai";
  const left = Math.round(x) - FIGHTER_WIDTH / 2;
  const top = Math.round(y) - FIGHTER_HEIGHT;

  const [headX, headY] = def.head ?? [0, 0];
  const [torsoX, torsoY] = def.torso ?? [0, 0];
  const walkLegs = [LEGS_STAND, LEGS_STEP, LEGS_CLOSE][frame % 3];
  const legs =
    def.legs === "lunge" ? LEGS_LUNGE
    : def.legs === "sonkyo" ? LEGS_SONKYO
    : def.legs === "step" ? LEGS_STEP
    : walkLegs;

  const place = (rows: string[], dx: number, dy: number) => {
    const width = rows[0].length;
    const drawX = flip ? left + FIGHTER_WIDTH - width - dx : left + dx;
    drawSprite(ctx, rows, drawX, top + dy, { flip, colors });
  };
  place(legs, 0, 28);

  // The men's details share their default colors with other things, and those mustn't change along with them.
  const swaps = new Map(Object.entries(colors ?? {}).filter(([key]) => !(key in MEN_INHERITS)).map(([key, value]) => [PALETTE[key], value]));
  const exactly = (dx: number, dy: number, color: string, size = 1) => {
    ctx.fillStyle = color;
    const drawX = flip ? left + FIGHTER_WIDTH - dx - size : left + dx;
    ctx.fillRect(drawX, top + dy, size, size);
  };
  const px = (dx: number, dy: number, color: string, size = 1) => exactly(dx, dy, swaps.get(color) ?? color, size);
  // Facing right, the left hand is on the far side of the body.
  const shoulder: [number, number] = [16 + torsoX, 20 + torsoY];
  const armBehind = def.sheathed && side === "player" && !flip;
  if (armBehind) drawArmAndShinai(px, shoulder, def.hand, def.angle, gear.kote, weapon);
  place(gear.do ? CHEST_DO : CHEST_GI, torsoX, 17 + torsoY);
  place(gear.tare ? WAIST_TARE : WAIST_PLAIN, torsoX, 22 + torsoY);

  // The tasuki ribbon ties to the do, and matches the flag the referees raise.
  if (gear.do) {
    const ribbon = side === "player" ? PALETTE.R : PALETTE.W;
    px(5 + torsoX, 20 + torsoY, ribbon, 2);
    px(4 + torsoX, 22 + torsoY, ribbon, 2);
    px(3 + torsoX, 24 + torsoY, ribbon, 2);
  }
  if (options.motion) {
    const { speed, tick } = options.motion;
    // The hem of the hakama flares out behind a big step.
    if (speed > 0 && def.legs === "lunge") {
      for (let k = 0; k < HEM_ROWS; k++) px(1 - k - (tick >> 2) % 2, 34 + k, PALETTE.N, 2);
    }
    // The men's ties hang down at rest and stream out behind at speed.
    if (gear.men) {
      for (let strand = 0; strand < 2; strand++) {
        for (let k = 1; k <= HIMO_LENGTH; k++) {
          const ripple = speed > 0 ? Math.round(Math.sin((tick + strand * 5) / 2 - k) * speed) : 0;
          const fall = k * (1 - speed) + (speed * k) / 3 + ripple;
          const tieX = 4 + headX - strand - Math.round(k * (0.25 + speed * 0.75));
          const tieY = 6 + headY + strand + Math.round(fall);
          const own = colors?.[strand ? "t" : "T"];
          if (own) exactly(tieX, tieY, own);
          else px(tieX, tieY, strand ? PALETTE.r : PALETTE.R);
        }
      }
    }
  }
  // Arms raised over the head go on after it.
  const overHead = kamae !== "chudan" && def.hand[1] < 12;
  if (overHead) place(gear.men ? HEAD : HEAD_BARE, headX, headY);
  if (!armBehind) drawArmAndShinai(px, shoulder, def.hand, def.angle, gear.kote, weapon);
  if (kamae === "nito" && !def.sheathed) {
    const short = pose === "block" ? SHORT_BLOCK : SHORT_SWORD;
    drawArmAndShinai(px, [shoulder[0] + 2, shoulder[1] + 1], [short.hand[0] + torsoX, short.hand[1] + torsoY], short.angle, gear.kote, weapon, SHORT_BLADE);
  }
  if (!overHead) place(gear.men ? HEAD : HEAD_BARE, headX, headY);

  if (pose === "stunned" || pose === "stumble") {
    place(STARS, 8 + (frame % 2), -3 + headY);
  }
}

const HEM_ROWS = 3;
const HIMO_LENGTH = 6;

const TRAIL_SAMPLES = 6;
const TRAIL_TIP = SHINAI_BLADE + 1;

/** The arc the shinai tip has just cut through, drawn behind the swing. x is the fighter's center and y is the ground. */
export function drawSwingTrail(ctx: CanvasRenderingContext2D, x: number, y: number, from: DuelPose, to: DuelPose, flip: boolean, kamae: Kamae = "chudan"): void {
  const a = poseDef(from, kamae);
  const b = poseDef(to, kamae);
  const left = Math.round(x) - FIGHTER_WIDTH / 2;
  const top = Math.round(y) - FIGHTER_HEIGHT;
  ctx.fillStyle = PALETTE.W;
  for (let i = 0; i < TRAIL_SAMPLES; i++) {
    const t = i / TRAIL_SAMPLES;
    const hand = [mix(a.hand[0], b.hand[0], t), mix(a.hand[1], b.hand[1], t)];
    const angle = (mix(a.angle, b.angle, t) * Math.PI) / 180;
    const tipX = hand[0] + Math.cos(angle) * TRAIL_TIP;
    const tipY = hand[1] + Math.sin(angle) * TRAIL_TIP;
    const size = i < TRAIL_SAMPLES / 2 ? 1 : 2;
    ctx.fillRect(Math.round(flip ? left + FIGHTER_WIDTH - tipX - size : left + tipX), Math.round(top + tipY), size, size);
  }
}

/** Where the tip of the shinai is drawn right now. x is the fighter's center and y is the ground. */
export function shinaiTip(x: number, y: number, pose: DuelPose, flip: boolean, kamae: Kamae = "chudan", from?: DuelPose, blend = 1, coil = 0): [number, number] {
  const target = poseDef(pose, kamae);
  const { hand, angle } = coiled(from && from !== pose ? blendPose(poseDef(from, kamae), target, blend) : target, coil);
  const radians = (angle * Math.PI) / 180;
  const tipX = hand[0] + Math.cos(radians) * SHINAI_BLADE;
  const tipY = hand[1] + Math.sin(radians) * SHINAI_BLADE;
  const left = Math.round(x) - FIGHTER_WIDTH / 2;
  // The blade is two pixels wide, so its middle is one in from where it's drawn.
  return [Math.round(flip ? left + FIGHTER_WIDTH - tipX - 1 : left + tipX + 1), Math.round(y) - FIGHTER_HEIGHT + Math.round(tipY) + 1];
}

const SHINE_MIN_REACH = 2;
const SHINE_MAX_REACH = 8;
const SHINE_STILL_REACH = 5;
const SHINE_FULL_RAYS = 3;

/**
 * A glint on the tip: a four-pointed star that swells with brightness, from 0 to 1, and throws out extra rays once it's full.
 * It's the parry's cue, so reduced motion keeps it, holding one size.
 */
export function drawShine(ctx: CanvasRenderingContext2D, x: number, y: number, brightness: number, still = false): void {
  const reach = still ? SHINE_STILL_REACH : Math.round(SHINE_MIN_REACH + (SHINE_MAX_REACH - SHINE_MIN_REACH) * brightness);
  const star = (grow: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - reach - grow, y - grow, (reach + grow) * 2 + 1, 1 + grow * 2);
    ctx.fillRect(x - grow, y - reach - grow, 1 + grow * 2, (reach + grow) * 2 + 1);
  };
  // A dark edge, so it reads against pale plaster and bright sky alike.
  star(1, PALETTE.N);
  star(0, PALETTE.Y);
  ctx.fillStyle = PALETTE.W;
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillRect(x - Math.floor(reach / 2), y, reach + 1, 1);
  ctx.fillRect(x, y - Math.floor(reach / 2), 1, reach + 1);
  if (brightness < 1 || still) return;
  for (let ray = 2; ray <= SHINE_FULL_RAYS; ray++) {
    for (const [dx, dy] of [[-ray, -ray], [ray, -ray], [-ray, ray], [ray, ray]]) ctx.fillRect(x + dx, y + dy, 1, 1);
  }
}

/** A referee with one flag in each hand. Raising one shows which fighter they saw score. */
export function drawReferee(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  raised: "red" | "white" | null,
  colors?: Record<string, string>,
): void {
  const left = Math.round(x) - 8;
  const top = Math.round(y) - 21;
  drawSprite(ctx, REFEREE, left, top, { colors });
  const flag = (handX: number, color: string, up: boolean) => {
    ctx.fillStyle = PALETTE.B;
    if (up) {
      ctx.fillRect(left + handX, top + 2, 1, 12);
      ctx.fillStyle = color;
      ctx.fillRect(left + handX + (handX < 8 ? -5 : 1), top + 1, 5, 4);
    } else {
      ctx.fillRect(left + handX, top + 14, 1, 7);
      ctx.fillStyle = color;
      ctx.fillRect(left + handX + (handX < 8 ? -4 : 1), top + 17, 4, 3);
    }
  };
  flag(2, PALETTE.R, raised === "red");
  flag(13, PALETTE.W, raised === "white");
}
