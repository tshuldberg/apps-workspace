# MyNews Adversarial Production-Readiness Review

**Review date:** 2026-07-11  
**Decision:** **NO-GO for public production launch**  
**Overall readiness:** **3.1 / 10**  
**Audited baseline:** `main` at `45e45345c1fa5f564a83049c59c473a46208a59f`  
**Remediation branch:** `fix/mynews-production-readiness`  
**Supersedes:** `REPORT-mynews-production-audit-2026-07-05.md` for current launch claims

## Executive decision

MyNews contains a substantial and unusually thoughtful signed-journalism core. The review verified 800 passing tests, four green TypeScript checks, successful Expo and Next.js production builds, a green MyNews parity check, signed Ed25519 article and suggestion workflows, meaningful RLS hardening, reporting and blocking surfaces, a moderation console, legal pages, and explicit unconfigured states.

That engineering substance does not make the product launchable. The public product promise, operational reality, legal intake paths, account lifecycle, key custody, payment stack, and safety response system are materially out of alignment. Several paths that claim to protect users fail silently or can be bypassed. The advertised public domain is owned by a third party and offered for sale. Its DNS publishes a null MX record, so the hardcoded `legal@mynews.app`, `safety@mynews.app`, and `dmca@mynews.app` addresses cannot receive mail.

The correct production decision is no-go. All launch gates in this document must be closed together. There is no reduced public-launch path, deferred safety floor, or honest way to ship the current build as the product described in its own UI and legal documents.

## Scope and method

The review covered:

- `apps/mynews`, the standalone Expo app
- `apps/mynews-web`, the public Next.js reader and legal surface
- `apps/mynews-console`, the moderator console
- `modules/mynews`, the canonical domain, data, signing, and engine package
- all `supabase/functions/mynews-*` functions and shared MyNews function code
- all `nw_*` MyNews migrations, RLS policies, triggers, and RPCs
- relevant billing, entitlement, registry, parity, CI, and build configuration
- launch documentation and the completed safety/legal plan
- current Apple, Google Play, U.S. Copyright Office, and EU platform/legal source material
- local desktop and 390px browser behavior, network responses, console output, DNS, MX, and the live `mynews.app` target

This was an adversarial source and runtime review, not a substitute for legal advice, a professional penetration test, a live Supabase RLS test suite, native-device QA, payment certification, or an incident-response exercise. Those remain required launch evidence.

## Evidence snapshot

| Evidence | Result |
|---|---|
| Unit and contract tests | 800 passed: module 549, app 169, web 60, console 22 |
| TypeScript | Module, app, web, and console passed |
| Builds | iOS and Android Expo export passed; both Next.js production builds passed |
| MyNews parity | Passed |
| Expo Doctor | Failed 3 of 18 checks: Metro defaults, duplicate Expo resolution, four SDK version mismatches |
| Production dependency audit | One moderate workspace advisory in `js-yaml`; observed path is through BestChef/Expo/Jest tooling, not a direct MyNews runtime path |
| Live configuration | Every MyNews Supabase, functions, RevenueCat, console, and worker variable was unset in the review environment |
| Public web with no environment | Loads a nearly empty page with stale `Phase 1` copy; favicon returns 404 |
| DMCA form with no environment | Correctly returns HTTP 503, then tells the user to email a non-receiving address |
| `mynews.app` live target | Third-party premium-domain sale page, not MyNews |
| `mynews.app` MX | `0 mynews.app.`, a null MX that declares the domain accepts no email |
| Public response hardening | No CSP, HSTS, `X-Content-Type-Options`, Referrer-Policy, or Permissions-Policy; `X-Powered-By: Next.js` exposed |

Browser evidence is retained under `output/playwright/mynews-readiness-2026-07-11/` in the review worktree. It includes the empty local home page, unconfigured DMCA path, mobile DMCA layout, and live domain sale page.

## Readiness scorecard

