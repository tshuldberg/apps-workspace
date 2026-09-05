# MyNews Plan 48, Wave 2 session (2026-07-30)

Continuation of `docs/plans/active/48-mynews-production-readiness-remediation.md`.
Branch: `feature/mynews-plan48-wave2` off `main` at `2f5f6e81`.

## Stage 1: Ground-truth verification (Task 1)

Method: direct code reads by the orchestrator plus two Explore verification agents
(WP2, WP7) whose load-bearing claims were re-verified in source before acceptance
(resolver regexes in `20260712000002_mynews_dmca_counter_notice.sql:261-349` vs the
real `apps/mynews-web/app/**/page.tsx` routes; `clientIp` fallback chain in
`supabase/functions/mynews-dmca/index.ts:211-241`; `apps/mynews-web/app/legal/page.tsx`
hardcoded 2% claim; `PremiumGate` wrapping the whole Stack in
`apps/mynews/app/(root)/_layout.tsx`; `apps/mynews-web/lib/editing.ts:217` Phase 3 string).

### Ground-truth table (verified against main `2f5f6e81`, 2026-07-30)

| WP | Wave | Status | Evidence |
|---|---|---|---|
| WP1 intake atomicity | 1 | DONE | `7e1f9cfb`; migration `20260712000001_mynews_report_atomicity.sql`; refactor `68336b2c` |
| WP2 DMCA/counter-notice | 2 | PARTIAL (landed `c792cb38`, merged `c1823df0` 2026-07-17) | Resolver+txn intake, 512(g)(3) schema+Zod, console queue, tests all real. 7 gaps below. |
| WP3 RLS/DTO scrub | 1 | DONE | `39442139`; migration `20260712000003_mynews_public_views.sql`; plan LANDED note |
| WP4 comment boundary+bounds | 2 | NOT STARTED | No `bounds.ts`, no `mynews-comment` fn; `cloud-fetch.ts:1399` posts comments raw to PostgREST |
| WP5 deletion/export | 3 | NOT STARTED | No `mynews-account` fn; `nw_deletion_requests` absent from migrations and module |
| WP6 key custody | 3 design / 4 impl | DESIGN DONE (rev 2, opus-reviewed) | `docs/designs/mynews-key-custody.md`; `src/signing/` has only canonical/sign primitives; no migration |
| WP7 subscriptions/support | 3 | PARTIAL (landed `c792cb38`) | RevenueCat lifecycle + honest gates DONE; support rails substantial; 7 gaps below |
| WP8 screening/taxonomy/verification | 4 | NOT STARTED | No `src/screening/`; no migration; taxonomy still WP1 baseline |
| WP9 console integrity | 5 | NOT STARTED | No `nw_moderator_roles`/`nw_pending_actions`; console has allowlist auth only |
| WP10 web/native hardening | 5 | NOT STARTED | `apps/mynews-web/next.config.ts` has no security headers; no web auth/OTP; ReportButton honest not-signed-in |
| WP11 observability/CI/E2E | 5 | NOT STARTED | No mynews CI jobs in `.github/workflows`; no e2e dirs; `_shared/observability.ts` unused by mynews fns |
| WP12 final review | 6 | NOT STARTED | n/a |

### WP2 verified gaps (all confirmed in source)

1. Resolver URL vocabulary mismatch: accepts `/article|/a`, `/journalist|/profile`,
   `/suggestion/<uuid>`; site serves `/a/[slug]`, `/a/[slug]/suggestions`, `/j/[handle]`,
   `/e/[handle]`. Only article URLs resolve. Form placeholder teaches a dead route.
2. Anonymous rate limit IP derivation fails OPEN: without the signed `x-mynews-*`
   headers, `clientIp` trusts `cf-connecting-ip`/`x-forwarded-for` etc. (leftmost,
   client-controlled). Direct function callers bypass both buckets. Also fixed-window
   (5 per 10 min) instead of the planned token bucket; no counter GC.
3. No in-app counter-notice path (mobile `legal/dmca.tsx` is informational only).
4. No executed-SQL coverage: migration tests are regex over the SQL text; the
   375-line `nw_dmca_apply_action` state machine has zero execution coverage
   (owned by WP11 ephemeral Supabase suite).
