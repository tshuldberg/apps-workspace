# MyLife Self-Host Quickstart

Status: MVP deploy kit (`DM-022`, `DM-023`)

## 1. Prerequisites
- Docker Engine 24+ with Docker Compose plugin
- A Linux/macOS host with at least 2 CPU and 4 GB RAM
- Open ports:
  - `8787` (MyLife API)
  - `9000` (MinIO API)
  - `9001` (MinIO console, optional)
- A purchased self-host entitlement (for production use)

## 2. Prepare Environment
From repo root:

```bash
cd deploy/self-host
cp .env.example .env
```

Edit `.env` and set strong values for:
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `MYLIFE_ENTITLEMENT_SYNC_KEY`
- `MYLIFE_ENTITLEMENT_ISSUER_KEY`
- `MYLIFE_ACTOR_IDENTITY_SECRET`

For cross-server federation, also set:
- `MYLIFE_FEDERATION_SERVER` (public host, no scheme)
- `MYLIFE_FEDERATION_SHARED_KEY` (or `MYLIFE_FEDERATION_SHARED_KEYS`)
- `MYLIFE_FEDERATION_DISPATCH_KEY` (recommended for secured dispatch endpoint)

## 3. Boot the Stack

```bash
docker compose --env-file .env up -d --build
```

Services started by compose:
- `api`: MyLife self-host API (`/health`, entitlement sync, friends, messages, share events)
- `postgres`: relational data store
- `minio`: S3-compatible object storage
- `minio-init`: one-shot bucket bootstrap

## 4. Run Schema + Seed

```bash
./scripts/migrate.sh
./scripts/seed.sh
```

This creates the baseline tables:
- `entitlements`
- `friend_invites`
- `friendships`
- `friend_messages`
- `federation_message_outbox`
- `federation_inbox_receipts`
- `share_events`

And inserts demo seed data (including a default self-host entitlement row).

## 5. Validate Health

```bash
curl -sSf http://localhost:8787/health | jq
```

Expected:
- `status: "ok"`
- `services.db: "ok"`
- `services.storage: "ok"`

## 6. Connect Web/Mobile Apps
1. In app settings, open **Self-Host Setup**.
2. Enter your URL (for local testing: `http://localhost:8787`).
3. Run **Test Connection**.
4. Save mode as `self_host`.
5. Use **Refresh** in settings to sync entitlements.
6. Social features issue actor identity tokens via `POST /api/identity/actor/issue`.

## 6.1 Validate Friend Messaging
After running `./scripts/seed.sh`, demo users `demo-alice` and `demo-bob` are already friends.

Send a message:

```bash
curl -sS -X POST http://localhost:8787/api/messages \
  -H 'content-type: application/json' \
  -d '{
    "fromUserId":"demo-alice",
    "toUserId":"demo-bob",
    "content":"Hello from a local-first self-host node."
  }' | jq
```

Fetch the conversation:

```bash
curl -sS "http://localhost:8787/api/messages?viewerUserId=demo-alice&friendUserId=demo-bob" | jq
```

Fetch inbox summaries:

```bash
curl -sS "http://localhost:8787/api/messages/inbox?viewerUserId=demo-alice" | jq
```

## 6.2 Federation Dispatch (Between Self-Host Nodes)
When a message recipient is addressed on another server (for example `demo-bob@node-b.example.com`), the API queues delivery in `federation_message_outbox`.

Run dispatch manually:

```bash
curl -sS -X POST http://localhost:8787/api/federation/dispatch \
  -H 'content-type: application/json' \
  -H 'x-federation-dispatch-key: <your-dispatch-key>' \
  -d '{"limit":25}' | jq
```

For production, run this endpoint from a scheduler/worker loop (for example every 10-30 seconds).

## 7. Backups and Restore
Create a backup:

```bash
./scripts/backup.sh
```

Restore from a backup directory:

```bash
./scripts/restore.sh ./backups/<timestamp>
```

## 8. Upgrades
1. Pull latest code.
2. Rebuild and restart compose stack:

```bash
docker compose --env-file .env up -d --build
```

3. Re-run migrations:

```bash
./scripts/migrate.sh
```

4. Verify with `/health` and in-app self-host test.

## 9. API Contract
Canonical API contract:
- `docs/self-host/api-contract.yaml`
- `docs/self-host/decentralized-messaging.md` (local-first messaging + federation path)
- `docs/self-host/actor-identity-operations.md` (token rollout and secret rotation runbook)
- `docs/self-host/connection-method-guides.md` (detailed home internet reachability guides)
- `docs/self-host/connection-method-ui-plan.md` (wizard/test plan and acceptance coverage)

## 10. AI Customization Kit
- `ai-customization/quickstart.md`
- `ai-customization/prompt-templates.md`
- `ai-customization/change-safe-checklist.md`

## 11. Bundle Delivery (Hosted Billing Side)
The hosted billing backend now supports signed bundle links for self-host purchases:
- Issue link: `POST /api/access/bundle/issue`
- Download link target: `GET /api/access/bundle/download?token=...`

Required hosted env vars:
- `MYLIFE_BUNDLE_SIGNING_SECRET`
- `MYLIFE_BUNDLE_BASE_URL` (or request-origin fallback)
- Optional: `MYLIFE_SELF_HOST_BUNDLE_ID` (default `self-host-v1`)

Bundle zip files are resolved from:
- `deploy/self-host/releases/<bundle-id>.zip`

## 12. Operator Runbook
- `docs/billing/access-automation-operations.md`
