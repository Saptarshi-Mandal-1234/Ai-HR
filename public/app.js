const passwordRules = [
  { label: "At least 12 characters", check: (value) => value.length >= 12 },
  { label: "One uppercase letter", check: (value) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", check: (value) => /[a-z]/.test(value) },
  { label: "One number", check: (value) => /\d/.test(value) }
];

const state = {
  mode: "home",
  busy: false,
  editingRecordId: null,
  user: null,
  authRequired: false,
  mfaChallengeToken: "",
  performanceReviews: [],
  peopleEvents: [],
  onboardingPacks: [],
  selectedEmployeeId: null
};

const modeProfiles = {
  home: { label: "Home" },
  employees: { label: "Employees" },
  onboarding: { label: "Onboarding", placeholder: "Describe the new hire, role, location, and ramp-up goal..." },
  reviews: { label: "Reviews" },
  generalist: { label: "Ask AI HR", placeholder: "Describe the HR situation or operating task..." },
  settings: { label: "Settings" }
};

const modeButtons = document.querySelectorAll(".mode-button");
const activeModeTitle = document.querySelector("#activeModeTitle");
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
const recordImportFile = document.querySelector("#recordImportFile");
const importRecordsButton = document.querySelector("#importRecordsButton");
const downloadTemplateButton = document.querySelector("#downloadTemplateButton");
const importResult = document.querySelector("#importResult");
const decisionType = document.querySelector("#decisionType");
const decisionSubject = document.querySelector("#decisionSubject");
const decisionFacts = document.querySelector("#decisionFacts");
const decisionAction = document.querySelector("#decisionAction");
const createDecisionButton = document.querySelector("#createDecisionButton");
const decisionQueue = document.querySelector("#decisionQueue");
const auditLog = document.querySelector("#auditLog");
const refreshButton = document.querySelector("#refreshButton");
const authIdentity = document.querySelector("#authIdentity");
const authFields = document.querySelector("#authFields");
const organizationField = document.querySelector("#organizationField");
const organizationName = document.querySelector("#organizationName");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authPasswordGuidance = document.querySelector("#authPasswordGuidance");
const termsConsent = document.querySelector("#termsConsent");
const acceptTerms = document.querySelector("#acceptTerms");
const loginButton = document.querySelector("#loginButton");
const bootstrapButton = document.querySelector("#bootstrapButton");
const logoutButton = document.querySelector("#logoutButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const recordSearch = document.querySelector("#recordSearch");
const recordFilter = document.querySelector("#recordFilter");
const recordsList = document.querySelector("#recordsList");
const adminTools = document.querySelector("#adminTools");
const newUserEmail = document.querySelector("#newUserEmail");
const newUserRole = document.querySelector("#newUserRole");
const newUserPassword = document.querySelector("#newUserPassword");
const newUserPasswordGuidance = document.querySelector("#newUserPasswordGuidance");
const newUserStatus = document.querySelector("#newUserStatus");
const createUserButton = document.querySelector("#createUserButton");
const usersList = document.querySelector("#usersList");
const exportDataButton = document.querySelector("#exportDataButton");
const retentionDays = document.querySelector("#retentionDays");
const purgeDataButton = document.querySelector("#purgeDataButton");
const acceptInvitationButton = document.querySelector("#acceptInvitationButton");
const passwordTools = document.querySelector("#passwordTools");
const currentPassword = document.querySelector("#currentPassword");
const newPassword = document.querySelector("#newPassword");
const newPasswordGuidance = document.querySelector("#newPasswordGuidance");
const accountSecurityStatus = document.querySelector("#accountSecurityStatus");
const changePasswordButton = document.querySelector("#changePasswordButton");
const includeDeletedRecords = document.querySelector("#includeDeletedRecords");
const invitationEmail = document.querySelector("#invitationEmail");
const invitationRole = document.querySelector("#invitationRole");
const createInvitationButton = document.querySelector("#createInvitationButton");
const invitationLink = document.querySelector("#invitationLink");
const invitationsList = document.querySelector("#invitationsList");
const opsMetrics = document.querySelector("#opsMetrics");
const mfaChallenge = document.querySelector("#mfaChallenge");
const mfaChallengeCode = document.querySelector("#mfaChallengeCode");
const verifyMfaButton = document.querySelector("#verifyMfaButton");
const mfaStatus = document.querySelector("#mfaStatus");
const setupMfaButton = document.querySelector("#setupMfaButton");
const mfaSetupPanel = document.querySelector("#mfaSetupPanel");
const mfaSetupSecret = document.querySelector("#mfaSetupSecret");
const mfaSetupCode = document.querySelector("#mfaSetupCode");
const confirmMfaButton = document.querySelector("#confirmMfaButton");
const mfaDisablePanel = document.querySelector("#mfaDisablePanel");
const mfaDisablePassword = document.querySelector("#mfaDisablePassword");
const mfaDisableCode = document.querySelector("#mfaDisableCode");
const disableMfaButton = document.querySelector("#disableMfaButton");
const invitationToken = new URLSearchParams(window.location.search).get("invitation") || "";
const analyticsDimension = document.querySelector("#analyticsDimension");
const analyticsSummary = document.querySelector("#analyticsSummary");
const analyticsChart = document.querySelector("#analyticsChart");
const analyticsProvenance = document.querySelector("#analyticsProvenance");
const outputEvidence = document.querySelector("#outputEvidence");
const knowledgeTitle = document.querySelector("#knowledgeTitle");
const knowledgeFile = document.querySelector("#knowledgeFile");
const uploadKnowledgeButton = document.querySelector("#uploadKnowledgeButton");
const knowledgeList = document.querySelector("#knowledgeList");
const readinessChecklist = document.querySelector("#readinessChecklist");
const integrationStatusPanel = document.querySelector("#integrationStatus");
const workflowName = document.querySelector("#workflowName");
const workflowIntegration = document.querySelector("#workflowIntegration");
const workflowRunAt = document.querySelector("#workflowRunAt");
const workflowMessage = document.querySelector("#workflowMessage");
const scheduleWorkflowButton = document.querySelector("#scheduleWorkflowButton");
const scheduledWorkflows = document.querySelector("#scheduledWorkflows");
const analyticsPanel = document.querySelector("#analyticsPanel");
const composerOptions = document.querySelector("#composerOptions");
const companyContextField = document.querySelector("#companyContextField");
const knowledgePanel = document.querySelector("#knowledgePanel");
const decisionQueuePanel = document.querySelector("#decisionQueuePanel");
const auditLogPanel = document.querySelector("#auditLogPanel");
const serviceAccess = document.querySelector("#serviceAccess");
const workspace = document.querySelector(".workspace");
const performancePanel = document.querySelector("#performancePanel");
const performanceForm = document.querySelector("#performanceForm");
const performanceEmployeeName = document.querySelector("#performanceEmployeeName");
const performancePeriod = document.querySelector("#performancePeriod");
const performanceOutcome = document.querySelector("#performanceOutcome");
const performanceStatus = document.querySelector("#performanceStatus");
const performanceGoals = document.querySelector("#performanceGoals");
const performanceEvidence = document.querySelector("#performanceEvidence");
const performanceSupport = document.querySelector("#performanceSupport");
const performanceNextReview = document.querySelector("#performanceNextReview");
const savePerformanceButton = document.querySelector("#savePerformanceButton");
const performanceSummary = document.querySelector("#performanceSummary");
const performanceList = document.querySelector("#performanceList");
const performanceWins = document.querySelector("#performanceWins");
const performanceConcerns = document.querySelector("#performanceConcerns");
const onboardingPanel = document.querySelector("#onboardingPanel");
const onboardingName = document.querySelector("#onboardingName");
const onboardingRole = document.querySelector("#onboardingRole");
const onboardingTeam = document.querySelector("#onboardingTeam");
const onboardingSetup = document.querySelector("#onboardingSetup");
const onboardingResponsibilities = document.querySelector("#onboardingResponsibilities");
const onboardingDailyNeeds = document.querySelector("#onboardingDailyNeeds");
const generateOnboardingButton = document.querySelector("#generateOnboardingButton");
const peopleEventsPanel = document.querySelector("#peopleEventsPanel");
const peopleEventForm = document.querySelector("#peopleEventForm");
const peopleEventEmployee = document.querySelector("#peopleEventEmployee");
const peopleEventType = document.querySelector("#peopleEventType");
const peopleEventDate = document.querySelector("#peopleEventDate");
const peopleEventSource = document.querySelector("#peopleEventSource");
const peopleEventSummary = document.querySelector("#peopleEventSummary");
const savePeopleEventButton = document.querySelector("#savePeopleEventButton");
const peopleEventSummaryPanel = document.querySelector("#peopleEventSummaryPanel");
const peopleEmployeeList = document.querySelector("#peopleEmployeeList");
const peopleEventList = document.querySelector("#peopleEventList");
const metricsPanel = document.querySelector("#metricsPanel");
const quickActions = document.querySelector("#quickActions");
const composerPanel = document.querySelector("#composerPanel");
const recordsPanel = document.querySelector("#recordsPanel");
const decisionPanel = document.querySelector("#decisionPanel");
const reviewGrid = document.querySelector("#reviewGrid");
const dataImportPanel = document.querySelector("#dataImportPanel");
const datasetStoredSummary = document.querySelector("#datasetStoredSummary");
const datasetPreview = document.querySelector("#datasetPreview");
const datasetSearch = document.querySelector("#datasetSearch");
const datasetEmployeeSample = document.querySelector("#datasetEmployeeSample");
const generalistPanel = document.querySelector("#generalistPanel");
const generalistRequest = document.querySelector("#generalistRequest");
const generalistContext = document.querySelector("#generalistContext");
const generateGeneralistButton = document.querySelector("#generateGeneralistButton");
const homePanel = document.querySelector("#homePanel");
const employeesPanel = document.querySelector("#employeesPanel");
const homeSummary = document.querySelector("#homeSummary");
const activeDatasetBadge = document.querySelector("#activeDatasetBadge");
const recentActivity = document.querySelector("#recentActivity");
const useDemoDataButton = document.querySelector("#useDemoDataButton");
const uploadCompanyDataButton = document.querySelector("#uploadCompanyDataButton");
const employeeDirectorySearch = document.querySelector("#employeeDirectorySearch");
const employeeDirectoryList = document.querySelector("#employeeDirectoryList");
const employeeProfile = document.querySelector("#employeeProfile");
const employeeOptions = document.querySelector("#employeeOptions");
const onboardingList = document.querySelector("#onboardingList");
const outputPanel = document.querySelector("#outputPanel");

authToken.value = sessionStorage.getItem("aihr_token") || "";
authToken.addEventListener("input", () => {
  sessionStorage.setItem("aihr_token", authToken.value.trim());
  initializeAccess();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectMode(button.dataset.mode);
  });
});

