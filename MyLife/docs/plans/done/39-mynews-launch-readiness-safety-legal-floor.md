# Plan 39 — MyNews Launch Readiness: UGC Safety + Legal Floor

- **Status:** ALL CODEABLE WORK COMPLETE (2026-07-05). Tracks 0, 0.5, 1 done and green; Tracks 2 (deploy) + 3 (submit) are founder-ops.
- **Owner:** module-dev (lead) + hub-shell-dev (app/web surfaces)
- **Branch:** `feature/mynews-launch-readiness` (off `main`, 17 commits, unpushed)
- **Depends on:** MyNews Phases 0-2 (on main) + Track 0 security fixes (committed `56297fec`)
- **Target:** full public App Store / Play submission (founder decision, 2026-07-05)
- **Source audit:** `docs/reports/REPORT-mynews-production-audit-2026-07-05.html`

## Execution Complete (2026-07-05)

Executed via subagent-driven development (fresh implementer per task + independent verification; every task green before the next). Final state: module 549 / app 169 / web 60 / console 22 tests, all four typechecks, web + console builds, `check:parity`, `check:generated-artifacts`, `gate:function:changed` all pass. Module test count grew 302 -> 549.

- **Track 0 (security fixes):** `56297fec` (F1 suggestion-insert RLS lockdown + F2 citation XSS), `fe77eb6b` (pubkey uniqueness, published_at guard, diff render-safety).
- **Track 0.5 (integrity hardening):** T1 createdAt bounds + suggest throttle (`f6da2d9f`); T2 anti-Sybil maxPairShare gate (`46273555`); T3 reject-requires-signature, domain `mylife-mynews-suggestion-reject-v1` (`a074e5eb`); T4 pubkey proof-of-possession, `mynews-register-key` (`bc424814`); T5 signed article metadata, `mynews-set-meta` (`33ec5424`). All signing changes additive: existing fixtures byte-identical, twins in parity.
- **Track 1 (UGC safety + legal floor):** T6 reporting e2e + anti-abuse, `mynews-report` (`84a00d8f`); T7 block/mute self-scoped + local filtering (`34ba6bf4`); T8 moderation console `apps/mynews-console` + enforcement RPCs + suspension teeth wired into publish/suggest/report (`2872bad2`); T9 DMCA notice + repeat-infringer 3-strike suspend + `/legal` (`f73f0ef4`); T10 NCII take-down-first + 48h SLA worker + hash/NCMEC seams (`45e05638`); T11 DSA statement-of-reasons + Terms/Privacy/Guidelines + enforced terms-acceptance gate (`5231a7b4`).

### Residual items tracked (not closed by this plan)
- **Anti-Sybil (T2):** the single `maxPairShare` gate bites concentrated/small collusion rings; a perfectly even 10+-author ring (share ~0.1) still passes. Full closure needs the Phase 3 verification center's identity/account-age signal. Do not assume Sybil fully closed.
- **Web reporting (T6):** requires a session; `mynews-web` has no sign-in, so anonymous web visitors get an honest "report in the app" state. The app (Apple 1.2 primary surface) reports fully. A web-auth/session path would make web reporting operational.
- **Other provenance editors (T5):** DOI/license/dataset-hash editors beyond embargo plug into the same signed `saveArticleMeta` with no contract change; not yet surfaced as screens.

### Consolidated founder-ops (from tasks; adds to Track 2)
- Register the DMCA designated agent with the U.S. Copyright Office (copy honestly says "in process", must update on registration).
- Resolve the domain + monitored inboxes: `legal@`, `safety@`, `dmca@mynews.app`, `MYNEWS_PUBLIC_ORIGIN` (all placeholders).
- Select the NCII/CSAM hash-matching vendor (StopNCII/PhotoDNA) and wire `matchNciiHash`; wire NCMEC CyberTipline creds in `reportCsamToNcmec`.
- Set the NCII worker secret (`MYNEWS_NCII_WORKER_SECRET` + `nw_job_config` row) and confirm `pg_cron`/`pg_net` enabled so `mynews-ncii-worker` schedules.
- Set the moderation console email allowlist + magic-link; keep the service-role key server-side only.
- Legal-review the Terms/Privacy/Community-Guidelines copy; confirm the `2026-07-05` terms version and the 72h DMCA SLA / 3-strike threshold with counsel. Any doc change must bump `CURRENT_TERMS_VERSION` (parity-enforced across module + edge), which re-gates all users.
- Deploy all mynews edge functions keeping `verify_jwt` ON for user-facing ones; the NCII worker is the only `verify_jwt=false` entry (secret-gated). Never deploy `mynews-review` with `--no-verify-jwt`.

