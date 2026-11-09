import type { EquipmentId, EquipmentSlot, ModId } from "./equipment.ts";
import { wornKi } from "./durability.ts";
import { NO_GEAR, type Gear } from "./art/kendoka.ts";
import { DEFAULT_CHARACTER, type CharacterId } from "./characters.ts";
import { KI_MAX, TSUBA_KI_MAX } from "./duel/constants.ts";
import { PRESS_GIVES_UP_AT, rivalConfig, type RivalConfig } from "./duel/rival.ts";
import type { DuelOptions, Kamae } from "./duel/rules.ts";
import { DEFAULT_INSIGNIA, type Insignia } from "./insignia.ts";
import { earn } from "./money.ts";
import { atLeastDan, CUP_DAN, levelKi } from "./ranks.ts";
import { shopKi } from "./shop.ts";
import { opponentFor, opponentIdFor, SPAR_PARTNERS, type OpponentId } from "./world/dojos.ts";
import type { NodeId } from "./world/map.ts";
import type { CupId } from "./world/tournament.ts";

const GANG_REWARD = 10;
const TOWER_REWARD = 10;
const LINE_REWARD = 5;
/** Only this many passes of the line drill pay out in ki. */
const LINE_REWARDED_PASSES = 3;
/** The first few kirikaeshi passes grow your ki, as the line drill's do, so practice can't stand in for the ladder. */
const KIRIKAESHI_REWARD = 5;
const KIRIKAESHI_REWARDED_PASSES = 3;
const SENPAI_WIN_REWARD = 5;
const RIVAL_WIN_REWARD = 10;
const CHAMPION_REWARD = 20;
const CUP_REWARD = 15;
/** Practice counts every time, unlike the ki rewards above. Losing teaches you something too. */
const XP_WIN = 30;
const XP_LOSS = 10;
const XP_LINE = 20;
const XP_STREET = 30;
const XP_CUP = 60;
export const XP_DRILL = 15;
/** What things pay in kensen. First times pay well, and practice pays a little every time. */
const PAY_STREET = 40;
const PAY_SENPAI = 15;
const PAY_RIVAL = 50;
const PAY_REPEAT_WIN = 5;
const PAY_LINE = 10;
const PAY_CUP = 60;
const PAY_REPEAT_CUP = 15;
const PAY_GRAND = 300;
const PAY_TOWER = 20;
export const PAY_DRILL = 5;
export const PAY_HELPING = 15;
/**
 * How hard Ren's stare presses once you know the far-mountain gaze. Pressure fades at half a point a
 * tick all the while, so this leaves it building half as fast as Ren's usual 1, and twice as slow to shake you.
 */
const STARE_WITH_GAZE = 0.75;
/**
 * And how much of Ren's held seme gets through. Any less, and Ren runs low on ki before they can fold
 * someone hiding behind their guard, which would make holding block a winning plan.
 */
const SEME_WITH_GAZE = 0.75;

