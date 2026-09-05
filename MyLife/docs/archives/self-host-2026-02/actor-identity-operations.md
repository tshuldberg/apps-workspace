# Actor Identity Operations (Self-Host)

## Purpose
Self-host social endpoints support signed actor identity tokens so clients can authenticate social actions without exposing admin credentials.

## Required Environment Variables
- `MYLIFE_ACTOR_IDENTITY_SECRET`
  - HMAC secret used to issue and verify `actorToken` values.
  - If omitted, API falls back to `MYLIFE_ENTITLEMENT_ISSUER_KEY`, then `MYLIFE_ENTITLEMENT_SYNC_KEY`.

## Rollout Controls
- `MYLIFE_ACTOR_IDENTITY_STRICT_MODE=true`
  - Requires `actorToken` for social/message identity checks.
- `MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK=true|false`
  - Explicitly allow or block plain `userId` fallback.
- `MYLIFE_ACTOR_IDENTITY_LEGACY_USERID_FALLBACK_UNTIL=<ISO-8601>`
  - Time-box plain `userId` fallback during migration.

Recommended migration sequence:
1. Set `MYLIFE_ACTOR_IDENTITY_SECRET`.
2. Keep fallback allowed while clients roll out actor-token usage.
3. Set `MYLIFE_ACTOR_IDENTITY_LEGACY_USERID_FALLBACK_UNTIL`.
4. Enable strict mode (`MYLIFE_ACTOR_IDENTITY_STRICT_MODE=true`) after migration window.

## Token Issuance Endpoint
- `POST /api/identity/actor/issue`
- Request body: `{ "userId": "demo-alice" }`
- Response: `{ ok, userId, actorToken, issuedAt }`

## Secret Rotation Runbook
1. Set `MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK=true` temporarily.
2. Deploy a new `MYLIFE_ACTOR_IDENTITY_SECRET`.
3. Restart API service.
4. Force client token refresh (clients call `POST /api/identity/actor/issue`).
5. Verify social/message endpoints succeed with new tokens.
6. Re-enable strict settings (`MYLIFE_ACTOR_IDENTITY_STRICT_MODE=true`, disable legacy fallback).

## Incident Recovery (Invalid Signature Spikes)
1. Confirm deployment used expected `MYLIFE_ACTOR_IDENTITY_SECRET`.
2. Check whether strict mode was enabled before clients refreshed tokens.
3. Temporarily enable legacy fallback (`MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK=true`).
4. Trigger client-side token re-issue workflow.
5. After traffic stabilizes, disable fallback again.
