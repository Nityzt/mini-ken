import { nextRandom, type RivalStyle } from "../duel/rival.ts";
import type { AuthProvider } from "./auth.ts";
import { bracketStatus, createBracket, finishRound, nextOpponentIn } from "./bracket.ts";
import { parseServerMessage, PROTOCOL_VERSION, type Bracket, type BracketEntrant, type ClientMessage, type Identity, type LinkMessage, type MatchMode, type ServerMessage } from "./protocol.ts";
import { createStandIn } from "./stand-in.ts";
import { createLoopback, createSocketLink, type Link, type SocketLike } from "./transport.ts";

export type FoundMatch = {
  link: Link<LinkMessage>;
  seed: number;
  side: 0 | 1;
  opponent: Identity;
  /** Anything that has to run every tick alongside the match, like a stand-in. */
  pump?(): void;
};
export type SearchState = { kind: "searching" } | { kind: "found"; match: FoundMatch } | { kind: "failed"; reason: string };
export type Search = { poll(): SearchState; cancel(): void };
export type TournamentSession = {
  bracket(): Bracket | null;
  status(): "waiting" | "playing" | "out" | "champion";
  nextMatch(): Search;
  /** How your match went. */
  report(won: boolean): void;
  leave(): void;
};
export type OnlineService = {
  /** Whether there's really a server behind this, or just stand-ins. */
  readonly live: boolean;
  findDuel(): Search;
  enterTournament(): TournamentSession;
};

const STAND_IN_LATENCY = 2;
const SEARCH_TICKS = 70;
const STAND_IN_FIELD = ["Sumi", "Taro", "Noa", "Ichi", "Mei", "Oto", "Hina"];
/** The further you get, the better they are. */
const STAND_IN_STYLES: RivalStyle[] = ["restless", "steady", "master"];
const FIELD_SIZE = 8;
const STAND_IN_TOURNAMENT_FAVOURS = 0.5;

/** No server to talk to: practice against stand-ins, through the same lockstep a real match would use. */
export function createStandInService(auth: AuthProvider, rollSeed: () => number = () => Math.floor(Math.random() * 2 ** 31)): OnlineService {
  const standInMatch = (name: string, style: RivalStyle): FoundMatch => {
    const [mine, theirs] = createLoopback<LinkMessage>(STAND_IN_LATENCY);
    const seed = rollSeed();
    const standIn = createStandIn(theirs, seed, style);
    return { link: mine, seed, side: 0, opponent: { id: `stand-in-${name}`, name, dan: 1, guest: true }, pump: () => standIn.tick() };
  };
  const after = (ticks: number, found: () => FoundMatch): Search => {
    let left = ticks;
    let result: SearchState = { kind: "searching" };
    return {
      poll() {
        if (result.kind === "searching" && --left <= 0) result = { kind: "found", match: found() };
        return result;
      },
      cancel() {
        left = Infinity;
      },
    };
  };
  return {
    live: false,
    findDuel: () => after(SEARCH_TICKS, () => standInMatch(STAND_IN_FIELD[rollSeed() % STAND_IN_FIELD.length], "steady")),
    enterTournament() {
      const me = auth.identity();
      const entrants: BracketEntrant[] = [{ id: me.id, name: me.name, controller: "player" }, ...STAND_IN_FIELD.slice(0, FIELD_SIZE - 1).map((name): BracketEntrant => ({ id: `stand-in-${name}`, name, controller: "bot" }))];
      let bracket = createBracket(entrants, rollSeed());
      let rng = rollSeed();
      return {
        bracket: () => bracket,
        status: () => bracketStatus(bracket, me.id),
        nextMatch() {
          const opponent = nextOpponentIn(bracket, me.id)!;
          const style = STAND_IN_STYLES[Math.min(bracket.rounds.length - 1, STAND_IN_STYLES.length - 1)];
          return after(SEARCH_TICKS / 2, () => standInMatch(opponent.name, style));
        },
        report(won) {
          bracket = finishRound(bracket, (a, b) => {
            if (a.id === me.id) return won ? a : b;
            if (b.id === me.id) return won ? b : a;
            const roll = nextRandom(rng);
            rng = roll.seed;
            return roll.value < STAND_IN_TOURNAMENT_FAVOURS ? a : b;
          });
        },
        leave() {},
      };
    },
  };
}

/**
 * A real server, reached over one socket. It's expected to check the token, queue people, and pass match
 * messages between the two players. docs/multiplayer.md has the whole conversation.
 */
export function createRemoteService(options: { url: string; auth: AuthProvider; open?: (url: string) => SocketLike }): OnlineService {
  const { url, auth } = options;
  const open = options.open ?? ((target: string) => new WebSocket(target) as unknown as SocketLike);

  const connect = (mode: MatchMode) => {
    const socket: Link<ClientMessage, ServerMessage> = createSocketLink<ClientMessage, ServerMessage>(open(url), parseServerMessage);
    socket.send({ t: "hello", version: PROTOCOL_VERSION, token: auth.token(), identity: auth.identity() });
    socket.send({ t: "queue", mode });
    let bracket: Bracket | null = null;
    let found: FoundMatch | null = null;
    let refused: string | null = null;
    /** What's arrived for the match in progress, which only the match reads. */
    const relay: LinkMessage[] = [];
    const matchLink = (): Link<LinkMessage> => ({
      send: (message) => socket.send(message),
      receive() {
        readSocket();
        return relay.splice(0);
      },
      // The connection carries on, for the next round. A match ending doesn't end it.
      close() {},
      get closed() {
        return socket.closed;
      },
    });
    const readSocket = () => {
      for (const message of socket.receive()) {
        if (message.t === "match") found = { link: matchLink(), seed: message.seed, side: message.side, opponent: message.opponent };
        else if (message.t === "bracket") bracket = message.bracket;
        else if (message.t === "rejected") refused = message.reason;
        else if (message.t === "input" || message.t === "hash" || message.t === "leave") relay.push(message);
      }
    };
    const search = (): Search => ({
      poll() {
        readSocket();
        if (refused) return { kind: "failed", reason: refused };
        if (found) {
          const match = found;
          found = null;
          return { kind: "found", match };
        }
        return socket.closed ? { kind: "failed", reason: "Connection lost" } : { kind: "searching" };
      },
      cancel() {
        socket.send({ t: "cancel" });
        socket.close();
      },
    });
    return { socket, search, readSocket, bracket: () => bracket };
  };

  return {
    live: true,
    findDuel: () => connect("duel").search(),
    enterTournament() {
      const conn = connect("tournament");
      const id = auth.identity().id;
      return {
        bracket() {
          conn.readSocket();
          return conn.bracket();
        },
        status() {
          conn.readSocket();
          const bracket = conn.bracket();
          return bracket ? bracketStatus(bracket, id) : "waiting";
        },
        nextMatch: () => conn.search(),
        report: (won) => conn.socket.send({ t: "result", won }),
        leave: () => conn.socket.close(),
      };
    },
  };
}

/** A server if one's been set up, or practice if not. */
export const createOnlineService = (auth: AuthProvider, serverUrl?: string): OnlineService => (serverUrl ? createRemoteService({ url: serverUrl, auth }) : createStandInService(auth));
