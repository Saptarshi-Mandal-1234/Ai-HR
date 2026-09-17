# GitHub Release Guide

## Before Upload

1. Rotate the Gemini API key that was previously shared outside a secret manager.
2. Confirm `.env`, `.env.local`, `data/`, `backups/`, `test-results/`, and `node_modules/` are not staged.
3. Run `npm ci` and `npm run release:check`.
4. Review `git status` and `git diff --cached` before every push.
5. Create the first repository as private. Decide on a software license before making it public.

## Create The Remote

Create an empty private GitHub repository without adding a README, `.gitignore`, or license. Then run:

```powershell
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

## Configure GitHub

1. Require the `verify` workflow before merging to `main`.
2. Enable Dependabot alerts, secret scanning, push protection, and private vulnerability reporting.
3. Keep Gemini, database, SMTP, webhook, integration, role-token, and backup secrets in the deployment platform, never in GitHub files.

## Deploy

The included `render.yaml` provisions a Docker web service and private PostgreSQL database. Connect the private repository as a Render Blueprint, supply the secret values requested by Render, and complete the launch checklist in `docs/production-readiness.md` before handling real employee data.
