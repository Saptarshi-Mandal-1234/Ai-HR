const baseUrl = process.env.AIHR_BASE_URL || "http://localhost:3000";
const token = process.env.AIHR_TEST_TOKEN || "";

const headers = token ? { Authorization: `Bearer ${token}` } : {};

await check("health", "/api/health");
await check("ready", "/api/ready");
await check("security", "/api/security");
await post("create record", "/api/records", {
  type: "candidate",
  name: "Smoke Test Candidate",
  details: "Created by backend smoke test."
});
await post("import records", "/api/records/import", {
  source: "smoke-test.csv",
  records: [
    {
      name: "Smoke Test Employee",
      email: "smoke.employee@example.com",
      jobTitle: "Operations Analyst",
      department: "People"
    }
  ]
});
await post("risk classify", "/api/risk/classify", {
  decisionType: "termination",
  subject: "Smoke Test Employee",
  facts: "Missed deadlines and has an active medical leave request.",
  proposedAction: "Evaluate termination risk."
});
await check("org", "/api/org");

console.log("Smoke tests passed.");

async function check(name, path) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${name} failed: ${response.status} ${data.error || ""}`);
  }
}

async function post(name, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${name} failed: ${response.status} ${data.error || ""}`);
  }
}
