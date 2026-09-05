# Yearn — Adversarial Production-Readiness Audit

**Date:** 2026-07-11
**App:** `apps/yearn` (Expo/React Native dating app)
**Method:** 6 parallel read-only audit agents (non-Fable models: Opus on crypto/backend/bugs, Sonnet on compliance/features/release), synthesized and independently re-verified against source by the Fable orchestrator.
**Baseline health:** `tsc --noEmit` clean; 131/131 unit tests pass. All tests are mocked; no hosted-DB, EAS, or on-device verification this session.

## Verdict: NOT PRODUCTION-READY — NO-GO

The core swipe → match → E2EE-chat loop is genuinely wired end-to-end against real Supabase RPCs, and the code hygiene is above average (Zod-validated repository, auth-guarded RPCs, plaintext hard-blocked client + SQL, strong device-storage hardening, honest capability copy in most places). But the app cannot ship to a public dating audience today. It has a **regressed E2EE trust guarantee**, a **crash path in the chat screen**, an **auth flow that will fail on device**, a **backend schema that is not reproducible from this repo**, **zero legal/moderation infrastructure**, and **fabricated-success UI**. Estimated: the code-level P0s are fixable in this session; the infra/legal/feature P0s are a multi-week track requiring founder and ops input.

## Severity summary

| Class | Critical | High | Med | Low |
|-------|----------|------|-----|-----|
| E2EE / crypto / auth | 1 (Y1) | 3 (Y2, Y3, Y4) | 2 (Y5, Y6) | 2 (Y7, Y8) |
| Correctness bugs | — | 3 (B1, B2, B3) | 4 | 2 |
| Backend / schema / RLS | 2 (repo-schema, config) | 3 | 3 | 2 |
| Trust & safety / legal | 4 (legal docs, moderation, CSAM path, verified badge) | — | 2 | — |
| Build / release | — | 4 (EAS id, push, privacy manifest, IAP) | 5 | 3 |

## Critical & high findings (verified against source)