function selectMode(mode) {
  const profile = modeProfiles[mode] || modeProfiles.home;
  state.mode = mode;
  activeModeTitle.textContent = profile.label || "AI HR";
  if (profile.placeholder) promptInput.placeholder = profile.placeholder;
  modeButtons.forEach((item) => {
    const selected = item.dataset.mode === mode;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  applyViewMode();
  if (mode === "employees") employeeDirectorySearch.focus({ preventScroll: true });
}

function applyViewMode() {
  workspace.classList.add("simple-view");
  const role = state.user?.role || "admin";
  const hasAccess = Boolean(state.user || !state.authRequired || authToken.value.trim());
  const canReview = ["admin", "hr_manager", "auditor"].includes(role);
  const settingsAllowed = ["admin", "auditor"].includes(role);
  modeButtons.forEach((button) => { button.disabled = !hasAccess; });
  document.querySelector(".settings-mode").hidden = !hasAccess || !settingsAllowed;
  composerOptions.hidden = true;
  companyContextField.hidden = true;
  metricsPanel.hidden = true;
  quickActions.hidden = true;
  composerPanel.hidden = true;
  homePanel.hidden = !hasAccess || state.mode !== "home";
  employeesPanel.hidden = !hasAccess || state.mode !== "employees" || !canReview;
  generalistPanel.hidden = !hasAccess || state.mode !== "generalist";
  onboardingPanel.hidden = !hasAccess || state.mode !== "onboarding";
  analyticsPanel.hidden = !hasAccess || state.mode !== "home" || !canReview;
  performancePanel.hidden = !hasAccess || state.mode !== "reviews" || !canReview;
  peopleEventsPanel.hidden = !hasAccess || state.mode !== "reviews" || !canReview;
  dataImportPanel.hidden = !hasAccess || state.mode !== "employees" || !canReview;
  recordsPanel.hidden = !hasAccess || state.mode !== "settings";
  decisionPanel.hidden = !hasAccess || state.mode !== "reviews";
  decisionQueuePanel.hidden = !hasAccess || state.mode !== "reviews";
  auditLogPanel.hidden = !hasAccess || state.mode !== "settings";
  reviewGrid.hidden = !hasAccess || !["reviews", "settings"].includes(state.mode);
  knowledgePanel.hidden = !hasAccess || state.mode !== "settings";
  serviceAccess.hidden = !hasAccess || state.mode !== "settings";
  adminTools.hidden = !hasAccess || state.mode !== "settings" || role !== "admin";
  outputPanel.hidden = !hasAccess || ["home", "settings"].includes(state.mode);
}

quickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.template;
    promptInput.focus();
  });
});

runButton.addEventListener("click", generateHrWork);
saveRecordButton.addEventListener("click", saveRecord);
importRecordsButton.addEventListener("click", importRecords);
downloadTemplateButton.addEventListener("click", downloadCsvTemplate);
recordImportFile.addEventListener("change", previewDataset);
datasetSearch.addEventListener("input", debounce(loadDatasetSample, 250));
createDecisionButton.addEventListener("click", createDecisionBrief);
refreshButton.addEventListener("click", refreshOperations);
loginButton.addEventListener("click", login);
bootstrapButton.addEventListener("click", bootstrapWorkspace);
logoutButton.addEventListener("click", logout);
cancelEditButton.addEventListener("click", resetRecordForm);
recordSearch.addEventListener("input", debounce(loadRecords, 250));
recordFilter.addEventListener("change", loadRecords);
createUserButton.addEventListener("click", createUser);
exportDataButton.addEventListener("click", exportOrganizationData);
purgeDataButton.addEventListener("click", purgeDeletedRecords);
acceptInvitationButton.addEventListener("click", acceptInvitation);
changePasswordButton.addEventListener("click", changePassword);
includeDeletedRecords.addEventListener("change", loadRecords);
createInvitationButton.addEventListener("click", createInvitation);
verifyMfaButton.addEventListener("click", verifyMfa);
setupMfaButton.addEventListener("click", setupMfa);
confirmMfaButton.addEventListener("click", confirmMfa);
disableMfaButton.addEventListener("click", disableMfa);
analyticsDimension.addEventListener("change", loadAnalytics);
uploadKnowledgeButton.addEventListener("click", uploadKnowledge);
scheduleWorkflowButton.addEventListener("click", scheduleWorkflow);
savePerformanceButton.addEventListener("click", savePerformanceReview);
generateOnboardingButton.addEventListener("click", generateOnboardingPack);
savePeopleEventButton.addEventListener("click", savePeopleEvent);
generateGeneralistButton.addEventListener("click", generateGeneralistGuidance);
useDemoDataButton.addEventListener("click", loadDemoData);
uploadCompanyDataButton.addEventListener("click", openDatasetManager);
employeeDirectorySearch.addEventListener("input", debounce(loadEmployeeDirectory, 250));
authPassword.addEventListener("input", () => {
  authPassword.removeAttribute("aria-invalid");
  if (!authPasswordGuidance.hidden) renderPasswordGuidance(authPasswordGuidance, authPassword);
  if (authIdentity.classList.contains("auth-error")) {
    authIdentity.classList.remove("auth-error");
    authIdentity.textContent = "Sign in required";
  }
});
newPassword.addEventListener("input", () => {
  renderPasswordGuidance(newPasswordGuidance, newPassword);
  accountSecurityStatus.hidden = true;
});
currentPassword.addEventListener("input", () => {
  currentPassword.removeAttribute("aria-invalid");
  accountSecurityStatus.hidden = true;
});
newUserPassword.addEventListener("input", () => {
  renderPasswordGuidance(newUserPasswordGuidance, newUserPassword);
  newUserStatus.hidden = true;
});

clearButton.addEventListener("click", () => {
  promptInput.value = "";
  contextInput.value = "";
  output.textContent = "Choose a workspace to begin.";
  outputEvidence.hidden = true;
  outputEvidence.innerHTML = "";
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(output.textContent);
  copyButton.textContent = "Copied";
  setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1200);
});

applyViewMode();
renderPasswordGuidance(newPasswordGuidance, newPassword);
renderPasswordGuidance(newUserPasswordGuidance, newUserPassword);
initializeAccess();

async function initializeAccess() {
  await checkHealth();
  try {
    const response = await apiFetch("/api/auth/me");
    const data = await response.json();
    state.user = data.authenticated ? data.user : null;
    state.authRequired = Boolean(data.authRequired);
    renderAuthentication(data);
    if (data.authenticated || !data.authRequired || authToken.value.trim()) await refreshOperations();
  } catch {
    authIdentity.textContent = "Server offline";
  }
}

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

function renderAuthentication(data) {
  authIdentity.classList.remove("auth-error");
  const usingServiceToken = Boolean(authToken.value.trim());
  const acceptingInvitation = Boolean(invitationToken && !data.authenticated);
  const verifyingMfa = Boolean(state.mfaChallengeToken && !data.authenticated);
  const creatingPassword = acceptingInvitation || Boolean(data.canBootstrap);
  authFields.hidden = !acceptingInvitation && !verifyingMfa && (data.authenticated || usingServiceToken || !data.authRequired);
  logoutButton.hidden = !data.authenticated;
  passwordTools.hidden = data.user?.mode !== "session";
  bootstrapButton.hidden = acceptingInvitation || verifyingMfa || !data.canBootstrap;
  organizationField.hidden = acceptingInvitation || verifyingMfa || !data.canBootstrap;
  authEmail.closest("label").hidden = acceptingInvitation || verifyingMfa;
  authPassword.closest("label").hidden = verifyingMfa;
  authPassword.autocomplete = creatingPassword ? "new-password" : "current-password";
  authPasswordGuidance.hidden = verifyingMfa || !creatingPassword;
  if (!authPasswordGuidance.hidden) renderPasswordGuidance(authPasswordGuidance, authPassword);
  loginButton.hidden = acceptingInvitation || verifyingMfa || Boolean(data.canBootstrap);
  acceptInvitationButton.hidden = !acceptingInvitation;
  mfaChallenge.hidden = !verifyingMfa;
  termsConsent.hidden = verifyingMfa || (!acceptingInvitation && !data.canBootstrap);
  adminTools.hidden = state.user?.role !== "admin" || state.mode !== "settings";
  const mfaEnabled = Boolean(data.user?.mfaEnabled);
  mfaStatus.textContent = mfaEnabled ? "Authenticator protection is on." : "Authenticator protection is off.";
  setupMfaButton.hidden = mfaEnabled;
  mfaDisablePanel.hidden = !mfaEnabled;
  const canManageKnowledge = ["admin", "hr_manager"].includes(data.user?.role);
  knowledgeTitle.disabled = !canManageKnowledge;
  knowledgeFile.disabled = !canManageKnowledge;
  uploadKnowledgeButton.hidden = !canManageKnowledge;
  performanceForm.hidden = data.user?.role === "auditor";
  peopleEventForm.hidden = data.user?.role === "auditor";
  const canImportData = ["admin", "hr_manager"].includes(data.user?.role);
  recordImportFile.disabled = !canImportData;
  importRecordsButton.disabled = !canImportData;
  downloadTemplateButton.disabled = !canImportData;
  if (!canImportData) {
    importResult.textContent = data.authenticated
      ? "This account has read-only dataset access. An administrator or HR manager can import files."
      : "Sign in to view stored employees or import a dataset.";
  }
  applyViewMode();

  if (verifyingMfa) {
    authIdentity.textContent = "Enter your authenticator code";
  } else if (acceptingInvitation) {
    authIdentity.textContent = "Set a password to accept invitation";
  } else if (data.authenticated) {
    authIdentity.textContent = `${data.user.email || data.organization?.name || "Development workspace"} | ${data.user.role}`;
  } else if (usingServiceToken) {
    authIdentity.textContent = "Service-token access";
  } else if (data.canBootstrap) {
    authIdentity.textContent = "Create the first administrator";
  } else if (data.authRequired) {
    authIdentity.textContent = "Sign in required";
  } else {
    authIdentity.textContent = "Local development access";
  }
}