## Why

MyNews is code-complete through Phase 2 (scaffold, publish/read, editing desk) and green. It is a public user-generated-content platform: anyone publishes signed articles and typed suggestions that become public on the web. The production audit found the built code production-grade, but launch is blocked by what is not built: there is no UGC moderation or legal safety floor. `nw_reports` exists as a table with no writer; there is no report, block, or mute UI; no moderation console; no DMCA designated agent; no NCII pipeline; no DSA notice-and-action; and no in-app legal documents. That set is a hard gate for Apple Guideline 1.2, DMCA safe harbor, and EU DSA. This plan builds the complete floor and drives to submission. Per the founder no-minimal-slices mandate, every capability here ships at full function.

## Track 0 — Security fixes (DONE)

Committed on this branch (`56297fec`), verified (module 303, web 48, app 158, typechecks, web build, `check:mynews-parity`, function gate green):
- **F1:** dropped the unused `nw_edit_suggestions` client INSERT policy + added a before-insert guard (migration `20260705000001`). All suggestions ride the service-role edge function.
- **F2:** citations filtered to https-only in the shared `toCitations` read mapper + defensive `safeCitations` at the web render.

Also committed on this branch (`fe77eb6b`, integrity hardening from two independent reviews — a parallel server-side audit + codex gpt-5.5):
- **pubkey squatting (server F1):** partial unique index on `nw_profiles.pubkey_ed25519` (excluding `''`), so authorship/credibility can't be misattributed via the `limit 1`/no-order `getProfileIdByPubkey` lookup.
- **feed-rank manipulation (codex C3):** the `nw_articles` client-update guard now freezes `published_at` for client sessions (was PATCH-able to a far-future value to pin self atop the public latest feed).
- **malformed diff -> 500 (codex C2):** `toDiff` drops ops lacking string `baseBlocks`/`newBlocks` so `diffToBlocks` on the public web reader never throws.

## Track 0.5 — Integrity + reputation hardening (from independent reviews, remaining)

Validated by the parallel server-side audit and/or codex; these change a contract or an engine, so they land as scoped tasks (not the quick Track 0 wins above). None is a remote unauth forge; all are integrity/anti-gaming/defense-in-depth.

1. **Reject requires an author signature (server F2 + codex C4, upgrades F3).** Accept/partial already require an author Ed25519 signature (config-independent), but reject authorizes only off the unverified JWT `sub`. A single `verify_jwt` regression = forge `sub` and silently reject every open suggestion on a victim's articles. Fix: require an author-signed reject payload (new version-suffixed domain string + fixture regen), matching accept's bar. Keep the Track 2 deploy guardrail as belt-and-suspenders.
2. **Pubkey proof-of-possession at registration (server F1, second half).** The unique index (done) stops duplicates, but registration should also require a signature over a challenge to prove key ownership, so a squatter can't claim an unregistered victim key first. Fix: PoP signature in the profile-registration edge path.
3. **Anti-Sybil credibility (server F3).** `nw_editor_aggregates` computes `maxPairShare` (pair-concentration) but `levelFor` ignores it, so a ~10-account sockpuppet ring cross-accepting suggestions reaches `trusted_editor` + elevated caps with no penalty. Fix: feed `maxPairShare` into `levelFor` as a gate/penalty; weight anonymous accounts lower; require identity verification for trusted tiers (ties into Phase 3 verification center).
4. **Sign article metadata (server F5).** `nw_article_meta` (DOI, license, dataset_hashes, rights_route, canonical_url) is client-writable and outside the Ed25519 envelope, so provenance claims are mutable by a hijacked session without breaking any signature. Fix: include a meta hash in the signed canonical bytes, or route meta writes through the signature-verifying edge function.
5. **createdAt validation (server F6, LOW).** `revision.createdAt` is signed but only string-checked; bound it server-side (reject far-future/backdated) since ordering already uses integer `rev`.
6. **Suggest throttle (server F7, LOW).** The suggest pipeline (near-dupe scan of up to 200 rows + aggregates + 500-row ledger) runs before the cap check; add an explicit per-profile throttle.