5. `restore_content` handles only article/suggestion; resolver legitimately produces
   `profile` targets which then cannot be restored via the RPC.
6. `link_strike` only accepts `suspend_profile` moderation actions; a strike tied to
   `hide_article` cannot be linked.
7. Forwarding records timestamps/recipient but sends no mail (512(g)(2)(B) forwarding
   is manual, console-attested). Mail infra is founder-ops; the action state must stay
   explicit about non-delivery.

Doc drift found: `modules/mynews/CLAUDE.md` claims `mynews-dmca` runs `verify_jwt` OFF;
it is absent from `supabase/config.toml`'s off-list, so gateway JWT verification is ON
(anon key satisfies it). Behavior fine, doc wrong.

### WP7 verified gaps (Wave 3 ownership, recorded now)

1. Fraud velocity checks entirely missing; client generates a fresh idempotency key
   per attempt (`support-client.ts:68-70`) so retries dedupe nothing.
2. `reconcileSupportLedger` (`modules/mynews/src/data/support.ts:235-320`) has no
   caller besides its tests: no job, no report.
3. Payout attribution non-functional against real Stripe Connect: webhook never reads
   `event.account`, and automatic payouts carry empty metadata, so
   `nw_apply_payment_event` rejects them (`invalid-payout-metadata`); `paidOutCents`
   stays 0 and nothing initiates payouts ($10 threshold unenforced).
4. Release gate env matrix narrower than plan: does not check payments-enable env,
   in-app legal-contact env (`EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL` etc.), NCII worker
   secret, or console settings; `release-manifest.schema.json` never used
   programmatically (hand-mirrored in `check-build-env.mjs`).
5. `PremiumGate` wraps the entire Stack: unentitled/unconfigured builds cannot reach
   legal/terms/privacy/DMCA/notices screens (store-review + DSA access risk).
6. Web legal pages pin the frozen unconfigured legal bundle, while
   `apps/mynews-web/app/legal/page.tsx` hardcodes the 2% support claim; web has no
   capability detection.
7. Coverage holes: no SubscriptionProvider/PremiumGate behavior tests (node-only
   vitest graph); support-migration tests are SQL-text regex; no product-copy
   claim-to-capability test (which is why `editing.ts:217` "Phase 3" survived).

### Plan corrections applied

- Plan amended with a dated Status Delta (2026-07-30) reflecting the table above.
- WP2 marked LANDED-PARTIAL with the gap list; WP7 marked LANDED-PARTIAL (gaps owned
  by Wave 3 execution).
- Migration numbering note updated: new migrations use `20260730*` (the `20260712*`
  block now collides with landed yearn/mynews pairs, and `20260730000001` is taken by
  in-flight yearn work in the same tree).

## Stage 2: Wave 2 execution (WP2 gap closure + WP4)

### WP2 gap closure (orchestrator-implemented, complete)

New migration `supabase/migrations/20260730000002_mynews_dmca_hardening.sql`:
- `nw_resolve_public_url` v2: vocabulary now matches the live web router
  (`/a/[slug]`, `/a/[slug]/suggestions` resolving to the ARTICLE target,
  `/j/[handle]`, `/e/[handle]`, plus legacy `/article`, `/journalist`,
  `/profile` and the `/suggestion/<uuid>` deep link).
- `nw_consume_dmca_rate_limit` v2: real token bucket (capacity 5, one token
  per 120s; columns `tokens`, `last_refill_at` added) with bounded
  opportunistic GC of counters idle 30 days; same signature and outcomes.
- `nw_dmca_apply_action` v2: `restore_content` handles `profile` targets by
  lifting `suspended_until` (idempotent); `link_strike` accepts every
  enforcement action (`suspend_profile`, `hide_article`, `hide_suggestion`);
  `forward` and `forward_to_claimant` events record
  `delivery: manual-attested` (no automated mail exists; founder-ops).

Edge `supabase/functions/mynews-dmca/index.ts`:
- `clientIp` fails closed: ONLY the HMAC-signed `x-mynews-*` platform headers
  are accepted; the spoofable transport-header fallback chain is deleted.
- Authenticated path: a user JWT (in-app) is rate-limited per account
  (`user-bucket`, `user-pair-bucket` keys) with no IP required; anonymous
  (web BFF) keeps signed-IP + email buckets.

