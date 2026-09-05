# Feature Spec: Humanity Verification (Anti-Bot Credential for Shared-Network Participation)

> Meerkat launch plan 24. A privacy-preserving "prove you are a human once" step that
> gates participation in the SHARED network (public joins, public posting, first publish,
> hosted signup) while storing zero PII. Founder mandate (2026-07-01): "To have an account
> and use the platform, there must be a system to verify that someone is a human being.
> We won't store this info but we will have a verification step we hold for each sign up.
> This is intended to reduce bots."

## Reconciliation Status (2026-07-07)

Status: Done for codeable launch scope. Moved from `docs/plans/queue/` to
`docs/plans/done/` after verification against local `main` (`3807c60b` before this
docs-only reconciliation). Verified anchors include `protocol/humanity-credential.ts`,
`humanity-service.ts`, durable file store, verifier adapters, HTTP service,
route guards, `requireHumanityToken`, mobile/web `VerifySheet`, mobile/web
`humanity-core`, wallet spend/restore logic, public join/publish integration, and
parity locks. The blind-RSA or Privacy Pass upgrade remains a future privacy upgrade
that needs a vetted library and a fresh founder decision; it is not a launch blocker.
Service deploys, attestation provider credentials, Turnstile keys, and device QA
remain founder-ops in the runbook.

## Metadata

- **Surfaces:** `packages/sync` (pure credential protocol), `packages/meerkat-relay`
  (verification service + enforcement gates), `apps/meerkat`, `apps/meerkat-web`
- **Priority Score:** 45 / 50 (A-Tier). Open public posting (Plan 26) is not shippable
  without it; bot floods would define the public network's first impression.
- **Estimated CC Time:** 6-8 focused sessions.
- **Depends On (hard):** none for the protocol + service; Plan 20's deployed relay infra
  patterns (founder-ops) for the service deploy.
- **Blocks:** Plan 26 (open posting gates), Plan 22 Phase 2 (hosted signup gate), the
  public-join gates in Plan 19's FF3 close-out.
- **INTERPRETATION FLAG (founder review requested, does not block build):** Meerkat has no
  accounts by design; identity is a local device key created offline
  (`IdentityProvider.tsx:78-112`, zero server contact). This plan therefore gates
  NETWORK-TOUCHING shared participation, not app install or private/local use. Private
  communities, device pairing, LAN sync, and DMs between paired friends never require
  verification. If the founder intends verification even for private relay use, add the
  gate to relay `join` verbs in P3 (one extra enforcement point; noted there).

---

## Business Context

### Why

Every open network dies by bots first. The public layer (free viewing, open posting,
public joins) is the growth surface and also the abuse surface. Competitors solve this
with accounts + phone numbers + surveillance; Meerkat's promise is the opposite: prove
personhood once, anonymously, and keep zero stored PII. The verification step is held
per signup (per device joining the shared network), not per action visible to users.

### Privacy model (honest, stated in-app)

- The verification service learns: an attestation verdict (this is a real iOS/Android
  device or a human-passed challenge) and an issuance timestamp/IP during the exchange.
  It stores: hashed spent-token ids and a per-attestation-key issuance count. It stores
  NO name, email, phone, device id, or identity key, and tokens are NOT linked to the
  Meerkat identity (the client never sends its device public key during issuance).
- Correlation limits at launch: tokens are signed (not blind-signed), so the issuer could
  in principle correlate a redemption to an issuance batch by time window. This is
  documented honestly. The upgrade path to full unlinkability (RFC 9578 blind RSA /
  Privacy Pass) is Phase 6, gated on a vetted library, because `@mylife/sync` policy is
  to never hand-roll crypto (repo mandate; verified: no VOPRF/blind-RSA/BLS primitive
  exists anywhere in the repo, only tweetnacl Ed25519/X25519/secretbox + HMAC).

### Solution space explored (locked recommendation)

| Option | Verdict |
|--------|---------|
| Phone/SMS verification | REJECTED: PII, cost, exclusion, SIM farms defeat it |
| World ID / biometric PoP | REJECTED: hardware dependency, brand mismatch |
| Pure CAPTCHA per action | REJECTED: farms defeat it, UX tax on every action |
| Proof-of-work | REJECTED: burns batteries, GPUs defeat it |
| Platform attestation (iOS App Attest / Play Integrity) + one-time signed tokens | **CHOSEN for launch**: strongest per-device bot cost, silent UX on real devices, zero PII |
| Web + fallback: Cloudflare Turnstile server-verified challenge | **CHOSEN fallback** (web clients, Expo Go, attestation-unavailable devices) |
| Privacy Pass / blind RSA (RFC 9578) | Phase 6 upgrade for unlinkability once a vetted lib is validated (`@cloudflare/blindrsa-ts` candidate) |

