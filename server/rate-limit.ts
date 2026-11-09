export type RateLimit = {
  /** Counts one, and says whether it's still within the limit. */
  hit(key: string, now: number): boolean;
  /** Whether the limit's already used up, without counting anything. */
  over(key: string, now: number): boolean;
  /** Hands back one use that turned out not to count. */
  undo(key: string, now: number): void;
};

export function createRateLimit(max: number, windowMs: number): RateLimit {
  const entries = new Map<string, { count: number; resets: number }>();
  const current = (key: string, now: number) => {
    const entry = entries.get(key);
    return entry && entry.resets > now ? entry : null;
  };
  const prune = (now: number) => {
    for (const [key, entry] of entries) if (entry.resets <= now) entries.delete(key);
  };
  return {
    hit(key, now) {
      // Keeps someone trying endless names from using up the memory.
      if (entries.size > 10_000) prune(now);
      const entry = current(key, now) ?? { count: 0, resets: now + windowMs };
      entry.count++;
      entries.set(key, entry);
      return entry.count <= max;
    },
    over: (key, now) => (current(key, now)?.count ?? 0) >= max,
    undo(key, now) {
      const entry = current(key, now);
      if (entry) entry.count = Math.max(0, entry.count - 1);
    },
  };
}

/** Only so many of a costly job at once. The rest wait in turn. */
export function createSlots(max: number): { run<T>(job: () => Promise<T>): Promise<T> } {
  let running = 0;
  const queue: (() => void)[] = [];
  return {
    async run(job) {
      if (running >= max) await new Promise<void>((resolve) => queue.push(resolve));
      running++;
      try {
        return await job();
      } finally {
        running--;
        queue.shift()?.();
      }
    },
  };
}
