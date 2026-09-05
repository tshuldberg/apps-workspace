# MyNews Full Production-Readiness Remediation

**Created:** 2026-07-11  
**Status:** Active  
**Source review:** `docs/reports/REPORT-mynews-adversarial-production-readiness-2026-07-11.md`  
**Release rule:** Every workstream ships together at full function. No public-launch capability is deferred, stubbed, or represented as complete without objective evidence.

## Outcome

Launch a fully operational MyNews product across iOS, Android, public web, moderator console, Supabase, safety operations, payment operations, and store listings. The release must make every product and legal claim true in deployed behavior and pass all launch gates below.

## A. Domain, identity, and public trust

- [ ] Acquire and verify the approved production domain or select a controlled replacement.
- [ ] Configure DNS, HTTPS, HSTS, DNSSEC where supported, SPF, DKIM, DMARC, and monitored mailboxes.
- [ ] Prove delivery and escalation for legal, safety, privacy, support, and DMCA contacts.
- [ ] Replace every placeholder origin, URL, email, deep link, RSS/OG value, and store metadata value.
- [ ] Add automated domain ownership, TLS, DNS, MX, and inbox delivery probes.

## B. Subscriptions and journalist support

- [ ] Implement RevenueCat/App Store/Play subscription purchase, restore, entitlement, cancellation, refund, and server notification flows.
- [ ] Implement policy-compliant journalist support with processor onboarding, KYC, payment creation, idempotency, signed webhooks, ledgering, receipts, refunds, disputes, chargebacks, payout states, reconciliation, tax reporting, fraud, and operator tooling.
- [ ] Separate platform subscription value from journalist transfers in policy, data, UI, and accounting.
- [x] Implement journalist earnings, payout, reader support history, fee math, and failure/retry UX. (c792cb38 + Wave 3 2026-07-30 payout attribution v2 + stable-idempotency retries)
- [ ] Obtain store-policy, finance, tax, and counsel approval for the production architecture.

## C. Identity, key custody, and account lifecycle

- [x] Implement encrypted key backup, recovery codes, import/export, rotation, revocation, multi-device approval, and lost-device recovery. (Wave 4 2026-07-30, WP6; no-kit recovery honestly unavailable until a notification provider ships)
- [x] Threat-model server escrow, user-held recovery, device compromise, and recovery-social-engineering risks. (docs/designs/mynews-key-custody.md rev 2, opus-reviewed; implemented Wave 4)
- [x] Implement in-app account deletion, web deletion request, reauthentication, confirmation, cancellation, auth revocation, and durable job status. (Wave 3 2026-07-30; web page is informational until web auth lands in WP10, honest by design)
- [x] Implement complete personal-data export and processor cleanup. (Wave 3 2026-07-30; processor cleanup is a real https hook, skipped-unconfigured until founder-ops)
- [x] Define and implement signed-public-content retention, anonymization, deletion exceptions, legal holds, and user disclosure. (Wave 3 2026-07-30, nw_account_deletion_dispose + privacy copy)
- [ ] Prove deletion/export/recovery behavior across iOS, Android, web, Supabase, payment processors, and email providers.

## D. Trust, safety, and legal operations

- [ ] Replace report insertion plus NCII case creation with one transactional, severity-upgradable RPC.
- [ ] Add orphan reconciliation, deadline alerts, idempotency, retry, and audited urgent-case drills.
- [ ] Build authoritative media upload/storage/quarantine, immutable asset IDs, hashing, approved vendor matching, human review, and required external reporting.
- [x] Build a first-class DMCA and counter-notice console queue with correct separate schemas, assignment, SLA, communications, restoration, strike linkage, and audit. (c792cb38 + Wave 2 2026-07-30: profile restoration, enforcement-wide strike linkage, manual-attested forwarding)
- [x] Resolve public URLs to authoritative targets before accepting a notice as queued. (Wave 2 2026-07-30: vocabulary matches live routes + route-drift test)
- [x] Implement pre-publication text/link/media filtering, risk scoring, quarantine, human review, appeals, restoration, and false-positive measurement. (Wave 4 2026-07-30, WP8; media upload path still does not exist, so media filtering applies at the link/citation layer)
- [x] Expand report reasons and SLA routing for child safety, hate, self-harm, privacy/doxxing, fraud, impersonation, threats, NCII, copyright, spam, and other policy classes. (Wave 4 2026-07-30, WP8)
- [ ] Enforce current Terms and suspension across every mutation path while preserving safety reporting and appeals.
- [ ] Staff and train moderation, define on-call coverage, and rehearse urgent incidents.
- [ ] Obtain counsel approval for Terms, Privacy, Guidelines, DMCA, DSA, age availability, retention, payments, and jurisdiction choices.

## E. Data and application security

