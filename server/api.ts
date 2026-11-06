import type { IncomingMessage, ServerResponse } from "node:http";
import { readSave } from "../game/save.ts";
import { accountForSession, createSession, endSession, setTutorial, signIn, signUp, type Account } from "./accounts.ts";
import type { Db } from "./db.ts";
import { historyOf, recordOf } from "./matches.ts";
import { createRateLimit } from "./rate-limit.ts";
import { readStory, SAVE_LIMIT_BYTES, writeStory } from "./saves.ts";

const COOKIE = "tk_session";
const BODY_LIMIT = 4 * 1024;
const MINUTE = 60 * 1000;

export type ApiDeps = { db: Db; now(): number; publicOrigin: string; secureCookies: boolean; trustProxy: boolean };

export function sessionToken(req: Pick<IncomingMessage, "headers">): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === COOKIE) return value;
  }
  return undefined;
}

export const originAllowed = (origin: string | undefined, publicOrigin: string): boolean => origin === publicOrigin;

class HttpProblem extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readBody(req: IncomingMessage, limit: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) tooBig = true;
      else chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      if (tooBig) return reject(new HttpProblem(413, "That's too big."));
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (typeof body === "object" && body !== null && !Array.isArray(body)) return resolve(body as Record<string, unknown>);
      } catch {
        // Falls through to the same answer.
      }
      reject(new HttpProblem(400, "That didn't make sense."));
    });
  });
}

/** Only ever a real save in the game's own format, or nothing at all. */
const isSave = (text: string) => readSave({ getItem: () => text, setItem() {}, removeItem() {} }) !== null;

const credentials = (body: Record<string, unknown>) => {
  if (typeof body.username !== "string" || typeof body.password !== "string") throw new HttpProblem(400, "A username and a password, please.");
  return { username: body.username, password: body.password };
};

export function createApi(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { db, now, publicOrigin, secureCookies, trustProxy } = deps;
  const failedByName = createRateLimit(5, 15 * MINUTE);
  const failedByAddress = createRateLimit(20, 15 * MINUTE);
  const signUpsByAddress = createRateLimit(5, 60 * MINUTE);
  const signUpTriesByAddress = createRateLimit(20, 60 * MINUTE);

  const addressOf = (req: IncomingMessage) => {
    const forwarded = req.headers["x-forwarded-for"];
    const first = trustProxy ? (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() : undefined;
    return first || req.socket.remoteAddress || "unknown";
  };
  const cookie = (value: string, maxAgeSeconds: number) => `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secureCookies ? "; Secure" : ""}`;
  const SESSION_SECONDS = 30 * 24 * 60 * 60;
  const startSession = async (res: ServerResponse, account: Account) => {
    res.setHeader("set-cookie", cookie(await createSession(db, account.id, now()), SESSION_SECONDS));
  };
  const reply = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  const signedIn = async (req: IncomingMessage) => {
    const account = await accountForSession(db, sessionToken(req), now());
    if (!account) throw new HttpProblem(401, "Please sign in.");
    return account;
  };

  const route = async (req: IncomingMessage, res: ServerResponse, path: string) => {
    const key = `${req.method} ${path}`;
    switch (key) {
      case "POST /api/signup": {
        const { username, password } = credentials(await readBody(req, BODY_LIMIT));
        // Counted before the work, so a lot of requests at once can't all slip through. A failed one gives its place back.
        const address = addressOf(req);
        const mayTry = signUpTriesByAddress.hit(address, now());
        const mayCreate = signUpsByAddress.hit(address, now());
        if (!mayTry || !mayCreate) {
          signUpsByAddress.undo(address, now());
          throw new HttpProblem(429, "Too many new accounts from here. Try again later.");
        }
        const result = await signUp(db, username, password);
        if ("problem" in result) {
          signUpsByAddress.undo(address, now());
          throw new HttpProblem(400, result.problem);
        }
        await startSession(res, result.account);
        return reply(res, 200, { account: result.account, wins: 0, losses: 0 });
      }
      case "POST /api/signin": {
        const { username, password } = credentials(await readBody(req, BODY_LIMIT));
        const nameKey = username.toLowerCase();
        const address = addressOf(req);
        // Counted before the work, so a lot of guesses at once get no more tries than one at a time. Success gives it back.
        const nameOk = failedByName.hit(nameKey, now());
        const addressOk = failedByAddress.hit(address, now());
        if (!nameOk || !addressOk) throw new HttpProblem(429, "Too many tries. Wait a while and try again.");
        const account = await signIn(db, username, password);
        if (!account) throw new HttpProblem(401, "That username and password don't match.");
        failedByName.undo(nameKey, now());
        failedByAddress.undo(address, now());
        await startSession(res, account);
        return reply(res, 200, { account, ...(await recordOf(db, account.id)) });
      }
      case "POST /api/signout": {
        const token = sessionToken(req);
        if (token) await endSession(db, token);
        res.setHeader("set-cookie", cookie("", 0));
        return reply(res, 200, {});
      }
      case "GET /api/me": {
        const account = await signedIn(req);
        return reply(res, 200, { account, ...(await recordOf(db, account.id)) });
      }
      case "GET /api/history":
        return reply(res, 200, await historyOf(db, (await signedIn(req)).id));
      case "POST /api/me/tutorial": {
        const account = await signedIn(req);
        await setTutorial(db, account.id);
        return reply(res, 200, {});
      }
      case "GET /api/story":
        return reply(res, 200, await readStory(db, (await signedIn(req)).id));
      case "PUT /api/story": {
        const account = await signedIn(req);
        const { baseRevision, data } = await readBody(req, SAVE_LIMIT_BYTES);
        if (!Number.isInteger(baseRevision) || (baseRevision as number) < 0) throw new HttpProblem(400, "That didn't make sense.");
        if (data !== null && (typeof data !== "string" || !isSave(data))) throw new HttpProblem(400, "That isn't a save.");
        const result = await writeStory(db, account.id, baseRevision as number, data, now());
        return result.ok ? reply(res, 200, { revision: result.revision }) : reply(res, 409, { current: result.current });
      }
      default:
        throw new HttpProblem(404, "Nothing here.");
    }
  };

  return async (req, res) => {
    try {
      if (req.method !== "GET" && !originAllowed(req.headers.origin, publicOrigin)) throw new HttpProblem(403, "Not from here.");
      await route(req, res, new URL(req.url ?? "/", "http://x").pathname);
    } catch (error) {
      if (error instanceof HttpProblem) return reply(res, error.status, { problem: error.message });
      // Never the request itself: a body here could hold someone's password.
      console.error("API error:", error instanceof Error ? error.message : "unknown");
      reply(res, 500, { problem: "Something went wrong." });
    }
  };
}
