import { earn, moneyText } from "./money.ts";
import type { RunState } from "./run-state.ts";
import { GANGS, NODES, type NodeId } from "./world/map.ts";
import { opponentById, type OpponentId } from "./world/dojos.ts";

/** Your health carries from one fight to the next, so going straight back to someone who's just beaten you costs something. */
export const HP_MAX = 100;
/** People start to notice. */
export const HP_LOW = 35;
/** Three straight 2-0 losses take you down, which leaves time to see what's going wrong. */
export const HP_PER_POINT = 20;
/** One point of health every two seconds, anywhere outside a fight. */
export const REGEN_TICKS = 120;
const KNOCKOUT_TAKES = 0.5;

export const regen = (run: RunState): RunState => (run.hp >= HP_MAX ? run : { ...run, hp: run.hp + 1 });
export const rest = (run: RunState): RunState => (run.hp >= HP_MAX ? run : { ...run, hp: HP_MAX });

/** Home is safe. So are the things with stakes of their own: a cup is one loss and out, and a grading has a fee. */
export const matchHurts = (run: RunState, match: { cup: boolean; stage: string | null }): boolean =>
  run.node !== "pinecone" && !match.cup && match.stage !== "tachiai";

/** What a match leaves you with. A win can leave you hurt, but you stay on your feet. */
export const hpAfterMatch = (hp: number, conceded: number, won: boolean): number => Math.max(won ? 1 : 0, hp - conceded * HP_PER_POINT);

/** You wake up at home, healed. Whoever put you down keeps half your money until you beat them. */
export function knockOut(run: RunState, holder: string): { run: RunState; taken: number } {
  const taken = Math.floor(run.money * KNOCKOUT_TAKES);
  return {
    taken,
    run: {
      ...run,
      hp: HP_MAX,
      node: "pinecone",
      money: run.money - taken,
      held: taken > 0 ? { ...run.held, [holder]: (run.held[holder] ?? 0) + taken } : run.held,
    },
  };
}

/** Beat whoever's holding your money, and you get all of it back. */
export function reclaim(run: RunState, holder: string): { run: RunState; amount: number } {
  const amount = run.held[holder] ?? 0;
  if (amount <= 0) return { run, amount: 0 };
  const { [holder]: _paid, ...held } = run.held;
  return { run: { ...earn(run, amount), held }, amount };
}

/** Who that is, in words. Gangs are named by where they hang around. */
export const whoHolds = (holder: string): string =>
  Object.hasOwn(GANGS, holder) ? `the Alley Cats at ${NODES[holder as NodeId].name}` : opponentById(holder as OpponentId).rival;

export function heldObjective(run: RunState): string | null {
  const holder = Object.keys(run.held).find((id) => (run.held[id] ?? 0) > 0);
  return holder ? `Get your ${moneyText(run.held[holder]!)} back from ${whoHolds(holder)}` : null;
}
