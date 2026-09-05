# MyLife Dual-Model Implementation Tickets

Date: 2026-02-24
Source design: `docs/dual-model-product-design.md`

## Execution Rules
- Ticket IDs use `DM-###`.
- Priority: `P0` (blocker), `P1` (high), `P2` (normal).
- Definition of done for all tickets:
  - Code merged to main repo.
  - Tests updated/passing for changed behavior.
  - Docs updated if user-facing or ops-facing behavior changed.

## Milestone 1: Foundation (Entitlements + Mode Selection)
Target: 2-4 weeks

### DM-001 Create shared entitlement contract package
- Priority: P0
- Estimate: 1 day
- Scope: Create `packages/entitlements` with plan/mode/type definitions and runtime schema validation.
- Deliverables:
  - `packages/entitlements/src/types.ts`
  - `packages/entitlements/src/schema.ts`
  - `packages/entitlements/src/index.ts`
- Acceptance criteria:
  - Exposes `PlanMode` (`hosted`, `self_host`, `local_only`).
  - Exposes `Entitlements` interface + zod schema.
  - Package is imported by web and mobile without type errors.

### DM-002 Add entitlement verification utility (signed token)
- Priority: P0
- Estimate: 1 day
- Scope: Add signature verification for entitlement payloads.
- Deliverables:
  - `packages/entitlements/src/verify.ts`
  - Unit tests for valid/invalid/expired token cases.
- Acceptance criteria:
  - Invalid signature is rejected.
  - Expired entitlement is rejected.
  - Tests cover happy + failure paths.

### DM-003 Add hub DB tables for mode + entitlements cache
- Priority: P0
- Estimate: 1 day
- Scope: Extend `@mylife/db` hub schema.
- Deliverables:
  - Add `hub_mode` table (current mode + server URL).
  - Add `hub_entitlements` table (latest token + parsed fields).
  - Migration runner coverage.
- Acceptance criteria:
  - Fresh DB includes both tables.
  - Existing DB migrates without data loss.
  - Read/write query helpers added in `packages/db/src/hub-queries.ts`.

### DM-004 Implement entitlement repository in web app
- Priority: P0
- Estimate: 1 day
- Scope: Wire entitlement persistence in `apps/web`.
- Deliverables:
  - `apps/web/lib/entitlements.ts`
  - Server actions for saving/loading entitlements.
- Acceptance criteria:
  - Web layout can load entitlement state on boot.
  - Invalid tokens are not persisted.

### DM-005 Implement entitlement repository in mobile app
- Priority: P0
- Estimate: 1 day
- Scope: Wire entitlement persistence in `apps/mobile`.
- Deliverables:
  - `apps/mobile/lib/entitlements.ts`
  - Integration in `DatabaseProvider` initialization sequence.
- Acceptance criteria:
  - Mobile app boots with persisted mode/entitlement state.
  - Corrupt entitlement payload is safely ignored + logged.

### DM-006 Add mode switch UI to onboarding (web)
- Priority: P0
- Estimate: 1 day
- Scope: Add onboarding route/screen with three mode options.
- Deliverables:
  - `apps/web/app/onboarding/mode/page.tsx`
  - Buttons: Hosted, Self-host, Local-only.
- Acceptance criteria:
  - Selection persists to `hub_mode`.
  - Re-open app and previous selection is restored.

### DM-007 Add mode switch UI to onboarding (mobile)
- Priority: P0
- Estimate: 1 day
- Scope: Add onboarding screen and routing for mode selection.
- Deliverables:
  - `apps/mobile/app/(hub)/onboarding-mode.tsx` (or equivalent route)
- Acceptance criteria:
  - Selection persists to `hub_mode`.
  - Re-open app and previous selection is restored.

### DM-008 Add mode + entitlement section in Settings (web)
- Priority: P1
- Estimate: 0.5 day
- Scope: Extend `apps/web/app/settings/page.tsx`.
- Deliverables:
  - Mode badge
  - Entitlement status cards
  - Update pack year display
- Acceptance criteria:
  - Displays current mode accurately.
  - Displays self-host/hosted/update-pack state from DB.