Shared vocabulary: `classifyDmcaPublicUrl` + `DMCA_URL_RESOLUTION_FIXTURES`
in `modules/mynews/src/data/dmca.ts` (exported via cloud-fetch subpath); the
store twin and SQL mirror it; `apps/mynews-web/test/dmca-routes.test.ts` walks
the REAL app router so a new content route cannot ship unresolvable.

In-app counter-notice path (G3): `apps/mynews/app/(root)/data/dmca-client.ts`
(payload builder pinning 512(g)(3) attestation texts + typed submit with
queue-proof honesty guard), full-form screen
`apps/mynews/app/(root)/legal/dmca-counter.tsx`, entry points on the DMCA
legal screen and the Notices screen, Stack route registered.

Console honesty (G7): both forwarding action cards now state that no
automated email exists and the action records manual delivery only.
`modules/mynews/CLAUDE.md` verify_jwt drift fixed.

Tests: mynews-dmca 18 (4 new), twin store 63 incl. token-bucket rewrite,
module dmca 81 incl. fixtures, web 71 incl. 4 route-drift, console 31,
app dmca-client 8. Mutation checks (all confirmed kill): spoofable-header
fallback reintroduced, token refill removed, `|j|e` dropped from twin regex,
authenticated path disabled, classifier `|j|e` dropped, client status-map
broken, client queue-proof guard weakened.

### WP4 comment boundary + canonical bounds (module-dev agent, orchestrator-reviewed)

Agent-implemented, orchestrator re-read every fail-closed path (mynews-comment
handler, migration guard trigger + RPC, suggest diff enforcement, publish and
review bounds diffs) before acceptance.

- `modules/mynews/src/data/bounds.ts` (canonical MYNEWS_BOUNDS, each value
  sourced from an existing enforced limit or documented as new) +
  `supabase/functions/_shared/mynews-bounds.ts` mirror with two-sided drift
  pins (terms-mirror pattern).
- Migration `20260730000003_mynews_comment_boundary.sql`: drops the bootstrap
  client comment INSERT policy, adds a client-write guard trigger (report
  lockdown pattern), service-role `nw_insert_suggestion_comment` RPC that
  re-validates, immutable plpgsql helpers `nw_citations_within_bounds` and
  `nw_diff_within_bounds`, and guarded CHECK constraints for headline (300),
  dek (600), body (400000 BYTES), changelog (100), rationale (4000),
  citations (20 x https x 2000), diff (200 ops / 200 blocks / 20000 chars /
  400000 bytes / typed op kinds), comment body (1..4000), display_name (80),
  bio (2000), report detail (2000). Constraints added validated on purpose
  (pre-launch; loud failure preferred over NOT VALID silence).
- `mynews-comment` edge function: JWT-only, suspension hard stop, current
  Terms, durable 10/min per-profile throttle counted over real rows (count
  failure = 503, never an empty window), bounds, draft-visibility gate
  mirroring mynews-suggest; `cloud-fetch.postSuggestionComment` now calls it
  (raw PostgREST insert gone) with client-side bounds precheck.
- Structured diff: typed + bounded `StructuredDiffJsonSchema`; mynews-suggest
  rejects non-diff-shaped input outright; stored legacy rows are skipped in
  the near-dupe scan rather than crashing.
- Publish/review enforce headline/dek/body/changelog bounds before signature
  verification; SLUG_RE now derives from the shared constants.
- Tests 728 -> 781 module-side plus new edge suites; 22 agent mutation checks
  all confirmed kill (two required a digit-boundary matcher after plain
  toContain failed to catch a widened bound; matcher added).

### Suggest throttle fail-closed alignment (orchestrator)

The WP4 agent flagged that `mynews-suggest` still failed OPEN when the
throttle count threw (logged and proceeded, with a pinned test). Fixed to a
retryable 503 (`suggest-unavailable`), aligned with the report (WP1) and
comment (WP4) throttles; pinned test flipped and mutation-checked; app
desk-errors copy added for the new code.

### Concurrent-session incident (mitigated)