- [ ] Replace public base-table access with least-privilege public views and private/self RPCs.
- [ ] Remove auth user IDs, suspension state, strike counts, and payment account IDs from public DTOs.
- [ ] Make processor account IDs service-role-only on insert and update.
- [x] Define and enforce canonical byte, character, item, URL, and nesting limits in shared TypeScript schemas and SQL. (Wave 2 2026-07-30, WP4)
- [x] Route comments and all public mutations through signed, rate-limited, fail-closed server boundaries. (Wave 2 2026-07-30: comments were the last direct client write; every mutation now rides an edge function and the suggest throttle fails closed)
- [ ] Add durable rate limiting, CAPTCHA, backpressure, cost ceilings, anomaly alerts, and operator overrides.
- [ ] Add live anon/auth/moderator/service-role RLS and RPC matrices.
- [ ] Complete threat modeling, SAST, secret scanning, dependency scanning, abuse testing, and independent penetration testing.

## F. Moderator console integrity

- [x] Add MFA/WebAuthn, RBAC, least privilege, access review, session controls, and break-glass procedures. (Wave 5 2026-07-30, WP9; break-glass = documented Supabase dashboard procedures, deliberately not a console power)
- [x] Require reasons and confirmations for destructive actions. (Wave 5 2026-07-30, WP9)
- [x] Add dual control for high-impact safety, account, payment, and restoration actions. (Wave 5 2026-07-30, WP9)
- [x] Make multi-step enforcement actions transactional and version-checked. (Wave 5 2026-07-30, WP9)
- [x] Add assignment, escalation, search, pagination, appeals, communication history, and immutable audit export. (Wave 5 2026-07-30, WP9)
- [x] Test concurrency, partial failure, replay, stale actions, compromised moderator, and recovery scenarios. (Wave 5 2026-07-30, WP9; incl. live two-session concurrency)

## G. Deployment, observability, and recovery

- [ ] Create reproducible staging and production Supabase, web, console, mail, payment, and worker infrastructure.
- [ ] Add signed environment/release manifests, secret ownership, migration checks, deployment, smoke, promotion, rollback, and evidence capture.
- [x] Add structured logs, metrics, traces, dashboards, health endpoints, synthetic probes, queue-age alarms, SLOs, and paging. (Wave 5 2026-07-30, WP11: logging, health endpoint, thresholds, console panel, smoke probe; live dashboards/paging are founder-ops on deployed infra)
- [ ] Configure backups/PITR, encrypted exports, restore drills, RPO/RTO objectives, and disaster recovery.
- [ ] Add incident roles, security/breach workflow, vendor outage runbooks, payment reconciliation alarms, and post-incident reviews.
- [ ] Conduct full staging and production dress rehearsals.

## H. Web, native, store, and accessibility

- [x] Add bounded fetches, explicit outage states, cache/revalidation policy, security headers, controlled SEO, favicon, and complete public navigation. (Wave 5 2026-07-30, WP10)
- [ ] Resolve Expo Doctor, duplicate native modules, SDK versions, Metro defaults, Next tracing, and ESLint warnings.
- [ ] Replace key-only build checks with a complete signed release-manifest gate.
- [ ] Produce final icon, adaptive icon, splash, screenshots, listing copy, privacy labels, data-safety form, ratings, review notes, and encryption answers.
- [ ] Configure iOS and Android submission automation and production channels.
- [ ] Complete VoiceOver, TalkBack, keyboard, dynamic type, contrast, reduced motion, localization, and device matrices.

## I. Verification and CI

- [ ] Add ephemeral Supabase migration/RLS/RPC integration suites.
- [x] Add authenticated public-web and moderator-console Playwright E2E. (Wave 5 2026-07-30, WP11: 24 web + 11 console specs against real local fixtures, run green locally)
- [x] Add native Maestro or Detox E2E for auth, publish, suggest, review, report, block, support, subscription, deletion, export, and key recovery. (Wave 5 2026-07-30, WP11: 11 Maestro flows authored; device-farm execution founder-ops)
- [ ] Add payment sandbox, webhook replay, email delivery, two-device, migration, load, abuse, backup restore, rollback, and chaos suites.
- [x] Make MyNews-specific Expo Doctor, security scan, typecheck, lint, test, coverage, parity, build, E2E, and live smoke jobs required. (Wave 5 2026-07-30, WP11: mynews.yml 9 jobs; live smoke stays founder-ops until a deployment exists)
- [ ] Preserve launch evidence with immutable build, configuration, test, drill, legal, and security sign-off records.

## Production launch gates