## Track 1 — UGC safety + legal floor (the public gate)

Build against the existing schema seams (`nw_reports`, `nw_terms_acceptance`) plus new moderation tables. Server-canonical per the BestChef public-launch exception. Keep the twin/parity discipline and the honesty boundary.

### Phase 1 — Reporting (wire `nw_reports` end to end)
- New port methods on both cloud adapters + edge path: `submitReport({ targetKind, targetId, reason, detail })` for `article | revision | suggestion | profile | media`. Reports may be anonymous (`reporter_id null`) or attributed; the RLS insert policy already supports both.
- App UI: a Report action on the article screen, suggestion thread, suggestion detail, and journalist profile. Reason picker (`harassment | violence | ncii | copyright | impersonation | spam | other`), optional detail, honest confirmation. `me.tab` "My reports" list reading `nw_reports_reporter_select`.
- Web UI: a Report affordance on `/a/[slug]`, `/a/[slug]/suggestions`, `/j/[handle]` (server action or a small client form POSTing to the report edge path; obey the web try/catch rule).
- Rate/dedupe + anti-abuse (server F4): one open report per (reporter, target) server-side; rate-limit report inserts; validate `target_id` against a real row of `target_kind` (no free-form phantom targets); require an authenticated session (or captcha) for submission so anonymous, unvalidated NCII/copyright reports cannot be flooded to overload moderation or weaponize the Phase 5 takedown SLA.
- Tests: report submit contract on both adapters; anonymous + attributed; RLS proof that a reporter reads only their own rows.

### Phase 2 — Block / mute + local filtering
- Schema: `nw_blocks` (blocker_id, blocked_profile_id) with self-scoped RLS, mirroring the mesh/Meerkat local-revocation pattern.
- Enforcement: blocked authors' articles and suggestions are hidden from the blocker's feed, article suggestion lists, and threads (client filter over the public read + a server-side exclusion where feasible). Mute = softer hide with an unmute path.
- App + web UI: block/unblock from the profile and from any report flow; a "Blocked accounts" management screen.
- Tests: block hides the target's content in feed/threads; unblock restores; block is device/account-scoped and never leaks the block to the blocked user.

### Phase 3 — Moderation console + reviewer workflow
- A moderation surface over `nw_reports` (either extend an existing console app or a new `apps/mynews-console` following the `apps/bestchef-console` pattern). Service-role reads of the open report queue with target context (article/suggestion/profile snapshot), triage actions writing `status` (`actioned | no_action`), and an audit trail.
- Enforcement actions: hide content (retract article via the existing owner->retracted path or a moderator override RPC), suspend a profile, and record the action. Moderator override RPCs are service-role only, signed/audited.
- Tests: queue read, action transitions, audit row written, no client can reach the console RPCs.

### Phase 4 — DMCA + repeat-infringer
- In-app + web DMCA notice intake (or a documented external agent + web form) routing to `nw_reports` with `reason = copyright`.
- Register a DMCA designated agent (founder-ops, Copyright Office). Repeat-infringer policy: track strikes per profile, suspend on threshold. Counter-notice path documented.
- Published takedown SLA + contact info surfaced in-app and on the web About/Legal page.

### Phase 5 — NCII / TAKE IT DOWN 48h pipeline
- `reason = ncii` reports start a 48-hour SLA clock (a `nw_job_config`-driven worker, mirroring the BestChef worker pattern) with escalation + removal.
- Hash-matching hook seam for known-CSAM/NCII vendors (founder-ops vendor selection: the audit lists this as a launch dependency for a public app). NCMEC reporting path for CSAM.
- Tests: SLA clock starts on ncii report; worker removal path; fail-closed.

