# Meerkat Plan 51: Verification Account + Blind Credential Layer

Date: 2026-07-20
Branch: `feature/meerkat-plan51-verification-account` (off `main` at `15d2f464`)

## Goal

Implement the two-identity model: a minimal verification account (Sign in with
Apple / Google) holding only verification checks + purchase entitlement, kept
cryptographically unlinkable from the in-app device identity via an anonymous
blind-signed credential. All of Plan 51 phases P0-P6, satisfying AC-1..AC-6 + NC-1.

## What shipped

### P0 - design + schema
- `docs/designs/meerkat-account-verification-architecture.md`: threat model
  (issuance/redemption timing, quota side channels, renewal serial residual,
  DB compromise), lifecycle, deletion design.
- Documented RSABSSA-over-VOPRF rationale in the plan file (public verifiability
  keeps account-layer secrets out of relay-lineage verifiers).
- Migration `0018-account-credential.ts`: new `account.` + `credential.` schemas
  with the one-way-wall column invariant; `meerkat_account` role appended last;
  read-only bridge grants for the three presentation surfaces; moderation
  serial-revocation INSERT.

### P2 - blind credential core
- `@mylife/sync` `protocol/blind-credential.ts`: pure, RN-safe RFC 9474 RSABSSA
  (SHA-512, BigInt): PSS encode/verify, blind/unblind, SPKI parse, epoch math,
  serial derivation, bearer codec. `finalize` verifies before returning.
- `meerkat-relay` `blind-credential-server.ts` (issuer RSA keygen + raw blind
  sign + AES-256-GCM key sealing) and `credential-verify.ts` (fail-closed local
  presentation verifier: epoch public key + serial revocation only).

### P1/P5 - account service (separate deployable, persona-service lineage)
- `bin/meerkat-account-service.mjs` + `account-service.ts` / `-http.ts`:
  SSO token verification (injected JWKS, fail-closed), account/entitlement/
  issuance stores (memory/file/PostgreSQL), HMAC account sessions (distinct
  domain), entitlement webhooks (fail-closed per rail), public epoch-key
  discovery route, blind issuance (eligibility-before-quota so an ineligible or
  malformed request never burns the epoch slot; uniform refusal shape), renewal
  with revoked-serial account flagging that never persists a serial, SSO-re-auth
  deletion with client-submitted serial burn and `account_layer_only` scope.

### P2/P4 - surface wiring + enforcement
- `x-mk-credential` accepted as the alternative to the humanity proof on community
  submit, persona registration, and archive intake; no downgrade on a bad
  credential; dead evidence sink fails closed; serial co-locates with persona
  identifiers only. Operator console `revokeCredentialSerial` +
  `POST /api/actions/revoke-credential` (serial-only evidence).
- Log-hygiene canary extended with the account-service as a sixth service leg;
  redaction denylist extended.
- AC-2 schema wall guard (`account-wall-guard.test.ts`): static analysis over
  every migration + role manifest.

### P3 - clients
- Mobile (`apps/meerkat`) + web (`apps/meerkat-web`): SSO sign-in at the
  entitlement boundary (not first launch), credential mint/store in an isolated
  keychain/IndexedDB namespace, presentation on public-layer actions, store age
  signal consumed by the shared age gate (adult-only skip, never a lock).
  AC-4 import-graph guards prove private mesh imports nothing from the account
  layer. Web SSO uses redirect-based OIDC so the CSP `script-src` is never
  widened (no third-party script loaded).

### P6 - docs + gates
- Legal report Section 10 flipped `adopted` -> `implemented` with the truthful
  **Grade 2 for stored data** claim and the renewal-serial residual documented.
- `meerkat-relay` + `apps/meerkat` CLAUDE.md/AGENTS.md pairs updated.
- Runbook Step 10 gains account-layer deletion evidence; Terms/Privacy drafts
  synced to the shipped grade.

## Orchestration

Fable authored the plan-level rationale, the P0 schema/migration/roles, the P2
crypto core, the AC-2 wall guard, and the AC-4 client guards directly, then ran
four parallel subagents (account service, surface wiring, mobile client, web
client) against a lead-authored contract. Fable verified each agent's output
against primary evidence (independent test reruns + diff review), fixed the
issuance quota-ordering side channel during review, resolved the epoch-key
discovery contract gap, ruled on redirect-OAuth over CSP widening, and
reconciled the mobile/web `public-publish.ts` twin drift (`credentialHeaders`).

## Verification

- `@mylife/meerkat-relay`: 1587 passed, 0 failed (full package).
- `apps/meerkat`: 1408 passed. `apps/meerkat-web`: full suite green.
- `@mylife/sync` blind-credential: 17 tests (AC-1 transcript disjointness, NC-1
  tamper/forgery). `check:parity`: all Meerkat checks pass.

## Founder-ops remaining

Live Apple service id + Google OAuth client ids, App Store Server API / Play /
Stripe webhook credentials, production deploy of the account service, and
counsel sign-off on the Grade 2 launch claim + agenda item 13 (store-only
purchase). Same lane as NCMEC and the DMCA agent.
