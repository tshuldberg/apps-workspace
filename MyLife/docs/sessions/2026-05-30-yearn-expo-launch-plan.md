# 2026-05-30 - Yearn Expo Rewrite Production Launch Plan

## Summary

Reviewed the Yearn dating app (native SwiftUI iOS + Supabase at `/Users/trey/Superapp-Projects/need-works`), locked the production direction with the owner via four decisions, ran a 7-agent research/synthesis workflow, and authored `/Users/trey/Superapp-Projects/YearnProdLaunch.html` — a comprehensive evaluation plus an 11-sprint, 70-task launch plan to take Yearn to a public TestFlight beta.

## Locked Decisions (owner, via AskUserQuestion)

1. **Port to Expo/React Native + TypeScript** to mirror BestChef's stack. Native SwiftUI app becomes the product SPEC; build target is a new Expo app at `MyLife/apps/yearn`. Supabase backend carries over.
2. **First QA release = public TestFlight beta** (not invite-only). Full moderation, rate limiting, verification hardened up front.
3. **Full safety + E2EE at launch** — the whole ~62-feature vision incl. Signal-Protocol E2EE, LiveKit calls, full safety suite, verification, moderation + NCMEC.
4. **Monetization = reach-gated $4.99/yr + $1/7-day Boost via RevenueCat in StoreKit sandbox** (real flow, no real charges in QA).

## Verified Current State (read from source, not prior review headline)

- Native SwiftUI iOS app (iOS 17+, iPhone-only), XcodeGen, supabase-swift, StoreKit 2, fastlane, GitHub Actions. Branch `feat/production-readiness` (pushed, clean).
- 13 Supabase migrations (0001-0013) + 2 edge functions (yearn-push APNs, yearn-appstore-notifications) committed and production-grade. This backend (schema + RPC surface + RLS + edge functions) is the reusable asset that carries to the Expo rewrite.
- Social-loop READS wired to real RPCs (discover_profiles, incoming_likes, like_back, my_matches, archive_match) plus delete_my_account, register_device_token, activate_boost, current_membership.
- Precise gap: `SupabaseRepository.sendLike/sendPass` still delegate to the local fallback (swipe-loop writes partial). Messaging is plaintext, not yet E2EE. discover_profiles has no geo/distance filter.
- Readiness scored 28/100 against the chosen full-vision public-beta goal (backend 8.2, product def 8.8 strong; client/E2EE/moderation early due to scope).

## Plan Shape (YearnProdLaunch.html)

- Workstreams: SCAFFOLD, DATA, AUTH, LOOP, MSG, CALL, SAFETY, MOD, GEO, MON, PUSH, COMPLY, OPS, QA.
- Sprints S0-S10 (~2-3 wk each, ~24-30 wk total, ~5-person team): S0 Expo foundation + data-layer port; S1 auth/onboarding/18+; S2 core loop real (close sendLike/sendPass); S3 geo + filters; S4 E2EE messaging (spike-heavy); S5 LiveKit calls + media; S6 verification + NSFW + block/report; S7 moderation operation + NCMEC + abuse defense + safety toolkit; S8 RevenueCat sandbox + push; S9 compliance/legal/store; S10 hardening/QA/launch ops.
- 9 P0 blockers, readiness scorecard (11 dimensions), competitor matrix (9 apps), compliance table (App Store 1.2/5.1.1, age, App Privacy, GDPR/CCPA, EU DSA, NCMEC, IAP), risks, pre-submission checklist, docs-to-create, GTM.

## Files Changed / Created

- Created `/Users/trey/Superapp-Projects/YearnProdLaunch.html` (self-contained, coral/vellum theme matching the existing readiness doc).
- Created this session log.
- Updated `memory.md` Sessions row.

## Method

7-agent background workflow `wfa60169w` (code+backend audit, BestChef blueprint, competitor research, 2026 App Store/compliance, RN/Expo feasibility, then 2 synthesis agents). 845k subagent tokens, ~21 min. Output cached at the task output path. Author synthesized the final HTML from the workflow data + verified code audit + memory.md BestChef taxonomy.

## Decisions / Notes

- "Standalone repo under MyLife similar to BestChef" resolved as: same launch DISCIPLINE + server-backed Supabase architecture, with a full stack PORT to Expo (owner's choice), landing at `apps/yearn`.
- The full Expo rewrite + full safety/E2EE + public beta is the most ambitious option on every axis; timeline reflects that honestly (~6-7 months) rather than the native prototype's narrower readiness.

## Remaining / Next

- Owner to review YearnProdLaunch.html.
- If approved, S0 is the natural start: scaffold `apps/yearn` mirroring `apps/bestchef`, port the data layer over the existing RPCs, and start the MSG-E2EE-01 spike in parallel (long pole).
