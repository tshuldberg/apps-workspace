# Meerkat Production Plan Coverage

Date: 2026-07-09

Branch: `feature/meerkat-production-readiness-2026-07-09`

## Outcome

Created a complete, implementation-ready plan set for every verified production code gap from the BLACKGLASS audit and reconciled those plans into one master launch gate. Planning is complete. The affected code remains a production NO-GO until the plans are implemented and their evidence gates pass.

## Why

The audit identified launch-blocking work beyond the earlier Calls and Rooms and Storage Destinations plans. Several gaps had no comprehensive owner, architecture, failure model, test map, or release evidence contract. The new plan set removes those planning gaps without treating old reports or recent commits as proof of implementation.

## Plans Created or Rebuilt

- Plan 25 was rebuilt for direct calls, rooms, native incoming-call integration, screen sharing, recording, E2EE truth, and cross-platform evidence.
- Plan 41 was rebuilt for encrypted backup and atomic restore across local, cloud-drive, object-storage, hosted, and connected-server destinations.
- Plan 42 was created for real nearby and BLE native modules, capability-private push wake, and module-scope Expo background tasks.
- Plan 43 was created for durable managed archive publication, safe ingestion, private-history discovery, seeding, NCMEC filing, and runtime legal configuration.
- Plan 44 was created for PostgreSQL production state, object storage, HA, PITR, restore drills, observability, release images, SBOMs, attestations, signatures, canaries, and rollback.
- Plan 40 was rebuilt as the master coverage map, dependency graph, execution sequence, evidence ledger, and founder completion runbook.

## Residual Items Covered by the Master Plan

- Share Inbox direct-message routing must be made honest and functional on mobile and web.
- Publicly exported placeholder clients must be implemented or removed from public barrels.
- Status claims and audit language must be reconciled against executable evidence before release.

## Files Changed

- `docs/plans/queue/25-meerkat-calls-and-rooms.md` and HTML twin
- `docs/plans/queue/40-meerkat-final-launch-plan.md` and HTML twin
- `docs/plans/queue/41-meerkat-storage-destinations.md` and HTML twin
- `docs/plans/queue/42-meerkat-native-transport-push-background.md` and HTML twin
- `docs/plans/queue/43-meerkat-managed-archive-seeding-safety.md` and HTML twin
- `docs/plans/queue/44-meerkat-production-state-observability-release-supply-chain.md` and HTML twin
- `docs/plans/plan-artifact.css`
- `docs/reports/REPORT-meerkat-blackglass-production-adversarial-audit-2026-07-09.md` and HTML twin
- `memory.md`

## Architecture Decisions

- Self-hosted LiveKit is the room media plane. Direct one-to-one calls retain a P2P path.
- The app owns one React Native WebRTC runtime to prevent duplicate native WebRTC stacks.
- iOS incoming calls use PushKit and CallKit. Android incoming calls use the Telecom framework.
- Native nearby transports are owned Expo modules, not dynamic imports of packages that are absent from the repository.
- Background tasks are defined at module scope so headless execution can discover them.
- Backup objects are encrypted before any provider receives them. Restore is staged, verified, and atomically promoted.
- Durable production services use PostgreSQL and object storage. File-backed adapters remain development or migration inputs only.
- Release artifacts require platform-complete images, SBOMs, attestations, signatures, canaries, and rehearsed rollback.

## Verification

- Confirmed every detailed plan contains current-state evidence, scope boundaries, phased work, failure modes, test review, parallel ownership lanes, acceptance criteria, negative criteria, required gates, and close criteria.
- Confirmed Plan 40 maps every verified gap to a detailed plan or named residual task.
- Confirmed all plan and report HTML files are self-contained and use inline CSS.
- Ran Meerkat parity and generated-artifact checks.
- No source function logic changed, so the function quality gate was not required beyond the staged pre-commit check.

## Remaining Work

All remaining work is implementation or founder-operated production evidence. Execute Plan 40 in its dependency order, keep each detailed plan open until its code and evidence gates pass, and retain the production NO-GO until every launch-hard criterion is green.
