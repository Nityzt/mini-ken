import type { ClientMessage, Identity, LobbyClosedReason, MatchReport, OutcomeReason, ServerMessage } from "../game/net/protocol.ts";
import { decideOutcome } from "./outcome.ts";

export const LOBBY_EMPTY_MS = 600_000;
export const VISIBLE_WAIT_MS = 120_000;
export const SILENCE_MS = 10_000;
export const REPORT_WAIT_MS = 15_000;
/** The on-screen countdown before a match, when nobody's sending anything yet. */
export const START_COUNTDOWN_MS = 3_000;

export type Player = { id: string; identity: Identity; send(message: ServerMessage): void; close(): void };
export type MatchResult = { players: [string, string]; winner: string | null; reason: OutcomeReason; playedAt: number };
export type LobbyHub = {
  connect(player: Player, now?: number): void;
  message(player: Player, message: ClientMessage, now: number): void;
  disconnect(player: Player, now: number): void;
  /** Called about once a second, for everything that happens by not happening. */
  tick(now: number): void;
};

type Connection = { player: Player; visible: boolean; lobby: Lobby | null };
type Match = {
  /** By side, as the players were told. */
  order: [Connection, Connection];
  reports: [MatchReport | null, MatchReport | null];
  left: 0 | 1 | null;
  gone: [boolean, boolean];
  lastInputAt: [number, number];
  lastFrame: [number, number];
  reportDeadline: number | null;
};
type Lobby = {
  code: string;
  creator: Connection;
  guest: Connection | null;
  state: "waiting" | "starting" | "playing" | "settling" | "between";
  /** When it last did anything that decides how long it can sit there. */
  since: number;
  match: Match | null;
  rematch: Set<Connection>;
  /** Who's been looking at the game since the match was about to start. */
  ready: Set<Connection>;
};

const blankReports = (): [null, null] => [null, null];

