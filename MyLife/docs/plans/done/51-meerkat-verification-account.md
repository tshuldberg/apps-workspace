# Plan 51: Meerkat Verification Account + Blind Credential Layer

- **Status:** queue
- **Owner:** unassigned (execution session)
- **Created:** 2026-07-20
- **Depends on:** merged main at `9f174c0b`+ (age gate + export declaration), rc9 ledger
- **Founder decisions encoded here:** two-identity model adopted (2026-07-20 session); store-first purchasing (agenda item 13) pending counsel but designed for; blind credential (Grade 2) is the design target with policy-unlinkable (Grade 1) as an explicitly labeled interim only if counsel approves.
- **Legal context:** `docs/reports/REPORT-meerkat-legal-readiness-2026-07-18.md` Sections 3, 8, 10 and agenda items 4, 9, 13.

## Product architecture (binding)

1. **Verification account (outer layer).** Sign in with Apple / Google SSO creates a minimal account that stores ONLY: provider subject identifier (and relay email if provided), human-verification status, age-verification status (store age signal where lawful, else pointer to the in-app neutral gate outcome), parental-consent state where required, entitlement state (app unlock, hosted subscription), and credential-issuance bookkeeping (epoch, revocation flags). NOTHING else. No personas, no keys, no content, no device identifiers from the inner layer.
2. **Meerkat identity (inner layer).** Unchanged: device-held keypair, E2EE, zero-knowledge relays. Created AFTER verification, never registered with the account layer.
3. **The one-way wall.** The inner layer proves "some verified account backs me" via an anonymous credential. Target: blind-signed, Privacy Pass shaped (server signs a blinded token; presentation is unlinkable to issuance). The server MUST NOT persist any account-to-persona mapping. All copy claims must match the implemented grade: "cannot link" only when blind issuance ships; "do not link" for any interim.
4. **Bans and repeat infringers.** Credentials are epoch-scoped and renewable. Enforcement: revoke the presented credential with the actioned persona AND flag the issuing account at the account layer (refuse renewal). No persona-to-account map is ever stored; the linkage dies with the credential. IP addresses are NOT an identity or ban mechanism (see Non-goals).
5. **Purchasing.** Entitlement binds to the verification account (replacing device-receipt-only). Store rails preferred; cross-rail link codes retire in favor of account-carried entitlement once counsel clears item 13. Web Stripe unlock stays behind a config flag until then.

## Non-goals / guardrails

- NO IP-based identity or bans. Shared CGNAT/VPN IPs punish bystanders, evasion is trivial, and retaining IPs contradicts the zero-knowledge relay posture and the Law Enforcement Guidelines draft. Edge rate-limiting of abusive traffic remains allowed as ephemeral, non-persisted throttling only.
- NO analytics, no additional metadata capture riding along with the account layer.
- NO weakening of the existing in-app neutral age gate: it remains the universal floor; the account layer consumes store age signals where counsel approves.
- The relay stays zero knowledge; the account service is a SEPARATE deployable (persona-service lineage), never merged into the relay image.

## Phases

- **P0 Design + schema.** Threat model the wall (issuance/redemption timing correlation, quota side channels). Account tables under a new `account.` schema in the meerkat-relay PostgreSQL substrate with least-privilege role. Credential format (RSA blind signatures or VOPRF; pick with a documented rationale), epoch length, renewal and revocation semantics. Deletion design: account deletion vs inner-data deletion (independent flows).
- **P1 Account service.** Sign in with Apple + Google token verification (server-side), account store CRUD, entitlement binding (App Store Server API / Play Developer API / Stripe webhooks), verification-state recording. Fail-closed: unconfigured providers refuse sign-in honestly.
- **P2 Blind credential issuance + verification.** Issue epoch-scoped blinded credentials to verified accounts (one active public credential per account). Verifier middleware for public-layer surfaces (publish, archive intake, persona registration) accepting credential presentation instead of / alongside the current purchase-proof path. Revocation list keyed by credential serial, never by account.
- **P3 Client integration.** Mobile + web: SSO sign-in screen at the entitlement boundary (NOT at app first-launch; private mesh stays account-free), credential mint + storage in the secret store, presentation on public-layer actions. The age gate consumes a store age signal when the account layer provides one (skip/pre-fill), else runs as today.
- **P4 Enforcement migration.** Repeat-infringer flow: actioned persona -> credential revocation -> account renewal refusal; operator console lane shows credential-serial evidence only. Retire `appAccountToken` guidance remnants; assert no account-to-persona columns exist (schema guard test).
- **P5 Deletion + data-subject surface.** Account deletion endpoint (SSO re-auth, deletes account row + revokes credentials; states plainly it does not and cannot touch inner-layer data). Privacy Policy data-inventory alignment. Runbook Step 10 deletion evidence extended to the account layer.
- **P6 Docs + gates.** Report Section 10 update to implemented reality, Terms/Privacy draft sync, CLAUDE/AGENTS pairs (meerkat app + relay), parity checks extended, full battery + typecheck + `check:parity`, new RC cut with ledger notes.

