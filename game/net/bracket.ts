import { nextRandom } from "../duel/rival.ts";
import type { Bracket, BracketEntrant } from "./protocol.ts";

/** Seeded, so a server could send just the seed, and everyone would draw the same thing. */
export function createBracket(entrants: BracketEntrant[], seed: number): Bracket {
  const size = entrants.length;
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error(`A bracket needs a power of two, not ${size}`);
  const field = [...entrants];
  let rng = seed;
  for (let i = field.length - 1; i > 0; i--) {
    const roll = nextRandom(rng);
    rng = roll.seed;
    const j = Math.floor(roll.value * (i + 1));
    [field[i], field[j]] = [field[j], field[i]];
  }
  return { size, rounds: [field] };
}

const lastRound = (b: Bracket) => b.rounds[b.rounds.length - 1];
export const bracketChampion = (b: Bracket): BracketEntrant | null => (lastRound(b).length === 1 ? lastRound(b)[0] : null);

/** Who this player meets next, if they're still in and it isn't over. */
export function nextOpponentIn(b: Bracket, id: string): BracketEntrant | null {
  if (bracketChampion(b)) return null;
  const round = lastRound(b);
  const at = round.findIndex((e) => e.id === id);
  if (at < 0) return null;
  return round[at % 2 === 0 ? at + 1 : at - 1];
}

export const bracketStatus = (b: Bracket, id: string): "playing" | "out" | "champion" => (bracketChampion(b)?.id === id ? "champion" : lastRound(b).some((e) => e.id === id) ? "playing" : "out");

/** Finishes the current round. `decide` picks the winner of each pairing. */
export function finishRound(b: Bracket, decide: (a: BracketEntrant, c: BracketEntrant) => BracketEntrant): Bracket {
  if (bracketChampion(b)) return b;
  const round = lastRound(b);
  const winners: BracketEntrant[] = [];
  for (let i = 0; i < round.length; i += 2) winners.push(decide(round[i], round[i + 1]));
  return { ...b, rounds: [...b.rounds, winners] };
}