A parallel session working yearn plan 47 shared this checkout and committed
three commits onto `feature/mynews-plan48-wave2` while it was checked out
(`f7068a34`, `2c5b4db4`, `e5232bbb`). That session moved itself to a git
worktree and its own branch (`feature/yearn-plan47-remaining`, which contains
those commits) and logged the incident row on main. This branch was rebased
(`git rebase --onto 2f5f6e81 e5232bbb`) so it now contains only the two
mynews commits; nothing was lost on either side. Workspace rule recorded in
auto-memory: concurrent sessions must not share the checkout.

### Wave 2 verification battery (all green)

- `pnpm gate:function:changed --staged` via the pre-commit hook on the wave
  commit (passed; commit landed).
- Module `@mylife/mynews`: 53 files, 781 tests.
- App `apps/mynews`: 20 files, 199 tests. Web: 71. Console: 31.
- Edge suites from repo root: 1739 assertions green (the mynews-review suite
  must run from a package context where `@mylife/sync` resolves, e.g.
  `cd modules/mynews && npx vitest run ../../supabase/functions/mynews-review/...`,
  44 tests green; the root-run import error is a pre-existing resolution
  artifact, verified present at 2f5f6e81, not a wave regression).
- `pnpm check:parity --quiet`: exit 0 (includes the WP4 additions to
  `scripts/check-mynews-parity.mjs`).

Founder-ops recorded, not faked: outbound DMCA forwarding email (console
records manual-attested delivery only), designated-agent registration, live
Postgres execution of the new migrations (no local Postgres available; SQL
statically pinned by tests, WP11 ephemeral suite owns live execution).

## Stage 3: Wave 3 execution (WP5 + WP7 gap closure)

Two module-dev agents under orchestrator-authored scopes; the WP7 agent died
repeatedly on API 529 overloads near the end, so the orchestrator finished
its remaining item (accountWorker attestation) and performed the full
per-gap source verification the agent could not report.

### WP5 (agent-implemented, orchestrator-reviewed)

Migration `20260730000006_mynews_account_lifecycle.sql` reviewed line by line
at the dispose function: FOR UPDATE claim, status guard, hard-delete list
(follows, blocks as blocker, memberships, verification evidence, own
comments, open/rejected/stale suggestions, sole-author drafts), guarded
collaborative drafts scrubbed instead of deleted so other editors' ledger
survives, money stopped not deleted, legal/safety tables untouched (pinned by
a test asserting no delete statement targets them), idempotent anonymization
(deleted_at guard, unique handle loop, user_id -> null detach so the
admin-API deletion cannot cascade the retained record, every auth.uid()
policy fails closed on null). Edge fn: typed 'DELETE MY ACCOUNT' strict
compare, 10-minute fresh-token gate that fails closed on missing iat (honest
caveat documented: token freshness is a fresh-session signal, not proof of
re-typed credentials, which is why the phrase + 7-day cancellable grace
exist), suspended users retain deletion/export rights. Worker: secret-gated,
skipped-unconfigured states are terminal and never rewritten to done.
Export: 32 always-present keys with an SQL/twin drift pin. 11 mutation
checks, all confirmed kill. Deviation recorded in the plan: no
awaiting_confirmation state (confirmation is synchronous).

### WP7 gap closure (agent + orchestrator finish)

All 7 gaps verified closed in source by the orchestrator: velocity buckets +
server-side idempotent checkout replay (`nw_begin_support_checkout`);
`mynews-support-worker` + `nw_support_reconciliation_runs` + read-only
console /support page; payout attribution v2 reading the Stripe event
envelope `account` and resolving via `nw_payout_accounts`, unattributed
payouts recorded as typed failures; schema-driven release gate (walker loads
`release-manifest.schema.json`; schemaRequiredPaths drift test) plus
payments-live env agreement and legal-contact env checks; entitlement-exempt
routes (`legal`, `notices`, `account-delete`, `account-export`) via pure
helper pinned against registered Stack screens; per-request capability-keyed
web legal bundle (2% claim only when payments live); staged-delivery strings
gone (incl. a leftover Phase 5 comment); product-copy scan tests in app and
web. Orchestrator completed the accountWorker attestation slot (schema,
manifests, gate loop, tests; mutation-checked) after the WP5 handoff.

### Environment fixes found during close-out

- `pnpm install` was needed to materialize `expo-iap` (yearn merge landed in
  the lockfile but node_modules was stale); yearn-app typecheck green after.
