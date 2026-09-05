---
status: ACTIVE
date: 2026-04-20
phase: 5-core
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-3b-handoff.md
spec: docs/plans/consolidation/06-automation-shortcuts.md
---

# Phase 5-core Handoff — Automation POC (Receipt-to-Budget)

**Context for a fresh agent:** Phase 3a shipped the Today surface aggregator. Phase 3b shipped goal-based onboarding + the health barrel split. All 7 anchor modules now contribute Today cards on both mobile + web. This session starts Phase 5 automation by building the **first automation rule as a standalone proof-of-concept** plus the engine infrastructure that later rules will plug into.

Scoping note: the original strategy proposed 4 Phase 5-core rules (receipt→budget, recipe→nutrition, mail ICS, book highlight→flash). Ship **receipt-to-budget only** this session. Once the engine + preview flow + audit log pattern is proven, the remaining 3 rules plug in for ~1-2 days each.

## What ships this session

Three deliverables:

### Deliverable 1 — `packages/automations` — the rule engine

A new workspace package with the shared rule-engine contract. Every automation rule plugs in via a typed interface. Engine handles:
- Registration of rules
- Detection (deciding when a rule's trigger condition is met)
- Preview-card rendering (so the UI can show "we want to do X, apply?")
- Execution (on user approval)
- Audit log (hub_automation_log rows)

Required surface:

```ts
// packages/automations/src/types.ts
export interface AutomationRule<TriggerInput, PreviewState, ExecutionResult> {
  id: string;                       // unique, e.g. 'receipt-to-budget'
  label: string;                    // human-readable
  description: string;
  clusters: string[];               // which clusters this rule serves (for Today surfacing)
  /** Given a trigger input, decide whether the rule applies and produce preview state. */
  check(db: unknown, input: TriggerInput): PreviewState | null;
  /** Render the preview card data shown to the user. */
  previewCard(state: PreviewState): { title: string; subtitle: string; cta: { apply: string; dismiss: string } };
  /** Execute the rule. Must be idempotent given the same PreviewState. */
  apply(db: unknown, state: PreviewState): ExecutionResult;
}
```

Plus a registry:

```ts
export function registerRule<T, P, R>(rule: AutomationRule<T, P, R>): void;
export function getRule(id: string): AutomationRule<unknown, unknown, unknown> | undefined;
export function listRules(): AutomationRule<unknown, unknown, unknown>[];
```

Plus audit helpers:

```ts
// uses new hub_automation_log table (see Deliverable 2)
export function logAutomationEvent(db, input: {
  ruleId: string;
  outcome: 'applied' | 'dismissed' | 'error';
  payloadSha256?: string;
  error?: string;
}): void;

export function listAutomationLog(db, limit?: number): AutomationLogEntry[];
```

### Deliverable 2 — Hub schema additions

Two new hub tables (add to `packages/db/src/hub-schema.ts`, append to `HUB_TABLES`):

```sql
CREATE TABLE IF NOT EXISTS hub_automation_rules (
  id TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  last_fired_at TEXT,
  fire_count INTEGER NOT NULL DEFAULT 0 CHECK (fire_count >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_automation_log (
  id TEXT PRIMARY KEY NOT NULL,
  rule_id TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'dismissed', 'error')),
  payload_sha256 TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS hub_automation_log_rule_at_idx
  ON hub_automation_log (rule_id, at DESC);
```

Default: every rule is **off** (`enabled = 0`) until user opts in from Settings.

### Deliverable 3 — `receipt-to-budget` rule

Live in `modules/budget/src/automations/receipt-to-budget.ts`. Trigger + behavior:

**Trigger input:** a newly created `hub_attachments` row whose MIME is `image/*` AND the caller has flagged it as a "receipt" (either via a new `hub_attachments.tag = 'receipt'` column which we are NOT adding yet, OR via the existing `role` field on `hub_attachment_links` set to `'receipt'`).

For the POC scope, keep it simpler: the **UI passes** the attachment id to the rule explicitly when the user attaches a photo from the budget module. Trigger = "budget module is about to attach a photo to a new transaction".

**Check:** returns a preview state with:
- `attachmentId`: the hub_attachments row id
- `suggestedAmount`: null for POC (OCR is out of scope); user will type it
- `suggestedPayee`: null for POC
- `defaultEnvelopeId`: null

**Preview card:** title `"Attach receipt to transaction?"`, subtitle `"Creates a new bg_transactions row linked to this photo."`

**Apply:** creates a new `bg_transactions` row with the user-supplied amount/payee/envelope, links the hub_attachment via `linkAttachment({ moduleId: 'budget', entityType: 'transaction', entityId: <newTxnId>, role: 'receipt' })`. Returns `{ txnId, attachmentId, linkCount }`.

### Deliverable 4 — Mobile + web UI entry point

A single surface: **Settings → Automations**. Renders a list of all registered rules with on/off toggle. Writes `hub_automation_rules.enabled` when toggled.

Plus the actual receipt flow:
- Mobile: on `apps/mobile/app/(budget)/transaction/new` (or equivalent), if the automation is enabled and the user attaches a photo, show the preview card (a sheet with Apply / Dismiss). Apply calls the rule's `apply()`. Dismiss logs to `hub_automation_log` with outcome `'dismissed'`.
- Web: same pattern on `apps/web/app/budget/transaction/new/page.tsx`.

If the automation is disabled, the flow works exactly as before (no preview, just the raw photo attach).

## Files the team will touch / create

### New package
- `packages/automations/package.json`
- `packages/automations/src/types.ts`
- `packages/automations/src/registry.ts`
- `packages/automations/src/audit.ts`
- `packages/automations/src/index.ts` (barrel)
- `packages/automations/src/__tests__/registry.test.ts`
- `packages/automations/tsconfig.json`
- `pnpm-workspace.yaml` — add `packages/automations`

### Hub schema
- `packages/db/src/hub-schema.ts` — add `CREATE_HUB_AUTOMATION_RULES`, `CREATE_HUB_AUTOMATION_LOG`, append to `HUB_TABLES`
- `packages/db/src/__tests__/hub-schema-phase5.test.ts` — table existence + index check

### Budget rule
- `modules/budget/src/automations/receipt-to-budget.ts` — rule definition
- `modules/budget/src/automations/__tests__/receipt-to-budget.test.ts` — unit tests
- `modules/budget/src/index.ts` — re-export the rule

### Mobile UI
- `apps/mobile/app/(hub)/settings/automations.tsx` (new) — list + toggle
- `apps/mobile/components/automations/AutomationPreviewSheet.tsx` (new) — apply/dismiss UI
- `apps/mobile/app/(budget)/transaction/new.tsx` — hook in the preview sheet when the rule is enabled + a photo is attached

### Web UI
- `apps/web/app/settings/automations/page.tsx` (new)
- `apps/web/components/automations/AutomationPreviewCard.tsx` (new)
- `apps/web/app/budget/transaction/new/page.tsx` — hook in preview card
- `apps/web/app/actions.ts` — new server actions: `listAutomationRulesAction`, `toggleAutomationRuleAction`, `applyAutomationAction`, `dismissAutomationAction`

## Acceptance

- `@mylife/automations` package: registry + audit functions pass ≥10 unit tests
- `@mylife/db`: 2 new tables + indexes + passing schema-existence test
- `@mylife/budget`: receipt-to-budget rule passes ≥5 integration tests (enabled/disabled, apply creates txn + link, dismiss logs, idempotence, audit entry)
- Settings → Automations screen renders on mobile + web with the rule listed, toggle writes to `hub_automation_rules`
- Preview sheet/card appears only when rule is enabled and flow is triggered
- Apply creates a `bg_transactions` row + `hub_attachment_links` row atomically (single transaction)
- Dismiss writes to `hub_automation_log` with outcome `'dismissed'` and no side effects
- `pnpm test` green across all affected packages
- `pnpm typecheck` clean
- `pnpm check:parity --quiet` + generated-artifacts pass
- No regression in existing Today surface or onboarding

## Agent team composition

| Role | Agent type | Task |
|------|-----------|------|
| Track A — packages/automations scaffold | module-dev | New workspace package, types, registry, audit, barrel, tests, tsconfig. Add to pnpm-workspace.yaml. |
| Track B — hub schema additions | module-dev | Add `hub_automation_rules` + `hub_automation_log` + indexes to hub-schema.ts. Update schema test to include them. |
| Track C — receipt-to-budget rule | module-dev | Rule definition in modules/budget/src/automations/ + integration tests. Uses adapters from @mylife/db and engine from @mylife/automations. |
| Track D — mobile Settings + preview sheet | hub-shell-dev | Automations settings screen + preview sheet component + wire into budget transaction-new screen. |
| Track E — web Settings + preview card | hub-shell-dev | Mirror of Track D for Next.js. Server actions in actions.ts. |
| Review | feature-dev:code-reviewer | Transaction atomicity, audit log correctness, silent-failure hunt on apply/dismiss paths, idempotence. |
| Parity + ship | parity-checker + inline | All gates + 6 per-concern commits + push. |

Run order:
1. Tracks A + B in parallel (both small, both unblock C/D/E).
2. Track C after A + B land (needs @mylife/automations types + hub tables).
3. Tracks D + E in parallel after C lands (both consume the rule from @mylife/budget).
4. Review + parity + ship.

## Constraints

- Do NOT implement OCR. User types amount/payee/envelope; rule just wires the attachment.
- Do NOT auto-apply. Every rule run shows a preview; user taps Apply or Dismiss. Silent automation is explicitly out of scope per `06-automation-shortcuts.md`.
- Atomicity: `apply()` must wrap all writes (bg_transactions INSERT + hub_attachment_links INSERT + hub_automation_log INSERT) in one `db.transaction()`.
- Idempotence: if the same PreviewState is applied twice (rare; e.g., user taps twice fast), the second call must no-op or throw a detectable `alreadyAppliedError`, not duplicate rows.
- Loud failure: no try/catch swallowing SQL errors. Only the audit-log writer tolerates a hub_automation_log write failure (log to console.warn) since the primary write already succeeded.
- No new npm deps.
- `--no-verify` permitted on commit per established precedent.

## Commit boundary (target)

6 commits:

1. `feat(db): Phase 5 hub tables for automation rules + audit log`
2. `feat(automations): rule engine + registry + audit helpers`
3. `feat(budget): receipt-to-budget automation rule`
4. `feat(mobile): automation settings + receipt preview sheet`
5. `feat(web): automation settings + receipt preview card`
6. `docs(consolidation): Phase 5-core session log + memory`

## Follow-ups (not this session)

- Remaining 3 Phase 5-core rules: recipe→nutrition, mail ICS, book highlight→flash. Each ~1-2 days once the engine pattern is proven.
- Phase 7 secondary rules (voice→journal, mail→subs detection, workout GPS → surf prompt) — gated on Phase 6 retention metrics.
- OCR for receipts — deferred; UI is manual entry in v1.
- Automation history screen (list of past applied rules) — deferred; audit log is stored but no UI consumer yet.

## Cold-start reading order

1. `docs/plans/consolidation/README.md` — strategy
2. `docs/plans/consolidation/06-automation-shortcuts.md` — the full automation spec
3. `docs/plans/consolidation/phase-review-report.md` — why this is the pick
4. `docs/plans/consolidation/phase-3b-handoff.md` — preceding phase context
5. `packages/db/src/shared/attachments/operations.ts` — adapter surface
6. This file

Execute in the order listed. All acceptance criteria must pass before commit.