| Dimension | Score | Assessment |
|---|---:|---|
| Signed publishing and editing core | 7.5 | Real, tested, and carefully designed, but key recovery and enforcement gaps undermine continuity |
| Product completeness and truthfulness | 2.5 | Support, subscriptions, verification, recovery, and account lifecycle are promised but incomplete or absent |
| Security and privacy | 4.0 | Strong signatures and meaningful RLS work coexist with public sensitive fields, bypasses, and missing lifecycle controls |
| Trust, safety, and legal operations | 2.0 | Many surfaces exist, but critical intake, counter-notice, NCII, filtering, appeals, staffing, and contact paths are not operational |
| Reliability and operations | 1.0 | No configured deployment, live E2E evidence, monitoring, alerting, backup drill, SLO, or incident runbook |
| Store and release readiness | 2.0 | Builds export, but account deletion, assets, policy evidence, metadata, device QA, and release operations are incomplete |
| Automated quality | 7.0 | 800 tests and green builds are strong; Expo Doctor is red and live/RLS/UI/payment coverage is missing |

## Critical launch blockers

### C01. The advertised domain and every published legal/safety mailbox are unavailable

**Evidence:** `apps/mynews-web/lib/origin.ts`, `apps/mynews-web/CLAUDE.md:21`, legal pages, and app legal copy default to `https://mynews.app` and `legal@`, `safety@`, and `dmca@mynews.app`. On 2026-07-11, `mynews.app` and `www.mynews.app` served a third-party page offering the domain for sale. DNS returned `MX 0 mynews.app.`, which means the domain does not accept email.

**Impact:** Public URLs, OAuth/deep-link assumptions, RSS/OG metadata, DSA contact claims, privacy requests, safety escalation, and DMCA notices point outside the company or into a dead mailbox. This is an immediate legal, trust, phishing, and brand-confusion blocker.

**Required remediation:** Acquire and verify an approved domain or select a controlled replacement. Configure DNSSEC where supported, HTTPS, HSTS, SPF, DKIM, DMARC, monitored role mailboxes, escalation routing, retention, and response ownership. Replace every placeholder in code and store metadata. Prove inbound and outbound delivery, web ownership, and 24/7 escalation routing before launch.

### C02. Reader support, the 2% fee, premium access, and payment processing are promises without a product

**Evidence:** `apps/mynews/app/(root)/(tabs)/support.tsx:6-7` says support arrives in `Phase 4`. `apps/mynews-web/app/page.tsx:14-15`, app legal copy, web legal copy, and `modules/mynews/src/data/legal-content.ts` state that direct support exists and the platform keeps 2%. The module contains fee math and payment-shaped tables, but there is no Stripe Connect onboarding, payment intent, webhook, payout, reconciliation, refund, dispute, receipt, tax, or fraud flow. The app declares billing/entitlement dependencies and a $4.99 premium product, but runtime source does not initialize RevenueCat, show a paywall, purchase, restore, or enforce entitlements. The production build guard only checks that a RevenueCat key exists.

**Impact:** The primary business model, journalist value proposition, legal disclosures, and premium tier are nonfunctional. A key-shaped environment variable can make a production build appear payment-ready when it has no payment runtime.

**Required remediation:** Implement the complete subscription and journalist-support systems, including policy-compliant platform separation, Connect/KYC onboarding, fee disclosure, signed webhooks, idempotency, receipts, refunds, disputes, chargebacks, payout states, reconciliation, tax reporting, fraud controls, sanctions/geography decisions, ledger UI, restore purchases, entitlement enforcement, and finance operations. Obtain App Store and Play policy review for the final payment architecture. Align every claim only after the end-to-end systems pass certification.

### C03. Valid DMCA submissions can be stored without ever reaching a moderator

**Evidence:** `apps/mynews-web/app/legal/dmca/DmcaForm.tsx:36-46` never sends `targetKind` or `targetId`. The DMCA SQL creates an `nw_reports` queue item only when both target coordinates are present. `apps/mynews-console/app/queue/page.tsx:156-164` only hydrates notices linked to copyright reports. The console has no standalone DMCA notice queue, even though shared store support can read open notices. Success copy at `DmcaForm.tsx:80-84` says every notice was routed to the moderation queue.

**Impact:** A claimant can receive a success message while the notice remains invisible to operators indefinitely. Counter-notices are always unlinked and therefore invisible by design.

**Required remediation:** Add URL-to-target resolution on the server, a first-class DMCA/counter-notice console queue that includes every open notice, assignment and SLA state, claimant and poster communication, audit records, disposition, restoration timing, strike linkage, and alerts for aging items. Submission success must be contingent on durable, visible queue creation.

