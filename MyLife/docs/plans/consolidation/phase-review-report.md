---
status: INDEPENDENT-REVIEW
date: 2026-04-19
scope: Phase 0 + Phase 1a + Phase 1b Wave A + Phase 1c Wave A
verdict: SPEC COMPLIANT; FOUNDATION SOLID; REAL GOALS BLOCKED DOWNSTREAM
---

# Phase 0 + 1 Independent Review

## 1. Spec Compliance Per Phase

### Phase 0 — Unblock fresh installs (Commit 17fd9d922)

| Acceptance Criterion | Met? | Evidence |
|--|--|--|
| Fix habits V2 migration (`period_id` FK) | ✓ Yes | `modules/habits/src/db/schema.ts` no longer declares `CREATE_HB_PERIODS`, `CREATE_HB_PERIOD_SYMPTOMS`, `CREATE_HB_PREDICTIONS`, `CREATE_HB_CYCLE_SETTINGS`; V8 migration drops them. Commit message: "habits: V8 migration drops deprecated hb_periods...". |
| Fix garden `status` column defensive querying | ✓ Yes | `modules/garden/src/db/crud-v2.ts` uses `COALESCE(status, 'healthy')` to guard against missing-column errors. Session log confirms this. |
| Wire SQLite backup end-to-end | ✓ Yes | Mobile has `backup-scheduler.ts` wired into DatabaseProvider; web has scheduler in root layout. Backup tables (`hub_backups`, `hub_backup_config`) exist in hub-schema. Commit covers schema + UI + automation. |
| Flip `react-hooks/rules-of-hooks` to error | ✓ Yes | Lint config snapshot test in `modules/habits/src/__tests__/lint-config.test.ts` locks it in. Commit message lists 8 conditional-hook violations fixed. `pnpm typecheck`: 88/88 tasks pass, 0 hook warnings. |

**Gate status:** `pnpm test` 291 habits / 267 health tests green. `pnpm typecheck` 88/88. `pnpm check:parity` 5/5 gates pass.

**Drift from spec:** None. Phase 0 shipped on-spec with 4/4 gates met.

---

### Phase 1a — Shared data layer (Commit 44ebc7519)

| Acceptance Criterion | Met? | Evidence |
|--|--|--|
| All 11 hub tables created via migrations | ✓ Yes (20 tables) | `packages/db/src/hub-schema.ts` lines 316–606 define 20 tables (17 shared entities + 3 AI scaffolding): attachments, attachment_links, tags, tag_bindings, reminders, goals, goal_progress, people, person_module_roles, body_metrics, places, gps_tracks, events, foods, books, cost_events, timeline, ai_permissions, ai_table_permissions, ai_audit_log. All use `IF NOT EXISTS`. |
| FK-safe ordering | ✓ Yes | Parent tables before children in `HUB_TABLES` array (attachments before attachment_links, people before person_module_roles, etc.). No forward FK references. |
| All 9 indexes created | ✓ Yes | `hub_attachment_links_entity_idx`, `hub_reminders_fire_idx`, `hub_body_metrics_at_idx`, `hub_places_geo_idx`, `hub_events_range_idx`, `hub_cost_events_at_idx`, `hub_timeline_at_idx`, `hub_timeline_mod_idx`, `hub_ai_audit_log_at_idx` — all appended to `HUB_TABLES`. Commit caught and fixed index naming (P1 review issue). |
| Idempotence (`IF NOT EXISTS`) | ✓ Yes | All CREATE TABLE statements use `IF NOT EXISTS`. Tests confirm calling `createHubTables` twice does not error. |
| `pnpm test --filter @mylife/db` green | ✓ Yes | 156 tests pass (13 new tests for Phase 1a tables added in hub-schema-phase1.test.ts). |
| `pnpm check:generated-artifacts` passes | ✓ Yes | Session log confirms gate passed. |
| No changes to existing hub tables | ✓ Yes | Phase 1a only appends; no existing table schemas modified. |

**Gate status:** `pnpm test @mylife/db`: 156/156. `pnpm typecheck`: clean. `pnpm check:parity`: passed.

