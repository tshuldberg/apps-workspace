# Yearn Plan 47 Ground Truth, 2026-07-30

Purpose: resolve the memory.md conflict about plan 47 ("phases 2-5 merged" vs "phases 2-5 are next") by diffing every phase's acceptance criteria against source and git history on `main` (`2f5f6e81`). Baseline verified before any new work: `pnpm --filter @mylife/yearn-app test` 204/204 green.

## Resolution of the conflict

Both memory rows were partially wrong. What actually merged to main (integration sweep 2026-07-17) is:

- Merge `14df25e6` (`feature/yearn-production-readiness`): Phase 1 complete, plus partials of Phases 2, 3, 4, plus U2/U10.
- The boost-integrity chain (`290f43d3..d86e223c`): plan 47's winning model. Migration `20260712000001`, `yearn-boost-activate` edge function with full StoreKit JWS chain verification and `appAccountToken` check (lenient: enforced only when the client sends it).
- Photo scope (`5cd45ca2`, migration `20260712000002`): reads scoped to live deck/matches, `match_archivals` revokes on unmatch, 900s TTL for other users. Phase 2 item 4 DONE.
- Rate limits (`b96eacad`, migration `20260712000003`): per-(sender,recipient) caps + rolling-window indexes. Phase 2 item 5 DONE.
- Merge `c7b5b856` ("phases 2-5") contained exactly ONE commit (`8879c795`): the 1,249-line `20260712000004_yearn_moderation.sql`. This is Phase 3 server-side work, not phases 2-5.

So: "phases 2-5 merged" overstated (only Phase 2 code-complete + Phase 3 server-side landed); "phases 2-5 are next" overstated the remainder (schema consolidation and the moderation migration are done). Corrected in memory.md this session.

## Status table (verified against source)

| Phase / item | Status | Evidence |
|---|---|---|
| 1. All 12 P0 items | DONE | `020f8654..14df25e6`; suite green |
| 2.1 Schema reproducible (19 migrations) | DONE | `supabase/migrations/20260525*`, `20260531*` |
| 2.2 `yearn` in config.toml exposed schemas | DONE | `supabase/config.toml` |
| 2.3 Boost receipt validation | DONE in repo | `20260712000001`, `supabase/functions/yearn-boost-activate/` (JWS chain verify, fail closed) |
| 2.4 Photo reads scoped + unmatch revoke | DONE | `20260712000002` |
| 2.5 Per-pair rate limits + indexes | DONE | `20260712000003` |
| 2.6 Live hosted verification checklist | FOUNDER-OPS | never faked; ledger below |
| 3.1 Legal docs in-app | DONE (hosting = founder-ops) | `apps/yearn/legal/`, `2863d25b` |
| 3.2 Moderation action path | PARTIAL | `20260712000004`: lifecycle CHECK, `moderation_status`, immutable `moderation_actions`, service-role `moderate_report`/`apply_moderation_action`. Missing: any operational surface (edge-function workflow or admin tool) to run the queue; only raw service-role SQL exists |
| 3.3 Minor-safety escalation | PARTIAL | Underage report auto-hides profile + creates `safety_escalations` row (`pending_registration`). Missing: mandated-reporting process runbook; transmission tooling; NCMEC registration is founder-ops |
| 3.4 ASC rating/labels/demo account | FOUNDER-OPS | |
| 3.5 `is_verified` cannot render true | DONE | `YEARN_VERIFICATION_PIPELINE_LIVE = false` hard gate |
| 4 Push notifications | NOT STARTED (client+sender) | No expo-notifications dep, no token registration, no outbox, no sender fn; `yearn.device_tokens` + `register_device_token` dormant since `20260525000005` |
| 4 Realtime | PARTIAL | Open conversation `messages_ciphertext` INSERTs only; match list and incoming likes still manual refresh |
| 4 Geolocation + distance ranking | NOT STARTED | Zero location columns or PostGIS in any yearn migration; `expo-location` dep present but unimported; app.json/privacy manifest already declare coarse location (store honesty defect until built) |
| 4 Filters | NOT STARTED | `discover_profiles(p_limit int)` only (redefined in `20260712000004:226` with same signature) |
| 5 Monetization | PARTIAL | Server substrate + edge fn + `yearnRepository.activateBoost(signedTransaction)` exist, but `activateBoost` has ZERO UI callers, no IAP client dep (`react-native-purchases`/`expo-iap` absent), no paywall, nothing populates entitlements; server `appAccountToken` check skipped when absent |
| 5 Verification pipeline | NOT STARTED | Honestly gated off; no selfie/liveness code |
| 5 NSFW screening (optional) | NOT STARTED | Vendor decision is founder-ops |

## Remaining codeable scope (this session's work, plan order)

1. Phase 3 completion: `yearn-moderation` operational edge function (queue list, action application, escalation transmission marking), distinct-reporter threshold auto-hide, mandated-reporting runbook, client report-flow verification.
2. Phase 4: push end to end; realtime for matches + incoming likes; geolocation capture + PostGIS distance ranking; seek-preference filters.
3. Phase 5: StoreKit 2 IAP client + paywall + boost purchase flow sending the signed transaction JWS with `appAccountToken` bound (then tighten the server to require it); membership validation + App Store Server Notifications webhook; selfie verification pipeline with human review queue and fail-closed liveness vendor slot.

## Founder-ops ledger (unchanged, still open, never faked)

1. Host `apps/yearn/legal/` at yearn.app.
2. Hosted DB: apply the 20260712* migrations (incl. hardened `20260712000001`), enable Realtime, run the live RLS/age/deletion checklist.
3. Deploy `yearn-boost-activate` (+ any functions added this session) with Apple IAP secrets.
4. App Store Connect: 18+ rating, Privacy URL, demo account, EULA, EAS projectId, APNs key, IAP products, ASSN V2 URL.
5. Vendors: liveness + NSFW providers; NCMEC ESP registration + designated reporter.