### Phase 6 — DSA notice-and-action + legal docs
- DSA Article 16 notice mechanism (covered by Phase 1 reporting) + Article 17 statement-of-reasons to the affected user on action; an EU point of contact surfaced.
- In-app + web Terms of Service, Privacy Policy, Community Guidelines. Acceptance wired to the existing `nw_terms_acceptance` table (versioned; block posting/suggesting until accepted). Published contact info (Apple 1.2 requirement).
- Web: a `/legal` (or `/about/legal`) route rendering the documents; link from the app.
- Tests: terms-acceptance gate blocks write actions until accepted; version bump re-prompts.

### Acceptance criteria (Track 1)
- A user can report every UGC surface on app and web; reports land in `nw_reports` and appear in the moderation queue.
- A user can block/mute an author and stops seeing their content; the block is private.
- A moderator can triage the queue and take an enforcement action that actually hides content, with an audit trail; no client can reach moderator RPCs.
- DMCA intake + designated agent + repeat-infringer policy exist and are documented; takedown SLA + contact published.
- NCII reports start a 48h SLA worker; CSAM has an NCMEC path.
- ToS / Privacy / Community Guidelines are in-app and on web, acceptance-gated via `nw_terms_acceptance`, with published contact info.
- Full baseline green: `pnpm --filter @mylife/mynews test && --filter @mylife/mynews-app test && --filter mynews-web test && --filter mynews-web build && pnpm check:mynews-parity`, plus `gate:function:changed` and `check:generated-artifacts`.
- Apple 1.2 self-check passes (filter, report, block, contact).

## Track 2 — Deploy + go-live (founder-ops, parallel with Track 1)

1. Create the MyNews Supabase project.
2. `supabase db push` — all four nw_ migrations (`20260703000001..3` + `20260705000001`) plus Track 1 migrations. NEVER a bare `db push` if the migrations dir is shared; scope it.
3. Deploy the edge functions with a script (mirror `apps/bestchef/scripts/deploy-functions.sh`): `mynews-publish`, `mynews-suggest`, `mynews-review` — all keeping `verify_jwt = true` (F3: never `--no-verify-jwt`). Post-deploy, verify an unauthenticated `mynews-review` POST returns 401.
4. Enable anonymous sign-in in Supabase Auth; allowlist the `mynews://auth-callback` redirect.
5. App env: `EXPO_PUBLIC_MYNEWS_SUPABASE_URL/_ANON_KEY/_FUNCTIONS_URL`, RevenueCat keys (`EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS/_ANDROID`); never set `ENTITLEMENTS_TEST_MODE=true` in production (the build guard blocks it).
6. Web env: `MYNEWS_SUPABASE_URL`, `MYNEWS_SUPABASE_ANON_KEY`, `MYNEWS_PUBLIC_ORIGIN` (resolve the domain; the fallback `https://mynews.app` at `apps/mynews-web/lib/origin.ts:7` is a placeholder).
7. Live end-to-end: register on device, publish, suggest, review, read on web, RSS/sitemap. Device QA the magic-link deep link and the new safety screens.
8. Longer track: Stripe Connect for reader tips, EAS/ASC + Play Console setup, RevenueCat product `mylife_mynews_unlock`, 501(c)(3) if the science arm ships.
- Note: free-tier Supabase pauses after 7 idle days; keep it warm or upgrade before launch.

## Track 3 — Submit

Complete Tracks 0-2, run device QA, pass the Apple 1.2 self-check, submit to the App Store and Play Console. Store listing, data-safety form, and age rating reflect UGC + the moderation floor.

## Execution notes

- Sub-skill: `superpowers:executing-plans` or `subagent-driven-development`; two-stage review per task (the Phase 2 editing-desk plan proved it catches a real finding per task).
- Invariants that must not break: author-only acceptance; canonical signing bytes + golden fixture; honesty boundary; RSC-safe web subpaths (`@mylife/mynews/cloud-fetch` + `/engines` only); sync scope caps (`nw_` stays `personal_replica` or below); no `supabase-js` in modules/mynews-web; no `@mylife/ui` in mynews-web; no em dashes.
- Do not call `nw_is_newsroom_member` under a service-role JWT (returns false by design).
- Update `memory.md`, `errors_log.md` (on any real failure), a session log, and Open Brain per the repo rules.
