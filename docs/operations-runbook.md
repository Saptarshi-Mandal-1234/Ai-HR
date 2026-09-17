# Operations Runbook

## Health

- `GET /api/health` confirms the application, model configuration, record counts, and selected storage engine.
- `GET /api/ready` confirms Gemini configuration, storage connectivity, schema version, and authentication state.
- Treat a non-200 response or `storage: unavailable` as an incident.
- `GET /api/metrics` reports uptime, request and error totals, memory, active users and sessions, pending invitations, records, decisions, and audit counts to administrators and auditors.
- Production request logs are structured JSON when `AIHR_LOG_REQUESTS=true`.
- Set `AIHR_ALERT_WEBHOOK_URL` to an HTTPS incident endpoint; payloads are HMAC-signed when `AIHR_ALERT_WEBHOOK_SECRET` is set.

## Deployment

1. Rotate any exposed Gemini key and store the replacement as a platform secret.
2. Deploy `render.yaml` from a private Git repository.
3. Confirm `/api/ready` reports `database: postgresql`, `storage: ok`, and schema version 6.
4. Open the frontend and create the first administrator.
5. Set the custom domain and `AIHR_ALLOWED_ORIGIN` to the exact HTTPS origin.
6. Run `npm run smoke` with an administrator service token against the deployed URL.

## Backup And Restore

- Enable managed PostgreSQL backups and point-in-time recovery before real data is imported.
- Set a 32-byte base64url `AIHR_BACKUP_KEY` in a separate secret store, then run `npm run backup` to create an AES-256-GCM encrypted organization backup.
- Restore only into a separate database: set `AIHR_RESTORE_CONFIRM` to the exact organization ID and run `npm run restore -- backups/<file>.aihr-backup.json`.
- Losing `AIHR_BACKUP_KEY` makes backups unrecoverable. Exposing it makes them decryptable; do not store it beside backup files.
- Perform a restore drill into a separate database at least quarterly.
- Point a temporary AI HR service at the restored `DATABASE_URL` and confirm `/api/ready`, record counts, decisions, and audit history.
- Never test restores against the production database.

## Invitations

- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` for automatic delivery.
- Without SMTP, the admin UI returns a single-use invitation link for secure manual delivery.
- Set `AIHR_APP_BASE_URL` to the public HTTPS origin so invitation URLs target the deployed app.

## Incident Response

1. Revoke affected service tokens and rotate the Gemini key or database credentials.
2. Disable affected user accounts; this revokes their active sessions.
3. Preserve application and database logs.
4. Determine affected organizations, records, and time range from the audit trail.
5. Follow contractual and jurisdictional breach-notification requirements.

## Capacity

- The current database serializes each organization's document during writes and is intended for controlled pilots.
- Before high-volume shared SaaS usage, normalize records, decisions, users, sessions, and audits into separate tenant-keyed tables.
- Replace in-process rate limiting with a shared service before running multiple web instances.
