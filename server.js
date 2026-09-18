import { createServer } from "node:http";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const storePath = join(dataDir, "hr-store.json");
loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, ".env.local"));

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const APP_VERSION = "0.2.0";
const REQUEST_BODY_LIMIT = Number(process.env.AIHR_BODY_LIMIT_BYTES || 1_000_000);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45_000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.AIHR_RATE_LIMIT_WINDOW_MS || 60_000);
const DEFAULT_RATE_LIMIT = Number(process.env.AIHR_RATE_LIMIT || 120);
const AI_RATE_LIMIT = Number(process.env.AIHR_AI_RATE_LIMIT || 20);
const AUTH_REQUIRED = process.env.AIHR_AUTH_REQUIRED === "true";
const ALLOWED_ORIGIN = process.env.AIHR_ALLOWED_ORIGIN || "http://localhost:3000";
const roleTokens = {
  admin: process.env.AIHR_ADMIN_TOKEN || "",
  hr_manager: process.env.AIHR_HR_MANAGER_TOKEN || "",
  recruiter: process.env.AIHR_RECRUITER_TOKEN || "",
  employee: process.env.AIHR_EMPLOYEE_TOKEN || "",
  auditor: process.env.AIHR_AUDITOR_TOKEN || ""
};
const configuredAuth = Object.values(roleTokens).some(Boolean);
const rateBuckets = new Map();

const highImpactFlags = [
  "hire", "reject", "shortlist", "promotion", "demotion", "terminate", "termination",
  "fire", "layoff", "compensation", "salary", "bonus", "discipline", "pip",
  "harassment", "discrimination", "retaliation", "medical", "disability",
  "pregnancy", "leave", "payroll", "immigration", "visa", "union", "safety"
];

const automationAllowed = new Set([
  "draft_document",
  "summarize_policy",
  "create_checklist",
  "schedule_workflow",
  "answer_employee_question",
  "generate_training_plan"
]);

