const TICK_MS = 1000 / 60;
const MAX_TICKS_PER_FRAME = 5;

/** A long gap, such as a backgrounded tab, is dropped instead of replayed. */
export function ticksToRun(accumulatorMs: number, elapsedMs: number): { ticks: number; accumulatorMs: number } {
  const total = accumulatorMs + elapsedMs;
  const ticks = Math.floor(total / TICK_MS);
  if (ticks > MAX_TICKS_PER_FRAME) return { ticks: MAX_TICKS_PER_FRAME, accumulatorMs: 0 };
  return { ticks, accumulatorMs: total - ticks * TICK_MS };
}

export function createLoop(update: () => void, render: () => void): { start(): void; stop(): void } {
  let frame = 0;
  let last = 0;
  let accumulator = 0;

  const onFrame = (now: number) => {
    const result = ticksToRun(accumulator, now - last);
    last = now;
    accumulator = result.accumulatorMs;
    for (let i = 0; i < result.ticks; i++) update();
    render();
    frame = requestAnimationFrame(onFrame);
  };

  return {
    start() {
      last = performance.now();
      accumulator = 0;
      frame = requestAnimationFrame(onFrame);
    },
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}
