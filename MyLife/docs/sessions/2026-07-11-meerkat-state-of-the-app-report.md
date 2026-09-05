# 2026-07-11 - Meerkat state-of-the-app report with screen recreations and launch runbook

## Task

Founder request: ensure a current, browser-open HTML doc reviewing the exact state of the
app with HTML recreations of all screens and user workflows, plus step-by-step instructions
for the remaining production readiness tasks to reach the App Store and revenue. Target app
confirmed via AskUserQuestion: Meerkat.

## Deliverables

- `docs/reports/REPORT-meerkat-state-of-the-app-2026-07-11.html` (241 KB, self-contained,
  opened in browser) and markdown twin `.md` beside it.
- Contents: NO-GO verdict banner; exact current state by area with audit findings table;
  46 mobile phone-frame recreations (17 core + 29 extended); 15 web browser frames; 10
  end-to-end workflow strips; Phase 0-9 production runbook with [CODE]/[FOUNDER-OPS]/
  [EVIDENCE] tags.
- `docs/reports/README.md` updated with the new current artifact row.

## How it was built

Fable-orchestrated fan-out: four research agents (mobile screen inventory ~55 routes, web
screen inventory ~90 files, current-state synthesis, launch runbook) then four builders
(mobile core frames, mobile extended + workflows, web frames, doc conversion), all working
from written specs with exact copy quoted from source. Orchestrator verified load-bearing
claims directly: billing SKUs at `packages/billing-config/src/index.ts:144,158`, RevenueCat
10.2.2 at `apps/meerkat/package.json:58`, `ITSAppUsesNonExemptEncryption: false` at
`app.json:22` (flagged for counsel), push-gateway O(n) at `push-gateway.ts:602`, visible tab
set in `(tabs)/_layout.tsx` (Feed/Communities/Public/Messages/Me; corrected a stale CLAUDE.md
comment claiming Discover is a tab), plan43 branch 12 commits ahead (corrected agent's 10),
moderation review-queue copy verbatim.

## Key facts captured

- Verdict: NO-GO per Blackglass 2026-07-09 (63/100 release readiness); all 7 original
  criticals closed; blockers now infra/device/vendor/legal/ops plus unstarted Plans 41 + 25.
- Monetization wired for real (RevenueCat mobile, signed grants web, Stripe on relay); no
  live transaction yet. Pricing founder-locked: $4.99 one-time, $4.99/mo hosted.
- Runbook estimate: 6-12 weeks to GO, dominated by the Plans 41/25 build-vs-cut decision
  (Phase 0.4) and safety-vendor lead times (Phase 5).

## Remaining items

None for this deliverable. Follow-on work lives in the runbook's Phase 0 and the plan 49
dispatch board.