async function acceptInvitation() {
  if (!isValidPassword(authPassword.value)) {
    renderPasswordGuidance(authPasswordGuidance, authPassword);
    authIdentity.textContent = "Create a password that meets every requirement.";
    authIdentity.classList.add("auth-error");
    return;
  }
  const response = await fetch("/api/auth/accept-invitation", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: invitationToken, password: authPassword.value, acceptTerms: acceptTerms.checked })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not accept invitation.";
    authIdentity.textContent = data.error || "Could not accept invitation.";
    authIdentity.classList.add("auth-error");
    return;
  }
  window.history.replaceState({}, "", window.location.pathname);
  authPassword.value = "";
  output.textContent = "Invitation accepted.";
  await initializeAccess();
}

async function changePassword() {
  renderPasswordGuidance(newPasswordGuidance, newPassword);
  if (!currentPassword.value) {
    setFormStatus(accountSecurityStatus, "Enter your current password.", "error");
    return;
  }
  if (!isValidPassword(newPassword.value)) {
    setFormStatus(accountSecurityStatus, "Your new password does not meet every requirement yet.", "error");
    return;
  }
  changePasswordButton.disabled = true;
  setFormStatus(accountSecurityStatus, "Updating password...", "neutral");
  try {
    const response = await apiFetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not change password.");
    currentPassword.value = "";
    newPassword.value = "";
    renderPasswordGuidance(newPasswordGuidance, newPassword);
    output.textContent = "Password changed and other sessions were signed out.";
    setFormStatus(accountSecurityStatus, "Password updated. Other sessions were signed out.", "success");
    await initializeAccess();
    passwordTools.open = true;
  } catch (error) {
    output.textContent = error.message;
    currentPassword.setAttribute("aria-invalid", "true");
    setFormStatus(accountSecurityStatus, error.message, "error");
  } finally {
    changePasswordButton.disabled = false;
  }
}

function isValidPassword(value) {
  return passwordRules.every((rule) => rule.check(String(value || "")));
}

function renderPasswordGuidance(container, input) {
  const value = input.value || "";
  const hasValue = value.length > 0;
  const valid = isValidPassword(value);
  container.classList.toggle("valid", valid);
  container.classList.toggle("invalid", hasValue && !valid);
  container.innerHTML = `
    <p>${valid ? "Password meets all requirements." : "Password must include:"}</p>
    <ul>${passwordRules.map((rule) => {
      const met = rule.check(value);
      return `<li class="${met ? "met" : hasValue ? "unmet" : "pending"}">${rule.label}</li>`;
    }).join("")}</ul>
  `;
  if (hasValue && !valid) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  return valid;
}

function setFormStatus(element, message, tone) {
  element.textContent = message;
  element.hidden = false;
  element.className = `form-status ${tone}`;
}

async function login() {
  await submitAuthentication("/api/auth/login", {
    email: authEmail.value,
    password: authPassword.value
  });
}

async function bootstrapWorkspace() {
  await submitAuthentication("/api/auth/bootstrap", {
    organizationName: organizationName.value,
    email: authEmail.value,
    password: authPassword.value,
    acceptTerms: acceptTerms.checked
  });
}

async function submitAuthentication(path, body) {
  if (path.endsWith("bootstrap") && !isValidPassword(authPassword.value)) {
    renderPasswordGuidance(authPasswordGuidance, authPassword);
    authIdentity.textContent = "Create a password that meets every requirement.";
    authIdentity.classList.add("auth-error");
    return;
  }
  loginButton.disabled = true;
  bootstrapButton.disabled = true;
  authIdentity.classList.remove("auth-error");
  authIdentity.textContent = path.endsWith("bootstrap") ? "Creating workspace..." : "Signing in...";
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Authentication failed.");
    authPassword.removeAttribute("aria-invalid");
    if (data.mfaRequired) {
      state.mfaChallengeToken = data.challengeToken;
      authPassword.value = "";
      output.textContent = "Password confirmed. Enter your authenticator code.";
      await initializeAccess();
      mfaChallengeCode.focus();
      return;
    }
    authPassword.value = "";
    output.textContent = "Access confirmed.";
    await initializeAccess();
  } catch (error) {
    output.textContent = error.message;
    authIdentity.textContent = error.message;
    authIdentity.classList.add("auth-error");
    if (path.endsWith("login")) authPassword.setAttribute("aria-invalid", "true");
  } finally {
    loginButton.disabled = false;
    bootstrapButton.disabled = false;
  }
}

async function verifyMfa() {
  verifyMfaButton.disabled = true;
  authIdentity.classList.remove("auth-error");
  authIdentity.textContent = "Checking authenticator code...";
  try {
    const response = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken: state.mfaChallengeToken, code: mfaChallengeCode.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not verify authenticator code.");
    state.mfaChallengeToken = "";
    mfaChallengeCode.value = "";
    output.textContent = "Access confirmed.";
    await initializeAccess();
  } catch (error) {
    output.textContent = error.message;
    authIdentity.textContent = error.message;
    authIdentity.classList.add("auth-error");
  } finally {
    verifyMfaButton.disabled = false;
  }
}

async function setupMfa() {
  const response = await apiFetch("/api/auth/mfa/setup", { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not start MFA setup.";
    return;
  }
  mfaSetupSecret.value = data.secret;
  mfaSetupPanel.hidden = false;
  output.textContent = "Add the setup key to your authenticator app, then enter its six-digit code.";
  mfaSetupCode.focus();
}

async function confirmMfa() {
  const response = await apiFetch("/api/auth/mfa/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: mfaSetupCode.value })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not enable MFA.";
    return;
  }
  mfaSetupPanel.hidden = true;
  mfaSetupCode.value = "";
  mfaSetupSecret.value = "";
  output.textContent = "Authenticator protection enabled.";
  await initializeAccess();
}

async function disableMfa() {
  const response = await apiFetch("/api/auth/mfa/disable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: mfaDisablePassword.value, code: mfaDisableCode.value })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not disable MFA.";
    return;
  }
  mfaDisablePassword.value = "";
  mfaDisableCode.value = "";
  output.textContent = "Authenticator protection disabled.";
  await initializeAccess();
}

async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.mfaChallengeToken = "";
  output.textContent = "Signed out.";
  await initializeAccess();
}

async function refreshOperations() {
  try {
    const role = state.user?.role || "admin";
    const tasks = [];
    if (["admin", "hr_manager", "auditor"].includes(role)) {
      tasks.push(
        loadDashboard(), loadOrgSummary(), loadDecisions(), loadRecords(), loadAnalytics(), loadKnowledge(),
        loadDatasetSample(), loadEmployeeDirectory(), loadEmployeeOptions(), loadOnboardingPacks(), loadPerformance(), loadPeopleEvents()
      );
    }
    if (["admin", "auditor"].includes(role)) tasks.push(loadAudit());
    if (role === "admin") tasks.push(loadUsers(), loadInvitations(), loadMetrics(), loadReadiness(), loadIntegrations(), loadScheduledWorkflows());
    await Promise.all(tasks);
  } catch (error) {
    output.textContent = error.message;
  }
}

async function loadDashboard() {
  const response = await apiFetch("/api/dashboard");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load the HR overview.");
  homeSummary.innerHTML = `
    <div><strong>${data.summary.employees.toLocaleString()}</strong><span>Employees</span></div>
    <div><strong>${data.summary.openReviews.toLocaleString()}</strong><span>Open reviews</span></div>
    <div><strong>${data.summary.pendingOnboarding.toLocaleString()}</strong><span>Pending onboarding</span></div>
    <div><strong>${data.summary.complaintsForReview.toLocaleString()}</strong><span>Complaints to review</span></div>
  `;
  activeDatasetBadge.textContent = `${data.dataset.label} | ${data.dataset.employeeCount.toLocaleString()} employees`;
  activeDatasetBadge.classList.toggle("demo", data.dataset.isDemo);
  useDemoDataButton.textContent = data.dataset.demoRows ? "Demo data active" : "Use demo data";
  useDemoDataButton.disabled = data.dataset.demoRows > 0;
  recentActivity.innerHTML = data.recentActivity.map((event) => `
    <div class="activity-item">
      <span class="activity-mark" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(activityLabel(event.action))}</strong>
        <span>${escapeHtml(event.actor || "system")} | ${escapeHtml(new Date(event.createdAt).toLocaleString())}</span>
      </div>
    </div>
  `).join("") || `<div class="empty-state"><p>No activity has been recorded yet.</p></div>`;
}

