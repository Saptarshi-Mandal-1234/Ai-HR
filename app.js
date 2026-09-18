const state = {
  mode: "generalist",
  busy: false
};

const modeButtons = document.querySelectorAll(".mode-button");
const quickButtons = document.querySelectorAll(".quick-actions button");
const promptInput = document.querySelector("#prompt");
const contextInput = document.querySelector("#companyContext");
const desiredOutput = document.querySelector("#desiredOutput");
const riskLevel = document.querySelector("#riskLevel");
const runButton = document.querySelector("#runButton");
const clearButton = document.querySelector("#clearButton");
const copyButton = document.querySelector("#copyButton");
const output = document.querySelector("#output");
const statusPill = document.querySelector("#statusPill");
const authToken = document.querySelector("#authToken");
const recordsMetric = document.querySelector("#recordsMetric");
const decisionsMetric = document.querySelector("#decisionsMetric");
const approvalsMetric = document.querySelector("#approvalsMetric");
const criticalMetric = document.querySelector("#criticalMetric");
const recordType = document.querySelector("#recordType");
const recordName = document.querySelector("#recordName");
const recordDetails = document.querySelector("#recordDetails");
const saveRecordButton = document.querySelector("#saveRecordButton");
const decisionType = document.querySelector("#decisionType");
const decisionSubject = document.querySelector("#decisionSubject");
const decisionFacts = document.querySelector("#decisionFacts");
const decisionAction = document.querySelector("#decisionAction");
const createDecisionButton = document.querySelector("#createDecisionButton");
const decisionQueue = document.querySelector("#decisionQueue");
const auditLog = document.querySelector("#auditLog");
const refreshButton = document.querySelector("#refreshButton");

authToken.value = localStorage.getItem("aihr_token") || "";
authToken.addEventListener("input", () => {
  localStorage.setItem("aihr_token", authToken.value.trim());
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));
  });
});

quickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.template;
    promptInput.focus();
  });
});

runButton.addEventListener("click", generateHrWork);
saveRecordButton.addEventListener("click", saveRecord);
createDecisionButton.addEventListener("click", createDecisionBrief);
refreshButton.addEventListener("click", refreshOperations);

clearButton.addEventListener("click", () => {
  promptInput.value = "";
  contextInput.value = "";
  output.textContent = "Choose a specialty, describe the HR task, and generate a working draft.";
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(output.textContent);
  copyButton.textContent = "Copied";
  setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1200);
});

checkHealth();
refreshOperations();

async function checkHealth() {
  try {
    const response = await apiFetch("/api/health");
    const data = await response.json();
    statusPill.textContent = data.hasGeminiKey ? `Ready: ${data.model}` : "Add Gemini key";
    statusPill.classList.toggle("ready", data.hasGeminiKey);
    statusPill.classList.toggle("missing", !data.hasGeminiKey);
  } catch {
    statusPill.textContent = "Server offline";
    statusPill.classList.add("missing");
  }
}

async function refreshOperations() {
  try {
    await Promise.all([loadOrgSummary(), loadDecisions(), loadAudit()]);
  } catch (error) {
    output.textContent = error.message;
  }
}

async function loadOrgSummary() {
  const response = await apiFetch("/api/org");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load organization summary.");
  recordsMetric.textContent = data.records;
  decisionsMetric.textContent = data.decisions;
  approvalsMetric.textContent = data.pendingApprovals;
  criticalMetric.textContent = data.critical;
}

