import { nextRandom, type RivalStyle } from "../duel/rival.ts";
import type { AuthProvider } from "./auth.ts";
import type { Appearance } from "./appearance.ts";
import { bracketStatus, createBracket, finishRound, nextOpponentIn } from "./bracket.ts";
import type { Bracket, BracketEntrant, Identity, LinkMessage, MatchReport } from "./protocol.ts";
import { createStandIn } from "./stand-in.ts";
import { createLobbyClient, pageAway, resolveServerUrl, type LobbyClient, type ServerOutcome } from "./lobby-client.ts";
import { createLoopback, type Link } from "./transport.ts";

export type FoundMatch = {
  link: Link<LinkMessage>;
  seed: number;
  side: 0 | 1;
  opponent: Identity;
  /** Server-validated appearance used for this match. */
  self?: Identity;
  /** Anything that has to run every tick alongside the match, like a stand-in. */
  pump?(): void;
  /** A real match, where the server decides how it went. */
  live?: { report(report: MatchReport): void; outcome(): ServerOutcome | null };
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
  /** A connection for creating a lobby, or joining the one named, if there's a server to do it on. */
  lobby(join?: string): LobbyClient | null;
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
    lobby: () => null,
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

/** Lobbies if there's a server, and always stand-ins for practice. Real tournaments aren't in this version. */
export function createOnlineService(auth: AuthProvider, serverUrl?: string, lobbyOptions: { alert?(): void; appearance?(): Appearance } = {}): OnlineService {
  const practice = createStandInService(auth);
  if (!serverUrl) return practice;
  return {
    ...practice,
    live: true,
    lobby: (join) =>
      createLobbyClient({
        url: resolveServerUrl(serverUrl, location),
        join,
        appearance: lobbyOptions.appearance?.(),
        alert: lobbyOptions.alert ?? (() => {}),
        visibility: {
          hidden: () => pageAway(document),
          subscribe(changed) {
            document.addEventListener("visibilitychange", changed);
            window.addEventListener("focus", changed);
            window.addEventListener("blur", changed);
            return () => {
              document.removeEventListener("visibilitychange", changed);
              window.removeEventListener("focus", changed);
              window.removeEventListener("blur", changed);
            };
          },
        },
        setInterval: (run, ms) => window.setInterval(run, ms),
        clearInterval: (id) => window.clearInterval(id),
      }),
  };
}