### DM-009 Add mode + entitlement section in Settings (mobile)
- Priority: P1
- Estimate: 0.5 day
- Scope: Extend hub settings on mobile.
- Deliverables:
  - Mode badge
  - Entitlement state display
- Acceptance criteria:
  - Mirrors web behavior and values.

### DM-010 Add feature gates helper (shared)
- Priority: P0
- Estimate: 0.5 day
- Scope: Create `canUseHosted`, `canUseSelfHost`, `canUseUpdatePack(year)` helpers.
- Deliverables:
  - `packages/entitlements/src/gates.ts`
  - Unit tests
- Acceptance criteria:
  - Gates are deterministic for all plan combinations.

## Milestone 2: Billing + Entitlement Issuance
Target: 2 weeks

### DM-011 Define SKU matrix (mobile/web)
- Priority: P0
- Estimate: 0.5 day
- Scope: Finalize product IDs and naming.
- Deliverables:
  - `docs/billing-sku-matrix.md`
  - IDs for monthly/yearly hosted, self-host one-time, update pack yearly.
- Acceptance criteria:
  - SKU matrix approved and referenced by code constants.

### DM-012 Add billing constants package
- Priority: P0
- Estimate: 0.5 day
- Scope: Centralize SKU IDs to avoid mismatch.
- Deliverables:
  - `packages/billing-config/src/index.ts`
- Acceptance criteria:
  - Web and mobile import same constants.

### DM-013 Build entitlement issuer endpoint
- Priority: P0
- Estimate: 2 days
- Scope: Backend endpoint that signs entitlement tokens after verified purchase events.
- Deliverables:
  - `apps/web/app/api/entitlements/issue/route.ts` (or backend service)
- Acceptance criteria:
  - Issues signed payload for hosted and self-host purchases.
  - Includes `expiresAt` for subscriptions.

### DM-014 Add webhook handler for purchase events
- Priority: P0
- Estimate: 1.5 days
- Scope: Stripe/Lemon/RC webhook to update entitlement records.
- Deliverables:
  - `apps/web/app/api/webhooks/billing/route.ts`
- Acceptance criteria:
  - Handles create/renew/cancel/refund.
  - Idempotent processing.

### DM-015 Add entitlement sync endpoint for clients
- Priority: P0
- Estimate: 1 day
- Scope: Authenticated endpoint to fetch latest entitlement token.
- Deliverables:
  - `apps/web/app/api/entitlements/sync/route.ts`
- Acceptance criteria:
  - Returns current signed entitlement payload.
  - Returns clear error for no entitlement found.

### DM-016 Implement web client entitlement refresh
- Priority: P1
- Estimate: 0.5 day
- Scope: Poll/manual refresh from settings.
- Deliverables:
  - Refresh action button in web settings.
- Acceptance criteria:
  - User can refresh entitlement state without app restart.

### DM-017 Implement mobile client entitlement refresh
- Priority: P1
- Estimate: 0.5 day
- Scope: Same as web for mobile.
- Deliverables:
  - Refresh control in mobile settings.
- Acceptance criteria:
  - Entitlement refresh works on demand.

## Milestone 3: Self-Host Connectivity + Deployment Kit
Target: 2-3 weeks

### DM-018 Create self-host service contract (OpenAPI)
- Priority: P0
- Estimate: 1 day
- Scope: Define minimal API contract used by app in self-host mode.
- Deliverables:
  - `docs/self-host/api-contract.yaml`
- Acceptance criteria:
  - Includes health, auth, sync, share endpoints.

### DM-019 Add server endpoint configuration in apps
- Priority: P0
- Estimate: 1 day
- Scope: Add `serverUrl` runtime config per mode.
- Deliverables:
  - `apps/web/lib/server-endpoint.ts`
  - `apps/mobile/lib/server-endpoint.ts`
- Acceptance criteria:
  - Hosted mode uses managed URL.
  - Self-host mode uses user-configured URL.

### DM-020 Build self-host connection test screen (web)
- Priority: P1
- Estimate: 0.5 day
- Scope: Test URL, TLS, auth reachability.
- Deliverables:
  - `apps/web/app/settings/self-host/page.tsx`
- Acceptance criteria:
  - Shows pass/fail with actionable errors.