- [ ] Controlled domain, monitored contacts, TLS/DNS, and delivery probes are green.
- [ ] Product, runtime, legal, and store claims match deployed capability.
- [ ] Payments and subscriptions pass certification, reconciliation, refund, dispute, and payout scenarios.
- [ ] Account deletion, export, key recovery, and two-device continuity pass end to end.
- [ ] Live RLS/RPC matrices and independent penetration testing pass.
- [ ] Safety, DMCA, counter-notice, NCII/CSAM, appeals, and operator drills meet approved SLAs.
- [ ] Observability, backup restore, rollback, incident, vendor outage, and backlog exercises meet SLO/RPO/RTO objectives.
- [ ] Every CI, native, web, console, load, security, accessibility, and store-build gate is green.
- [ ] Legal, security, safety operations, finance, privacy, and release owners sign off in writing.


## Status Delta (2026-07-12, verified against main 6f8e6545)

Authored by the Fable orchestrator after direct code reads plus an independent opus verification pass. Fill-in pending the verification agent; the orchestrator-verified entries below are final.

| Finding | Status | Evidence |
|---|---|---|
| C06 (review path) | CLOSED | `supabase/functions/mynews-review/index.ts:171-176` (reject) and `:222-227` (accept/partial) enforce suspension + current-terms fail-closed; publish (`mynews-publish/index.ts:129,138`) and suggest (`mynews-suggest/index.ts:145,153`) already gated; tests landed in `39fb1367`. |
| C06 (comments bypass, suspended-reporter denial) | LIVE | `modules/mynews/src/data/cloud-fetch.ts:1203-1216` posts comment events straight to PostgREST with no suspension/terms/rate/size gate; `mynews-report/index.ts:94-96` blanket-blocks suspended reporters. |
| C05 | LIVE | `mynews-report/index.ts:133-146` NCII case creation swallows errors and returns success; `:113` open-report dedupe blocks reason escalation. |
| C07 | LIVE | `supabase/migrations/20260703000001_mynews_bootstrap.sql:22` public base-table select persists; no public view migration exists after `20260705000010`. |
| H08 (report throttle) | LIVE | `mynews-report/index.ts:100-106` count failure logs and continues. |
| H12 | PARTIALLY CLOSED | `e53ffec9` restored Expo SDK health (metro defaults, SDK alignment); re-verify Expo Doctor in WP10. |

Independent opus verification (2026-07-12) of the remaining findings confirmed: only C06 moved since the report baseline. All other code findings are LIVE and unchanged, with these refinements:

| Finding | Status | Notes |
|---|---|---|
| C10 | PARTIALLY CLOSED | Honest not-signed-in handling landed (`apps/mynews-web/app/components/ReportButton.tsx:17-18`, `app/api/report/route.ts:14-16`); the actual web reporting path (web auth or protected anonymous notice) is still absent. Now owned by WP10. |
| H12 | PARTIALLY CLOSED | SDK versions aligned, Metro defaults restored (`e53ffec9`). Residual: Expo Doctor as a required CI gate (WP11) and the workspace js-yaml advisory (WP10). |
| C01, C11, H04, H11, M03 | FOUNDER-OPS | Code-side placeholders (origin defaults, mailbox literals, legal copy claims, retention/legal-hold schema, a11y attributes) are owned by WP5, WP7, WP10, WP11; the operational halves stay founder-ops. |
| C02, C03, C04, C05, C07, C08, C09, C12, C13, H01-H03, H05-H10, M01, M02, M04, M05 | LIVE | Anchors recorded in the packet scopes below. |

Verified facts: highest existing workspace migration is `20260711000013_dowork_moderation_hardening.sql`, so the `20260712*` numbering below is collision-free. `CURRENT_TERMS_VERSION` (`modules/mynews/src/data/terms.ts:20`) and `EDGE_CURRENT_TERMS_VERSION` (`supabase/functions/_shared/mynews-terms.ts:9`) both read `2026-07-05` and stay paired on any bump. CI has no MyNews-specific jobs; the E2E job targets the hub and Meerkat web apps only (H10, owned by WP11).

## Status Delta (2026-07-30, verified against main 2f5f6e81)

Ground truth built by the orchestrator with two verification agents whose claims were re-verified in source. Full table and evidence: `docs/sessions/2026-07-30-mynews-plan48-wave2.md`.

