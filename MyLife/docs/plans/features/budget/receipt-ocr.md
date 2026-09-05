# Feature Spec: Receipt OCR

## Metadata
- **Module:** budget
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3+
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (transactions CRUD and camera access already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Users who photograph receipts expect automatic extraction of merchant name, date, line items, total, and tax. Copilot ($119.88/yr) and PocketGuard ($74.99/yr) both offer receipt scanning that auto-populates transaction fields. Without OCR, MyLife users must manually key every receipt detail, which is the #1 friction point in budgeting apps. Receipt OCR bridges the gap between "I bought something" and "it's tracked in my budget" with a single photo.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Copilot | Yes | Yes ($119.88/yr) | Camera capture, OCR via cloud API, auto-fills merchant + amount + date. Line items parsed. |
| PocketGuard | Yes | Yes ($74.99/yr) | Receipt scanning with amount extraction. Categorizes based on merchant. Stores receipt image. |
| YNAB | No | N/A | No native OCR. Users manually enter or rely on bank sync. |
| Monarch Money | No | N/A | No native OCR. Relies on Plaid categorization. |
| Rocket Money | No | N/A | No native OCR. |

### Target User
Users who pay cash, shop at farmers markets, or travel internationally where bank sync is unavailable. Also users who want itemized receipt tracking for tax deductions or expense reports. Migration path: PocketGuard user paying $74.99/yr who wants receipt scanning + envelope budgeting at $5/yr.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  ocr/
    receipt-parser.ts            -- NEW: Parse OCR response into structured receipt data
    receipt-engine.ts            -- NEW: Orchestrate capture -> parse -> transaction creation
    types.ts                     -- NEW: Receipt OCR types (ReceiptData, LineItem, ParseResult)
    index.ts                     -- NEW: Barrel export
modules/budget/src/db/
  schema.ts                      -- MODIFY: Add bg_receipts table (V6 migration)
  crud.ts                        -- MODIFY: Add receipt CRUD operations
modules/budget/src/types.ts      -- MODIFY: Add Receipt, ReceiptInsert schemas
modules/budget/src/definition.ts -- MODIFY: Add V6 migration
modules/budget/src/index.ts      -- MODIFY: Export receipt types and operations
apps/mobile/app/(budget)/
  scan-receipt.tsx               -- NEW: Camera capture screen with crop/rotate
  receipt-review.tsx             -- NEW: Review parsed data before creating transaction
apps/web/app/budget/
  receipts/page.tsx              -- NEW: Upload receipt image, review parsed data
  actions.ts                     -- MODIFY: Add receipt server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       │    └── [+] FAB > "Scan Receipt"  ← ENTRY POINT
       ├── Subscriptions tab
       ├── Reports tab
       └── Accounts tab
```

### Data Model

```sql
-- V6 migration: Receipt storage
CREATE TABLE IF NOT EXISTS bg_receipts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT REFERENCES bg_transactions(id) ON DELETE SET NULL,
  image_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  merchant_raw TEXT,
  total_raw TEXT,
  date_raw TEXT,
  currency_raw TEXT,
  tax_amount INTEGER,
  subtotal INTEGER,
  line_items TEXT,            -- JSON array of {description, quantity, unit_price, total}
  ocr_confidence REAL,       -- 0.0-1.0 overall parse confidence
  ocr_provider TEXT NOT NULL DEFAULT 'on-device',
  raw_ocr_text TEXT,         -- Full OCR text for debugging/re-parsing
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'parsed', 'reviewed', 'linked', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_receipts_transaction_idx ON bg_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS bg_receipts_status_idx ON bg_receipts(status);
CREATE INDEX IF NOT EXISTS bg_receipts_created_idx ON bg_receipts(created_at DESC);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-camera` (mobile capture), `expo-image-manipulator` (crop/rotate), on-device ML Kit Text Recognition (iOS/Android) or Tesseract.js (web fallback)
- **Cross-Module:** `nutrition` module could reuse receipt OCR for grocery item detection; `car` module could use for gas receipt tracking

## Functional Requirements

### User Stories
1. As a budget user, I want to photograph a receipt so that the merchant, amount, and date are auto-filled into a new transaction.
2. As a budget user, I want to review and correct OCR results before the transaction is created so that data accuracy is maintained.
3. As a budget user, I want to see line items from my receipt so I can split expenses across envelopes.
4. As a web user, I want to upload a receipt image so I can track cash purchases from my desktop.
5. As a budget user, I want to view past receipt images attached to transactions for record-keeping.

### Behavior Specification

1. User taps [+] FAB on Transactions tab, selects "Scan Receipt"
2. Camera viewfinder opens with document detection overlay (guides for receipt edges)
3. User captures photo (or picks from gallery)
4. Image is cropped and enhanced (contrast, deskew) via `expo-image-manipulator`
5. OCR runs on-device (ML Kit for mobile, Tesseract.js for web)
6. Parser extracts: merchant name, date, subtotal, tax, total, currency, line items
7. Review screen shows parsed fields pre-filled, all editable
8. User selects envelope assignment (auto-suggested from merchant via payee cache)
9. User selects account
10. User taps "Save" to create transaction + link receipt record
11. Receipt image is stored locally (not uploaded anywhere)
12. Transaction appears in list with receipt icon indicator

### Edge Cases

- Receipt is blurry or partially obscured: show confidence score, highlight low-confidence fields in amber, allow manual override
- Receipt is in a foreign language: parse numbers and date patterns; leave merchant name as-is for user editing
- Receipt has no clear total (e.g., just line items): sum line items as suggested total
- Receipt is for a return/refund: detect negative amounts or "REFUND" keyword, suggest inflow direction
- Multiple receipts in one image: parse only the largest detected text block, warn user
- User cancels mid-scan: no data saved, return to transactions list
- OCR returns empty result: show error state with "Manual entry" fallback button
- Image file is very large (>10MB): compress before OCR processing
- Module is disabled mid-review: save draft receipt to bg_receipts with status 'pending'
- Web upload of non-image file: validate MIME type, reject with clear error message

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping "Scan Receipt" opens camera with document detection guides
- [ ] **AC-2:** Captured image shows preview with crop/rotate controls before OCR
- [ ] **AC-3:** OCR results populate merchant, amount, and date fields within 3 seconds on-device
- [ ] **AC-4:** Review screen shows all parsed fields as editable inputs
- [ ] **AC-5:** Low-confidence fields (<0.7) are visually highlighted with amber border
- [ ] **AC-6:** Envelope is auto-suggested based on merchant via payee cache
- [ ] **AC-7:** Saving creates both a bg_transactions row and a bg_receipts row
- [ ] **AC-8:** Transaction list shows receipt attachment icon for receipt-linked transactions
- [ ] **AC-9:** Tapping receipt icon on a transaction shows the stored receipt image
- [ ] **AC-10:** Web upload accepts drag-and-drop and file picker for JPG/PNG/HEIC
- [ ] **AC-11:** Gallery picker available as alternative to camera capture on mobile

### Technical Criteria
- [ ] **TC-1:** OCR runs entirely on-device (no network calls for text recognition)
- [ ] **TC-2:** Receipt images stored in app sandbox, not camera roll
- [ ] **TC-3:** bg_receipts table created via V6 migration with proper indexes
- [ ] **TC-4:** Receipt parser handles multi-line merchant names (e.g., "WHOLE FOODS\nMARKET #10456")
- [ ] **TC-5:** Line items parsed as JSON array with description, quantity, unit_price, total
- [ ] **TC-6:** OCR confidence score (0.0-1.0) calculated and stored per receipt
- [ ] **TC-7:** Images compressed to <2MB before storage regardless of capture resolution

### Negative Criteria
- [ ] **NC-1:** Receipt images must NOT be uploaded to any external server
- [ ] **NC-2:** OCR must NOT require network connectivity
- [ ] **NC-3:** Failed OCR must NOT block manual transaction entry
- [ ] **NC-4:** Receipt deletion must NOT delete the linked transaction
- [ ] **NC-5:** Scanning must NOT access photos beyond the selected image

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Camera overlay: semi-transparent `rgba(0,0,0,0.6)` with cut-out rectangle for receipt
- Review card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E` (budget green)
- Confidence indicator: green (>0.8), amber (0.5-0.8), red (<0.5)
- Receipt image thumbnail: 80x120 rounded corner in transaction list row

### Web (Next.js)
- Same tokens via CSS variables in `globals.css`
- Upload zone: dashed border drop area, 400x300, accepts JPG/PNG/HEIC
- Side-by-side layout: receipt image left, parsed fields right
- Route: `/budget/receipts`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Shimmer placeholder on parsed fields | OCR processing |
| Empty | "No receipts scanned yet" + camera CTA | First visit |
| Error | "Could not read receipt" + manual entry button | OCR failure |
| Success | Pre-filled fields with confidence indicators | Successful parse |
| Partial | Some fields filled, others highlighted for input | Low-confidence parse |

## Test Requirements

### Unit Tests
- [ ] `parseReceiptText`: extracts merchant from common receipt formats (Walmart, Target, Costco)
- [ ] `parseReceiptText`: extracts total with various currency symbols ($, EUR, GBP)
- [ ] `parseReceiptText`: extracts date from MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD formats
- [ ] `parseReceiptText`: extracts line items with quantity and unit price
- [ ] `parseReceiptText`: handles empty/garbage OCR text gracefully
- [ ] `calculateConfidence`: returns 0.0 for empty text, higher for well-structured receipts
- [ ] `compressImage`: reduces image to target max size
- [ ] Receipt CRUD: create, read, update, delete, link to transaction

### Integration Tests
- [ ] Full flow: image -> OCR -> parse -> review -> transaction created
- [ ] Error flow: bad image -> OCR fails -> user falls back to manual entry
- [ ] Receipt-transaction link: deleting transaction nullifies receipt.transaction_id

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyBudget > Transactions tab
3. Tap [+] FAB, select "Scan Receipt"
4. Verify: camera opens with document detection overlay -- AC-1
5. Capture a sample receipt image
6. Verify: preview shows with crop/rotate controls -- AC-2
7. Tap "Process"
8. Verify: fields populate within 3 seconds -- AC-3
9. Verify: merchant, amount, date fields are editable -- AC-4
10. Verify: low-confidence fields have amber highlight -- AC-5
11. Verify: envelope suggestion appears based on merchant -- AC-6
12. Select an envelope and account, tap "Save"
13. Verify: transaction appears in list with receipt icon -- AC-7, AC-8
14. Tap receipt icon on the transaction
15. Verify: receipt image displays -- AC-9
16. Open app on web at `/budget/receipts`
17. Drag a receipt JPG into the upload zone
18. Verify: upload accepted, OCR runs, fields populate -- AC-10
19. Test with a blurry/unreadable image
20. Verify: error state shows with manual entry fallback -- NC-3
21. Disconnect network, scan a receipt on mobile
22. Verify: OCR still works offline -- TC-1, NC-2
23. Check app sandbox storage
24. Verify: receipt images stored locally, not in camera roll -- TC-2, NC-1

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/budget/receipts`, test upload flow, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- Complexity score is 1, run on this spec BEFORE building

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for receipt parser engine

### Post-merge:
- [ ] `/parity-check` -- budget module has archived standalone

## Handoff State

### Before This Work
Budget module has full transaction CRUD, payee cache for envelope suggestions, and 32 tables across V1-V5. No receipt scanning or image storage capability exists.

### After This Work
Users can photograph receipts on mobile or upload on web. On-device OCR extracts merchant, amount, date, and line items. Parsed data pre-fills a transaction form with editable fields and confidence indicators. Receipt images stored locally and linked to transactions.

### Files Changed
- `modules/budget/src/ocr/receipt-parser.ts` -- OCR text parsing engine
- `modules/budget/src/ocr/receipt-engine.ts` -- Capture-to-transaction orchestration
- `modules/budget/src/ocr/types.ts` -- ReceiptData, LineItem, ParseResult types
- `modules/budget/src/ocr/index.ts` -- Barrel export
- `modules/budget/src/db/schema.ts` -- V6 migration with bg_receipts table
- `modules/budget/src/db/crud.ts` -- Receipt CRUD operations
- `modules/budget/src/types.ts` -- Receipt Zod schemas
- `modules/budget/src/definition.ts` -- V6 migration registration
- `modules/budget/src/index.ts` -- Export receipt types and operations
- `apps/mobile/app/(budget)/scan-receipt.tsx` -- Camera capture screen
- `apps/mobile/app/(budget)/receipt-review.tsx` -- Review parsed data screen
- `apps/web/app/budget/receipts/page.tsx` -- Web upload and review page
- `apps/web/app/budget/actions.ts` -- Receipt server actions

### Known Limitations
- On-device OCR accuracy varies by receipt quality and language
- No cloud OCR fallback (privacy-first constraint)
- Line item parsing is best-effort; complex receipt layouts may require manual correction
- No multi-receipt batch scanning in this version

### Context for Next Agent
- The receipt parser should be a pure function (text in, structured data out) for easy testing
- Use `expo-camera` with `CameraView` (not the deprecated Camera component)
- Store images via `expo-file-system` in the app's document directory
- The payee cache (`bg_payee_cache`) already maps merchant names to envelope IDs -- reuse `getEnvelopeSuggestion()` for auto-assignment
- V6 migration must be added to the BUDGET_MODULE.migrations array in definition.ts