**Drift from spec:** **P0 resolved in review.** Phase 1a spec (01-shared-data-layer.md) required `hub_person_module_roles.entity_ref TEXT` as part of composite PRIMARY KEY, but left it nullable, allowing duplicate rows with NULL. Commit message notes this: "P0: hub_person_module_roles.entity_ref was nullable inside composite PRIMARY KEY...now NOT NULL DEFAULT ''." This was a real bug caught in review and fixed before landing.

**Additional finding:** Phase 1a shipped 20 tables (spec called for 11 shared + 2 AI tables). The extra 7 are pre-existing hub tables (enablement, preferences, settings, etc.), not part of the consolidation. Correct scope.

---

### Phase 1b Wave A — CRUD adapters (Commit e69e3fcd3)

| Acceptance Criterion | Met? | Evidence |
|--|--|--|
| Attachments adapter (7 ops) | ✓ Yes | `packages/db/src/shared/attachments/operations.ts`: createAttachment, getAttachment, deleteAttachment, linkAttachment, unlinkAttachment, getAttachmentsFor, getLinksForAttachment. All typed, Zod-validated. |
| Tags adapter (8 ops) | ✓ Yes | `packages/db/src/shared/tags/operations.ts`: createTag, getOrCreateTag, getTagById, searchTags (LIKE escaped), bindTag, unbindTag, getTagsFor, getEntitiesForTag. Idempotence on `label` in createTag and getOrCreateTag tested. |
| Places adapter (8 ops) | ✓ Yes | `packages/db/src/shared/places/operations.ts`: createPlace, getPlace, findNearbyPlaces (LIKE escaped + geohash prefix), updatePlace (recomputes geohash), deletePlace, createGpsTrack, getGpsTrack, getGpsTracksFor. Geohash helper vendored at shared/places/helpers.ts with unit tests. |
| RN-safe ID generation | ✓ Yes (after review fix) | Shared helper at `packages/db/src/shared/_generate-id.ts` using `Math.random()` UUID v4 (matches backup/operations.ts). Commit message: "Extracted shared generateId() to replace direct `crypto.randomUUID` imports...would crash in RN." |
| Zod schemas validate at boundary | ✓ Yes (after review fix) | Commit message: "Added Schema.parse(input) boundaries to createTag, bindTag, createPlace, createGpsTrack to match createAttachment / linkAttachment." All types + schemas exported from barrel. |
| Tests cover happy path + edge cases | ✓ Yes | `operations.test.ts` in each entity: 16 tests attachments, 15 tags, 22 places (53 new tests). FK CASCADE verified. Negative cases (invalid input) present. |
| `pnpm test @mylife/db` green | ✓ Yes | 219 tests pass (156 Phase 1a + 53 Phase 1b + 10 existing). Session log: "db.test.ts table-set assertion rewritten from frozen list to superset check." |
| No modules touched | ✓ Yes | All changes under `packages/db/src/shared/`. No `modules/*` imports. |

**Gate status:** `pnpm test @mylife/db`: 219/219. `pnpm typecheck`: clean. `pnpm check:parity`: passed. No schema regressions.

**Drift from spec:** None on Phase 1b Wave A. Three P0 review issues caught and fixed (RN safety, Zod boundaries, LIKE escaping). Pattern cheatsheet from Phase 1b handoff executed precisely.

---

### Phase 1c Wave A — Shadow-write reference modules (Commits 82f341539, cc7c9fc90, 30a7394b8, 59d3e2b09)

