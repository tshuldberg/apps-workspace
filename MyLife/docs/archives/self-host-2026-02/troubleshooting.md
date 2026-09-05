# Self-Host Troubleshooting

## Stack Fails to Boot
- Run `docker compose --env-file .env ps` in `deploy/self-host`.
- Check failing logs:
  - `docker compose --env-file .env logs api`
  - `docker compose --env-file .env logs postgres`
  - `docker compose --env-file .env logs minio`

## `/health` Returns 503
`/health` requires both DB and storage to be healthy.

- Verify Postgres:
  - `docker compose --env-file .env exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
- Verify MinIO:
  - `curl -i http://localhost:9000/minio/health/live`
- Re-run migrations after DB recovery:
  - `./scripts/migrate.sh`

## Entitlement Sync Returns 401
- Confirm header key matches `MYLIFE_ENTITLEMENT_SYNC_KEY`.
- In web/mobile environments, ensure the same key is configured for refresh calls.

## Entitlement Sync Returns 404
- No entitlement is cached server-side yet.
- Run `./scripts/seed.sh` for demo data, or issue an entitlement through your billing workflow.

## Social or Messaging Returns 401 (`actorToken is required`)
- Strict actor identity mode is enabled and client requests are missing `actorToken`.
- Verify:
  - `MYLIFE_ACTOR_IDENTITY_STRICT_MODE`
  - `MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK`
  - `MYLIFE_ACTOR_IDENTITY_LEGACY_USERID_FALLBACK_UNTIL`
- Confirm token issuance endpoint works:
  - `POST /api/identity/actor/issue` with `{ "userId": "demo-alice" }`
- For emergency rollback during migration, temporarily enable:
  - `MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK=true`

## Messaging Endpoints Return 403
- Direct messages require an accepted friendship.
- Create and accept an invite first:
  - `POST /api/friends/invites`
  - `POST /api/friends/invites/{inviteId}/accept`
- For local smoke tests, `./scripts/seed.sh` creates friendship between `demo-alice` and `demo-bob`.

## Federation Inbox Returns 401
- Verify headers are present:
  - `x-mylife-federation-server`
  - `x-mylife-federation-timestamp`
  - `x-mylife-federation-signature`
- Ensure both servers share the same HMAC key mapping:
  - `MYLIFE_FEDERATION_SHARED_KEY` or `MYLIFE_FEDERATION_SHARED_KEYS`
- Check clock skew between servers; default acceptance window is 5 minutes.

## Federation Dispatch Keeps Failing
- Confirm `MYLIFE_FEDERATION_SERVER` is set to this node's public host (no scheme).
- Confirm recipient hosts in `recipientUserId` are reachable and expose `/api/federation/inbox/messages`.
- If dispatch endpoint is protected, include:
  - `x-federation-dispatch-key` matching `MYLIFE_FEDERATION_DISPATCH_KEY`.
- Inspect outbox state directly:
  - `SELECT status, attempts, last_error, recipient_server FROM federation_message_outbox ORDER BY updated_at DESC LIMIT 50;`

## GitHub Access Automation Is Not Triggering
- Confirm hosted billing env vars are set:
  - `MYLIFE_GITHUB_TOKEN`
  - `MYLIFE_GITHUB_ORG`
  - `MYLIFE_GITHUB_SELF_HOST_TEAM_SLUG`
- Ensure webhook payload contains either `githubUsername` or `customerEmail` (top-level or metadata).
- Trigger retry worker endpoint for queued jobs:
  - `POST /api/access/github/retry`
  - Include `x-access-job-key` if `MYLIFE_ACCESS_JOB_KEY` is set.

## Bundle Link Issued but Download Returns 404
- Confirm matching bundle zip exists:
  - `deploy/self-host/releases/<bundle-id>.zip`
- Check that `MYLIFE_SELF_HOST_BUNDLE_ID` (or webhook `bundleId`) matches the filename.
- Verify token has not expired (default 14 days unless overridden).

## Self-Host Connection Test Fails TLS Check
- Use HTTPS for internet-facing deployments.
- Local `http://localhost` is acceptable only for local development.

## MinIO Bucket Missing
- Re-run one-shot init service:
  - `docker compose --env-file .env up minio-init`
- Confirm bucket from inside minio/mc:
  - `docker compose --env-file .env run --rm minio-init sh`

## `migrate.sh` or `seed.sh` Fails
- Ensure `.env` exists at `deploy/self-host/.env`.
- Ensure Docker daemon is running.
- Confirm `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are set and match running container settings.

## Restore Script Errors
- Verify backup directory includes both files:
  - `postgres.sql`
  - `minio-data.tgz`
- Ensure stack is running before restore:
  - `docker compose --env-file .env up -d`