### C04. The counter-notice form captures the wrong attestations and omits required workflow data

**Evidence:** `DmcaForm.tsx:134-147` reuses the takedown authority statement for counter-notices. `modules/mynews/src/models.ts:145-165` uses one schema for both notice kinds. It has no consent to federal jurisdiction, agreement to accept service of process, correct counter-notice identity wording, or restoration workflow. The database has only takedown-shaped attestation fields.

**Impact:** MyNews presents a legally meaningful counter-notice mechanism that does not capture the elements needed to operate that process. Moderators also have no counter-notice action, notice-to-claimant path, waiting period, lawsuit hold, or restoration state.

**Required remediation:** Have counsel approve separate takedown and counter-notice schemas, forms, attestations, notices, timelines, and retention. Persist each explicit attestation and its version. Implement claimant forwarding, waiting periods, action tracking, restoration, litigation holds, and audited operator decisions.

### C05. NCII intake is non-atomic and explicitly fails open

**Evidence:** `supabase/functions/mynews-report/index.ts:117-148` inserts the report, then separately calls `openNciiCase`. Errors are logged and the request still returns success. The test at `supabase/functions/mynews-report/__tests__/index.test.ts:268-282` locks in that behavior. The worker scans `nw_ncii_cases`, so it cannot repair an NCII report for which case creation failed. The existing-open-report check at lines 111-115 exits before attempting NCII escalation. The unique open-report key omits reason, so an earlier spam report can block a later NCII report from the same reporter.

**Impact:** The product can confirm an urgent NCII report while leaving content live, creating no deadline case, and giving the worker nothing to process.

**Required remediation:** Move report insertion, severity escalation, immediate takedown, case creation, deadline creation, and audit insertion into one transactional database RPC. Make urgent-case creation fail closed. Add orphan reconciliation, immutable urgency escalation, deadline alerts, retry/idempotency keys, live SQL tests, and an operational drill.

### C06. Suspension and Terms enforcement can be bypassed, while suspended users lose safety reporting

**Evidence:** `supabase/functions/mynews-review/index.ts:133-230` validates authorship and signatures but does not check profile suspension or the current Terms acceptance. Accepted or partial reviews publish new revisions. Rejects also mutate public state. `modules/mynews/src/data/cloud-fetch.ts:1203-1216` posts public suggestion comments directly to PostgREST. Its RLS verifies actor ownership and visibility but not suspension, Terms, rate, or payload size. In the opposite direction, `mynews-report/index.ts:90-96` blocks suspended users from reporting safety issues.

**Impact:** Sanctioned accounts can continue publishing through review and comments, while a sanctioned person cannot report abuse, NCII, or impersonation. Enforcement is inconsistent across write paths.

**Required remediation:** Centralize mutation authorization in database-backed, fail-closed RPCs. Enforce current Terms, suspension, rate, and payload bounds across publish, review, reject, suggest, comments, newsroom changes, and profile changes. Preserve access to safety reporting and appeals with abuse controls instead of blanket denial.

### C07. Public RLS exposes internal identifiers and a dormant payout-hijack field

**Evidence:** `supabase/migrations/20260703000001_mynews_bootstrap.sql:22-23` grants public row selection over the base `nw_profiles` table, exposing `user_id`, `suspended_until`, and `copyright_strikes`. Lines 35 and 39-40 publicly expose `nw_journalists.stripe_account_id`. The comment at lines 49-50 says the field is kept out of a public view, but no such view exists. Self-update policy allows owners to write the row, and the later guard protects tier rather than `stripe_account_id`. `modules/mynews/src/data/cloud-fetch.ts` also intentionally selects `user_id` for public profile objects.

**Impact:** Auth identifiers and enforcement state are enumerable. A user can set or replace the future payout destination before payment code ships, creating a latent transfer-hijack path.

**Required remediation:** Revoke public base-table selection, expose purpose-built public views with column grants, split self/private profile reads from public reads, remove auth IDs from public DTOs, and make processor account IDs service-role-only on insert and update. Add live anon/auth/service-role RLS tests.

### C08. Account deletion and full user-data export do not exist