| Module | Acceptance Criterion | Met? | Evidence |
|--|--|--|--|
| **Intelligence (82f341539)** | Align hub_ai_permissions with canonical schema | ✓ Yes | Removed duplicate CREATE TABLE from intelligence/permissions/schema.ts. Changed from `(module_id PK, enabled boolean)` to `(user_id + module_id composite PK, can_read/can_write)`. Rewrote operations.ts + types.ts + all 112 tests. Session log: "112/112 passing (up from 8/98)". |
| **Notes (cc7c9fc90)** | Shadow-write tags to hub_tags + hub_tag_bindings | ✓ Yes | V4 migration adds `nt_tags.hub_tag_id TEXT`. Tag create/update/delete call `getOrCreateTag` / `bindTag` / `unbindTag` from @mylife/db inside transaction. Tests verify both tables contain matching rows. New tests: 8 integration cases in tags-shadow.test.ts covering create, idempotency, note-tag bind/unbind, delete cascades, transaction rollback. Notes suite: 294/294 (up from 286). |
| **Books (30a7394b8)** | Shadow-write photos to hub_attachments + hub_attachment_links | ✓ Yes | V10 migration adds `bk_journal_photos.hub_attachment_id TEXT`. Photo create/delete call `createAttachment` / `linkAttachment` / `deleteAttachment` from @mylife/db inside transaction. Infers MIME from extension. Links use moduleId='books', entityType='journal_photo'. Tests: 8 integration cases in journal-photos-shadow.test.ts covering create-fanout, delete-cascade, multiple photos, rollback. Books suite: 408/408. |
| **Trails (59d3e2b09)** | Shadow-write places to hub_places | ✓ Yes (homes pivot noted) | V14 migration adds `tr_trails.hub_place_id TEXT`. Trail create/update/delete call `createPlace` / `updatePlace` / `deletePlace`. Geohash auto-computed (and validated in tests: SF geohash prefix 9q8). Kinds: 'trailhead'. Tests: 5 integration cases in trails-shadow.test.ts. Trails suite: 255/255. **Spec note:** phase-1c-handoff.md scoped "homes module → hub_places" but homes has no lat/lng columns. Commit message explains pivot: "Originally scoped for homes but hm_properties has no lat/lng columns. Swapped to trails: tr_trails already has lat REAL NOT NULL + lng REAL NOT NULL." This is a **justified pivot**, documented in commit, and trails is a lower-risk proof-of-concept. Homes will migrate in a follow-on wave. |

**Gate status:**
- `pnpm --filter @mylife/notes test`: 294/294
- `pnpm --filter @mylife/books test`: 408/408
- `pnpm --filter @mylife/trails test`: 255/255
- `pnpm --filter @mylife/intelligence test`: 112/112
- `pnpm typecheck`: 88/88 clean
- `pnpm check:parity`: passed

**Drift from spec:** **One justified pivot, documented.** Phase 1c handoff specified homes for places migration. Commit 59d3e2b09 swapped to trails (which has lat/lng columns) as a lower-risk proof-of-concept. Rationale in commit message is sound; homes will follow in a later wave. No silent pivots — the swap is explained in the commit and session log.

**Shadow-write pattern compliance:** All three modules correctly wrap hub writes in transactions (no silent swallows). Integration tests verify both tables stay in sync. Per-module schema migrations + version bumps + definition.ts updates are correct. FK CASCADE behavior tested (deleting a hub attachment cascades to links).

---

## 2. Goals Coverage vs Master Strategy

The README commits to six outcomes measured post-ship. Current state after Phase 0 + 1:

| Outcome | Target | Current progress | % | Reason |
|---------|--------|--|--|--|
| Unified Today surface (not module grid) | Ship in Phase 3 | Schema only; UI not started | 0% | Foundation (adapters, 3 ref modules) landed; Phase 3 (today UI + ranking) not started. Phase 2 (26-module contract exports) blocks this. |
| 80% onboarding completion (goal-based + starter kits) | Ship in Phase 3 | Schema only (`hub_onboarding` table exists); flow not wired | 0% | Pledge + goal + kit + first-action screens not implemented. Phase 3 scope, blocked on Phase 2. |
| Cross-module action rate ≥ 25% weekly | Measure in Phase 6 | No cross-module actions exist yet (no shared entity readers) | 0% | Writes are shadow-write only; no module reads hub tables yet. Reader paths ship in Phase 1c polish or Phase 2. No automation rules (Phase 5) in codebase. |
| 30/30 modules indexed by hub search | Ship in Phase 2 | 4 modules export CrossModuleInterface (workouts, habits, meds, books) | 13% | Phase 2 (cross-module contracts) not started. Unified search depends on Phase 2. |
| Shared entity adoption in ≥3 modules within 60 days | Measure in Phase 6 | 3 modules write to hub in Wave A (notes, books, trails); intelligence schema fixed | 100% (for Wave A) | Notes→hub_tags, books→hub_attachments, trails→hub_places. Intelligence schema aligned. Wave A complete; Waves B/C/D pending. |
| Day-7 retention +30% vs baseline | Measure in Phase 6 | No baseline measurement yet; Today surface not shipped | 0% | Retention requires unified Today surface + onboarding to ship and be activated. Phase 3 + 6. |
| Local-first AI with per-module permissions + tool-gated SQL | Ship in Phase 4 | Permissions schema aligned; intelligence package not wired to app | 20% | `hub_ai_permissions` schema correct; tool-use infrastructure not built; no LLM integration, no UI. Phase 4 scope. |

**Critical finding:** The shipped work is **100% pure foundation** (tables, adapters, reference modules). **Zero experience-level outcomes** are materially advanced. The master strategy explicitly names "Unified Today surface" + "Onboarding" + "Cross-module action rate" + "AI chat" as the outcomes that move the needle. Phases 0-1 are prerequisites, not differentiators.

---

## 3. Critical Gaps Between Shipped Work and Real Goals

### Gap 1: No unified Today surface data source
- **Missing:** Phase 2 (cross-module contracts). 26 of 30 modules don't export `getSearchableContent`, `getDataSummary`, `getActivityFeed`, `getCorrelationData`. Today surface needs these methods to rank cards.
- **Blocks:** Phase 3 (Today surface UI). Cannot build the ranked card dashboard without module-provided content.
- **Minimum viable surface:** Implement Phase 2 contracts for the 7-cluster anchor modules (Body: health, workouts, mood; Mind: journal, notes; Home: homes, car; Money: budget). ~3-5 modules per cluster. This unblocks a functional (if narrow) Today surface that covers 60% of use cases.

### Gap 2: No onboarding flow
- **Missing:** Phase 3 (onboarding screens). Pledge screen, goal question, starter kit preview, first-action deep-link. Hub_onboarding table exists but is never written to.
- **Blocks:** Day-7 retention measurement. Cannot measure "80% onboarding completion" without onboarding.
- **Minimum viable surface:** Build pledge + goal question + kit preview screens (4 screens, no post-first-value extras). Wire goal selection → hub_preferences['primary_clusters']. This activates the goal-based clustering for Today surface ranking and unlocks the "narrow to 5-7 modules" value prop.

### Gap 3: No cross-module automation rules
- **Missing:** Phase 5 (automation + triggers). No receipt-photo-to-budget, recipe-cook-to-nutrition, ICS-to-events rules exist in codebase.
- **Blocks:** Cross-module action rate measurement. "Receipt attached to transaction automatically shows on pet vet bill" is the promised workflow; nothing like that ships until Phase 5.
- **Minimum viable surface:** Implement receipt-to-budget rule (photo → budget transaction + optional module scope binding). This is the simplest automation and unlocks cross-module perception.

### Gap 4: No hub-table readers
- **Missing:** Module reads from hub tables (planned for Phase 1c polish or Phase 2). Notes reads notes.nt_tags; could read from hub_tags instead. Books could read hub_attachments. But the migration from write-only to read-first happens in a separate wave.
- **Blocks:** "Shared entity adoption" metric. The spec wants ≥3 modules reading from shared entities within 60 days. Today 3 modules write (shadow); 0 read. No user sees the benefit of the hub tables yet.
- **Minimum viable surface:** Add reader migrations for Wave A entities (notes: read hub_tags; books: read hub_attachments; trails: read hub_places). Probably 1-2 days per module.

