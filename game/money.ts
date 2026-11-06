import { personDan } from "./ranks.ts";
import type { RunState } from "./run-state.ts";
import { EGG_LINES, tipLine } from "./scenes/content.ts";
import type { OpponentId } from "./world/dojos.ts";

/** Named after the tip of the shinai, with a nod to the old coin. It's fictional, and only spent in this game. */
export const MONEY_NAME = "kensen";
export const moneyText = (amount: number): string => `${amount} ${MONEY_NAME}`;

export const earn = (run: RunState, amount: number): RunState => ({ ...run, money: run.money + amount });

export const hasFeat = (run: RunState, feat: string): boolean => run.seen.includes(`feat:${feat}`);
export const withFeat = (run: RunState, feat: string): RunState => (hasFeat(run, feat) ? run : { ...run, seen: [...run.seen, `feat:${feat}`] });

const HEADS: OpponentId[] = ["raccoon", "goose", "heron", "otter", "radish"];
const eggsFound = (run: RunState) => run.seen.filter((key) => key.startsWith("egg:")).length;

export type Challenge = { id: string; label: string; reward: number; done: (run: RunState) => boolean };
export const CHALLENGES: Challenge[] = [
  { id: "senpai", label: "Beat all three senpai", reward: 30, done: (run) => (["aki", "bo", "yui"] as OpponentId[]).every((id) => run.beaten.includes(id)) },
  { id: "perfectLine", label: "Run a long line with no misses", reward: 40, done: (run) => hasFeat(run, "perfectLine") },
  { id: "flawless", label: "Flawless win over a dojo head", reward: 50, done: (run) => hasFeat(run, "flawless") },
  { id: "streets", label: "Help three people on the street", reward: 60, done: (run) => run.cleared.length >= 3 },
  { id: "cups", label: "Win three cups", reward: 100, done: (run) => run.cups.length >= 3 },
  { id: "sensei", label: "Beat Sensei Kuma", reward: 100, done: (run) => run.beaten.includes("sensei") },
  { id: "styles", label: "Beat Tetsu and Shin", reward: 100, done: (run) => run.beaten.includes("tetsu") && run.beaten.includes("shin") },
  { id: "eggs", label: "Find every hidden stash", reward: 100, done: (run) => eggsFound(run) >= Object.keys(EGG_LINES).length },
  { id: "heads", label: "Beat all five dojo heads", reward: 150, done: (run) => HEADS.every((id) => run.beaten.includes(id)) },
  { id: "senseis", label: "Beat every other dojo's sensei", reward: 250, done: (run) => (["nemu", "kan", "mizu", "hagane", "raiko"] as OpponentId[]).every((id) => run.beaten.includes(id)) },
];

const claimKey = (id: string) => `challenge:${id}`;
export const isClaimed = (run: RunState, id: string): boolean => run.seen.includes(claimKey(id));

/** Pays out anything newly done. If there's nothing, it returns the same run, so nothing looks changed. */
export function settleChallenges(run: RunState): RunState {
  let next = run;
  for (const challenge of CHALLENGES) {
    if (isClaimed(next, challenge.id) || !challenge.done(next)) continue;
    next = { ...earn(next, challenge.reward), seen: [...next.seen, claimKey(challenge.id)] };
  }
  return next;
}

const TIP_CHANCE = 0.3;
const TIP_STEP = 5;
const TIP_STEPS = 5;
/** Some days, somebody's grateful. `roll` is a random number from 0 to 1. */
export function maybeTip(run: RunState, roll: number): { run: RunState; line: string | null } {
  if (roll >= TIP_CHANCE) return { run, line: null };
  const amount = (Math.floor((roll / TIP_CHANCE) * TIP_STEPS) + 1) * TIP_STEP;
  return { run: earn(run, amount), line: tipLine(amount) };
}

const EGG_REWARD = 25;

/** Coins tucked behind things around the dojos. Nothing says they're there: you just have to look. */
export function findEgg(run: RunState, place: string, tile: string): { run: RunState; lines: string[] } | null {
  const key = `${place}|${tile}`;
  const lines = EGG_LINES[key];
  if (!lines || run.seen.includes(`egg:${key}`)) return null;
  return { run: { ...earn(run, EGG_REWARD), seen: [...run.seen, `egg:${key}`] }, lines };
}

const STAKES = [10, 25, 50, 100, 200];
const STAKE_PER_DAN = 25;
/** Nobody bets on a rigged fight, or a lesson. */
const NO_BETS: OpponentId[] = ["momo", "renVisit"];

/** What you could put on this match. Nobody at a low rank has much to lose, so they'll only go so high. */
export function betStakes(run: RunState, opponent: OpponentId): number[] {
  if (NO_BETS.includes(opponent)) return [];
  const limit = STAKE_PER_DAN * (personDan(opponent) + 1);
  return STAKES.filter((stake) => stake <= limit && stake <= run.money);
}

/** The stake is paid up front, so walking away or closing the game loses it. Each side's stake is settled on its own, so a person could sit on the other side of this later. */
export const placeBet = (run: RunState, stake: number): RunState => (stake > run.money ? run : { ...run, money: run.money - stake });
export const payBet = (run: RunState, stake: number, won: boolean): RunState => (won ? earn(run, stake * 2) : run);

const FEES: Record<number, number> = { 1: 50, 2: 100, 3: 200 };
/** What one attempt at this dan costs. */
export const gradingFee = (dan: number): number => FEES[dan] ?? 0;
