# 2026-07-01: Meerkat Surveillance Threat-Model Review (analysis only)

## What was done

Founder asked whether Meerkat can actually remove the corporate data-harvesting
function (identity graph, social graph, content inspection, engagement telemetry,
feed control) from users who move their social/communication life onto it, citing
Myanmar, Cambridge Analytica, and Palantir. Produced an HTML review answering the
question and ranking improvements. No code changed.

## Deliverable

`docs/reports/REPORT-meerkat-surveillance-threat-model-2026-07-01.html`
(Open Burrow light palette, opened in browser). Sections: verdict, surveillance
web decomposition, 11-row function scorecard, structural removals, honest residual
threat model, Myanmar/CA/Palantir architecture comparison, live-today status table,
5-tier improvement ranking, bottom line.

## Method

Explore subagent swept apps/meerkat, packages/sync, packages/meerkat-relay,
docs/plans 19-29, mesh-sync-architecture.md, and the founder-ops runbook to build
a live/gated/planned/not-built capability map plus metadata-exposure and moderation
posture. Report grounded in that sweep plus memory.md and product-direction memories.

## Key conclusions

- Verdict: yes, structurally, for in-app activity. No identity anchor, no
  server-side graph, no plaintext, no engagement telemetry, no manipulable feed,
  no ad system; business model never needs the data.
- Three qualifiers: only protects what moves into it (MyLife suite covers the
  rest of the founder's list); network metadata remains (IP/sizes/timing, push
  carriers; onion routing an explicit non-goal); the spine is undeployed
  (DEFAULT_RELAY_URL '').
- Myanmar-style amplification and CA-style harvesting are structurally blocked
  (no ranking dial, no graph API, no ad delivery). Palantir-style fusion is
  starved for in-app data, not blocked (compelled relay could log IP/timing).
- Honest counterweight: E2E removes platform moderation too (WhatsApp-India
  failure mode); defensible answer needs Plan 28 removal/rotation and the
  deployed abuse scanner shipped.
- Improvement ranking: Tier 0 deploy spine + EAS build + 2-device QA + CI;
  Tier 1 DM UI (Plan 21), auto-connect (29), member removal (28), seal
  rendezvous bundle (D.5), FF3 owner side; Tier 2 padding/cover traffic,
  multi-relay diversity, proxy/Tor option, push-privacy polling mode, MLS path;
  Tier 3 UI benchmark roadmap (Plan 30), Plans 26+24 together, calls (25),
  Workplace import wedge, proximity (27), publish the protocol; Tier 4 abuse
  scanner ops, cost-model economics, external audit + reproducible builds,
  public moderation-capabilities doc, legal bundle.

## Files changed

- New: `docs/reports/REPORT-meerkat-surveillance-threat-model-2026-07-01.html`
- New: this session log
- Edited: `memory.md` (Sessions row)

## Remaining items

None for this task. Improvement tiers feed existing plans 19-29 plus the
suggested Plan 30 (UI benchmark roadmap).
