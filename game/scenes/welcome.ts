import type { RunState } from '../run-state.ts';
import { DOOR_WELCOME } from './content.ts';

/** The door-side introduction belongs to the run and must not replay on returning. */
export function doorWelcome(run: RunState): { lines: string[]; run: RunState } | null {
  if (run.metSenpai || run.seen.includes('door-welcome')) return null;
  return { lines: DOOR_WELCOME, run: { ...run, seen: [...run.seen, 'door-welcome'] } };
}
