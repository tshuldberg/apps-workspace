# Report And Visual Artifact Catalog

Updated 2026-09-05. Report HTML is a dated snapshot. Use current code and current Markdown plans for implementation truth.

## Current Decision Artifacts

| Product | Artifact | Status |
|---------|----------|--------|
| Meerkat | [UI/UX refinements and 18-theme gallery, 2026-09-04](REPORT-meerkat-ui-ux-themes-2026-09-04.html) | Browser + iOS simulator evidence, accessible appearance controls, responsive navigation and focused runtime fix. UI review only; signed-build/device launch checks remain. [Markdown](REPORT-meerkat-ui-ux-themes-2026-09-04.md). |
| Meerkat | [Competitive claims and custom pages review, 2026-09-04](REPORT-meerkat-competitive-and-pages-review-2026-09-04.html) | **Current 2026-09-04 adversarial review** of the 09-01/02 launch materials against code and fresh competitor research. Creation layer: 7 of 16 block renderers ship, 15 (not 16) canvas node types, Plaza has no UI, editor is stepper-only. Five competitor sentences fail (Discord "accent colors", "no presentation layer", Briar maintenance mode, SpaceHey 2M+, "no encrypted messenger shipped this" vs Delta Chat webxdc). Production-level pages spec in section 8. [Markdown](REPORT-meerkat-competitive-and-pages-review-2026-09-04.md). |
| Meerkat | [Security and privacy audit, 2026-09-04](REPORT-meerkat-security-audit-2026-09-04.html) | **Security NO-GO.** September 5 remediation: recipient/age/preview/scanner hardening, issuance continuity, account-pinned interrupted-request recovery, durable issuer keys, atomic eligibility, safe account deletion, scanner controls and native simulator private-storage migration. S2 binding/complete-loss recovery and signed-device/provider acceptance remain. [Markdown](REPORT-meerkat-security-audit-2026-09-04.md). |
| Meerkat | [Production readiness, adversarial review and workflow lab](REPORT-meerkat-production-readiness-2026-09-04.html) | **Current assessment, 2026-09-04: NO-GO.** New browser SQLite data-loss and retry defects; 7,330 tests passed, 192 skipped; current Actions disabled. Includes full feature inventory, competitor gaps, required audits, launch strategy and interactive concepts. [Markdown](REPORT-meerkat-production-readiness-2026-09-04.md). |
| Meerkat | [Investor pitch, source-verified](meerkat-investor-pitch-2026-09-01.html) | **Current 2026-09-01 investor narrative** at `493b2549`. Covers product, architecture, honest pre-GA state, official-source competitors, differentiation, `$4.99` one-time private unlock, optional `$4.99/month` hosting, go-to-market, risks, and capital-use categories. Contains no invented traction, market size, or raise terms. Supersedes the 2026-08-01 pitch. |
| Meerkat | [Community page archetypes + the Meerkat editor](../../apps/meerkat/docs/reports/REPORT-meerkat-community-page-archetypes-2026-09-01.html) | **Current 2026-09-01 design samples.** Ten archetypes: six community pages (Creator Studio, Newsroom, Art Wall, Digest, Scene, Commons) plus the creator-platform-replacement set (Membership/Patreon-class, Personal Site, Storefront with sealed digital delivery) and the Meerkat block editor itself (per-block audiences, open-web publish). Mapped to Plans 19/38/56/57; creator prices are sample content; Meerkat takes 0% of creator revenue. |
| Meerkat | [Animated user workflows, all surfaces](../../apps/meerkat/docs/reports/REPORT-meerkat-user-workflows-animated-2026-08-31.html) | **Current 2026-08-31 snapshot** at main `6ed8ce97`. Five animated journeys (app DMs, community posts, public feed, plus the same three in phone and Mac browsers) with transport-honesty callouts; stylized screen recreations, sample people/content. |
| Meerkat | [Investor pitch deck](meerkat-pitchdeck-investor-2026-08-01.html) | **Superseded 2026-08-01 snapshot.** Use the 2026-09-01 source-verified pitch above for current product, pricing, and launch state. |
| Meerkat | [User acquisition pitch page](meerkat-pitchdeck-users-2026-08-01.html) | **2026-08-01 snapshot.** Consumer-facing animated landing deck: privacy story in plain language, 25-person cost math, sealed-envelope explainer, launch-notify CTA (no fake download links). |
| MyLife hub | [Hub state review + launch runbook](REPORT-mylife-hub-state-2026-07-11.html) | **Current**: file-verified state of the hub mobile app (949-screen census, 190 screen recreations, monetization as coded), store-readiness scoreboard, and the two-track step-by-step path to App Store revenue. |
| MyNews | [App state + production runbook](REPORT-mynews-app-state-2026-07-12.html) | **Current** state review: code-exact screen recreations across app/web/console, workflows, plan 48 remediation status, and the 12-step founder runbook to store launch and revenue. |
| MyLife | [Commit and push safety sweep](REPORT-mylife-commit-push-safety-2026-07-12.html) | **Current**: all work committed and pushed; 10 branches on origin, 0 unpushed commits, 1,023 tests verified green during the sweep. Two flagged leftovers (superseded WP-43D draft, orphaned plan19 worktree dir). |
| MyLife | [Integration review](REPORT-mylife-integration-review-2026-07-11.html) | All six production-readiness branches merged to local main (`6e0b17b0`), full gates green; main pushed 2026-07-12. Per-app launch verdicts unchanged. |
| BestChef | [Launch readiness review and complete global plan, 2026-09-05](REPORT-bestchef-launch-readiness-plan-2026-09-05.html) | **Current 2026-09-05 verdict: NO-GO**, substrate confirmed green (429/1,304/73 tests, i18n 100 percent). 13 fresh findings (iOS-only, no bestchef.app, no cross-language reading, moderation coverage, age-rating tiers, UK OSA/DSA, cold start), animated recreations of 10 workflows, 10 workstreams to an all-features 24-language launch on iOS, Android and web, 12-week critical path, launch gates, run cost. [Markdown](REPORT-bestchef-launch-readiness-plan-2026-09-05.md). |
| BestChef | [Production readiness status](REPORT-bestchef-production-readiness-status-2026-07-11.html) | July state (superseded by the 2026-09-05 review above): plan 45 executed and merged, all 12 audit criticals closed in code; remaining blockers are founder-ops F1-F9. |
| BestChef | [Adversarial production audit](REPORT-bestchef-adversarial-production-audit-2026-07-10.html) | Audit that drove plan 45: NO-GO (GA 4/10, 21-language 3/10), 12 critical, 18 high. Code findings remediated 2026-07-11; see status report above. |
| Yearn | [App state review + production path](REPORT-yearn-app-state-2026-07-11.html) | **Current** state: screen recreations, workflows, backend surface, and the full step-by-step App Store + revenue checklist. Reflects plan 47 phases 1-4 and plan 50 boost integrity (branch `feature/yearn-boost-integrity`). |
| Yearn | [Adversarial production audit](REPORT-yearn-adversarial-production-audit-2026-07-11.html) | Audit that set the NO-GO verdict and drove plans 47/50. Phase 1 code fixes and the boost revenue leak are remediated in repo; remaining blockers are founder-ops (see state review above). |
| BestChef | [Production launch gate](REPORT-bestchef-production-launch-gate-2026-07-09.html) | July 9 launch gate (code plus live EAS, Supabase, DNS, and store evidence); superseded by the 2026-07-10 adversarial audit and the 2026-07-11 status above. |
| BestChef | [World-launch audit](REPORT-bestchef-world-launch-audit-2026-07-05.html) | Prior audit; superseded by the 2026-07-10 adversarial audit (findings re-verified, still open). |
| Workouts (all surfaces) | [Workout apps adversarial review](REPORT-workout-apps-adversarial-review-2026-08-12.html) | **Current 2026-08-12 verdict:** DoWork is the canonical workout app (87/100); hub mobile 62, hub web ~45; lineage, lost-in-consolidation features, MacroFactor Workouts competitive picture. Drives plan 55. |
| DoWork | [App state review + screen recreations](REPORT-dowork-app-state-2026-07-12.html) | **Current**: all 52 screens recreated at main `b317711a`, per-screen exact-state notes, and the step-by-step founder runbook (R0 + F2-F8 + submit) to App Store revenue. |
| DoWork | [Product walkthrough](REPORT-dowork-user-story-2026-07-05.html) | Prior product walkthrough, not a store-submission signoff. |
| MyLife portfolio | [Portfolio readiness](REPORT-mylife-portfolio-readiness-2026-07-05.html) | Portfolio snapshot. Its Meerkat section is superseded by the September 4, 2026 production review. |

