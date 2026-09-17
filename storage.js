import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

export function createStorage({ dataDir, databaseUrl, organizationId, sslMode = "auto" }) {
  const storePath = join(dataDir, "hr-store.json");
  const usePostgres = Boolean(databaseUrl);
  const pool = usePostgres
    ? new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl, sslMode), max: 10 })
    : null;
  let fileQueue = Promise.resolve();

  async function initialize() {
    if (!pool) {
      await mkdir(dataDir, { recursive: true });
      if (!existsSync(storePath)) await writeFile(storePath, JSON.stringify(initialStore(), null, 2));
      return;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aihr_stores (
        organization_id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      `INSERT INTO aihr_stores (organization_id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId, JSON.stringify(initialStore())]
    );
  }

  async function read() {
    if (!pool) return migrateStore(JSON.parse(await readFile(storePath, "utf8")));
    const result = await pool.query(
      "SELECT data FROM aihr_stores WHERE organization_id = $1",
      [organizationId]
    );
    if (!result.rows[0]) {
      await initialize();
      return read();
    }
    return migrateStore(result.rows[0].data);
  }

  async function mutate(mutator) {
    if (!pool) {
      const operation = fileQueue.then(async () => {
        const store = await read();
        const result = await mutator(store);
        await writeFileStore(store);
        return result;
      });
      fileQueue = operation.catch(() => undefined);
      return operation;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(
        "SELECT data FROM aihr_stores WHERE organization_id = $1 FOR UPDATE",
        [organizationId]
      );
      const store = migrateStore(selected.rows[0]?.data || initialStore());
      const result = await mutator(store);
      touchStore(store);
      await client.query(
        `INSERT INTO aihr_stores (organization_id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (organization_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [organizationId, JSON.stringify(store)]
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function importJsonIfEmpty() {
    if (!pool || !existsSync(storePath)) return { imported: false };
    const existing = await read();
    if (existing.records.length || existing.decisions.length || existing.audit.length > 1) {
      return { imported: false, reason: "database_not_empty" };
    }
    const local = migrateStore(JSON.parse(await readFile(storePath, "utf8")));
    await mutate((store) => {
      store.records = local.records;
      store.decisions = local.decisions;
      store.audit = local.audit;
    });
    return { imported: true, records: local.records.length, decisions: local.decisions.length };
  }

  async function health() {
    if (!pool) return { ok: true, engine: "json", organizationId };
    await pool.query("SELECT 1");
    return { ok: true, engine: "postgresql", organizationId };
  }

  async function close() {
    if (pool) await pool.end();
  }

  async function writeFileStore(store) {
    await mkdir(dataDir, { recursive: true });
    touchStore(store);
    if (existsSync(storePath)) await copyFile(storePath, `${storePath}.bak`);
    const tempPath = `${storePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(store, null, 2));
    await rename(tempPath, storePath);
  }

  return {
    initialize,
    read,
    mutate,
    importJsonIfEmpty,
    health,
    close,
    engine: usePostgres ? "postgresql" : "json"
  };
}

function resolveSsl(databaseUrl, sslMode) {
  if (sslMode === "disable") return false;
  if (sslMode === "require") return { rejectUnauthorized: false };
  try {
    const host = new URL(databaseUrl).hostname;
    return ["localhost", "127.0.0.1", "postgres"].includes(host)
      ? false
      : { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

function initialStore() {
  const now = new Date().toISOString();
  return {
    meta: { schemaVersion: 9, createdAt: now, updatedAt: now },
    settings: { organizationName: "AI HR Workspace", retentionDays: 365, compliance: {} },
    users: [],
    sessions: [],
    invitations: [],
    scheduledWorkflows: [],
    performanceReviews: [],
    employeeEvents: [],
    onboardingPacks: [],
    records: [],
    decisions: [],
    audit: [{
      id: randomUUID(),
      action: "store_initialized",
      actor: "system",
      detail: { version: 9 },
      createdAt: now
    }]
  };
}

function touchStore(store) {
  store.meta = {
    ...(store.meta || {}),
    schemaVersion: 9,
    updatedAt: new Date().toISOString()
  };
}

function migrateStore(store) {
  const now = new Date().toISOString();
  return {
    meta: {
      schemaVersion: 9,
      createdAt: store?.meta?.createdAt || now,
      updatedAt: store?.meta?.updatedAt || now
    },
    settings: {
      organizationName: store?.settings?.organizationName || "AI HR Workspace",
      retentionDays: Number(store?.settings?.retentionDays || 365),
      compliance: store?.settings?.compliance && typeof store.settings.compliance === "object" ? store.settings.compliance : {}
    },
    users: Array.isArray(store?.users) ? store.users : [],
    sessions: Array.isArray(store?.sessions) ? store.sessions : [],
    invitations: Array.isArray(store?.invitations) ? store.invitations : [],
    scheduledWorkflows: Array.isArray(store?.scheduledWorkflows) ? store.scheduledWorkflows : [],
    performanceReviews: Array.isArray(store?.performanceReviews) ? store.performanceReviews : [],
    employeeEvents: Array.isArray(store?.employeeEvents) ? store.employeeEvents : [],
    onboardingPacks: Array.isArray(store?.onboardingPacks) ? store.onboardingPacks : [],
    records: Array.isArray(store?.records) ? store.records : [],
    decisions: Array.isArray(store?.decisions) ? store.decisions : [],
    audit: Array.isArray(store?.audit) ? store.audit : []
  };
}