export function createLobbyHub(deps: {
  rollCode(): string;
  rollSeed(): number;
  record(result: MatchResult): Promise<{ wins: [number, number]; losses: [number, number] }>;
}): LobbyHub {
  const connections = new Map<string, Connection>();
  const lobbies = new Map<string, Lobby>();
  /** A second connection for an account that hasn't done anything yet, so it hasn't replaced the first. */
  const waitingToReplace = new Map<string, { player: Player; visible: boolean }>();

  const current = (player: Player) => {
    const connection = connections.get(player.id);
    return connection?.player === player ? connection : null;
  };
  const membersOf = (lobby: Lobby) => (lobby.guest ? [lobby.creator, lobby.guest] : [lobby.creator]);
  const close = (lobby: Lobby, reason: LobbyClosedReason, except?: Connection) => {
    lobbies.delete(lobby.code);
    for (const member of membersOf(lobby)) {
      if (member.lobby === lobby) member.lobby = null;
      if (member !== except && connections.get(member.player.id) === member) member.player.send({ t: "lobby-closed", reason });
    }
  };

  const beginStarting = (lobby: Lobby, now: number) => {
    lobby.state = "starting";
    lobby.since = now;
    // Each player only has to have looked once from here. Requiring both at the same moment would make it impossible with two windows on one computer.
    lobby.ready = new Set(membersOf(lobby).filter((member) => member.visible));
    startIfReady(lobby, now);
  };
  const startIfReady = (lobby: Lobby, now: number) => {
    if (lobby.state !== "starting" || !lobby.guest || lobby.ready.size < 2) return;
    const seed = deps.rollSeed();
    const order: [Connection, Connection] = deps.rollSeed() % 2 === 0 ? [lobby.creator, lobby.guest] : [lobby.guest, lobby.creator];
    const firstInputBy = now + START_COUNTDOWN_MS;
    lobby.state = "playing";
    lobby.rematch.clear();
    lobby.match = { order, reports: blankReports(), left: null, gone: [false, false], lastInputAt: [firstInputBy, firstInputBy], lastFrame: [-1, -1], reportDeadline: null };
    order[0].player.send({ t: "match", seed, side: 0, opponent: order[1].player.identity });
    order[1].player.send({ t: "match", seed, side: 1, opponent: order[0].player.identity });
  };

  const settle = (lobby: Lobby, match: Match, winner: 0 | 1 | null, reason: OutcomeReason, now: number) => {
    lobby.state = "settling";
    const [one, two] = match.order;
    const players: [string, string] = [one.player.id, two.player.id];
    const tell = (record: { wins: [number, number]; losses: [number, number] }) => {
      match.order.forEach((member, side) => {
        if (match.gone[side]) return;
        const mine = winner === null ? null : winner === side ? "you" : "them";
        member.player.send({ t: "outcome", winner: mine, reason, wins: record.wins[side], losses: record.losses[side] });
      });
      lobby.match = null;
      lobby.since = now;
      if (match.gone.some(Boolean)) {
        close(lobby, "opponent-left");
        return;
      }
      lobby.state = "between";
    };
    deps
      .record({ players, winner: winner === null ? null : players[winner], reason, playedAt: now })
      .then(tell)
      .catch((error: unknown) => {
        // The match is still over. The next look at their record will just be missing it.
        console.error("Couldn't record a match:", error instanceof Error ? error.message : "unknown");
        tell({ wins: [0, 0], losses: [0, 0] });
      });
  };

  const judge = (lobby: Lobby, now: number, silent: [boolean, boolean] = [false, false], waitExpired = false) => {
    const match = lobby.match;
    if (lobby.state !== "playing" || !match) return;
    const decision = decideOutcome({ reports: match.reports, left: match.left, silent, waitExpired });
    if (decision.done) settle(lobby, match, decision.winner, decision.reason, now);
  };

  const sideOf = (match: Match, connection: Connection): 0 | 1 => (match.order[0] === connection ? 0 : 1);

  /** Whoever's leaving a lobby, by choice or not. */
  const leave = (connection: Connection, now: number) => {
    const lobby = connection.lobby;
    if (!lobby) return;
    connection.lobby = null;
    if ((lobby.state === "playing" || lobby.state === "settling") && lobby.match) {
      const side = sideOf(lobby.match, connection);
      lobby.match.gone[side] = true;
      lobby.match.left = side;
      judge(lobby, now);
      return;
    }
    close(lobby, connection === lobby.creator ? "creator-left" : "opponent-left", connection);
  };

  const onMatchMessage = (lobby: Lobby, connection: Connection, message: ClientMessage & { t: "input" | "hash" | "leave" | "result" }, now: number) => {
    const match = lobby.match;
    if (lobby.state !== "playing" || !match) return;
    const side = sideOf(match, connection);
    const opponent = match.order[side === 0 ? 1 : 0];
    if (message.t === "result") {
      if (match.reports[side]) return;
      match.reports[side] = message.report;
      match.reportDeadline ??= now + REPORT_WAIT_MS;
      judge(lobby, now);
      return;
    }
    if (message.t === "input") {
      match.lastInputAt[side] = now;
      match.lastFrame[side] = Math.max(match.lastFrame[side], message.frame);
    }
    if (!match.gone[side === 0 ? 1 : 0]) opponent.player.send(message);
    if (message.t === "leave") {
      match.left = side;
      judge(lobby, now);
    }
  };

  const tickMatch = (lobby: Lobby, match: Match, now: number) => {
    if (match.reportDeadline !== null) {
      if (now >= match.reportDeadline) judge(lobby, now, [false, false], true);
      return;
    }
    // Lockstep stops the player left waiting from sending too, so going quiet proves nothing on its own.
    // Whoever's furthest behind is the one holding things up.
    const [a, b] = match.lastFrame;
    const quiet = (side: 0 | 1) => now >= match.lastInputAt[side] + SILENCE_MS;
    if (a === b) {
      if (quiet(0) && quiet(1)) judge(lobby, now, [true, true]);
    } else {
      const behind: 0 | 1 = a < b ? 0 : 1;
      if (quiet(behind)) judge(lobby, now, behind === 0 ? [true, false] : [false, true]);
    }
  };

  const takeOver = (next: { player: Player; visible: boolean }, now: number) => {
    const existing = connections.get(next.player.id);
    if (existing) {
      leave(existing, now);
      existing.player.close();
    }
    waitingToReplace.delete(next.player.id);
    connections.set(next.player.id, { player: next.player, visible: next.visible, lobby: null });
  };

  return {
    connect(player) {
      if (!connections.has(player.id)) {
        connections.set(player.id, { player, visible: false, lobby: null });
        return;
      }
      // Opening your own invite link in another tab mustn't wreck the lobby it's for, so nothing changes until this one does something.
      waitingToReplace.get(player.id)?.player.close();
      waitingToReplace.set(player.id, { player, visible: false });
    },
    disconnect(player, now) {
      if (waitingToReplace.get(player.id)?.player === player) {
        waitingToReplace.delete(player.id);
        return;
      }
      const connection = current(player);
      if (!connection) return;
      leave(connection, now);
      connections.delete(player.id);
      const next = waitingToReplace.get(player.id);
      if (next) {
        waitingToReplace.delete(player.id);
        connections.set(player.id, { player: next.player, visible: next.visible, lobby: null });
      }
    },
    message(player, message, now) {
      const waiting = waitingToReplace.get(player.id);
      if (waiting?.player === player) {
        if (message.t === "visible") waiting.visible = message.visible;
        if (message.t === "join-lobby" && lobbies.get(message.code)?.creator.player.id === player.id) {
          player.send({ t: "lobby-error", reason: "own-lobby" });
          return;
        }
        if (message.t !== "create-lobby" && message.t !== "join-lobby") return;
        takeOver(waiting, now);
      }
      const connection = current(player);
      if (!connection) return;
      switch (message.t) {
        case "create-lobby": {
          leave(connection, now);
          let code = deps.rollCode();
          while (lobbies.has(code)) code = deps.rollCode();
          const lobby: Lobby = { code, creator: connection, guest: null, state: "waiting", since: now, match: null, rematch: new Set(), ready: new Set() };
          lobbies.set(code, lobby);
          connection.lobby = lobby;
          player.send({ t: "lobby", code });
          return;
        }
        case "join-lobby": {
          const lobby = lobbies.get(message.code);
          if (!lobby) return player.send({ t: "lobby-error", reason: "no-such-lobby" });
          if (lobby.creator.player.id === player.id) return player.send({ t: "lobby-error", reason: "own-lobby" });
          if (lobby.guest) return player.send({ t: "lobby-error", reason: "full" });
          leave(connection, now);
          lobby.guest = connection;
          connection.lobby = lobby;
          lobby.creator.player.send({ t: "opponent-joined", opponent: player.identity });
          player.send({ t: "opponent-joined", opponent: lobby.creator.player.identity });
          beginStarting(lobby, now);
          return;
        }
        case "leave-lobby":
          leave(connection, now);
          return;
        case "visible":
          connection.visible = message.visible;
          if (message.visible && connection.lobby?.state === "starting") {
            connection.lobby.ready.add(connection);
            startIfReady(connection.lobby, now);
          }
          return;
        case "rematch": {
          const lobby = connection.lobby;
          if (!lobby || lobby.state !== "between" || !lobby.guest) return;
          lobby.rematch.add(connection);
          if (lobby.rematch.size === 2) {
            beginStarting(lobby, now);
          } else {
            (connection === lobby.creator ? lobby.guest : lobby.creator).player.send({ t: "rematch-wanted" });
          }
          return;
        }
        case "input":
        case "hash":
        case "leave":
        case "result":
          if (connection.lobby) onMatchMessage(connection.lobby, connection, message, now);
          return;
        default:
          // "hello" has been dealt with by then, and "ping" only keeps the connection open.
          return;
      }
    },
    tick(now) {
      for (const lobby of [...lobbies.values()]) {
        if (lobby.state === "playing" && lobby.match) tickMatch(lobby, lobby.match, now);
        else if ((lobby.state === "waiting" || lobby.state === "between") && now >= lobby.since + LOBBY_EMPTY_MS) close(lobby, "expired");
        else if (lobby.state === "starting" && now >= lobby.since + VISIBLE_WAIT_MS) close(lobby, "not-back-in-time");
      }
    },
  };
}
