# 2026-07-11 — Yearn adversarial production audit + Phase 1 remediation

## Summary

Deep adversarial production-readiness audit of the Yearn dating app (`apps/yearn`) using 6 parallel read-only audit agents (Opus on crypto/backend/bugs, Sonnet on compliance/features/release), synthesized and independently re-verified against source by the Fable orchestrator. Verdict: **NO-GO / not production-ready**. Then executed Phase 1 (code-level P0/High fixes) and committed.

**Artifacts:** `docs/reports/REPORT-yearn-adversarial-production-audit-2026-07-11.{md,html}` (report), `docs/plans/queue/46-yearn-production-readiness-remediation.md` (5-phase plan).

## Verdict

NOT production-ready. Core swipe→match→E2EE-chat loop is genuinely wired and hygiene is above average, but: a regressed E2EE trust guarantee, a chat crash path, broken on-device auth, a backend schema not reproducible from the repo, zero legal/moderation infra, and fabricated-success UI.

## Findings (verified against source)

- **Y1 Critical** — sender-key binding was dead code on the receive path (`YearnSocialSurfaces.tsx` passed only `senderUserId`); the F2 fix silently regressed, allowing within-match impersonation with no warning.
- **Y3 High** — no `flowType: 'pkce'`; OAuth `exchangeCodeForSession` would fail.
- **Y4 High** — no CSPRNG polyfill; E2EE could throw on first use under Hermes.
- **Y2 High** — multi-device broken (`limit 1` device key).
- **B1 High** — malformed ciphertext threw in render → Matches white-screen (no ErrorBoundary).
- **B2 High** — message effect missing `userId`/`refreshToken` deps.
- **B3 High** — deck index off-by-one from stale closure length.
- **U1/B5 Blocker** — Star/Boost showed success but never persisted.
- Backend Blockers — schema not reproducible from repo (silent-skip migrations); `config.toml` doesn't expose `yearn`.
- T&S Blockers — no legal docs; reports go nowhere; no CSAM pathway; `is_verified` badge with no pipeline.
- Release — no EAS projectId; no push config; monetization unimplemented; mic/contacts permission overclaims.

## Phase 1 executed (committed 020f8654 on feature/yearn-production-readiness)

Y1 receive-path sender-key TOFU (new `resolveTrustedYearnSenderKey` + UI wiring + warning banner) · Y3 PKCE · Y4 `nacl.setPRNG` via expo-crypto at entry + hardened crypto shim · Y6 fail-closed unreadable pin · B1 decrypt-never-throws + top-level ErrorBoundary · B2 effect deps · B3 index math · B4/U6 durable local echo store for own messages · B7 selectedMatchId reconcile · U1/B5 removed Star/Boost · is_verified badge gated off · mic+contacts permissions removed (iOS strings, Android perms, privacy manifest) · onboarding verify copy · deck a11y disabled state.

New files: `src/lib/e2eeRandom.ts`, `src/lib/sentMessageEchoStore.ts`.

## Verification

- `tsc --noEmit` clean.
- 134/134 vitest pass (+3: Y1 sender-trust, Y6 fail-closed, B1 decrypt-safety). Updated the `yearnKeyDirectory` test that had asserted the old insecure "unreadable pin = first use" behavior.
- iOS `expo export` green (6.89 MB Hermes bundle, 3206 modules) — validates the crypto shim + entry PRNG install.

## Remaining (Phases 2–5, need founder/ops/hosted input)

Schema reproducibility + RLS hardening + `activate_boost` receipt validation (hosted) · legal docs + moderation action path + CSAM reporting pathway + App Store age rating · push + realtime + geo + filters · RevenueCat monetization + verification/NSFW pipeline. Live hosted-DB verification checklist in the report.

## Notes

- Branch contention: a parallel session checked out `feature/dowork-production-readiness` in the shared worktree mid-session; the Phase 1 commit initially landed there and was moved to `feature/yearn-production-readiness` (pointer-only), restoring the dowork branch to its clean base. No source entanglement (commit contained only yearn files).
