# Access Automation Operations

Date: 2026-02-25
Scope: Hosted billing backend (`apps/web`) for self-host purchase fulfillment.

## Purpose
This runbook covers:
- GitHub team access automation after self-host purchase.
- Signed self-host bundle link issuance and secure download.
- Retry and alert handling for failed automation jobs.

## Required Environment Variables

### GitHub automation (`DM-027`)
- `MYLIFE_GITHUB_TOKEN`
  - GitHub token with org team membership/invitation permissions.
- `MYLIFE_GITHUB_ORG`
  - GitHub organization login.
- `MYLIFE_GITHUB_SELF_HOST_TEAM_SLUG`
  - Team slug that grants gated repo access.
- `MYLIFE_GITHUB_API_URL` (optional)
  - Default: `https://api.github.com`.

### Retry worker
- `MYLIFE_ACCESS_JOB_KEY` (optional but recommended)
  - Shared secret for `POST /api/access/github/retry` via `x-access-job-key` header.

### Bundle links (`DM-028`)
- `MYLIFE_BUNDLE_SIGNING_SECRET`
  - HMAC signing secret for bundle download tokens.
- `MYLIFE_BUNDLE_BASE_URL`
  - Public base URL used to build signed download URLs.
- `MYLIFE_BUNDLE_ISSUER_KEY` (optional but recommended)
  - Shared secret for `POST /api/access/bundle/issue` via `x-bundle-issuer-key` header.
- `MYLIFE_SELF_HOST_BUNDLE_ID` (optional)
  - Default bundle id when webhook payload does not include one.
- `MYLIFE_BUNDLE_LINK_TTL_SECONDS` (optional)
  - Signed URL TTL; bounded in code to 60..2,592,000 seconds.

### Billing + revocation integration
- `STRIPE_WEBHOOK_SECRET`
  - Stripe-style webhook signing secret used to verify the raw request body via the `Stripe-Signature` header.
- `MYLIFE_ENTITLEMENT_SECRET`
  - Entitlement signing secret.
- `MYLIFE_ENTITLEMENT_REVOKE_KEY` (optional)
  - Secret for manual revocation endpoint `POST /api/entitlements/revoke`.

## Endpoints

### Billing webhook (source of truth)
- `POST /api/webhooks/billing`
- Authentication:
  - Signed raw body verified against `STRIPE_WEBHOOK_SECRET`
  - Header must be `Stripe-Signature: t=<unix>,v1=<hmac>`
- Expected fields include:
  - `eventId`, `eventType`, `sku`, `appId`
  - Optional automation fields:
    - `customerEmail`
    - `githubUsername`
    - `customerId`
    - `bundleId`
    - `metadata` object fallback keys

### Access automation endpoints
- `POST /api/access/github/retry`
  - Reprocesses due pending jobs from `hub_preferences` queue keys.
- `POST /api/access/bundle/issue`
  - Issues signed bundle URL/token.
- `GET /api/access/bundle/download?token=...`
  - Streams zip from `deploy/self-host/releases/<bundle-id>.zip`.

### Friend/share pilot API (domain primitives)
- `POST/GET /api/friends/invites`
- `POST /api/friends/invites/:inviteId/accept`
- `POST /api/friends/invites/:inviteId/decline`
- `POST /api/friends/invites/:inviteId/revoke`
- `GET/DELETE /api/friends`
- `POST/GET /api/share/events`

## Operations Workflow

1. On self-host purchase (`sku = mylife_self_host_lifetime_v1`):
- Webhook updates entitlement.
- GitHub access is granted/invited when metadata allows.
- Bundle URL is issued in webhook response payload.

2. If GitHub automation fails:
- Job is queued with exponential backoff.
- Retry with `POST /api/access/github/retry`.
- After max attempts, alert is recorded in `hub_preferences` with `access_alert:*` key.

3. On refund/dispute:
- Signature is added to `hub_revoked_entitlements`.
- Self-host entitlement is downgraded.
- If username is provided, revoke attempts team membership removal.

## Manual Checks
- Validate pending jobs:
  - Query `hub_preferences` for keys prefixed with `access_job:`.
- Validate alerts:
  - Query `hub_preferences` for keys prefixed with `access_alert:`.
- Validate revoked signatures:
  - Query `hub_revoked_entitlements`.
- Validate bundle presence:
  - Ensure zip exists in `deploy/self-host/releases/`.

## Security Notes
- Rotate `MYLIFE_BUNDLE_SIGNING_SECRET` and `MYLIFE_GITHUB_TOKEN` periodically.
- Keep all `*_KEY` secrets out of client-exposed env vars.
- Keep bundle zip files server-side only; never expose the releases directory statically.