**Evidence:** The app's account screen offers sign-out and a credibility ledger export, but no account deletion, full personal-data export, privacy-request status, auth-user deletion, or content disposition flow. Targeted source searches found no MyNews deletion function or web deletion request path. The privacy policy claims deletion rights.

**Impact:** The app is not compatible with current Apple and Google account-deletion submission requirements and cannot operationalize its privacy promises. Signed public journalism, comments, reports, DMCA records, payment records, and legal retention also have no defined deletion/anonymization policy.

**Required remediation:** Implement in-app initiation, reauthentication, confirmation, cancellation/grace rules, subscription handling, web deletion request, auth revocation, processor deletion, personal-data export, durable job status, public-content disposition, legally required retention, anonymization, and operator audit. Test cascade behavior and failure recovery.

### C09. Email sign-in does not recover the only key that can continue an author's work

**Evidence:** `apps/mynews/app/(root)/providers/IdentityProvider.tsx:6-11` stores one raw private key in SecureStore and states that loss permanently prevents new revisions, with multi-profile custody left to a later phase. A new device generates a new key, while the profile binding is set once. Legal copy presents email as recovery and sign-in, and the product promises a portable signed byline.

**Impact:** A journalist who replaces or loses a device can authenticate but cannot continue or correct their published work. This is a core product continuity failure, not an optional convenience.

**Required remediation:** Implement encrypted key backup, recovery, export/import, multi-device approval, rotation, revocation, lost-device recovery, recovery-code handling, compromise response, and an auditable authorship-continuity model. Threat-model cloud escrow and user-held recovery options before choosing custody semantics.

### C10. Public web reporting is not an operational reporting mechanism

**Evidence:** Article and profile pages render `ReportButton`, but the web surface has no sign-in flow. The report function requires a JWT and returns `not-signed-in`; the UI sends the visitor to the app. The product's legal copy says anyone can report.

**Impact:** Web-only readers cannot report public content where they encounter it. This weakens platform-policy and notice-and-action claims and loses the highest-context safety signal.

**Required remediation:** Ship web authentication or a protected anonymous notice path with CAPTCHA/turnstile, IP/device abuse controls, rate limiting, confirmation, case status, and escalation. Preserve the page/target context and meet accessibility requirements.

### C11. There is no configured deployment or live end-to-end evidence

**Evidence:** Every MyNews runtime variable was unset during review. No MyNews deployment script, environment manifest, health probe, public runbook, or live environment evidence was found. Build and unit tests operate without a live database. The completed plan still lists project creation, domain, inboxes, secrets, cron, console allowlist, function deployment, device QA, and store operations as manual founder work.

**Impact:** No evidence proves migration order, live RLS, JWT gateway configuration, edge secrets, OAuth links, console auth, cron, web SSR, native deep links, two-device behavior, email delivery, or rollback.

**Required remediation:** Create reproducible infrastructure and environment manifests, staging and production projects, secret ownership, deploy/rollback scripts, migration checks, live smoke probes, release promotion, and evidence capture. Run full staging and production dress rehearsals.

### C12. The urgent media-safety pipeline has stubbed external integrations and accepts invented media targets

**Evidence:** `supabase/functions/mynews-ncii-worker/seams.ts` returns an error for the configured hash-matching vendor and `null` for NCMEC reporting even when credentials are present. Tests assert those safe stubs. MyNews has no media asset table or upload lifecycle, while report target validation treats any nonempty `media` target string as existing.

**Impact:** The UI and schema imply an operational NCII/CSAM workflow that cannot hash real media, cannot validate ownership/storage, cannot submit the documented external report, and can be flooded with fabricated urgent cases.

**Required remediation:** Build a controlled media pipeline with object ownership, immutable identifiers, quarantine, hash extraction, approved vendor integration, evidence access controls, human review, required external reporting with counsel, retries, vendor outage handling, test fixtures, and false-positive restoration. Reject media IDs not present in the authoritative asset table.

### C13. Reliability, backup, alerting, and incident response are absent

**Evidence:** No MyNews-specific monitoring, error aggregation, tracing, metrics, health endpoint, on-call routing, SLO, backup/PITR verification, restore drill, incident runbook, or moderation SLA alerting was found. Edge functions primarily log to console. Queue limits and deadlines have no pager path.