| WP | Status |
|---|---|
| WP1, WP3 | DONE (Wave 1, merged 2026-07-17) |
| WP2 | DONE (Wave 2 landed 2026-07-30, branch feature/mynews-plan48-wave2). All seven verified gaps closed: resolver vocabulary matches live routes with a route-drift test; anonymous rate identity fails closed on signed platform headers only; token bucket + counter GC; authenticated in-app counter-notice path (client + full 512(g)(3) screen); profile-target restoration; enforcement-wide strike linkage; forwarding events stamped manual-attested with honest console copy. Residual founder-ops: outbound forwarding email delivery, designated-agent registration. Live-SQL execution of `nw_dmca_apply_action` remains owned by WP11's ephemeral suite. |
| WP4 | DONE (Wave 2 landed 2026-07-30). Canonical bounds (`bounds.ts` + edge mirror + SQL CHECKs), comment boundary (`mynews-comment` fn + policy drop + guard trigger + service-role RPC), typed bounded structured diff at the suggest boundary, publish/review bounds. Bonus: `mynews-suggest` throttle now fails closed (503) aligning with report/comment. |
| WP5 | DONE (Wave 3 landed 2026-07-30). nw_deletion_requests + one-transaction disposition (retain+anonymize signed public record, hard-delete personal rows, scrub guarded collaborative drafts, money stopped not deleted, legal/safety rows untouched), mynews-account fn (typed confirmation + fresh-token gate + 7-day cancellable grace + durable status), account worker (admin deletion + processor cleanup honest skipped-unconfigured), 32-key export with drift pin, app + web surfaces, privacy disclosure. Deviation: no `awaiting_confirmation` state; confirmation is synchronous (typed phrase + fresh token in one request) so rows exist from `grace` onward. Live-SQL execution of the plpgsql paths owned by WP11's ephemeral suite. |
| WP6 | DONE (Wave 4 landed 2026-07-30, migration 20260730000008). Full rev-2 design implemented: key chain with global active uniqueness, in-transaction nonces + head re-assertion, append-versioned escrow with logged rate-limited reads + backup-restore transparency, no-kit recovery hard-gated on a confirmed notification channel (no confirmation path ships, so the path is honestly unavailable until a delivery provider exists), standing-scaled locks + hashed cancel tokens + 2-cancel freeze, step-up gates pinned to the account window, active-key resolver + typed key-revoked on all four write edges, trigger-stamped verified_key_id, reader verifier + app history badges, recovery kit (scrypt, 160-bit CSPRNG code, salt-bound metadata). Deviations recorded in the session log: initial chain row written by trigger on first bind (initial binder byte-unchanged), suggestions now record signer_pubkey (latent rotation-unverifiability bug fixed with factual backfill), web badge deliberately not shipped (server-asserted verification defeats the verifier; documented follow-up). 71/71 mutation checks. |
| WP7 | DONE (c792cb38 base + Wave 3 gap closure 2026-07-30). All 7 verified gaps closed: checkout velocity buckets + stable idempotency with server replay; reconciliation worker + runs table + read-only console /support; payout attribution v2 via the Stripe event envelope account (unattributed payouts recorded); schema-driven release gate with payments-live env agreement, legal-contact envs, and 4-secret worker attestation; entitlement-exempt routes for legal/notices/account screens; per-request capability-keyed web legal bundle; staged-delivery strings removed; product-copy scan tests in app and web. Store/finance/tax/counsel approval stays founder-ops. |
| WP8 | DONE (Wave 4 landed 2026-07-30, migration 20260730000009). Layered screening engine with adversarial fixtures + fail-closed vendor seam; shared screening gate on publish/suggest/review/comment (unavailable = 503, never implicit allow); quarantine statuses + transactional audit + console review queue with appeals + false-positive measurement; taxonomy expanded (child-safety at NCII tier with a 24h urgent lane that rolls back the submission if the case cannot open; hate, self-harm, doxxing-privacy, fraud-scam, threats) with drift-pinned SQL+TS SLA routing; verification center workflow + console page + badges; credibility Sybil weighting + endorsement-ring detector. |
| WP9 | DONE (Wave 5 landed 2026-07-30, migration 20260730000010; behaviourally verified on a live local Postgres: 24 migrations apply clean, 141 checks, real two-session concurrency). AAL2 TOTP MFA with no bypass, RBAC + one-shot founder bootstrap, transactional version-checked enforcement with typed stale-action conflicts, dual control with proposer/approver separation enforced by CHECK constraint, keyset pagination everywhere, unified appeals over the moderation + screening sources, hash-chained audit with independently verifiable export. Founder-ops: seed the first admin (nw_moderator_bootstrap_admin), MFA factor resets via Supabase dashboard. |
| WP10 | DONE (Wave 5 landed 2026-07-30). Web email-OTP reporting in place on the page (JWT never in JS), nonce CSP + full security headers on web and console, bounded fetches with a four-state outage/missing split (documented deviation: App Router pages cannot emit 503, so page outages are 200 + noindex while route handlers send real 503 + Retry-After), complete nav + favicons, real a11y audit (39 silent error messages now announced), Expo Doctor 16/18 with two documented root-lockfile exceptions (workspace expo patch bump pending as a root-config action). |
| WP11 | DONE (Wave 5 landed 2026-07-30, migration 20260730000012). No-PII structured logging on all 18 functions, mynews-health with secret-gated detail, data-driven queue-age thresholds + console health panel, currency-gated env matrix (55 vars), fail-closed deploy/rollback/smoke scripts, four runbooks, mynews.yml CI (9 jobs) with an HONEST RLS lane: no live RLS suite exists; without credentials the static contract harness runs plus an explicit skip marker, and with credentials the lane FAILS rather than green-faking. Playwright web 24 + console 11 against real local fixtures; 11 Maestro flows authored (device-farm execution founder-ops). |
| WP12 | DONE (Wave 6, 2026-07-30): four-reviewer adversarial pass (3 opus + gpt-5.5 Codex). All CRITICAL and directly-fixable HIGH findings remediated and mutation-checked (web DMCA rate-limit bypass, custody client-writable lifecycle columns, 2 screening bypasses + article-freeze + advisory-abuse, concurrent-refund over-refund). Concurrency/logic HIGHs and MED/LOW findings verified and registered in errors_log with exact fixes for the ephemeral-Supabase lane (dual-control TOCTOU, processor-cleanup completion, reject/set-meta rotation lockout, role/queue races, A5-A9/B1-B4). Console integrity (WP9) unbroken under review. The live/ephemeral RLS-RPC concurrency suite remains the one carried item (WP11 CI lane fails closed until it exists). Full detail: docs/sessions/2026-07-30-mynews-plan48-wave2.md stage 6. |

