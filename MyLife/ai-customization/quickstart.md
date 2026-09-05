# AI Customization Quickstart

Goal: apply safe product changes using natural-language requests.

## 1. Start with a clear request
Use one paragraph with:
- What behavior should change
- Which app/screen/module is affected
- Constraints (privacy, performance, compatibility)

Example:

```text
In MyBooks, add a “share with friends” toggle on rating submit. Default to private.
When enabled, create a share event with visibility=friends. Keep local-only mode unchanged.
```

## 2. Ask the assistant for a plan first
Prompt pattern:

```text
Read this repo and create an implementation plan with exact files, migration needs,
API changes, risks, and test commands. Do not write code yet.
```

Expected output:
- File-by-file change list
- DB migration notes
- API contract impact
- Test plan
- Rollback notes

Optional helper command:

```bash
pnpm dlx tsx scripts/dev/plan-from-request.ts "<your request>"
```

## 3. Generate patch
After approving the plan:

```text
Implement the plan exactly. Update tests and docs. Run typecheck/tests and show results.
```

## 4. Run safety checks
Before deploy, run:

```bash
./deploy/self-host/scripts/backup.sh
pnpm --filter @mylife/web typecheck
pnpm --filter @mylife/mobile typecheck
```

If DB changed, also run:

```bash
./deploy/self-host/scripts/migrate.sh
```

## 5. Deploy update

```bash
cd deploy/self-host
docker compose --env-file .env up -d --build
```

## 6. Validate after deploy
- `curl -sSf http://localhost:8787/health`
- App self-host connection test passes
- Entitlement refresh succeeds
- Feature behavior matches request

## 7. Roll back if needed
- Restore most recent backup:

```bash
./deploy/self-host/scripts/restore.sh ./deploy/self-host/backups/<timestamp>
```

- Redeploy previous known-good image/config.

See also:
- `ai-customization/prompt-templates.md`
- `ai-customization/change-safe-checklist.md`