**Impact:** Operators cannot reliably detect silent intake failure, function outages, moderation backlog, payment drift, database corruption, delivery failures, or security incidents. Recovery capability is unproven.

**Required remediation:** Instrument every critical workflow with structured events, metrics, traces, privacy-safe logs, dashboards, paging, synthetic probes, queue-age alerts, SLOs, retention, runbooks, backup policy, PITR, encrypted exports, restore drills, incident roles, breach workflow, and post-incident review.

## High-severity findings

### H01. Verification and credibility are incomplete and gameable

`nw_journalist_verifications` is service-only but has no operator UI, workflow, evidence policy, expiration, or code path that creates a verified journalist. Credibility code explicitly leaves anonymous-account weighting to a future verification center. Topic score, endorsements, identity verification, and section-editor progression remain zero or unreachable. A coordinated ring of enough accounts can dilute pair concentration and appear balanced.

**Required remediation:** Ship the full verification center, review policy, revocation, expiry, appeals, Sybil defenses, account-age/device/risk signals, transparent scoring explanations, anomaly detection, human investigation, and adversarial tests.

### H02. There is no pre-publication objectionable-content filter and the report taxonomy is too coarse

The product has reactive reporting and blocking, but no filter or quarantine before articles, suggestions, or comments become public. Report reasons omit child safety, hate, self-harm, doxxing/privacy, fraud, and other routing-critical categories. Apple's current UGC guideline calls for a method to filter objectionable material, a reporting mechanism with timely response, blocking, and published contact information.

**Required remediation:** Add layered text/link/media screening, user confirmation, risk scoring, urgent quarantine, human review, model/vendor fallback, appeal and restoration, false-positive measurement, and a policy-aligned taxonomy with SLA routing.

### H03. Legal and operational copy overclaims systems and people that do not exist

Legal and product copy says support/payments, recovery, moderated review, a 72-hour DMCA target, a moderation team, accessible reporting, processor sharing, deletion rights, and a DSA contact path exist. Several are absent, unstaffed, unconfigured, or point to dead mailboxes. The source comment says every claim ships, which is itself false.

**Required remediation:** Complete the underlying systems, staff and rehearse the processes, obtain counsel review, version every policy, archive acceptance, and add executable parity tests tying legal claims to deployed capabilities and configured contacts.

### H04. Store package, listing, and native-device readiness are incomplete

No MyNews icon, Android adaptive icon, splash asset, store screenshots, listing copy, privacy/data-safety forms, age rating evidence, review notes, Android submit configuration, accessibility matrix, TestFlight/internal-track results, or device matrix was found. Expo falls back to generic/default assets. `usesNonExemptEncryption: false` has not been reconciled with the app's cryptography and export-compliance answers.

**Required remediation:** Produce the complete brand asset set, metadata, privacy labels, data-safety declarations, content rating, support/privacy/deletion URLs, review account/instructions, encryption determination, tablet layout decision, device evidence, crash-free release evidence, and iOS/Android submission automation.

### H05. User-controlled content is insufficiently bounded and comments bypass the edge trust boundary

Publish, suggest, and review paths lack complete headline/body/rationale/diff/citation/changelog count and byte limits. Suggest accepts arbitrary JSON for `diffJson` instead of a validated structured diff. Direct public comments have no useful body cap, suspension/Terms check, or rate limit. Profile fields and arrays have weak database bounds.

**Required remediation:** Define canonical byte, character, item-count, nesting, and URL limits in shared schemas and database constraints. Enforce the same rules in clients, edge functions, and SQL. Route comments through a signed, rate-limited edge/RPC path. Add property, fuzz, oversized-payload, and renderer tests.

### H06. Moderator actions lack production controls and transactional consistency

The console relies on email allowlisting and magic links without enforced MFA, WebAuthn, roles, least privilege, assignments, or dual control. Destructive actions are one click and notes are optional. Several actions perform multiple RPCs and ignore later results, so the target can be hidden while report resolution or strike recording fails. There is no appeals queue, case assignment, escalation, search, or full pagination.

**Required remediation:** Add MFA/WebAuthn, RBAC, least-privilege server actions, required reasons, confirmations, dual control for sensitive actions, transactional enforcement RPCs, concurrency/version checks, assignments, escalation, appeals, pagination/search, immutable audit export, and operator access review.