/** Everything one playthrough remembers. It's saved as it changes, so a refresh picks up where you left off. */
export type RunState = {
  /** Who you chose to play as. */
  character: CharacterId;
  /** The name you gave yourself, or empty to go by your character's. See `playerName`. */
  name: string;
  /** The design on the front of your tare. */
  insignia: Insignia;
  metSenpai: boolean;
  gi: boolean;
  gear: Gear;
  /** Rounds finished with Sensei. Each one sends you to a senpai for the next armor piece. */
  senseiRounds: number;
  /** Fully armored. The front door also needs a win over a senpai. */
  trained: boolean;
  /** How many times the line drill has been passed. */
  linePasses: number;
  /** How many times kirikaeshi has been passed. */
  kirikaeshiPasses: number;
  /** Sensei has taught the parry, the lock and crossing. */
  waza: boolean;
  /** Everyone you've ever beaten in a match. */
  beaten: OpponentId[];
  /** Learned from Old Gen, out in the city. */
  seme: boolean;
  momoBeaten: boolean;
  screenBroken: boolean;
  hasTsuba: boolean;
  /** How many times in a row each rival has beaten you. */
  losses: Partial<Record<OpponentId, number>>;
  node: NodeId;
  cleared: string[];
  bonusKi: number;
  blessed: boolean;
  /** Has won the Grand Taikai. */
  champion: boolean;
  /** Every cup you've won. */
  cups: CupId[];
  /** The far-mountain gaze, which Ren shows you at home. */
  gaze: boolean;
  /** Story moments that have already played, so they only play once. */
  seen: string[];
  /** Your dan, earned at a grading. 0 means you're still on the kyu ranks, which come with the armor. */
  dan: number;
  /** All the practice you've ever done, which is what your level comes from. */
  xp: number;
  /** The dan your grading ticket is good for, or 0 if you haven't got one. */
  ticket: number;
  /** The dan a letter from another dojo recommends you for, until your own dojo has seen it. */
  letter: number;
  /** Who wrote it. */
  letterFrom: string;
  /** Your kensen. */
  money: number;
  /** Everything you've bought. */
  owned: string[];
  /** The armor colors you're wearing, or empty for your own. */
  look: string;
  /** Whether you keep your men on when you aren't fighting. In a fight, you always wear it if you've got it. */
  menOn: boolean;
  /** What you told Sensei when they asked why you'd come. */
  whyKendo: string;
  /** How much use each piece of gear has left, where it's different from what it started with. See `durability.ts`. */
  durability: Record<string, number>;
  /** The shinai you've chosen to carry, or empty for the best you've got. */
  wielded: string;
  equipped: Partial<Record<EquipmentSlot, EquipmentId>>;
  mods: Partial<Record<EquipmentId, ModId>>;
  /** How far along getting your own shinai you are. See `shinai-story.ts`. */
  shinaiQuest: string;
  /** You made one with your own hands, rather than buying it. */
  madeShinai: boolean;
  /** Your health, which carries from one fight to the next. */
  hp: number;
  /** Everywhere you've set foot on the map. */
  visited: string[];
  /** Kensen that people who knocked you out are keeping, until you beat them. */
  held: Record<string, number>;
  /** How far through each person's small talk you've got, so nobody repeats themselves too soon. */
  talked: Record<string, number>;
};

export const createRunState = (): RunState => ({
  character: DEFAULT_CHARACTER,
  name: "",
  insignia: DEFAULT_INSIGNIA,
  metSenpai: false,
  gi: false,
  gear: { ...NO_GEAR },
  senseiRounds: 0,
  trained: false,
  linePasses: 0,
  kirikaeshiPasses: 0,
  waza: false,
  beaten: [],
  seme: false,
  momoBeaten: false,
  screenBroken: false,
  hasTsuba: false,
  losses: {},
  node: "pinecone",
  cleared: [],
  bonusKi: 0,
  blessed: false,
  champion: false,
  cups: [],
  gaze: false,
  seen: [],
  dan: 0,
  xp: 0,
  ticket: 0,
  letter: 0,
  letterFrom: "",
  money: 0,
  owned: [],
  look: "",
  menOn: false,
  whyKendo: "",
  durability: {},
  wielded: "",
  equipped: {},
  mods: {},
  shinaiQuest: "",
  madeShinai: false,
  hp: 100,
  visited: [],
  held: {},
  talked: {},
});

export const gainXp = (run: RunState, xp: number): RunState => ({ ...run, xp: run.xp + xp });

const opponentId = (run: RunState, versus?: OpponentId | null): OpponentId => versus ?? opponentIdFor(run.node);

export const lossesHere = (run: RunState, versus?: OpponentId | null): number => run.losses[opponentId(run, versus)] ?? 0;
export const recordLoss = (run: RunState, versus?: OpponentId | null): RunState => ({
  ...gainXp(run, XP_LOSS),
  losses: { ...run.losses, [opponentId(run, versus)]: lossesHere(run, versus) + 1 },
});

/** The first win over anyone grows your ki. Momo's reward is what they were guarding. */
export function recordWin(run: RunState, versus?: OpponentId | null): RunState {
  const id = opponentId(run, versus);
  const next = { ...gainXp(run, XP_WIN), losses: { ...run.losses, [id]: 0 } };
  if (run.beaten.includes(id)) return earn(next, PAY_REPEAT_WIN);
  const reward = id === "momo" ? 0 : id in SPAR_PARTNERS ? SENPAI_WIN_REWARD : RIVAL_WIN_REWARD;
  return { ...earn(next, id in SPAR_PARTNERS ? PAY_SENPAI : PAY_RIVAL), beaten: [...run.beaten, id], bonusKi: run.bonusKi + reward };
}