- Pre-existing, now logged in errors_log: `npx tsc -p
  supabase/functions/tsconfig.json` fails on bestchef-vision test types and
  the mynews-review sync import; the config is wired to no gate (WP11 owns
  wiring or retiring it).

### Wave 3 battery (all green)

Typecheck all four packages. Module 892 (59 files), app 240 incl. gate 18,
web 98, console 35, edge suites 625 assertions, `pnpm check:parity` exit 0.
Pre-commit function gate passed on the wave commit.

## Stage 4: Wave 4 execution (WP6 key custody + WP8 screening/taxonomy/verification)

Two module-dev agents; a sustained API-529 overload period killed both at
spawn and the WP8 agent's final report turn, so the orchestrator re-nudged
through the outage, verified WP8's deliverables directly in source, and
handled close-out defects itself.

### WP6 (agent-implemented per the rev-2 design, orchestrator-reviewed)

Migration 20260730000008 (1619 lines) reviewed at the dangerous paths:
nw_key_rotate consumes the bound nonce by DELETE RETURNING inside the
transaction, re-asserts the head with a guarded update (deleted/anonymized
profiles excluded), catches unique_violation from the global active-pubkey
index, and publishes a backup-restore transparency event when a bind follows
an escrow read within 24h. Agent deviations, all accepted: initial chain row
written by an AFTER UPDATE trigger on first bind (nw_set_profile_pubkey
byte-unchanged; anonymization clearing the head revokes all chain rows,
covering WP5's dispose without redefining it); verified_key_id stamped by
BEFORE INSERT triggers; suggestions gain signer_pubkey (latent bug: rotation
would have silently unverified every suggestion an editor ever filed; legacy
rows backfilled factually from initial chain rows); RevisionSummary carries
revision text for reader verification; escrow access log gains seq ordering;
web verification badge deliberately NOT shipped with the reasoning documented
(server-asserted verification defeats the verifier; client island ships
tweetnacl to every reader). @noble/hashes ^1.7.1 added to modules/mynews
(zero transitive deps; workspace shipped no scrypt). 71/71 mutation checks;
the two initial survivors became real findings (separator mutant, recovery
code width aliasing) and were fixed with pinned tests. The no-kit recovery
honesty boundary: nw_key_notify_channels has NO confirmation path shipped, so
the path is structurally unavailable and renders that truthfully.

### WP8 (agent-implemented; orchestrator verified deliverables in source)

Screening engine modules/mynews/src/screening/ (lexicons, URL heuristics,
structure anomalies, adversarial fixtures, fail-closed vendor seam), shared
gate _shared/mynews-screening-gate.ts (unavailable = 503, approved allowance
binds to exact canonical bytes + kind), quarantine statuses on revisions and
suggestions with policy-level public exclusion, transactional
nw_screening_decisions audit + console screening queue with appeals +
false-positive measurement, taxonomy expansion with child-safety at the NCII
tier (24h urgent lane; submission rolls back if the case cannot open),
drift-pinned SLA routing, verification center + console page + badges,
credibility Sybil weighting, endorsement-ring detector. Shell RSC guard
allowlist widened for the three verified-pure specifiers.

### Orchestrator close-out fixes

- WP5 account tests went red mid-session: they pinned NOW_MS at
  2026-07-30T12:00Z while the store twin (like the SQL RPC) stamps
  requestedAt from the real clock; the tests broke the moment wall time
  crossed the pin. Claim times made clock-relative. errors_log row added.
- Wave 4 pre-commit gate failure: edge-twin.test.ts imports the untracked
  generator script scripts/gen-mynews-screening-twin.mjs, invisible to the
  staged-mode gate until staged. Staged; errors_log row added.
- accountWorker attestation (WP5 handoff) was finished by the orchestrator in
  Stage 3's close-out and is in the wave 3 merge.

### Wave 4 battery (all green)

Module 1425/80 (post-fix), app 266/24, web 99/13, console 45/5, parity exit
0, typechecks clean across all four packages, staged function gate green on
the wave commit (9f40990d).

## Stage 5: Wave 5 execution (WP9 console integrity + WP10 hardening + WP11 CI/observability)

Three parallel module-dev agents; orchestrator handled cross-agent handoffs
and close-out defects.

### WP9 (behaviourally verified on a live local Postgres)

The agent stood up postgres:17-alpine, applied all 24 MyNews migrations from
scratch, and ran a 141-check behavioural suite plus a real two-connection
concurrency test; the committed migration is what passed. AAL2 TOTP MFA with
deliberately NO bypass; RBAC with a one-shot founder bootstrap and last-admin
protection; five transactional version-checked enforcement RPCs (typed
stale-action conflicts, refusals audited); dual control where self-approval
is refused by a table CHECK constraint, not just the RPC; keyset pagination
everywhere including the DMCA queue whose silent 500-row cap is gone; unified
appeals over the moderation and screening sources with same-moderator recusal
in SQL; hash-chained audit (length-prefixed hashing, advisory-lock
serialization) with an export verifiable without trusting the database.
56/56 mutations. Notable honesty choices: terminate_account is permanent
suspension (erasure stays the WP5 user path); no payment_adjustment
pseudo-kind without an executor; an unreadable role table reads as an outage,
not as revoked access.

### WP10

Web email-OTP reporting in place on the page: JWT confined to cookies
(never readable by JS), OTP endpoint is not an account-existence oracle,
shouldCreateUser false, DMCA anonymous path untouched. Nonce CSP + full
header set on both web apps; the whole site went force-dynamic because a
nonce cannot be stamped into a prerendered page (shell test pins it).
Bounded fetches with a four-state result; documented deviation: page-level
outages are 200 + noindex because App Router pages cannot emit 5xx, while
route handlers send real 503 + Retry-After. Real a11y audit: 39 error
messages were silent to screen readers and now announce; all inputs labeled,
all pressables roled. Expo Doctor 16/18 with two root-lockfile exceptions
(the workspace expo 54.0.36 patch bump is recorded as a pending root-config
action). 39/39 mutations; 4 first-run escapes each exposed and fixed a real
test weakness.

### WP11

No-PII structured logging across all 18 functions (closed field set, hashed
subjects, awaited emission after finding a real teardown race);
mynews-health with a public shallow payload that names no components and
secret-gated detail (unset secret = unavailable, never open); data-driven
queue-age thresholds seeded from the real statutory deadlines; currency-gated
env matrix (55 vars); fail-closed ops scripts; four runbooks kept factual by
the sub-agent sweep; mynews.yml CI with a pnpm-filter no-op guard and an
HONEST RLS lane (no live RLS suite exists anywhere in the repo; the lane runs
the static contract harness with an explicit skip marker and FAILS if
credentials appear so secrets cannot manufacture a green); Playwright web 24
+ console 11 against a real TLS local fixture server with drift specs;
11 Maestro flows with three independent default-off write gates. 28 mutations
across the WP11 surfaces.

### Orchestrator work in this stage

Fixed the console middleware auth redirects to carry the CSP (WP9's finding
in WP10's file, both idle); updated the two review serveEnvelope tests for
the WP11 required-log-options signature and tightened the leak assertion to
check the structured line specifically; added health verify_jwt + secret-gate
parity pins (mutation-checked; the agent then deduplicated them into its
nine-function verify_jwt pin table, resolving a stash conflict it created in
the shared checkout, logged in errors_log); gitignored Playwright artifact
dirs.

### Wave 5 battery (all green)

Module+edge 1529/83, app 282/25, web 162/17, console 299/13, scripts 43/2,
Playwright 24+11 locally, parity + env matrix + scoped edge typecheck green,
staged function gate green on commit df268940.

### Honest residuals after Wave 5

- No live/ephemeral RLS-RPC suite exists (WP3 deferred to WP11; WP11 refused
  to fake it). Owned by WP12 or founder-ops; the CI lane fails loudly if
  credentials are set before it exists.
- Workspace expo 54.0.36 patch bump: root-config action, one lockfile
  refresh lifting all seven Expo apps.
- Live smoke, dashboards, paging, device-farm, pentest: founder-ops on
  deployed infrastructure.

## Stage 6: Wave 6 - WP12 final adversarial review + remediation

Branch feature/mynews-plan48-wave6 off main at 376a9461. Four independent
adversarial reviewers (three opus: deletion+custody, screening+console,
web+payments+DMCA; one gpt-5.5 via Codex over the full diff), each tasked to
break the highest-risk surfaces. The orchestrator reproduced every load-bearing
finding in source (and executed the screening engine for A1/A2) before fixing,
and mutation-checked every fix.

### verify_jwt parity gate (4 rounds, all fail-closed)

A WP11 finding cascade: the gate pinned the exact gateway-exempt function SET
(catches additions, not just flips), then per-block parsing (a verify_jwt below
another key evaded), then a fail-CLOSED default (an unreadable header FAILS
rather than silently skipping), then quoted-key/spaced-dot header tolerance with
no false alarm on an omitted line. Commits 24f50387, 3d194f36, 9a507243,
2a5089ee. Each mutation-checked. Lesson recorded: test the detector against
shapes it was not written for, not just the extractor.

### Fixed and committed

- Web (2aee0382): HIGH anonymous DMCA rate-limit bypass - the BFF laundered a
  client-controllable header (cf-connecting-ip, ...) into the HMAC-signed
  platform IP; now reads only the deployment-declared
  MYNEWS_TRUSTED_CLIENT_IP_HEADER and fails closed, plus an edge email-only
  bucket so IP rotation is not a full reset. MED CSRF/session-fixation guard on
  all state-changing routes (report/otp/verify/signout/dmca). MED OTP timing
  oracle closed via next/server after(). MED unbounded DMCA BFF fetch bounded.
- Custody (496bce2b): HIGH client-writable deleted_at/pubkey_revoked_at - the
  guard was a denylist; extended it, and dispose now keys idempotency on the
  anonymization marker not deleted_at (migration 20260730000013). MED WP6
  custody tables (escrow ciphertext of the private key, access log, recovery,
  nonces, channels) now disposed. MED open-reported suggestion retained
  (delete-to-evade). MED auth-user deletion no longer reports done on a
  mis-routed 404.
- Screening (cb13c925): 2 CRITICAL, verified by executing the engine - a single
  doubled letter (kkill, sschool) evaded all matching (fixed with
  elongation-tolerant literals k+i+l+l+, so ass -> a+s+s+ never matches as); an
  apostrophe halved every later weight (fixed to double-quote-only parity). HIGH
  article-freeze - a held revision at current_rev+1 collided the next publish on
  the PK and raised an untyped 500 forever; both write paths now replace a held
  revision at the slot (migration 20260730000014). HIGH advisory-framing
  self-exemption - the discount now requires a self-identifying marker.
- Payments (264fcc81): HIGH concurrent-refund over-refund - the refund branch
  read the receipt without FOR UPDATE and computed the delta from refunded_cents;
  migration 20260730000015 re-defines nw_apply_payment_event byte-identically
  except FOR UPDATE on that select (verified diff), serializing concurrent
  refunds.

### Verified and registered (deferred to the ephemeral-Supabase lane / follow-up)

Real findings whose correct fix needs a live Postgres to validate (large
security-definer function reproduction or multi-file reorder), which is exactly
WP11's ephemeral-Supabase concurrency lane (CI skeleton exists; the live suite
is the documented open item). Each registered in errors_log with the exact fix:
- Codex HIGH: dual-control approval version TOCTOU (lock the target row before
  the version compare); account deletion completes while a live processor
  relationship may persist (retain provider ids until cleanup proves
  done-or-not-applicable; gate completion; conditional UI copy).
- Crypto: reject/set-meta bind to the frozen article key, locking the author out
  after rotation (signing-contract change to authorize the author's current key);
  escrow direct-read (accepted outage fallback); media storage cleanup
  (founder-ops, no bucket yet).
- Safety MED/LOW: A5 child-safety report deduped into the NCII lane (no
  exposure; NCMEC is founder-ops); A6-A9 public-field/allowance/slug gaps;
  B1-B4 audit-fork window, last-admin race, unhashed token, LIKE-underscore.
- Codex MED: onboarding not idempotent, role cardinality not serialized, queue
  claim races.

Console integrity (WP9) held: the opus reviewer could not break authorization,
dual control, replay, the version check, MFA, or audit tamper-evidence, and
independently confirmed the enforcement RPCs lock (the TOCTOU Codex found is the
approval path specifically).

### Battery (all green on the merged wave-6 branch)

Module+edge 1553, app 282, web 168, console 299, edge typecheck 0, all four
package typechecks 0, parity 0, env matrix 0. Every WP12 fix mutation-checked.