### H07. The public web fails closed as 404/empty content in ways that hide outages and lacks basic hardening

Public loaders use no request timeout and catch configured backend failures as missing records or empty feeds. A database outage can erase pages from the user's and crawler's perspective. Response checks showed no CSP, HSTS, nosniff, referrer, or permissions headers and exposed `X-Powered-By`. The console has only a narrow frame-ancestor CSP.

**Required remediation:** Add bounded fetches, retry/circuit rules, differentiated unavailable states, status/health propagation, cache/revalidation policy, structured errors, and SEO-safe outage behavior. Add a nonce/hash CSP, HSTS at the controlled domain, nosniff, Referrer-Policy, Permissions-Policy, frame protections, and remove framework disclosure.

### H08. Abuse controls fail open and anonymous DMCA rate limiting is easy to evade

Report, suggestion, and DMCA count failures log and continue. The web DMCA proxy rate-limits primarily by user-supplied email and has no CAPTCHA or trustworthy client-risk signal. Arbitrary media IDs can generate urgent work.

**Required remediation:** Make abuse-sensitive counters fail closed or enter a constrained degraded mode, use server-derived IP/device/risk keys with privacy review, add CAPTCHA, durable token buckets, cost ceilings, queue backpressure, circuit breakers, anomaly alerts, and operator overrides.

### H09. The production build guard creates false confidence

The guard blocks a missing RevenueCat key but does not require Supabase URL, anon key, functions URL, controlled origin, real legal contacts, configured safety worker, console settings, or deployment evidence. A production build can ship the `not connected` product.

**Required remediation:** Replace the key-only check with a signed release manifest that verifies every required environment, controlled origin, backend project identity, legal contact health, safety dependency, policy version, build channel, and live smoke-test receipt.

### H10. Automated coverage is deep in pure logic but shallow at the real trust boundaries

The 800 tests are valuable, but most are source/contract or in-memory tests. There is no live Supabase RLS matrix, migration integration environment, native UI automation, public-web authenticated E2E, moderator workflow E2E, payments E2E, mail delivery test, two-device key recovery test, backup restore, load test, chaos test, or store-build smoke suite. CI's browser E2E targets the MyLife hub web app rather than MyNews web.

**Required remediation:** Add ephemeral Supabase integration tests for every role and mutation, Playwright web/console E2E, Maestro or Detox native flows, payment sandbox suites, email tests, migration forward/rollback validation, load/abuse tests, recovery drills, and required MyNews CI jobs.

### H11. Retention, minors, legal holds, appeals, and data-subject operations are undefined

Reports, safety evidence, DMCA PII, account data, public signed content, and future payment records lack a retention schedule and deletion semantics. There is no age model, minor-protection decision, parental path, sanctions appeal flow, or legal-hold system.

**Required remediation:** Adopt counsel-approved jurisdiction and age availability, retention schedules by data class, legal holds, evidence access controls, minor safety controls, appeals, data-subject request operations, deletion exceptions, processor inventory, and audit reporting.

### H12. The native dependency/configuration health gate is red

Expo Doctor passed 15 of 18 checks. It reports a Metro `watchFolders` override that discards defaults, duplicate Expo resolution in the workspace install, and version mismatches for Expo, Expo Linking, Expo Router, and React types. `pnpm audit --prod` also reports a moderate `js-yaml` advisory through workspace Expo/Jest tooling, with the displayed path rooted in BestChef rather than MyNews.

**Required remediation:** Preserve Metro defaults, align SDK packages, resolve or formally explain duplicate resolution, rerun a clean install and native builds, update the affected workspace dependency chain for the advisory, and make Expo Doctor a required MyNews CI gate.

## Medium-severity findings

### M01. Launch UI still contains stale staged-delivery copy

The Support tab says `Phase 4`; the web home says the reader launches with `Phase 1`; credibility screens name `Phase 3` and `Phase 5`; a Today empty state says following arrives with Discover even though Discover exists. This directly conflicts with the full-function release mandate and makes the product look unfinished.

### M02. New-user activation and discovery are weak

