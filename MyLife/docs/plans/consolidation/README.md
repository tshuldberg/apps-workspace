---
status: PROPOSAL
author: Claude (research synthesis across 4 parallel agents)
date: 2026-04-19
decisions:
  ai_layer: local-first with smart routing (Apple FM / ExecuTorch / WebLLM + BYOK cloud fallback)
  onboarding: goal-based + starter kits
  expansion: paused until consolidation ships
supersedes: partial overlap with docs/designs/full-product-strategic-review.md (implements its accepted scope)
branch: main
---

# MyLife Consolidation Proposal

**Thesis:** MyLife has 30 high-quality modules and a half-built consolidation layer. The strategic review already approved `packages/intelligence`, `packages/search`, `packages/onboarding`, `packages/engagement`, and per-module AI permissions. The audit reveals all four packages exist at 30-70% completeness but are not wired into the app. Users today see a module grid, not a unified life surface. The work is not to build new modules but to finish the spine that ties the 30 modules into one product.

Pause expansion (29 → 44+). Finish the spine. Then resume.

## What this proposal contains

| File | Purpose |
|------|---------|
| `README.md` (this) | Executive summary, strategy, phased sequence, success metrics |
| `01-shared-data-layer.md` | Hub tables for people, tags, attachments, goals, reminders, body metrics, costs, events, foods, places, books. SQL schemas, migration risk. |
| `02-cross-module-contracts.md` | Finish `CrossModuleInterface` exports for the 26 modules that lack them. Brings unified search, activity feed, correlation analytics to full coverage. |
| `03-unified-today-surface.md` | Replace the module-grid dashboard with a ranked Today surface (Apple Health + Oura + WHOOP shape). Module grid moves to a second tab. |
| `04-onboarding-goal-based.md` | Goal question → starter kit → 90-second first-value → import wizard → pledge → AI prefs. Uses existing `packages/onboarding` state machine. |
| `05-ai-agent-layer.md` | Wire `packages/intelligence` into the app. Local-first: Apple Foundation Models on iOS 26+, ExecuTorch on Android/older iOS, WebLLM on web; Vercel AI SDK v6 for BYOK cloud. Tool-gated SQLite access, per-module permissions, sqlite-vec RAG. |
| `06-automation-shortcuts.md` | Manual-reversible automations only. Cross-module triggers (receipt photo → all cost modules, recipe cook → nutrition + pantry, mail ICS → hub_events). Apple Shortcuts + on-device rules engine. |
| `07-sequence-and-gates.md` | 6-phase delivery order, gates, rollback plan, parity checks. |

---

## Strategic framing

### The real problem

Today's hub is 30 apps in a trenchcoat. Three symptoms:

1. **No unified today surface.** `apps/mobile/app/(hub)/index.tsx` renders a module grid with quick actions. Web `page.tsx` aggregates summaries but shows no cross-module insight. Competitors with 10+ feature areas (Apple Health, Oura, WHOOP, Sunsama, Notion) all converge on a single ranked Today view. Grid goes on a second tab.
2. **Data silos.** Only 4 of 30 modules (`books`, `habits`, `meds`, `workouts`) export the `CrossModuleInterface` methods. The other 26 are unsearchable, absent from the activity feed, and invisible to correlation analytics. The contract exists. The implementations are missing.
3. **The intelligence layer is a closed circuit.** `packages/intelligence` has correlation engine, permissions, LLM adapter (Claude + OpenAI). Zero screens call it. No user can ask "is my mood up on days I fast?" — even though the math is built.

### The consolidation dividend

One set of shared entities unlocks disproportionate workflow value:

- **`hub_attachments`** deduplicates 16+ per-module photo/document tables. Receipt photo attached once appears on budget transaction, car fuel log, homes cost entry, pets vet bill, and RSVP event expense. One photo-picker screen across life.
- **`hub_tags`** replaces 10+ hand-rolled tag tables. `#anxiety` spans journal, mood, meds symptoms. `#mexico` spans trails, closet packing, recipes, photos.
- **`hub_reminders`** unifies meds reminders, habit reminders, cycle appointments, car maintenance, pet feeding, garden watering, RSVP events into one notification inbox with conflict detection.
- **`hub_body_metrics`** gives one weight timeline across fast / workouts / health / pets; one BP/glucose feed across meds / health; one HealthKit sync point.
- **`hub_foods`** means cooking a recipe auto-logs nutrition and decrements pantry; a single barcode cache.
- **`hub_people`** replaces 11 per-module contact tables so the contact you split dinner with on budget can also be invited on RSVP and seen on mail.

