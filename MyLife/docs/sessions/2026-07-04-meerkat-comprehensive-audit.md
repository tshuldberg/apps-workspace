# 2026-07-04 Meerkat Comprehensive Production-Readiness Audit

## What was done
Deep, comprehensive production-readiness audit of the four Meerkat surfaces (`apps/meerkat`, `apps/meerkat-web`, `packages/meerkat-relay`, `packages/sync`) against a clean `origin/main` worktree at `17c7768f`. Five parallel read-only audit agents (git history, objectives-vs-delivery, adversarial code/security, launch gaps, workflow traces) + lead re-verification of every load-bearing security claim + an independent green run of all four gate suites.

Deliverables: `docs/reports/REPORT-meerkat-comprehensive-audit-2026-07-04.md` + `.html` twin.

## Headline
This audit **overturns the morning 2026-07-04 audit's "zero P0/P1/P2" finding.** Independent re-verification found:
- **S1 P0** stored XSS → E2EE key exfiltration in the web attachment renderer (`InChannelFileCard.tsx:107-109` + `format.ts` MIME-verbatim blob + no CSP). Lead-verified in code.
- **S2/S3 P1** two unauthenticated DoS paths in the self-hosted community node (`readBody` Infinity default on register/publish/append; unbounded `communities` map via `challenge`, no eviction; entitlement gate is pass-through by default). Lead-verified: `requireHostedEntitlement` returns true when `hosted.required` is falsy.
- Several P2 (client-trusted allocation, XFF-spoofable limiter, no CSP) and P3s including the **community-safety un-hide** bug (device-local, confirmed mechanism).

The mesh crypto/protocol substrate was traced and is sound (fail-closed, no apply-before-verify). Prior claims (c) DM flag TRUE, (d) FF3 dispatch wired, (e) `DEFAULT_RELAY_URL=''` all CONFIRMED; only (a) zero-findings REFUTED.

## Objectives verdict
Against the founder mandate ("everything gates one $4.99 launch"), the launch is ~half code-complete. DELIVERED: theme (18), chat kit (30), IA (31), feed (32), member removal (28, UI shipped both surfaces — plan doc STALE), Noise (23-D.6). CODE-COMPLETE/DORMANT: public layer (19, FF3 wired — plan doc STALE), connectivity (20, but `dataTransportFactories` never injected → WebRTC/Nearby/BLE run simulated), DMs (21). NOT BUILT: launch-readiness (23), humanity verification (24), calls (25), open posting (26), auto-connect (29); $4.99 gate itself unwired (22 PARTIAL).

## Gates (lead-verified on origin/main @ 17c7768f)
app 699/699, web 468/468, relay 325/325, sync 1562/1562; 4 typechecks pass; all Meerkat parity checks pass.

## Launch blockers (ranked)
Code: (1) S1 P0 XSS + CSP; (2) S2/S3 P1 node DoS; (3) identity restore unimplemented (lose phone = permanent loss); (4) $4.99 unwired + contradictory pricing copy (one-time vs $4.99/mo); (5) no account/content deletion beyond local wipe.
Founder-ops: (6) deploy relay+nodes + bake relay URL; (7) app icon/splash assets DO NOT EXIST; (8) privacy/ToS/support nonexistent; (9) AV/CSAM scanning; (10) EAS builds + 2-device QA + submission.
Resolved since morning: EAS core config now good (real projectId, bundle IDs, App Group, privacy manifest).

## Broken/stale traces
- W1: mobile Files-index per-row "Request" button is a dead affordance with stale "coming in a later update" copy (protocol shipped). Web lacks the button (parity mismatch).
- W2: mobile cannot create channels at all (web can). Real parity gap.

## Files changed
- `docs/reports/REPORT-meerkat-comprehensive-audit-2026-07-04.md` (new)
- `docs/reports/REPORT-meerkat-comprehensive-audit-2026-07-04.html` (new)
- `errors_log.md` (3 new rows: S1 P0, S2/S3 P1, S7 P3)
- `memory.md` (session row)

## Remaining / next
- Fix S1 (P0) + S2/S3 (P1) with adversarial regression tests before any public web/node exposure.
- Decide monetization (recommend launching free, fix pricing copy).
- Build identity restore + delete-my-data.
- Founder-ops spine per blockers 6-10.
- Scope call: calls/humanity/open-posting/auto-connect are not built — cut explicitly or budget as net-new.