Today depends on followed journalists, Discover requires a search query, and the unconfigured web home is nearly empty. There is no complete onboarding feed, topical browse, newsroom browse, explainable recommendations, or resilient public landing experience.

### M03. Accessibility and localization lack release evidence

Many native press targets need systematic role/label/state verification. No VoiceOver, TalkBack, keyboard, reduced-motion, dynamic type, contrast, screen-reader, or localization matrix was found. The legal and safety paths are English-only.

### M04. Build warnings and server boundaries remain unresolved

Both Next.js builds infer `/Users/trey` as their workspace root because of multiple lockfiles. Neither sets `outputFileTracingRoot`. The console warns that the Next.js ESLint plugin is not detected. Public Supabase server code is protected only by convention rather than a `server-only` import.

### M05. Reporting deduplication prevents reason escalation

The one-open-report uniqueness key is reporter, target kind, and target ID, not reason or severity. A prior low-severity report blocks a later urgent classification from that reporter. The service returns `already-reported` without merging evidence, raising severity, or informing the reporter.

## Verified strengths

- Ed25519 signatures cover article revisions, suggestions, suggestion rejects, key possession, and article metadata, with server verification on protected write paths.
- The private signing key is not sent to the server. Unconfigured identity failure disables publishing instead of fabricating a key.
- July 5 hardening closed direct suggestion insertion and stored citation-XSS paths identified in the prior report.
- React surfaces render user text as escaped text; no MyNews `dangerouslySetInnerHTML` path was found.
- RLS is enabled throughout, sensitive operational tables generally have no client policies, and service-role RPCs use explicit grants and search paths.
- Reporting, block/mute, legal, moderation, NCII queue, DSA reasons, and repeat-infringer concepts now have real code and tests. The problem is completeness and operational integrity, not total absence.
- Android backup is disabled and declared permissions are minimal.
- The public web DMCA form does not fabricate success when its edge function is unconfigured. It returned 503 in the browser check.
- The DMCA page fits a 390px viewport without horizontal overflow.
- CI pins third-party actions by commit and runs OSV scanning, parity, lint, typecheck, tests, and coverage at the workspace level.

## Complete remediation and launch plan

The canonical execution outline is also maintained at `docs/plans/queue/48-mynews-production-readiness-remediation.md`. Every workstream is required for the same production launch.

### Workstream A. Product truth, subscriptions, and journalist support

1. Finalize the controlled domain and product identity.
2. Implement the complete RevenueCat/App Store/Play subscription lifecycle and entitlement enforcement.
3. Implement direct journalist support with compliant payment routing, Connect/KYC, ledgers, receipts, webhooks, disputes, refunds, payouts, reconciliation, fraud, taxes, and operator tooling.
4. Complete verification, premium value, author earnings, support history, and transparent fee UX.
5. Replace all staged-delivery copy and add claim-to-capability tests.

### Workstream B. Identity, account lifecycle, and privacy

1. Implement full account deletion, web deletion requests, data export, job status, and processor cleanup.
2. Define signed-public-content retention/anonymization with counsel and expose it clearly.
3. Implement encrypted key backup, import/export, recovery, rotation, revocation, and multi-device continuity.
4. Split public/private profile data and remove public auth/enforcement/payment identifiers.
5. Add retention, legal hold, age, minor safety, and data-subject operations.

### Workstream C. Trust, safety, and legal operations

1. Make report intake atomic and severity-upgradable, with urgent NCII fail-closed behavior.
2. Build authoritative media storage, quarantine, hashing, vendor/NCMEC integrations, and urgent-case drills.
3. Build complete DMCA and counter-notice queues, schemas, communications, timelines, restoration, and designated-agent operations.
4. Add pre-publication filtering, risk scoring, quarantine, expanded taxonomy, appeals, and transparent restoration.
5. Enforce Terms and suspension consistently across all mutation paths while retaining safety reporting and appeals.
6. Staff moderation, define on-call and SLAs, train operators, and rehearse critical incidents.
7. Obtain counsel approval for Terms, Privacy, Guidelines, DMCA, DSA, retention, age availability, payments, and jurisdiction choices.

### Workstream D. Security and moderator integrity

