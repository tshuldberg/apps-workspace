# Feature Spec: Pain Location Map

## Metadata
- **Module:** meds
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Symptom logging (built -- `md_symptoms`, `md_symptom_logs`)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Pain location mapping lets users tap on a body diagram to log where pain occurs, replacing vague text descriptions with precise anatomical data. CareClinic ($119.88/yr) offers a body map for pain logging as a premium feature. Migraine Buddy ($49.99/yr) has a head-specific pain map that is one of their most-used features (users map unilateral vs bilateral headache patterns). The body map transforms subjective "I have pain" logs into structured anatomical data that doctors can use for diagnosis, treatment evaluation, and pattern recognition over time. Combined with the existing medication correlation engine, this creates a powerful "which meds help which pain locations" analysis.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| CareClinic | Yes | Yes ($119.88/yr) | Full body map (front/back), tap to select region, severity per region, history overlay. |
| Migraine Buddy | Partial | Yes ($49.99/yr) | Head-only pain map, unilateral/bilateral, radiation pattern. Sells "anonymized" data. |
| Bearable | No | N/A | Text-only symptom logging. No body map. |
| Manage My Pain | Yes | Yes ($19.99/yr) | Dedicated pain tracker with body map. Pain-only app, no medication tracking. |
| Medisafe | No | N/A | No pain mapping. |

### Target User
Chronic pain patients (50M in US, 20% of adults globally), migraine sufferers (39M in US), and arthritis patients (54M in US) who want to track pain location patterns over time. Specifically: CareClinic users paying $119.88/yr or Manage My Pain users paying $19.99/yr who want body-mapped pain tracking integrated with medication adherence and correlation analysis. Migration path: pain mapping + medication tracking + correlation in one privacy-first app.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  pain/
    engine.ts                      -- NEW: Pain location analysis, heatmap generation, pattern detection
    body-zones.ts                  -- NEW: Body zone definitions (36 zones, front + back)
    __tests__/engine.test.ts       -- NEW: Engine tests
  db/
    pain.ts                        -- NEW: CRUD for pain entries
    schema.ts                      -- MODIFY: Add md_pain_entries table (V4)
  models/
    pain.ts                        -- NEW: Zod schemas for pain entries
    index.ts                       -- MODIFY: Export pain models
  definition.ts                    -- MODIFY: Add to V4 migration, add pain screen
  index.ts                         -- MODIFY: Export pain engine + types
apps/mobile/app/(meds)/
  pain-map.tsx                     -- NEW: Interactive body map screen
  pain-history.tsx                 -- NEW: Pain history with heatmap overlay
apps/web/app/meds/
  pain/page.tsx                    -- NEW: Web pain map dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [Pain summary card: active pain locations, severity]
       ├── History tab
       │    └── Pain section
       │         └── [Pain Location Map] ← YOU ARE HERE
       │              ├── [Body diagram (front/back toggle)]
       │              │    └── Tap zones to log pain
       │              ├── [Active pain list with severity and duration]
       │              ├── [Pain heatmap overlay (frequency over time)]
       │              └── [Pain-medication correlation report]
       └── Settings tab
