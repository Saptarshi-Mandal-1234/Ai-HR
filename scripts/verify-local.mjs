import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = process.env.AIHR_VERIFY_PORT || "3100";
const dataDir = await mkdtemp(join(tmpdir(), "aihr-local-test-"));
const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: port,
    AIHR_DATA_DIR: dataDir,
    DATABASE_URL: "",
    AIHR_AUTH_REQUIRED: "false",
    AIHR_ADMIN_TOKEN: "",
    AIHR_HR_MANAGER_TOKEN: "",
    AIHR_RECRUITER_TOKEN: "",
    AIHR_EMPLOYEE_TOKEN: "",
    AIHR_AUDITOR_TOKEN: "",
    GEMINI_API_KEY: "verification-key"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForServer(port);
  await runChecks(port);
  console.log(`Verified AI HR backend on http://localhost:${port}`);
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  await rm(dataDir, { recursive: true, force: true });
}

async function waitForServer(targetPort) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${targetPort}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Server did not start. Logs: ${output}`);
}

async function runChecks(targetPort) {
  const base = `http://localhost:${targetPort}`;
  const endpoints = ["/api/health", "/api/ready", "/api/security", "/api/org"];
  for (const endpoint of endpoints) {
    const response = await fetch(`${base}${endpoint}`);
    if (!response.ok) throw new Error(`${endpoint} failed: ${response.status}`);
  }

  const recordResponse = await fetch(`${base}/api/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candidate",
      name: "Verification Candidate",
      details: "Created by local verification."
    })
  });
  if (!recordResponse.ok) throw new Error(`/api/records failed: ${recordResponse.status}`);

  const importResponse = await fetch(`${base}/api/records/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "verification-import.csv",
      records: [
        {
          name: "Verification Employee",
          email: "verification.employee@example.com",
          jobTitle: "HR Operations Associate",
          department: "People"
        }
      ]
    })
  });
  const importData = await importResponse.json();
  if (!importResponse.ok || importData.importedCount !== 1) {
    throw new Error(`/api/records/import failed: ${importResponse.status}`);
  }

  const riskResponse = await fetch(`${base}/api/risk/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decisionType: "termination",
      subject: "Verification Employee",
      facts: "Missed deadlines and has an active medical leave request.",
      proposedAction: "Evaluate termination."
    })
  });
  const riskData = await riskResponse.json();
  if (!riskResponse.ok || riskData.risk?.level !== "critical") {
    throw new Error(`/api/risk/classify failed`);
  }
}