These are not marketing-level claims. They are direct database consolidations that remove duplicate work from every module that writes them today.

### The AI layer (decision: local-first with smart routing)

Apple Foundation Models (iOS 26+) ships a ~3B model with zero download, fast Neural-Engine inference, 4096-token context, and native tool calling via `@Generable` / `Tool`. On iOS 26+ it is the right default. Below that and on Android: React Native ExecuTorch with Llama 3.2 1B Q4 (≈90MB embedding + ≈700MB model, 10-20 tok/s on flagship). Web: WebLLM with the same model over WebGPU. Cloud fallback: Vercel AI SDK v6 with user-provided Claude/OpenAI/Gemini keys, gated behind explicit per-module opt-in from `hub_ai_permissions` (table already exists).

Tool surface: `sqlReadTool` and `sqlWriteTool` gated by module prefix whitelist and the existing permissions table, plus a registry of module-specific action tools (`createReminder`, `logMood`, `addTransaction`). RAG via sqlite-vec (through `op-sqlite` on mobile, `better-sqlite3` on web) with Apple `NLContextualEmbedding` / MiniLM / Transformers.js embeddings depending on platform.

Hard rule: AI is additive. Every flow ships a non-AI path. AI off by default. User opts in per module. Cloud off unless user supplies a key.

---

## The seven workflow clusters

The 30 modules group into seven natural clusters. Each anchors on one or two shared entities and gets one "daily one-tap action" surfaced on the Today tab.

| # | Cluster | Modules | Anchor shared entity | Daily one-tap |
|---|---------|---------|----------------------|----------------|
| 1 | Body | health, workouts, nutrition, fast, cycle, meds, mood | body_metrics + log_events | Log morning (weight + BP + mood + cycle day) |
| 2 | Mind | journal, notes, mood, voice, books, flash, words | tags + attachments (voice) | Reflect (voice or text, tagged) |
| 3 | Home | homes, car, garden, pets, closet | reminders + costs + attachments | Maintenance today (due services) |
| 4 | Money | budget, subs, market, (recipes, homes, car, pets, rsvp) | costs | Quick expense (amount + photo + module) |
| 5 | Social | rsvp, forums, presence, mail, (books clubs, surf crews, market) | people | Who next? (birthdays, check-ins, RSVPs) |
| 6 | Outdoor | surf, trails, stars, garden, (workouts GPS, car trips) | places + weather cache | Conditions (weather + forecast + moon at saved places) |
| 7 | Knowledge | books, flash, words, notes, habits | tags + books | Review (SRS queue + reading streak + note prompt) |

Clusters are not containers. They are recommendation dimensions: the onboarding goal question selects a cluster, the Today surface ranks cards by cluster affinity, and the AI agent uses cluster as a scope hint.

---

## Phased delivery sequence

> **Post-review pivot (2026-04-20):** The independent review at `phase-review-report.md` found Phases 0+1 shipped solid foundation but moved zero experience-level needles. Sequence rescoped: Phase 2 splits into anchor-first (2a) + broad coverage (2b); Phase 1c Waves B/C/D are paused until Wave A readers ship; Phase 5 splits into core (3-4 highest-value rules) + an optional Phase 7 fast-follow contingent on Phase 6 metrics. See `phase-review-report.md` for the full rationale.

Six (now seven, with optional Phase 7) phases, each landable on its own. Later phases depend on earlier ones. Typical phase is 1-2 weeks with 1-2 engineers.

### Phase 0 — Unblock fresh installs (3 days)

From the existing audit (carried forward from `docs/designs/full-product-strategic-review.md` critical gaps):

- Fix `habits` V2 migration (`period_id` reference blocks fresh installs)
- Fix `garden` migration (`status` column reference)
- Wire SQLite backup mechanism end-to-end (schema exists, UI gap)
- Re-flip `react-hooks/rules-of-hooks` to `error` after cleaning 7 pre-existing violations

### Phase 1 — Shared data layer (2 weeks)

Adds 11 hub tables and their migrations. See `01-shared-data-layer.md`.