function activityLabel(action) {
  const labels = {
    records_imported: "Employee dataset imported",
    demo_dataset_loaded: "Demo dataset loaded",
    performance_review_created: "Performance review added",
    performance_review_updated: "Performance review updated",
    employee_event_created: "Employee timeline updated",
    employee_event_updated: "Employee complaint reviewed",
    onboarding_pack_created: "Onboarding pack created",
    onboarding_pack_updated: "Onboarding status updated",
    decision_created: "HR recommendation prepared",
    decision_reviewed: "Recommendation reviewed",
    user_logged_in: "Workspace sign-in"
  };
  return labels[action] || readablePerformanceValue(action);
}

async function loadDemoData() {
  useDemoDataButton.disabled = true;
  useDemoDataButton.textContent = "Loading demo data...";
  try {
    const response = await apiFetch("/api/demo/load", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load demo data.");
    output.textContent = data.alreadyLoaded
      ? "The IBM fictional employee benchmark is already active."
      : `Loaded ${data.importedCount.toLocaleString()} fictional employee records for the demo.`;
    await refreshOperations();
  } catch (error) {
    output.textContent = error.message;
    useDemoDataButton.disabled = false;
    useDemoDataButton.textContent = "Use demo data";
  }
}

function openDatasetManager() {
  selectMode("employees");
  requestAnimationFrame(() => recordImportFile.scrollIntoView({ behavior: "smooth", block: "center" }));
}

async function loadEmployeeDirectory() {
  const params = new URLSearchParams({ type: "employee", limit: "50" });
  if (employeeDirectorySearch.value.trim()) params.set("q", employeeDirectorySearch.value.trim());
  const response = await apiFetch(`/api/records?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load employee directory.");
  employeeDirectoryList.innerHTML = `
    <p class="directory-count">${data.total.toLocaleString()} employee${data.total === 1 ? "" : "s"}</p>
    ${data.records.map((employee) => `
      <button type="button" class="employee-row ${state.selectedEmployeeId === employee.id ? "active" : ""}" data-id="${employee.id}">
        <span class="employee-avatar">${escapeHtml(initials(employee.name))}</span>
        <span><strong>${escapeHtml(employee.name)}</strong><small>${escapeHtml(employeeSubtitle(employee))}</small></span>
      </button>
    `).join("")}
  `;
  document.querySelectorAll(".employee-row").forEach((button) => {
    button.addEventListener("click", () => loadEmployeeProfile(button.dataset.id));
  });
}

async function loadEmployeeOptions() {
  const firstResponse = await apiFetch("/api/records?type=employee&limit=500&offset=0");
  const first = await firstResponse.json();
  if (!firstResponse.ok) throw new Error(first.error || "Could not load employee choices.");
  const requests = [];
  for (let offset = 500; offset < first.total; offset += 500) {
    requests.push(apiFetch(`/api/records?type=employee&limit=500&offset=${offset}`).then((response) => response.json()));
  }
  const pages = await Promise.all(requests);
  const employees = [first.records, ...pages.map((page) => page.records || [])].flat();
  const names = [...new Set(employees.map((employee) => employee.name))].sort((left, right) => left.localeCompare(right));
  employeeOptions.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

async function loadEmployeeProfile(employeeId) {
  state.selectedEmployeeId = employeeId;
  employeeProfile.innerHTML = `<div class="empty-state"><p>Loading employee profile...</p></div>`;
  await loadEmployeeDirectory();
  try {
    const response = await apiFetch(`/api/employees/${encodeURIComponent(employeeId)}/profile`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load employee profile.");
    const employee = data.employee;
    const attributes = employee.attributes || {};
    employeeProfile.innerHTML = `
      <p class="breadcrumb">Employees / ${escapeHtml(employee.name)}</p>
      <div class="profile-heading">
        <span class="profile-avatar">${escapeHtml(initials(employee.name))}</span>
        <div><h3>${escapeHtml(employee.name)}</h3><p>${escapeHtml(employeeSubtitle(employee))}</p></div>
      </div>
      <div class="profile-actions">
        <button class="primary-button profile-review">Add performance review</button>
        <button class="ghost-button profile-feedback">Add timeline record</button>
        <button class="ghost-button profile-summary">Prepare AI summary</button>
      </div>
      <dl class="profile-facts">
        ${profileFact("Role", attributes["job role"] || attributes.jobtitle || attributes.role)}
        ${profileFact("Department", attributes.department)}
        ${profileFact("Manager", attributes.manager)}
        ${profileFact("Location", attributes.location)}
        ${profileFact("Status", attributes.status || "Active")}
        ${profileFact("Start date", attributes["start date"] || attributes.startdate)}
      </dl>
      <section class="profile-section">
        <h4>Performance history</h4>
        ${data.reviews.map((review) => `
          <div class="profile-entry">
            <div><strong>${escapeHtml(review.reviewPeriod)}</strong><span>${escapeHtml(readablePerformanceValue(review.status))} | ${escapeHtml(readablePerformanceValue(review.outcome))}</span></div>
            <button class="ghost-button profile-pdf" data-review-id="${review.id}">PDF</button>
          </div>
        `).join("") || `<p class="empty-copy">No performance reviews recorded.</p>`}
      </section>
      <section class="profile-section">
        <h4>Wins, concerns, and complaints</h4>
        ${data.events.map((event) => `
          <div class="profile-entry"><div><strong>${escapeHtml(readablePerformanceValue(event.type))}</strong><span>${escapeHtml(event.summary)} | ${escapeHtml(new Date(event.occurredAt).toLocaleDateString())}</span></div></div>
        `).join("") || `<p class="empty-copy">No timeline records recorded.</p>`}
      </section>
      <section class="profile-section">
        <h4>Pending HR actions</h4>
        ${data.decisions.filter((decision) => decision.status === "needs_review").map((decision) => `
          <div class="profile-entry"><div><strong>${escapeHtml(readablePerformanceValue(decision.decisionType))}</strong><span>${escapeHtml(decision.proposedAction)}</span></div></div>
        `).join("") || `<p class="empty-copy">No actions are waiting for review.</p>`}
      </section>
      <section class="profile-section">
        <h4>Activity timeline</h4>
        ${data.timeline.slice(0, 20).map((item) => `
          <div class="timeline-row"><span>${escapeHtml(new Date(item.createdAt).toLocaleDateString())}</span><strong>${escapeHtml(readablePerformanceValue(item.type))}</strong><p>${escapeHtml(String(item.title).slice(0, 220))}</p></div>
        `).join("") || `<p class="empty-copy">No employee activity recorded.</p>`}
      </section>
    `;
    employeeProfile.querySelector(".profile-review").addEventListener("click", () => startEmployeeReview(employee.name));
    employeeProfile.querySelector(".profile-feedback").addEventListener("click", () => startEmployeeTimeline(employee.name));
    employeeProfile.querySelector(".profile-summary").addEventListener("click", () => preparePeopleSummary(employee.name, employee.id));
    employeeProfile.querySelectorAll(".profile-pdf").forEach((button) => {
      button.addEventListener("click", () => downloadReport(`/api/reports/performance/${button.dataset.reviewId}.pdf`, `performance-${safeClientFilename(employee.name)}.pdf`));
    });
  } catch (error) {
    employeeProfile.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function profileFact(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "Not recorded")}</dd></div>`;
}

function initials(name) {
  return String(name || "?").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function employeeSubtitle(employee) {
  const attributes = employee.attributes || {};
  return attributes["job role"] || attributes.jobtitle || attributes.role || attributes.department || "Employee record";
}

function startEmployeeReview(employeeName) {
  performanceEmployeeName.value = employeeName;
  selectMode("reviews");
  requestAnimationFrame(() => performancePeriod.focus());
}

function startEmployeeTimeline(employeeName) {
  peopleEventEmployee.value = employeeName;
  selectMode("reviews");
  requestAnimationFrame(() => peopleEventType.focus());
}

async function loadOnboardingPacks() {
  const response = await apiFetch("/api/onboarding");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load onboarding packs.");
  state.onboardingPacks = data.packs;
  const canManage = ["admin", "hr_manager"].includes(state.user?.role || "admin");
  onboardingList.innerHTML = data.packs.map((pack) => `
    <article class="list-item">
      <span class="risk-badge">${escapeHtml(pack.status)}</span>
      <h4>${escapeHtml(pack.employeeName)}</h4>
      <p>${escapeHtml(pack.role)}${pack.team ? ` | ${escapeHtml(pack.team)}` : ""}</p>
      <span class="meta-line">Updated ${escapeHtml(new Date(pack.updatedAt).toLocaleString())}</span>
      <div class="inline-actions">
        <button class="ghost-button copy-onboarding" data-id="${pack.id}">Copy</button>
        <button class="ghost-button download-onboarding" data-id="${pack.id}">Download PDF</button>
        ${canManage && pack.status === "pending" ? `<button class="ghost-button complete-onboarding" data-id="${pack.id}">Mark complete</button>` : ""}
      </div>
    </article>
  `).join("") || `<div class="empty-state"><p>No onboarding packs yet. Complete the form above to create one.</p></div>`;
  document.querySelectorAll(".copy-onboarding").forEach((button) => button.addEventListener("click", () => copyOnboardingPack(button.dataset.id)));
  document.querySelectorAll(".download-onboarding").forEach((button) => button.addEventListener("click", () => {
    const pack = state.onboardingPacks.find((item) => item.id === button.dataset.id);
    downloadReport(`/api/reports/onboarding/${button.dataset.id}.pdf`, `onboarding-${safeClientFilename(pack?.employeeName)}.pdf`);
  }));
  document.querySelectorAll(".complete-onboarding").forEach((button) => button.addEventListener("click", () => completeOnboardingPack(button.dataset.id)));
}

async function copyOnboardingPack(packId) {
  const pack = state.onboardingPacks.find((item) => item.id === packId);
  if (!pack) return;
  await navigator.clipboard.writeText(pack.content);
  output.textContent = `Copied the onboarding pack for ${pack.employeeName}.`;
}

async function completeOnboardingPack(packId) {
  const pack = state.onboardingPacks.find((item) => item.id === packId);
  if (!pack || !window.confirm(`Mark onboarding complete for ${pack.employeeName}?`)) return;
  const response = await apiFetch(`/api/onboarding/${encodeURIComponent(packId)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not update onboarding status.";
    return;
  }
  output.textContent = `Onboarding completed for ${data.pack.employeeName}.`;
  await Promise.all([loadOnboardingPacks(), loadDashboard()]);
}

async function downloadReport(path, filename) {
  const response = await apiFetch(path);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    output.textContent = data.error || "Could not download the report.";
    return;
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeClientFilename(value) {
  return String(value || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

async function generateOnboardingPack() {
  if (!onboardingName.value.trim() || !onboardingRole.value.trim() || !onboardingResponsibilities.value.trim()) {
    output.textContent = "Add the new hire, job title, and core responsibilities first.";
    return;
  }
  generateOnboardingButton.disabled = true;
  generateOnboardingButton.textContent = "Generating pack...";
  output.textContent = "Preparing the role and office onboarding pack...";
  try {
    const response = await apiFetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeName: onboardingName.value,
        role: onboardingRole.value,
        team: onboardingTeam.value,
        setup: onboardingSetup.value,
        responsibilities: onboardingResponsibilities.value,
        dailyNeeds: onboardingDailyNeeds.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not generate the onboarding pack.");
    output.textContent = data.pack.content;
    outputEvidence.innerHTML = data.sources?.length
      ? `<p><strong>Company sources:</strong> ${data.sources.map((source) => escapeHtml(source.title)).join("; ")}</p>`
      : `<p><strong>Review:</strong> Complete any company-specific details marked as missing before sharing.</p>`;
    outputEvidence.hidden = false;
    onboardingName.value = "";
    onboardingRole.value = "";
    onboardingTeam.value = "";
    onboardingSetup.value = "";
    onboardingResponsibilities.value = "";
    onboardingDailyNeeds.value = "";
    await Promise.all([loadOnboardingPacks(), loadDashboard()]);
  } catch (error) {
    output.textContent = error.message;
  } finally {
    generateOnboardingButton.disabled = false;
    generateOnboardingButton.textContent = "Generate onboarding pack";
  }
}

async function generateGeneralistGuidance() {
  if (!generalistRequest.value.trim()) {
    output.textContent = "Describe the HR request first.";
    generalistRequest.focus();
    return;
  }
  generateGeneralistButton.disabled = true;
  generateGeneralistButton.textContent = "Preparing guidance...";
  output.textContent = "Reviewing the HR request...";
  try {
    const response = await apiFetch("/api/hr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "generalist",
        prompt: generalistRequest.value,
        companyContext: generalistContext.value,
        desiredOutput: "action_plan",
        riskLevel: "normal"
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not prepare HR guidance.");
    output.textContent = data.result;
    const warnings = data.warnings?.length ? `<p><strong>Review warnings:</strong> ${data.warnings.map(escapeHtml).join(" ")}</p>` : "";
    outputEvidence.innerHTML = warnings;
    outputEvidence.hidden = !warnings;
  } catch (error) {
    output.textContent = error.message;
  } finally {
    generateGeneralistButton.disabled = false;
    generateGeneralistButton.textContent = "Get HR guidance";
  }
}

async function loadPerformance() {
  const response = await apiFetch("/api/performance");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load performance reviews.");
  state.performanceReviews = data.reviews;
  performanceSummary.innerHTML = `
    <span><strong>${data.summary.total}</strong> reviews</span>
    <span><strong>${data.summary.onTrack}</strong> on track</span>
    <span><strong>${data.summary.supportNeeded}</strong> need support</span>
    <span><strong>${data.summary.formalReview}</strong> need HR review</span>
    <span><strong>${data.summary.recognitionReview}</strong> recognition review</span>
  `;
  const canManage = ["admin", "hr_manager"].includes(state.user?.role || "admin");
  performanceList.innerHTML = data.reviews.map((review) => `
    <article class="list-item">
      <span class="risk-badge ${review.status === "formal_review" ? "high" : ""}">${escapeHtml(readablePerformanceValue(review.status))}</span>
      <h4>${escapeHtml(review.employeeName)}</h4>
      <p>${escapeHtml(review.reviewPeriod)} | ${escapeHtml(readablePerformanceValue(review.outcome))}</p>
      ${review.wins ? `<p><strong>Wins:</strong> ${escapeHtml(String(review.wins).slice(0, 260))}</p>` : ""}
      ${review.concerns ? `<p><strong>Concerns:</strong> ${escapeHtml(String(review.concerns).slice(0, 260))}</p>` : ""}
      <p><strong>Evidence:</strong> ${escapeHtml(String(review.evidence || "No evidence recorded").slice(0, 320))}</p>
      <span class="meta-line">${review.nextReviewAt ? `Next review ${escapeHtml(new Date(review.nextReviewAt).toLocaleDateString())}` : "No next review date"}</span>
      <div class="inline-actions">
        ${review.status !== "closed" ? `<button class="ghost-button prepare-performance" data-id="${review.id}">${review.status === "recognition_review" || review.outcome === "exceeding" ? "Review promotion or raise" : "Review next action"}</button>` : ""}
        <button class="ghost-button download-performance" data-id="${review.id}" data-employee="${escapeHtml(review.employeeName)}">Download PDF</button>
        ${canManage && review.status !== "closed" ? `<button class="ghost-button close-performance" data-id="${review.id}">Close review</button>` : ""}
      </div>
    </article>
  `).join("") || `<p class="meta-line">No performance reviews yet.</p>`;
  document.querySelectorAll(".prepare-performance").forEach((button) => {
    button.addEventListener("click", () => preparePerformanceBrief(button.dataset.id));
  });
  document.querySelectorAll(".close-performance").forEach((button) => {
    button.addEventListener("click", () => closePerformanceReview(button.dataset.id));
  });
  document.querySelectorAll(".download-performance").forEach((button) => {
    button.addEventListener("click", () => downloadReport(
      `/api/reports/performance/${button.dataset.id}.pdf`,
      `performance-${safeClientFilename(button.dataset.employee)}.pdf`
    ));
  });
}

async function savePerformanceReview() {
  if (!performanceEmployeeName.value.trim() || !performancePeriod.value.trim() || !performanceEvidence.value.trim()) {
    output.textContent = "Add the employee, review period, and documented evidence first.";
    return;
  }
  savePerformanceButton.disabled = true;
  try {
    const response = await apiFetch("/api/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeName: performanceEmployeeName.value,
        reviewPeriod: performancePeriod.value,
        outcome: performanceOutcome.value,
        status: performanceStatus.value,
        goals: performanceGoals.value,
        wins: performanceWins.value,
        concerns: performanceConcerns.value,
        evidence: performanceEvidence.value,
        supportProvided: performanceSupport.value,
        nextReviewAt: performanceNextReview.value || null
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save the performance review.");
    output.textContent = `Performance review saved for ${data.review.employeeName}.`;
    performanceEmployeeName.value = "";
    performancePeriod.value = "";
    performanceOutcome.value = "not_assessed";
    performanceStatus.value = "on_track";
    performanceGoals.value = "";
    performanceWins.value = "";
    performanceConcerns.value = "";
    performanceEvidence.value = "";
    performanceSupport.value = "";
    performanceNextReview.value = "";
    await Promise.all([loadPerformance(), loadDashboard()]);
    if (state.selectedEmployeeId) await loadEmployeeProfile(state.selectedEmployeeId);
  } catch (error) {
    output.textContent = error.message;
  } finally {
    savePerformanceButton.disabled = false;
  }
}

async function preparePerformanceBrief(reviewId) {
  const review = state.performanceReviews.find((item) => item.id === reviewId);
  if (!review) return;
  const recognition = review.status === "recognition_review" || review.outcome === "exceeding";
  const reviewKind = recognition ? "a promotion or compensation review" : "a sensitive employment-action review";
  if (!window.confirm(`Prepare ${reviewKind} for ${review.employeeName}? This creates a brief for human review and does not apply any employment change.`)) return;
  const facts = [
    `Outcome: ${readablePerformanceValue(review.outcome)}`,
    `Goals: ${review.goals || "Not recorded"}`,
    `Wins: ${review.wins || "Not recorded"}`,
    `Concerns: ${review.concerns || "Not recorded"}`,
    `Evidence: ${review.evidence}`,
    `Support provided: ${review.supportProvided || "Not recorded"}`
  ].join("\n");
  const proposedAction = recognition
    ? "Evaluate whether the documented impact supports recognition, promotion, or compensation review. Compare against role criteria and internal equity. Do not approve any change without accountable human review."
    : "Evaluate proportionate next steps from continued coaching, clearer goals, additional support, a formal improvement plan, reassignment, demotion review, or termination review. Do not treat allegations as facts and do not take action without accountable human approval.";
  output.textContent = "Preparing a human-reviewed decision brief...";
  try {
    const response = await apiFetch("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionType: recognition ? "compensation_change" : "performance_action",
        subject: `${review.employeeName} - ${review.reviewPeriod}`,
        facts,
        proposedAction
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not prepare the review brief.");
    output.textContent = `Status: human review required before action.\n\n${data.decision.brief}`;
    await refreshOperations();
  } catch (error) {
    output.textContent = error.message;
  }
}

async function closePerformanceReview(reviewId) {
  const review = state.performanceReviews.find((item) => item.id === reviewId);
  if (!window.confirm(`Close the review for ${review?.employeeName || "this employee"}?`)) return;
  const response = await apiFetch(`/api/performance/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "closed" })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not close the performance review.";
    return;
  }
  output.textContent = `Performance review closed for ${data.review.employeeName}.`;
  await Promise.all([loadPerformance(), loadDashboard()]);
  if (state.selectedEmployeeId) await loadEmployeeProfile(state.selectedEmployeeId);
}

function readablePerformanceValue(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadPeopleEvents() {
  const response = await apiFetch("/api/people-events");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load employee timeline records.");
  state.peopleEvents = data.events;
  const canManage = ["admin", "hr_manager"].includes(state.user?.role || "admin");
  peopleEventSummaryPanel.innerHTML = `
    <span><strong>${data.summary.total}</strong> timeline records</span>
    <span><strong>${data.summary.shoutOuts}</strong> shout-outs</span>
    <span><strong>${data.summary.complaints}</strong> complaints</span>
    <span><strong>${data.summary.openComplaints}</strong> open complaints</span>
  `;
  peopleEmployeeList.innerHTML = data.employees.map((employee) => `
    <article class="list-item">
      <h4>${escapeHtml(employee.employeeName)}</h4>
      <span class="meta-line">${employee.shoutOuts} shout-outs | ${employee.complaints} complaints (${employee.openComplaints} open) | ${employee.observations} observations</span>
      <div class="inline-actions"><button class="ghost-button prepare-people-summary" data-employee="${escapeHtml(employee.employeeName)}">Prepare people summary</button></div>
    </article>
  `).join("") || `<p class="meta-line">No employee timeline records yet.</p>`;
  peopleEventList.innerHTML = data.events.slice(0, 50).map((event) => `
    <article class="list-item">
      <span class="risk-badge ${event.type === "complaint" && event.status === "open" ? "high" : ""}">${escapeHtml(readablePerformanceValue(event.type))}</span>
      <h4>${escapeHtml(event.employeeName)}</h4>
      <p>${escapeHtml(event.summary)}</p>
      <span class="meta-line">${escapeHtml(new Date(event.occurredAt).toLocaleDateString())} | ${escapeHtml(event.status)}${event.source ? ` | ${escapeHtml(event.source)}` : ""}</span>
      ${canManage && event.type === "complaint" && event.status === "open" ? `<div class="inline-actions"><button class="ghost-button review-people-event" data-id="${event.id}">Mark reviewed</button></div>` : ""}
    </article>
  `).join("") || `<p class="meta-line">No timeline details yet.</p>`;
  document.querySelectorAll(".prepare-people-summary").forEach((button) => {
    button.addEventListener("click", () => preparePeopleSummary(button.dataset.employee));
  });
  document.querySelectorAll(".review-people-event").forEach((button) => {
    button.addEventListener("click", () => updatePeopleEventStatus(button.dataset.id, "reviewed"));
  });
}

async function savePeopleEvent() {
  if (!peopleEventEmployee.value.trim() || !peopleEventSummary.value.trim()) {
    output.textContent = "Add the employee and factual event details first.";
    return;
  }
  savePeopleEventButton.disabled = true;
  try {
    const response = await apiFetch("/api/people-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeName: peopleEventEmployee.value,
        type: peopleEventType.value,
        occurredAt: peopleEventDate.value || new Date().toISOString(),
        source: peopleEventSource.value,
        summary: peopleEventSummary.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save the timeline record.");
    output.textContent = `${readablePerformanceValue(data.event.type)} saved for ${data.event.employeeName}.`;
    peopleEventEmployee.value = "";
    peopleEventType.value = "shout_out";
    peopleEventDate.value = "";
    peopleEventSource.value = "";
    peopleEventSummary.value = "";
    await Promise.all([loadPeopleEvents(), loadDashboard()]);
    if (state.selectedEmployeeId) await loadEmployeeProfile(state.selectedEmployeeId);
  } catch (error) {
    output.textContent = error.message;
  } finally {
    savePeopleEventButton.disabled = false;
  }
}

async function updatePeopleEventStatus(eventId, status) {
  if (!window.confirm("Mark this complaint or concern as reviewed?")) return;
  const response = await apiFetch(`/api/people-events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not update the timeline record.";
    return;
  }
  output.textContent = `Timeline record marked ${data.event.status}.`;
  await Promise.all([loadPeopleEvents(), loadDashboard()]);
  if (state.selectedEmployeeId) await loadEmployeeProfile(state.selectedEmployeeId);
}

async function preparePeopleSummary(employeeName, employeeRecordId = null) {
  selectMode("generalist");
  output.textContent = "Preparing a contextual people summary...";
  outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    let events = state.peopleEvents.filter((event) => event.employeeName === employeeName);
    let reviews = state.performanceReviews.filter((review) => review.employeeName === employeeName);
    if (employeeRecordId) {
      const profileResponse = await apiFetch(`/api/employees/${encodeURIComponent(employeeRecordId)}/profile`);
      const profile = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profile.error || "Could not load the employee history.");
      events = profile.events;
      reviews = profile.reviews;
    }
    if (!events.length && !reviews.length) throw new Error("This employee has no documented history to summarize.");
    const timeline = [
      ...reviews.map((review) => `${review.updatedAt.slice(0, 10)} | Performance review | ${readablePerformanceValue(review.status)} | ${readablePerformanceValue(review.outcome)} | Evidence: ${review.evidence} | Wins: ${review.wins} | Concerns: ${review.concerns}`),
      ...events.map((event) => `${event.occurredAt.slice(0, 10)} | ${readablePerformanceValue(event.type)} | ${event.status} | ${event.summary}`)
    ].join("\n");
    const response = await apiFetch("/api/hr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "analytics",
        desiredOutput: "action_plan",
        riskLevel: "sensitive",
        prompt: `Prepare a balanced, factual people summary for ${employeeName} from this documented history:\n${timeline}\n\nSeparate performance evidence, praise, observations, and unverified complaints. Clearly identify synthetic demo evidence. Do not calculate a behavior score, infer personality, or treat complaint counts as guilt. Recommend proportionate next steps such as recognition, clarification, support, fact-finding, or no action. Any employment decision requires separate documented human review.`
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not prepare the people summary.");
    output.textContent = data.result;
  } catch (error) {
    output.textContent = error.message;
  }
}

async function loadAnalytics() {
  const response = await apiFetch("/api/analytics/workforce");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load workforce analytics.");
  analyticsSummary.innerHTML = `
    <span><strong>${data.summary.employees}</strong> stored employees</span>
    <span><strong>${data.summary.analyzedEmployees}</strong> analyzed outcomes</span>
    <span><strong>${data.summary.attrition}</strong> attrition records</span>
    <span><strong>${data.summary.attritionRate}%</strong> aggregate attrition</span>
  `;
  datasetStoredSummary.innerHTML = `
    <span><strong>${data.summary.employees}</strong> stored employees</span>
    <span><strong>${data.summary.analyzedEmployees}</strong> rows with outcomes</span>
    <span><strong>${data.summary.attrition}</strong> recorded departures</span>
    <span><strong>${data.summary.attritionRate}%</strong> aggregate attrition</span>
  `;
  const groups = (data.breakdowns[analyticsDimension.value] || []).slice(0, 12);
  analyticsChart.innerHTML = groups.map((group) => `
    <div class="analytics-row">
      <span>${escapeHtml(group.label)}</span>
      <div class="analytics-track"><div class="analytics-bar" style="width:${Math.min(100, group.attritionRate)}%"></div></div>
      <strong>${group.attritionRate}%</strong>
    </div>
  `).join("") || `<p class="meta-line">No verified values for this breakdown.</p>`;
  analyticsProvenance.textContent = `${data.provenance.source} | ${data.provenance.rowCount} rows | ${data.provenance.method}`;
}

async function loadDatasetSample() {
  const params = new URLSearchParams({ type: "employee", limit: "20" });
  if (datasetSearch.value.trim()) params.set("q", datasetSearch.value.trim());
  const response = await apiFetch(`/api/records?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load stored employee records.");
  datasetEmployeeSample.innerHTML = data.records.map((record) => `
    <article class="list-item">
      <h4>${escapeHtml(record.name)}</h4>
      <p>${escapeHtml(String(record.details || "No additional details").slice(0, 220))}</p>
      <span class="meta-line">${escapeHtml(record.source || "Stored employee record")}</span>
    </article>
  `).join("") || `<p class="meta-line">No matching employees found.</p>`;
  const shown = Math.min(data.records.length, 20);
  datasetEmployeeSample.insertAdjacentHTML("afterbegin", `<p class="meta-line">Showing ${shown} of ${data.total.toLocaleString()} matching employee record(s).</p>`);
}

async function loadKnowledge() {
  const response = await apiFetch("/api/knowledge");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load company knowledge.");
  knowledgeList.innerHTML = data.sources.map((source) => `
    <article class="list-item">
      <h4>${escapeHtml(source.title)}</h4>
      <span class="meta-line">Updated ${escapeHtml(new Date(source.updatedAt).toLocaleString())}</span>
    </article>
  `).join("") || `<p class="meta-line">No approved knowledge documents yet.</p>`;
}

async function uploadKnowledge() {
  const file = knowledgeFile.files?.[0];
  if (!file || !knowledgeTitle.value.trim()) {
    output.textContent = "Add a document title and choose a text or Markdown file.";
    return;
  }
  uploadKnowledgeButton.disabled = true;
  try {
    const response = await apiFetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: knowledgeTitle.value, text: await file.text() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not add knowledge document.");
    output.textContent = `${data.document.title} added to company knowledge.`;
    knowledgeTitle.value = "";
    knowledgeFile.value = "";
    await loadKnowledge();
  } catch (error) {
    output.textContent = error.message;
  } finally {
    uploadKnowledgeButton.disabled = false;
  }
}

const readinessLabels = {
  geminiConnected: "Gemini connected",
  productionDatabase: "Managed PostgreSQL connected",
  authenticationRequired: "Authentication required",
  smtpConfigured: "Invitation email configured",
  alertingConfigured: "Incident alerts configured",
  backupKeyConfigured: "Backup encryption key configured",
  privacyPolicyReviewed: "Privacy policy reviewed",
  termsReviewed: "Terms reviewed",
  retentionScheduleApproved: "Retention schedule approved",
  humanReviewOwnerAssigned: "Human review owner assigned",
  employmentCounselReviewed: "Employment counsel review completed",
  aiImpactAssessmentCompleted: "AI impact assessment completed",
  incidentOwnerAssigned: "Incident owner assigned",
  restoreDrillCompleted: "Restore drill completed"
};

async function loadReadiness() {
  const response = await apiFetch("/api/readiness");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load readiness checklist.");
  const editable = new Set(["privacyPolicyReviewed", "termsReviewed", "retentionScheduleApproved", "humanReviewOwnerAssigned", "employmentCounselReviewed", "aiImpactAssessmentCompleted", "incidentOwnerAssigned", "restoreDrillCompleted"]);
  readinessChecklist.innerHTML = `<p><strong>${data.completed}/${data.total}</strong> launch controls complete</p>` + Object.entries(data.checks).map(([key, checked]) => `
    <label class="readiness-item">
      <input type="checkbox" data-readiness="${key}" ${checked ? "checked" : ""} ${editable.has(key) ? "" : "disabled"} />
      <span>${escapeHtml(readinessLabels[key] || key)}</span>
    </label>
  `).join("");
  document.querySelectorAll("[data-readiness]:not(:disabled)").forEach((checkbox) => {
    checkbox.addEventListener("change", () => updateReadiness(checkbox.dataset.readiness, checkbox.checked));
  });
}

async function updateReadiness(key, value) {
  const response = await apiFetch("/api/readiness", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [key]: value })
  });
  if (!response.ok) output.textContent = (await response.json()).error || "Could not update readiness.";
  await loadReadiness();
}

async function loadIntegrations() {
  const response = await apiFetch("/api/integrations");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load integrations.");
  integrationStatusPanel.innerHTML = Object.entries(data).filter(([, value]) => value && typeof value === "object").map(([name, value]) => `
    <article class="list-item"><h4>${escapeHtml(name)}</h4><span class="meta-line">${value.configured ? "connected" : "not configured"} | ${escapeHtml(value.provider)}</span></article>
  `).join("");
}

async function loadScheduledWorkflows() {
  const response = await apiFetch("/api/workflows/scheduled");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load scheduled workflows.");
  scheduledWorkflows.innerHTML = data.workflows.slice(0, 20).map((workflow) => `
    <article class="list-item">
      <h4>${escapeHtml(workflow.name)}</h4>
      <span class="meta-line">${escapeHtml(workflow.integration)} | ${escapeHtml(workflow.status)} | ${escapeHtml(new Date(workflow.runAt).toLocaleString())}</span>
    </article>
  `).join("") || `<p class="meta-line">No scheduled workflows.</p>`;
}

async function scheduleWorkflow() {
  const runAt = workflowRunAt.value ? new Date(workflowRunAt.value).toISOString() : "";
  const response = await apiFetch("/api/workflows/scheduled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: workflowName.value, integration: workflowIntegration.value, runAt, message: workflowMessage.value })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not schedule workflow.";
    return;
  }
  output.textContent = `${data.workflow.name} scheduled.`;
  workflowName.value = "";
  workflowRunAt.value = "";
  workflowMessage.value = "";
  await loadScheduledWorkflows();
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
        ? `<button class="ghost-button approve-button" data-id="${decision.id}">Approve</button>`
        : "";
      const rejectButton = decision.status === "needs_review"
        ? `<button class="ghost-button reject-button" data-id="${decision.id}">Reject</button>`
        : "";
      return `
        <article class="list-item">
          <span class="risk-badge ${risk}">${risk}</span>
          <h4>${escapeHtml(decision.subject)}</h4>
          <p>${escapeHtml(decision.proposedAction)}</p>
          <span class="meta-line">${escapeHtml(decision.status)} | ${escapeHtml(flags)}</span>
          <div class="inline-actions">${approveButton}${rejectButton}</div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".approve-button").forEach((button) => {
    button.addEventListener("click", () => approveDecision(button.dataset.id));
  });
  document.querySelectorAll(".reject-button").forEach((button) => {
    button.addEventListener("click", () => rejectDecision(button.dataset.id));
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
        <span class="meta-line">${escapeHtml(event.actor || "system")} | ${escapeHtml(new Date(event.createdAt).toLocaleString())}</span>
      </article>
    `)
    .join("");
}

