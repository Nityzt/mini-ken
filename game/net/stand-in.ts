import { createDuel, type DuelOptions } from "../duel/rules.ts";
import { createRival, rivalAct, rivalConfig, type RivalStyle } from "../duel/rival.ts";
import { createLockstep, INPUT_DELAY } from "./lockstep.ts";
import type { LinkMessage } from "./protocol.ts";
import type { Link } from "./transport.ts";

const STOMP_EARLY = INPUT_DELAY + 3;

/** Every online match uses the same rules for everyone, whatever they've earned elsewhere. */
export const ONLINE_RULES: DuelOptions = {};

/**
 * The other end of a connection when there's nobody there: a rival playing through the same lockstep a real
 * player would, with its own copy of the match. So practice exercises everything except the network itself.
 */
export function createStandIn(link: Link<LinkMessage>, seed: number, style: RivalStyle = "steady"): { tick(): void; readonly status: string; leave(): void } {
  const lock = createLockstep({ initial: createDuel(ONLINE_RULES), side: 1, link });
  let rival = createRival(seed, rivalConfig(0, style));
  return {
    tick() {
      const act = rivalAct(lock.state, rival);
      rival = act.rival;
      // What's pressed now takes effect a little later, so the foot has to go down that much sooner to land with the strike.
      const me = lock.state.fighters[1];
      const stomp = act.input.stomp || (me.stance === "windup" && me.stanceTicks <= STOMP_EARLY);
      lock.tick({ ...act.input, stomp });
    },
    get status() {
      return lock.status;
    },
    leave: () => lock.leave(),
  };
}
