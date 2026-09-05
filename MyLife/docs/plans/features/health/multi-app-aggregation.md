# Feature Spec: Multi-App Aggregation

## Metadata
- **Module:** health
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 0 x2 + CrossModule 5 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 6-8 hours
- **Depends On:** HealthKit integration (foundational data pipeline)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Multi-app aggregation pulls health data from multiple external apps via HealthKit, Health Connect, and direct CSV/JSON imports, unifying them into MyHealth's single timeline. Complexity is 0 (hardest) because it requires building adapters for multiple external data formats and handling conflicting data from overlapping sources. This is the core hub value proposition (CrossModule 5/5) since it justifies why users should use MyLife instead of separate apps.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Aggregates from all HealthKit-connected apps, priority system for conflicts |
| Google Fit | Yes | Free | Aggregates from Health Connect partners |
| Bearable | Partial | Yes ($34.99/yr) | Imports from Apple Health, Garmin, Fitbit via HealthKit |
| Welltory | Yes | Yes ($59.99/yr) | Multi-source aggregation with analysis |

### Target User
Users who use multiple health/fitness apps (e.g., Strava for runs, MyFitnessPal for nutrition, Oura for sleep) and want all that data in one place. Power users who have data spread across apps and want a single source of truth.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/aggregation/sources.ts      -- Source adapter registry
modules/health/src/aggregation/importers/      -- Per-source import adapters
  ├── healthkit.ts                             -- HealthKit aggregation (extends existing)
  ├── csv.ts                                   -- Generic CSV import
  ├── json.ts                                  -- Generic JSON import
  ├── apple-health-export.ts                   -- Apple Health XML export parser
modules/health/src/aggregation/dedup.ts        -- Deduplication engine
modules/health/src/aggregation/types.ts        -- Aggregation types
modules/health/src/db/schema.ts                -- New hl_import_log table
modules/health/src/index.ts                    -- Export aggregation functions
apps/mobile/app/(health)/health-sync-settings.tsx -- Extended import settings
apps/mobile/app/(health)/import.tsx            -- Manual import screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vault tab
            └── Health Sync Settings
                 └── Import Data ← YOU ARE HERE
                      ├── Apple Health (auto-sync)
                      ├── Import from file (CSV/JSON/XML)
                      ├── Connected sources list
                      └── Conflict resolution settings