async function loadRecords() {
  const params = new URLSearchParams({ limit: "100" });
  if (recordSearch.value.trim()) params.set("q", recordSearch.value.trim());
  if (recordFilter.value) params.set("type", recordFilter.value);
  if (includeDeletedRecords.checked) params.set("includeDeleted", "true");
  const response = await apiFetch(`/api/records?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load records.");
  if (!data.records.length) {
    recordsList.innerHTML = `<p class="meta-line">No matching records.</p>`;
    return;
  }
  const canEdit = ["admin", "hr_manager", "recruiter"].includes(state.user?.role || "admin");
  const canDelete = ["admin", "hr_manager"].includes(state.user?.role || "admin");
  recordsList.innerHTML = data.records.map((record) => `
    <article class="list-item">
      <span class="risk-badge">${escapeHtml(record.type)}</span>
      <h4>${escapeHtml(record.name)}</h4>
      <p>${escapeHtml(String(record.details || "No details").slice(0, 320))}</p>
      <span class="meta-line">${record.deletedAt ? "Deleted" : "Updated"} ${escapeHtml(new Date(record.deletedAt || record.updatedAt).toLocaleString())}</span>
      <div class="inline-actions">
        ${canEdit && !record.deletedAt ? `<button class="ghost-button edit-record" data-id="${record.id}">Edit</button>` : ""}
        ${canDelete && !record.deletedAt ? `<button class="ghost-button delete-record" data-id="${record.id}">Delete</button>` : ""}
        ${canDelete && record.deletedAt ? `<button class="ghost-button restore-record" data-id="${record.id}">Restore</button>` : ""}
      </div>
    </article>
  `).join("");
  document.querySelectorAll(".edit-record").forEach((button) => {
    button.addEventListener("click", () => editRecord(button.dataset.id));
  });
  document.querySelectorAll(".delete-record").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.id));
  });
  document.querySelectorAll(".restore-record").forEach((button) => {
    button.addEventListener("click", () => restoreRecord(button.dataset.id));
  });
}

async function loadUsers() {
  const response = await apiFetch("/api/users");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load users.");
  usersList.innerHTML = data.users.map((user) => `
    <article class="list-item">
      <h4>${escapeHtml(user.email)}</h4>
      <span class="meta-line">${escapeHtml(user.role)} | ${user.disabledAt ? "disabled" : "active"} | MFA ${user.mfaEnabled ? "on" : "off"}</span>
      <div class="inline-actions">
        ${user.id !== state.user?.id ? `<button class="ghost-button toggle-user" data-id="${user.id}" data-disabled="${Boolean(user.disabledAt)}">${user.disabledAt ? "Enable" : "Disable"}</button>` : ""}
        ${user.id !== state.user?.id && user.mfaEnabled ? `<button class="ghost-button reset-mfa" data-id="${user.id}">Reset MFA</button>` : ""}
      </div>
    </article>
  `).join("") || `<p class="meta-line">No users yet.</p>`;
  document.querySelectorAll(".toggle-user").forEach((button) => {
    button.addEventListener("click", () => toggleUser(button.dataset.id, button.dataset.disabled === "true"));
  });
  document.querySelectorAll(".reset-mfa").forEach((button) => {
    button.addEventListener("click", () => resetUserMfa(button.dataset.id));
  });
}

async function loadInvitations() {
  const response = await apiFetch("/api/invitations");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load invitations.");
  invitationsList.innerHTML = data.invitations.slice(0, 10).map((invitation) => `
    <article class="list-item">
      <h4>${escapeHtml(invitation.email)}</h4>
      <span class="meta-line">${escapeHtml(invitation.role)} | ${escapeHtml(invitation.status)} | delivery ${escapeHtml(invitation.delivery?.status || "not configured")}</span>
    </article>
  `).join("") || `<p class="meta-line">No invitations yet.</p>`;
}

async function loadMetrics() {
  const response = await apiFetch("/api/metrics");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load operational metrics.");
  opsMetrics.innerHTML = `
    <span><strong>${data.organization.activeUsers}</strong> active users</span>
    <span><strong>${data.organization.activeSessions}</strong> active sessions</span>
    <span><strong>${data.organization.pendingInvitations}</strong> pending invitations</span>
    <span><strong>${data.organization.deletedRecords}</strong> deleted records</span>
    <span><strong>${data.errors}</strong> server errors</span>
  `;
}

async function createInvitation() {
  createInvitationButton.disabled = true;
  try {
    const response = await apiFetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: invitationEmail.value, role: invitationRole.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create invitation.");
    invitationLink.value = `${window.location.origin}${data.invitation.path}`;
    invitationEmail.value = "";
    const delivery = data.delivery?.status === "sent" ? " Email sent." : " Copy the invitation link to send it securely.";
    output.textContent = `Invitation created for ${data.invitation.email}.${delivery}`;
    await Promise.all([loadInvitations(), loadMetrics()]);
  } catch (error) {
    output.textContent = error.message;
  } finally {
    createInvitationButton.disabled = false;
  }
}

async function resetUserMfa(id) {
  const response = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mfaDisabled: true })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not reset MFA.";
    return;
  }
  output.textContent = `MFA reset for ${data.user.email}. Their sessions were signed out.`;
  await loadUsers();
}

async function toggleUser(id, currentlyDisabled) {
  const response = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled: !currentlyDisabled })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not update user.";
    return;
  }
  output.textContent = `${data.user.email} is now ${data.user.disabledAt ? "disabled" : "active"}.`;
  await loadUsers();
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
    const path = state.editingRecordId
      ? `/api/records/${encodeURIComponent(state.editingRecordId)}`
      : "/api/records";
    const response = await apiFetch(path, {
      method: state.editingRecordId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: recordType.value,
        name,
        details: recordDetails.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save record.");
    output.textContent = `${state.editingRecordId ? "Updated" : "Saved"} ${data.record.type} record: ${data.record.name}`;
    resetRecordForm();
    await refreshOperations();
  } catch (error) {
    output.textContent = error.message;
  } finally {
    saveRecordButton.disabled = false;
  }
}

async function editRecord(id) {
  const response = await apiFetch(`/api/records/${encodeURIComponent(id)}`);
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not load record.";
    return;
  }
  state.editingRecordId = id;
  recordType.value = data.record.type;
  recordName.value = data.record.name;
  recordDetails.value = data.record.details || "";
  saveRecordButton.textContent = "Update record";
  cancelEditButton.hidden = false;
  recordName.focus();
}

async function deleteRecord(id) {
  if (!window.confirm("Move this record into deleted-record retention?")) return;
  const response = await apiFetch(`/api/records/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not delete record.";
    return;
  }
  if (state.editingRecordId === id) resetRecordForm();
  output.textContent = "Record moved into deleted-record retention.";
  await refreshOperations();
}