Amendments: new migrations now use `20260730*` numbering (the `20260712*` block collided with yearn pairs and `20260730000001` is taken by in-flight yearn work). `modules/mynews/CLAUDE.md` incorrectly said `mynews-dmca` runs `verify_jwt` OFF; it relies on gateway JWT verification (fix with Wave 2).

## Execution Scopes (authored 2026-07-12, branch feature/mynews-plan48)

Protocol: Fable orchestrator authors every scope and design decision below; non-fable agents implement (gpt-5.5 via codex for bulk/security-critical implementation, sonnet for mechanical work) and review (opus adversarial passes). The orchestrator personally re-reads every fail-closed edge path before accepting a packet. Vendor onboarding, live deployment, counsel, staffing, store assets requiring human design, and domain/mailbox operations are founder-ops and every dependent code path fails closed with an explicit unconfigured state.

Migration numbering: new MyNews migrations start at `20260712000001` (highest existing MyNews migration is `20260705000010`; verify no workspace collision before each add).

Terms rule: any Terms content change bumps `CURRENT_TERMS_VERSION` in `modules/mynews/src/data/terms.ts` AND `EDGE_CURRENT_TERMS_VERSION` in `supabase/functions/_shared/mynews-terms.ts` in the same commit; both pinned tests must be updated together.

### WP1. Safety intake atomicity (C05, M05, C12 partial, H08) [Wave 1]
- One security-definer RPC `nw_submit_report(...)`: target validation, reason-severity-aware dedupe (same reason: idempotent no-op; higher severity: escalate the open report in place, append detail, run the NCII branch when the new reason is ncii), report insert, immediate takedown, `nw_ncii_cases` open with 48h deadline, audit row, all in one transaction. Any NCII-branch failure rolls back the whole submission and returns a retryable error: no success response without a durable case.
- Severity rank (explicit constant, shared TS + SQL): ncii > violence > harassment = impersonation > copyright > spam = other. Expanded taxonomy lands in WP8 on top of this rank table.
- Edge `mynews-report` calls the RPC; throttle count failure now fails closed with a retryable 503 (constrained degraded mode), not silent allow.
- Suspended reporters may still submit reports (all reasons) at a tighter rate (3/hour) instead of blanket 403; enforcement notes this in the response.
- `nw_media_assets` authoritative table (id, owner, storage path, sha256, status: pending/quarantined/approved/removed). Media reports must reference an existing row; nonexistent media IDs are `bad-target`. No product upload path exists yet, so no fabricated urgent cases are possible. Vendor hashing and NCMEC submission remain founder-ops: worker marks such cases `blocked-unconfigured` visibly in console instead of silent stub errors.
- Worker: orphan reconciliation scan (open ncii-reason reports without cases -> create cases), deadline-alert rows for console surfacing.
- Owned files: new migrations `20260712000001*`, `supabase/functions/mynews-report/**`, `supabase/functions/mynews-ncii-worker/**`, `supabase/functions/_shared/mynews-store.ts`, `modules/mynews/src/data/report*`, matching tests.