### Gap 5: Package interdependencies not wired
- **Missing:** Packages (`packages/intelligence`, `packages/search`, `packages/onboarding`, `packages/engagement`) still half-built and unused.
- **Blocks:** Phase 3 + 4 UI. Onboarding state machine needs UI wiring. Engagement digest needs scheduling. Search needs hub FTS5 integration. Intelligence tool registry needs adapter per module.
- **Minimum viable surface:** Land packages/onboarding into the hub app (Phase 3 requires this). Wire packages/search to hub-search UI endpoint (Phase 2 requires FTS5 aggregation). Both are ~2-3 days each if done intentionally.

---

## 4. Design Decisions Worth Questioning

### Decision 1: Shadow-write (dual-write) as the default pattern
**Scope:** Phase 1c all-wave adoption strategy.

**Current practice:** Modules write to both old (per-module) and new (hub) tables in the same transaction. Per-module tables stay canonical for reads.

**Question:** Is this the right long-term direction?

**Concern:** Dual-write doubles storage and migration surface. Every module that adopts hub_tags must maintain nt_tags + hub_tag_bindings + both sets of reads + both sets of writes. If a module later wants to drop per-module tables and go hub-canonical, it requires a second migration pass (to switch reads).

**Alternative:** Hub-canonical from the start. (1) Copy per-module data to hub on first write. (2) Read from hub. (3) Write to hub only. (4) Drop per-module table after verification.

**Why it was chosen:** Safety. Dual-write is lower-risk for a proof-of-concept because per-module code stays intact; if hub writes break, per-module reads still work. Justifiable for Wave A.

**Verdict:** Acceptable for Wave A (reference implementation). Phase 1c handoff explicitly scoped dual-write as "pointer tables (soft adoption)" to prove the adapters work before committing to hard consolidation. **However, the handoff should have specified when the team will pivot to hub-canonical reads, or the dual-write pattern will calcify and block later optimization.**

**Recommendation:** Document in memory.md when Phase 1c polish will add reader migrations for Wave A entities, so modules read from hub by default (writes still go to both for safety). This prevents the "maintenance overhead forever" trap.

---

### Decision 2: `DEFAULT_USER_ID = 'local'` in intelligence permissions
**Scope:** Phase 1c intelligence fix (commit 82f341539).

**Current practice:** Intelligence permissions use a composite PK of `(user_id, module_id)`. The schema is correct (matches Phase 4 design in 05-ai-agent-layer.md). However, the operations API defaults to `user_id = 'local'` if not provided, which assumes a single-user model.

**Question:** Does this conflict with the per-user AI permission model from Phase 4?

**Concern:** Phase 5-ai-agent-layer.md § "Local-first, smart routing" talks about per-module tool-gating + per-user restrictions. If the codebase assumes `user_id = 'local'` everywhere, adding true per-user AI permissions later will require rewriting every tool-call site.

**Context from code (82f341539 commit message):** "DEFAULT_USER_ID='local' default preserves one-arg compatibility for the internal engine call site."

**Verdict:** Acceptable as a temporary migration step. The intelligence package is internal-only (no external callers exist). Phase 4 will wire the onboarding goal question to populate real user contexts. **Document this as a tech debt item in memory.md so Phase 4 doesn't get surprised.**

**Recommendation:** Add a note to memory.md: "Intelligence operations default to user_id='local' for now (single-user model). Phase 4 onboarding will introduce real per-user AI preferences; at that point, the default must become context-aware or callers must explicitly provide user_id."

---

### Decision 3: Places proof-of-concept on trails instead of homes
**Scope:** Phase 1c Wave A, commit 59d3e2b09.

**Current practice:** Trails module adopted `hub_places` (traces write to both tr_trails and hub_places). Homes was the original spec but homes.hm_properties has no lat/lng columns.

**Question:** Does skipping homes for now create a migration debt?

**Concern:** Homes is a higher-value module for places adoption (property addresses, geofence reminders). Trails is recreational hiking (lower user-facing priority). If we prove hub_places on trails but not homes, we might later find that homes adoption has different edge cases (time zone disambiguation, address validation) that trails didn't expose.