### Security / E2EE
- **Y1 (Critical) — sender-key binding is dead code on receive.** `YearnSocialSurfaces.tsx:492-496` calls `decryptYearnMessageForDevice` with `expectedSender: { senderUserId }` only, never `senderPublicKey`. The library enforces sender identity *only when the pubkey is passed*, so the attacker-authored `header.senderPublicKey` inside the envelope is trusted. A match partner (or a rogue device added to a sender's account) can message under a fresh, never-pinned key with **no key-change warning**. This is the exact impersonation surface the prior F2 fix was meant to close — it silently regressed because the send path pins keys but the receive path does zero pinning.
- **Y3 (High) — PKCE flow not configured.** `supabase.ts:51-61` sets `detectSessionInUrl:false` but no `flowType`. supabase-js v2 defaults to `implicit`, yet `authLinks.ts` calls `exchangeCodeForSession(code)` (needs PKCE + stored verifier). Google OAuth and `?code=` magic links will fail the exchange. **OAuth sign-in is broken.**
- **Y4 (High, verify on device) — no CSPRNG polyfill.** `metro.config.js` aliases `crypto` → `shims/crypto.js`, which throws if `globalThis.crypto.getRandomValues` is absent. Nothing imports `react-native-get-random-values` (not even a dependency) or sets `nacl.setPRNG` at the entry (`app/_layout.tsx`). If the global is missing under Hermes, **every E2EE keypair/encrypt throws on first use**. Vitest masks it (Node crypto).
- **Y2 (High) — multi-device broken.** `intro_recipient_device_key` returns one device (`limit 1`); `nacl.box` is pairwise and decrypt rejects a non-matching `recipientDeviceId`. Second device / reinstall → all prior ciphertext permanently renders null.
- **Y6 (Med) — corrupt pin silently re-trusts.** `yearnKeyDirectory.ts:53-58` treats an unparseable pin as first-use and re-pins, downgrading a "key changed" alert to silent trust.

### Correctness bugs
- **B1 (High) — malformed ciphertext white-screens the Matches tab.** Decrypt runs inside `messages.map()` during render (`YearnSocialSurfaces.tsx:491`); on non-JSON/failed-schema plaintext it throws, and there is no ErrorBoundary anywhere. One bad row → the whole tab crashes with no recovery.
- **B2 (High) — stale effect deps.** The message-load effect (`:316-345`) omits `userId` and `refreshToken`. The open conversation never refetches on Refresh (new messages don't appear until you switch matches and back), and read-receipt comparison can run against a stale/null `userId`.
- **B3 (High) — deck index off-by-one.** `removeProfileFromDeck` (`DiscoverDeck.tsx:260-262`) clamps `currentIndex` using stale closure `profiles.length` while `setProfiles` mutates the array — blocking/reporting a non-current card can re-show a swiped profile or skip the next one.
- **B4 / U6 (Med) — own sent messages become unreadable.** `sentEchoes` is in-memory only and own messages are never decrypted; after any refetch your own history renders "readable on their device."
- **U1 / B5 (Blocker) — fabricated success.** Star/Boost buttons advance the deck and show a success toast but `persistDeckWrite` only writes for like/pass — the app tells the user an action worked when nothing happened server-side.
- **B7 (Med) — stale selectedMatchId.** After a refresh that drops the selected match, the old id is kept and the chat panel silently goes blank.

### Backend / schema
- **Schema not reproducible from repo (Blocker).** The six `20260531*` MyLife migrations are *patches* wrapped in `if to_regclass('yearn.profiles') is null … skip`. On a fresh DB they all silently no-op. Base tables (`profiles`, `likes`, `matches`, `blocks`, `reports`, `messages`), `is_blocked()`, and 8 of 12 RPCs exist only in the native repo. The hosted project works only because it was seeded out-of-band.
- **`config.toml` doesn't expose `yearn` (Blocker).** `schemas = ["public","graphql_public"]` — the client sets `db.schema='yearn'`, so from-repo every call 404s.
- **`activate_boost` has no receipt validation (High).** Any authed user can call it directly for unlimited free boosts; no unique index on transaction id.
- **Photo signed-URL access without a match (High).** Any authed user can mint signed URLs for any visible profile's photos; unmatch does not revoke.
- **Rate limits are per-sender only (Med).** No per-recipient cap → one account can hammer one victim up to the ceiling.

### Trust & safety / legal (all launch-blocking for a dating app)
- **No legal docs** — no Terms/EULA, Privacy Policy, or Community Guidelines anywhere; no in-app links. Apple will reject a UGC dating app without these.
- **Reports go nowhere** — `reportUser` inserts a row; there is no moderation queue, admin surface, or action path.
- **No CSAM/minor-safety reporting pathway** — no escalation/takedown mechanism for illegal content (legal obligation for a UGC platform, independent of App Store).
- **`is_verified` badge with no pipeline** — renders a ShieldCheck with nothing behind it; must be gated off until a real review flow exists.

### Build / release
- **No EAS `projectId`** (builds fail/ambiguous) · **no push config** despite chat being core · **privacy manifest gaps** (Contacts/Location API reasons missing) · **monetization entirely unimplemented** (no RevenueCat, product IDs referenced nowhere) · **Contacts permission requested with no usage** · **mic permission string claims in-app calls that don't exist**.

## What is genuinely solid (do not re-flag)
Nonce handling (fresh per message, no reuse); plaintext-leak guards (recursive forbidden-key rejection + SQL hard-fail); F5 deep-link fixation closed (raw tokens rejected, `detectSessionInUrl:false`); Apple nonce SHA-256 handling; device secret stored in Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); SECURITY DEFINER RPCs pin `search_path`, revoke anon/public, re-check block/pause/self-target; account-deletion UX; Android/iOS hardening plugins; public-beta gating of dev surfaces; the onboarding wizard (10 steps, per-field visibility, validation).

## Must verify against the live hosted DB (not possible in-session)
All 13 native migrations applied in order; `yearn` in PostgREST exposed schemas; `profiles_min_age_18` is VALIDATED; RLS ENABLED on every table; no stray `grant … to anon`; `delete_my_account` truly purges; App Store Server Notifications webhook deployed.

## Remediation
See `docs/plans/queue/47-yearn-production-readiness-remediation.md`. Phase 1 (code-level P0s: E2EE receive-path binding, PKCE, CSPRNG, crash/ErrorBoundary, effect deps, deck index, fabricated success, honesty fixes) is executed this session. Phases 2–5 (schema consolidation, moderation + legal + CSAM pathway, push/realtime/geo, monetization/verification) require founder, ops, and hosted-infra input.
