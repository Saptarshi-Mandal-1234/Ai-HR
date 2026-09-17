import { createAlerter } from "../alerter.js";

const alerter = createAlerter({});
const result = await alerter.send({ type: "verification" });
if (alerter.configured || result.status !== "not_configured") throw new Error("Unconfigured alerter did not fail closed.");

let rejected = false;
try {
  createAlerter({ AIHR_ALERT_WEBHOOK_URL: "http://example.test/hook" });
} catch {
  rejected = true;
}
if (!rejected) throw new Error("Insecure alert webhook was accepted.");
console.log("Alert webhook configuration verification passed.");
