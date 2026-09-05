# Feature Spec: ML Auto-Categorization

## Metadata
- **Module:** budget
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 3+
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (transaction rules and payee cache already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Manual categorization is the biggest time sink in budgeting. Monarch Money, Copilot, and Rocket Money all use ML to auto-assign categories based on merchant name patterns and user behavior. MyLife already has a rule-based system (bg_transaction_rules with pattern matching) and a payee cache (bg_payee_cache with last-used envelope), but these are deterministic and require manual rule setup. ML auto-categorization learns from the user's own transaction history to suggest envelope assignments with increasing accuracy over time. This is a key "it just works" feature that reduces friction from "5 minutes to categorize 20 transactions" to "confirm 20 auto-suggestions in 30 seconds."

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Monarch Money | Yes | Yes ($99.99/yr) | ML categorization trained on aggregate user data (cloud). High accuracy for common merchants. |
| Copilot | Yes | Yes ($119.88/yr) | "Smart Categories" -- learns from user corrections. Cloud-based ML. |
| Rocket Money | Yes | Yes ($48-144/yr) | Auto-categorization with user override learning. Cloud-based. |
| YNAB | No | N/A | No ML. Manual categorization only. Payee-to-category memory (similar to our payee cache). |
| PocketGuard | Partial | Yes ($74.99/yr) | Basic merchant-to-category mapping. Not true ML. |

### Target User
Any budget user who wants less manual work. Especially YNAB users who are tired of categorizing every transaction manually. Migration path: Monarch user who values "it just works" categorization but wants privacy-first (on-device, not cloud ML) at $5/yr.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  categorizer/
    categorizer-engine.ts        -- NEW: On-device ML categorization engine
    training.ts                  -- NEW: Build training data from user's transaction history
    merchant-normalizer.ts       -- NEW: Normalize merchant strings for better matching
    types.ts                     -- NEW: Prediction, TrainingData, ModelState types
    index.ts                     -- NEW: Barrel export
  db/
    schema.ts                    -- MODIFY: V6 migration adds bg_categorization_feedback
    crud.ts                      -- MODIFY: Add feedback CRUD
  types.ts                       -- MODIFY: Add categorization-related schemas
  definition.ts                  -- MODIFY: V6 migration
  index.ts                       -- MODIFY: Export categorization types
apps/mobile/app/(budget)/
  components/
    CategorySuggestion.tsx       -- NEW: Suggestion chip with confidence + accept/reject
apps/web/app/budget/
  components/
    CategorySuggestion.tsx       -- NEW: Web version of suggestion component
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Transactions tab
       │    └── [Add Transaction] > Envelope field shows suggestion  ← AUTO-SUGGEST
       │    └── [Uncategorized list] > Batch suggest button          ← BATCH MODE
       ├── Settings
       │    └── Auto-categorization toggle + accuracy stats          ← SETTINGS
```

### Data Model

```sql
-- V6 migration: Categorization feedback for learning
CREATE TABLE IF NOT EXISTS bg_categorization_feedback (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES bg_transactions(id) ON DELETE CASCADE,
  merchant_normalized TEXT NOT NULL,
  predicted_envelope_id TEXT REFERENCES bg_envelopes(id) ON DELETE SET NULL,
  actual_envelope_id TEXT REFERENCES bg_envelopes(id) ON DELETE SET NULL,
  confidence REAL NOT NULL,
  was_accepted INTEGER NOT NULL CHECK (was_accepted IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_categorization_feedback_merchant_idx
  ON bg_categorization_feedback(merchant_normalized);
CREATE INDEX IF NOT EXISTS bg_categorization_feedback_created_idx
  ON bg_categorization_feedback(created_at DESC);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing payee cache (`bg_payee_cache`), transaction rules engine (`bg_transaction_rules`, `applyRules`)
- **External:** None. On-device only. Uses weighted frequency analysis, not external ML frameworks.
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a budget user, I want new transactions auto-suggested to an envelope based on my history so I spend less time categorizing.
2. As a budget user, I want to accept or reject suggestions so the system learns my preferences.
3. As a budget user, I want to batch-categorize uncategorized transactions with one tap.
4. As a budget user, I want to see the confidence level of each suggestion so I know when to double-check.
5. As a budget user, I want to disable auto-categorization if I prefer manual control.

### Behavior Specification

1. When a transaction is created (manual or bank sync) without an envelope assignment:
   a. System normalizes the merchant name (lowercase, strip trailing numbers/locations, e.g., "WHOLE FOODS #10456 SF" -> "whole foods")
   b. System checks transaction rules first (exact/contains/starts_with matches from bg_transaction_rules)
   c. If no rule match, system queries categorizer engine:
      - Weighted frequency: how often has this normalized merchant been assigned to each envelope?
      - Recency bias: recent assignments weighted 2x vs older ones
      - Amount similarity: transactions of similar amounts to the same merchant tend to share categories
   d. Engine returns top prediction with confidence score (0.0-1.0)
   e. If confidence >= 0.6, suggestion is shown to user
   f. If confidence >= 0.9, auto-assign without prompt (user can still change)
2. Suggestion appears as a chip below the envelope field: "[Groceries] 87% -- Accept / Change"
3. User taps Accept: envelope assigned, feedback recorded as accepted
4. User taps Change: envelope picker opens, feedback recorded as rejected with actual choice
5. Batch mode: "Categorize All" button on uncategorized transactions list
   a. Shows each suggestion in a swipeable card stack
   b. Swipe right to accept, left to reject and pick manually
6. Settings toggle: "Auto-categorization" on/off, with accuracy percentage displayed

### Edge Cases

- Brand new user with no history: no suggestions shown until >= 10 categorized transactions
- Merchant with split history (e.g., "Amazon" used for both "Shopping" and "Groceries"): show top prediction but lower confidence; suggest most recent category
- Merchant name is empty/null: skip categorization, no suggestion
- All envelopes archived: no suggestion possible
- User categorizes a transaction, then immediately changes it: record the final assignment, not the intermediate one
- Bank sync imports 50 transactions at once: categorize in batch, rate-limit UI updates
- Module disabled: categorization engine does not run
- Payee cache and categorizer disagree: categorizer takes precedence (more signals), but both contribute to the weighted score

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** New uncategorized transactions show envelope suggestion chip with confidence %
- [ ] **AC-2:** Tapping "Accept" assigns the suggested envelope and records positive feedback
- [ ] **AC-3:** Tapping "Change" opens envelope picker and records negative feedback with actual choice
- [ ] **AC-4:** Suggestions only appear when confidence >= 0.6
- [ ] **AC-5:** Transactions with confidence >= 0.9 are auto-assigned (with undo option)
- [ ] **AC-6:** Batch categorization mode processes all uncategorized transactions
- [ ] **AC-7:** Settings shows auto-categorization toggle and accuracy % (accepted/total)
- [ ] **AC-8:** No suggestions shown until user has >= 10 categorized transactions
- [ ] **AC-9:** Suggestion accuracy improves over time as feedback accumulates

### Technical Criteria
- [ ] **TC-1:** Categorization runs entirely on-device (no network calls)
- [ ] **TC-2:** Merchant normalization strips location suffixes, trailing numbers, and extra whitespace
- [ ] **TC-3:** Weighted frequency uses recency bias (2x weight for transactions in last 30 days)
- [ ] **TC-4:** Transaction rules (bg_transaction_rules) take precedence over ML suggestions
- [ ] **TC-5:** Feedback stored in bg_categorization_feedback for model improvement
- [ ] **TC-6:** Categorizer engine returns results in <50ms for single transaction
- [ ] **TC-7:** Batch categorization of 50 transactions completes in <2 seconds

### Negative Criteria
- [ ] **NC-1:** Auto-categorization must NOT run when the toggle is off
- [ ] **NC-2:** ML suggestions must NOT override user-created transaction rules
- [ ] **NC-3:** Feedback data must NOT be sent to any external service
- [ ] **NC-4:** Auto-assigned transactions (>=0.9 confidence) must have an undo path
- [ ] **NC-5:** Categorizer must NOT slow down transaction list rendering

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Suggestion chip: glass card `rgba(255,255,255,0.04)` with envelope icon + name + confidence %
- Accept button: `#22C55E` (budget green) background
- Change button: `rgba(255,255,255,0.08)` (glassStrong) background
- Confidence colors: green text (>0.8), amber text (0.6-0.8)
- Batch mode: swipeable card stack, green glow on swipe-right, red glow on swipe-left

### Web (Next.js)
- Same tokens via CSS variables
- Suggestion appears as inline badge next to envelope field in transaction form
- Batch mode: table view with checkboxes, "Accept All" and "Review" buttons

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Spinner on suggestion chip | Categorizer computing |
| Empty | No suggestion shown | <10 transactions or toggle off |
| Error | Silent fallback to manual | Engine failure (should not happen) |
| Success | Suggestion chip with Accept/Change | Confident prediction |
| Partial | Suggestion with low confidence warning | 0.6-0.7 confidence |

## Test Requirements

### Unit Tests
- [ ] `normalizeMerchant`: strips "WHOLE FOODS #10456 SF CA" to "whole foods"
- [ ] `normalizeMerchant`: handles empty/null input
- [ ] `normalizeMerchant`: preserves meaningful words (not just first word)
- [ ] `predictCategory`: returns highest-frequency envelope for known merchant
- [ ] `predictCategory`: applies recency bias (recent category wins tie)
- [ ] `predictCategory`: returns null for unknown merchant with no history
- [ ] `predictCategory`: returns null when <10 total categorized transactions
- [ ] `predictCategory`: respects confidence threshold (0.6 minimum)
- [ ] `recordFeedback`: stores accepted prediction correctly
- [ ] `recordFeedback`: stores rejected prediction with actual envelope
- [ ] `getAccuracy`: calculates accepted/(accepted+rejected) ratio

### Integration Tests
- [ ] Full flow: create 15 transactions to same merchant -> new transaction auto-suggests that envelope
- [ ] Rule precedence: transaction rule matches -> categorizer suggestion is skipped
- [ ] Feedback loop: reject suggestion -> future prediction adjusts toward actual choice

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyBudget > Transactions
3. Create 12 transactions with merchant "Trader Joes" assigned to "Groceries" envelope
4. Create a new transaction with merchant "Trader Joes" but do NOT set envelope
5. Verify: suggestion chip shows "Groceries" with high confidence -- AC-1
6. Tap "Accept"
7. Verify: envelope set to Groceries, feedback recorded -- AC-2
8. Create another "Trader Joes" transaction without envelope
9. Tap "Change", select "Dining Out"
10. Verify: feedback recorded as rejected -- AC-3
11. Create a transaction with unknown merchant "Random Store XYZ"
12. Verify: no suggestion shown (insufficient data for this merchant) -- AC-4
13. Navigate to Settings > Auto-categorization
14. Verify: toggle visible, accuracy % displayed -- AC-7
15. Toggle off auto-categorization
16. Create a new "Trader Joes" transaction
17. Verify: no suggestion shown -- NC-1
18. Toggle back on
19. Create a transaction rule: "Starbucks" -> "Coffee" envelope
20. Create a transaction with merchant "Starbucks"
21. Verify: rule applies directly, no ML suggestion chip -- NC-2, TC-4
22. Run batch categorization on uncategorized transactions
23. Verify: swipeable card stack appears -- AC-6
24. Accept and reject several
25. Verify: all processed correctly

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to budget transactions, verify suggestion chips render correctly

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for categorizer engine

### Post-merge:
- [ ] `/parity-check` -- budget module has archived standalone

## Handoff State

### Before This Work
Budget module has rule-based categorization (bg_transaction_rules with pattern matching) and payee cache (bg_payee_cache with last-used envelope). Both are deterministic and require manual setup. No learning from user behavior.

### After This Work
On-device ML categorizer that learns from user's transaction history. Weighted frequency analysis with recency bias suggests envelopes for new transactions. Accept/reject feedback loop improves accuracy over time. Batch categorization for processing multiple uncategorized transactions. Settings toggle and accuracy metrics.

### Files Changed
- `modules/budget/src/categorizer/categorizer-engine.ts` -- Core ML categorization engine
- `modules/budget/src/categorizer/training.ts` -- Training data builder from transaction history
- `modules/budget/src/categorizer/merchant-normalizer.ts` -- Merchant string normalization
- `modules/budget/src/categorizer/types.ts` -- Prediction, TrainingData types
- `modules/budget/src/categorizer/index.ts` -- Barrel export
- `modules/budget/src/db/schema.ts` -- V6: bg_categorization_feedback table
- `modules/budget/src/db/crud.ts` -- Feedback CRUD operations
- `modules/budget/src/types.ts` -- CategorizationFeedback Zod schema
- `modules/budget/src/definition.ts` -- V6 migration
- `modules/budget/src/index.ts` -- Export categorizer types
- `apps/mobile/app/(budget)/components/CategorySuggestion.tsx` -- Suggestion chip component
- `apps/web/app/budget/components/CategorySuggestion.tsx` -- Web suggestion component

### Known Limitations
- Not true ML (no neural net or gradient descent). Uses weighted frequency heuristics, which is sufficient for personal transaction patterns and runs entirely on-device.
- Accuracy depends on consistent merchant naming. Bank sync merchants are more consistent than manual entry.
- No cross-user learning (privacy-first). Each user's model is built solely from their own data.
- First 10 transactions are uncategorized learning period.

### Context for Next Agent
- The categorizer should build on, not replace, the existing payee cache and transaction rules. Priority order: 1) explicit transaction rules, 2) categorizer engine, 3) payee cache fallback
- Merchant normalization is critical: "TRADER JOE'S #123 SAN FRANCISCO CA" and "Trader Joe's" should resolve to the same normalized key
- Confidence calculation: (count for top envelope / total count for this merchant) * recency_weight * amount_similarity_weight
- The bg_payee_cache.use_count and bg_payee_cache.last_envelope_id provide a good baseline but the categorizer adds temporal and amount-based signals
- Auto-assign threshold (0.9) should be a bg_settings key so it can be tuned per user
