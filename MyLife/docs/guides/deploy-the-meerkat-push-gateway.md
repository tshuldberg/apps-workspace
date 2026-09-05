# Deploy the Meerkat push gateway (Plan 42 P4)

The push gateway turns an opaque, end-to-end-encrypted wake capability into a real
APNs / FCM / Web Push wake. It is a SEPARATE deployable over the meerkat-relay codebase
(`bin/meerkat-push-gateway.mjs`), not the slim ws+zod relay image. It drives the Phase 1
/ Plan 44 push stores (registration, encrypted provider token, capability, attempt) and
runs a fenced attempt-drain loop.

## What it guarantees

- The gateway is addressed by RANDOM capabilities, never a device key. It never receives
  a Meerkat identity, community id, message id, caller name, or plaintext content
  (NC-42.3). Every address and secret reaches the store only as a SHA-256 hash; provider
  tokens reach it only as ciphertext.
- Acceptance is recorded, never "delivered" (NC-42.4). The status route reports
  `provider_accepted`, `provider_rejected`, or `unknown` only. APNs/FCM acceptance does
  not prove app receipt, so the gateway never claims it.
- A provider with no mounted credential is honestly OFF; its wakes answer
  `wake_unavailable`. The ready log names exactly which providers are live.

## HTTP surface (`/v1/push/*`)

| Method + path | Purpose | Auth |
|---|---|---|
| `POST /v1/push/registrations` | Create or (with `rotate:true`) rotate the provider token | registration secret (Bearer) |
| `DELETE /v1/push/registrations/:id` | Revoke the install and all its capabilities | registration secret (Bearer) |
| `POST /v1/push/capabilities` | Mint a recipient-specific wake capability | registration secret (Bearer) |
| `DELETE /v1/push/capabilities/:hash` | Revoke a peer's wake permission | registration secret (Bearer) |
| `POST /v1/push/wakes` | Send a bounded (<= 2 KiB) opaque wake | wake capability (Bearer), rate limited |
| `GET /v1/push/status/:attemptId` | Provider acceptance only | wake capability (Bearer) |

`/livez` and `/readyz` come from the shared health surface; `/readyz` gates on the state
authority AND the token cipher (a dead cipher cannot seal a new token, so the gateway is
not ready to register installs). Private Prometheus `/metrics` (opt-in via
`MEERKAT_METRICS_PORT`) exposes `meerkat_push_attempts_total{provider,outcome}` and a
bounded attempt-queue-depth gauge with static labels only.

## State authority

- Self-host: `MEERKAT_DEPLOYMENT_PROFILE=self-host MEERKAT_STORE_BACKEND=file` + `DATA_DIR`.
- First-party production: `MEERKAT_DEPLOYMENT_PROFILE=first-party MEERKAT_STORE_BACKEND=postgres`
  with verify-full TLS. First-party fails closed if PostgreSQL is not selected; there is no
  filesystem fallback. Shadow mode is not supported for the gateway.

The gateway uses the `meerkat_push` PostgreSQL role (SELECT/INSERT/UPDATE/DELETE on the
`push` schema tables plus `ops.idempotency_results`).

## Token-encryption keyring (required)

Provider tokens are sealed at rest with AES-256-GCM under a MOUNTED SECRET keyring. This
is real authenticated encryption, not a fake capability; a managed KMS (AWS KMS, GCP KMS)
can replace it behind the same `PushTokenCipher` interface as founder-ops hardening.

- `MEERKAT_PUSH_TOKEN_KEYS_DIR`: a directory of `<version>.key` files, each 32 raw bytes
  or 64 hex chars.
- `MEERKAT_PUSH_TOKEN_ACTIVE_VERSION`: the integer version new tokens seal under.

The bin fails closed at boot (before any listener) on a wrong-length key, an unreadable
file, a duplicate version, or an active version with no file. Key bytes and paths are
never echoed in logs.

### Rotating the token key

1. Add a higher-numbered key file (e.g. `2.key`) into the keyring directory.
2. Restart the gateway with `MEERKAT_PUSH_TOKEN_ACTIVE_VERSION=2`.
3. New tokens now seal under v2. Tokens sealed under v1 keep decrypting because the
   envelope carries its own key version; the gateway looks up the key by that version.
4. Only after every v1-sealed token has expired or been rotated by its client may the
   `1.key` file be removed. Removing a key whose tokens still exist makes those tokens a
   typed decrypt failure (loud), never a silent delivery miss.

## Provider credentials (all mounted secret files)

- APNs: `MEERKAT_PUSH_APNS_KEY_FILE` (the `.p8` signing key), plus
  `MEERKAT_PUSH_APNS_KEY_ID`, `MEERKAT_PUSH_APNS_TEAM_ID`, `MEERKAT_PUSH_APNS_TOPIC`
  (the app bundle id), and `MEERKAT_PUSH_APNS_BASE_URL` (production or sandbox host).
- FCM: `MEERKAT_PUSH_FCM_SERVICE_ACCOUNT_FILE` (the service-account JSON). The gateway
  mints its own RS256 OAuth token from it; no google-auth dependency.
- Web Push: `MEERKAT_PUSH_VAPID_PRIVATE_KEY_FILE` (PEM), `MEERKAT_PUSH_VAPID_PUBLIC_KEY`
  (base64url), `MEERKAT_PUSH_VAPID_SUBJECT` (a `mailto:` or `https:` contact).

Obtaining and provisioning the real Apple/Google/VAPID credentials is founder-ops.

## Compose

`deploy/compose.production.yml` has a `push` service on port 8895 (first-party postgres,
metrics on 9895, verify-full TLS). Its provider credentials are Docker file secrets
(`push_apns_key`, `push_fcm_service_account`, `push_vapid_private_key`); the token keyring
is a read-only bind of a host directory (Docker file secrets are single files, and the
keyring is a directory). Set `PUSH_DATABASE_URL`, `PUSH_TOKEN_ACTIVE_VERSION`,
`PUSH_TOKEN_KEYS_DIR`, the `PUSH_APNS_*` / `PUSH_VAPID_*` vars, and the `*_FILE` secret
paths in the compose env. `docker compose config` parses with a complete env.

## Client

The RN-safe `PushGatewayClient` (packages/sync, exported from both barrels) registers the
install token binding, rotates and unregisters it, mints and revokes wake capabilities to
share with a peer through an encrypted paired flow, and sends opaque wakes by capability.
It uses `fetch` only (no node: imports), returns typed results, and never throws a raw
fetch error. The legacy `PushRelayClient` facade keeps
`register`/`unregister`/`sendWakeNotification`/`isRegistered`/`getServerUrl` working as a
superset over the same gateway client.

## Honest status

- The server-side push protocol (APNs HTTP/2 + ES256 JWT, FCM v1 + RS256 OAuth, Web Push
  VAPID + RFC 8291 aes128gcm) is real and unit-proven against local fake servers, plus a
  live-PostgreSQL one-wake integration driving the fenced attempt loop to
  `provider_accepted` with the fake provider.
- Real device delivery on signed builds against real Apple/Google/VAPID credentials and
  the physical-device matrix (AC-42.6, AC-42.9, AC-42.11) remains founder-ops and is not
  provable in-repo. No authored-but-unproven path claims that evidence.
