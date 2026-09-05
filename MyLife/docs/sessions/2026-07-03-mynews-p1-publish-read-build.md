# 2026-07-03: MyNews Phase 1 BUILT (plan 35 authored + executed, same session as P0)

## Summary

Continuation of the same worktree session that built Phase 0. Plan 35 (publish + read) authored and fully executed: the publishing spine (client Ed25519 signing over deterministic canonical bytes, verify-then-insert edge functions, atomic RPCs) and the reading loop on both surfaces (Expo reader/composer, SSR web reader with RSS/sitemap). Branch `feature/mynews-p0-scaffold` now carries 14 commits (`ab3a1be0..4edc7bcf`), NOT pushed. Plans 34 and 35 both in `docs/plans/done/` with Status Deltas.

## What landed (Phase 1)

- **Signing contract:** domain-separated canonical JSON-array bytes for revisions and suggestions; sign/verify via @mylife/sync (tweetnacl); committed golden-vector fixture; 10 tests incl. cross-domain transplant rejection.
- **Data layer:** drafts CRUD over the shared DatabaseAdapter; `MyNewsCloudPort` with a deterministic in-memory adapter and ONE production fetch adapter (`createMyNewsCloudAdapter`: public-anon PostgREST reads + function POSTs with injectable token provider; supabase-js needed nowhere); client publish/suggest orchestrators with typed honest error mapping; unicode slugify.
- **Edge functions:** `mynews-publish` / `mynews-suggest` / `mynews-review` as dependency-injected handlers (BestChef pattern), unit-tested without a live project (22 tests): WebCrypto Ed25519 verifies the module's tweetnacl fixture signatures; canonical-bytes twin parity-tested byte-for-byte; credibility constants twin parity-tested against the engine; author-only acceptance enforced (accept requires a NEW author-signed revision; the server never composes text); citation floor + open-cap throttle server-side; atomic writes via SECURITY DEFINER RPCs (migration 20260703000002, service-role EXECUTE only).
- **Expo surfaces (agent-built, 37 app tests):** DatabaseProvider (expo-sqlite + module migrations), CloudProvider (env-gated, EXPO_PUBLIC_MYNEWS_*), IdentityProvider (SecureStore-persisted device key, C4 custody); Today feed (follows-driven, honest not-configured/no-follows/error/empty states), article reader with public revision history + credit lines, journalist profile with device-local follow/unfollow, drafts desk, composer with debounced autosave and a publish flow that never fakes success.
- **Web surfaces (agent-built, 24 tests + prod build):** SSR `/a/[slug]` with generateMetadata/OG + revision history, `/j/[handle]`, RSS 2.0 `/feed.xml`, `/sitemap.xml`, Latest list on home; runtime-verified honesty (unconfigured/unreachable = 404 or valid-empty, never 500, never placeholder).
- **Architecture fix found by the web build:** the module barrel transitively pulls @mylife/sync's React hooks into the Next RSC graph. Fixed properly with an RSC-safe `@mylife/mynews/cloud-fetch` subpath export (zero runtime imports, re-exported view types); the agent's interim webpack alias removed; no @mylife/sync changes (zero Meerkat blast radius).
- **Parity gate extended** with the P1 artifacts including the subpath-usage needle.

## Verification at close

Module 92 tests; Expo app typecheck 0 + 37; web typecheck 0 + 24 + `next build` 0; `check:mynews-parity`, full `check:parity`, `gate:function:changed`, `check:generated-artifacts` all exit 0.

## Orchestration notes

Two `hub-shell-dev` background agents built the surfaces in parallel with strict file-ownership (apps/mynews vs apps/mynews-web) and no-install/no-commit rules; the lead pre-provisioned dependencies so agents never touched the lockfile. Both reported green and clean; their gates were re-verified independently before commit.

## Remaining

- Founder-ops to go live: Supabase project, `db push` (2 migrations), deploy 3 functions, then live e2e; plus plan 34's list (EAS/ASC, Stripe Connect application, RevenueCat, domain/trademark, seed journalists).
- Gated Task 14 (plan 34): ChannelPostType widening after the Meerkat branch merges.
- Next code phase: Phase 2 editing desk UI (suggest mode, review queue, diff UI) per plan 36 when authored.