### WP2. DMCA and counter-notice completeness (C03, C04, H08 dmca) [Wave 2]
- Server-side URL-to-target resolver in `mynews-dmca`: canonical public URL patterns resolve to (targetKind, targetId) validated against the DB before a notice is accepted as queued; unresolvable URLs are queued as `needs-resolution`, never dropped. The web form no longer needs client target coordinates; success copy is true because queue creation is transactional with submission.
- Separate `nw_dmca_counter_notices` schema and Zod model: full 512(g)(3) elements (identification of removed material, good-faith statement under penalty of perjury, consent to federal district court jurisdiction, acceptance of service of process, name/address/phone, physical-or-electronic signature), versioned attestation text persisted per row.
- Console: first-class DMCA queue page listing every open notice and counter-notice regardless of report linkage, with assignment, SLA/aging badges, claimant/poster communication log, forwarding state, 10-14 business-day waiting window tracking, restoration action, litigation hold, strike linkage, immutable disposition audit.
- Anonymous rate limiting keyed on server-derived IP/device signals (privacy-reviewed), fail-closed counters, per-window token bucket in SQL.
- Owned files: migration `20260712000002*`, `supabase/functions/mynews-dmca/**`, `supabase/functions/mynews-my-notices/**`, `apps/mynews-console/app/**` (dmca pages), `apps/mynews-web/app/legal/dmca/**`, `modules/mynews/src/models.ts` (dmca schemas only), `modules/mynews/src/data/dmca*`, legal content rows for counter-notice attestations.

### WP3. RLS least-privilege and public DTO scrub (C07, E) [Wave 1]
- `nw_public_profiles` view (id, handle, display_name, kind, bio, pubkey, tier, created_at) and `nw_public_journalists` view (profile_id, tier, verification state) with column-scoped grants; revoke anon/authenticated select on the base tables; self-read policy (`auth.uid() = user_id`) for the owner's full row.
- `stripe_account_id`: service-role-only on insert and update (column privilege revocation + trigger guard), removed from every client-readable shape.
- Remove `user_id`, `suspended_until`, `copyright_strikes`, `stripe_account_id` from all public DTOs in `cloud-fetch.ts`, web loaders, and console reads that operate as non-service roles.
- Add an RLS matrix contract test file per role (anon, authenticated non-owner, owner, service) asserting exactly which columns are readable, runnable against the in-repo SQL harness now and the ephemeral Supabase suite in WP11.
- Owned files: migration `20260712000003*`, `modules/mynews/src/data/cloud-fetch.ts` (read shapes), `apps/mynews-web/lib/**`, `apps/mynews-console/lib/**` (reads), matching tests.
- LANDED 2026-07-12. Verification note: the PostgREST view-embed hint form (`nw_public_profiles!author_id(...)`) is structurally reasoned but not live-verified against a running PostgREST; the WP11 live smoke suite must exercise feed, article, journalist, suggestion, and blocks reads against a real instance before launch.

### WP4. Comment boundary and canonical bounds (C06 residual, H05) [Wave 2]
- New edge function `mynews-comment`: JWT, profile resolution, suspension, current-terms, rate (10/min), body bounds; trigger migration forbids direct client insert of `action='comment'` rows on `nw_suggestion_events` (same pattern as the report-intake lockdown); `cloud-fetch.postSuggestionComment` switches to the function.
- New `modules/mynews/src/data/bounds.ts`: canonical byte/char/item/nesting/URL limits for headline, dek, body, rationale, diff, citations, changelog, comment, profile fields; mirrored constants in `supabase/functions/_shared/mynews-bounds.ts` with drift-pinning tests both sides (terms-mirror pattern); SQL check constraints added in migration.
- `diffJson` becomes a validated structured diff schema (typed ops, bounded counts and string lengths), rejected on parse failure at edge and SQL layers.
- Owned files: migration `20260712000004*`, `supabase/functions/mynews-comment/**`, `supabase/functions/_shared/mynews-bounds.ts`, `modules/mynews/src/data/bounds.ts`, `modules/mynews/src/data/cloud-fetch.ts` (comment path), `supabase/functions/mynews-publish|suggest|review` (bounds enforcement), tests.

### WP5. Account deletion and data export (C08, B) [Wave 3]
- `nw_deletion_requests` job table (states: awaiting_confirmation, grace, processing, completed, cancelled, failed) + `mynews-account` edge function: initiate (reauth via fresh session + typed confirmation), 7-day disclosed grace with cancel, processing performs content disposition, personal-row deletion, auth-user deletion via admin API, processor cleanup hook (fail-closed no-op recorded as `skipped-unconfigured` until payments founder-ops complete), durable status reads.
- Content disposition: signed public revisions are retained but anonymized (display identity replaced, profile anonymized, key bindings revoked, credibility ledger detached), reports/DMCA/legal rows retained per legal-retention schedule with explicit disclosure copy; everything else hard-deleted.
- Full personal-data export: edge function bundles every user-owned row as JSON; in-app download + web request path; export job states mirror deletion.
- Web: `/account/delete` request page on mynews-web (works signed-out via emailed confirmation only when mail is configured; fails closed with explicit copy otherwise).
- App: account screen gains Delete Account and Export Data flows with honest state.
- Owned files: migration `20260712000005*`, `supabase/functions/mynews-account/**`, `apps/mynews/app/(root)/(tabs)/account*` (or current account screen path), `apps/mynews-web/app/account/**`, module data layer + tests, privacy legal copy alignment.

