# Meerkat audit remediation, 2026-09-02

## What changed

- Replaced feed, post-card, reaction, unread, and file-projection query amplification with bounded batch reads and per-evaluation reuse of verified events and community safety state on mobile and web.
- Added a repeatable signed-event benchmark at `apps/meerkat/scripts/benchmark-feed-read-model.ts` plus query-count regression tests.
- Added unbiased random integer and byte helpers to `@mylife/sync`, then replaced non-secret `Math.random()` identifiers and conflict nonces across both Meerkat surfaces.
- Applied compatible dependency overrides, pinned the Expo-compatible webview peer context, cleared the duplicate Expo graph, and fixed all mobile and web lint warnings.
- Simplified contradictory or over-broad rules in root `AGENTS.md`, root `CLAUDE.md`, and `apps/meerkat/AGENTS.md` while preserving security, honesty, parity, and data-integrity boundaries.
- Updated the comprehensive audit markdown and self-contained HTML report with remediation status and measured results.

## Performance result

The harness uses production functions, real signed events, an in-memory `better-sqlite3` adapter, 3 warmups, and 9 measured runs.

At 320 posts, `evaluateLocalFeed` fell from 1,286 to 7 queries. Median time fell from 1,995.4499 ms to 693.8620 ms, and p95 fell from 2,022.0492 ms to 701.2485 ms.

```text
Query reduction  = 1 - (7 / 1,286) = 99.4557%
Median reduction = 1 - (693.8620 / 1,995.4499) = 65.2278%
p95 reduction    = 1 - (701.2485 / 2,022.0492) = 65.3199%
Speedup          = 1,995.4499 / 693.8620 = 2.8759x
```

Post-card reads fell from 321 to 2. Reaction reads fell from 641 to 2. Required signature verification remains intact and dominates the remaining host-side time.

## Dependency result

- Expo Doctor: 17/17 checks passed.
- Android and iOS Expo exports passed, each producing a 15.3 MB Hermes bundle.
- The web production build passed.
- A fresh npm bulk-advisory query reports only two `image-size` records from the original 13-record audit. npm's latest `image-size@2.0.2` is still affected, so there is no patched release to install.
- Newly published Undici ranges found during final verification were also closed by moving the 7.x override to `7.29.0`.

## Verification

- Mobile tests: 1,817 passed.
- Web tests: 1,230 passed.
- Sync tests: 2,630 passed, 3 skipped.
- Relay tests: 1,653 passed, 189 skipped because live PostgreSQL, object-store, and related provider configuration was absent.
- Total: 7,330 passed, 192 skipped.
- `pnpm gate:function:changed`: passed, including hub mobile and web consumer type checks.
- `pnpm check:meerkat-parity`: passed.
- `pnpm check:meerkat-transport-nc`: passed.
- Mobile, web, and sync lint and type checks: passed.
- `pnpm check:generated-artifacts`: passed.

## Remaining items

- Collect physical-device startup, feed-scroll, transport, background scheduling, push-wake, and keychain-relaunch evidence.
- Run provider-backed relay integration suites with PostgreSQL, object storage, LiveKit, and service credentials.
- Reduce the mobile and web bundle concentrations identified in the audit.
- Move repeated runtime schema creation to explicit boot or migration paths.
- Revisit `image-size` when npm publishes a fixed release.
- Repair or replace the workspace-scale `pnpm audit` path, which still exhausts 4 to 8 GB heaps.

## Decisions

- Verification results are reused only within one read-model evaluation. No signed-event acceptance is cached across calls.
- Safety filtering and fail-closed signature checks were preserved while database reads were batched.
- The instruction edits narrow operational ceremony, not product completeness or security invariants.