### DM-021 Build self-host connection test screen (mobile)
- Priority: P1
- Estimate: 0.5 day
- Scope: Same as web.
- Deliverables:
  - `apps/mobile/app/(hub)/self-host.tsx`
- Acceptance criteria:
  - Shows pass/fail with actionable errors.

### DM-022 Create Docker compose self-host template
- Priority: P0
- Estimate: 1.5 days
- Scope: First deployable compose bundle.
- Deliverables:
  - `deploy/self-host/docker-compose.yml`
  - `deploy/self-host/.env.example`
- Acceptance criteria:
  - Boots API + DB + storage service locally.
  - Healthcheck returns healthy.

### DM-023 Add migration and seed scripts for self-host stack
- Priority: P0
- Estimate: 1 day
- Scope: One command for bootstrapping schema.
- Deliverables:
  - `deploy/self-host/scripts/migrate.sh`
  - `deploy/self-host/scripts/seed.sh`
- Acceptance criteria:
  - Fresh install reaches usable app state.

### DM-024 Add backup/restore scripts
- Priority: P1
- Estimate: 1 day
- Scope: DB + storage backup automation.
- Deliverables:
  - `deploy/self-host/scripts/backup.sh`
  - `deploy/self-host/scripts/restore.sh`
- Acceptance criteria:
  - Restore tested on clean instance.

### DM-025 Publish self-host quickstart docs
- Priority: P0
- Estimate: 1 day
- Scope: End-user guide for setup.
- Deliverables:
  - `docs/self-host/README.md`
  - `docs/self-host/troubleshooting.md`
- Acceptance criteria:
  - New user can complete setup in <45 minutes from docs only.

## Milestone 4: Repo Gating + Post-Purchase Access
Target: 1-2 weeks

### DM-026 Define gated repo structure
- Priority: P0
- Estimate: 0.5 day
- Scope: Create self-host/customer-access folders.
- Deliverables:
  - `docs/self-host/`
  - `deploy/self-host/`
  - `ai-customization/`
- Acceptance criteria:
  - Structure created and referenced in docs.

### DM-027 Build GitHub access automation service
- Priority: P1
- Estimate: 2 days
- Scope: Webhook -> GitHub invite flow.
- Deliverables:
  - Service script/job to add buyer to GitHub team.
- Acceptance criteria:
  - Successful paid self-host purchase triggers invite.
  - Failed invite retries with alert.

### DM-028 Add fallback downloadable bundle flow
- Priority: P1
- Estimate: 1 day
- Scope: For users without GitHub access.
- Deliverables:
  - Signed URL delivery for versioned zip bundle.
- Acceptance criteria:
  - Purchase confirmation includes secure bundle link.

### DM-029 Add entitlement revocation policy implementation
- Priority: P1
- Estimate: 1 day
- Scope: Refund/dispute handling.
- Deliverables:
  - Revocation path in entitlement service.
- Acceptance criteria:
  - Revoked entitlements no longer validate.

## Milestone 5: AI Customization Kit
Target: 1-2 weeks

### DM-030 Create AI customization quickstart
- Priority: P0
- Estimate: 0.5 day
- Scope: User guide for "change app with a paragraph" workflow.
- Deliverables:
  - `ai-customization/quickstart.md`
- Acceptance criteria:
  - Includes full example request -> patch -> test -> deploy.

### DM-031 Create safe prompt templates
- Priority: P1
- Estimate: 0.5 day
- Scope: Templates for feature edits, UI edits, bugfixes.
- Deliverables:
  - `ai-customization/prompt-templates.md`
- Acceptance criteria:
  - At least 5 reusable prompt templates.

### DM-032 Add change safety checklist
- Priority: P0
- Estimate: 0.5 day
- Scope: Standard pre-deploy checks.
- Deliverables:
  - `ai-customization/change-safe-checklist.md`
- Acceptance criteria:
  - Covers backup, migrations, tests, rollback.

### DM-033 Add patch planning helper script
- Priority: P1
- Estimate: 1 day
- Scope: Generate implementation plan from natural language input.
- Deliverables:
  - `scripts/dev/plan-from-request.ts`
- Acceptance criteria:
  - Outputs file targets + risk notes + suggested test commands.

