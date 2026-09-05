# 2026-07-08 Meerkat Plan 40 Downloads And E2E

## Summary

Reviewed Plan 40 from `.claude/worktrees/main-merge/docs/plans/queue/40-meerkat-final-launch-plan.html` and completed the codeable local items from the global Downloads browser and web launch E2E sections.

Items not code-completed in this session require external evidence or founder-operated systems: real same-account two-device QA, production relay URL evidence, App Store and legal account work, hosted service deployment, and final screenshot packages.

## Completed

- Added cross-community Downloads helpers on mobile and web, sourced from the existing community file aggregation paths instead of raw attachment rows.
- Added a mobile `/downloads` route with search, status filters, multi-select bulk save, per-file open/save/report/request-again, removed-file non-saveability, live local-byte presence, and safety filtering via `communityFileReportTarget`.
- Added the web `DownloadsView` with the same cross-community model, safe inline-view/download behavior, multi-select browser download, per-file report/hide, and request-again support.
- Wired Downloads reachability from Settings and each community Files surface on both mobile and web.
- Added Playwright launch E2E for web cold load, onboarding, community creation, message send, Downloads reachability from Files and Settings, recovery fail-closed behavior, and a relay-dependent test that only runs when `MEERKAT_E2E_RELAY_URL` points at a real WebSocket relay.
- Added a Plan 40 parity lock to `scripts/check-meerkat-parity.mjs` so the mobile/web Downloads routes, copy, helper tests, reachability, and web E2E scaffold cannot silently drift.
- Logged and resolved the E2E setup failure and parity-guard failure in `errors_log.md`.

## Verification

- `pnpm --filter @mylife/meerkat-app exec vitest run "app/(root)/data/__tests__/global-downloads.function-gate.test.ts"`
- `pnpm --filter @mylife/meerkat-web exec vitest run src/lib/__tests__/global-downloads.test.ts`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-web test:e2e`
- `pnpm check:meerkat-parity`
- `pnpm gate:function:changed`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

## Notes

- The web E2E relay path skipped honestly because `MEERKAT_E2E_RELAY_URL` was not configured in this shell.
- The current visible web UI does not expose attachment creation from the browser launch path, so the Playwright suite verifies Downloads reachability and honest empty states. Download success behavior is covered through helper tests and the implemented UI paths over verified local bytes.
- `gate:function:changed` also ran the pre-existing dirty `packages/meerkat-relay/bin/meerkat-persona-service.mjs` package because it was modified before this session.