Rate economics: one verified device grants a wallet of 32 single-use tokens with silent
re-attestation refill at a low watermark (8). Each gated action spends one token. A bot
farm must scale real attested devices, not requests.

---

## Current-State Grounding (verified 2026-07-01)

| Fact | Anchor |
|------|--------|
| Identity creation is offline/anonymous; cannot be the gate | `apps/meerkat/app/(root)/providers/IdentityProvider.tsx:78-112`; `OnboardingGate.tsx` |
| Bearer-token verify template to clone for gates | `packages/meerkat-relay/src/community-node-http.ts:502-531` `requireHostedEntitlement` |
| Entitlement token shape/serialize pattern (HMAC, base64url) | `packages/entitlements/src/meerkat-hosted.ts:124-174` |
| Separate deployable service precedent | `packages/meerkat-relay/src/public-directory-node.ts` + `bin/meerkat-public-directory-node.mjs` |
| Single-use grant + rotate-to-revoke precedent | `PublicJoinGrant.grantId`, `packages/sync/src/protocol/publication.ts:81-87,252-261` |
| Join gates to enforce at | `packages/sync/src/protocol/public-join.ts:50-82` `redeemPublicJoinGrant`, `:156-191` `queuePublicJoinRequest` |
| Publish gate to enforce at | `community-node.ts:1017-1106` `registerPublication`; app `public-publish.ts` |
| No attestation/CAPTCHA dep exists anywhere (green-field) | repo-wide grep verified |
| Relay rate-limit env pattern | `packages/meerkat-relay/src/protocol.ts:89-117` `resolveRelayLimits` |

---

## Architecture

```
packages/sync/src/protocol/humanity-credential.ts   -- NET-NEW, pure:
  HumanityToken { version:1, tokenId(32B hex), issuedAt, expiresAt, sigEd25519 }
  canonicalHumanityTokenBytes / signHumanityToken (service-side) /
  verifyHumanityToken(token, servicePublicKey) -> 'ok'|'expired'|'invalid'
  (domain string 'meerkat-humanity-v1'; clones the publication signing pattern)

packages/meerkat-relay/src/humanity-service.ts      -- NET-NEW service core (DI, testable):
  POST /humanity/challenge  -> { challengeId, appAttestNonce | playIntegrityNonce | turnstileSiteKey }
  POST /humanity/issue      -> body: { challengeId, attestation } ; verifies via injected
                               verifier (AppAttestVerifier | PlayIntegrityVerifier |
                               TurnstileVerifier), issues batch of 32 signed tokens.
                               Stores: sha256(attestationKeyId) -> issuedCount (cap 3/day),
                               NOTHING else.
  POST /humanity/redeem     -> { token } ; verify sig + expiry + not-spent; record
                               sha256(tokenId) in spent store; returns { ok } | { reason }.
  SQLite store (spent hashes + issuance counts), TTL pruning, env-tunable caps
  (HUMANITY_LIMIT_* via the resolveRelayLimits pattern).
packages/meerkat-relay/bin/meerkat-verification-service.mjs -- NET-NEW third deployable.

Enforcement gates (each: token in header, verify LOCALLY with service pubkey, then
POST /humanity/redeem for double-spend; fail-closed on service unreachable):
  community-node-http.ts: requireHumanityToken(feature) middleware clone of
    requireHostedEntitlement; applied to public-join park route, Plan 26 open-post
    submit route, registerPublication FIRST-revision route.
  hosted-api.ts (Plan 22 seam): signup/checkout requires one token.

apps/meerkat/app/(root)/data/humanity-core.ts       -- NET-NEW: wallet in mk_settings
  (humanity_tokens JSON, service url + pubkey pinned from app config), spend/refill
  logic, capability probe (App Attest native via lazy require, Turnstile fallback).
apps/meerkat/app/(root)/components/VerifySheet.tsx  -- NET-NEW: one-time UX ("Confirm
  you're human to join public communities"), silent on attested devices, WebView
  Turnstile fallback; honest failure states.
apps/meerkat-web/src/lib/humanity-core.ts + ui/verify/VerifySheet.tsx -- twins
  (Turnstile only on web).
```

Key decisions:
1. Tokens are ISSUER-signed Ed25519, single-use, expiring (90 days), NOT bound to the
   Meerkat identity key. The client wallet never presents the same token twice.
