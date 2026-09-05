# 2026-07-16: Meerkat Readiness Report + Activation Runbook Review

## Goal

Review `REPORT-meerkat-full-production-readiness-2026-07-15` and `meerkat-production-activation-runbook-2026-07-15` (md + html, living on `fix/meerkat-plan41-audit-findings` in the `/private/tmp/mylife-plan41-audit` worktree), verify they are current against the code, and produce step-by-step instructions for the remaining launch work.

## What was verified

- **Git topology:** `/private/tmp/mylife-plan41-audit` is a linked worktree of the main repo (shared `.git`), branch `fix/meerkat-plan41-audit-findings`, HEAD was `79a28a05`. `feature/meerkat-plan43` HEAD (`eaf69b18`) is an ancestor; branches `worktree-wp43g` (3af4ba99) and `feature/meerkat-production-readiness-2026-07-09` (9374da8c) are superseded re-lands (da314310 re-lands WP-43G with the same 6-file set). Branch is NOT pushed; origin only has `feature/meerkat-plan43`.
- **Doc integrity:** HTML twins match md on all sampled anchors; docs/README.md and docs/reports/README.md indexes reference the new artifacts; the superseded 07-12 launch-runbook HTML was removed per lifecycle policy.
- **Test reruns (2026-07-16):** `pnpm test:meerkat-plan43-proof` 182/182 green (166 relay + 16 sync); `@mylife/entitlements` 77/77 green. Both match the report's claims.
- **Code claims:** 3 parallel read-only verification agents checked 24 claims (topology/safety 7, archive/entitlement security 9, storage/restore/push/UX 8). All 24 verified with file:line evidence, including: compose.production.yml full 13-service graph with health-gated edge startup, DMCA placeholder rejection, operator console loopback + auth rate limiting, fail-closed ClamD, NCMEC single-authoritative-row migration, entitlement subject binding, archive proof binding + nonce replay protection, signed manifest validation, atomic PG advisory-lock quotas, hash-qualified quarantine keys, deletion after entitlement lapse, mobile journal-slot restore with WAL/SHM rollback, web single-transaction IndexedDB restore, real Swift iCloud module, push-store `getRegistration(idHash)` by-hash getter (closes the O(n) tech-debt row), Share Inbox DM routing, loopback-only dev HTTP.

## Defect found and fixed

- Report claimed archive intake validates **SHA-512** object values; code uses **SHA-256** for object digests (`archive-intake-http.ts`; SHA-512 only derives content-registry ids in `public-archive.ts`). Corrected md + html in `118346ae` on `fix/meerkat-plan41-audit-findings`.

## Conclusion

Both documents are current and accurate against the code as of `118346ae`. Verdicts stand: code PASS, production launch NO-GO pending founder-operated/live evidence. Remaining work is runbook Steps 1-18, starting with pushing the branch and merging through the protected path.

## Bookkeeping

- errors_log.md: upgraded 8 auto-logged stubs (07-13/07-14) to 2 consolidated Resolved rows; added the SHA-512 doc-defect row.
- memory.md: collapsed 50 stop-hook stub rows, refreshed Meerkat project state, removed the closed push-gateway O(n) tech-debt row, added session row.
- No function logic changed in this session (docs + memory only), so the function gate was not applicable; test reruns above were verification evidence.
