# Change-Safe Checklist

Run this checklist before every self-host deployment.

## Scope and impact
- [ ] Change request is explicit and testable.
- [ ] Files and modules touched are listed.
- [ ] Privacy constraints are preserved (no telemetry/content exfiltration).

## Data safety
- [ ] Backup completed: `./deploy/self-host/scripts/backup.sh`.
- [ ] Migration reviewed for destructive operations.
- [ ] Migration run successfully if required.

## Build/test gates
- [ ] `pnpm --filter @mylife/web typecheck` passes.
- [ ] `pnpm --filter @mylife/mobile typecheck` passes.
- [ ] Any changed package tests pass.
- [ ] Self-host API/scripts syntax checks pass.

## Runtime validation
- [ ] `docker compose --env-file .env up -d --build` completed.
- [ ] `curl /health` returns `status=ok`.
- [ ] App self-host connection test is green.
- [ ] Entitlement sync endpoint is reachable.

## Rollback readiness
- [ ] Last known-good commit/image reference recorded.
- [ ] Restore command rehearsed:
  `./deploy/self-host/scripts/restore.sh ./deploy/self-host/backups/<timestamp>`
- [ ] Operator knows rollback owner and escalation path.
