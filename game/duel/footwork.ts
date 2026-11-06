export const DOUBLE_TAP_TICKS = 14;

/** Two taps of one direction launch that way. Returns -1, 0 or 1 each tick. */
export function createDashDetector(): (leftPressed: boolean, rightPressed: boolean) => -1 | 0 | 1 {
  let tick = 0;
  let lastSide: -1 | 1 | 0 = 0;
  let lastTick = -999;
  return (leftPressed, rightPressed) => {
    tick++;
    const side: -1 | 0 | 1 = rightPressed ? 1 : leftPressed ? -1 : 0;
    if (side === 0) return 0;
    if (side === lastSide && tick - lastTick <= DOUBLE_TAP_TICKS) {
      lastSide = 0;
      return side;
    }
    lastSide = side;
    lastTick = tick;
    return 0;
  };
}

/** Suriashi: the lead foot slides, then the rear foot draws up behind it. The feet never cross. */
export function legsFor(walkTick: number, moving: boolean): "stand" | "step" | "close" {
  if (!moving) return "stand";
  return Math.floor(walkTick / 8) % 2 === 0 ? "step" : "close";
}