1. `hub_attachments` + `hub_attachment_links` (lowest risk, highest reuse)
2. `hub_tags` + `hub_tag_bindings`
3. `hub_reminders` (unifies 10 modules' reminder schedulers)
4. `hub_goals` + `hub_goal_progress`
5. `hub_people` + `hub_person_module_roles` (replaces 11 contact tables)
6. `hub_body_metrics`, `hub_cost_events`, `hub_events`, `hub_places`, `hub_gps_tracks`, `hub_foods`, `hub_books`, `hub_timeline`

Migration risk hot-spots (see `01-shared-data-layer.md`): budget↔subs↔pets/car/homes costs reconciliation, meds super-module consolidation, habits super-module (ownership conflicts with cycle, reminders, mood). These get phased gradual adoption, not a flag-day rewrite.

### Phase 2 — Cross-module contracts (anchor-first, then broad)

Rescoped after the 2026-04-20 review:

- **Phase 2a (~1 week):** 7 cluster-anchor modules (`health`, `journal`, `homes`, `budget`, `rsvp`, `trails`, `books`) implement `getTodayCards` only. This unblocks Phase 3's unified Today surface without waiting for full-coverage contracts. Phase 1c Wave A reader polish (notes/books/trails) ships alongside or just before this.
- **Phase 2b (~2 weeks):** Remaining 23 modules export `getTodayCards` + `getSearchableContent` + `getDataSummary` + `getActivityFeed` + `getCorrelationData`. Restores the original Phase 2 ambition: unified search across all 30 modules, full digest coverage, and complete correlation series. Phase 1c Waves B/C/D resume once Phase 1c Wave A readers land, and feed Phase 2b adoption.

See `02-cross-module-contracts.md` for the full contract surface.

### Phase 3 — Unified Today surface + onboarding (2 weeks)

Two parallel workstreams with shared polish week:

**3a. Today surface.** Replace `apps/mobile/app/(hub)/index.tsx` and `apps/web/app/page.tsx` with a ranked card list. Cards sourced from cross-module contract methods. Hard cap 5-7 visible at a time. Per-cluster one-tap actions. Module grid moves to second tab. See `03-unified-today-surface.md`.

**3b. Onboarding.** Render the pledge screen from `docs/designs/DESIGN-pledge-onboarding.md`. Add goal question → starter-kit step. Wire the existing import wizard (Goodreads, Day One, YNAB, MyFitnessPal already built). Finish AI preferences screen and biometric consent. See `04-onboarding-goal-based.md`.

Starter kits:

| Kit | Pre-enabled modules |
|-----|---------------------|
| Body Kit | health, workouts, nutrition, fast, mood, cycle, meds |
| Money Kit | budget, subs, market |
| Home Kit | homes, car, garden, pets, closet |
| Reader Kit | books, words, flash, notes, journal |
| Parent Kit | pets, rsvp, recipes, budget, notes |
| Outdoor Kit | trails, surf, stars, garden |
| Everything Lite | 5 free modules: fast, journal, mood, notes, voice |

### Phase 4 — AI agent layer (3 weeks)

Wire `packages/intelligence` into UI across mobile + web. Three deliverables:

1. **Insights page**: `queryCorrelation()` picker (metric A × metric B), `queryTrends()` charts, `discoverInsights()` card deck. No LLM required.
2. **Chat surface**: natural-language interface with tool calling. Local by default (Apple FM / ExecuTorch / WebLLM), cloud opt-in (BYOK). Per-module permission gates enforce what the agent can see and do.
3. **Embeddings + RAG**: sqlite-vec index over enabled modules. `embed()` on write; cosine search on query. `hub_embeddings` table with BLOB `vec0` column.

See `05-ai-agent-layer.md` for the concrete `packages/intelligence` expansion (adapter pattern for providers, tool registry, key store, router policy).

### Phase 5-core — Highest-value automation rules (2 weeks)

Manual-reversible only. See `06-automation-shortcuts.md`. Phase 5 ships the four highest-value rules; the remaining four become an optional Phase 7 fast-follow gated on Phase 6 metrics.

Phase 5-core rules:

- Receipt photo → budget transaction + optional module tag (car / homes / pets / rsvp / closet)
- Recipe cook → nutrition log + pantry decrement + shopping-list regenerate
- Mail ICS attachment → hub_events → surfaces on cycle / meds / rsvp
- Book highlight → saved_words + flash card deck proposal

Plus Apple Shortcuts actions (iOS) and Share-Sheet handlers. All rules preview before running; never auto-spend, never auto-message.

### Phase 6 — Polish, measurement, resume expansion (1 week)

- Measure: activation rate from onboarding → first entry, day-7 retention, cross-module action rate, AI opt-in rate
- Gate: resume `DESIGN-module-expansion-29-to-44.md` only if day-7 retention ≥ baseline
- Gate: ship Phase 7 only if Phase 6 retention + cross-module action targets are hit
- Archive: update `memory.md` + session logs; tag release

### Phase 7 — Secondary automations (optional, ~2 weeks)

Ships only if Phase 6 metrics meet targets. Remaining automation rules:

- Budget detect-sub → confirm → update subs module (resolves the subs-vs-budget ownership conflict)
- Voice note → transcript indexed by journal + notes (single source, many readers)
- Workout GPS ending at saved surf spot → prompt to log surf session
- Mail-driven contact / subscription / event detection (mail → people / subs / hub_events)

---

## Success metrics (track weekly post-ship)

| Metric | Target | Why |
|--------|--------|-----|
| Day-7 retention | +30% vs pre-consolidation baseline | Today surface + ritual should move this |
| % users completing onboarding | ≥ 80% | Goal-based narrowing should beat the guided-tour pattern |
| Cross-module action rate | ≥ 25% of users perform ≥ 1 cross-module action per week | Receipt-to-many-modules, recipe-to-nutrition, etc. |
| AI opt-in (any module) | 20-40% (conservative) | Privacy posture means most users stay off |
| Shared entity adoption | `hub_attachments` ≥ 3 module writers within 60 days | Dogfood signal |
| Hub search result coverage | 30 / 30 modules indexed | Phase 2 completion |

---

## Risks and mitigations

**R1 — Schema migration risk (budget/meds/habits super-modules).** Biggest single risk. Use pointer tables (`hub_cost_events`, `hub_timeline`) that index per-module data rather than replacing it where semantics diverge. Per-module tables stay canonical. Shared tables are views + denormalized indexes for the first pass. Hard consolidations (people, tags, attachments, reminders) happen only after compatibility adapters are proven.

**R2 — AI UX quality on 1B-class local models.** Llama 3.2 1B and Gemma 3 1B are not GPT-4-class. Mitigate: scope the agent to small, well-specified tasks (answer from your data, schedule a reminder, tag this note). Use FunctionGemma 270M as a cheap intent router. Fall back silently to non-AI UI if generation fails.

**R3 — Onboarding bounce on too-clever flow.** If the pledge + goal + kit + import + AI screens compound to 6 steps, users drop. Hard cap: 4 screens before first real action (pledge → goal → kit auto-applied → first log). Import, AI prefs, and biometric consent are post-first-value screens you can opt into.

**R4 — Expansion drift.** The approved `DESIGN-module-expansion-29-to-44.md` has momentum. Active decision: pause until Phase 5 ships. Re-scope in Phase 6.

**R5 — Module teams already overloaded.** Phase 1 shared-data work needs coordinated edits across 10+ modules. Use Agent Teams (file ownership zones in `CLAUDE.md`) and parity-checker to prevent drift.

---

## What already exists and can be reused

Don't rebuild these:

- `packages/module-registry/src/cross-module-types.ts` — contract definitions (types complete)
- `packages/intelligence/src/{engine,llm,permissions,analytics}/` — 60% built, needs adapters + UI
- `packages/search/src/{schema,indexer,query}/` — FTS5 + LRU cache, web wired, mobile stub
- `packages/onboarding/src/{state-machine,import/}` — flow logic + 4 importers built
- `packages/engagement/src/digest.ts` — digest aggregator, needs scheduling + UI
- `hub_ai_permissions` + `hub_ai_table_permissions` tables — already exist, enforce them in router
- Existing module cross-module.ts files (`books`, `habits`, `meds`, `workouts`) — copy as reference for the 26 TODO modules

---

## Decisions (resolved 2026-04-19)

1. **Weekly digest delivery:** all three channels (in-app, push, email), each independently toggled in `Settings > Notifications > Weekly digest`. All off by default. See `06-automation-shortcuts.md`.
2. **Biometric gate for AI actions:** Option B default (biometric required on money / scheduled / outbound writes; not required on local writes or reads) plus a configurable drawer at `Settings > AI > Require Face ID for:` so users can tighten to "all writes" or loosen to "outbound only". See `05-ai-agent-layer.md`.
3. **Starter-kit customizability:** during onboarding. Kit Preview screen shows the selected kit's module list with add/remove toggles before apply. See `04-onboarding-goal-based.md`.

---

## Not in scope for this round

- Module expansion beyond 30 (paused)
- Cloud-backed social features beyond what `packages/social` already does
- Desktop / macOS build
- Wearable companion
- New language support
