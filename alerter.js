import { createHmac } from "node:crypto";

export function createAlerter(env = process.env) {
  const endpoint = validateEndpoint(env.AIHR_ALERT_WEBHOOK_URL || "");
  const secret = String(env.AIHR_ALERT_WEBHOOK_SECRET || "");

  return {
    configured: Boolean(endpoint),
    async send(event) {
      if (!endpoint) return { status: "not_configured" };
      const payload = JSON.stringify({ ...event, service: "ai-hr", occurredAt: new Date().toISOString() });
      const headers = { "Content-Type": "application/json", "User-Agent": "AI-HR-Alerts/1.0" };
      if (secret) headers["X-AIHR-Signature"] = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: payload,
          signal: AbortSignal.timeout(5_000)
        });
        return response.ok ? { status: "sent" } : { status: "failed", responseStatus: response.status };
      } catch {
        return { status: "failed" };
      }
    }
  };
}

function validateEndpoint(value) {
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("AIHR_ALERT_WEBHOOK_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:") throw new Error("AIHR_ALERT_WEBHOOK_URL must use HTTPS.");
  return url.toString();
}
