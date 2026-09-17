import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { decryptBackup, loadBackupKey } from "./backup-crypto.mjs";

const databaseUrl = process.env.DATABASE_URL || "";
const backupPath = process.argv[2] ? resolve(process.argv[2]) : "";
if (!databaseUrl) throw new Error("DATABASE_URL is required for restore.");
if (!backupPath) throw new Error("Pass the encrypted backup file path as the first argument.");
const envelope = JSON.parse(await readFile(backupPath, "utf8"));
const backup = decryptBackup(envelope, loadBackupKey());
const organizationId = String(backup.organizationId || "");
if (!organizationId || process.env.AIHR_RESTORE_CONFIRM !== organizationId) {
  throw new Error(`Restore blocked. Set AIHR_RESTORE_CONFIRM=${organizationId} to confirm the exact organization.`);
}
if (!Array.isArray(backup.data?.records) || !Array.isArray(backup.data?.audit)) {
  throw new Error("Backup data failed structural validation.");
}

const pool = new pg.Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO aihr_stores (organization_id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (organization_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [organizationId, JSON.stringify(backup.data)]
  );
  await client.query("COMMIT");
  console.log(`Restore completed for organization: ${organizationId}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

function resolveSsl(url) {
  const host = new URL(url).hostname;
  return ["localhost", "127.0.0.1", "postgres"].includes(host) ? false : { rejectUnauthorized: false };
}
