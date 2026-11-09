// For the owner: players have no email, so this is how a forgotten password gets reset.
// Usage: node --env-file-if-exists=.env server/scripts/reset-password.ts <username>
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { passwordProblem, setPassword } from "../accounts.ts";
import { openDb } from "../db.ts";

/** The password's never an argument, so it can't end up in the shell's history, and it isn't echoed. */
function askQuietly(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const silent = new Writable({ write: (_chunk, _encoding, done) => done() });
  const lines = createInterface({ input: process.stdin, output: silent, terminal: !!process.stdin.isTTY });
  return new Promise((resolve) => {
    lines.once("line", (line) => {
      lines.close();
      process.stdout.write("\n");
      resolve(line);
    });
  });
}

const username = process.argv[2];
if (!username) {
  console.error("Usage: reset-password.ts <username>");
  process.exit(2);
}
const password = await askQuietly(`New password for ${username}: `);
const problem = passwordProblem(password);
if (problem) {
  console.error(problem);
  process.exit(2);
}
const db = openDb(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN);
const found = await setPassword(db, username, password);
db.close();
console.log(found ? `Done. ${username} has been signed out everywhere.` : `There's no account called ${username}.`);
process.exit(found ? 0 : 1);
