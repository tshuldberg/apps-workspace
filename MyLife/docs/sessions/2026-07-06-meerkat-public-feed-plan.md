# 2026-07-06 — Meerkat Public Base Feed: Evaluation + Plan 39 + UIUX Buildouts

## Founder direction (binding, 2026-07-06)
Meerkat must service public feeds in the Reddit/X class: a first-party base feed we host that anyone can post to, a NEW public alias for each user's public persona (privacy architecture changes for the public tier), public social allowed, human verification required to VIEW with an account, and the $4.99 one-time purchase required to POST.

## What was done
1. **Full git history review** (agent, sonnet): 332 Meerkat-related commits, 177 direct-path; eras 0-10 mapped from mesh-sync birth (2026-03-05) through launch-completion wave 2 (HEAD `fd60e9f3`); 93% of work in the last 23 days. Patterns extracted: ship-then-harden, transport honesty as culture, fail-closed conventions, parity locks, pricing-lock git evidence, non-linear plan sequencing (Plan 37 is truth).
2. **Code-as-is review** (agent, opus): ~60-70% of substrate reusable (Plan 19 read layer, Plan 24 humanity service + wallet UI, Plan 22 IAP rails + entitlement tokens, DoS limiter, report/kill/tombstone primitives, Discover/Reader both surfaces). Plan 26 participation layer 0% built. Account/session/alias layer 0% built and philosophically new (no-account axiom in `hosted-auth.ts`). Core conflict: direction reverses NC-2 ("never require account/verification to view") — recorded as an explicit founder policy reversal for the public tier only.
3. **Plans + design extraction** (agent, sonnet): Plans 19/22/24/26/37 statuses, pricing-lock verbatim, humanity mechanism (App Attest / Play Integrity / Turnstile, 32-token wallet), Open Burrow mockup CSS from the 2026-07-05 walkthrough report.
4. **Authored Plan 39**: `docs/plans/queue/39-meerkat-public-base-feed.md` — 4 tracks, 16 phases (P0-P15), ~32 dev-days codeable. Track A identity+accounts (persona keypair, `pf_personas` alias registry, sessions, GDPR), Track B participation (Plan 26 absorbed: postPolicy, public-post dual-signature protocol, submit route with stacked gates, Plan 24 P3 completion), Track C base feed "The Commons" + consumer UI + verify-to-view enforcement + web parity, Track D operator moderation console + CSAM/NCMEC/DMCA/GDPR + red-team + founder-ops. New NC-P1..P6 replace NC-2; AC-1..AC-6 defined.
5. **HTML deliverable** (opened in browser): `docs/reports/REPORT-meerkat-public-feed-plan-2026-07-06.html` — direction table, git history, code-as-is audit, conflict resolution, architecture (two-identity model), pricing ladder, full plan tables, **14 mobile screen buildouts** (S1 locked feed, S2 verify sheet, S3 alias creation, S4 The Commons feed, S5/S6 composer locked+unlocked with $4.99 sheet, S7 thread, S8 public profile, S9 topic channel, S10 Explore, S11 identity separation, S12 report sheet, S13 persona settings/GDPR, S14 honesty page), **2 web buildouts** (base feed, operator moderation console), **6 workflows** (first-contact, unlock-to-post, submit gate chain, report→takedown, owner opens community, who-learns-what privacy table).

## Key decisions
- Pay-to-post = existing `meerkat_app_unlock` $4.99 one-time SKU. Zero new prices (NC-P5).
- Additive public tier: persona keypair never the device key; private mesh untouched (NC-P1); leakage tests both directions (NC-P2).
- Verify-to-view enforced server-side on first-party routes; self-hosted third-party nodes labeled honestly (NC-P4).
- Base feed = system-owned open-mode publication ("The Commons", working name) on Plan 26 machinery.
- Open founder decisions flagged with defaults: self-hosted view gating, replies gated (yes), feed name, comms for retiring "free anonymous viewing".

## Files changed
- `docs/plans/queue/39-meerkat-public-base-feed.md` (new)
- `docs/reports/REPORT-meerkat-public-feed-plan-2026-07-06.html` (new, opened)
- `memory.md`, this session log

## Verification
Docs-only session: no function logic changed, function gate not applicable (stated per repo rule). No code edited.

## Remaining
- Founder review of Plan 39 + the 4 flagged decisions.
- Sequencing: slot Plan 39 into Plan 37 mission control (it supersedes Plan 26's wave-2 Track C slot and completes Plan 24 P3).
- Execution when approved (tracks A+B parallel first).