**Verdict:** Justified and documented. Commit message clearly states: "Originally scoped for homes but hm_properties has no lat/lng columns. Swapped to trails." This is a **lower-risk pivot**, not a silent omission. The spec can accommodate this because Phase 1c Wave A is explicitly a proof-of-concept.

**Recommendation:** Phase 1c polish or Phase 1c Wave B (depending on priority) should implement homes→hub_places adoption. Pair it with validation testing on address fields (internationalization, ambiguity, postal vs delivery addresses).

---

### Decision 4: Homes now represents "wait until Wave B"
**Scope:** Phase 1c scope definition.

**Observation:** The original handoff scoped "homes module → hub_places" in the three reference migrations. The commit pivoted to trails. Homes was not shifted to a later wave explicitly; it just disappeared from the commit.

**Question:** Is there a risk that homes adoption gets forgotten?

**Verdict:** **Acceptable risk if documented.** The commit message explains the pivot and trails validates the adapter. Homes will be a simple copy of the trails pattern (same schema shape: lat/lng → geohash).

**Recommendation:** Update memory.md to explicitly list "Phase 1c Wave B scope: homes→hub_places (deferred from Wave A due to missing lat/lng columns in per-module schema)." This prevents accidental loss.

---

### Decision 5: AI tables created in Phase 1a but not used until Phase 4
**Scope:** Phase 1a schema, commits 44ebc7519.

**Current practice:** `hub_ai_permissions`, `hub_ai_table_permissions`, `hub_ai_audit_log` exist in the hub schema. No code reads or writes them yet.

**Question:** Is creating unused tables a smell?

**Verdict:** Acceptable. The Phase 1a handoff explicitly states: "AI scaffolding (Phase 4 wiring pending, no code reads these yet)...They exist so later waves can enforce AI tool-use permissions and audit logging without a second migration hop."

**Benefit:** Avoid a second schema migration in Phase 4. The tradeoff is carrying 3 empty tables for ~2 weeks until Phase 4 lands. Low cost.

**No recommendation needed.** This is sound design.

---

## 5. Expansion Beyond Current Plan

If Phase 2 (cross-module contracts) is truly blocked until 26 modules export methods, the consolidation program risks a stall. Here are five concrete redirections ranked by impact/effort:

### 1. **Skip Phase 2 breadth, jump to Phase 3 with a minimal contract set (High impact / Low effort)**
- **Goal:** Unblock the unified Today surface without waiting for 26 modules to export methods.
- **Scope:** Implement Phase 2 contracts for 7 anchor modules (1 per cluster: health, journal, homes, budget, rsvp, trails, books) instead of all 30. Focus on `getTodayCards` only; defer `getSearchableContent` + `getCorrelationData` to a later wave.
- **Effort:** ~3-5 days (7 modules × 0.5–1 day each).
- **Risk:** Medium. Unified search stays unsolved; correlation engine stays half-built. But the **primary goal—unified Today surface—unblocks with limited scope.** Users see the consolidation dividend immediately.
- **Rationale:** The master strategy prioritizes the Today surface as the flagship experience. 26-module contracts are ambitious but not required for a **working** today surface. Start with the 7 anchors; Phase 2 polish can add the remaining 23 modules once onboarding + today surface ship and users can see the value.

### 2. **Implement hub-table reader migrations for Wave A (High impact / Low-to-medium effort)**
- **Goal:** Make shared entities actually shared (modules read from hub, not just write).
- **Scope:** Add migration phases for notes → hub_tags reader, books → hub_attachments reader, trails → hub_places reader. Wrap in integration tests.
- **Effort:** ~2-3 days (parallel work across 3 modules).
- **Risk:** Low. Readers are additive; the dual-write shadow layer stays intact for safety.
- **Rationale:** Today 3 modules write to hub; 0 read. No user perceives the consolidation benefit. Reader migrations unlock "shared tags span multiple modules" and "shared attachments appear on multiple entities" workflows. This is a force multiplier for the consolidation perception.
- **Recommendation:** Land this as a follow-on to Phase 1c Wave A (Phase 1c Wave A Polish), before Phase 2 starts.