async function restoreRecord(id) {
  const response = await apiFetch(`/api/records/${encodeURIComponent(id)}/restore`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not restore record.";
    return;
  }
  output.textContent = `Restored record: ${data.record.name}`;
  await refreshOperations();
}

function resetRecordForm() {
  state.editingRecordId = null;
  recordType.value = "employee";
  recordName.value = "";
  recordDetails.value = "";
  saveRecordButton.textContent = "Save record";
  cancelEditButton.hidden = true;
}

async function previewDataset() {
  const file = recordImportFile.files?.[0];
  if (!file) {
    datasetPreview.textContent = "Choose a CSV or JSON file to preview it.";
    return;
  }
  datasetPreview.textContent = `Reading ${file.name}...`;
  try {
    const records = parseDataset(file.name, await file.text());
    const columns = records.length ? Object.keys(records[0]).length : 0;
    datasetPreview.textContent = `${file.name} | ${records.length.toLocaleString()} rows | ${columns} columns | ready to import`;
  } catch (error) {
    datasetPreview.textContent = `Could not preview file: ${error.message}`;
  }
}

async function importRecords() {
  const file = recordImportFile.files?.[0];
  if (!file) {
    importResult.textContent = "Choose a CSV or JSON dataset first.";
    recordImportFile.focus();
    return;
  }

  importRecordsButton.disabled = true;
  importRecordsButton.textContent = "Importing...";
  importResult.textContent = `Reading ${file.name}...`;

  try {
    const text = await file.text();
    const records = parseDataset(file.name, text);
    if (!records.length) throw new Error("No rows were found in that dataset.");
    if (records.length > 50_000) throw new Error("Datasets are limited to 50,000 rows per upload.");

    const result = { importedCount: 0, duplicateCount: 0, rejectedCount: 0, rejected: [] };
    const batchSize = 1_000;
    for (let start = 0; start < records.length; start += batchSize) {
      const end = Math.min(start + batchSize, records.length);
      importResult.textContent = `Applying rows ${start + 1}-${end} of ${records.length.toLocaleString()}...`;
      const response = await apiFetch("/api/records/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: file.name, records: records.slice(start, end) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Could not import rows ${start + 1}-${end}.`);
      result.importedCount += data.importedCount || 0;
      result.duplicateCount += data.duplicateCount || 0;
      result.rejectedCount += data.rejectedCount || 0;
      result.rejected.push(...(data.rejected || []).map((item) => ({ ...item, row: item.row + start })));
    }

    importResult.textContent = `Applied ${result.importedCount.toLocaleString()} new row(s); skipped ${result.duplicateCount.toLocaleString()} exact duplicate(s); ${result.rejectedCount.toLocaleString()} need cleanup.`;
    output.textContent = formatImportSummary(result);
    recordImportFile.value = "";
    datasetPreview.textContent = "Import complete. Choose another CSV or JSON file when needed.";
    await refreshOperations();
  } catch (error) {
    importResult.textContent = error.message;
    output.textContent = error.message;
  } finally {
    importRecordsButton.disabled = false;
    importRecordsButton.textContent = "Import and apply dataset";
  }
}

function parseDataset(filename, text) {
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.records || parsed.employees || [];
  }
  return parseCsv(text);
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

  const [headers = [], ...dataRows] = rows;
  const keys = headers.map((header) => normalizeHeader(header));
  return dataRows.map((cells) => Object.fromEntries(keys.map((key, index) => [key, cells[index] || ""])));
}

