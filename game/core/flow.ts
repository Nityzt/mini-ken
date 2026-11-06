import type { SceneName } from "./scene.ts";

export const FADE_TICKS = 10;

/** Pause and scene fades, which share one clock. */
export type Flow = { paused: boolean; fadingTo: SceneName | null; fadeTicks: number };

export const createFlow = (): Flow => ({ paused: false, fadingTo: null, fadeTicks: 0 });

export function startFade(flow: Flow, to: SceneName): Flow {
  return { ...flow, fadingTo: to, fadeTicks: FADE_TICKS };
}

/** Advances one tick. `switchTo` names a scene to switch to now, and `runScene` says whether the scene gets this tick. */
export function stepFlow(flow: Flow, pausePressed: boolean): { flow: Flow; switchTo: SceneName | null; runScene: boolean } {
  const next = { ...flow };
  // Pausing is always allowed: it holds a fade where it is, and resuming lets it finish.
  if (pausePressed) next.paused = !next.paused;
  if (next.paused) return { flow: next, switchTo: null, runScene: false };
  if (next.fadingTo) {
    if (--next.fadeTicks > 0) return { flow: next, switchTo: null, runScene: false };
    const switchTo = next.fadingTo;
    next.fadingTo = null;
    next.fadeTicks = FADE_TICKS;
    return { flow: next, switchTo, runScene: false };
  }
  if (next.fadeTicks > 0) {
    next.fadeTicks--;
    return { flow: next, switchTo: null, runScene: false };
  }
  return { flow: next, switchTo: null, runScene: true };
}