### DM-034 Add regression runner script
- Priority: P1
- Estimate: 0.5 day
- Scope: Unified smoke + module tests command.
- Deliverables:
  - `scripts/dev/run-regression-suite.sh`
- Acceptance criteria:
  - One command validates core app + touched module tests.

## Milestone 6: MyBooks Pilot (First End-to-End Rollout)
Target: 2-3 weeks

### DM-035 Add MyBooks sharing primitives (domain)
- Priority: P0
- Estimate: 2 days
- Scope: Add shareable objects (rating/review/list) with visibility flags.
- Deliverables:
  - New schema + model layer in `modules/books`.
- Acceptance criteria:
  - Supports `private`, `friends`, `public` visibility at object level.

### DM-036 Add friend/invite model for pilot
- Priority: P0
- Estimate: 1.5 days
- Scope: Friend request + accept flow data model.
- Deliverables:
  - Shared friend entities in hub or books module.
- Acceptance criteria:
  - Invite/accept/revoke supported.

### DM-037 Build MyBooks share UI (web)
- Priority: P1
- Estimate: 1.5 days
- Scope: Share controls on review/rating screens.
- Acceptance criteria:
  - User can set visibility and share target.

### DM-038 Build MyBooks share UI (mobile)
- Priority: P1
- Estimate: 1.5 days
- Scope: Same as web.
- Acceptance criteria:
  - Parity with web behavior.

### DM-039 Add sync adapter route for hosted and self-host
- Priority: P0
- Estimate: 2 days
- Scope: Same client contract, different endpoint origin.
- Acceptance criteria:
  - Switching mode changes endpoint only, not UI behavior.

### DM-040 Pilot release + telemetry-free success instrumentation
- Priority: P1
- Estimate: 1 day
- Scope: Privacy-preserving operational metrics.
- Deliverables:
  - Aggregate event counters only (no personal content data).
- Acceptance criteria:
  - Can track mode adoption + setup completion without user content collection.

### DM-048 Add self-host direct messaging primitives
- Priority: P0
- Estimate: 2 days
- Scope: Add friend-to-friend direct message persistence and API contract.
- Deliverables:
  - `deploy/self-host/scripts/migrate.sh` (`friend_messages` table + indexes)
  - `deploy/self-host/api/src/server.js` (`/api/messages*` endpoints)
  - `docs/self-host/api-contract.yaml` updates
- Acceptance criteria:
  - Accepted friends can send and list direct messages.
  - Message creation supports idempotency via `clientMessageId`.
  - Inbox summaries include unread counts.

### DM-049 Add local-first message cache + outbox retry loop (clients)
- Priority: P1
- Estimate: 2 days
- Scope: Ensure messaging UX works cleanly across network drops.
- Deliverables:
  - Local queue/cache schema in web/mobile storage layers.
  - Retry loop with backoff and duplicate prevention.
- Acceptance criteria:
  - Sending while offline queues safely and syncs on reconnect.
  - Duplicate sends do not create duplicate server rows.

### DM-050 Add federated self-host messaging transport
- Priority: P1
- Estimate: 1 week
- Scope: Support cross-instance messaging between separate self-host customer nodes.
- Deliverables:
  - Signed server-to-server inbox endpoint.
  - Outbound delivery worker queue + retry/dead-letter handling.
  - Domain-addressable user IDs (`user@server`).
- Acceptance criteria:
  - Two independent self-host deployments can exchange friend messages.
  - Replay/spoof protection is documented and tested.

### DM-051 Harden actor identity rollout (deprecate plain userId fallback)
- Priority: P1
- Estimate: 2 days
- Scope: Move social APIs to token-first identity by default and phase out plain `userId` fallback.
- Deliverables:
  - Feature flag and migration window for strict token enforcement.
  - Mobile actor-token issuance/storage usage for MyBooks social flows.
  - Secret rotation + incident runbook updates in `docs/self-host`.
- Acceptance criteria:
  - Hosted + self-host social APIs accept signed token flow end-to-end.
  - Strict mode can be enabled without breaking current clients after migration window.
  - Ops docs include token secret rotation and recovery procedure.