async function loadDecisions() {
  const response = await apiFetch("/api/decisions");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load decisions.");
  if (!data.decisions.length) {
    decisionQueue.innerHTML = `<p class="meta-line">No decision briefs yet.</p>`;
    return;
  }

  decisionQueue.innerHTML = data.decisions
    .slice()
    .reverse()
    .map((decision) => {
      const risk = escapeHtml(decision.risk?.level || "unknown");
      const flags = decision.risk?.flags?.length ? decision.risk.flags.join(", ") : "no flags";
      const approveButton = decision.status === "needs_review"
        ? `<button class="ghost-button approve-button" data-id="${decision.id}">Mark reviewed</button>`
        : "";
      return `
        <article class="list-item">
          <span class="risk-badge ${risk}">${risk}</span>
          <h4>${escapeHtml(decision.subject)}</h4>
          <p>${escapeHtml(decision.proposedAction)}</p>
          <span class="meta-line">${escapeHtml(decision.status)} | ${escapeHtml(flags)}</span>
          ${approveButton}
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".approve-button").forEach((button) => {
    button.addEventListener("click", () => approveDecision(button.dataset.id));
  });
}

async function loadAudit() {
  const response = await apiFetch("/api/audit");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load audit log.");
  if (!data.audit.length) {
    auditLog.innerHTML = `<p class="meta-line">No audit events yet.</p>`;
    return;
  }

  auditLog.innerHTML = data.audit
    .slice(0, 20)
    .map((event) => `
      <article class="list-item">
        <h4>${escapeHtml(event.action)}</h4>
        <span class="meta-line">${escapeHtml(new Date(event.createdAt).toLocaleString())}</span>
      </article>
    `)
    .join("");
}

async function saveRecord() {
  const name = recordName.value.trim();
  if (!name) {
    output.textContent = "Add a record name first.";
    recordName.focus();
    return;
  }

  saveRecordButton.disabled = true;
  try {
    const response = await apiFetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: recordType.value,
        name,
        details: recordDetails.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save record.");

    output.textContent = `Saved ${data.record.type} record: ${data.record.name}`;
    recordName.value = "";
    recordDetails.value = "";
    await refreshOperations();
  } catch (error) {
    output.textContent = error.message;
  } finally {
    saveRecordButton.disabled = false;
  }
}

async function createDecisionBrief() {
  if (!decisionSubject.value.trim() || !decisionFacts.value.trim() || !decisionAction.value.trim()) {
    output.textContent = "Add subject, facts, and proposed action for the decision brief.";
    return;
  }

  createDecisionButton.disabled = true;
  createDecisionButton.textContent = "Creating brief...";
  output.textContent = "Classifying risk and preparing the decision brief...";

  try {
    const response = await apiFetch("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionType: decisionType.value,
        subject: decisionSubject.value,
        facts: decisionFacts.value,
        proposedAction: decisionAction.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create decision brief.");

    const approvalLine = data.decision.risk.requiresHumanApproval
      ? "Status: needs human review before action."
      : "Status: approved for low-risk action after user confirmation.";
    output.textContent = `${approvalLine}\n\n${data.decision.brief}`;
    await refreshOperations();
  } catch (error) {
    output.textContent = error.message;
  } finally {
    createDecisionButton.disabled = false;
    createDecisionButton.textContent = "Create decision brief";
  }
}

async function approveDecision(id) {
  const response = await apiFetch(`/api/decisions/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reviewer: "Local HR reviewer",
      note: "Reviewed from AI HR workspace."
    })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not approve decision.";
    return;
  }

  output.textContent = `Decision reviewed: ${data.decision.subject}`;
  await refreshOperations();
}

async function generateHrWork() {
  if (state.busy) return;

  const prompt = promptInput.value.trim();
  if (!prompt) {
    output.textContent = "Add an HR request first.";
    promptInput.focus();
    return;
  }

  setBusy(true);
  output.textContent = "Working through the HR request...";

  try {
    const response = await apiFetch("/api/hr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: state.mode,
        prompt,
        companyContext: contextInput.value,
        desiredOutput: desiredOutput.value,
        riskLevel: riskLevel.value
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "The HR request failed.");
    }

    output.textContent = data.result;
  } catch (error) {
    output.textContent = error.message;
  } finally {
    setBusy(false);
    checkHealth();
    refreshOperations();
  }
}

function setBusy(busy) {
  state.busy = busy;
  runButton.disabled = busy;
  runButton.textContent = busy ? "Generating..." : "Generate HR work";
}

function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = authToken.value.trim();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
