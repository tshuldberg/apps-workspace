# Feature Spec: [FEATURE_NAME]

## Metadata
- **Module:** [module name, e.g., "workouts"]
- **Priority Score:** [score] / 50 ([S/A/B/C/D]-Tier)
- **Scoring Breakdown:** Market [X] x3 + Switching [X] x3 + Complexity [X] x2 + CrossModule [X] x1 + PaidUser [X] x1
- **Sprint:** [Sprint number]
- **Estimated CC Time:** [time]
- **Depends On:** [other features or specs, or "none"]
- **Blocks:** [features that depend on this, or "none"]

## Business Context

### Why This Feature Exists
[2-3 sentences explaining the business rationale. What user need does this serve? Why now?]

### Competitor Landscape
[Which competitors have this feature? What do they charge? How many paid users use it?]

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| [Name] | Yes/No | Yes/No | [Brief description] |

### Target User
[Who specifically benefits? "YNAB users paying $109/yr who want envelope budgeting with less friction." Be specific about the migration path.]

## Technical Context

### Where This Lives in MyLife
[Exact file paths that will be created or modified. Be specific.]

```
modules/[name]/src/           -- Business logic
apps/mobile/app/([name])/     -- Mobile screens
apps/web/app/[name]/          -- Web pages
```

### Wireframe Position
[Describe where in the app this feature appears. Which screen? Which tab? What does the user tap/click to reach it?]

```
Hub Dashboard
  └── [Module Name] card
       └── [Tab Name]
            └── [This Feature] ← YOU ARE HERE
```

### Data Model
[New tables, columns, or schema changes required. Include table prefix.]

```sql
-- Example:
CREATE TABLE IF NOT EXISTS [prefix]_[table_name] (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- columns...
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** [Which MyLife packages or modules does this depend on?]
- **External:** [Any external APIs, libraries, or services needed?]
- **Cross-Module:** [Does this feature interact with other modules? How?]

## Functional Requirements

### User Stories
1. As a [user type], I want to [action] so that [benefit].
2. [Additional stories as needed]

### Behavior Specification
[Step-by-step description of how the feature works. Include every interaction, every state change, every screen transition.]

1. User navigates to [screen]
2. User taps [button/element]
3. System [does X]
4. User sees [result]
5. [Continue for all paths]

### Edge Cases
[List every edge case explicitly. Don't skip "obvious" ones.]

- What happens with empty/nil input?
- What happens with extremely large input?
- What happens if the user navigates away mid-action?
- What happens on slow/no network? (if applicable)
- What happens if the module is disabled mid-use?
- [Feature-specific edge cases]

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** [User action] results in [expected visible outcome]
- [ ] **AC-2:** [User action] results in [expected visible outcome]
- [ ] **AC-3:** [User action] results in [expected visible outcome]
- [ ] [Add as many as needed -- no cap. Every interaction point needs a criterion.]

### Technical Criteria
- [ ] **TC-1:** [Data is persisted/retrieved correctly in specific scenario]
- [ ] **TC-2:** [Error state is handled gracefully with user-visible feedback]
- [ ] **TC-3:** [Performance target met: e.g., "search returns results in <200ms"]
- [ ] [Add as many as needed]

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** [This feature must NOT affect/break X]
- [ ] **NC-2:** [This data must NOT be accessible to Y]

## UI Specification

### Mobile (Expo)
[Describe the mobile UI. Reference Cool Obsidian design system tokens.]

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `[module accent color from definition.ts]`
- [Layout description, component hierarchy]

### Web (Next.js)
[Describe the web UI. Reference the same design system but note web-specific patterns.]

- Same tokens via CSS variables in `globals.css`
- Sidebar navigation: feature accessible via [route]
- [Layout differences from mobile, if any]

### State Coverage
[Every state this UI can be in. Every one needs a visual design.]

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | [Skeleton/spinner description] | Initial data fetch |
| Empty | [Empty state message + CTA] | No data yet |
| Error | [Error message + retry action] | Fetch/operation fails |
| Success | [Normal content] | Data loaded |
| Partial | [Some content + loading indicators] | Slow load or mixed results |

## Test Requirements

### Unit Tests
- [ ] [Specific function]: handles valid input
- [ ] [Specific function]: handles nil/empty input
- [ ] [Specific function]: handles boundary values
- [ ] [Add all needed]

### Integration Tests
- [ ] Full flow: [user action] -> [data persisted] -> [UI updated]
- [ ] Error flow: [failure scenario] -> [graceful degradation] -> [user feedback]

### QA Verification Script
[Step-by-step instructions a human QA tester follows to verify this feature. Written as a test script.]

1. Open the app on [platform]
2. Navigate to [screen]
3. Tap [element]
4. Verify: [expected outcome] -- corresponds to AC-1
5. [Continue for all acceptance criteria]

## gstack Quality Gates

Based on this feature's complexity score, these gstack skills are REQUIRED before the feature can be marked done:

<!-- Fill in based on Complexity Inverse score from Metadata -->

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
[What is the current state of this area of the codebase? What exists? What's broken?]

### After This Work
[What should be true when this feature is complete? What files were created/modified?]

### Files Changed
[List every file that was created or modified, with a one-line description of what changed]

- `modules/[name]/src/[file].ts` -- [what changed]
- `apps/mobile/app/([name])/[screen].tsx` -- [what changed]
- `apps/web/app/[name]/[page].tsx` -- [what changed]

### Known Limitations
[Anything this implementation intentionally does NOT do, that a future feature might address]

### Context for Next Agent
[If another agent will build on this work, what do they need to know? What gotchas should they watch for?]
