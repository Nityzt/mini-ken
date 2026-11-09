import type { RunState } from '../run-state.ts';
import { DOOR_WELCOME, GEN_AGAIN, GEN_LINES } from './content.ts';

/** The door-side introduction belongs to the run and must not replay on returning. */
export function doorWelcome(run: RunState): { lines: string[]; run: RunState } | null {
  if (run.metSenpai || run.seen.includes('door-welcome')) return null;
  return { lines: DOOR_WELCOME, run: { ...run, seen: [...run.seen, 'door-welcome'] } };
}

const GEN_MET = 'gen-met';
/** Gen says hello to a stranger once. Coming back after being sent away, the lesson just starts again. */
export function genWelcome(run: RunState): { lines: string[]; run: RunState } {
  if (run.seen.includes(GEN_MET)) return { lines: GEN_AGAIN, run };
  return { lines: GEN_LINES, run: { ...run, seen: [...run.seen, GEN_MET] } };
}