function normalizeHeader(header) {
  const value = String(header || "").trim();
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = {
    employeename: "employeeName",
    fullname: "fullName",
    firstname: "firstName",
    lastname: "lastName",
    jobtitle: "jobTitle",
    startdate: "startDate"
  };
  return aliases[compact] || value.replace(/\s+([a-zA-Z])/g, (_, letter) => letter.toUpperCase()).replace(/[^a-zA-Z0-9_]/g, "");
}

function downloadCsvTemplate() {
  const csv = [
    "name,email,jobTitle,department,manager,location,status,startDate,salary,notes",
    "Avery Johnson,avery@example.com,People Operations Manager,HR,Morgan Lee,New York,Active,2026-08-01,85000,Owns onboarding and policy workflows"
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ai-hr-employee-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatImportSummary(data) {
  const lines = [
    `Imported ${data.importedCount} new employee/HR record(s).`,
    `Skipped ${data.duplicateCount || 0} exact duplicate(s).`
  ];
  if (data.rejected?.length) {
    lines.push("", "Rows needing cleanup:");
    data.rejected.slice(0, 20).forEach((item) => {
      lines.push(`Row ${item.row}: ${item.error}`);
    });
  }
  return lines.join("\n");
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

async function rejectDecision(id) {
  if (!window.confirm("Reject this decision brief after human review?")) return;
  const response = await apiFetch(`/api/decisions/${encodeURIComponent(id)}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "reject", reviewer: state.user?.email || "HR reviewer", note: "Rejected from AI HR workspace." })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not reject decision.";
    return;
  }
  output.textContent = `Decision rejected: ${data.decision.subject}`;
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
    if (!response.ok) throw new Error(data.error || "The HR request failed.");
    output.textContent = data.result;
    const evidenceItems = [];
    if (data.evidence) evidenceItems.push(`<p><strong>Evidence:</strong> ${escapeHtml(data.evidence.source)} | ${data.evidence.rowCount} rows | ${escapeHtml(data.evidence.method)}</p>`);
    if (data.sources?.length) evidenceItems.push(`<p><strong>Internal sources:</strong> ${data.sources.map((source, index) => `[S${index + 1}] ${escapeHtml(source.title)}`).join("; ")}</p>`);
    if (data.warnings?.length) evidenceItems.push(`<p><strong>Review warnings:</strong> ${data.warnings.map(escapeHtml).join(" ")}</p>`);
    outputEvidence.innerHTML = evidenceItems.join("");
    outputEvidence.hidden = !evidenceItems.length;
  } catch (error) {
    output.textContent = error.message;
  } finally {
    setBusy(false);
    checkHealth();
    refreshOperations();
  }
}

async function createUser() {
  renderPasswordGuidance(newUserPasswordGuidance, newUserPassword);
  if (!isValidPassword(newUserPassword.value)) {
    setFormStatus(newUserStatus, "The temporary password does not meet every requirement yet.", "error");
    return;
  }
  createUserButton.disabled = true;
  try {
    const response = await apiFetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newUserEmail.value,
        role: newUserRole.value,
        password: newUserPassword.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create user.");
    output.textContent = `Created ${data.user.role} account for ${data.user.email}.`;
    newUserEmail.value = "";
    newUserPassword.value = "";
    renderPasswordGuidance(newUserPasswordGuidance, newUserPassword);
    setFormStatus(newUserStatus, "Account created successfully.", "success");
    await loadUsers();
  } catch (error) {
    output.textContent = error.message;
    setFormStatus(newUserStatus, error.message, "error");
  } finally {
    createUserButton.disabled = false;
  }
}

async function exportOrganizationData() {
  const response = await apiFetch("/api/privacy/export");
  if (!response.ok) {
    const data = await response.json();
    output.textContent = data.error || "Could not export organization data.";
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aihr-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  output.textContent = "Organization data export downloaded.";
  await loadAudit();
}

async function purgeDeletedRecords() {
  const days = Number(retentionDays.value);
  if (!window.confirm(`Permanently purge deleted records older than ${days} day(s)?`)) return;
  const response = await apiFetch("/api/privacy/purge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ retentionDays: days })
  });
  const data = await response.json();
  if (!response.ok) {
    output.textContent = data.error || "Could not purge deleted records.";
    return;
  }
  output.textContent = `Purged ${data.purged} expired deleted record(s).`;
  await refreshOperations();
}

function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = authToken.value.trim();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers, credentials: "same-origin" });
}

function debounce(callback, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}

function setBusy(busy) {
  state.busy = busy;
  runButton.disabled = busy;
  runButton.textContent = busy ? "Generating..." : "Generate HR work";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