### WP6. Key custody and authorship continuity (C09) [Wave 3 design by orchestrator + opus review; Wave 4 implementation]
- Recovery kit: Ed25519 private key encrypted with nacl.secretbox under a key derived (scrypt, @noble/hashes, N=2^15 mobile-safe) from a generated 160-bit base32 recovery code (grouped display). Export as file and QR; optional ciphertext-only server escrow row (`nw_key_escrow`, service never sees plaintext or code). Import on new device decrypts and re-registers.
- Key rotation chain: `nw_profile_keys` gains rotation records signed by the previous key (normal rotation) or by a recovered key. Lost-device without kit: time-locked (72h) email-reauthenticated rotation that binds a new key with a public, permanent `key rotated via account recovery on DATE` transparency note on the profile and on subsequent revisions; old key is revoked at bind time. Compromise: immediate revocation via reauthenticated session + moderator-visible event; revoked keys cannot author new revisions (edge checks binding validity at verify time).
- Multi-device: additional device keys join via approval signed by an existing active key; per-device revocation.
- Threat model doc section: server escrow (ciphertext-only) vs user-held; recovery social engineering (time lock + notification email + transparency note); device compromise (revocation + rotation).
- Owned files: migration `20260712000006*`, `modules/mynews/src/signing/**` (kit derive/encrypt/decrypt), `apps/mynews/app/(root)/providers/IdentityProvider.tsx` + key management screens, `supabase/functions/mynews-register-key/**` (rotation/revocation/approval), edge verify paths honoring key validity windows, tests incl. vectors.

### WP7. Subscriptions, journalist support rails, release gate, honest copy (C02, H09, M01) [Wave 3]
- Wire `@mylife/subscription` RevenueCat lifecycle into apps/mynews: init from config, paywall screen, purchase, restore, entitlement context enforcing premium gates; unconfigured -> explicit "subscriptions unavailable in this build" state everywhere the tier is referenced, never a fake paywall.
- Journalist support rails coded fully against a provider interface with a Stripe Connect implementation activated by configuration: onboarding-state machine, payment intents, signed webhook edge function (`mynews-payments-webhook`) with signature verification + idempotency keys, `nw_support_ledger` double-entry rows, receipts, refund/dispute/chargeback/payout state machines, reconciliation job + report, fraud velocity checks. Without processor config every support surface shows an explicit unavailable state and legal/product copy is capability-keyed (the 2% fee claim renders only when the rail is live). Store policy, finance, tax, counsel signoff: founder-ops.
- Replace the RevenueCat-key-only build guard with a release-manifest gate: required env matrix (Supabase URL/anon key/functions URL, controlled origin, legal contacts, worker secret, console settings, policy versions), manifest JSON generated + verified at build, smoke-receipt field required for production channel; missing/placeholder values fail the build with named keys.
- Remove every staged-delivery string (Phase 1/3/4/5, Discover-coming copy) across app, web, and module legal content; add a claim-to-capability parity test that walks legal/product copy claims against capability flags.
- Owned files: `apps/mynews/**` (support/paywall/account screens, build guard, app config), `supabase/functions/mynews-payments-webhook/**`, migration `20260712000007*` (ledger/payout tables), `modules/mynews/src/data/legal-content.ts` + capability flags, `apps/mynews-web` home/support copy, tests.

