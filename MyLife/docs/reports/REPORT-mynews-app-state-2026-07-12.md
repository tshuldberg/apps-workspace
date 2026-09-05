# MyNews: Exact App State + Path to Production (2026-07-12)

**Snapshot:** `feature/mynews-plan48` @ `1d30b673`
**HTML twin (canonical visual artifact, screen recreations + runbook):** `REPORT-mynews-app-state-2026-07-12.html`
**Launch verdict context:** NO-GO 3.1/10 (`REPORT-mynews-adversarial-production-readiness-2026-07-11.md`); remediation plan 48 in flight, Wave 1 landed.

## State at a glance

| Area | Exact state |
|---|---|
| Signed publishing core | Works: compose/sign/publish, revision history, author-only merges, typed cited suggestions, batch review, newsrooms + embargo. 646 tests green. |
| Safety floor | Works, hardened this session: atomic fail-closed report intake, severity escalation, NCII take-down-first with 48h cases and orphan repair; block/mute, DSA notices, console enforcement. |
| Data privacy (RLS) | Hardened this session: least-privilege public views; user_id, suspension, strikes, stripe_account_id no longer client-reachable. |
| Reader support / 2% fee | No runtime; Support tab is an honest stub. Full rails + capability gating mid-build (WP7). |
| Subscriptions / premium | No runtime; RevenueCat lifecycle mid-build (WP7). |
| Account deletion / export | Absent (App Store blocker); WP5 queued. |
| Key recovery | Absent (device loss = byline loss). Custody design approved after adversarial review; WP6 implementation queued. |
| DMCA / counter-notice | Partial; notice-to-queue gap and counter-notice attestations mid-fix (WP2). |
| Domain, mailboxes, deploy | Not owned / not deployed; mynews.app is a third-party sale page with null MX; every env unset. |

## Surfaces inventoried (code-exact, two independent read-only agents)

- **Mobile (apps/mynews):** 5 tabs (Today, Discover, Desk, Support, Me) + article, journalist, compose, suggest, suggestion review, batch review, register, credibility, newsrooms (+detail), blocked, legal hub (+4 docs), notices. Provider chain: SQLite, Supabase auth (magic link + anonymous), cloud config, on-device Ed25519 identity, version-pinned Terms gate modal on every write. Honesty-first unconfigured copy on ~15 screens ("Not connected to a MyNews server yet", "nothing here is simulated").
- **Web (apps/mynews-web):** home, article + public suggestion threads, journalist, editor credibility (public score math), about/editing, legal hub + terms/privacy/guidelines/DMCA (takedown + counter forms), report buttons (honest not-signed-in). Never fabricates; unconfigured = honest empty or real 404/503.
- **Console (apps/mynews-console):** magic-link + fail-closed email allowlist auth (timing-safe), report queue (tamper-proof target derivation, audited notes, strike/suspend actions), NCII 48h queue (worker can never clear; human-only lift with explicit confirmation).

Workflows documented in the HTML: publish, suggest/review (single + batch), read/follow/report/block, first-run/register/terms.

## Remediation status (plan 48)

Landed: WP1 (atomic intake; C05/M05/H08/C12-partial), WP3 (public views + DTO scrub; C07), WP6 design. Building: review HIGH-1 fix (view embeds -> stitch pattern), WP2 (DMCA/counter-notice), WP7 (payments/subscriptions/release gate/honest copy). Queued: WP4, WP5, WP6 impl, WP8, WP9, WP10 (incl. web sign-in for C10), WP11 (incl. live PostgREST smoke), WP12.

## Founder runbook (12 steps, full detail in HTML)

1. Buy/choose the domain (mynews.app is third-party); DNSSEC, SPF/DKIM/DMARC, monitored legal@/safety@/dmca@/support@ mailboxes; then code sweeps origin + contacts + terms bump.
2. Production Supabase: anonymous + magic-link auth, `mynews://auth-callback` redirect, pg_cron/pg_net, `supabase db push` (nw_ migrations), deploy the 9+ mynews functions (never `--no-verify-jwt` except the secret-gated ncii worker), 401 post-check, `MYNEWS_NCII_WORKER_SECRET` + `nw_job_config` rows, paid tier + PITR.
3. Web deploy (Vercel): `MYNEWS_SUPABASE_URL`, `MYNEWS_SUPABASE_ANON_KEY`, `MYNEWS_PUBLIC_ORIGIN`; live smoke doubles as the PostgREST view-read verification.
4. Console deploy (separate domain): `MYNEWS_CONSOLE_*` env set, allowlist emails, pre-created moderator users, 2+ trained moderators, NCII/DMCA drills.
5. DMCA designated-agent registration + counsel review of all legal docs; any change bumps `CURRENT_TERMS_VERSION` and `EDGE_CURRENT_TERMS_VERSION` together.
6. Safety vendors: StopNCII/PhotoDNA + NCMEC CyberTipline (seams stay honestly unconfigured until creds exist).
7. RevenueCat + App Store Connect (ascAppId 6763167108) + Play Console products; EAS env (`EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS/_ANDROID`, `EXPO_PUBLIC_MYNEWS_SUPABASE_URL/_ANON_KEY`); sandbox purchase/restore/cancel.
8. Stripe Connect for journalist support (webhook secret to the payments function); counsel + store-policy clearance before the capability flag flips.
9. Store listing package: icon/adaptive/splash/screenshots, truthful copy, privacy labels + data safety, ratings, export compliance, review notes + Guideline 1.2 evidence, support/privacy/deletion URLs.
10. EAS production builds (guard fails on missing/placeholder env or manifest), TestFlight/internal track, full device-matrix QA.
11. Observability: uptime + health monitors, PITR restore drill, NCII + DMCA rehearsals, paging rotation.
12. Launch gate: all packets landed, live staging smoke, claims audit, independent security review + pentest, written sign-offs, submit. Revenue = subscription entitlement + (policy permitting) journalist support.

Sequencing: 1-2 unblock everything; 3-7 parallelize; 8 can trail launch behind the fail-closed capability flag.
