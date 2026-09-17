import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.AIHR_BASE_URL || "http://localhost:3000";
const token = process.env.AIHR_TEST_TOKEN || "";
const datasetPath = resolve("datasets/ibm-employee-attrition.csv");
const results = [];
const startedAt = new Date().toISOString();

await run("health and readiness", testHealth);
await run("IBM synthetic dataset import", testDatasetImport);
await run("all record types", testRecordTypes);
await run("risk classification", testRiskClassification);
await run("all eight HR specialties", testHrSpecialties);
await run("all decision workflows and approval gates", testDecisionWorkflows);
await run("organization metrics and audit trail", testOperationsState);
await run("input validation", testValidation);

const failed = results.filter((item) => item.status === "failed");
const report = {
  startedAt,
  completedAt: new Date().toISOString(),
  baseUrl,
  dataset: {
    source: "https://github.com/IBM/employee-attrition-aif360/blob/master/data/emp_attrition.csv",
    synthetic: true,
    rows: 1470
  },
  summary: { passed: results.length - failed.length, failed: failed.length, total: results.length },
  results
};

await mkdir(resolve("test-results"), { recursive: true });
await writeFile(resolve("test-results/full-e2e-report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.summary.passed}/${report.summary.total} test groups passed.`);
console.log("Report: test-results/full-e2e-report.json");
if (failed.length) process.exitCode = 1;

async function testHealth() {
  const health = await api("/api/health");
  const ready = await api("/api/ready");
  assert(health.ok && health.hasGeminiKey, "Server or Gemini configuration is not healthy.");
  assert(ready.ready && ready.storage === "ok", "Storage is not ready.");
  return { version: health.version, model: health.model, database: ready.database };
}

async function testDatasetImport() {
  const csv = await readFile(datasetPath, "utf8");
  const sourceRows = parseCsv(csv);
  assert(sourceRows.length === 1470, `Expected 1470 dataset rows, found ${sourceRows.length}.`);

  const existing = await fetchAllRecords();
  const existingNames = new Set(existing.map((record) => record.name));
  const records = sourceRows.map(toEmployeeRecord).filter((record) => !existingNames.has(record.name));
  let imported = 0;
  for (let index = 0; index < records.length; index += 500) {
    const batch = records.slice(index, index + 500);
    const result = await api("/api/records/import", {
      method: "POST",
      body: { source: "IBM synthetic employee attrition dataset", records: batch }
    });
    imported += result.importedCount;
  }

  const after = await fetchAllRecords();
  const datasetRecords = after.filter((record) => record.name.startsWith("IBM Synthetic Employee #"));
  assert(datasetRecords.length === 1470, `Expected 1470 imported employee records, found ${datasetRecords.length}.`);
  return { sourceRows: sourceRows.length, newlyImported: imported, storedRows: datasetRecords.length };
}

async function testRecordTypes() {
  const types = ["employee", "candidate", "job", "policy", "case", "task"];
  for (const type of types) {
    const response = await api("/api/records", {
      method: "POST",
      body: { type, name: `E2E ${type} ${Date.now()}`, details: "Synthetic end-to-end verification record." }
    });
    assert(response.record.type === type, `Record type ${type} was not preserved.`);
  }
  return { tested: types };
}

async function testRiskClassification() {
  const low = await api("/api/risk/classify", {
    method: "POST",
    body: {
      decisionType: "draft_document",
      subject: "Welcome checklist",
      facts: "A standard orientation checklist is needed.",
      proposedAction: "Draft the checklist."
    }
  });
  const critical = await api("/api/risk/classify", {
    method: "POST",
    body: {
      decisionType: "termination",
      subject: "Synthetic case",
      facts: "The person has a medical leave request and a performance concern.",
      proposedAction: "Evaluate termination."
    }
  });
  assert(low.risk.level === "low" && low.risk.canAutoAct, "Low-risk workflow was classified incorrectly.");
  assert(critical.risk.level === "critical" && critical.risk.requiresHumanApproval, "Critical workflow was not gated.");
  return { low: low.risk.level, critical: critical.risk.level, flags: critical.risk.flags };
}

async function testHrSpecialties() {
  const requests = {
    generalist: "Create a concise weekly people-operations checklist for a 50-person software company.",
    recruiter: "Create a structured interview scorecard for a customer support specialist.",
    onboarding: "Create a first-week onboarding checklist for a remote product designer.",
    relations: "Create a neutral intake checklist for a workplace concern without reaching a conclusion.",
    performance: "Create a monthly coaching conversation template based on documented goals.",
    policy: "Draft a simple equipment-return procedure for departing workers.",
    analytics: "Create an aggregate analysis plan for the fictional IBM attrition dataset; prohibit individual employment actions.",
    learning: "Create a four-week manager training outline on useful feedback conversations."
  };
  const outputs = {};
  for (const [mode, prompt] of Object.entries(requests)) {
    console.log(`  Gemini specialty: ${mode}`);
    const response = await api("/api/hr", {
      method: "POST",
      timeoutMs: 90_000,
      body: {
        mode,
        prompt,
        companyContext: "Synthetic test company. No real employee data. Human review is mandatory for high-impact action.",
        desiredOutput: "checklist",
        riskLevel: mode === "relations" ? "sensitive" : "normal"
      }
    });
    assert(typeof response.result === "string" && response.result.length > 80, `${mode} returned no useful Gemini output.`);
    outputs[mode] = response.result.length;
  }
  return { outputCharacters: outputs };
}

async function testDecisionWorkflows() {
  const cases = [
    ["draft_document", "Welcome note", "The orientation schedule is confirmed.", "Draft a welcome note.", false],
    ["answer_employee_question", "Office hours", "The handbook lists support hours.", "Prepare an informational answer.", false],
    ["generate_training_plan", "Manager skills", "Managers requested feedback training.", "Create a training outline.", false],
    ["candidate_shortlist", "Synthetic applicant pool", "A structured rubric and fictional scores are available.", "Prepare a shortlist recommendation.", true],
    ["performance_action", "Synthetic performance case", "Documented goals were missed during two review periods.", "Prepare a coaching action brief.", true],
    ["compensation_change", "Synthetic pay review", "Role scope and benchmark information are available.", "Evaluate a salary adjustment.", true],
    ["termination", "Synthetic separation case", "Documented performance concerns exist.", "Evaluate termination risk.", true],
    ["employee_relations_case", "Synthetic workplace concern", "A concern was reported and has not been investigated.", "Prepare a neutral investigation plan.", true]
  ];
  const statuses = {};
  for (const [decisionType, subject, facts, proposedAction, shouldGate] of cases) {
    console.log(`  Gemini decision: ${decisionType}`);
    const response = await api("/api/decisions", {
      method: "POST",
      timeoutMs: 90_000,
      body: { decisionType, subject, facts, proposedAction }
    });
    const { decision } = response;
    assert(decision.brief.length > 80, `${decisionType} returned no useful decision brief.`);
    assert(decision.risk.requiresHumanApproval === shouldGate, `${decisionType} approval gate was incorrect.`);
    if (shouldGate) {
      assert(decision.status === "needs_review", `${decisionType} was not held for review.`);
      const approved = await api(`/api/decisions/${decision.id}/approve`, {
        method: "POST",
        body: { reviewer: "Automated E2E human-review simulation", note: "Workflow gate verified with synthetic facts." }
      });
      assert(approved.decision.status === "approved_after_review", `${decisionType} approval transition failed.`);
      statuses[decisionType] = approved.decision.status;
    } else {
      assert(decision.status === "approved_for_action", `${decisionType} low-risk status was incorrect.`);
      statuses[decisionType] = decision.status;
    }
  }
  return { statuses };
}

async function testOperationsState() {
  const [org, decisions, audit] = await Promise.all([
    api("/api/org"),
    api("/api/decisions"),
    api("/api/audit")
  ]);
  assert(org.records >= 1476, "Organization metrics did not include imported and created records.");
  assert(decisions.decisions.length >= 8, "Decision queue is missing test workflows.");
  assert(audit.audit.some((event) => event.action === "records_imported"), "Import audit event is missing.");
  assert(audit.audit.some((event) => event.action === "decision_approved"), "Approval audit event is missing.");
  return { records: org.records, decisions: org.decisions, auditEvents: org.auditEvents };
}

async function testValidation() {
  const response = await rawApi("/api/records", {
    method: "POST",
    body: { type: "unsupported", name: "Invalid test record" }
  });
  assert(response.status === 400, `Expected invalid record to return 400, got ${response.status}.`);
  return { invalidRecordStatus: response.status };
}

async function run(name, operation) {
  process.stdout.write(`${name}... `);
  const start = Date.now();
  try {
    const detail = await operation();
    results.push({ name, status: "passed", durationMs: Date.now() - start, detail });
    console.log("passed");
  } catch (error) {
    results.push({ name, status: "failed", durationMs: Date.now() - start, error: error.message });
    console.log(`failed: ${error.message}`);
  }
}

async function api(path, options = {}) {
  const response = await rawApi(path, options);
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${response.data.error || "unknown error"}`);
  return response.data;
}

async function rawApi(path, { method = "GET", body, timeoutMs = 30_000 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
}

async function fetchAllRecords() {
  const records = [];
  let offset = 0;
  while (true) {
    const page = await api(`/api/records?limit=500&offset=${offset}`);
    records.push(...page.records);
    offset += page.records.length;
    if (!page.records.length || records.length >= page.total) return records;
  }
}

function toEmployeeRecord(row) {
  return {
    type: "employee",
    name: `IBM Synthetic Employee #${row.EmployeeNumber}`,
    age: row.Age,
    attrition: row.Attrition,
    businessTravel: row.BusinessTravel,
    department: row.Department,
    jobRole: row.JobRole,
    jobLevel: row.JobLevel,
    jobSatisfaction: row.JobSatisfaction,
    monthlyIncome: row.MonthlyIncome,
    overtime: row.OverTime,
    totalWorkingYears: row.TotalWorkingYears,
    trainingTimesLastYear: row.TrainingTimesLastYear,
    workLifeBalance: row.WorkLifeBalance,
    yearsAtCompany: row.YearsAtCompany
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  const [headers, ...data] = rows;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
