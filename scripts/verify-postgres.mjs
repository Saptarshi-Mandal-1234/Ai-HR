import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  console.log("PostgreSQL verification skipped: DATABASE_URL is not set.");
  process.exit(0);
}

const organizationId = `verification-${randomUUID()}`;
const port = "3300";
let server;

try {
  server = await startServer();
  const health = await get("/api/health");
  assert(health.database === "postgresql", "Server did not select PostgreSQL storage.");
  const created = await post("/api/records", {
    type: "policy",
    name: "PostgreSQL restart verification",
    details: "This record must survive an application restart."
  });
  assert(created.record.id, "PostgreSQL record creation failed.");
  await stopServer();

  server = await startServer();
  const records = await get("/api/records?q=PostgreSQL%20restart%20verification");
  assert(records.total === 1, "PostgreSQL data did not survive application restart.");
  console.log("PostgreSQL schema, write transaction, and restart persistence verification passed.");
} finally {
  await stopServer();
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: false });
  try {
    await pool.query("DELETE FROM aihr_stores WHERE organization_id = $1", [organizationId]);
  } finally {
    await pool.end();
  }
}

async function startServer() {
  let logs = "";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: port,
      AIHR_ORGANIZATION_ID: organizationId,
      AIHR_AUTH_REQUIRED: "false",
      AIHR_ADMIN_TOKEN: "",
      AIHR_HR_MANAGER_TOKEN: "",
      AIHR_RECRUITER_TOKEN: "",
      AIHR_EMPLOYEE_TOKEN: "",
      AIHR_AUDITOR_TOKEN: "",
      DATABASE_SSL: process.env.DATABASE_SSL || "disable",
      GEMINI_API_KEY: "postgres-test-key"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) return child;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  child.kill("SIGTERM");
  throw new Error(`PostgreSQL verification server did not start. Logs: ${logs}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  server = undefined;
}

async function get(path) {
  const response = await fetch(`http://localhost:${port}${path}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `${path} failed.`);
  return data;
}

async function post(path, body) {
  const response = await fetch(`http://localhost:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `${path} failed.`);
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