1. Replace public base-table access with least-privilege views and RPCs.
2. Add canonical content/input bounds in TypeScript and SQL.
3. Move direct comments and other bypass paths behind signed, rate-limited, fail-closed server boundaries.
4. Add MFA/WebAuthn, RBAC, dual control, required reasons, transactional actions, assignments, and appeals to the console.
5. Run threat modeling, live RLS matrices, SAST/dependency/secret scanning, abuse testing, and an independent penetration test.

### Workstream E. Reliability, deployment, and incident readiness

1. Create reproducible staging/production infrastructure, deployment, migration, smoke, rollback, and environment manifests.
2. Add structured observability, traces, dashboards, queue-age metrics, synthetic probes, alerts, SLOs, and on-call routing.
3. Configure backups/PITR, encrypted exports, restoration drills, RPO/RTO evidence, and disaster recovery.
4. Add mail delivery monitoring, payment reconciliation alarms, moderation SLA alerts, and vendor-outage handling.
5. Run full launch rehearsals and preserve evidence artifacts.

### Workstream F. Web, native, store, and release evidence

1. Add security headers, bounded fetches, honest outage states, controlled SEO metadata, favicon, and complete public navigation.
2. Resolve Expo Doctor, Next.js tracing, ESLint, native dependency, and release-manifest issues.
3. Produce icons, splash/adaptive assets, screenshots, listing copy, privacy labels, data-safety forms, ratings, review notes, and controlled support/deletion URLs.
4. Complete VoiceOver, TalkBack, keyboard, dynamic type, contrast, reduced-motion, localization, and device matrices.
5. Add live database, web, console, native, payment, email, two-device, migration, load, recovery, and store-build test suites to CI.

## Production launch gates

Launch is authorized only when every gate below has objective evidence:

- Controlled domain and monitored legal, safety, privacy, and DMCA contacts pass delivery tests.
- Product, legal, store, and runtime claims match deployed capability.
- Subscription and journalist-support sandboxes pass end to end, including webhook replay, refund, dispute, payout, and reconciliation.
- Account deletion and export pass on iOS, Android, and web, including processor cleanup and retained-data disclosure.
- Key recovery and two-device continuity pass loss, rotation, revocation, and compromise scenarios.
- Every anon/auth/moderator/service-role RLS matrix test passes against an ephemeral real database.
- DMCA, counter-notice, NCII, CSAM, appeals, and moderation drills meet counsel-approved SLAs with alerts and audited operator action.
- Backup restore, rollback, incident response, vendor outage, and queue-backlog exercises meet defined RPO/RTO/SLOs.
- Expo Doctor, dependency scan, typecheck, lint, tests, coverage, parity, builds, native E2E, web E2E, console E2E, load, and security tests are green.
- App Store and Play packages include final assets, metadata, privacy declarations, ratings, encryption answers, review instructions, and production URLs.
- Independent legal review, security review, and operational sign-off are documented.

## Remediation started in this review

- CodeRabbit was disabled in `.claude/settings.json` and prohibited in synchronized `AGENTS.md` and `CLAUDE.md` rules. Commit: `877384c6`.
- The first code-remediation batch begins after publication of this report. This section will be updated and the HTML regenerated so the opened artifact remains current.

## Current authoritative references

- Apple App Review Guidelines, including UGC Guideline 1.2: <https://developer.apple.com/app-store/review/guidelines/>
- Apple account deletion guidance: <https://developer.apple.com/support/offering-account-deletion-in-your-app>
- Google Play UGC policy: <https://support.google.com/googleplay/android-developer/answer/9876937>
- Google Play account deletion requirements: <https://support.google.com/googleplay/android-developer/answer/13327111>
- U.S. Copyright Office DMCA agent directory and notice elements: <https://www.copyright.gov/dmca-directory/>
- 17 U.S.C. 512 notice and counter-notice text: <https://www.law.cornell.edu/uscode/text/17/512>
- EU Digital Services Act: <https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng>

## Final conclusion

MyNews has enough real engineering to justify finishing it, but it is not close to an honest public launch in its current operational state. The highest-risk issue is not one isolated bug. It is the gap between a polished trust-and-safety story and the systems, ownership, legal intake, recovery, payments, and runtime evidence needed to make that story true. Close every launch gate above, rerun this review against a configured staging environment, then conduct the independent legal and security sign-offs before submission.

