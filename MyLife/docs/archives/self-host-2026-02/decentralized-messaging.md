# Decentralized Local-First Messaging

Date: 2026-02-25
Status: Local-first client sync + federation transport implemented (HMAC-signed delivery + outbox retries).

## Goal
Enable customers who choose `self_host` or `local_only`-first behavior to keep core data on their own device/server while still sending and receiving friend messages over the internet.

## Architecture

### 1. Local-First Client Data (required)
- Source of truth for personal app data remains local SQLite on device.
- Message drafts, sent messages, and fetched messages are cached locally for offline use.
- Network sync is additive: if offline, app still works and retries outbound network calls later.
- Client outbox/inbox sync loop now runs in both web and mobile book detail flows.

### 2. Personal Node per Customer (implemented)
- Each self-host customer runs their own MyLife API + Postgres via `deploy/self-host/docker-compose.yml`.
- Friend graph and direct messages live in that customer's Postgres:
  - `friend_invites`
  - `friendships`
  - `friend_messages`
- Current API primitives:
  - `POST /api/friends/invites`
  - `POST /api/friends/invites/{inviteId}/accept`
  - `POST /api/messages`
  - `GET /api/messages`
  - `GET /api/messages/inbox`
  - `POST /api/messages/{messageId}/read`

### 3. Federation Across Customer Nodes (next)
To support friend messaging between different self-host instances (for example `alice@node-a.com` and `bob@node-b.com`):
- Stable user addressing is supported with `<user-id>@<server-domain>`.
- Signed server-to-server inbox endpoint is implemented:
  - `POST /api/federation/inbox/messages`
- Outbound delivery queue is implemented:
  - `federation_message_outbox` with exponential backoff retry
  - terminal `failed` state after max attempts
- Replay protection is implemented:
  - `federation_inbox_receipts` keyed by `(sender_server, client_message_id)`
- Dispatch worker endpoint is implemented:
  - `POST /api/federation/dispatch`

## Minimal Data Contract

```text
friend_messages
- id
- client_message_id (idempotency)
- sender_user_id
- recipient_user_id
- content_type (text/plain | application/e2ee+ciphertext)
- content
- created_at
- read_at
```

For federation transport:
- `sender_server`
- `recipient_server`
- `delivery_status` (`pending`, `sent`, `acked`, `failed`)
- `delivery_attempts`
- `last_delivery_error`

## Security Requirements
- Require accepted friendship before message send/read APIs.
- Prefer `application/e2ee+ciphertext` payloads for private content.
- Use HTTPS only for internet-facing deployments.
- Keep local entitlement verification independent from message delivery.

## Recommended Rollout
1. Ship current instance-local messaging APIs in self-host mode (done).
2. Add client outbox/inbox sync loop with local queue + retries (done).
3. Add federation inbox/outbox endpoints and signed server-to-server delivery (done).
4. Add key management UX for optional E2EE across servers (next).

## Why This Matches MyLife Principles
- Preserves local ownership by default.
- Does not require a central MyLife relay for single-instance self-host usage.
- Keeps one shared feature contract for hosted and self-host, with only endpoint origin and federation path differing.
