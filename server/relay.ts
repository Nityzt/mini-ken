import { randomInt } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { ONLINE_MIN_DAN } from "../game/net/profile.ts";
import { allowedAppearance, rankForRecord, type Appearance } from "../game/net/appearance.ts";
import { LOBBY_CODE_ALPHABET, LOBBY_CODE_LENGTH, parseClientMessage, PROTOCOL_VERSION, type ClientMessage, type Identity, type ServerMessage } from "../game/net/protocol.ts";
import { isOpen } from "../game/progress.ts";
import { readSave } from "../game/save.ts";
import { accountForSession, type Account } from "./accounts.ts";
import { originAllowed, sessionToken } from "./api.ts";
import type { Db } from "./db.ts";
import { createLobbyHub, type Player } from "./lobby.ts";
import { recordMatch, recordOf } from "./matches.ts";

const MESSAGE_LIMIT_BYTES = 1024;
/** A match sends about 61 a second. This is plenty, even catching up after a hiccup. */
const MESSAGES_PER_SECOND = 300;
const TICK_MS = 1000;
const REFRESH = "The game's been updated. Please refresh the page.";

const rollCode = () => Array.from({ length: LOBBY_CODE_LENGTH }, () => LOBBY_CODE_ALPHABET[randomInt(LOBBY_CODE_ALPHABET.length)]).join("");
const rollSeed = () => randomInt(2 ** 31);

/** A rank comes from the story the account has saved. A modified client could fake that too, which is fine for now. */
async function danOf(db: Db, accountId: string): Promise<number> {
  const { rows } = await db.execute("SELECT data FROM story_saves WHERE account_id = ?", [accountId]);
  const text = rows[0]?.data;
  if (typeof text !== "string") return ONLINE_MIN_DAN;
  const run = readSave({ getItem: () => text, setItem() {}, removeItem() {} });
  // Whole numbers only: an opponent's client refuses anything else, and would never see the match start.
  return Math.max(ONLINE_MIN_DAN, run && isOpen(run, "online") ? Math.floor(run.dan) : 0);
}

function refuse(socket: Duplex, status: 401 | 403 | 500) {
  socket.write(`HTTP/1.1 ${status} ${status === 500 ? "Error" : "Refused"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

export function createRelay(deps: { db: Db; now(): number; publicOrigin: string }): { handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void; close(): void } {
  const { db, now, publicOrigin } = deps;
  const hub = createLobbyHub({
    rollCode,
    rollSeed,
    async record(result) {
      await recordMatch(db, result);
      const [one, two] = await Promise.all(result.players.map((id) => recordOf(db, id)));
      return { wins: [one.wins, two.wins], losses: [one.losses, two.losses] };
    },
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MESSAGE_LIMIT_BYTES });
  const ticker = setInterval(() => hub.tick(now()), TICK_MS);
  ticker.unref();

  const serve = (socket: WebSocket, account: Account) => {
    const say = (message: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };
    let player: Player | null = null;
    let greeted = false;
    /** Whatever arrives in the moment between hello and being set up. */
    const held: ClientMessage[] = [];
    let windowStart = now();
    let windowCount = 0;

    const greet = async (appearance?: Appearance) => {
      greeted = true;
      const [dan, record] = await Promise.all([danOf(db, account.id), recordOf(db, account.id)]);
      const identity: Identity = { id: account.id, name: account.username, dan, guest: false, rank: rankForRecord(record), ...(appearance ? { appearance: allowedAppearance(appearance, record) } : {}) };
      if (socket.readyState !== socket.OPEN) return;
      player = { id: account.id, identity, send: say, close: () => socket.close() };
      hub.connect(player, now());
      say({ t: "welcome", identity });
      for (const message of held.splice(0)) hub.message(player, message, now());
    };

    socket.on("error", () => {});
    socket.on("message", (data, isBinary) => {
      if (now() - windowStart >= 1000) {
        windowStart = now();
        windowCount = 0;
      }
      if (++windowCount > MESSAGES_PER_SECOND) {
        socket.terminate();
        return;
      }
      if (isBinary) return;
      const message = parseClientMessage(String(data));
      if (!message) return;
      if (!greeted) {
        if (message.t === "hello" && message.version === PROTOCOL_VERSION) {
          greet(message.appearance).catch(() => socket.terminate());
          return;
        }
        say({ t: "rejected", reason: REFRESH });
        socket.close();
        return;
      }
      if (player) hub.message(player, message, now());
      else held.push(message);
    });
    socket.on("close", () => {
      if (player) hub.disconnect(player, now());
    });
  };

  return {
    handleUpgrade(req, socket, head) {
      socket.on("error", () => {});
      if (!originAllowed(req.headers.origin, publicOrigin)) return refuse(socket, 403);
      accountForSession(db, sessionToken(req), now())
        .then((account) => {
          if (!account) return refuse(socket, 401);
          wss.handleUpgrade(req, socket, head, (ws) => serve(ws, account));
        })
        .catch(() => refuse(socket, 500));
    },
    close() {
      clearInterval(ticker);
      wss.close();
    },
  };
}