## Superseded Meerkat readiness reports

[Archive manifest](../archives/meerkat-readiness-2026-09-04/README.html): 30 original files across 17 assessment families. Their launch verdicts are superseded by the September 4 review. Release ledgers and specialist source material remain evidence, not competing current decisions.

## Retained Research And Historical Snapshots

| Artifact | Status |
|----------|--------|
| [Jubilee Surrounded left-right argument atlas](../../apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.html) | Transcript-grounded 2025-09-02 through 2026-09-02 corpus: 39 uploads, 661,484 caption words, 54h 13m, 23 themes, 132 paired argument families, timestamped source ledger, and phase-two verification queue. Claims are inventoried but not fact-checked. [Canonical Markdown](../../apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.md). |
| [Fiscal comparison: immigration, health care, bailouts, and income above $5M](RESEARCH-fiscal-comparison-immigration-health-bailouts-wealth-2026-08-30.html) | Graduate-level fiscal review with primary-source graphs, period totals, international comparisons, and explicit separation of spending, credit exposure, net cost, and tax expenditures. [Canonical Markdown](RESEARCH-fiscal-comparison-immigration-health-bailouts-wealth-2026-08-30.md). |
| [Political corruption since 1960](RESEARCH-political-corruption-since-1960-2026-08-17.html) | Graduate-level U.S. political-corruption synthesis, evidence-graded through 2026-08-17. Covers congressional trading, presidential business and crypto conflicts, crisis wealth transfer, tariffs and refunds, congressional accountability, historical cases, and reforms. |
| [Meerkat competitor ads](REPORT-meerkat-competitor-ads-2026-07-07.html) | Competitor-language research snapshot. |
| [Meerkat surveillance threat model](REPORT-meerkat-surveillance-threat-model-2026-07-01.html) | Thematic threat-model snapshot, not a launch verdict. |
| [MyLife sprint audit](REPORT-mylife-sprint-audit-2026-07-05.html) | Historical sprint audit. |
| [MyLife sprint explained simply](REPORT-mylife-sprint-explained-simply-2026-07-05.html) | Historical plain-language sprint explanation. |
| [MyLife sprint transcript](TRANSCRIPT-mylife-sprint-for-kids-2026-07-05.html) | Historical companion transcript. |
| [MyNews platform research](mynews-news-platform-research-2026-06-29.html) | Product-research baseline, not current implementation status. |

## Placement Rules

- New report filenames include `YYYY-MM-DD`.
- A Markdown report, review, audit, or evaluation gets a same-basename self-contained HTML twin.
- Prompts, build plans, and manual checklists belong under `docs/plans/`, `docs/guides/`, or `docs/handoffs/`, not this directory.
- When a later report supersedes an older launch/readiness verdict, remove the older generated artifact and update this catalog. Git history remains available for forensic review.

## September 4 remediation

[Current production assessment](REPORT-meerkat-production-readiness-2026-09-04.html) and [security assessment](REPORT-meerkat-security-audit-2026-09-04.html), with dated remediation evidence. Storage, delivery and mobile/web account fixes are locally verified; release remains NO-GO pending the recorded protocol and external acceptance.
