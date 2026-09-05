# MyLife Documentation Map

Updated 2026-09-04. This is the entry point for current documentation and generated visual artifacts.

## Source Of Truth Order

1. Current code and tests.
2. `packages/module-registry/src/constants.ts`, `apps/mobile/app/_layout.tsx`, and `apps/web/components/Providers.tsx` for module IDs and host wiring.
3. Markdown plans under `docs/plans/active/`, `docs/plans/queue/`, `docs/plans/done/`, and `docs/plans/features/`.
4. Operational guides under `docs/guides/` and architecture decisions under `docs/designs/`.
5. Dated reports and session logs as point-in-time evidence.

HTML reports do not outrank newer code. When a report and the current tree disagree, the current tree wins and the report must be treated as a snapshot.

## Directory Map

- `docs/plans/`: canonical Markdown execution plans, organized by active, queue, done, archive, consolidation, and feature scope.
- `docs/reports/`: human-readable visual outputs and their catalog. See [`reports/README.md`](reports/README.md).
- `docs/guides/`: operational and tester instructions intended for reuse.
- `docs/designs/`: architecture and product decisions.
- `docs/sessions/`: dated work logs. Review-style logs created after the HTML-twin rule must have a same-basename HTML file.
- `docs/archives/`: intentionally retained historical material, never current implementation truth.
- `docs/business-plan/`: March 2026 snapshot material subject to the verification rule in `AGENTS.md` and `CLAUDE.md`.
- `docs/investor-deck/`: April 2026 investor-package snapshots. Verify product counts, pricing, traction, and business claims before external use.

## HTML Artifact Rules

- Plans are maintained in Markdown. A plan HTML file is allowed only as a same-basename rendered view of a current Markdown source, or when it is a deliberately interactive primary document such as the investor manifesto.
- Report HTML filenames carry an absolute date and are cataloged in `docs/reports/README.md`.
- Runtime HTML, legal pages, test fixtures, and host UI files stay beside the consuming code and are not report artifacts.
- Completed or superseded mission controls are deleted rather than copied into another archive. Git history retains the original file.
- A current report must say what commit or date it verified. Later code changes turn it into a historical snapshot until it is reviewed again.

## Current Counts

- Registry module IDs: 41
- Full mobile module registrations: 38
- Full web module registrations: 30

These counts were verified from the source files listed above on 2026-07-09.

## Current Launch Decisions

- **BestChef:** [Launch readiness review and complete global plan, 2026-09-05](reports/REPORT-bestchef-launch-readiness-plan-2026-09-05.html), **NO-GO**. Code substrate green; iOS-only scope, no web presence, cross-language reading, moderation coverage, vendors, legal entity and content cold start remain. Supersedes the [2026-07-09 gate](reports/REPORT-bestchef-production-launch-gate-2026-07-09.html).
- **Meerkat:** [Production readiness, 2026-09-04](reports/REPORT-meerkat-production-readiness-2026-09-04.html), **NO-GO**. Browser database durability defects, daily-use workflows and current release evidence remain blocking. [Superseded assessments](archives/meerkat-readiness-2026-09-04/README.html).

## Recent Implementation Evidence

- **Meerkat security audit, 2026-09-04:** [HTML report](reports/REPORT-meerkat-security-audit-2026-09-04.html), [Markdown](reports/REPORT-meerkat-security-audit-2026-09-04.md). September 5 remediation includes account-pinned interrupted-request recovery, durable issuer keys, atomic eligibility, safe account deletion, scanner controls and native simulator private-storage migration; pass binding/complete-loss recovery and device/provider acceptance remain open.

- **Meerkat adversarial production review, 2026-09-04:** [HTML and interactive concepts](reports/REPORT-meerkat-production-readiness-2026-09-04.html), [Markdown](reports/REPORT-meerkat-production-readiness-2026-09-04.md). Current production decision at `7a40639d`; fresh checks, reproducible defects, audits, competitor analysis and launch approach.

