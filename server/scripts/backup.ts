// For the owner: copies accounts, stories and matches to a file. It holds password hashes, so keep it private.
// Usage: node --env-file-if-exists=.env server/scripts/backup.ts <out.json> [--allow-empty]
import { openDb } from "../db.ts";
import { writeBackup } from "./backup-lib.ts";

const out = process.argv[2];
if (!out || out.startsWith("--")) {
  console.error("Usage: backup.ts <out.json> [--allow-empty]");
  process.exit(2);
}
const db = openDb(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN);
try {
  const accounts = await writeBackup(db, out, { allowEmpty: process.argv.includes("--allow-empty") });
  console.log(`Backed up ${accounts} accounts to ${out}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Backup failed.");
  process.exitCode = 1;
} finally {
  db.close();
}
