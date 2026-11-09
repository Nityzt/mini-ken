import { parseServerMessage, PROTOCOL_VERSION, type ClientMessage, type Identity, type LinkMessage, type LobbyClosedReason, type LobbyErrorReason, type ServerMessage } from "./protocol.ts";
import type { FoundMatch } from "./service.ts";
import type { Appearance } from "./appearance.ts";
import { createSocketLink, type Link, type SocketLike } from "./transport.ts";

/** Browsers slow timers in hidden tabs to about one a minute at worst, and proxies usually wait longer than that. */
export const HEARTBEAT_MS = 25_000;

export type ServerOutcome = Extract<ServerMessage, { t: "outcome" }>;
export type LobbyState =
  | { kind: "connecting" }
  | { kind: "waiting"; code: string }
  | { kind: "joining" }
  | { kind: "opponent-here"; opponent: Identity; waitingForVisible: boolean }
  | { kind: "match"; match: FoundMatch }
  | { kind: "between"; opponent: Identity; theyWantRematch: boolean; iWantRematch: boolean }
  | { kind: "closed"; reason: LobbyClosedReason | LobbyErrorReason | "lost-connection" | "rejected"; detail?: string };
export type LobbyClient = {
  state(): LobbyState;
  rematch(): void;
  leave(): void;
  /** How the current or latest match went, once the server's decided. */
  outcome(): ServerOutcome | null;
};

/** Whether someone's actually looking at the game. A window can be on screen with them off in another one. */
export const pageAway = (page: { hidden: boolean; hasFocus(): boolean }): boolean => page.hidden || !page.hasFocus();

export const resolveServerUrl = (url: string, page: { protocol: string; host: string }): string => (url.startsWith("/") ? `${page.protocol === "https:" ? "wss" : "ws"}://${page.host}${url}` : url);

/**
 * Everything here runs from socket events and timers, never the game loop, which stops in a hidden tab.
 * That's what lets someone switch away to send the invite, and still hear when their friend arrives.
 */
export function createLobbyClient(options: {
  url: string;
  open?: (url: string) => SocketLike;
  join?: string;
  appearance?: Appearance;
  alert(): void;
  visibility: { hidden(): boolean; subscribe(changed: () => void): () => void };
  setInterval(run: () => void, ms: number): number;
  clearInterval(id: number): void;
}): LobbyClient {
  const { url, join, alert, visibility } = options;
  const open = options.open ?? ((target: string) => new WebSocket(target) as unknown as SocketLike);
  let state: Exclude<LobbyState, { kind: "opponent-here" }> | { kind: "opponent-here"; opponent: Identity } = join ? { kind: "joining" } : { kind: "connecting" };
  let opponent: Identity | null = null;
  let self: Identity | null = null;
  let outcome: ServerOutcome | null = null;
  let theyWantRematch = false;
  let iWantRematch = false;
  let relay: LinkMessage[] = [];
  let stopped = false;
  let heartbeat = 0;
  let unsubscribe = () => {};

  const stop = () => {
    if (stopped) return;
    stopped = true;
    options.clearInterval(heartbeat);
    unsubscribe();
  };
  const closeWith = (reason: Extract<LobbyState, { kind: "closed" }>["reason"], detail?: string) => {
    if (state.kind === "closed") return;
    state = detail === undefined ? { kind: "closed", reason } : { kind: "closed", reason, detail };
    stop();
    // A lobby that's over lets go of its connection, so it can't hold up another tab.
    if (!socket.closed) socket.close();
  };

  const startMatch = (message: Extract<ServerMessage, { t: "match" }>) => {
    outcome = null;
    theyWantRematch = false;
    iWantRematch = false;
    // Anything still on its way from the last match has nothing to do with this one.
    relay = [];
    const mine = relay;
    const matchLink: Link<LinkMessage> = {
      send: (linkMessage) => socket.send(linkMessage),
      receive: () => mine.splice(0),
      // The connection carries on, for the next match. A match ending doesn't end it.
      close() {},
      get closed() {
        return socket.closed;
      },
    };
    state = {
      kind: "match",
      match: {
        link: matchLink,
        seed: message.seed,
        side: message.side,
        opponent: message.opponent,
        ...(message.self || self ? { self: message.self ?? self! } : {}),
        live: { report: (report) => socket.send({ t: "result", report }), outcome: () => outcome },
      },
    };
  };

  const onArrive = (message: ServerMessage) => {
    switch (message.t) {
      case "welcome":
        self = message.identity;
        break;
      case "input":
      case "hash":
      case "leave":
        relay.push(message);
        break;
      case "lobby":
        state = { kind: "waiting", code: message.code };
        break;
      case "lobby-error":
        closeWith(message.reason);
        break;
      case "rejected":
        closeWith("rejected", message.reason);
        break;
      case "opponent-joined":
        // Only whoever's been waiting needs telling. The other one's just arrived.
        if (state.kind === "waiting") alert();
        opponent = message.opponent;
        state = { kind: "opponent-here", opponent };
        break;
      case "match":
        opponent = message.opponent;
        startMatch(message);
        break;
      case "outcome":
        outcome = message;
        if (opponent) state = { kind: "between", opponent, theyWantRematch, iWantRematch };
        break;
      case "rematch-wanted":
        theyWantRematch = true;
        break;
      case "lobby-closed":
        closeWith(message.reason);
        break;
      default:
        break;
    }
    return true;
  };

  const socket = createSocketLink<ClientMessage, ServerMessage>(open(url), parseServerMessage, { onArrive, onClosed: () => closeWith("lost-connection") });
  const reportVisibility = () => socket.send({ t: "visible", visible: !visibility.hidden() });

  socket.send({ t: "hello", version: PROTOCOL_VERSION, ...(options.appearance ? { appearance: options.appearance } : {}) });
  reportVisibility();
  socket.send(join ? { t: "join-lobby", code: join } : { t: "create-lobby" });
  heartbeat = options.setInterval(() => socket.send({ t: "ping" }), HEARTBEAT_MS);
  unsubscribe = visibility.subscribe(reportVisibility);

  return {
    state() {
      if (state.kind === "opponent-here") return { ...state, waitingForVisible: visibility.hidden() };
      if (state.kind === "between") return { ...state, theyWantRematch, iWantRematch };
      return state;
    },
    rematch() {
      iWantRematch = true;
      socket.send({ t: "rematch" });
    },
    leave() {
      socket.send({ t: "leave-lobby" });
      closeWith("creator-left");
    },
    outcome: () => outcome,
  };
}