## P2 credential scheme rationale (decided 2026-07-20, before P2 implementation)

**Decision: RSA blind signatures (RFC 9474 RSABSSA, the Privacy Pass publicly verifiable token shape) over VOPRF.**

1. **Public verifiability is the deciding factor.** Verifier middleware runs on relay-adjacent public surfaces (community node publish, archive intake, persona registration). With RSA blind signatures those surfaces verify with only the epoch public key. With VOPRF (privately verifiable), every verifier would need either the issuance secret key inside its image, which puts account-layer key material into relay-lineage deployables and violates the separation guardrail, or an online verification call to the account service per presentation, which creates exactly the timing correlation channel the P0 threat model exists to close.
2. **Dependency surface.** RSABSSA needs node:crypto raw RSA operations plus BigInt modular arithmetic for blind/unblind, all standard library. VOPRF needs ristretto255 or P-384 group arithmetic via a new third-party dependency in the most security-critical path of the codebase. The relay package currently carries only tweetnacl and node:crypto; keeping it that way is worth more than VOPRF's smaller tokens.
3. **Privacy Pass alignment.** The plan targets "Privacy Pass shaped." RFC 9578 defines both shapes; the publicly verifiable token type is blind RSA per RFC 9474. Choosing it keeps the format compatible with the published standard rather than a hand-rolled variant.
4. **Accepted trade-offs.** Larger credentials (256-byte signatures at RSA-2048) and slower issuance than VOPRF. Issuance volume is one credential per account per epoch, so throughput is irrelevant. Epoch key rotation (one RSA keypair per epoch, public keys published for verifiers) bounds any single key's exposure.
5. **Enforcement mechanics without a persona-to-account map.** Renewal requires presenting the expiring credential to the account service, which checks the serial against the serial-only revocation list: revoked serial means flag the account and refuse renewal; clean serial means blind-issue the next epoch and discard the serial without persisting it. Serial may co-locate with persona identifiers at the moderation layer; serial must never be stored or logged with an account identifier anywhere. The schema guard and log-hygiene canary enforce that invariant, so no durably stored data can join an account to a persona. The transient renewal-time serial sighting is the documented residual (see threat model); honest copy for the shipped grade states unlinkability as a property of what the service stores and can be compelled to produce.

## Acceptance criteria

- AC-1: A verified account can mint exactly one active public credential per epoch; presentation verifies without the server learning which account minted it (Grade 2 test: issuance transcript and presentation transcript share no linkable values).
- AC-2: No table, log line, or metric contains both an account identifier and a persona/device key identifier; schema guard + log-hygiene canary enforce this.
- AC-3: Revoking an actioned persona's credential blocks renewal for the flagged account without creating a persona-to-account row.
- AC-4: Private mesh use (communities, DMs, sync) requires no account sign-in anywhere.
- AC-5: Account deletion works with entitlement lapsed, revokes credentials, and leaves inner-layer data untouched with honest copy.
- AC-6: Unconfigured SSO/providers fail closed with honest UI; nothing fabricates a verified state.
- NC-1 (negative): a forged or replayed credential is rejected; a revoked serial is rejected; a second concurrent credential for one account is refused.

## Founder-ops (outside this plan's code)

Apple Sign in with Apple capability + service id, Google OAuth client ids, App Store Server API / Play / Stripe credentials, counsel sign-off on Grade 1 vs Grade 2 launch claim and item 13 (store-only purchase), production deploy of the account service.
