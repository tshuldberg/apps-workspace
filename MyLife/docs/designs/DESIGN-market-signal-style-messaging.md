# Signal-Style Messaging for MyMarket

Date: 2026-03-10
Status: In progress

## Why this exists

The product goal is private buyer-seller contact without exposing phone numbers, plus messaging that is meaningfully closer to Signal than to server-encrypted chat. That requires a concrete protocol boundary, not just encrypted text fields.

## Official constraints

- Signal uses PQXDH for asynchronous session bootstrap.
- Signal uses Double Ratchet for per-message secrecy and post-compromise recovery.
- Signal uses Sesame for multi-device session fanout.
- Signal uses safety numbers and Key Transparency for identity verification.
- Signal usernames, QR codes, and share links allow connection without exposing a phone number.
- Signal's public `libsignal` package is not a direct Expo or browser drop-in for MyLife. The public repo says use outside Signal is unsupported, and the TypeScript bindings rely on a native Node module.

## What this pass implements

This pass establishes the MyMarket server and client contract that a Signal-style client needs:

- `mk_message_requests`
  - Buyer-created conversation request tied to a listing and conversation
  - Optional `friend_link_id` to connect Market trust with MyLife social trust
  - Explicit `pending`, `accepted`, `rejected`, `blocked`, and `expired` states
- `mk_secure_devices`
  - Per-device identity registration
  - Registration IDs
  - Sealed-sender and post-quantum capability flags
- `mk_signed_prekeys`
  - Signed device prekeys
- `mk_one_time_prekeys`
  - Curve and post-quantum one-time prekeys
  - Last-resort PQ prekey support
- `mk_claim_recipient_prekey_bundles(recipient_user_id uuid)`
  - Server-side claim endpoint for public bundles
  - Consumes one-time prekeys when claimed
  - Returns empty when either side has blocked the other
- `mk_secure_messages`
  - Per-device ciphertext envelopes
  - Request-aware prekey bootstrap messages
  - Delivery metadata without plaintext content

The Market client now exposes:

- `cloudCreateConversationRequest`
- `cloudRespondToConversationRequest`
- `cloudRegisterSecureDevice`
- `cloudGetRecipientPreKeyBundles`
- `cloudGetSecureEnvelopes`
- `cloudSendSecureEnvelope`

Listing `message_count` and conversation `last_message_at` now refresh across both legacy plaintext rows and secure-envelope rows.

## What this pass does not claim

This is not full Signal-equivalent E2EE yet.

The following are still missing:

- Client-side PQXDH session setup
- Client-side Double Ratchet state and key rotation
- Multi-device session orchestration equivalent to Sesame
- Safety-number UI and verification state
- Key Transparency integration
- Encrypted media attachment transport
- Recovery and device-change UX
- Push delivery mechanics for offline devices
- Moderation and report UX for ciphertext-only chats

## Product decisions reflected here

- Contact exchange should happen through MyLife identity, not phone numbers.
- Friend-link codes remain useful for social trust and can optionally be attached to a Market conversation request.
- Market supports goods, service offers, service requests, barter, and cash pricing in one module.
- Seller blocking must stop further secure-bundle exchange.

## Rollout plan

1. Keep the existing `mk_messages` path as legacy transport only while secure clients are built.
2. Move new Market chat UI to `mk_message_requests` plus `mk_secure_messages`.
3. Implement client-side key storage and ratchet state on mobile first.
4. Decide whether web gets a browser-compatible protocol implementation or ships later than mobile.
5. Add safety-code verification UI before claiming Signal-like protection in product copy.

## Runtime note

The current Expo mobile app and Next.js web app should not pretend to run official Signal client code today. The correct immediate posture is:

- Server contract ready for Signal-style clients
- Product copy should say secure messaging is in progress unless the full client protocol is actually live
- Any remaining AES helper is legacy and not sufficient for Signal-grade claims
