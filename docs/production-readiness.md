# AI HR Backend Production Readiness

This backend is now structured as a market-testable prototype: it has role-aware API access, rate limiting, persistent HR objects, decision briefs, approval gates, audit logging, safer Gemini timeouts, security headers, and readiness endpoints.

## Current Backend Capabilities

- `GET /api/health` checks server, model, records, and pending approvals.
- `GET /api/ready` checks Gemini key, storage, auth configuration, and schema.
- `GET /api/security` reports auth and rate-limit configuration without exposing secrets.
- `POST /api/hr` generates HR work through Gemini and writes an audit event.
- `POST /api/records` stores HR records for employees, candidates, jobs, policies, cases, and tasks.
- `POST /api/decisions` creates a decision brief, classifies risk, and gates high-impact actions.
- `POST /api/decisions/:id/approve` records accountable review.
- `GET /api/audit` exposes recent audit events to admin/auditor roles.

## Market Launch Minimums

Before a public launch, replace the local JSON store with a real database such as Postgres, move secrets to a managed secret store, add real user authentication, add tenant isolation, and deploy behind HTTPS.

For HR specifically, launch with review gates enabled for hiring, rejection, firing, discipline, compensation, harassment, discrimination, retaliation, medical, payroll, immigration, safety, leave, union, and protected-class issues.

## Environment Controls

Set `AIHR_AUTH_REQUIRED=true` before exposing the app outside your machine. Configure long random role tokens:

- `AIHR_ADMIN_TOKEN`
- `AIHR_HR_MANAGER_TOKEN`
- `AIHR_RECRUITER_TOKEN`
- `AIHR_EMPLOYEE_TOKEN`
- `AIHR_AUDITOR_TOKEN`

The frontend has an Access token field. Paste the relevant token there when auth is required.

## What Still Needs Building For SaaS

- Real database migrations and backups.
- Proper login, passwordless auth, SSO, and organization tenancy.
- Encryption at rest for sensitive HR records.
- File upload scanning and resume/document extraction.
- Webhooks/integrations for ATS, HRIS, calendar, email, payroll, and Slack/Teams.
- Background jobs for workflows, reminders, and scheduled reports.
- Full test suite and CI.
- Admin console for users, roles, retention, exports, and deletion.
- Legal/privacy review for each launch country.
