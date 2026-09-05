# 2026-07-01: Meerkat production-review doc v2.0

## What was done

Rebuilt `docs/reports/meerkat-production-review.html` from v1.2 to **v2.0**: a full re-review of every Meerkat workflow against `feature/meerkat-launch-finish`, in preparation for the $4.99 one-time production offering. The document is the design-evaluation artifact for deciding removal/addition/tweaks of workflows before production.

## How it was built

Four parallel Explore agents produced the ground truth, then the doc was authored from their reports plus the v1.2 baseline:

1. **Mobile inventory**: full 6-tab navigation map (Feed, Communities, Discover, Messages, Friends, Me), onboarding gate, every workflow with exact copy strings, theme tokens + 6 presets, honesty boundaries.
2. **Web + self-hosting**: meerkat-web screen map, web onboarding, 5-state Connection card copy, storage adapters, hosted gates, publish/archive UI, and the full desktop Host companion (wizard, dashboard, MKSERVER1 card, reachability re-verify) + relay/nodes/deploy artifacts.
3. **Docs distillation**: all 11 queue plans (19-29) with Status Deltas, orchestration master build order, founder-ops runbook, launch-scoping session (vision + 3 new founder decisions), launch-finish session (6 waves), UI benchmark eval (~4/10), and the v1.2 doc structure (corrected: v1.2, 104 matrix rows).
4. **Git timeline**: 229 meerkat commits, 39 on-branch-not-main, uncommitted state, test-count history.

## v2.0 content changes vs v1.2

- 5 new workflow recreations: Discover & public reading, Publish & public archive (consent/rights/license), Share into Meerkat (OS share + Share Inbox), Connectivity & self-hosting (5-state Connection card + desktop Host companion), Themes & appearance.
- IA updated to 6 mobile tabs; web rail includes Discover; overlays include Publish + Share Inbox.
- 2 new personas: Public Reader, Creator/Publisher (7 total).
- Function matrix re-scored: 126 rows (86 real / 27 placeholder / 9 partial / 4 blocker), new Desktop surface filter, new areas (Public, Share, Hosting, Readiness, Committed).
- Blockers table replaced (12 items): connectivity, stale transport copy, and Noise FS are code-resolved pending ops (D.6 closed the static-fallback caveat); pricing decided but unbuilt (Plan 22); everything-gates-launch adds plans 21/24/25/26/27/28/29 to the gate; UX benchmark gap flagged as un-owned (Plan 30 proposal).
- New sections: Plans & build order (11 plans + orchestration tracks + runbook summary), UI benchmark (per-surface scores + Tier 1 fixes), Decisions (9 locked + 4 open).
- Test counts refreshed: 2,204 local-green (sync 1403 / relay 321 / mobile 304 / web 176); CI down (GitHub billing), local green is the trust gate.
- Em dashes removed entirely (workspace writing rule); v1.x used them.

## Verification

- Node structural validation: script block compiles; 126 ROWS all 6-field; statuses/surfaces/tiers within enum; all TOC anchors resolve; required element ids present; section/table/div/script tags balanced.
- Browser verification DONE via Playwright headless Chromium (chrome-devtools MCP profile was locked by another session): zero page/console errors, matrix renders 126/126 with working filters (blocker -> 4 rows, Desktop -> 4 rows), theme toggle light/dark works, screenshots of hero/onboarding/discover/hosting/matrix/blockers all correct.
- No function logic changed; `gate:function` not applicable (docs-only).

## Files changed

- `docs/reports/meerkat-production-review.html` (v1.2 -> v2.0, 1454 lines)
- `docs/sessions/2026-07-01-meerkat-production-review-v2.md` (this log)
- `memory.md` (session row)

## Remaining / follow-ups

- Founder review pass over v2.0: the 4 open decisions (Plan 30 authorization, Plan 22 storage SKU, Plan 24 private-relay gating, Plan 25 SFU choice) and any workflow add/remove/tweak markups.
- memory.md is over the 80-line context budget; Sessions table needs an archival sweep to `docs/archives/`.
