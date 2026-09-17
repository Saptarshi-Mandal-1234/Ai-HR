import { createHmac } from "node:crypto";

const environmentKeys = {
  calendar: "AIHR_CALENDAR_WEBHOOK_URL",
  hris: "AIHR_HRIS_WEBHOOK_URL",
  ats: "AIHR_ATS_WEBHOOK_URL",
  collaboration: "AIHR_COLLABORATION_WEBHOOK_URL",
  payroll: "AIHR_PAYROLL_WEBHOOK_URL"
};

export function createIntegrationHub(env = process.env) {
  const endpoints = Object.fromEntries(Object.entries(environmentKeys).map(([name, key]) => [name, validateUrl(env[key] || "")]));
  const secret = String(env.AIHR_INTEGRATION_WEBHOOK_SECRET || "");
  return {
    status() {
      return Object.fromEntries(Object.entries(endpoints).map(([name, url]) => [name, {
        configured: Boolean(url),
        provider: "signed_webhook",
        mode: name === "payroll" ? "notification_only" : "event_delivery"
      }]));
    },
    async dispatch(name, event) {
      const endpoint = endpoints[name];
      if (!Object.hasOwn(endpoints, name)) return { status: "unsupported" };
      if (!endpoint) return { status: "not_configured" };
      if (name === "payroll" && event.action && event.action !== "notify") return { status: "blocked", reason: "Payroll adapter is notification-only." };
      const body = JSON.stringify({ ...event, integration: name, sentAt: new Date().toISOString() });
      const headers = { "Content-Type": "application/json", "User-Agent": "AI-HR-Integrations/1.0" };
      if (secret) headers["X-AIHR-Signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
      try {
        const response = await fetch(endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(8_000) });
        return response.ok ? { status: "sent" } : { status: "failed", responseStatus: response.status };
      } catch {
        return { status: "failed" };
      }
    }
  };
}

function validateUrl(value) {
  if (!value) return "";
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Integration webhook URLs must use HTTPS.");
  return url.toString();
}
