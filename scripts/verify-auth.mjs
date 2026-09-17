import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";

const dataDir = await mkdtemp(join(tmpdir(), "aihr-auth-test-"));
const port = "3200";
const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: port,
    AIHR_DATA_DIR: dataDir,
    AIHR_AUTH_REQUIRED: "true",
    AIHR_ADMIN_TOKEN: "",
    AIHR_HR_MANAGER_TOKEN: "",
    AIHR_RECRUITER_TOKEN: "",
    AIHR_EMPLOYEE_TOKEN: "",
    AIHR_AUDITOR_TOKEN: "",
    GEMINI_API_KEY: "auth-test-key",
    AIHR_GEMINI_MOCK_RESPONSE: "Synthetic Gemini response for isolated workflow verification. This output is long enough to verify persistence without calling an external provider."
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let logs = "";
server.stdout.on("data", (chunk) => { logs += chunk.toString(); });
server.stderr.on("data", (chunk) => { logs += chunk.toString(); });

try {
  await waitForServer();
  await verifyAuthAndLifecycle();
  console.log("Identity lifecycle, authorization, CRUD, recovery, decision review, metrics, and audit verification passed.");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  await rm(dataDir, { recursive: true, force: true });
}

async function verifyAuthAndLifecycle() {
  const unauthenticated = await request("/api/org");
  assert(unauthenticated.status === 401, "Protected endpoint allowed an unauthenticated request.");

  const bootstrap = await request("/api/auth/bootstrap", {
    method: "POST",
    body: {
      organizationName: "Verification Workspace",
      email: "admin@example.test",
      password: "Verification1234",
      acceptTerms: true
    }
  });
  assert(bootstrap.status === 201, `Bootstrap failed: ${bootstrap.data.error || bootstrap.status}`);
  const adminCookie = cookieFrom(bootstrap);

  const me = await request("/api/auth/me", { cookie: adminCookie });
  assert(me.data.authenticated && me.data.user.role === "admin", "Admin session was not recognized.");

  const userCreate = await request("/api/users", {
    method: "POST",
    cookie: adminCookie,
    body: { email: "employee@example.test", role: "employee", password: "EmployeePass123" }
  });
  assert(userCreate.status === 201, "Admin could not create an employee account.");
  const employeeId = userCreate.data.user.id;

  const invitation = await request("/api/invitations", {
    method: "POST",
    cookie: adminCookie,
    body: { email: "recruiter@example.test", role: "recruiter" }
  });
  assert(invitation.status === 201, "Invitation creation failed.");
  assert(invitation.data.delivery.status === "not_configured", "Unconfigured invitation delivery was not reported safely.");
  const invitationToken = new URL(`http://localhost${invitation.data.invitation.path}`).searchParams.get("invitation");
  const accepted = await request("/api/auth/accept-invitation", {
    method: "POST",
    body: { token: invitationToken, password: "InvitationPass123", acceptTerms: true }
  });
  assert(accepted.status === 201 && accepted.data.user.role === "recruiter", "Invitation acceptance failed.");
  const invitedCookie = cookieFrom(accepted);
  const passwordChanged = await request("/api/auth/change-password", {
    method: "POST",
    cookie: invitedCookie,
    body: { currentPassword: "InvitationPass123", newPassword: "ChangedPass1234" }
  });
  assert(passwordChanged.status === 200, "Self-service password change failed.");
  const oldInviteSession = await request("/api/records", { cookie: invitedCookie });
  assert(oldInviteSession.status === 401, "Password change did not revoke the old session.");
  const changedCookie = cookieFrom(passwordChanged);
  const newInviteSession = await request("/api/records", { cookie: changedCookie });
  assert(newInviteSession.status === 200, "Password change did not establish a replacement session.");

  const created = await request("/api/records", {
    method: "POST",
    cookie: adminCookie,
    body: { type: "employee", name: "Lifecycle Test", details: "Initial details" }
  });
  assert(created.status === 201, "Record creation failed.");
  const recordId = created.data.record.id;

  const search = await request("/api/records?q=Lifecycle", { cookie: adminCookie });
  assert(search.data.total === 1, "Record search failed.");

  const updated = await request(`/api/records/${recordId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { name: "Lifecycle Test Updated", details: "Updated details" }
  });
  assert(updated.data.record.name === "Lifecycle Test Updated", "Record update failed.");

  const performanceReview = await request("/api/performance", {
    method: "POST",
    cookie: adminCookie,
    body: {
      employeeRecordId: recordId,
      reviewPeriod: "Q3 verification",
      outcome: "partially_meeting",
      status: "support_needed",
      goals: "Complete the agreed synthetic verification goal.",
      wins: "Completed two documented checkpoints.",
      concerns: "One milestone remains open.",
      evidence: "Two documented checkpoints were completed; one milestone remains open.",
      supportProvided: "Weekly coaching and a written milestone plan.",
      nextReviewAt: new Date(Date.now() + 7 * 86_400_000).toISOString()
    }
  });
  assert(performanceReview.status === 201, "Performance review creation failed.");
  const performanceList = await request("/api/performance", { cookie: adminCookie });
  assert(performanceList.data.summary.supportNeeded === 1, "Performance follow-up summary failed.");
  assert(performanceList.data.boundary.includes("not termination recommendations"), "Performance safety boundary is missing.");
  const performanceUpdated = await request(`/api/performance/${performanceReview.data.review.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "formal_review" }
  });
  assert(performanceUpdated.data.review.status === "formal_review", "Performance review status update failed.");

  const datasetRows = [{ name: "Dataset Import Test", department: "Verification", jobTitle: "Analyst", age: "31" }];
  const firstImport = await request("/api/records/import", {
    method: "POST",
    cookie: adminCookie,
    body: { source: "verification.csv", records: datasetRows }
  });
  assert(firstImport.status === 201 && firstImport.data.importedCount === 1, "Dataset import failed.");
  assert(!Object.hasOwn(firstImport.data.imported[0].attributes, "age"), "Protected dataset column was retained in analytics attributes.");
  const duplicateImport = await request("/api/records/import", {
    method: "POST",
    cookie: adminCookie,
    body: { source: "verification.csv", records: datasetRows }
  });
  assert(duplicateImport.status === 200 && duplicateImport.data.importedCount === 0 && duplicateImport.data.duplicateCount === 1, "Duplicate dataset rows were not skipped.");

  const peopleEvent = await request("/api/people-events", {
    method: "POST",
    cookie: adminCookie,
    body: {
      employeeName: "Lifecycle Test Updated",
      type: "complaint",
      summary: "A synthetic concern was recorded for verification and has not been substantiated.",
      source: "Verification fixture",
      occurredAt: new Date().toISOString()
    }
  });
  assert(peopleEvent.status === 201 && peopleEvent.data.event.status === "open", "Employee timeline event creation failed.");
  const peopleEvents = await request("/api/people-events", { cookie: adminCookie });
  assert(peopleEvents.data.summary.openComplaints === 1, "Open complaint summary failed.");
  assert(peopleEvents.data.boundary.includes("not a behavior score"), "People analytics safety boundary is missing.");

  const dashboard = await request("/api/dashboard", { cookie: adminCookie });
  assert(dashboard.status === 200, "Dashboard failed.");
  assert(dashboard.data.summary.employees === 2, "Dashboard employee count is incorrect.");
  assert(dashboard.data.summary.openReviews === 1, "Dashboard review count is incorrect.");
  assert(dashboard.data.summary.complaintsForReview === 1, "Dashboard complaint count is incorrect.");

  const profile = await request(`/api/employees/${recordId}/profile`, { cookie: adminCookie });
  assert(profile.status === 200 && profile.data.employee.name === "Lifecycle Test Updated", "Unified employee profile failed.");
  assert(profile.data.reviews.length === 1 && profile.data.events.length === 1, "Employee profile omitted documented history.");

  const onboarding = await request("/api/onboarding", {
    method: "POST",
    cookie: adminCookie,
    body: {
      employeeName: "New Hire Verification",
      role: "Support Analyst",
      team: "Customer Operations, reporting to Test Manager",
      setup: "Monday, hybrid",
      responsibilities: "Resolve customer requests and document repeatable solutions.",
      dailyNeeds: "Laptop, help desk access, calendar, and manager check-in."
    }
  });
  assert(onboarding.status === 201 && onboarding.data.pack.status === "pending", "Onboarding pack creation failed.");
  const onboardingList = await request("/api/onboarding", { cookie: adminCookie });
  assert(onboardingList.data.packs.length === 1, "Onboarding list failed.");
  const onboardingPdf = await request(`/api/reports/onboarding/${onboarding.data.pack.id}.pdf`, { cookie: adminCookie });
  assert(onboardingPdf.status === 200 && onboardingPdf.headers.get("content-type") === "application/pdf", "Onboarding PDF failed.");
  const performancePdf = await request(`/api/reports/performance/${performanceReview.data.review.id}.pdf`, { cookie: adminCookie });
  assert(performancePdf.status === 200 && performancePdf.headers.get("content-type") === "application/pdf", "Performance PDF failed.");
  const onboardingCompleted = await request(`/api/onboarding/${onboarding.data.pack.id}`, {
    method: "PATCH", cookie: adminCookie, body: { status: "completed" }
  });
  assert(onboardingCompleted.data.pack.status === "completed", "Onboarding completion failed.");

  const reviewedEvent = await request(`/api/people-events/${peopleEvent.data.event.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "reviewed" }
  });
  assert(reviewedEvent.data.event.status === "reviewed", "Employee timeline review lifecycle failed.");

  const exported = await request("/api/privacy/export", { cookie: adminCookie });
  assert(exported.status === 200 && exported.data.records.length === 2, "Organization export failed.");
  assert(exported.data.performanceReviews.length === 1, "Organization export omitted performance reviews.");
  assert(exported.data.employeeEvents.length === 1, "Organization export omitted employee timeline events.");
  assert(exported.data.onboardingPacks.length === 1, "Organization export omitted onboarding packs.");
  assert(!JSON.stringify(exported.data).includes("passwordHash"), "Export leaked password hashes.");

  const deleted = await request(`/api/records/${recordId}`, { method: "DELETE", cookie: adminCookie });
  assert(deleted.data.deleted, "Soft deletion failed.");
  const restored = await request(`/api/records/${recordId}/restore`, { method: "POST", cookie: adminCookie });
  assert(restored.data.restored && !restored.data.record.deletedAt, "Record restoration failed.");
  await request(`/api/records/${recordId}`, { method: "DELETE", cookie: adminCookie });
  const purge = await request("/api/privacy/purge", {
    method: "POST",
    cookie: adminCookie,
    body: { retentionDays: 0 }
  });
  assert(purge.data.purged === 1, "Retention purge failed.");

  const decision = await request("/api/decisions", {
    method: "POST",
    cookie: adminCookie,
    body: {
      decisionType: "termination",
      subject: "Synthetic review test",
      facts: "Documented synthetic facts only.",
      proposedAction: "Evaluate termination risk."
    }
  });
  assert(decision.status === 201 && decision.data.decision.status === "needs_review", "High-impact decision was not gated.");
  const rejected = await request(`/api/decisions/${decision.data.decision.id}/review`, {
    method: "POST",
    cookie: adminCookie,
    body: { outcome: "reject", note: "Insufficient evidence." }
  });
  assert(rejected.data.decision.status === "rejected_after_review", "Decision rejection failed.");
  const duplicateReview = await request(`/api/decisions/${decision.data.decision.id}/review`, {
    method: "POST",
    cookie: adminCookie,
    body: { outcome: "approve" }
  });
  assert(duplicateReview.status === 409, "Completed decision accepted a second review.");

  const audit = await request("/api/audit?limit=5&offset=0", { cookie: adminCookie });
  assert(audit.status === 200 && audit.data.audit.length === 5 && audit.data.total >= 5, "Audit pagination failed.");
  const metrics = await request("/api/metrics", { cookie: adminCookie });
  assert(metrics.status === 200 && metrics.data.requests > 0, "Operational metrics failed.");

  const knowledge = await request("/api/knowledge", {
    method: "POST",
    cookie: adminCookie,
    body: { title: "Verification policy", text: "Employees may request approved leave through the verification HR portal." }
  });
  assert(knowledge.status === 201, "Knowledge document creation failed.");
  const knowledgeSearch = await request("/api/knowledge?q=approved+leave", { cookie: adminCookie });
  assert(knowledgeSearch.data.sources[0]?.title === "Verification policy", "Knowledge retrieval failed.");
  const analytics = await request("/api/analytics/workforce", { cookie: adminCookie });
  assert(analytics.status === 200 && analytics.data.provenance, "Workforce analytics failed.");
  const readiness = await request("/api/readiness", { cookie: adminCookie });
  assert(readiness.status === 200 && readiness.data.total >= 10, "Launch readiness failed.");
  const attested = await request("/api/readiness", { method: "PATCH", cookie: adminCookie, body: { privacyPolicyReviewed: true } });
  assert(attested.data.checks.privacyPolicyReviewed, "Readiness attestation failed.");
  const integrations = await request("/api/integrations", { cookie: adminCookie });
  assert(integrations.status === 200 && integrations.data.payroll.mode === "notification_only", "Integration status failed.");
  const scheduled = await request("/api/workflows/scheduled", {
    method: "POST",
    cookie: adminCookie,
    body: { name: "Verification reminder", integration: "collaboration", runAt: new Date(Date.now() + 60_000).toISOString(), message: "Synthetic reminder" }
  });
  assert(scheduled.status === 201 && scheduled.data.workflow.status === "scheduled", "Scheduled workflow creation failed.");

  const mfaSetup = await request("/api/auth/mfa/setup", { method: "POST", cookie: adminCookie });
  assert(mfaSetup.status === 200 && mfaSetup.data.secret, "MFA setup failed.");
  const mfaConfirm = await request("/api/auth/mfa/confirm", {
    method: "POST",
    cookie: adminCookie,
    body: { code: generateTotp(mfaSetup.data.secret) }
  });
  assert(mfaConfirm.status === 200 && mfaConfirm.data.enabled, "MFA confirmation failed.");

  await request("/api/auth/logout", { method: "POST", cookie: adminCookie });
  const afterLogout = await request("/api/org", { cookie: adminCookie });
  assert(afterLogout.status === 401, "Logged-out session remained active.");

  const employeeLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "employee@example.test", password: "EmployeePass123" }
  });
  assert(employeeLogin.status === 200, "Employee login failed.");
  const employeeDenied = await request("/api/org", { cookie: cookieFrom(employeeLogin) });
  assert(employeeDenied.status === 403, "Employee role accessed restricted organization metrics.");
  const employeePerformanceDenied = await request("/api/performance", { cookie: cookieFrom(employeeLogin) });
  assert(employeePerformanceDenied.status === 403, "Employee role accessed organization performance reviews.");
  const employeeTimelineDenied = await request("/api/people-events", { cookie: cookieFrom(employeeLogin) });
  assert(employeeTimelineDenied.status === 403, "Employee role accessed organization timeline records.");

  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@example.test", password: "Verification1234" }
  });
  assert(adminLogin.status === 202 && adminLogin.data.mfaRequired, "MFA-protected login did not issue a challenge.");
  const mfaVerified = await request("/api/auth/mfa/verify", {
    method: "POST",
    body: { challengeToken: adminLogin.data.challengeToken, code: generateTotp(mfaSetup.data.secret) }
  });
  assert(mfaVerified.status === 200, "MFA challenge verification failed.");
  const verifiedAdminCookie = cookieFrom(mfaVerified);

  const disabled = await request(`/api/users/${employeeId}`, {
    method: "PATCH",
    cookie: verifiedAdminCookie,
    body: { disabled: true }
  });
  assert(disabled.data.user.disabledAt, "User disable failed.");
  const disabledSession = await request("/api/hr", { method: "POST", cookie: cookieFrom(employeeLogin), body: { prompt: "test" } });
  assert(disabledSession.status === 401, "Disabling a user did not revoke active sessions.");
}

function generateTotp(secret, timestamp = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.replace(/=+$/g, "").toUpperCase()) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  const counter = Math.floor(timestamp / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return {
    status: response.status,
    headers: response.headers,
    data: await response.json().catch(() => ({}))
  };
}

function cookieFrom(response) {
  return String(response.headers.get("set-cookie") || "").split(";")[0];
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
  throw new Error(`Auth test server did not start. Logs: ${logs}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