```

### Data Model

```sql
-- Import log tracks all external data imports
CREATE TABLE IF NOT EXISTS hl_import_log (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,            -- 'apple_health' | 'csv' | 'json' | 'apple_health_export' | 'garmin_csv' | 'fitbit_csv'
  file_name TEXT,                       -- Original file name (for file imports)
  records_imported INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,  -- Duplicates or invalid
  records_conflicted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',     -- completed | failed | partial
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS hl_import_source_idx ON hl_import_log(source_name);
CREATE INDEX IF NOT EXISTS hl_import_date_idx ON hl_import_log(started_at DESC);
```

Imported data flows into existing tables (hl_vitals, hl_sleep_sessions, hl_body_measurements) with appropriate `source` values.

### Dependencies
- **Internal:** `@mylife/db`, HealthKit adapter, all hl_* tables, deduplication engine
- **External:** expo-document-picker for file import, expo-file-system for file reading
- **Cross-Module:** Imported data feeds all health features (vitals, sleep, activity, readiness, timeline). This is the data pipeline that powers everything.

## Functional Requirements

### User Stories
1. As a user switching from another health app, I want to import my historical data so I don't lose years of tracking.
2. As a user with multiple data sources, I want conflicting data resolved intelligently (not duplicated).
3. As a user, I want to see what was imported and from where so I can trust my data.
4. As a user, I want to import Apple Health's full export (the XML file from Settings > Health > Export).

### Behavior Specification

**Auto-aggregation (HealthKit):**
1. Already handled by HealthKit integration feature
2. Multi-app aggregation extends this by tracking which apps contributed data (via HealthKit source metadata)
3. Display "Data from: Apple Watch, Strava, MyFitnessPal" in the sync settings

**Manual file import:**
1. User navigates to Health Sync Settings > Import Data
2. Supported formats:
   - Apple Health Export (XML): The full export from Settings > Health > Export All Health Data
   - Generic CSV: Columns mapped to vital types (user-guided mapping)
   - JSON: Structured health data with type/value/date fields
   - Garmin CSV export: Pre-built column mapping
   - Fitbit CSV export: Pre-built column mapping
3. User selects a file via document picker
4. System detects format and shows preview (first 5 records)
5. For CSV: User maps columns to data types if needed
6. User confirms import
7. System processes records:
   - Parse each record
   - Check for duplicates (same type + same timestamp + same value = skip)
   - Insert new records into appropriate tables with source='imported'
   - Log results to hl_import_log
8. Progress indicator during import
9. Summary: "Imported 2,341 records. Skipped 156 duplicates."

**Deduplication engine:**
1. When importing data that overlaps with existing records:
   - Same vital_type + recorded_at within 1 minute + same value: Skip (exact duplicate)
   - Same vital_type + recorded_at within 1 minute + different value: Flag as conflict
2. Conflict resolution options (in settings):
   - Prefer newest source (default)
   - Prefer specific source (e.g., always trust Apple Watch over manual)
   - Ask user per conflict (for small imports)
3. Conflicts logged for review

**Source tracking:**
1. Health Sync Settings shows a "Connected Sources" section listing all unique sources in the database
2. Each source shows record count and last data date
3. User can delete all data from a specific source

### Edge Cases

- **Very large import (100k+ records):** Process in batches of 1000. Show progress bar with percentage.
- **Malformed CSV:** Show error with row numbers and skip invalid rows.
- **XML export too large (>100MB):** Stream-parse, don't load into memory. Show warning about processing time.
- **Conflicting sleep sessions (overlapping times from different sources):** Keep the one with more stage data. Flag for review.
- **Import interrupted (app killed):** Log partial import. Allow re-import (dedup will handle already-imported records).
- **Unsupported file format:** Show "Unsupported format" with list of supported formats.
- **Empty file:** Show "File contains no health data."
- **Date format variations:** Support ISO 8601, US (MM/DD/YYYY), EU (DD/MM/YYYY) with auto-detection or user selection.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Import Data screen shows supported format options
- [ ] **AC-2:** File picker opens and accepts CSV, JSON, and XML files
- [ ] **AC-3:** Import preview shows first 5 records before confirming
- [ ] **AC-4:** Progress indicator shows during import with record count
- [ ] **AC-5:** Import summary shows imported, skipped, and conflicted counts
- [ ] **AC-6:** Connected Sources section lists all data sources with record counts
- [ ] **AC-7:** User can delete all data from a specific source
- [ ] **AC-8:** Apple Health XML export parsed correctly with vitals and sleep data imported

### Technical Criteria
- [ ] **TC-1:** hl_import_log table created by migration
- [ ] **TC-2:** Deduplication correctly identifies records within 1-minute window
- [ ] **TC-3:** Batch processing handles 100k+ records without memory issues
- [ ] **TC-4:** Apple Health XML streaming parser works for files >50MB
- [ ] **TC-5:** CSV column mapping correctly identifies vital types
- [ ] **TC-6:** Import is atomic per batch (rollback on error within batch)
- [ ] **TC-7:** Source metadata stored with each imported record

### Negative Criteria
- [ ] **NC-1:** Import must NOT delete existing data (additive only)
- [ ] **NC-2:** File contents must NOT be sent over network
- [ ] **NC-3:** Import must NOT block the UI thread during processing

## UI Specification

### Mobile (Expo)
- **Import screen:** List of format cards (Apple Health Export, CSV, JSON) with file picker buttons. Glass cards, `#10B981` accent.
- **Preview:** Table showing first 5 records with column headers. "Confirm Import" button.
- **Progress:** Full-width progress bar with record count. Cancel button.
- **Summary:** Glass card with imported/skipped/conflicted counts and checkmark icon.
- **Sources list:** Glass cards per source with name, record count, last date, and "Remove" button.

### Web (Next.js)
- `/health/import` route. Drag-and-drop file upload zone. Same processing flow.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Ready | Format options with file pickers | Initial navigation |
| Preview | First 5 records with confirm button | File selected |
| Importing | Progress bar with count | Import started |
| Complete | Summary with counts | Import finished |
| Error | Error message with details | Parse or import failure |
| Sources | Source list with counts | Sources section |

## Test Requirements

### Unit Tests
- [ ] `parseAppleHealthXml`: extracts vitals from HKQuantitySample elements
- [ ] `parseCsv`: maps columns to vital types correctly
- [ ] `isDuplicate`: same type + timestamp + value = true
- [ ] `isDuplicate`: different value at same timestamp = false (conflict)
- [ ] `batchInsert`: processes 1000 records correctly
- [ ] `batchInsert`: skips duplicates and logs conflicts
- [ ] `logImport`: stores all import metadata
- [ ] `getSourceSummary`: returns correct counts per source
- [ ] `deleteBySource`: removes only records with specified source

### Integration Tests
- [ ] Full flow: select CSV -> preview -> import -> records in hl_vitals -> summary correct
- [ ] Dedup flow: import same file twice -> second import skips all records
- [ ] Conflict flow: import overlapping data -> conflicts logged

### QA Verification Script

1. Navigate to MyHealth > Vault > Health Sync Settings > Import Data
2. Verify: Format options visible -- corresponds to AC-1
3. Tap "Import CSV"
4. Select a test CSV file with heart rate data
5. Verify: Preview shows first 5 records -- corresponds to AC-3
6. Confirm import
7. Verify: Progress indicator shows -- corresponds to AC-4
8. Verify: Summary shows counts -- corresponds to AC-5
9. Import same file again
10. Verify: All records skipped as duplicates -- corresponds to AC-5 (dedup)
11. Navigate to Connected Sources
12. Verify: "csv" source listed with record count -- corresponds to AC-6
13. Tap "Remove" on csv source
14. Verify: CSV data removed -- corresponds to AC-7
15. Export Apple Health data from iOS Settings
16. Import the XML file
17. Verify: Vitals and sleep data imported -- corresponds to AC-8

## gstack Quality Gates

Based on Complexity 0 (Inverse), this feature is "Massive" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if Complexity <= 1:
- [ ] `/office-hours` (builder mode) -- validate approach

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module syncs from HealthKit but has no file-based import, no deduplication across sources, and no source tracking.

### After This Work
- Multi-format import pipeline (Apple Health XML, CSV, JSON, Garmin, Fitbit)
- Deduplication engine with conflict detection
- Import logging and source tracking
- Connected sources dashboard with per-source management
- Batch processing for large imports

### Files Changed
- `modules/health/src/aggregation/sources.ts` -- Source registry
- `modules/health/src/aggregation/importers/*.ts` -- Per-format adapters
- `modules/health/src/aggregation/dedup.ts` -- Dedup engine
- `modules/health/src/aggregation/types.ts` -- Types
- `modules/health/src/db/schema.ts` -- hl_import_log
- `modules/health/src/definition.ts` -- Migration bump
- `modules/health/src/index.ts` -- Exports
- `apps/mobile/app/(health)/import.tsx` -- Import UI
- `apps/mobile/app/(health)/health-sync-settings.tsx` -- Extended sources

### Known Limitations
- No direct API integration with Garmin/Fitbit/Oura (file export only)
- No real-time sync from third-party apps (only HealthKit auto-sync)
- No export back to other apps
- Apple Health XML parser handles common record types only (HKQuantitySample, HKCategorySample)

### Context for Next Agent
- Apple Health XML exports can be 100MB+. Use a streaming XML parser (e.g., SAX-style), not DOM parsing. Consider expo-file-system for reading file chunks.
- Dedup window is 1 minute: same vital_type with recorded_at within 60 seconds and same value = duplicate. Different value = conflict.
- The `source` column in hl_vitals and hl_sleep_sessions already supports 'imported' in its CHECK constraint. Consider extending to specific source names or use the generic 'imported' and track source detail in hl_import_log.
- Batch size of 1000 records for SQLite transactions balances memory and speed. Larger batches risk memory issues on mobile.
