import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const dataDir = await mkdtemp(join(tmpdir(), "aihr-full-e2e-"));
const port = String(process.env.AIHR_E2E_PORT || 3300);
const server = spawn(process.execPath, ["server.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: port,
    AIHR_DATA_DIR: dataDir,
    DATABASE_URL: "",
    DATABASE_SSL: "disable",
    AIHR_IMPORT_JSON: "false",
    AIHR_AUTH_REQUIRED: "false",
    AIHR_ADMIN_TOKEN: "",
    AIHR_HR_MANAGER_TOKEN: "",
    AIHR_RECRUITER_TOKEN: "",
    AIHR_EMPLOYEE_TOKEN: "",
    AIHR_AUDITOR_TOKEN: "",
    GEMINI_API_KEY: "isolated-e2e-test-key",
    AIHR_GEMINI_MOCK_RESPONSE: "Synthetic test response with documented evidence, practical next steps, explicit human review, and no automatic high-impact employment action. This deterministic output validates the complete workflow without sending data to an external AI provider."
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let logs = "";
server.stdout.on("data", (chunk) => { logs += chunk.toString(); });
server.stderr.on("data", (chunk) => { logs += chunk.toString(); });

try {
  await waitForServer();
  const test = spawn(process.execPath, ["scripts/full-e2e-test.mjs"], {
    cwd: root,
    env: { ...process.env, AIHR_BASE_URL: `http://localhost:${port}`, AIHR_TEST_TOKEN: "" },
    stdio: "inherit"
  });
  const exitCode = await new Promise((resolve) => test.once("exit", resolve));
  if (exitCode !== 0) process.exitCode = exitCode || 1;
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  await rm(dataDir, { recursive: true, force: true });
}

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Isolated E2E server did not start. Logs: ${logs}`);
}
