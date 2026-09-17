# Security And Privacy

## Implemented Controls

- Salted `scrypt` password hashing.
- HTTP-only, SameSite session cookies; Secure cookies and HSTS in production.
- Session expiration, logout revocation, and revocation when a user is disabled or resets a password.
- Single-use, expiring invitation token hashes and self-service password rotation.
- Authenticator-app TOTP MFA with short-lived login challenges, session revocation, and administrator reset.
- Role authorization for admin, HR manager, recruiter, employee, and auditor.
- Exact-origin checks for browser mutations, restrictive Content Security Policy, frame denial, MIME protection, and permissions policy.
- Request-size limits, API and AI rate limits, audit logging, and basic audit PII redaction.
- Soft deletion, retention purge, and organization export without password hashes or sessions.
- Mandatory human approval gates for high-impact employment decisions.
- Role-protected performance reviews that track evidence and support without calculating individual termination risk.
- Role-protected employee timelines that distinguish shout-outs, observations, and unverified complaints without producing behavior scores.
- Explicit approve/reject review outcomes with duplicate-review prevention.
- AES-256-GCM application backup encryption and optional HMAC-signed HTTPS incident webhooks.

## Required External Controls

- Managed encryption at rest, private networking, backups, and point-in-time recovery.
- Enterprise SSO, verified-email/password recovery, MFA recovery codes or hardware keys, and centralized user provisioning.
- Centralized log retention, alert routing ownership, vulnerability scanning, penetration testing, and an incident-response team.
- Data-processing agreements, subprocessors list, retention schedule, privacy notices, consent where required, and data-subject request procedures.
- Jurisdiction-specific employment and AI-impact review.

## Product Boundary

AI output is advisory. Hiring, rejection, termination, compensation, promotion, discipline, leave, disability, medical, harassment, discrimination, retaliation, union, immigration, payroll, and safety decisions require accountable human review. Do not use protected characteristics or proxies to rank people or make employment decisions.