```

### Data Model

```sql
-- Pain entries with anatomical location
CREATE TABLE IF NOT EXISTS md_pain_entries (
  id TEXT PRIMARY KEY,
  body_zone TEXT NOT NULL CHECK (body_zone IN (
    'head_front', 'head_back', 'head_left', 'head_right', 'head_top',
    'neck', 'throat',
    'shoulder_left', 'shoulder_right',
    'upper_arm_left', 'upper_arm_right',
    'elbow_left', 'elbow_right',
    'forearm_left', 'forearm_right',
    'wrist_left', 'wrist_right',
    'hand_left', 'hand_right',
    'chest_left', 'chest_right', 'chest_center',
    'upper_back', 'mid_back', 'lower_back',
    'abdomen_upper', 'abdomen_lower',
    'hip_left', 'hip_right',
    'thigh_left', 'thigh_right',
    'knee_left', 'knee_right',
    'shin_left', 'shin_right',
    'ankle_left', 'ankle_right',
    'foot_left', 'foot_right'
  )),
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
  pain_type TEXT CHECK (pain_type IN ('sharp', 'dull', 'burning', 'throbbing', 'aching', 'stabbing', 'cramping', 'tingling', 'shooting', 'pressure')),
  duration_minutes INTEGER,
  radiation TEXT,
  notes TEXT,
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** `@mylife/meds` symptom logging (for existing symptom correlation), medication tracking (for pain-medication correlation), correlation engine
- **External:** SVG body diagram component. `react-native-svg` (mobile), inline SVG (web). No new dependencies beyond what is already in the workspace.
- **Cross-Module:** Health module can surface pain summary. Workouts module can correlate exercise with pain (e.g., knee pain after running).

## Functional Requirements

### User Stories
1. As a chronic pain patient, I want to tap on a body diagram to log where my pain is so my doctor has precise location data.
2. As a migraine sufferer, I want to map whether my headache is unilateral (left/right) or bilateral so I can track patterns.
3. As a patient, I want to see a heatmap of my most frequent pain locations over time so I can identify chronic problem areas.
4. As a patient taking pain medication, I want to see which medications help with pain in specific body zones so I know what works.

### Behavior Specification

1. User navigates to MyMeds -> History -> Pain -> Pain Location Map
2. **Log Pain flow:**
   a. System displays a human body silhouette (front view, toggleable to back view)
   b. User taps a body zone (e.g., lower_back)
   c. Zone highlights with the module accent color
   d. User can tap multiple zones for widespread pain
   e. Severity slider appears (1-10 scale with descriptive labels: 1=barely noticeable, 5=moderate, 10=worst imaginable)
   f. Pain type selector: sharp, dull, burning, throbbing, aching, stabbing, cramping, tingling, shooting, pressure
   g. Optional: duration, radiation pattern (text), notes
   h. User taps "Log Pain"
   i. System saves to `md_pain_entries` (one row per body zone, grouped by same created_at timestamp)
3. **History view:**
   a. List of past pain entries grouped by date
   b. Each entry shows body zone(s), severity, type, duration
   c. Tap to view details or mark as resolved (sets resolved_at)
4. **Heatmap view:**
   a. Body diagram overlaid with color intensity based on frequency
   b. Zones with more pain entries glow warmer (cyan -> yellow -> red)
   c. Period selector: 7d / 30d / 90d / all
   d. Tap a zone to see detailed history for that location
5. **Pain-medication correlation:**
   a. For each body zone with 5+ entries:
   b. Shows which active medications correlate with lower pain severity
   c. Shows medications started/stopped during pain trend changes
   d. Example: "Lower back pain severity decreased 40% after starting Naproxen"

### Edge Cases

- User taps the same zone multiple times in one session: treat as single entry (last severity wins)
- User logs pain in 10+ zones simultaneously: valid but show warning ("Are you sure? This will log 10 locations")
- Body zone too small to tap accurately on small screens: use larger touch targets than visual zones
- No pain entries: show empty body diagram with "Tap a body area to log pain" instruction
- Pain resolved_at before started_at: validation error
- Severity 0: not allowed (minimum 1). Use "resolved" action instead of severity 0.
- Module disabled: pain map inaccessible, data preserved
- Duration null: acceptable (user may not know duration yet for active pain)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Interactive body diagram displays with tappable zones (front view)
- [ ] **AC-2:** Back view toggleable via front/back switch
- [ ] **AC-3:** Tapped zone highlights with accent color and shows severity slider
- [ ] **AC-4:** User can select multiple zones in one logging session
- [ ] **AC-5:** Pain type selector offers 10 pain descriptors
- [ ] **AC-6:** Pain entry saves with zone, severity, type, optional duration and notes
- [ ] **AC-7:** Heatmap overlay shows frequency-based color intensity on body diagram
- [ ] **AC-8:** Heatmap supports period filtering (7d/30d/90d/all)
- [ ] **AC-9:** Pain-medication correlation shows per body zone with severity delta
- [ ] **AC-10:** Pain summary card on Today tab shows active (unresolved) pain locations
- [ ] **AC-11:** User can mark pain as resolved from history view

### Technical Criteria
- [ ] **TC-1:** `md_pain_entries` table created in V4 migration with 36 valid body zones
- [ ] **TC-2:** SVG body diagram renders correctly on iOS, Android, and web
- [ ] **TC-3:** Touch targets are minimum 44x44pt (iOS HIG) even for small zones
- [ ] **TC-4:** Heatmap calculation: count entries per zone in period, normalize to 0-1 range
- [ ] **TC-5:** Pain-medication correlation reuses Pearson coefficient pattern from analytics engine
- [ ] **TC-6:** Body zone definitions in `body-zones.ts` include hitbox coordinates for SVG touch detection
- [ ] **TC-7:** Pain entry creation completes in <50ms

### Negative Criteria
- [ ] **NC-1:** Body diagram must NOT use photorealistic human images -- use gender-neutral silhouette
- [ ] **NC-2:** Pain logging must NOT require selecting a type (it is optional)
- [ ] **NC-3:** Must NOT require network access
- [ ] **NC-4:** Heatmap must NOT show misleading colors for zones with <3 entries (suppress or gray out)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Body diagram: white/light gray silhouette outline on dark background, ~60% of screen height
- Zone highlight (selected): `#06B6D4` (meds cyan) at 50% opacity
- Zone highlight (heatmap low): `rgba(6, 182, 212, 0.3)` (cyan)
- Zone highlight (heatmap medium): `rgba(255, 214, 10, 0.5)` (yellow)
- Zone highlight (heatmap high): `rgba(255, 69, 58, 0.6)` (red)
- Severity slider: horizontal, labeled 1-10 with color gradient (green to red)
- Pain type: horizontal scrollable pill selector
- Front/back toggle: segmented control at top of diagram

### Web (Next.js)
- Route: `/meds/pain`
- Same tokens via CSS variables
- Body diagram at 400x600px, clickable zones with hover states
- Side panel: pain details form (appears when zone clicked)
- Heatmap as second tab with same body diagram + color overlay

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Body diagram skeleton | Initial render |
| Empty | Clean body diagram with "Tap a body area to log pain" | No pain entries |
| Logging | Highlighted zone(s) with severity slider visible | User tapped a zone |
| Error | "Could not save pain entry" + retry | Database write fails |
| Success (history) | List of past entries grouped by date | Pain entries exist |
| Heatmap | Body diagram with color overlay | User switches to heatmap tab |
| Active pain | Today tab card showing unresolved pain locations | Unresolved entries exist |

## Test Requirements

### Unit Tests
- [ ] `createPainEntry`: saves entry with valid body_zone and severity
- [ ] `createPainEntry`: rejects invalid body_zone string
- [ ] `createPainEntry`: rejects severity outside 1-10 range
- [ ] `calculateHeatmap`: returns normalized intensity (0-1) per zone for period
- [ ] `calculateHeatmap`: suppresses zones with <3 entries (returns 0)
- [ ] `getActiveZones`: returns zones with unresolved pain (resolved_at IS NULL)
- [ ] `resolvePain`: sets resolved_at timestamp
- [ ] `getPainMedicationCorrelation`: computes severity delta before/after medication start
- [ ] `getPainMedicationCorrelation`: returns null for zones with <5 entries
- [ ] `BODY_ZONES`: contains exactly 36 zone definitions with SVG hitbox coordinates

### Integration Tests
- [ ] Full flow: tap zone -> set severity -> save -> appears in history -> heatmap updates
- [ ] Multi-zone: tap 3 zones -> save all -> 3 entries created with same timestamp
- [ ] Resolve: log pain -> mark resolved -> no longer appears in active pain

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyMeds -> History -> Pain -> Pain Location Map
3. Verify: body diagram displayed with "Tap a body area to log pain" -- AC-1
4. Tap the lower back zone
5. Verify: zone highlights with cyan, severity slider appears -- AC-3
6. Set severity to 7, select "Aching" pain type
7. Tap Save
8. Verify: entry saved, appears in history list -- AC-6
9. Tap the front/back toggle
10. Verify: back view of body diagram shown -- AC-2
11. Tap upper back zone and right shoulder zone
12. Verify: both zones highlighted simultaneously -- AC-4
13. Save both
14. Switch to Heatmap tab, set period to 30d
15. Verify: lower back and upper back zones show color intensity -- AC-7, AC-8
16. Log 5+ entries for lower back across different days
17. Start a pain medication
18. Log 5+ entries with lower severity after medication
19. Check pain-medication correlation
20. Verify: shows "Lower back pain severity decreased X% after starting [med]" -- AC-9
21. Navigate to Today tab
22. Verify: active pain locations shown in summary card -- AC-10
23. Go to history, tap an entry, mark as resolved
24. Verify: entry shows resolved status, removed from active pain -- AC-11
25. Repeat key checks on web at `/meds/pain`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/meds/pain`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for heatmap and correlation engines

### Post-merge:
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The meds module has text-based symptom logging (`md_symptom_logs` with severity 1-5) but no anatomical location tracking, no body diagram, no pain heatmap, and no location-specific medication correlation.

### After This Work
An interactive body diagram allows users to tap anatomical zones to log pain with severity, type, and duration. A heatmap overlay shows pain frequency patterns over time. Pain-medication correlation analysis shows which medications help specific body zones. All on-device.

### Files Changed
- `modules/meds/src/pain/engine.ts` -- Heatmap calculation, active zones, medication correlation
- `modules/meds/src/pain/body-zones.ts` -- 36 body zone definitions with SVG hitbox coordinates
- `modules/meds/src/pain/__tests__/engine.test.ts` -- Engine tests
- `modules/meds/src/db/pain.ts` -- CRUD for pain entries
- `modules/meds/src/db/schema.ts` -- V4 table definition
- `modules/meds/src/models/pain.ts` -- Zod schemas
- `modules/meds/src/models/index.ts` -- Re-export pain models
- `modules/meds/src/definition.ts` -- V4 migration, add pain screens
- `modules/meds/src/index.ts` -- Export pain engine + types
- `apps/mobile/app/(meds)/pain-map.tsx` -- Interactive body map
- `apps/mobile/app/(meds)/pain-history.tsx` -- Pain history with heatmap
- `apps/web/app/meds/pain/page.tsx` -- Web pain dashboard

### Known Limitations
- SVG body diagram is a simplified silhouette, not an anatomical model. Zones are approximate regions, not precise muscles/joints.
- 36 zones cover major body areas but not fine-grained locations (e.g., individual fingers, specific vertebrae).
- Pain-medication correlation is observational. The engine cannot determine if medication caused the improvement or if the condition naturally resolved.
- No 3D body model (that would require a WebGL/Three.js dependency and significant complexity).

### Context for Next Agent
- The SVG body diagram should be a single `<svg>` element with `<path>` elements for each zone. Each path has an `id` matching the `body_zone` enum value (e.g., `id="lower_back"`). Touch detection uses `onPress` on each path for mobile, `onClick` for web.
- `body-zones.ts` should export a `BODY_ZONES` constant: `Record<BodyZone, { label: string, view: 'front' | 'back', svgPath: string }>`.
- The 1-10 severity scale differs from the existing symptom logging severity (1-5). Do not change the symptom system -- pain is a separate, more granular scale.
- V4 migration: coordinate with other B+C feature tables.
