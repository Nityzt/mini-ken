import { createServer } from "node:http";
import next from "next";
import { createApi } from "./api.ts";
import { databaseUrl, migrate, openDb } from "./db.ts";
import { createRelay } from "./relay.ts";
import { upgradeTarget } from "./upgrade.ts";

const port = Number(process.env.PORT ?? 3210);
// Everything on this machine stays on loopback. Only the host's environment opens it up.
const hostname = process.env.HOST ?? "127.0.0.1";
const dev = process.env.NODE_ENV !== "production";

const db = openDb(databaseUrl(process.env), process.env.TURSO_AUTH_TOKEN);
await migrate(db);

const publicOrigin = process.env.PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`;
const api = createApi({ db, now: Date.now, publicOrigin, secureCookies: !dev, trustProxy: process.env.TRUST_PROXY === "1" });

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
await app.prepare();
const upgradeNext = app.getUpgradeHandler();

const server = createServer((req, res) => {
  // Keeps the free host awake, so it mustn't cost anything: no database, no Next.
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.url?.startsWith("/api/")) {
    void api(req, res);
    return;
  }
  void handle(req, res);
});
const relay = createRelay({ db, now: Date.now, publicOrigin });
server.on("upgrade", (req, socket, head) => {
  const target = upgradeTarget(req.url, dev);
  if (target === "relay") relay.handleUpgrade(req, socket, head);
  else if (target === "next") void upgradeNext(req, socket, head);
  else socket.destroy();
});
server.listen(port, hostname, () => console.log(`Tiny Kendo on http://${hostname}:${port}`));