### DM-052 Add operational counters dashboard/export (privacy-safe)
- Priority: P1
- Estimate: 1.5 days
- Scope: Expose aggregate counters to operators without user-level data.
- Deliverables:
  - Minimal web ops page for `hub_aggregate_event_counters` reads.
  - Optional CSV export endpoint for mode/setup aggregate counts.
  - Auth/read-key guardrails for all ops routes.
- Acceptance criteria:
  - Operators can view mode adoption and setup completion trends.
  - No user IDs or content payloads are exposed in ops views.
  - Access controls are documented and tested.

### DM-053 Add hosted vs self-host parity integration tests (social + sync adapter)
- Priority: P1
- Estimate: 2 days
- Scope: Verify identical client behavior across endpoint origins using the sync adapter contract.
- Deliverables:
  - Integration suite covering share events, invites, friends, and actor identity headers.
  - Contract checks against `docs/self-host/api-contract.yaml`.
  - Regression hook in `scripts/dev/run-regression-suite.sh`.
- Acceptance criteria:
  - Test suite catches response-shape mismatches across hosted/self-host.
  - Mode switch does not require UI code-path changes to pass scenarios.
  - CI/local regression includes at least one parity test path.

## Milestone 7: Cross-App Rollout
Target: ongoing

### DM-041 Extend dual-mode to MySubs
- Priority: P1
- Estimate: 1 week
- Scope: Apply same entitlement + sync pattern used in MyBooks.
- Acceptance criteria:
  - Hosted/self-host/local-only all functional.

### DM-042 Extend dual-mode to MyRecipes
- Priority: P1
- Estimate: 1 week
- Scope: Same as above.
- Acceptance criteria:
  - Full mode parity.

### DM-043 Plan refactor backlog for cloud-heavy apps
- Priority: P1
- Estimate: 2 days
- Scope: Create app-specific adapter/refactor tickets for MySurf, MyHomes, MyWorkouts.
- Deliverables:
  - `docs/refactor/cloud-heavy-dual-mode-plan.md`
- Acceptance criteria:
  - Each app has phased migration path with risk estimates.

## QA + Release Management Tickets

### DM-044 Add entitlement test matrix (unit + integration)
- Priority: P0
- Estimate: 1 day
- Scope: Verify all mode/plan combinations.
- Acceptance criteria:
  - Tests cover hosted active/inactive, self-host valid/invalid, update pack present/missing.

### DM-045 Add mode switch E2E tests (web)
- Priority: P1
- Estimate: 1 day
- Scope: Onboarding + settings mode transitions.
- Acceptance criteria:
  - E2E test passes for all three modes.

### DM-046 Add mode switch E2E tests (mobile)
- Priority: P1
- Estimate: 1 day
- Scope: Same as web.
- Acceptance criteria:
  - Automated or scripted validation documented and passing.

### DM-047 Create release checklist for dual-model launches
- Priority: P0
- Estimate: 0.5 day
- Scope: Avoid launch regressions.
- Deliverables:
  - `docs/releases/dual-model-release-checklist.md`
- Acceptance criteria:
  - Includes billing, entitlement signing keys, webhook health, store SKU verification, docs links.

## Suggested Sprint Cut (First 2 Sprints)

Sprint 1 (P0 core)
- DM-001, DM-002, DM-003, DM-004, DM-005, DM-006, DM-007, DM-010, DM-011, DM-012

Sprint 2 (billing + self-host MVP)
- DM-013, DM-014, DM-015, DM-018, DM-019, DM-022, DM-023, DM-025, DM-030, DM-032

## Dependencies Overview
- DM-001 blocks most tickets.
- DM-003 blocks DM-004/005/006/007/008/009.
- DM-013 and DM-014 block DM-015/016/017.
- DM-018 and DM-019 block DM-020/021/039.
- DM-022 and DM-023 block DM-025.
- DM-035/036 block DM-037/038/039.

## Open Decisions (Resolve before Sprint 1 end)
- Billing stack of record for entitlement source of truth (Stripe vs RevenueCat vs hybrid).
- Entitlement signing key rotation policy.
- Whether update pack is annual subscription SKU or annual non-consumable SKU set.
- GitHub team-invite automation vs signed bundle-only distribution.
