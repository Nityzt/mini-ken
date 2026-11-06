import type { RunState } from "./run-state.ts";
import { owns } from "./shop.ts";
import type { OpponentId } from "./world/dojos.ts";

/** Everything that can wear out. The three shinai are kept apart, because only the one in your hand takes any harm. */
export type ShinaiId = "shinai" | "ownShinai" | "fineShinai";
export type ArmorId = "tare" | "do" | "men" | "kote";
export type GearKey = ShinaiId | ArmorId;

export const FULL_DURABILITY = 100;
/** Sensei's old shinai was already tired when it was lent to you. */
export const OLD_SHINAI_DURABILITY = 50;
/** At or under this, it costs you. Sensei's shinai starts well above it, so the loan alone never hurts. */
export const WORN_AT = 25;
/** Nothing ever quite falls apart, so a fight can never leave you unable to carry on. */
const LEAST_DURABILITY = 5;
const WORN_KI = 5;
export const MEND_COST = 40;

const ARMOR: ArmorId[] = ["tare", "do", "men", "kote"];

export const durabilityOf = (run: RunState, key: GearKey): number => run.durability[key] ?? (key === "shinai" ? OLD_SHINAI_DURABILITY : FULL_DURABILITY);

export const shinaiReturned = (run: RunState): boolean => run.shinaiQuest === "returned";

/** The shinai you could pick up right now. */
export function shinaiHeld(run: RunState): ShinaiId[] {
  const held: ShinaiId[] = [];
  if (run.madeShinai) held.push("ownShinai");
  if (owns(run, "fineShinai")) held.push("fineShinai");
  if (run.gear.shinai && !shinaiReturned(run)) held.push("shinai");
  return held;
}

/** The one you've chosen, or otherwise the best one you've got: your own before anything else. */
export function wieldedShinai(run: RunState): ShinaiId | null {
  const held = shinaiHeld(run);
  return held.includes(run.wielded as ShinaiId) ? (run.wielded as ShinaiId) : held[0] ?? null;
}

/** Only the special few are hard on your gear. Everyone else, however good, leaves it as it was. */
export const GEAR_WEAR: Partial<Record<OpponentId, Partial<Record<ArmorId | "shinai", number>>>> = {
  // Everything comes down from overhead.
  tetsu: { men: 15, shinai: 10 },
  // Two blades, and both of them find your wrists.
  shin: { kote: 15, shinai: 15 },
  radish: { men: 10, shinai: 10 },
  goose: { shinai: 5 },
  heron: { do: 10, shinai: 5 },
  otter: { tare: 10, shinai: 5 },
  // The heads of the other dojos don't hold back.
  raiko: { shinai: 10, men: 10 },
  kan: { shinai: 10 },
  nemu: { shinai: 10 },
  hagane: { shinai: 10, do: 10 },
  mizu: { shinai: 10 },
};

/** What one fight does to your gear, and which pieces it's just worn out. A shinai bag halves what your shinai takes. */
export function wearFrom(run: RunState, opponent: OpponentId): { run: RunState; wornOut: GearKey[] } {
  const wear = GEAR_WEAR[opponent];
  if (!wear) return { run, wornOut: [] };
  const durability = { ...run.durability };
  const wornOut: GearKey[] = [];
  const take = (key: GearKey, amount: number) => {
    const before = durabilityOf(run, key);
    const after = Math.max(LEAST_DURABILITY, before - amount);
    durability[key] = after;
    if (before > WORN_AT && after <= WORN_AT) wornOut.push(key);
  };
  for (const piece of ARMOR) if (wear[piece] && run.gear[piece]) take(piece, wear[piece]!);
  const wielded = wieldedShinai(run);
  if (wear.shinai && wielded) take(wielded, shinaiReturned(run) ? Math.ceil(wear.shinai / 2) : wear.shinai);
  return { run: { ...run, durability }, wornOut };
}

/** Worn-out gear is the only way durability ever matters: each piece costs a little ki until it's mended. */
export function wornKi(run: RunState): number {
  const armor = ARMOR.filter((piece) => run.gear[piece] && durabilityOf(run, piece) <= WORN_AT).length;
  const wielded = wieldedShinai(run);
  return (armor + (wielded && durabilityOf(run, wielded) <= WORN_AT ? 1 : 0)) * WORN_KI;
}

/** What the bench at the Bogu Shop can do for you, and what it'd cost. Sensei's shinai is only ever fixed by your own hands, so it isn't here until you've learned how. */
export function benchJobs(run: RunState): { key: GearKey; cost: number }[] {
  const jobs: { key: GearKey; cost: number }[] = [];
  for (const key of shinaiHeld(run)) {
    if (durabilityOf(run, key) >= FULL_DURABILITY) continue;
    if (run.madeShinai) jobs.push({ key, cost: 0 });
    else if (key !== "shinai") jobs.push({ key, cost: MEND_COST });
  }
  for (const piece of ARMOR) if (run.gear[piece] && durabilityOf(run, piece) < FULL_DURABILITY) jobs.push({ key: piece, cost: MEND_COST });
  return jobs;
}

export function fixGear(run: RunState, key: GearKey): RunState {
  const job = benchJobs(run).find((j) => j.key === key);
  if (!job || run.money < job.cost) return run;
  return { ...run, money: run.money - job.cost, durability: { ...run.durability, [key]: FULL_DURABILITY } };
}
