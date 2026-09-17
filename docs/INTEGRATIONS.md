# Integration Setup

AI HR exposes signed outbound webhook adapters for calendar, HRIS, ATS, collaboration, and payroll notifications. Configure the corresponding `AIHR_*_WEBHOOK_URL` environment variable and a shared `AIHR_INTEGRATION_WEBHOOK_SECRET`.

Every destination must use HTTPS. Outbound calls require explicit confirmation or a persisted scheduled workflow. Payroll is notification-only and cannot execute pay changes. Provider-specific OAuth applications, scopes, data-processing agreements, sandbox verification, and production approval remain external launch requirements.

Do not send protected characteristics, medical details, investigation contents, credentials, or unnecessary employee data through generic webhooks.
