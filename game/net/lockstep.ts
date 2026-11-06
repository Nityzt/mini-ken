import { step, type DuelEvent, type DuelState, type FighterInput } from "../duel/rules.ts";
import { decodeInput, encodeInput, type LinkMessage } from "./protocol.ts";
import type { Link } from "./transport.ts";

/** How many frames ahead your own input is scheduled, which hides ordinary lag. It's about 50ms. */
export const INPUT_DELAY = 3;
export const HASH_EVERY = 60;
/** How long to wait on someone before treating them as gone: ten seconds. */
export const STALL_LIMIT = 600;
/** Frames can be caught up a little faster than normal after a hold-up. */
const MAX_CATCH_UP = 3;
/** Nobody can legitimately be this far ahead, so input from further on is ignored rather than stored. */
const MAX_AHEAD = 600;

export type LockstepStatus = "running" | "finished" | "left" | "desynced";

/** A cheap fingerprint of everything that matters, to notice if two players' games ever disagree. */
export function hashDuel(state: DuelState): number {
  const text = JSON.stringify([state.phase, state.phaseTicks, state.fighters, state.winner, state.lock, state.crossed, state.zanshin]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Lockstep = {
  readonly state: DuelState;
  readonly status: LockstepStatus;
  readonly frame: number;
  /** How long it's been stuck waiting on the other player. */
  readonly waiting: number;
  /** One tick of the game: takes your input, and moves the match on if both players' inputs are in. */
  tick(input: FighterInput): { advanced: boolean; events: DuelEvent[] };
  /** Walks away, and tells the other player. */
  leave(): void;
};

/**
 * Both players run the same pure rules on the same inputs, so all they ever send each other is inputs.
 * That's why the rules can't touch anything random, the clock, or any one player's screen.
 */
export function createLockstep(options: { initial: DuelState; side: 0 | 1; link: Link<LinkMessage>; delay?: number }): Lockstep {
  const { side, link } = options;
  const delay = options.delay ?? INPUT_DELAY;
  const idle = encodeInput({ move: 0, block: false, attack: null });
  const mine = new Map<number, number>();
  const theirs = new Map<number, number>();
  // Nobody's pressed anything yet for the frames before the delay runs out.
  for (let f = 0; f < delay; f++) {
    mine.set(f, idle);
    theirs.set(f, idle);
  }
  const myHashes = new Map<number, number>();
  const theirHashes = new Map<number, number>();
  let state = options.initial;
  let frame = 0;
  let scheduled = delay;
  let waiting = 0;
  let status: LockstepStatus = "running";

  const checkHash = (at: number) => {
    const a = myHashes.get(at);
    const b = theirHashes.get(at);
    if (a === undefined || b === undefined) return;
    if (a !== b) status = "desynced";
    myHashes.delete(at);
    theirHashes.delete(at);
  };

  const readLink = () => {
    for (const message of link.receive()) {
      if (message.t === "input") {
        if (message.frame >= frame && message.frame <= frame + MAX_AHEAD) theirs.set(message.frame, message.bits);
      } else if (message.t === "hash") {
        if (message.frame <= frame + MAX_AHEAD) {
          theirHashes.set(message.frame, message.hash);
          checkHash(message.frame);
        }
      } else if (message.t === "leave") {
        if (status === "running") status = "left";
      }
    }
    if (link.closed && status === "running") status = "left";
  };

  return {
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    get frame() {
      return frame;
    },
    get waiting() {
      return waiting;
    },
    tick(input) {
      if (status !== "running") return { advanced: false, events: [] };
      readLink();
      if (status !== "running") return { advanced: false, events: [] };
      // Nothing's held back while waiting: a key pressed during a stall isn't owed to anyone.
      if (scheduled <= frame + delay) {
        const bits = encodeInput(input);
        mine.set(scheduled, bits);
        link.send({ t: "input", frame: scheduled, bits });
        scheduled++;
      }
      const events: DuelEvent[] = [];
      let advanced = false;
      for (let n = 0; n < MAX_CATCH_UP && status === "running" && mine.has(frame) && theirs.has(frame); n++) {
        const me = decodeInput(mine.get(frame)!);
        const them = decodeInput(theirs.get(frame)!);
        state = side === 0 ? step(state, me, them) : step(state, them, me);
        events.push(...state.events);
        mine.delete(frame);
        theirs.delete(frame);
        frame++;
        advanced = true;
        if (frame % HASH_EVERY === 0) {
          const hash = hashDuel(state);
          myHashes.set(frame, hash);
          link.send({ t: "hash", frame, hash });
          checkHash(frame);
        }
        if (state.phase === "over" && status === "running") status = "finished";
      }
      waiting = advanced ? 0 : waiting + 1;
      if (waiting >= STALL_LIMIT && status === "running") status = "left";
      return { advanced, events };
    },
    leave() {
      if (status === "running") {
        link.send({ t: "leave" });
        status = "left";
      }
    },
  };
}