### WP8. Pre-publication screening, taxonomy, verification center (H01, H02, D) [Wave 4]
- Screening engine in `modules/mynews/src/screening/`: layered checks (blocklist/pattern lexicons per class, URL reputation heuristics, structure anomalies), risk score with per-class thresholds; publish/suggest/comment edges call it; high risk -> content stored `quarantined` (new status), author notified, console human-review queue with approve/reject/appeal; false-positive measurement table; optional vendor provider interface fail-closed behind config.
- Report taxonomy expansion on WP1's severity rank: child-safety, hate, self-harm, doxxing/privacy, fraud/scam, threats; SLA routing table (class -> deadline) driving worker deadline rows and console badges; DSA reason mapping updated.
- Verification center: `nw_journalist_verifications` full workflow (request with evidence refs, operator review, approve with expiry, deny with reason, revoke, re-verify), console UI, verified badge surfaced in DTOs/UI, Sybil defenses on credibility (account-age and verification weighting per the credibility engine's existing hooks), anomaly flags for coordinated endorsement rings.
- Owned files: migration `20260712000008*`, `modules/mynews/src/screening/**`, `modules/mynews/src/engine/**` (credibility weighting), publish/suggest/comment edges (screening call), `apps/mynews-console/app/**` (review + verification pages), report edge (taxonomy), tests incl. adversarial fixtures.

### WP9. Moderator console integrity (H06, F) [Wave 5]
- Enforce MFA (Supabase AAL2) for console sessions; `nw_moderator_roles` RBAC (admin, senior, reviewer) checked in every server action; least-privilege service calls.
- Transactional enforcement RPCs with version checks (hide/strike/resolve in one txn; stale-action conflict errors); required reason strings + confirmation for destructive actions; dual control (`nw_pending_actions` second-moderator approval) for suspensions >7d, account terminations, restorations, payment-adjacent actions.
- Assignment, escalation, appeals queue (user-facing appeal submission via app + web, operator disposition), search, full pagination, immutable hash-chained audit log + export.
- Concurrency/partial-failure/replay/stale-action/compromised-moderator test scenarios.
- Owned files: migration `20260712000009*`, `apps/mynews-console/**`, console-facing RPC migrations, appeal submission surfaces in app/web, tests.

### WP10. Web/native hardening, web reporting path, honest states (C10, H07, M01-M04, H12 residual) [Wave 5]
- Web reporting (C10): Supabase email OTP sign-in on mynews-web (same auth project as the app) so `ReportButton` submits through the existing JWT-gated report function in place, preserving page context; signed-out users get a sign-in sheet, not an app redirect. Abuse controls ride the WP1 intake RPC.
- next.config headers for mynews-web + console: CSP (nonce-based where scripts require), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors, `poweredByHeader: false`; `outputFileTracingRoot`; `server-only` imports on server data modules; ESLint plugin config.
- Bounded fetches (AbortSignal timeouts) with differentiated outage vs not-found states site-wide, SEO-safe 503 behavior, cache/revalidate policy, favicon + complete public nav, honest empty/outage copy.
- Accessibility pass: roles/labels/states on native pressables, dynamic type + reduced motion checks, keyboard nav on web; localization stays English with an explicit locale declaration (full l10n is a founder product decision).
- Re-run Expo Doctor; resolve remaining items or document the formal exception.
- Owned files: `apps/mynews-web/**`, `apps/mynews-console/**` (config/headers), `apps/mynews/**` (a11y attributes), no migrations.

### WP11. Observability, manifests, CI, E2E (C11, C13, H10, I) [Wave 5]
- Structured event logging via `_shared/observability.ts` across all mynews edge functions; `mynews-health` endpoint (DB reachability, queue ages, worker heartbeat); queue-age alarm rows + console surfacing; synthetic probe script.
- Environment manifest (`supabase/functions/mynews-*` env matrix + web/console env docs), deploy/rollback/smoke scripts (`scripts/mynews-deploy.sh` etc.) that fail closed without credentials; runbooks (incident, vendor outage, backup/PITR restore drill, breach) under `apps/mynews/docs/`.
- CI: MyNews-specific jobs (expo doctor, typecheck, lint, tests, coverage, parity) required; Playwright E2E for mynews-web and console against local fixtures; RLS matrix suite wired to ephemeral Supabase when credentials exist, contract harness otherwise (fail-closed skip is marked, not green-faked).
- Native Maestro/Detox flows: author specs + local scaffolding; device-farm execution is founder-ops.
- Owned files: `.github/workflows/**` (mynews jobs), `scripts/**`, `supabase/functions/**` (logging), `apps/mynews-web/e2e/**`, `apps/mynews-console/e2e/**`, runbooks.

### WP12. Final adversarial review and close-out [Wave 6]
- Independent opus adversarial pass over the full branch diff; orchestrator re-reads every fail-closed edge path; full gates (`pnpm gate:function:changed`, mynews module/app/web/console suites, `pnpm check:parity`); plan checklist boxes updated with evidence; ledgers, session log, Open Brain captures; founder-ops handoff list finalized.

### Founder-ops register (fail-closed, never faked)
Domain purchase/DNS/mailboxes and delivery probes against them; counsel approvals (Terms, DMCA agent registration, DSA, retention, age policy, payments); moderation staffing/training/on-call; RevenueCat/App Store/Play/Stripe dashboard configuration and certification; NCMEC/hash-vendor onboarding; store assets (icon, splash, screenshots, listing, privacy labels, ratings); live Supabase project provisioning, deployments, backups/PITR drills against live infra; independent penetration test; device-farm QA. Every dependent code path built in WP1-WP11 detects absent configuration and fails closed with explicit state.