- **Jubilee Surrounded argument atlas, 2026-09-02:** [interactive HTML](../apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.html) and [canonical Markdown](../apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-left-right-argument-atlas-2026-09-02.md). Screens all 39 in-window uploads and organizes 132 argument and counterargument families across 23 themes. This is a transcript-grounded inventory, not a factual verdict.
- **Meerkat comprehensive code, performance, security, and instruction audit, 2026-09-02:** [self-contained HTML report](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-comprehensive-code-performance-instruction-audit-2026-09-02.html) and [canonical Markdown](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-comprehensive-code-performance-instruction-audit-2026-09-02.md). Includes the remediation pass: feed evaluation fell from 1,286 to 7 queries and improved 2.88x at 320 signed posts; 11 original advisory records and the duplicate Expo lane were removed; mobile/web lint, non-secret random IDs, and conflicting agent rules were fixed.
- **Meerkat complete user guide, 2026-09-01:** [source-faithful visual HTML guide](guides/meerkat-complete-user-guide-2026-09-01.html) and [canonical Markdown](guides/meerkat-complete-user-guide-2026-09-01.md). Covers first launch, all five tabs, communities, channels, DMs, sync, sharing, Library, storage, settings, public-service states, and troubleshooting at `493b2549`.
- **Meerkat launch marketing guide, 2026-09-01:** [visual launch field guide](guides/meerkat-launch-marketing-guide-2026-09-01.html) and [canonical Markdown](guides/meerkat-launch-marketing-guide-2026-09-01.md). Defines positioning, beachhead, claim boundaries, assets, 30-day sequence, zero-analytics measurement, owners, and the general-availability gate.
- **Meerkat investor pitch, 2026-09-01:** [interactive HTML deck](reports/meerkat-investor-pitch-2026-09-01.html) and [canonical Markdown](reports/meerkat-investor-pitch-2026-09-01.md). Current product, architecture, competitor set, differentiation, founder-locked `$4.99` one-time plus `$4.99/month` pricing, launch motion, risks, and missing fundraising inputs.
- **Fiscal comparison, 2026-08-30:** [visual research report](reports/RESEARCH-fiscal-comparison-immigration-health-bailouts-wealth-2026-08-30.html) and [canonical Markdown](reports/RESEARCH-fiscal-comparison-immigration-health-bailouts-wealth-2026-08-30.md). Compares immigration, health spending, corporate and bank rescues, corporate tax preferences, and returns with income above $5 million without adding incompatible fiscal measures.
- **Political corruption since 1960, 2026-08-17:** [graduate-level browser edition](reports/RESEARCH-political-corruption-since-1960-2026-08-17.html), [canonical Markdown](reports/RESEARCH-political-corruption-since-1960-2026-08-17.md), and [Word edition](reports/RESEARCH-political-corruption-since-1960-2026-08-17.docx). This is an evidence-graded research synthesis, not MyLife implementation truth.
- **Meerkat launch execution guide, 2026-07-21:** [click-by-click founder instructions for all 18 activation steps](guides/meerkat-launch-execution-guide-2026-07-21.html) and [canonical Markdown](guides/meerkat-launch-execution-guide-2026-07-21.md). Companion to the activation runbook; linked per step from the [launch dashboard](releases/meerkat/launch-dashboard.html).
- **Meerkat Plan 41 audit and remediation re-audit, 2026-07-15:** [human-readable report](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-plan41-completion-audit-2026-07-15.html) and [canonical Markdown](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-plan41-completion-audit-2026-07-15.md). All seven code findings are resolved on integrated commit `6b70b994`; production launch remains NO-GO pending founder-operated evidence.
- **Meerkat full production readiness, 2026-07-15:** [current human-readable audit](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-full-production-readiness-2026-07-15.html), [canonical Markdown](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-full-production-readiness-2026-07-15.md), and [ordered production activation instructions](guides/meerkat-production-activation-runbook-2026-07-15.html). Every codable blocker from the prior snapshot is resolved on `25c38e51`; live release evidence remains mandatory.
- **Meerkat Plan 41 WP-41I, 2026-07-14:** [adversarial proof pack](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-plan41-proof-pack-2026-07-14.html) and [canonical Markdown](archives/meerkat-readiness-2026-09-04/REPORT-meerkat-plan41-proof-pack-2026-07-14.md). Automated proof only; founder-ops launch evidence remains open.
- **Meerkat Plan 41 WP-41H, 2026-07-14:** [storage lifecycle report](sessions/2026-07-14-meerkat-plan41-wp41h.html) and [canonical Markdown](sessions/2026-07-14-meerkat-plan41-wp41h.md).

- [Meerkat UI/UX refinements and 18 themes](reports/REPORT-meerkat-ui-ux-themes-2026-09-04.md) · [Interactive HTML](reports/REPORT-meerkat-ui-ux-themes-2026-09-04.html) (2026-09-04).

- **Meerkat renewal binding, proposed 2026-09-05:** [review proposal](designs/meerkat-renewal-binding-proposal-2026-09-05.md). Unreviewed; no production implementation or security acceptance claimed.
