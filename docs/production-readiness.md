# Production Readiness

This backend is structured as a market-testable HR product. It has grounded aggregate analytics, cited company knowledge, claim validation, password accounts, authenticator MFA, secure sessions, optional SMTP invitations, role access, rate limiting, transactional PostgreSQL persistence, encrypted backups, scheduled workflows, signed integration adapters, privacy operations, decision briefs, approval gates, audit logging, metrics and alerts, security headers, launch attestations, Docker support, CI, and isolated verification tests.

## API Surface

- `GET /api/health`
- `GET /api/ready`
- `GET /api/security`
- `GET /api/org`
- `GET /api/dashboard`
- `GET /api/employees/:id/profile`
- `GET|POST /api/onboarding`
- `PATCH /api/onboarding/:id`
- `POST /api/demo/load`
- `GET /api/reports/onboarding/:id.pdf`
- `GET /api/reports/performance/:id.pdf`
- `GET /api/records`
- `POST /api/records`
- `GET /api/decisions`
- `POST /api/decisions`
- `POST /api/decisions/:id/approve`
- `POST /api/risk/classify`
- `GET /api/audit`
- `POST /api/hr`
- `GET /api/auth/me`
- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/accept-invitation`
- `POST /api/auth/change-password`
- `POST /api/auth/mfa/setup`
- `POST /api/auth/mfa/confirm`
- `POST /api/auth/mfa/verify`
- `POST /api/auth/mfa/disable`
- `GET|POST /api/invitations`
- `GET|POST|PATCH /api/users`
- `GET|PATCH|DELETE /api/records/:id`
- `POST /api/records/:id/restore`
- `POST /api/decisions/:id/review`
- `GET /api/metrics`
- `GET /api/analytics/workforce`
- `GET|POST /api/performance`
- `PATCH /api/performance/:id`
- `GET|POST /api/people-events`
- `PATCH /api/people-events/:id`
- `GET|POST /api/knowledge`
- `GET|PATCH /api/readiness`
- `GET /api/integrations`
- `POST /api/integrations/:type/events`
- `GET|POST /api/workflows/scheduled`
- `GET /api/privacy/export`
- `POST /api/privacy/purge`

## Launch Checklist

- Set `AIHR_AUTH_REQUIRED=true`.
- Use long random role tokens.
- Serve behind HTTPS.
- Set `DATABASE_URL` to managed PostgreSQL; never use JSON storage in production.
- Keep the database private and enable provider backups and point-in-time recovery.
- Configure `AIHR_ALLOWED_ORIGIN` to the deployed frontend origin.
- Keep review gates enabled for high-impact employment decisions.
- Publish reviewed privacy policy, terms, consent, and data-processing agreements. Export and retention/deletion operations now exist in product.

## Required Before Handling Real Employee Data

- Add identity-provider SSO, verified-email/password-recovery flows, and recovery codes or hardware-key MFA before broad enterprise rollout. Authenticator MFA, SMTP invitations, expiring links, and self-service password changes now exist.
- Move from one organization per deployment to organization-level tenant provisioning if selling a shared SaaS instance.
- Encrypt sensitive HR records at rest.
- Add file upload malware scanning plus PDF and DOCX parsing. Text and Markdown company knowledge are supported now.
- Move scheduled workflows to a managed job queue before running multiple web instances. Persisted single-instance scheduling exists now.
- Complete provider-specific OAuth review and sandbox certification for ATS, HRIS, calendar, payroll, Slack, and Teams. Signed webhook adapters and SMTP are implemented.
- Add managed log aggregation, provider backup validation, scheduled off-site backup execution, restore drills, and named incident-response ownership. Metrics, signed alert delivery, encrypted backup tooling, structured logs, CI, and automated core tests now exist.
- Commission jurisdiction-specific employment, privacy, security, and AI-impact reviews.

Performance statuses organize documented follow-up and support; they are not termination recommendations or individual risk scores. AI-generated hiring, termination, discipline, compensation, promotion, leave, medical, harassment, discrimination, and other high-impact recommendations must remain advisory. An accountable human must review the evidence and approve the action.