/** One match in a cup. The bracket keeps the score, and this is just what you learned from it. */
export const recordCupMatch = (run: RunState, won: boolean): RunState => gainXp(run, won ? XP_WIN : XP_LOSS);

/** Tells ease off after each loss, except in a tournament, where nobody goes easy on you. */
export const rivalConfigFor = (run: RunState, versus?: OpponentId | null, atFullStrength = false): RivalConfig =>
  rivalConfig(atFullStrength ? 0 : lossesHere(run, versus), opponentFor(run.node, versus).style);
export function recordGangWin(run: RunState, gang: string): RunState {
  const next = gainXp(run, XP_STREET);
  return run.cleared.includes(gang) ? next : { ...earn(next, PAY_STREET), cleared: [...run.cleared, gang], bonusKi: run.bonusKi + GANG_REWARD };
}
export const recordTower = (run: RunState): RunState =>
  run.blessed ? run : { ...earn(run, PAY_TOWER), blessed: true, bonusKi: run.bonusKi + TOWER_REWARD };
/** Each cup pays out once. The cups are one way to grow your ki, and the street fights are another. */
export function recordCup(run: RunState, cup: CupId): RunState {
  const next = atLeastDan(gainXp(run, XP_CUP), CUP_DAN[cup] ?? 0);
  if (run.cups.includes(cup)) return earn(next, PAY_REPEAT_CUP);
  const won = { ...earn(next, cup === "grand" ? PAY_GRAND : PAY_CUP), cups: [...run.cups, cup] };
  if (cup === "grand") return { ...won, champion: true, bonusKi: run.bonusKi + CHAMPION_REWARD };
  return { ...won, bonusKi: run.bonusKi + CUP_REWARD };
}
export const recordLinePass = (run: RunState): RunState => ({
  ...earn(gainXp(run, XP_LINE), PAY_LINE),
  linePasses: run.linePasses + 1,
  bonusKi: run.bonusKi + (run.linePasses < LINE_REWARDED_PASSES ? LINE_REWARD : 0),
});
export const recordKirikaeshiPass = (run: RunState): RunState => ({
  ...earn(gainXp(run, XP_DRILL), PAY_DRILL),
  kirikaeshiPasses: run.kirikaeshiPasses + 1,
  bonusKi: run.bonusKi + (run.kirikaeshiPasses < KIRIKAESHI_REWARDED_PASSES ? KIRIKAESHI_REWARD : 0),
});
export const playerKiMax = (run: RunState): number => (run.hasTsuba ? TSUBA_KI_MAX : KI_MAX) + run.bonusKi + levelKi(run.xp) + shopKi(run) - wornKi(run);

export function duelOptionsFor(run: RunState, versus?: OpponentId | null, atFullStrength = false): DuelOptions {
  const opponent = opponentFor(run.node, versus);
  // Ren's stare eases off for someone who keeps coming back. Momo's never does, because that fight is rigged.
  const easedOff = !atFullStrength && opponent.style === "master" && lossesHere(run, versus) >= PRESS_GIVES_UP_AT;
  const gazing = run.gaze && opponent.style === "master";
  const stare = gazing ? STARE_WITH_GAZE : opponent.presence;
  const presence = easedOff ? 0 : stare;
  return {
    kiMax: [playerKiMax(run), opponent.ki ?? KI_MAX],
    windups: [{}, { ...rivalConfigFor(run, versus, atFullStrength).tell }],
    ...(presence ? { presence: [0, presence] as [number, number] } : {}),
    ...(opponent.points ? { pointsToWin: opponent.points } : {}),
    ...(gazing ? { semeTaken: [SEME_WITH_GAZE, 1] as [number, number] } : {}),
    ...(opponent.kamae ? { kamae: ["chudan", opponent.kamae] as [Kamae, Kamae] } : {}),
    // A rigged fight has a script, which a tired guard or the clock would walk straight around.
    ...((opponent.style === "rigged" || opponent.style === "demonstration") ? { steadyGuard: [false, true] as [boolean, boolean], noClock: true } : {}),
  };
}

/** What you've got on when you're walking around, rather than what you own: the men stays off unless you've chosen otherwise. */
export const walkingGear = (run: RunState): Gear => (run.gear.men && !run.menOn ? { ...run.gear, men: false } : run.gear);