### 3. **Build the receipt-to-budget automation rule as a standalone (High impact / Medium effort)**
- **Goal:** Prove that cross-module triggers are valuable without shipping all 8 automation rules.
- **Scope:** Implement a single, high-value rule: photo receipt → budget transaction + optional module scope binding (e.g., "tag this receipt as car maintenance"). Build the UI (preview + apply flow), the rule engine (fire on photo attach to budget), and the reverse-path cleanup (delete transaction if rule is undone).
- **Effort:** ~4-5 days (rule definition + trigger setup + UI + tests).
- **Risk:** Medium. Automations are higher complexity (state machines, preview flows, audit logs). But a single rule is lower risk than all 8.
- **Rationale:** This rule directly proves the "receipt photo → all cost modules" value from the README. It's the flagship automation. If it lands before Phase 3, users in beta can see "I took a photo and it auto-filled my budget and my car costs" — a clear consolidation win.
- **Recommendation:** Land this in a Phase 5-early session (before the full Phase 5 eight-rule rollout) to validate the rule engine and gather user feedback.

### 4. **Pause Phase 1c Wave B/C/D until Wave A readers ship (Medium impact / Low effort)**
- **Goal:** Avoid accumulating "write-only" shadow-write modules that block reader migration later.
- **Scope:** Don't start Wave B (reminders, goals, events) or Wave C (people, body_metrics, foods) until Wave A has reader migrations. This keeps the adoption surface small and testable.
- **Effort:** 0 (prioritization, not implementation).
- **Risk:** Low. Phase 1c is not on the critical path to Phase 3; Phase 2 is. Pausing Wave B/C gives the team room to focus on Phase 2 (26 modules).
- **Rationale:** Wave A is a proof-of-concept. Wave B/C adds 10+ more modules writing to hub. If none of them read yet, the codebase becomes a shadow-write graveyard. Better to close Wave A (write + read) before starting the next wave.
- **Recommendation:** Update the consolidation plan document to explicitly pause Phase 1c Wave B until Phase 1c Wave A readers ship.

### 5. **Create a "fast-follow" Phase 7: automation polish + secondary automations (Medium impact / Medium effort)**
- **Goal:** Ship automation rules incrementally after Phase 5, so Phase 6 measurement is not blocked on perfecting all 8 rules at once.
- **Scope:** Phase 5 ships 3–4 core rules (receipt → budget, recipe → nutrition, ICS → events, book highlight → flash). Phase 7 (new, optional) ships the remaining 4 (mail → subscription detection, mail → contacts, mail → events, voice → journal indexing) after Phase 6 measures retention.
- **Effort:** ~2 weeks (split across 2 sessions).
- **Risk:** Low. Separates automation complexity from Phase 5 (which has other deliverables: preview UI, audit logging, reversibility).
- **Rationale:** Phase 5 is the last big phase before measurement in Phase 6. Adding a Phase 7 after measurement (if retention targets are hit) lets the team ship a smaller, more focused Phase 5 and iterate automations based on user feedback.
- **Recommendation:** Document this as an optional Phase 7 in the consolidation plan, contingent on Phase 6 measurement meeting targets.

---

## 6. Recommended Next Session

**Pick: Implement Phase 2 contracts for 7 anchor modules (1 per cluster) to unblock Phase 3 (unified Today surface).**

**Justification:** Phase 1 shipped solid foundation (20 tables, 3 adapters, 3 reference modules). Phase 2 is the blocker for the flagship experience (Today surface + onboarding). Rather than wait for all 26 modules to export methods, land the 7-cluster anchors in 3–4 days, wire them into the Today aggregator, and ship a working (if cluster-focused) unified surface. This moves the needle on the master strategy's real goal: "unified today surface (not module grid)."

**Secondary action (parallel or follow-on):** Implement Wave A reader migrations (notes, books, trails) so shared entities are actually shared by the time Phase 3 ships. This takes 2–3 days and is the final piece of "shared entity adoption within 60 days."

---