2. Verification is per DEVICE joining the shared network (the founder's "per sign up"),
   with silent refills. Losing the wallet just re-verifies.
3. Gates fail CLOSED (no token -> action refused with the VerifySheet CTA), and private
   /local flows never touch a gate.
4. The service is a third deployable, separate from paid entitlements, because
   `hosted-api.ts` `authorize()` is account-tied and verification must not be.
5. No new crypto: Ed25519 sign/verify via the existing tweetnacl wrappers.

## Phases

- **P0 protocol:** `humanity-credential.ts` + tests (sign/verify/expiry/domain-separation
  vs publication + DM domains; canonical bytes stability).
- **P1 service core:** `humanity-service.ts` with injected verifiers + SQLite store +
  caps; unit tests with fake verifiers (issue batch, redeem once, double-spend rejected,
  issuance cap per attestation key, TTL prune); bin + Dockerfile.verification + deploy
  blueprint (clone public-directory-node's).
- **P2 real verifier adapters:** AppAttestVerifier (Apple JWS assertion verify against
  Apple root, node-side), PlayIntegrityVerifier (Google API call), TurnstileVerifier
  (siteverify call). Each DI'd + env-configured; contract tests with recorded fixtures.
- **P3 enforcement gates:** `requireHumanityToken` middleware + apply to public-join park
  route and registerPublication first-revision; engine-side: `redeemPublicJoinGrant` and
  `queuePublicJoinRequest` accept an optional `humanityToken` param the app supplies
  (kept optional in the engine signature so private/test paths are unaffected; the
  NODE enforces). Plan 22/26 seams documented. Optional founder flag: relay join-verb
  gate (see Interpretation Flag).
- **P4 mobile wallet + UX:** humanity-core, VerifySheet, wiring into the public-join CTA
  and publish sheet; lazy attestation module probe (Expo Go -> Turnstile fallback);
  settings row "Verified device" with honest copy; refill at watermark.
- **P5 web parity + parity guards.**
- **P6 (upgrade, post-launch-candidate but scoped now):** blind-RSA Privacy Pass issuance
  (RFC 9578) via a vetted library behind the same wallet API; founder decision point on
  library trust; tokens become unlinkable issuance-to-redemption.

## Acceptance Criteria

- AC-1: A fresh real-device install can verify silently (attestation) and join an open
  public community in one tap; the service DB contains no PII afterward (test asserts
  schema: only hashes + counters).
- AC-2: A spent token replayed to any gate is rejected (`already_spent`).
- AC-3: With the service unreachable, gated actions fail closed with honest copy; nothing
  local breaks; private flows unaffected (full regression suite green with no service).
- AC-4: Expo Go / web fall back to Turnstile; no native crash when modules are absent.
- AC-5: Issuance capped per attestation key (3 batches/day) and per IP window; verified by
  service tests.
- AC-6: No gate exists on identity creation, pairing, LAN sync, private communities, or
  DMs (negative tests).

## Negative Criteria

- NC-1: Never store or transmit name/email/phone/device-identity-key to the service.
- NC-2: Never bind a token to the Meerkat device key at issuance.
- NC-3: Never hand-roll crypto; Ed25519 via existing wrappers only; P6 only via a vetted
  external library after founder sign-off.
- NC-4: Never block offline/local functionality on verification.

## Test Plan

Tier A: protocol pure tests. Tier B: service integration (fake verifiers, double-spend,
caps). Tier C: app wallet/UX with mocked service; parity twins. Tier D (founder QA): real
App Attest on a physical iPhone, Play Integrity on Android, Turnstile on web; service
deployed; end-to-end public join with verification.

## Founder-Ops

Apple Developer App Attest capability; Google Cloud Play Integrity API enablement;
Cloudflare Turnstile site + secret; deploy the verification service (third image) with
`HUMANITY_SIGNING_KEY` (Ed25519 seed) + verifier env; pin the service pubkey + URL in
`app.config.ts` extra and web env; runbook section to be appended.

## Status Delta (2026-07-05)

- P0-P2 built under Plan 37 Wave 1: credential protocol, credential batch issue/verify/parse helpers, service core with in-memory store/caps/sweep/stats, HTTP challenge/issue/redeem surface, Turnstile/Play Integrity/App Attest verifier adapters, and production-safety checks for stub verifiers.
- P3 foundation built as a pure engine seam: `checkHumanityGate` verifies gate-required actions, domain, expiry, and double-spend state with focused tests.
- P3 route enforcement is not complete yet: the node middleware and public-join/registerPublication enforcement points still need to call the gate before Plan 26 can consume it.
- Verified: `pnpm --filter @mylife/sync test -- session-token auto-connect-plan auto-connect-schema auto-connect-job local-join-handoff humanity-credential humanity-gate`, `pnpm --filter @mylife/meerkat-relay test -- community-node-dos-hardening humanity-service humanity-verifiers`, sync/relay typechecks, and `node scripts/check-meerkat-parity.mjs`.
- Remaining codeable: finish P3 route enforcement, then P4 mobile wallet/UX, P5 web parity, and P6 blind-RSA scoping.
