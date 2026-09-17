import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { encryptBackup, loadBackupKey } from "./backup-crypto.mjs";

const databaseUrl = process.env.DATABASE_URL || "";
const organizationId = process.env.AIHR_ORGANIZATION_ID || "default";
if (!databaseUrl) throw new Error("DATABASE_URL is required for production backup.");
const key = loadBackupKey();
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });

try {
  const result = await pool.query("SELECT data, updated_at FROM aihr_stores WHERE organization_id = $1", [organizationId]);
  if (!result.rows[0]) throw new Error(`Organization ${organizationId} was not found.`);
  const envelope = encryptBackup({
    organizationId,
    databaseUpdatedAt: result.rows[0].updated_at,
    data: result.rows[0].data
  }, key);
  const backupDir = resolve(process.env.AIHR_BACKUP_DIR || "backups");
  await mkdir(backupDir, { recursive: true });
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const target = resolve(backupDir, `${safeOrg}-${new Date().toISOString().replace(/[:.]/g, "-")}.aihr-backup.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(envelope));
  await rename(temporary, target);
  console.log(`Encrypted backup created: ${target}`);
} finally {
  await pool.end();
}

function resolveSsl(url) {
  const host = new URL(url).hostname;
  return ["localhost", "127.0.0.1", "postgres"].includes(host) ? false : { rejectUnauthorized: false };
}
