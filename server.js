import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import PDFDocument from "pdfkit";
import { createStorage } from "./storage.js";
import { createMailer } from "./mailer.js";
import { createAlerter } from "./alerter.js";
import { analyzeWorkforce, analyticsEvidence, parseDetails, validateAnalyticsOutput } from "./analytics.js";
import { knowledgeContext, retrieveKnowledge } from "./knowledge.js";
import { createIntegrationHub } from "./integrations.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const uiFontPath = join(root, "node_modules", "@fontsource-variable", "plus-jakarta-sans", "files", "plus-jakarta-sans-latin-wght-normal.woff2");

loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, ".env.local"));

const dataDir = process.env.AIHR_DATA_DIR || join(root, "data");
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const APP_VERSION = "0.11.0";
const demoDatasetPath = join(root, "datasets", "ibm-employee-attrition.csv");
const ORGANIZATION_ID = process.env.AIHR_ORGANIZATION_ID || "default";
const REQUEST_BODY_LIMIT = Number(process.env.AIHR_BODY_LIMIT_BYTES || 5_000_000);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45_000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.AIHR_RATE_LIMIT_WINDOW_MS || 60_000);
const DEFAULT_RATE_LIMIT = Number(process.env.AIHR_RATE_LIMIT || 120);
const AI_RATE_LIMIT = Number(process.env.AIHR_AI_RATE_LIMIT || 20);
const AUTH_REQUIRED = process.env.AIHR_AUTH_REQUIRED === "true";
const ALLOWED_ORIGIN = process.env.AIHR_ALLOWED_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
const SESSION_DAYS = Math.max(1, Number(process.env.AIHR_SESSION_DAYS || 7));
const INVITATION_HOURS = Math.max(1, Number(process.env.AIHR_INVITATION_HOURS || 72));
const MFA_CHALLENGE_MINUTES = 5;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOG_REQUESTS = process.env.AIHR_LOG_REQUESTS === "true" || (IS_PRODUCTION && process.env.AIHR_LOG_REQUESTS !== "false");
const GEMINI_MOCK_RESPONSE = process.env.AIHR_GEMINI_MOCK_RESPONSE || "";
const APP_BASE_URL = String(process.env.AIHR_APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const SESSION_COOKIE = "aihr_session";
const scrypt = promisify(scryptCallback);
const roleTokens = {
  admin: process.env.AIHR_ADMIN_TOKEN || "",
  hr_manager: process.env.AIHR_HR_MANAGER_TOKEN || "",
  recruiter: process.env.AIHR_RECRUITER_TOKEN || "",
  employee: process.env.AIHR_EMPLOYEE_TOKEN || "",
  auditor: process.env.AIHR_AUDITOR_TOKEN || ""
};
const configuredAuth = Object.values(roleTokens).some(Boolean);
const rateBuckets = new Map();
const runtimeMetrics = {
  startedAt: new Date().toISOString(),
  requests: 0,
  errors: 0,
  statuses: {}
};
const storage = createStorage({
  dataDir,
  databaseUrl: process.env.DATABASE_URL || "",
  organizationId: ORGANIZATION_ID,
  sslMode: process.env.DATABASE_SSL || "auto"
});
const mailer = createMailer(process.env);
const alerter = createAlerter(process.env);
const integrationHub = createIntegrationHub(process.env);

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

const allowedRecordTypes = new Set(["employee", "candidate", "job", "policy", "document", "case", "task"]);
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
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

const systemInstruction = `
You are AI HR, a focused people-operations partner. You help with onboarding,
documented performance analysis, recognition reviews, and contextual people analytics.

Rules:
- Be practical, structured, and manager-ready.
- Ask for missing facts when the user is making a high-risk people decision.
- Flag legal, privacy, discrimination, retaliation, termination, payroll,
  immigration, medical, safety, union, or protected-class risk.
- Never claim to be a lawyer. Recommend qualified HR/legal review for high-risk cases.
- Do not invent company policies. Separate assumptions from recommendations.
- For high-impact employment decisions, produce a decision brief and review path.
  Do not pretend a model can be the sole accountable decision maker.
- Produce usable artifacts: emails, checklists, rubrics, scripts, plans,
  scorecards, interview questions, policy drafts, investigation plans, and
  decision memos.
`;

const hrModes = {
  generalist: "Act as a broad HR generalist and triage the request across the employee lifecycle.",
  onboarding: "Act as an onboarding specialist focused on ramp plans, first-week workflows, and new-hire clarity.",
  performance: "Act as a performance partner focused on feedback, goals, coaching, reviews, and PIPs.",
  analytics: "Act as a people analytics partner focused on factual employee timelines, aggregate metrics, careful interpretation, and proportionate follow-up without individual behavior or attrition scores."
};

const server = createServer(async (req, res) => {
  applySecurityHeaders(res);
  const requestId = String(req.headers["x-request-id"] || randomUUID());
  const requestStartedAt = Date.now();
  res.setHeader("X-Request-Id", requestId);
  runtimeMetrics.requests += 1;
  res.on("finish", () => {
    runtimeMetrics.statuses[res.statusCode] = (runtimeMetrics.statuses[res.statusCode] || 0) + 1;
    if (res.statusCode >= 500) runtimeMetrics.errors += 1;
    if (LOG_REQUESTS) {
      console.log(JSON.stringify({
        type: "http_request",
        requestId,
        method: req.method,
        path: String(req.url || "/").split("?")[0],
        status: res.statusCode,
        durationMs: Date.now() - requestStartedAt
      }));
    }
  });

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!enforceRateLimit(req, res, url.pathname)) return;
    if (!validateRequestOrigin(req, res)) return;

    if (req.method === "GET" && url.pathname === "/api/health") {
      const [store, database] = await Promise.all([readStore(), storage.health()]);
      sendJson(res, 200, {
        ok: true,
        version: APP_VERSION,
        model: MODEL,
        hasGeminiKey: Boolean(GEMINI_API_KEY),
        records: store.records.length,
        decisions: store.decisions.length,
        pendingApprovals: store.decisions.filter((item) => item.status === "needs_review").length,
        database: database.engine
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ready") {
      const [store, database] = await Promise.all([readStore(), storage.health()]);
      const accountAuthConfigured = store.users.length > 0;
      const ready = Boolean(GEMINI_API_KEY) && database.ok && (!IS_PRODUCTION || (database.engine === "postgresql" && authenticationRequired(store)));
      sendJson(res, ready ? 200 : 503, {
        ready,
        storage: database.ok ? "ok" : "unavailable",
        database: database.engine,
        storeVersion: store.meta?.schemaVersion || 1,
        authConfigured: configuredAuth || accountAuthConfigured,
        authRequired: AUTH_REQUIRED || configuredAuth || accountAuthConfigured
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/security") {
      const store = await readStore();
      sendJson(res, 200, {
        authConfigured: configuredAuth || store.users.length > 0,
        authRequired: AUTH_REQUIRED || configuredAuth || store.users.length > 0,
        accountCount: store.users.filter((user) => !user.disabledAt).length,
        roles: Object.keys(roleTokens),
        rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
        defaultRateLimit: DEFAULT_RATE_LIMIT,
        aiRateLimit: AI_RATE_LIMIT
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/metrics") {
      const actor = await requireRole(req, res, ["admin", "auditor"]);
      if (!actor) return;
      await handleMetrics(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      await handleAuthMe(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/bootstrap") {
      await handleAuthBootstrap(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      await handleAuthLogin(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      await handleAuthLogout(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/accept-invitation") {
      await handleInvitationAccept(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "employee", "auditor"]);
      if (!actor) return;
      await handlePasswordChange(req, res, actor);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/mfa/verify") {
      await handleMfaVerify(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/mfa/setup") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "employee", "auditor"]);
      if (!actor) return;
      await handleMfaSetup(res, actor);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/mfa/confirm") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "employee", "auditor"]);
      if (!actor) return;
      await handleMfaConfirm(req, res, actor);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/mfa/disable") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "employee", "auditor"]);
      if (!actor) return;
      await handleMfaDisable(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/invitations") {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      await handleInvitationList(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/invitations") {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      await handleInvitationCreate(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      await handleUserList(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/users") {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      await handleUserCreate(req, res, actor);
      return;
    }

    const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (req.method === "PATCH" && userMatch) {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      await handleUserUpdate(req, res, userMatch[1], actor);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/risk/classify") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      const body = await readJson(req);
      sendJson(res, 200, {
        risk: classifyDecision({
          decisionType: cleanString(body.decisionType, 80),
          subject: cleanString(body.subject, 220),
          facts: cleanString(body.facts, 12_000),
          proposedAction: cleanString(body.proposedAction, 4_000)
        })
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/org") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, summarizeStore(await readStore()));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, buildDashboard(await readStore()));
      return;
    }

    const employeeProfileMatch = url.pathname.match(/^\/api\/employees\/([^/]+)\/profile$/);
    if (req.method === "GET" && employeeProfileMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      await handleEmployeeProfile(res, employeeProfileMatch[1]);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/onboarding") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, { packs: listOnboardingPacks(await readStore()) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/onboarding") {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleOnboardingCreate(req, res, actor);
      return;
    }

    const onboardingMatch = url.pathname.match(/^\/api\/onboarding\/([^/]+)$/);
    if (req.method === "PATCH" && onboardingMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleOnboardingUpdate(req, res, onboardingMatch[1], actor);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/demo/load") {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleDemoLoad(res, actor);
      return;
    }

    const onboardingReportMatch = url.pathname.match(/^\/api\/reports\/onboarding\/([^/]+)\.pdf$/);
    if (req.method === "GET" && onboardingReportMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      await handleOnboardingReport(res, onboardingReportMatch[1]);
      return;
    }

    const performanceReportMatch = url.pathname.match(/^\/api\/reports\/performance\/([^/]+)\.pdf$/);
    if (req.method === "GET" && performanceReportMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      await handlePerformanceReport(res, performanceReportMatch[1]);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/performance") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, listPerformanceReviews(await readStore(), url.searchParams));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/performance") {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handlePerformanceCreate(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/people-events") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, listEmployeeEvents(await readStore(), url.searchParams));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/people-events") {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleEmployeeEventCreate(req, res, actor);
      return;
    }

    const peopleEventMatch = url.pathname.match(/^\/api\/people-events\/([^/]+)$/);
    if (req.method === "PATCH" && peopleEventMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleEmployeeEventUpdate(req, res, peopleEventMatch[1], actor);
      return;
    }

    const performanceMatch = url.pathname.match(/^\/api\/performance\/([^/]+)$/);
    if (req.method === "PATCH" && performanceMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handlePerformanceUpdate(req, res, performanceMatch[1], actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/analytics/workforce") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      const filters = Object.fromEntries([
        ["department", cleanString(url.searchParams.get("department"), 120)],
        ["job role", cleanString(url.searchParams.get("jobRole"), 120)],
        ["job level", cleanString(url.searchParams.get("jobLevel"), 40)],
        ["overtime", cleanString(url.searchParams.get("overtime"), 20)]
      ].filter(([, value]) => value));
      sendJson(res, 200, analyzeWorkforce((await readStore()).records, filters));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/knowledge") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "employee", "auditor"]);
      if (!actor) return;
      const query = cleanString(url.searchParams.get("q"), 1_000);
      sendJson(res, 200, { sources: retrieveKnowledge((await readStore()).records, query, 20) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/knowledge") {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleKnowledgeCreate(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/readiness") {
      const actor = await requireRole(req, res, ["admin", "auditor"]);
      if (!actor) return;
      await handleReadiness(res);
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/readiness") {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      await handleReadinessUpdate(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/integrations") {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      sendJson(res, 200, integrationStatus());
      return;
    }

    const integrationEventMatch = url.pathname.match(/^\/api\/integrations\/([^/]+)\/events$/);
    if (req.method === "POST" && integrationEventMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleIntegrationEvent(req, res, integrationEventMatch[1], actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workflows/scheduled") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, { workflows: (await readStore()).scheduledWorkflows.slice().reverse() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/workflows/scheduled") {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleScheduledWorkflowCreate(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/records") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, listRecords(await readStore(), url.searchParams));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/records") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter"]);
      if (!actor) return;
      await handleRecordCreate(req, res, actor);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/records/import") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter"]);
      if (!actor) return;
      await handleRecordImport(req, res, actor);
      return;
    }

    const recordMatch = url.pathname.match(/^\/api\/records\/([^/]+)$/);
    if (req.method === "GET" && recordMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      await handleRecordGet(res, recordMatch[1]);
      return;
    }

    if (req.method === "PATCH" && recordMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter"]);
      if (!actor) return;
      await handleRecordUpdate(req, res, recordMatch[1], actor);
      return;
    }

    if (req.method === "DELETE" && recordMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleRecordDelete(res, recordMatch[1], actor);
      return;
    }

    const restoreMatch = url.pathname.match(/^\/api\/records\/([^/]+)\/restore$/);
    if (req.method === "POST" && restoreMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleRecordRestore(res, restoreMatch[1], actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/privacy/export") {
      const actor = await requireRole(req, res, ["admin", "auditor"]);
      if (!actor) return;
      await handlePrivacyExport(res, actor);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/privacy/purge") {
      const actor = await requireRole(req, res, ["admin"]);
      if (!actor) return;
      await handlePrivacyPurge(req, res, actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/decisions") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, { decisions: (await readStore()).decisions });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/decisions") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter"]);
      if (!actor) return;
      await handleDecisionRequest(req, res, actor);
      return;
    }

    const approvalMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)\/approve$/);
    if (req.method === "POST" && approvalMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleDecisionApproval(req, res, approvalMatch[1], actor);
      return;
    }

    const reviewMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)\/review$/);
    if (req.method === "POST" && reviewMatch) {
      const actor = await requireRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return;
      await handleDecisionReview(req, res, reviewMatch[1], actor);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/audit") {
      const actor = await requireRole(req, res, ["admin", "auditor"]);
      if (!actor) return;
      sendJson(res, 200, listAudit(await readStore(), url.searchParams));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/hr") {
      const actor = await requireRole(req, res, ["admin", "hr_manager", "recruiter", "employee"]);
      if (!actor) return;
      await handleHrRequest(req, res, actor);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    const status = error.statusCode || 500;
    if (status >= 500) {
      void alerter.send({
        type: "server_error",
        requestId,
        method: req.method,
        path: String(req.url || "/").split("?")[0],
        status,
        message: String(error.message || "Unknown server error").slice(0, 500)
      });
    }
    sendJson(res, status, {
      error: error.publicMessage || "Something went wrong on the HR server."
    });
  }
});

await storage.initialize();
if (process.env.AIHR_IMPORT_JSON === "true") {
  const imported = await storage.importJsonIfEmpty();
  if (imported.imported) console.log(`Imported ${imported.records} records from JSON into PostgreSQL.`);
}
const workflowTimer = setInterval(() => void processScheduledWorkflows().catch(console.error), 30_000);
workflowTimer.unref();

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`AI HR is already running at http://localhost:${PORT}. Open that address instead of starting another copy.`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`AI HR running at http://localhost:${PORT}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  clearInterval(workflowTimer);
  server.close(async () => {
    await storage.close();
    process.exit(0);
  });
}

async function handleAuthMe(req, res) {
  const store = await readStore();
  const actor = await authenticate(req, store);
  if (!actor.ok) {
    sendJson(res, 200, {
      authenticated: false,
      authRequired: authenticationRequired(store),
      canBootstrap: store.users.length === 0
    });
    return;
  }
  sendJson(res, 200, {
    authenticated: true,
    authRequired: authenticationRequired(store),
    user: publicActor(actor),
    organization: {
      id: ORGANIZATION_ID,
      name: store.settings.organizationName
    }
  });
}

async function handleAuthBootstrap(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const acceptTerms = body.acceptTerms === true;
  const organizationName = cleanString(body.organizationName || "AI HR Workspace", 120);
  const passwordError = validatePassword(password);
  if (!email || passwordError || !acceptTerms) {
    sendJson(res, 400, { error: passwordError || (!acceptTerms ? "Accept the privacy, terms, and human-review requirements." : "Enter a valid email address.") });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = createUser({ email, role: "admin", passwordHash });
  user.termsAcceptedAt = new Date().toISOString();
  const session = createSession(user.id);
  let created = false;
  await storage.mutate((store) => {
    if (store.users.length) return;
    store.settings.organizationName = organizationName;
    store.users.push(user);
    store.sessions.push(session.stored);
    store.audit.push(createAuditRecord("workspace_bootstrapped", { userId: user.id, email }, user));
    created = true;
  });
  if (!created) {
    sendJson(res, 409, { error: "This workspace already has an administrator. Sign in instead." });
    return;
  }
  setSessionCookie(res, session.token);
  sendJson(res, 201, { authenticated: true, user: publicUser(user) });
}

async function handleAuthLogin(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const store = await readStore();
  const user = store.users.find((item) => item.email === email && !item.disabledAt);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    sendJson(res, 401, { error: "Invalid email or password." });
    return;
  }
  if (user.mfaSecret) {
    const challenge = createSession(user.id);
    challenge.stored.mfaChallenge = true;
    challenge.stored.expiresAt = new Date(Date.now() + MFA_CHALLENGE_MINUTES * 60_000).toISOString();
    await storage.mutate((nextStore) => {
      nextStore.sessions = nextStore.sessions.filter((item) => new Date(item.expiresAt).getTime() > Date.now());
      nextStore.sessions.push(challenge.stored);
      nextStore.audit.push(createAuditRecord("mfa_challenge_created", { userId: user.id }, user));
    });
    sendJson(res, 202, { mfaRequired: true, challengeToken: challenge.token });
    return;
  }
  const session = createSession(user.id);
  await storage.mutate((nextStore) => {
    nextStore.sessions = nextStore.sessions.filter((item) => new Date(item.expiresAt).getTime() > Date.now());
    nextStore.sessions.push(session.stored);
    nextStore.audit.push(createAuditRecord("user_logged_in", { userId: user.id }, user));
  });
  setSessionCookie(res, session.token);
  sendJson(res, 200, { authenticated: true, user: publicUser(user) });
}

async function handleAuthLogout(req, res) {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (token) {
    const tokenHash = hashToken(token);
    await storage.mutate((store) => {
      const session = store.sessions.find((item) => item.tokenHash === tokenHash);
      store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
      if (session) store.audit.push(createAuditRecord("user_logged_out", { userId: session.userId }));
    });
  }
  clearSessionCookie(res);
  sendJson(res, 200, { authenticated: false });
}

async function handleInvitationList(res) {
  const store = await readStore();
  const invitations = store.invitations.map(({ tokenHash, ...invitation }) => ({
    ...invitation,
    status: invitation.acceptedAt
      ? "accepted"
      : new Date(invitation.expiresAt).getTime() <= Date.now()
        ? "expired"
        : "pending"
  }));
  sendJson(res, 200, { invitations: invitations.slice().reverse() });
}

async function handleInvitationCreate(req, res, actor) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const role = String(body.role || "employee");
  if (!email || !Object.hasOwn(roleTokens, role)) {
    sendJson(res, 400, { error: "Enter a valid email and role." });
    return;
  }
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const invitation = {
    id: randomUUID(),
    email,
    role,
    tokenHash: hashToken(token),
    invitedBy: actor.email || actor.role,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITATION_HOURS * 3_600_000).toISOString(),
    acceptedAt: null
  };
  let conflict = false;
  await storage.mutate((store) => {
    conflict = store.users.some((user) => user.email === email && !user.disabledAt);
    if (conflict) return;
    store.invitations = store.invitations.filter((item) => item.email !== email || item.acceptedAt);
    store.invitations.push(invitation);
    store.audit.push(createAuditRecord("user_invited", { invitationId: invitation.id, email, role }, actor));
  });
  if (conflict) {
    sendJson(res, 409, { error: "An active user with that email already exists." });
    return;
  }
  const path = `/?invitation=${encodeURIComponent(token)}`;
  const delivery = await mailer.sendInvitation({
    email,
    role,
    invitationUrl: `${APP_BASE_URL}${path}`,
    expiresAt: invitation.expiresAt
  });
  await storage.mutate((store) => {
    const storedInvitation = store.invitations.find((item) => item.id === invitation.id);
    if (storedInvitation) storedInvitation.delivery = { status: delivery.status, attemptedAt: new Date().toISOString() };
    store.audit.push(createAuditRecord("invitation_delivery", { invitationId: invitation.id, status: delivery.status }, actor));
  });
  sendJson(res, 201, {
    invitation: {
      id: invitation.id,
      email,
      role,
      expiresAt: invitation.expiresAt,
      path
    },
    delivery: { status: delivery.status }
  });
}

async function handleInvitationAccept(req, res) {
  const body = await readJson(req);
  const token = String(body.token || "");
  const password = String(body.password || "");
  const acceptTerms = body.acceptTerms === true;
  const passwordError = validatePassword(password);
  if (!token || passwordError || !acceptTerms) {
    sendJson(res, 400, { error: passwordError || (!acceptTerms ? "Accept the privacy, terms, and human-review requirements." : "Invitation token is required.") });
    return;
  }
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);
  let user;
  let session;
  let errorMessage = "Invitation is invalid or expired.";
  await storage.mutate((store) => {
    const invitation = store.invitations.find((item) => item.tokenHash === tokenHash);
    if (!invitation || invitation.acceptedAt || new Date(invitation.expiresAt).getTime() <= Date.now()) return;
    if (store.users.some((item) => item.email === invitation.email)) {
      errorMessage = "An account with this email already exists.";
      return;
    }
    user = createUser({ email: invitation.email, role: invitation.role, passwordHash });
    user.termsAcceptedAt = new Date().toISOString();
    session = createSession(user.id);
    invitation.acceptedAt = new Date().toISOString();
    store.users.push(user);
    store.sessions.push(session.stored);
    store.audit.push(createAuditRecord("invitation_accepted", { invitationId: invitation.id, userId: user.id }, user));
  });
  if (!user) {
    sendJson(res, 400, { error: errorMessage });
    return;
  }
  setSessionCookie(res, session.token);
  sendJson(res, 201, { authenticated: true, user: publicUser(user) });
}

async function handlePasswordChange(req, res, actor) {
  if (!actor.userId || actor.mode !== "session") {
    sendJson(res, 400, { error: "Password changes require a signed-in user account." });
    return;
  }
  const body = await readJson(req);
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const passwordError = validatePassword(newPassword);
  const store = await readStore();
  const user = store.users.find((item) => item.id === actor.userId && !item.disabledAt);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    sendJson(res, 401, { error: "Current password is incorrect." });
    return;
  }
  if (passwordError) {
    sendJson(res, 400, { error: passwordError });
    return;
  }
  const passwordHash = await hashPassword(newPassword);
  const session = createSession(user.id);
  await storage.mutate((nextStore) => {
    const nextUser = nextStore.users.find((item) => item.id === user.id);
    nextUser.passwordHash = passwordHash;
    nextUser.updatedAt = new Date().toISOString();
    nextStore.sessions = nextStore.sessions.filter((item) => item.userId !== user.id);
    nextStore.sessions.push(session.stored);
    nextStore.audit.push(createAuditRecord("password_changed", { userId: user.id }, user));
  });
  setSessionCookie(res, session.token);
  sendJson(res, 200, { changed: true });
}

async function handleMfaSetup(res, actor) {
  if (!actor.userId || actor.mode !== "session") {
    sendJson(res, 400, { error: "MFA setup requires a signed-in user account." });
    return;
  }
  const secret = encodeBase32(randomBytes(20));
  let user;
  await storage.mutate((store) => {
    user = store.users.find((item) => item.id === actor.userId && !item.disabledAt);
    if (!user) return;
    user.mfaPendingSecret = secret;
    user.mfaPendingExpiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    store.audit.push(createAuditRecord("mfa_setup_started", { userId: user.id }, actor));
  });
  if (!user) {
    sendJson(res, 404, { error: "User not found." });
    return;
  }
  const issuer = "AI HR";
  const label = `${issuer}:${user.email}`;
  const otpauthUri = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  sendJson(res, 200, { secret, otpauthUri, expiresInSeconds: 900 });
}

async function handleMfaConfirm(req, res, actor) {
  const body = await readJson(req);
  const code = cleanString(body.code, 12);
  let confirmed = false;
  await storage.mutate((store) => {
    const user = store.users.find((item) => item.id === actor.userId && !item.disabledAt);
    if (!user?.mfaPendingSecret || new Date(user.mfaPendingExpiresAt).getTime() <= Date.now()) return;
    if (!verifyTotp(user.mfaPendingSecret, code)) return;
    user.mfaSecret = user.mfaPendingSecret;
    user.mfaEnabledAt = new Date().toISOString();
    delete user.mfaPendingSecret;
    delete user.mfaPendingExpiresAt;
    store.audit.push(createAuditRecord("mfa_enabled", { userId: user.id }, actor));
    confirmed = true;
  });
  if (!confirmed) {
    sendJson(res, 400, { error: "The authenticator code is invalid or setup expired." });
    return;
  }
  sendJson(res, 200, { enabled: true });
}

async function handleMfaVerify(req, res) {
  const body = await readJson(req);
  const challengeToken = String(body.challengeToken || "");
  const code = cleanString(body.code, 12);
  const challengeHash = hashToken(challengeToken);
  const store = await readStore();
  const challenge = store.sessions.find((item) => item.mfaChallenge && item.tokenHash === challengeHash && new Date(item.expiresAt).getTime() > Date.now());
  const user = challenge && store.users.find((item) => item.id === challenge.userId && !item.disabledAt);
  if (!user?.mfaSecret || !verifyTotp(user.mfaSecret, code)) {
    sendJson(res, 401, { error: "Invalid or expired MFA challenge." });
    return;
  }
  const session = createSession(user.id);
  await storage.mutate((nextStore) => {
    nextStore.sessions = nextStore.sessions.filter((item) => item.tokenHash !== challengeHash && new Date(item.expiresAt).getTime() > Date.now());
    nextStore.sessions.push(session.stored);
    nextStore.audit.push(createAuditRecord("mfa_verified", { userId: user.id }, user));
  });
  setSessionCookie(res, session.token);
  sendJson(res, 200, { authenticated: true, user: publicUser(user) });
}

async function handleMfaDisable(req, res, actor) {
  if (!actor.userId || actor.mode !== "session") {
    sendJson(res, 400, { error: "MFA changes require a signed-in user account." });
    return;
  }
  const body = await readJson(req);
  const password = String(body.password || "");
  const code = cleanString(body.code, 12);
  const store = await readStore();
  const user = store.users.find((item) => item.id === actor.userId && !item.disabledAt);
  if (!user?.mfaSecret || !(await verifyPassword(password, user.passwordHash)) || !verifyTotp(user.mfaSecret, code)) {
    sendJson(res, 401, { error: "Password or authenticator code is incorrect." });
    return;
  }
  await storage.mutate((nextStore) => {
    const nextUser = nextStore.users.find((item) => item.id === user.id);
    delete nextUser.mfaSecret;
    delete nextUser.mfaEnabledAt;
    nextStore.audit.push(createAuditRecord("mfa_disabled", { userId: user.id }, actor));
  });
  sendJson(res, 200, { enabled: false });
}

async function handleUserList(res) {
  const store = await readStore();
  sendJson(res, 200, { users: store.users.map(publicUser) });
}

async function handleUserCreate(req, res, actor) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const role = String(body.role || "employee");
  const password = String(body.password || "");
  const passwordError = validatePassword(password);
  if (!email || passwordError || !Object.hasOwn(roleTokens, role)) {
    sendJson(res, 400, { error: passwordError || "Enter a valid email and role." });
    return;
  }
  const user = createUser({ email, role, passwordHash: await hashPassword(password) });
  let duplicate = false;
  await storage.mutate((store) => {
    duplicate = store.users.some((item) => item.email === email);
    if (duplicate) return;
    store.users.push(user);
    store.audit.push(createAuditRecord("user_created", { userId: user.id, email, role }, actor));
  });
  if (duplicate) {
    sendJson(res, 409, { error: "A user with that email already exists." });
    return;
  }
  sendJson(res, 201, { user: publicUser(user) });
}

async function handleUserUpdate(req, res, userId, actor) {
  const body = await readJson(req);
  const role = body.role === undefined ? undefined : String(body.role);
  const disabled = body.disabled === undefined ? undefined : Boolean(body.disabled);
  const mfaDisabled = body.mfaDisabled === true;
  const password = body.password === undefined ? undefined : String(body.password);
  const passwordError = password === undefined ? "" : validatePassword(password);
  if ((role !== undefined && !Object.hasOwn(roleTokens, role)) || passwordError) {
    sendJson(res, 400, { error: passwordError || "Enter a valid role." });
    return;
  }
  if (userId === actor.userId && (disabled === true || (role !== undefined && role !== "admin"))) {
    sendJson(res, 400, { error: "You cannot disable or demote your own administrator account." });
    return;
  }
  const passwordHash = password === undefined ? undefined : await hashPassword(password);
  let user;
  await storage.mutate((store) => {
    user = store.users.find((item) => item.id === userId);
    if (!user) return;
    if (role !== undefined) user.role = role;
    if (disabled !== undefined) user.disabledAt = disabled ? new Date().toISOString() : null;
    if (passwordHash !== undefined) user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    if (mfaDisabled) {
      delete user.mfaSecret;
      delete user.mfaEnabledAt;
      delete user.mfaPendingSecret;
      delete user.mfaPendingExpiresAt;
    }
    if (disabled === true || passwordHash !== undefined || mfaDisabled) {
      store.sessions = store.sessions.filter((session) => session.userId !== userId);
    }
    store.audit.push(createAuditRecord("user_updated", {
      userId,
      role: user.role,
      disabled: Boolean(user.disabledAt),
      passwordReset: passwordHash !== undefined,
      mfaReset: mfaDisabled
    }, actor));
  });
  if (!user) {
    sendJson(res, 404, { error: "User not found." });
    return;
  }
  sendJson(res, 200, { user: publicUser(user) });
}

function createUser({ email, role, passwordHash }) {
  const now = new Date().toISOString();
  return { id: randomUUID(), email, role, passwordHash, createdAt: now, updatedAt: now, disabledAt: null };
}

function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const createdAt = new Date();
  return {
    token,
    stored: {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + SESSION_DAYS * 86_400_000).toISOString()
    }
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${Buffer.from(derived).toString("base64url")}`;
}

async function verifyPassword(password, stored) {
  try {
    const [, saltValue, hashValue] = String(stored || "").split(":");
    const expected = Buffer.from(hashValue, "base64url");
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function validatePassword(password) {
  if (password.length < 12) return "Password must contain at least 12 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must include uppercase, lowercase, and numeric characters.";
  }
  return "";
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function encodeBase32(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = String(value || "").replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

function verifyTotp(secret, code) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  return [-1, 0, 1].some((windowOffset) => safeCompare(String(code), generateTotp(secret, Date.now() + windowOffset * 30_000)));
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    mfaEnabled: Boolean(user.mfaSecret),
    termsAcceptedAt: user.termsAcceptedAt || null,
    createdAt: user.createdAt,
    disabledAt: user.disabledAt || null
  };
}

function publicActor(actor) {
  return { id: actor.userId || null, email: actor.email || null, role: actor.role, mode: actor.mode };
}

function buildDashboard(store) {
  const employees = store.records.filter((record) => record.type === "employee" && !record.deletedAt);
  const demoRows = employees.filter((record) => Object.keys(record.attributes || {}).some((key) => key.toLowerCase() === "attrition")).length;
  return {
    summary: {
      employees: employees.length,
      openReviews: store.performanceReviews.filter((review) => review.status !== "closed").length,
      pendingOnboarding: store.onboardingPacks.filter((pack) => pack.status === "pending").length,
      complaintsForReview: store.employeeEvents.filter((event) => event.type === "complaint" && event.status === "open").length
    },
    dataset: {
      label: demoRows ? "IBM fictional employee benchmark" : employees.length ? "Company employee records" : "No employee dataset",
      employeeCount: employees.length,
      demoRows,
      isDemo: demoRows > 0
    },
    recentActivity: store.audit.slice(-10).reverse().map((event) => ({
      id: event.id,
      action: event.action,
      actor: event.actor,
      createdAt: event.createdAt
    }))
  };
}

async function handleEmployeeProfile(res, employeeId) {
  const store = await readStore();
  const employee = store.records.find((record) => record.id === employeeId && record.type === "employee" && !record.deletedAt);
  if (!employee) {
    sendJson(res, 404, { error: "Employee not found." });
    return;
  }
  const sameEmployee = (name) => String(name || "").trim().toLowerCase() === employee.name.trim().toLowerCase();
  const reviews = store.performanceReviews.filter((review) => review.employeeRecordId === employee.id || sameEmployee(review.employeeName));
  const events = store.employeeEvents.filter((event) => event.employeeRecordId
    ? event.employeeRecordId === employee.id
    : sameEmployee(event.employeeName));
  const decisions = store.decisions.filter((decision) => decision.subject.toLowerCase().includes(employee.name.toLowerCase()));
  const audit = store.audit.filter((event) => {
    const detail = JSON.stringify(event.detail || {}).toLowerCase();
    return detail.includes(employee.id.toLowerCase()) || detail.includes(employee.name.toLowerCase());
  }).slice(-20).reverse();
  const timeline = [
    ...reviews.map((review) => ({ id: review.id, type: "performance", title: review.reviewPeriod, status: review.status, createdAt: review.updatedAt })),
    ...events.map((event) => ({ id: event.id, type: event.type, title: event.summary, status: event.status, createdAt: event.occurredAt })),
    ...decisions.map((decision) => ({ id: decision.id, type: "decision", title: decision.proposedAction, status: decision.status, createdAt: decision.updatedAt }))
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  sendJson(res, 200, { employee, reviews, events, decisions, audit, timeline });
}

function listOnboardingPacks(store) {
  return store.onboardingPacks.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function handleOnboardingCreate(req, res, actor) {
  const body = await readJson(req);
  const employeeName = cleanString(body.employeeName, 180);
  const role = cleanString(body.role, 180);
  const team = cleanString(body.team, 500);
  const setup = cleanString(body.setup, 500);
  const responsibilities = cleanString(body.responsibilities, 6_000);
  const dailyNeeds = cleanString(body.dailyNeeds, 6_000);
  if (!employeeName || !role || !responsibilities) {
    sendJson(res, 400, { error: "New hire, job title, and responsibilities are required." });
    return;
  }
  if (!GEMINI_API_KEY) {
    sendJson(res, 503, { error: "Missing GEMINI_API_KEY. Add it and restart the server." });
    return;
  }
  const store = await readStore();
  const sources = retrieveKnowledge(store.records, `${role} ${team} onboarding office access`, 5);
  const prompt = `Create a practical onboarding pack.
New hire: ${employeeName}
Job title: ${role}
Department and manager: ${team || "Not provided"}
Start date and setup: ${setup || "Not provided"}
Responsibilities: ${responsibilities}
Daily office needs: ${dailyNeeds || "Not provided"}

Include a clear job description, responsibilities and success expectations, first-day checklist, first-week schedule, 30-day ramp plan, tools and access checklist, key contacts, recurring meetings, working hours, and practical office guidance. Mark missing company-specific details for HR to complete. Do not invent policies.`;
  const content = await callGemini(buildPrompt({
    prompt,
    mode: "onboarding",
    companyContext: team,
    desiredOutput: "checklist",
    riskLevel: "normal",
    evidence: "No workforce analytics are required for this onboarding pack.",
    policyContext: knowledgeContext(sources)
  }));
  const now = new Date().toISOString();
  const pack = {
    id: randomUUID(), employeeName, role, team, setup, responsibilities, dailyNeeds,
    content, status: "pending", createdAt: now, updatedAt: now, createdBy: actor.email || actor.role
  };
  await storage.mutate((nextStore) => {
    nextStore.onboardingPacks.push(pack);
    nextStore.audit.push(createAuditRecord("onboarding_pack_created", { packId: pack.id, employeeName, role }, actor));
  });
  sendJson(res, 201, { pack, sources: sources.map((source) => ({ id: source.id, title: source.title })) });
}

async function handleOnboardingUpdate(req, res, packId, actor) {
  const body = await readJson(req);
  const status = ["pending", "completed"].includes(body.status) ? body.status : undefined;
  if (!status) {
    sendJson(res, 400, { error: "Onboarding status must be pending or completed." });
    return;
  }
  let pack;
  await storage.mutate((store) => {
    pack = store.onboardingPacks.find((item) => item.id === packId);
    if (!pack) return;
    pack.status = status;
    pack.updatedAt = new Date().toISOString();
    pack.updatedBy = actor.email || actor.role;
    store.audit.push(createAuditRecord("onboarding_pack_updated", { packId, status }, actor));
  });
  if (!pack) {
    sendJson(res, 404, { error: "Onboarding pack not found." });
    return;
  }
  sendJson(res, 200, { pack });
}

async function handleDemoLoad(res, actor) {
  const store = await readStore();
  const existingDemoRows = store.records.filter((record) => record.type === "employee" && !record.deletedAt && Object.keys(record.attributes || {}).includes("attrition")).length;
  if (existingDemoRows >= 1_000) {
    sendJson(res, 200, { importedCount: 0, duplicateCount: existingDemoRows, alreadyLoaded: true, label: "IBM fictional employee benchmark" });
    return;
  }
  const rows = parseCsvDocument(await readFile(demoDatasetPath));
  const now = new Date().toISOString();
  const candidates = rows.map((row, index) => {
    const normalized = normalizeImportRecord({ ...row, name: `Demo Employee ${row.EmployeeNumber || index + 1}` });
    return {
      id: randomUUID(), type: "employee", name: normalized.name, details: normalized.details,
      attributes: normalized.attributes, source: "IBM fictional employee benchmark",
      createdBy: actor.role, createdAt: now, updatedAt: now
    };
  });
  let stored = [];
  let duplicateCount = 0;
  await storage.mutate((nextStore) => {
    const fingerprints = new Set(nextStore.records.filter((record) => !record.deletedAt).map(recordFingerprint));
    stored = candidates.filter((record) => {
      const fingerprint = recordFingerprint(record);
      if (fingerprints.has(fingerprint)) {
        duplicateCount += 1;
        return false;
      }
      fingerprints.add(fingerprint);
      return true;
    });
    nextStore.records.push(...stored);
    nextStore.audit.push(createAuditRecord("demo_dataset_loaded", { imported: stored.length, duplicates: duplicateCount }, actor));
  });
  sendJson(res, stored.length ? 201 : 200, { importedCount: stored.length, duplicateCount, alreadyLoaded: false, label: "IBM fictional employee benchmark" });
}

async function handleOnboardingReport(res, packId) {
  const pack = (await readStore()).onboardingPacks.find((item) => item.id === packId);
  if (!pack) {
    sendJson(res, 404, { error: "Onboarding pack not found." });
    return;
  }
  renderPdf(res, `Onboarding Pack: ${pack.employeeName}`, [
    ["Role", pack.role], ["Team and manager", pack.team || "Not provided"],
    ["Start and work setup", pack.setup || "Not provided"], ["Onboarding plan", pack.content]
  ], `onboarding-${safeFilename(pack.employeeName)}.pdf`);
}

async function handlePerformanceReport(res, reviewId) {
  const review = (await readStore()).performanceReviews.find((item) => item.id === reviewId);
  if (!review) {
    sendJson(res, 404, { error: "Performance review not found." });
    return;
  }
  renderPdf(res, `Performance Review: ${review.employeeName}`, [
    ["Review period", review.reviewPeriod], ["Outcome", review.outcome], ["Status", review.status],
    ["Goals and expectations", review.goals || "Not recorded"], ["Wins and impact", review.wins || "Not recorded"],
    ["Concerns", review.concerns || "Not recorded"], ["Evidence", review.evidence],
    ["Support provided", review.supportProvided || "Not recorded"],
    ["Next review", review.nextReviewAt ? new Date(review.nextReviewAt).toLocaleDateString("en-US") : "Not scheduled"]
  ], `performance-${safeFilename(review.employeeName)}.pdf`);
}

function renderPdf(res, title, sections, filename) {
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store"
  });
  const document = new PDFDocument({ size: "A4", margin: 54, info: { Title: title, Author: "AI HR" } });
  document.pipe(res);
  document.font("Helvetica-Bold").fontSize(20).fillColor("#1c1b18").text(title);
  document.moveDown(0.4).font("Helvetica").fontSize(9).fillColor("#6f6a61").text(`Generated ${new Date().toLocaleString("en-US")}`);
  document.moveDown(1.2);
  for (const [heading, value] of sections) {
    document.font("Helvetica-Bold").fontSize(11).fillColor("#354231").text(heading);
    document.moveDown(0.25).font("Helvetica").fontSize(10).fillColor("#1c1b18").text(String(value || "Not recorded"), { lineGap: 3 });
    document.moveDown(0.8);
  }
  document.moveDown().font("Helvetica-Oblique").fontSize(8).fillColor("#6f6a61")
    .text("AI-generated material must be reviewed by an accountable HR professional before employment action.");
  document.end();
}

function safeFilename(value) {
  return String(value || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

function parseCsvDocument(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  const [headers = [], ...dataRows] = rows;
  return dataRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index] || ""])));
}

const performanceStatuses = new Set(["on_track", "support_needed", "formal_review", "recognition_review", "closed"]);
const performanceOutcomes = new Set(["exceeding", "meeting", "partially_meeting", "not_meeting", "not_assessed"]);

function listPerformanceReviews(store, searchParams) {
  const status = cleanString(searchParams.get("status"), 40);
  const reviews = store.performanceReviews
    .filter((review) => !status || review.status === status)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    reviews,
    summary: {
      total: store.performanceReviews.length,
      onTrack: store.performanceReviews.filter((review) => review.status === "on_track").length,
      supportNeeded: store.performanceReviews.filter((review) => review.status === "support_needed").length,
      formalReview: store.performanceReviews.filter((review) => review.status === "formal_review").length,
      recognitionReview: store.performanceReviews.filter((review) => review.status === "recognition_review").length
    },
    boundary: "Statuses organize human follow-up. They are not termination recommendations or individual risk scores."
  };
}

async function handlePerformanceCreate(req, res, actor) {
  const body = await readJson(req);
  const employeeRecordId = cleanString(body.employeeRecordId, 100);
  const employeeName = cleanString(body.employeeName, 180);
  const reviewPeriod = cleanString(body.reviewPeriod, 120);
  const outcome = performanceOutcomes.has(body.outcome) ? body.outcome : "not_assessed";
  const status = performanceStatuses.has(body.status) ? body.status : "on_track";
  const goals = cleanString(body.goals, 4_000);
  const wins = cleanString(body.wins, 8_000);
  const concerns = cleanString(body.concerns, 8_000);
  const evidence = cleanString(body.evidence, 8_000);
  const supportProvided = cleanString(body.supportProvided, 4_000);
  const nextReviewAt = body.nextReviewAt ? new Date(body.nextReviewAt) : null;
  const store = await readStore();
  const employee = employeeRecordId && store.records.find((record) => record.id === employeeRecordId && record.type === "employee" && !record.deletedAt);
  if ((!employee && !employeeName) || !reviewPeriod || !evidence || (nextReviewAt && !Number.isFinite(nextReviewAt.getTime()))) {
    sendJson(res, 400, { error: "Employee, review period, documented evidence, and a valid next-review date are required." });
    return;
  }
  const now = new Date().toISOString();
  const review = {
    id: randomUUID(),
    employeeRecordId: employee?.id || null,
    employeeName: employee?.name || employeeName,
    reviewPeriod,
    outcome,
    status,
    goals,
    wins,
    concerns,
    evidence,
    supportProvided,
    nextReviewAt: nextReviewAt?.toISOString() || null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.email || actor.role
  };
  await storage.mutate((nextStore) => {
    nextStore.performanceReviews.push(review);
    nextStore.audit.push(createAuditRecord("performance_review_created", { reviewId: review.id, employeeRecordId: review.employeeRecordId, outcome, status }, actor));
  });
  sendJson(res, 201, { review });
}

async function handlePerformanceUpdate(req, res, reviewId, actor) {
  const body = await readJson(req);
  const status = performanceStatuses.has(body.status) ? body.status : undefined;
  const outcome = performanceOutcomes.has(body.outcome) ? body.outcome : undefined;
  let review;
  await storage.mutate((store) => {
    review = store.performanceReviews.find((item) => item.id === reviewId);
    if (!review) return;
    if (status) review.status = status;
    if (outcome) review.outcome = outcome;
    if (body.evidence !== undefined) review.evidence = cleanString(body.evidence, 8_000);
    if (body.wins !== undefined) review.wins = cleanString(body.wins, 8_000);
    if (body.concerns !== undefined) review.concerns = cleanString(body.concerns, 8_000);
    if (body.supportProvided !== undefined) review.supportProvided = cleanString(body.supportProvided, 4_000);
    review.updatedAt = new Date().toISOString();
    store.audit.push(createAuditRecord("performance_review_updated", { reviewId, status: review.status, outcome: review.outcome }, actor));
  });
  if (!review) {
    sendJson(res, 404, { error: "Performance review not found." });
    return;
  }
  sendJson(res, 200, { review });
}

const employeeEventTypes = new Set(["shout_out", "complaint", "observation"]);
const employeeEventStatuses = new Set(["open", "reviewed", "resolved"]);

function listEmployeeEvents(store, searchParams) {
  const employee = cleanString(searchParams.get("employee"), 180).toLowerCase();
  const events = store.employeeEvents
    .filter((event) => !employee || event.employeeName.toLowerCase().includes(employee))
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const employees = new Map();
  for (const event of store.employeeEvents) {
    const current = employees.get(event.employeeName) || {
      employeeName: event.employeeName,
      shoutOuts: 0,
      complaints: 0,
      openComplaints: 0,
      observations: 0,
      latestEventAt: event.occurredAt
    };
    if (event.type === "shout_out") current.shoutOuts += 1;
    if (event.type === "complaint") {
      current.complaints += 1;
      if (event.status === "open") current.openComplaints += 1;
    }
    if (event.type === "observation") current.observations += 1;
    if (event.occurredAt > current.latestEventAt) current.latestEventAt = event.occurredAt;
    employees.set(event.employeeName, current);
  }
  return {
    events,
    employees: [...employees.values()].sort((a, b) => b.latestEventAt.localeCompare(a.latestEventAt)),
    summary: {
      total: store.employeeEvents.length,
      shoutOuts: store.employeeEvents.filter((event) => event.type === "shout_out").length,
      complaints: store.employeeEvents.filter((event) => event.type === "complaint").length,
      openComplaints: store.employeeEvents.filter((event) => event.type === "complaint" && event.status === "open").length
    },
    boundary: "Counts provide context, not a behavior score. Complaints remain allegations until a documented human review is complete."
  };
}

async function handleEmployeeEventCreate(req, res, actor) {
  const body = await readJson(req);
  const employeeRecordId = cleanString(body.employeeRecordId, 100);
  const employeeName = cleanString(body.employeeName, 180);
  const type = employeeEventTypes.has(body.type) ? body.type : "observation";
  const summary = cleanString(body.summary, 8_000);
  const source = cleanString(body.source, 240);
  const status = employeeEventStatuses.has(body.status) ? body.status : (type === "complaint" ? "open" : "reviewed");
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (!employeeName || !summary || !Number.isFinite(occurredAt.getTime())) {
    sendJson(res, 400, { error: "Employee, factual event details, and a valid event date are required." });
    return;
  }
  const now = new Date().toISOString();
  const event = {
    id: randomUUID(), employeeRecordId: employeeRecordId || null, employeeName, type, summary, source, status,
    occurredAt: occurredAt.toISOString(), createdAt: now, updatedAt: now,
    createdBy: actor.email || actor.role
  };
  await storage.mutate((store) => {
    store.employeeEvents.push(event);
    store.audit.push(createAuditRecord("employee_event_created", { eventId: event.id, employeeName, type, status }, actor));
  });
  sendJson(res, 201, { event });
}

async function handleEmployeeEventUpdate(req, res, eventId, actor) {
  const body = await readJson(req);
  const status = employeeEventStatuses.has(body.status) ? body.status : undefined;
  if (!status) {
    sendJson(res, 400, { error: "Choose a valid timeline record status." });
    return;
  }
  let event;
  await storage.mutate((store) => {
    event = store.employeeEvents.find((item) => item.id === eventId);
    if (!event) return;
    event.status = status;
    event.updatedAt = new Date().toISOString();
    event.updatedBy = actor.email || actor.role;
    store.audit.push(createAuditRecord("employee_event_updated", { eventId, employeeName: event.employeeName, status }, actor));
  });
  if (!event) {
    sendJson(res, 404, { error: "Timeline record not found." });
    return;
  }
  sendJson(res, 200, { event });
}

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
    sendJson(res, 503, { error: "Missing GEMINI_API_KEY. Add it to .env or .env.local, then restart the server." });
    return;
  }

  const store = await readStore();
  const useAnalytics = mode === "analytics" || /\b(dataset|attrition|turnover|workforce analytics|retention rate)\b/i.test(prompt);
  const analysis = useAnalytics ? analyzeWorkforce(store.records) : null;
  const sources = retrieveKnowledge(store.records, `${prompt} ${companyContext}`, 5);
  const response = await callGemini(buildPrompt({
    prompt,
    mode,
    companyContext,
    desiredOutput,
    riskLevel,
    evidence: analysis ? analyticsEvidence(analysis) : "No deterministic workforce analysis requested.",
    policyContext: knowledgeContext(sources)
  }));
  const warnings = analysis ? validateAnalyticsOutput(response, analysis) : [];
  const validatedResponse = warnings.length
    ? `REVIEW REQUIRED: Automated evidence checks found unsupported or unsafe claims.\n- ${warnings.join("\n- ")}\n\n${response}`
    : response;
  const audit = createAuditRecord("assistant_output", {
    mode,
    desiredOutput,
    riskLevel,
    promptPreview: prompt.slice(0, 220)
  }, actor);
  await storage.mutate((store) => store.audit.push(audit));
  sendJson(res, 200, {
    result: validatedResponse,
    model: MODEL,
    auditId: audit.id,
    evidence: analysis ? analysis.provenance : null,
    analytics: analysis?.summary || null,
    sources: sources.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })),
    warnings
  });
}

async function handleKnowledgeCreate(req, res, actor) {
  const body = await readJson(req);
  const title = cleanString(body.title, 180);
  const text = cleanString(body.text, 100_000);
  if (!title || text.length < 20) {
    sendJson(res, 400, { error: "Document title and at least 20 characters of text are required." });
    return;
  }
  const now = new Date().toISOString();
  const record = { id: randomUUID(), type: "document", name: title, details: text, source: "knowledge upload", createdBy: actor.role, createdAt: now, updatedAt: now };
  await storage.mutate((store) => {
    store.records.push(record);
    store.audit.push(createAuditRecord("knowledge_document_added", { recordId: record.id, title, characters: text.length }, actor));
  });
  sendJson(res, 201, { document: { id: record.id, title: record.name, characters: text.length } });
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

  const record = {
    id: randomUUID(),
    type,
    name,
    details,
    createdBy: actor.role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await storage.mutate((store) => {
    store.records.push(record);
    store.audit.push(createAuditRecord("record_created", { recordId: record.id, type, name }, actor));
  });
  sendJson(res, 201, { record });
}

async function handleRecordImport(req, res, actor) {
  const body = await readJson(req);
  const source = cleanString(body.source || "dataset import", 180);
  const records = Array.isArray(body.records) ? body.records : [];

  if (!records.length) {
    sendJson(res, 400, { error: "Import needs at least one record." });
    return;
  }
  if (records.length > 1_000) {
    sendJson(res, 413, { error: "Import is limited to 1,000 records at a time." });
    return;
  }

  const imported = [];
  const rejected = [];
  for (const [index, item] of records.entries()) {
    const normalized = normalizeImportRecord(item);
    if (!normalized.name) {
      rejected.push({ row: index + 1, error: "Missing employee name or record name." });
      continue;
    }
    if (!allowedRecordTypes.has(normalized.type)) {
      rejected.push({ row: index + 1, error: `Unsupported record type: ${normalized.type}` });
      continue;
    }
    imported.push({
      id: randomUUID(),
      type: normalized.type,
      name: normalized.name,
      details: normalized.details,
      attributes: normalized.attributes,
      source,
      createdBy: actor.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  if (!imported.length) {
    sendJson(res, 400, { error: "No valid records found in the dataset.", rejected });
    return;
  }

  let stored = [];
  let duplicateCount = 0;
  await storage.mutate((store) => {
    const fingerprints = new Set(store.records.filter((record) => !record.deletedAt).map(recordFingerprint));
    stored = imported.filter((record) => {
      const fingerprint = recordFingerprint(record);
      if (fingerprints.has(fingerprint)) {
        duplicateCount += 1;
        return false;
      }
      fingerprints.add(fingerprint);
      return true;
    });
    store.records.push(...stored);
    store.audit.push(createAuditRecord("records_imported", {
      source,
      imported: stored.length,
      duplicates: duplicateCount,
      rejected: rejected.length,
      sampleNames: stored.slice(0, 5).map((record) => record.name)
    }, actor));
  });
  sendJson(res, stored.length ? 201 : 200, { imported: stored, rejected, importedCount: stored.length, duplicateCount, rejectedCount: rejected.length });
}

function recordFingerprint(record) {
  const attributes = Object.fromEntries(Object.entries(record.attributes || {}).sort(([left], [right]) => left.localeCompare(right)));
  return createHash("sha256").update(JSON.stringify([
    String(record.type || "employee").toLowerCase(),
    String(record.name || "").trim().toLowerCase(),
    String(record.details || "").trim(),
    attributes
  ])).digest("hex");
}

function listRecords(store, searchParams) {
  const query = cleanString(searchParams.get("q"), 200).toLowerCase();
  const type = cleanString(searchParams.get("type"), 40);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 100)));
  const offset = Math.max(0, Number(searchParams.get("offset") || 0));
  const filtered = store.records.filter((record) => {
    if (!includeDeleted && record.deletedAt) return false;
    if (type && record.type !== type) return false;
    if (query && !`${record.name} ${record.details}`.toLowerCase().includes(query)) return false;
    return true;
  });
  return { records: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
}

async function handleRecordGet(res, recordId) {
  const record = (await readStore()).records.find((item) => item.id === recordId && !item.deletedAt);
  if (!record) {
    sendJson(res, 404, { error: "Record not found." });
    return;
  }
  sendJson(res, 200, { record });
}

async function handleRecordUpdate(req, res, recordId, actor) {
  const body = await readJson(req);
  const type = body.type === undefined ? undefined : String(body.type).trim();
  const name = body.name === undefined ? undefined : cleanString(body.name, 180);
  const details = body.details === undefined ? undefined : cleanString(body.details, 8_000);
  if ((type !== undefined && !allowedRecordTypes.has(type)) || name === "") {
    sendJson(res, 400, { error: "Enter a valid record type and name." });
    return;
  }
  let record;
  await storage.mutate((store) => {
    record = store.records.find((item) => item.id === recordId && !item.deletedAt);
    if (!record) return;
    if (type !== undefined) record.type = type;
    if (name !== undefined) record.name = name;
    if (details !== undefined) record.details = details;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = actor.email || actor.role;
    store.audit.push(createAuditRecord("record_updated", { recordId, fields: Object.keys(body) }, actor));
  });
  if (!record) {
    sendJson(res, 404, { error: "Record not found." });
    return;
  }
  sendJson(res, 200, { record });
}

async function handleRecordDelete(res, recordId, actor) {
  let record;
  await storage.mutate((store) => {
    record = store.records.find((item) => item.id === recordId && !item.deletedAt);
    if (!record) return;
    record.deletedAt = new Date().toISOString();
    record.deletedBy = actor.email || actor.role;
    record.updatedAt = record.deletedAt;
    store.audit.push(createAuditRecord("record_deleted", { recordId, type: record.type, name: record.name }, actor));
  });
  if (!record) {
    sendJson(res, 404, { error: "Record not found." });
    return;
  }
  sendJson(res, 200, { deleted: true, recordId });
}

async function handleRecordRestore(res, recordId, actor) {
  let record;
  await storage.mutate((store) => {
    record = store.records.find((item) => item.id === recordId && item.deletedAt);
    if (!record) return;
    record.deletedAt = null;
    record.deletedBy = null;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = actor.email || actor.role;
    store.audit.push(createAuditRecord("record_restored", { recordId, type: record.type, name: record.name }, actor));
  });
  if (!record) {
    sendJson(res, 404, { error: "Deleted record not found." });
    return;
  }
  sendJson(res, 200, { restored: true, record });
}

async function handlePrivacyExport(res, actor) {
  await storage.mutate((store) => {
    store.audit.push(createAuditRecord("organization_exported", { organizationId: ORGANIZATION_ID }, actor));
  });
  const store = await readStore();
  const exportData = {
    exportedAt: new Date().toISOString(),
    organization: { id: ORGANIZATION_ID, ...store.settings },
    users: store.users.map(publicUser),
    records: store.records,
    performanceReviews: store.performanceReviews,
    employeeEvents: store.employeeEvents,
    onboardingPacks: store.onboardingPacks,
    decisions: store.decisions,
    audit: store.audit
  };
  res.setHeader("Content-Disposition", `attachment; filename="aihr-export-${new Date().toISOString().slice(0, 10)}.json"`);
  sendJson(res, 200, exportData);
}

async function handlePrivacyPurge(req, res, actor) {
  const body = await readJson(req);
  const retentionDays = Math.min(3650, Math.max(0, Number(body.retentionDays ?? 30)));
  const cutoff = Date.now() - retentionDays * 86_400_000;
  let purged = 0;
  await storage.mutate((store) => {
    const retained = store.records.filter((record) => !record.deletedAt || new Date(record.deletedAt).getTime() > cutoff);
    purged = store.records.length - retained.length;
    store.records = retained;
    store.settings.retentionDays = retentionDays;
    store.audit.push(createAuditRecord("deleted_records_purged", { purged, retentionDays }, actor));
  });
  sendJson(res, 200, { purged, retentionDays });
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
  const brief = await callGemini(buildDecisionPrompt({ decisionType, subject, facts, proposedAction, risk }));
  const status = risk.requiresHumanApproval ? "needs_review" : "approved_for_action";
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
  await storage.mutate((store) => {
    store.decisions.push(decision);
    store.audit.push(createAuditRecord("decision_created", {
      decisionId: decision.id,
      decisionType,
      subject,
      status,
      riskLevel: risk.level,
      flags: risk.flags
    }, actor));
  });
  sendJson(res, 201, { decision });
}

async function handleDecisionApproval(req, res, decisionId, actor) {
  const body = await readJson(req);
  await applyDecisionReview(res, decisionId, actor, "approve", body);
}

async function handleDecisionReview(req, res, decisionId, actor) {
  const body = await readJson(req);
  const outcome = String(body.outcome || "");
  if (!["approve", "reject"].includes(outcome)) {
    sendJson(res, 400, { error: "Review outcome must be approve or reject." });
    return;
  }
  await applyDecisionReview(res, decisionId, actor, outcome, body);
}

async function applyDecisionReview(res, decisionId, actor, outcome, body) {
  const reviewer = cleanString(body.reviewer || actor.email || actor.role, 180);
  const note = cleanString(body.note, 2_000);
  let decision;
  let conflict = false;
  await storage.mutate((store) => {
    decision = store.decisions.find((item) => item.id === decisionId);
    if (!decision) return;
    if (decision.status !== "needs_review") {
      conflict = true;
      return;
    }
    decision.status = outcome === "approve" ? "approved_after_review" : "rejected_after_review";
    decision.updatedAt = new Date().toISOString();
    decision.reviews = Array.isArray(decision.reviews) ? decision.reviews : [];
    const review = { reviewer, note, outcome, reviewedAt: new Date().toISOString() };
    decision.reviews.push(review);
    if (outcome === "approve") {
      decision.approvals = Array.isArray(decision.approvals) ? decision.approvals : [];
      decision.approvals.push({ reviewer, note, approvedAt: review.reviewedAt });
    }
    store.audit.push(createAuditRecord(
      outcome === "approve" ? "decision_approved" : "decision_rejected",
      { decisionId, reviewer, noteProvided: Boolean(note) },
      actor
    ));
  });
  if (!decision) {
    sendJson(res, 404, { error: "Decision not found." });
    return;
  }
  if (conflict) {
    sendJson(res, 409, { error: "This decision has already completed human review." });
    return;
  }
  sendJson(res, 200, { decision });
}

function buildPrompt({ prompt, mode, companyContext, desiredOutput, riskLevel, evidence, policyContext }) {
  return `
HR role: ${hrModes[mode] || hrModes.generalist}
Requested output format: ${desiredOutput}
Risk sensitivity: ${riskLevel}

Company context:
${companyContext || "No company context provided."}

User request:
${prompt}

Verified workforce evidence:
${evidence}

Retrieved internal sources:
${policyContext}

Evidence rules:
- Use only the verified evidence above for numerical workforce claims.
- Describe observed relationships as associations, not causes or predictions.
- Never invent percentages, impact targets, thresholds, policy terms, or legal jurisdiction.
- Cite internal sources inline as [S1], [S2], etc. Do not cite a source that does not support the statement.
- Never rank or score an individual employee's likelihood of leaving or suitability for an employment action.
- Clearly label assumptions and state when evidence is unavailable.

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
Create an HR decision brief.

Decision type: ${decisionType}
Subject: ${subject}
Proposed action: ${proposedAction}
Risk classification: ${risk.level}
Risk flags: ${risk.flags.join(", ") || "none"}
Human approval required: ${risk.requiresHumanApproval ? "yes" : "no"}

Facts:
${facts}

Return:
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

function listAudit(store, searchParams) {
  const action = cleanString(searchParams.get("action"), 100);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 100)));
  const offset = Math.max(0, Number(searchParams.get("offset") || 0));
  const filtered = store.audit
    .filter((event) => !action || event.action === action)
    .slice()
    .reverse();
  return { audit: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
}

async function handleMetrics(res) {
  const [store, database] = await Promise.all([readStore(), storage.health()]);
  const memory = process.memoryUsage();
  sendJson(res, 200, {
    version: APP_VERSION,
    startedAt: runtimeMetrics.startedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    requests: runtimeMetrics.requests,
    errors: runtimeMetrics.errors,
    statuses: runtimeMetrics.statuses,
    rateLimitBuckets: rateBuckets.size,
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal
    },
    storage: database.engine,
    organization: {
      records: store.records.filter((record) => !record.deletedAt).length,
      deletedRecords: store.records.filter((record) => record.deletedAt).length,
      decisions: store.decisions.length,
      performanceReviews: store.performanceReviews.length,
      employeeEvents: store.employeeEvents.length,
      onboardingPacks: store.onboardingPacks.length,
      pendingApprovals: store.decisions.filter((decision) => decision.status === "needs_review").length,
      activeUsers: store.users.filter((user) => !user.disabledAt).length,
      activeSessions: store.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now()).length,
      pendingInvitations: store.invitations.filter((invite) => !invite.acceptedAt && new Date(invite.expiresAt).getTime() > Date.now()).length,
      auditEvents: store.audit.length
    }
  });
}

const complianceChecklist = [
  "privacyPolicyReviewed",
  "termsReviewed",
  "retentionScheduleApproved",
  "humanReviewOwnerAssigned",
  "employmentCounselReviewed",
  "aiImpactAssessmentCompleted",
  "incidentOwnerAssigned",
  "restoreDrillCompleted"
];

async function handleReadiness(res) {
  const [store, database] = await Promise.all([readStore(), storage.health()]);
  const compliance = store.settings.compliance || {};
  const checks = {
    geminiConnected: Boolean(GEMINI_API_KEY),
    productionDatabase: database.engine === "postgresql",
    authenticationRequired: authenticationRequired(store),
    smtpConfigured: mailer.configured,
    alertingConfigured: alerter.configured,
    backupKeyConfigured: Boolean(process.env.AIHR_BACKUP_KEY),
    ...Object.fromEntries(complianceChecklist.map((key) => [key, Boolean(compliance[key])]))
  };
  const completed = Object.values(checks).filter(Boolean).length;
  sendJson(res, 200, {
    checks,
    completed,
    total: Object.keys(checks).length,
    launchReady: completed === Object.keys(checks).length,
    note: "Legal, security, and operational attestations must be completed by accountable qualified people."
  });
}

async function handleReadinessUpdate(req, res, actor) {
  const body = await readJson(req);
  const updates = Object.fromEntries(complianceChecklist
    .filter((key) => body[key] !== undefined)
    .map((key) => [key, Boolean(body[key])]));
  await storage.mutate((store) => {
    store.settings.compliance = { ...(store.settings.compliance || {}), ...updates };
    store.audit.push(createAuditRecord("readiness_attestation_updated", { fields: Object.keys(updates) }, actor));
  });
  await handleReadiness(res);
}

function integrationStatus() {
  return {
    email: { configured: mailer.configured, provider: "smtp" },
    incidentAlerts: { configured: alerter.configured, provider: "signed_webhook" },
    ...integrationHub.status(),
    note: "External credentials and provider approval are required before these adapters can exchange data."
  };
}

async function handleIntegrationEvent(req, res, integration, actor) {
  const body = await readJson(req);
  if (body.confirmed !== true) {
    sendJson(res, 400, { error: "Outbound integration delivery requires confirmed: true." });
    return;
  }
  const event = {
    action: cleanString(body.action || "notify", 80),
    subject: cleanString(body.subject, 220),
    message: cleanString(body.message, 4_000),
    organizationId: ORGANIZATION_ID
  };
  const result = await integrationHub.dispatch(integration, event);
  await storage.mutate((store) => store.audit.push(createAuditRecord("integration_event", { integration, action: event.action, status: result.status }, actor)));
  sendJson(res, result.status === "unsupported" ? 400 : result.status === "failed" ? 502 : 200, { delivery: result });
}

async function handleScheduledWorkflowCreate(req, res, actor) {
  const body = await readJson(req);
  const name = cleanString(body.name, 180);
  const integration = cleanString(body.integration || "collaboration", 40);
  const runAt = new Date(body.runAt);
  const allowed = new Set(Object.keys(integrationHub.status()));
  if (!name || !allowed.has(integration) || !Number.isFinite(runAt.getTime()) || runAt.getTime() <= Date.now()) {
    sendJson(res, 400, { error: "Provide a name, supported integration, and future runAt timestamp." });
    return;
  }
  const workflow = {
    id: randomUUID(),
    name,
    integration,
    message: cleanString(body.message, 4_000),
    runAt: runAt.toISOString(),
    status: "scheduled",
    createdAt: new Date().toISOString(),
    createdBy: actor.email || actor.role
  };
  await storage.mutate((store) => {
    store.scheduledWorkflows.push(workflow);
    store.audit.push(createAuditRecord("workflow_scheduled", { workflowId: workflow.id, integration, runAt: workflow.runAt }, actor));
  });
  sendJson(res, 201, { workflow });
}

async function processScheduledWorkflows() {
  const store = await readStore();
  const due = store.scheduledWorkflows.filter((workflow) => workflow.status === "scheduled" && new Date(workflow.runAt).getTime() <= Date.now()).slice(0, 20);
  for (const workflow of due) {
    const result = await integrationHub.dispatch(workflow.integration, { action: "notify", subject: workflow.name, message: workflow.message, organizationId: ORGANIZATION_ID });
    await storage.mutate((nextStore) => {
      const current = nextStore.scheduledWorkflows.find((item) => item.id === workflow.id);
      if (!current || current.status !== "scheduled") return;
      current.status = result.status === "sent" ? "completed" : result.status;
      current.processedAt = new Date().toISOString();
      nextStore.audit.push(createAuditRecord("workflow_processed", { workflowId: workflow.id, status: current.status }));
    });
  }
}

async function readStore() {
  return storage.read();
}

async function callGemini(prompt) {
  if (GEMINI_MOCK_RESPONSE) return GEMINI_MOCK_RESPONSE;
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await callGeminiOnce(prompt);
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === 3) throw error;
      const retryDelay = Math.min(60_000, Math.max(error.retryAfterMs || 0, 500 * (2 ** attempt)));
      await delay(retryDelay);
    }
  }
  throw lastError;
}

async function callGeminiOnce(prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
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
    error.statusCode = 502;
    error.publicMessage = "Gemini connection failed. The server retried the request; please try again shortly.";
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Gemini request failed with status ${response.status}`);
    error.statusCode = response.status;
    error.publicMessage = [401, 403].includes(response.status)
      ? "Gemini authentication failed. Create a Gemini API key in Google AI Studio, update GEMINI_API_KEY, and restart AI HR."
      : data?.error?.message || "Gemini request failed.";
    error.retryAfterMs = getGeminiRetryDelay(response, data);
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  return text || "Gemini returned no text. Try adding more context to the HR request.";
}

function isTransientGeminiError(error) {
  const status = Number(error.statusCode || 0);
  const code = String(error.cause?.code || error.code || "");
  return status === 429 || status === 502 || status === 503 || status === 504 ||
    status >= 500 || ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"].includes(code);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getGeminiRetryDelay(response, data) {
  const headerSeconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) return headerSeconds * 1_000;
  const retryInfo = data?.error?.details?.find((item) => String(item?.["@type"] || "").endsWith("RetryInfo"));
  const match = String(retryInfo?.retryDelay || "").match(/^([\d.]+)s$/);
  return match ? Math.ceil(Number(match[1]) * 1_000) + 500 : 0;
}

async function serveStatic(pathname, res) {
  if (pathname === "/fonts/plus-jakarta-sans-variable-latin.woff2") {
    try {
      const content = await readFile(uiFontPath);
      res.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable" });
      res.end(content);
    } catch {
      sendText(res, 404, "Font not found");
    }
    return;
  }
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
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
        const error = new Error("Invalid JSON");
        error.statusCode = 400;
        error.publicMessage = "Invalid JSON body.";
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (IS_PRODUCTION) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-AIHR-Token,X-Request-Id");
  res.setHeader("Vary", "Origin");
}

function validateRequestOrigin(req, res) {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method || "")) return true;
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  const allowed = ALLOWED_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
  const requestOrigin = `${IS_PRODUCTION ? "https" : "http"}://${req.headers.host}`;
  if (allowed.includes(origin) || origin === requestOrigin) return true;
  sendJson(res, 403, { error: "Request origin is not allowed." });
  return false;
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

async function requireRole(req, res, roles) {
  const actor = await authenticate(req);
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

async function authenticate(req, suppliedStore) {
  const token = extractToken(req);
  if (token) {
    for (const [role, expected] of Object.entries(roleTokens)) {
      if (expected && safeCompare(token, expected)) return { ok: true, role, mode: "token", organizationId: ORGANIZATION_ID };
    }
    return { ok: false, status: 401, error: "Invalid API token." };
  }

  const store = suppliedStore || await readStore();
  const sessionToken = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    const session = store.sessions.find((item) => !item.mfaChallenge && item.tokenHash === tokenHash && new Date(item.expiresAt).getTime() > Date.now());
    const user = session && store.users.find((item) => item.id === session.userId && !item.disabledAt);
    if (user) {
      return {
        ok: true,
        role: user.role,
        mode: "session",
        userId: user.id,
        email: user.email,
        organizationId: ORGANIZATION_ID
      };
    }
  }

  if (!authenticationRequired(store)) {
    return { ok: true, role: "admin", mode: "development", organizationId: ORGANIZATION_ID };
  }
  return { ok: false, status: 401, error: "Sign in to continue." };
}

function authenticationRequired(store) {
  return AUTH_REQUIRED || configuredAuth || store.users.length > 0;
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

function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseCookies(header) {
  return Object.fromEntries(String(header).split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator === -1) return [part.trim(), ""];
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter(([key]) => key));
}

function setSessionCookie(res, token) {
  const secure = IS_PRODUCTION ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86_400}${secure}`);
}

function clearSessionCookie(res) {
  const secure = IS_PRODUCTION ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function normalizeImportRecord(item) {
  const source = item && typeof item === "object" ? item : {};
  const type = cleanString(source.type || source.recordType || "employee", 40).toLowerCase();
  const name = cleanString(
    source.name ||
    source.employeeName ||
    source.fullName ||
    [source.firstName, source.lastName].filter(Boolean).join(" "),
    180
  );
  const detailEntries = Object.entries(source)
    .filter(([key, value]) => !["type", "recordType", "name", "employeeName", "fullName", "firstName", "lastName"].includes(key))
    .filter(([key]) => !["age", "gender", "maritalstatus", "ethnicity", "race", "religion", "disability", "medical", "pregnancy", "nationality", "sexualorientation"].includes(normalizeAttributeKey(key).replace(/\s/g, "")))
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${humanizeKey(key)}: ${String(value).trim()}`);
  const details = cleanString(source.details || source.notes || detailEntries.join("\n"), 8_000);
  const excluded = new Set(["type", "recordtype", "name", "employeename", "fullname", "firstname", "lastname", "details", "notes"]);
  const protectedColumns = new Set(["age", "gender", "maritalstatus", "ethnicity", "race", "religion", "disability", "medical", "pregnancy", "nationality", "sexualorientation"]);
  const attributes = Object.fromEntries(Object.entries(source)
    .map(([key, value]) => [normalizeAttributeKey(key), cleanString(value, 1_000)])
    .filter(([key, value]) => value && !excluded.has(key.replace(/\s/g, "")) && !protectedColumns.has(key.replace(/\s/g, ""))));
  return { type, name, details, attributes: Object.keys(attributes).length ? attributes : parseDetails(details) };
}

function normalizeAttributeKey(key) {
  return String(key).replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase().replace(/\s+/g, " ");
}

function humanizeKey(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createAuditRecord(action, detail, actor = { role: "system" }) {
  return {
    id: randomUUID(),
    action,
    actor: actor.email || actor.role || "system",
    detail: sanitizeAuditDetail(detail),
    createdAt: new Date().toISOString()
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

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
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
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