const allowedRecordTypes = new Set(["employee", "candidate", "job", "policy", "case", "task"]);
const allowedDecisionTypes = new Set([
  "draft_document",
  "answer_employee_question",
  "generate_training_plan",
  "candidate_shortlist",
  "performance_action",
  "compensation_change",
  "termination",
  "employee_relations_case"
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const systemInstruction = `
You are an AI HR operating partner for a growing company. You help with recruiting,
onboarding, employee relations, policy interpretation, performance management,
engagement, workforce planning, learning, compensation support, and HR operations.

Rules:
- Be practical, structured, and manager-ready.
- Ask for missing facts when the user is making a high-risk people decision.
- Flag legal, privacy, discrimination, retaliation, termination, payroll, immigration,
  medical, safety, union, or protected-class risk.
- Never claim to be a lawyer. Recommend qualified HR/legal review for high-risk cases.
- Do not invent company policies. Separate assumptions from recommendations.
- For high-impact employment decisions, produce a decision brief and review path.
  Do not pretend a model can be the sole accountable decision maker.
- Produce usable artifacts: emails, checklists, rubrics, scripts, plans, scorecards,
  interview questions, policy drafts, investigation plans, and decision memos.
`;

const hrModes = {
  generalist: "Act as a broad HR generalist and triage the request across the employee lifecycle.",
  recruiter: "Act as a recruiting partner focused on sourcing, screening, interview process, and candidate experience.",
  onboarding: "Act as an onboarding specialist focused on ramp plans, first-week workflows, and new-hire clarity.",
  relations: "Act as an employee relations specialist focused on fairness, documentation, investigations, and risk.",
  performance: "Act as a performance partner focused on feedback, goals, coaching, reviews, and PIPs.",
  policy: "Act as an HR policy analyst focused on clear policy language, exceptions, risk, and rollout.",
  analytics: "Act as a people analytics partner focused on metrics, dashboards, interpretation, and action plans.",
  learning: "Act as an L&D partner focused on capability building, training plans, and manager enablement."
};

const server = createServer(async (req, res) => {
  applySecurityHeaders(res);

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const traceId = req.headers["x-request-id"] || randomUUID();
    res.setHeader("X-Request-Id", traceId);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!enforceRateLimit(req, res, url.pathname)) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/org") {
      const actor = requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      const store = await readStore();
      sendJson(res, 200, summarizeStore(store));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/records") {
      const actor = requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      const store = await readStore();
      sendJson(res, 200, { records: store.records });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/records") {
      const actor = requireRole(req, res, ["admin", "hr_manager", "recruiter"]);
      if (!actor) return;
      await handleRecordCreate(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/decisions") {
      const actor = requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      const store = await readStore();
      sendJson(res, 200, { decisions: store.decisions });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/decisions") {
      const actor = requireRole(req, res, ["admin", "hr_manager", "recruiter"]);
      if (!actor) return;
      await handleDecisionRequest(req, res, actor);
      return;
    }

    const approvalMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)\/approve$/);
    if (req.method === "POST" && approvalMatch) {
      const actor = requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleDecisionApproval(req, res, approvalMatch[1], actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/audit") {
      const actor = requireRole(req, res, ["admin", "auditor"]);
      if (!actor) return;
      const store = await readStore();
      sendJson(res, 200, { audit: store.audit.slice(-100).reverse() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/hr") {
      const actor = requireRole(req, res, ["admin", "hr_manager", "recruiter", "employee"]);
      if (!actor) return;
      await handleHrRequest(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      const store = await readStore();
      sendJson(res, 200, {
        ok: true,
        model: MODEL,
        hasGeminiKey: Boolean(GEMINI_API_KEY),
        records: store.records.length,
        decisions: store.decisions.length,
        pendingApprovals: store.decisions.filter((item) => item.status === "needs_review").length
      });
          return;
    }

    if (req.method === "GET" && url.pathname === "/api/ready") {
      const store = await readStore();
      sendJson(res, 200, {
        ready: Boolean(GEMINI_API_KEY),
        storage: "ok",
        storeVersion: store.meta?.schemaVersion || 1,
        authConfigured: configuredAuth,
        authRequired: AUTH_REQUIRED || configuredAuth
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/security") {
      sendJson(res, 200, {
        authConfigured: configuredAuth,
        authRequired: AUTH_REQUIRED || configuredAuth,
        roles: Object.keys(roleTokens),
        rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
        defaultRateLimit: DEFAULT_RATE_LIMIT,
        aiRateLimit: AI_RATE_LIMIT
      });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, {
      error: error.publicMessage || "Something went wrong on the HR server."
    });
  }
});

server.listen(PORT, () => {
  console.log(`AI HR running at http://localhost:${PORT}`);
});

async function handleHrRequest(req, res, actor) {
  const body = await readJson(req);
  const prompt = cleanString(body.prompt, 10_000);
  const mode = String(body.mode || "generalist");
  const companyContext = cleanString(body.companyContext, 10_000);
  const desiredOutput = String(body.desiredOutput || "action_plan");
  const riskLevel = String(body.riskLevel || "normal");

  if (!prompt) {
    sendJson(res, 400, { error: "Tell AI HR what you need help with first." });
    return;
  }

  if (!GEMINI_API_KEY) {
    sendJson(res, 503, {
      error: "Missing GEMINI_API_KEY. Add it to .env or .env.local, then restart the server."
    });
    return;
  }

  const userPrompt = buildPrompt({ prompt, mode, companyContext, desiredOutput, riskLevel });
  const response = await callGemini(userPrompt);
  const store = await readStore();
  const record = createAuditRecord("assistant_output", {
    mode,
    desiredOutput,
    riskLevel,
    promptPreview: prompt.slice(0, 220)
  }, actor);
  store.audit.push(record);
  await writeStore(store);
  sendJson(res, 200, { result: response, model: MODEL, auditId: record.id });
}

async function handleRecordCreate(req, res, actor) {
  const body = await readJson(req);
  const type = String(body.type || "employee").trim();
  const name = cleanString(body.name, 180);
  const details = cleanString(body.details, 8_000);

  if (!allowedRecordTypes.has(type)) {
    sendJson(res, 400, { error: "Unsupported record type." });
    return;
  }

  if (!name) {
    sendJson(res, 400, { error: "Record name is required." });
    return;
  }

  const store = await readStore();
  const record = {
    id: randomUUID(),
    type,
    name,
    details,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.records.push(record);
  store.audit.push(createAuditRecord("record_created", { recordId: record.id, type, name }, actor));
  await writeStore(store);
  sendJson(res, 201, { record });
}

async function handleDecisionRequest(req, res, actor) {
  const body = await readJson(req);
  const decisionType = String(body.decisionType || "draft_document").trim();
  const subject = cleanString(body.subject, 220);
  const facts = cleanString(body.facts, 12_000);
  const proposedAction = cleanString(body.proposedAction, 4_000);

  if (!allowedDecisionTypes.has(decisionType)) {
    sendJson(res, 400, { error: "Unsupported decision type." });
    return;
  }

  if (!subject || !facts || !proposedAction) {
    sendJson(res, 400, { error: "Subject, facts, and proposed action are required." });
    return;
  }

  if (!GEMINI_API_KEY) {
    sendJson(res, 503, { error: "Missing GEMINI_API_KEY. Add it to .env or .env.local, then restart the server." });
    return;
  }

  const risk = classifyDecision({ decisionType, subject, facts, proposedAction });
  const decisionPrompt = buildDecisionPrompt({ decisionType, subject, facts, proposedAction, risk });
  const brief = await callGemini(decisionPrompt);
  const status = risk.requiresHumanApproval ? "needs_review" : "approved_for_action";

  const store = await readStore();
  const decision = {
    id: randomUUID(),
    decisionType,
    subject,
    facts,
    proposedAction,
    risk,
    brief,
    status,
    approvals: [],
    createdBy: actor.role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.decisions.push(decision);
  store.audit.push(createAuditRecord("decision_created", {
    decisionId: decision.id,
    decisionType,
    subject,
    status,
    riskLevel: risk.level,
    flags: risk.flags
  }, actor));
  await writeStore(store);
  sendJson(res, 201, { decision });
}

async function handleDecisionApproval(req, res, decisionId, actor) {
  const body = await readJson(req);
  const reviewer = cleanString(body.reviewer || actor.role, 180);
  const note = cleanString(body.note, 2_000);

  const store = await readStore();
  const decision = store.decisions.find((item) => item.id === decisionId);
  if (!decision) {
    sendJson(res, 404, { error: "Decision not found." });
    return;
  }

  decision.status = "approved_after_review";
  decision.updatedAt = new Date().toISOString();
  decision.approvals.push({
    reviewer,
    note,
    approvedAt: new Date().toISOString()
  });
  store.audit.push(createAuditRecord("decision_approved", { decisionId, reviewer }, actor));
  await writeStore(store);
  sendJson(res, 200, { decision });
}

function buildPrompt({ prompt, mode, companyContext, desiredOutput, riskLevel }) {
  return `
HR role: ${hrModes[mode] || hrModes.generalist}
Requested output format: ${desiredOutput}
Risk sensitivity: ${riskLevel}

Company context:
${companyContext || "No company context provided."}

User request:
${prompt}

Return:
1. Executive answer
2. Recommended actions
3. Draft artifact or template when useful
4. Risks, missing facts, and review checkpoints
5. Next best step
`;
}

function buildDecisionPrompt({ decisionType, subject, facts, proposedAction, risk }) {
  return `
You are preparing an HR decision brief.

Decision type: ${decisionType}
Subject: ${subject}
Proposed action: ${proposedAction}
Risk classification: ${risk.level}
Risk flags: ${risk.flags.join(", ") || "none"}
Human approval required: ${risk.requiresHumanApproval ? "yes" : "no"}

Facts:
${facts}

Create a structured decision brief with:
1. Recommended outcome
2. Reasoning based only on provided facts
3. Evidence checklist
4. Fairness and consistency checks
5. Legal/privacy/compliance risks
6. Communication draft
7. Implementation steps
8. What must be reviewed by a human before action
`;
}

function classifyDecision({ decisionType, subject, facts, proposedAction }) {
  const text = `${decisionType} ${subject} ${facts} ${proposedAction}`.toLowerCase();
  const flags = highImpactFlags.filter((flag) => text.includes(flag));
  const isAutomatable = automationAllowed.has(decisionType);
  const requiresHumanApproval = !isAutomatable || flags.length > 0;
  const level = flags.length >= 2 || text.includes("terminate") || text.includes("harassment")
    ? "critical"
    : flags.length === 1 || !isAutomatable
      ? "high"
      : "low";

  return {
    level,
    flags,
    canAutoAct: !requiresHumanApproval,
    requiresHumanApproval,
    rule: requiresHumanApproval
      ? "Decision brief only until accountable HR/legal/business review approves it."
      : "Low-risk HR operations task may be actioned after user confirmation."
  };
}

function createAuditRecord(action, detail, actor = { role: "system" }) {
  return {
    id: randomUUID(),
    action,
    actor: actor.role || "system",
    detail: sanitizeAuditDetail(detail),
    createdAt: new Date().toISOString()
  };
}

function summarizeStore(store) {
  const pendingApprovals = store.decisions.filter((item) => item.status === "needs_review").length;
  const critical = store.decisions.filter((item) => item.risk?.level === "critical").length;
  return {
    records: store.records.length,
    decisions: store.decisions.length,
    pendingApprovals,
    critical,
    auditEvents: store.audit.length,
    operatingModel: [
      "Low-risk HR operations can be drafted and queued for action.",
      "High-impact employment decisions become decision briefs with approval gates.",
      "All records, decisions, approvals, and AI outputs are written to the audit log."
    ]
  };
}

async function readStore() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(storePath)) {
    const initial = {
      meta: {
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      records: [],
      decisions: [],
      audit: [createAuditRecord("store_initialized", { version: 1 })]
    };
    await writeFile(storePath, JSON.stringify(initial, null, 2));
    return initial;
  }

  const raw = await readFile(storePath, "utf8");
  return migrateStore(JSON.parse(raw));
}

async function writeStore(store) {
  await mkdir(dataDir, { recursive: true });
  store.meta = {
    ...(store.meta || {}),
    schemaVersion: 2,
    updatedAt: new Date().toISOString()
  };

  if (existsSync(storePath)) {
    await copyFile(storePath, `${storePath}.bak`);
  }

  const tempPath = `${storePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2));
  await rename(tempPath, storePath);
}

async function callGemini(prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.35,
          topP: 0.9,
          maxOutputTokens: 4096
        }
      })
    });
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Gemini timed out. Try a smaller request or retry.");
      timeoutError.statusCode = 504;
      timeoutError.publicMessage = timeoutError.message;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `Gemini request failed with status ${response.status}`;
    throw new Error(message);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("\n")
    .trim();

  return text || "Gemini returned no text. Try adding more context to the HR request.";
}

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    const type = mimeTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    sendText(res, 404, "Not found");
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > REQUEST_BODY_LIMIT) {
        req.destroy();
        const error = new Error("Request body too large");
        error.statusCode = 413;
        error.publicMessage = "Request body too large.";
        reject(error);
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-AIHR-Token,X-Request-Id");
}

function enforceRateLimit(req, res, pathname) {
  if (!pathname.startsWith("/api/")) return true;

  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
  const isAiPath = pathname === "/api/hr" || pathname === "/api/decisions";
  const limit = isAiPath ? AI_RATE_LIMIT : DEFAULT_RATE_LIMIT;
  const key = `${ip}:${isAiPath ? "ai" : "api"}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  rateBuckets.set(key, bucket);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
  res.setHeader("X-RateLimit-Reset", new Date(bucket.resetAt).toISOString());

  if (bucket.count > limit) {
    sendJson(res, 429, { error: "Rate limit exceeded. Try again shortly." });
    return false;
  }

  return true;
}

function requireRole(req, res, roles) {
  const actor = authenticate(req);
  if (!actor.ok) {
    sendJson(res, actor.status, { error: actor.error });
    return null;
  }

  if (!roles.includes(actor.role)) {
    sendJson(res, 403, { error: "You do not have permission for this HR operation." });
    return null;
  }

  return actor;
}

function authenticate(req) {
  if (AUTH_REQUIRED && !configuredAuth) {
    return { ok: false, status: 503, error: "Auth is required but no role tokens are configured." };
  }

  if (!AUTH_REQUIRED && !configuredAuth) {
    return { ok: true, role: "admin", mode: "development" };
  }

  const token = extractToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Missing API token." };
  }

  for (const [role, expected] of Object.entries(roleTokens)) {
    if (expected && safeCompare(token, expected)) {
      return { ok: true, role, mode: "token" };
    }
  }

  return { ok: false, status: 401, error: "Invalid API token." };
}

function extractToken(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-aihr-token"] || "").trim();
}

function safeCompare(received, expected) {
  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

function migrateStore(store) {
  return {
    meta: {
      schemaVersion: 2,
      createdAt: store.meta?.createdAt || new Date().toISOString(),
      updatedAt: store.meta?.updatedAt || new Date().toISOString()
    },
    records: Array.isArray(store.records) ? store.records : [],
    decisions: Array.isArray(store.decisions) ? store.decisions : [],
    audit: Array.isArray(store.audit) ? store.audit : []
  };
}

function cleanString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeAuditDetail(detail) {
  if (Array.isArray(detail)) return detail.map(sanitizeAuditDetail);
  if (detail && typeof detail === "object") {
    return Object.fromEntries(Object.entries(detail).map(([key, value]) => [key, sanitizeAuditDetail(value)]));
  }
  if (typeof detail !== "string") return detail;
  return detail
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
