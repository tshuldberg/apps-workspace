# Feature Spec: OBD-II Diagnostic Reader

## Metadata
- **Module:** car
- **SPEC-mycar ID:** CR-020
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [0] x2 + CrossModule [1] x1 + PaidUser [4] x1
- **Sprint:** 6+ (complex, multi-sprint)
- **Estimated CC Time:** 12-16 hours (multi-session)
- **Depends On:** none (builds on existing cr_vehicles table and CRUD layer)
- **Blocks:** none (standalone diagnostic capability)

## Business Context

### Why This Feature Exists
Most car owners have no idea what their check engine light means. They either panic and overpay at a dealership, or ignore it until something breaks. OBD-II diagnostic readers demystify vehicle health by translating cryptic fault codes into plain English with severity ratings. The current MyCar module tracks maintenance history retroactively but has zero capability for proactive vehicle health monitoring. Adding BLE-based OBD-II diagnostics transforms MyCar from a record-keeping app into a genuine vehicle health assistant, directly competing with FIXD's $9.99/month subscription and $20 hardware bundle. The key differentiator: MyCar processes all diagnostic data on-device, while FIXD uploads everything to their cloud for monetization.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| FIXD | Yes | Yes ($9.99/mo + $20 device) | Proprietary BLE adapter, real-time monitoring with severity ratings, cloud-based DTC analysis, push notifications for issues, repair cost estimates via cloud API |
| Torque Pro | Yes | $5 one-time | Extensive PID support (200+ PIDs), real-time gauges, data logging to CSV, Google Maps trip tracking, requires ELM327 adapter |
| OBD Auto Doctor | Yes | $24 one-time | Professional-grade diagnostics, freeze frame data, emission readiness, supports multiple OBD protocols, desktop + mobile |
| BlueDriver | Yes | No ($100 device, app free) | Proprietary adapter, repair reports from ASE-certified database, smog check readiness, live data graphing |
| CARFAX Car Care | No | N/A | No OBD-II support; relies on VIN lookup and service history only |
| Simply Auto | No | N/A | No OBD-II support; manual maintenance tracking only |
| Drivvo | No | N/A | No OBD-II support; fuel and expense tracking only |

### Target User
Car owners (25-55) who want to understand what their check engine light means without paying $100+ for a dealer diagnostic visit. Users currently buying FIXD adapters ($20) and paying $9.99/month for the FIXD app subscription, or using Torque Pro with a generic ELM327 adapter. The switching value is strong (3/5) because FIXD's cloud dependency and recurring cost are friction points for privacy-conscious users who just want to read their own car's data. MyCar offers the same DTC reading capability with zero subscription fees and zero cloud uploads - the user buys a $15-25 generic ELM327 BLE adapter once, and MyCar handles the rest.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                                    -- New Zod schemas: DiagnosticSnapshot, DiagnosticCode, LiveDataReading, OBDPid, DTCSeverity
  db/schema.ts                                -- New tables: cr_diagnostic_snapshots, cr_diagnostic_codes, cr_live_data_logs + indexes
  db/crud.ts                                  -- New CRUD: snapshot create/read/delete, code read, live data log/read/purge
  engines/obd-engine.ts                       -- NEW: BLE scan, connect, ELM327 init, DTC read/clear, live data read, DTC lookup
  engines/dtc-database.ts                     -- NEW: Embedded DTC lookup database (~3000 standard codes)
  definition.ts                               -- Migration V3 for 3 new tables
  index.ts                                    -- Re-export new types and engine functions
  __tests__/obd-engine.test.ts                -- NEW: unit tests for OBD engine (protocol parsing, DTC decoding)
  __tests__/dtc-database.test.ts              -- NEW: unit tests for DTC lookup

apps/mobile/app/(car)/
  diagnostics.tsx                              -- NEW: Diagnostics main screen (scan, connect, snapshot list)
  diagnostic-detail.tsx                        -- NEW: Snapshot detail view (DTC list, severity breakdown)
  live-data.tsx                                -- NEW: Real-time data gauges (RPM, coolant, speed, etc.)
  components/
    BleAdapterCard.tsx                         -- NEW: Discovered adapter card with connect button
    DtcCodeCard.tsx                            -- NEW: Individual DTC display with severity badge
    LiveGauge.tsx                              -- NEW: Circular gauge for a single PID value

apps/web/app/car/
  diagnostics/page.tsx                         -- NEW: Diagnostics page (snapshot history only, no BLE on web)
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Dashboard tab
            └── "Vehicle Health" section
                 ├── Check Engine Light status indicator
                 └── "Diagnostics" button ← YOU ARE HERE
                      ├── Adapter scan + connect flow
                      ├── DTC Snapshot list (history)
                      ├── Active DTCs with severity
                      └── Live Data gauges
```

The Diagnostics feature is accessible from:
1. A "Diagnostics" button on the MyCar Dashboard tab (primary entry point)
2. A "Vehicle Health" indicator card that shows check engine light status if a recent snapshot exists
3. A new "Diagnostics" screen entry in the car navigation

### Data Model

```sql
-- New table: cr_diagnostic_snapshots (Migration V3)
CREATE TABLE IF NOT EXISTS cr_diagnostic_snapshots (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    adapter_name TEXT,
    protocol TEXT,
    snapshot_at TEXT NOT NULL,
    dtc_count INTEGER NOT NULL DEFAULT 0,
    mil_status INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: cr_diagnostic_codes (Migration V3)
CREATE TABLE IF NOT EXISTS cr_diagnostic_codes (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL REFERENCES cr_diagnostic_snapshots(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    system TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    is_pending INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: cr_live_data_logs (Migration V3)
CREATE TABLE IF NOT EXISTS cr_live_data_logs (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    pid TEXT NOT NULL,
    pid_name TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    logged_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_diag_snapshots_vehicle_idx
    ON cr_diagnostic_snapshots(vehicle_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS cr_diag_codes_snapshot_idx
    ON cr_diagnostic_codes(snapshot_id);
CREATE INDEX IF NOT EXISTS cr_diag_codes_code_idx
    ON cr_diagnostic_codes(code);
CREATE INDEX IF NOT EXISTS cr_live_data_vehicle_idx
    ON cr_live_data_logs(vehicle_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS cr_live_data_pid_idx
    ON cr_live_data_logs(vehicle_id, pid, logged_at DESC);
```

**system enum values:** `powertrain`, `chassis`, `body`, `network`
**severity enum values:** `info`, `warning`, `critical`
**mil_status:** 0 = MIL (Malfunction Indicator Lamp / check engine light) OFF, 1 = MIL ON

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components, gauge components), `@mylife/module-registry` (Migration type for schema V3)
- **External:** `react-native-ble-plx` (BLE communication, mobile only), `zod` (schema validation). The embedded DTC database is a static JSON asset shipped with the app (~150KB for ~3000 standard codes). No external API calls.
- **Cross-Module:** Minimal. A diagnostic snapshot showing critical DTCs could surface as a warning on the hub dashboard card. The maintenance module could auto-suggest a maintenance record when a DTC is cleared. Both are deferred to a future cross-module sprint.
- **Platform Restriction:** Mobile only for BLE features. Web shows snapshot history but cannot scan/connect/read. The Web Bluetooth API exists but is unreliable across browsers and requires HTTPS, making it unsuitable for V1.

## Functional Requirements

### User Stories
1. As a car owner, I want to connect my phone to a BLE OBD-II adapter so that I can read diagnostic data from my vehicle without visiting a mechanic.
2. As a car owner, I want to see what my check engine light means in plain English with a severity rating, so that I can decide whether it is urgent or safe to drive.
3. As a car owner, I want to read live engine data (RPM, coolant temp, speed) on my phone, so that I can monitor my vehicle's real-time health.
4. As a car owner, I want to save diagnostic snapshots so that I can track my vehicle's health over time and share DTC history with a mechanic.
5. As a car owner, I want to clear diagnostic trouble codes after a repair, so that I can reset my check engine light without visiting a shop.
6. As a privacy-first user, I want all diagnostic processing to happen on my phone without any cloud uploads, so that my vehicle data stays private.

### Behavior Specification

**Scanning for adapters:**
1. User navigates to MyCar > Diagnostics screen.
2. If no adapter has been connected before, the screen shows an onboarding card: "Connect to your OBD-II adapter. Plug a BLE ELM327 adapter into your car's OBD-II port and turn on your ignition."
3. User taps "Scan for Adapters."
4. System requests Bluetooth permission if not already granted.
5. System performs a BLE scan for devices advertising ELM327-compatible services (filtered by known service UUIDs and name prefixes: "OBD", "ELM", "OBDII", "V-LINK", "Vgate").
6. Discovered adapters appear as cards with device name, signal strength indicator, and "Connect" button.
7. Scan runs for 10 seconds, then stops. User can tap "Scan Again" to retry.
8. If no adapters found after scan, show: "No adapters found. Make sure your adapter is plugged in, your ignition is on, and Bluetooth is enabled."

**Connecting to an adapter:**
1. User taps "Connect" on a discovered adapter card.
2. System establishes BLE connection (GATT connect).
3. System sends ELM327 initialization sequence:
   - `ATZ` (reset)
   - `ATE0` (echo off)
   - `ATL0` (linefeeds off)
   - `ATS0` (spaces off)
   - `ATH0` (headers off)
   - `ATSP0` (auto-detect protocol)
   - `0100` (supported PIDs test)
4. If initialization succeeds, system identifies the OBD protocol (e.g., "ISO 15765-4 CAN") and shows "Connected" status with adapter name and protocol.
5. If initialization fails after 3 retries (5-second timeout each), show error: "Could not initialize adapter. Try unplugging and re-plugging it, then scan again."
6. Once connected, the adapter name is saved to cr_settings for quick reconnect.

**Reading DTCs (diagnostic snapshot):**
1. User taps "Read Diagnostics" (or "Scan Vehicle" CTA).
2. System sends OBD-II Mode 03 command to read stored DTCs and Mode 07 to read pending DTCs.
3. System sends Mode 01 PID 01 to read MIL (check engine light) status.
4. System parses the raw hex response into DTC codes (e.g., "P0301").
5. For each DTC code, system performs a local lookup in the embedded DTC database to get: human-readable description, affected system (powertrain/chassis/body/network), severity rating (info/warning/critical).
6. System creates a DiagnosticSnapshot record and associated DiagnosticCode records.
7. Results display on the Diagnostic Detail screen: MIL status (ON/OFF with colored indicator), total DTC count, list of DTC cards sorted by severity (critical first, then warning, then info).
8. Each DTC card shows: code (e.g., "P0301"), system badge (e.g., "Powertrain"), description (e.g., "Cylinder 1 Misfire Detected"), severity badge, pending indicator if applicable.

**Clearing DTCs:**
1. User taps "Clear Codes" button on the Diagnostic Detail screen.
2. System shows confirmation dialog: "This will clear all diagnostic codes and turn off the check engine light. The codes may return if the underlying issue is not fixed. Clear codes?"
3. If user confirms: system sends OBD-II Mode 04 command to clear DTCs and reset MIL.
4. System waits 2 seconds, then re-reads DTCs to confirm they were cleared.
5. If cleared successfully: snapshot updates to show 0 DTCs, MIL OFF. Success toast: "Codes cleared. Check engine light reset."
6. If clear failed: show error: "Could not clear codes. The adapter may have disconnected. Try reconnecting."

**Reading live data:**
1. User taps "Live Data" from the Diagnostics screen (requires active adapter connection).
2. System queries supported PIDs via Mode 01 PID 00/20/40.
3. System displays gauges for supported PIDs. Default PIDs to show (if supported):
   - PID 0C: Engine RPM (0-8000 range, unit: RPM)
   - PID 05: Coolant Temperature (unit: deg F/C based on settings)
   - PID 0D: Vehicle Speed (unit: mph/km/h based on settings)
   - PID 04: Engine Load (0-100%, unit: %)
   - PID 0F: Intake Air Temperature (unit: deg F/C)
   - PID 11: Throttle Position (0-100%, unit: %)
4. Each gauge updates in real-time (polling interval: 500ms per PID, round-robin across displayed PIDs).
5. User can toggle recording on/off. When recording is ON, each PID value is logged to cr_live_data_logs.
6. User can tap a gauge to see a larger view with min/max/average during the current session.

**Viewing snapshot history:**
1. Diagnostics screen shows a "History" section with past snapshots sorted by date (newest first).
2. Each snapshot card shows: date, DTC count, MIL status, adapter name.
3. Tapping a snapshot opens the Diagnostic Detail screen for that snapshot.
4. User can delete old snapshots (swipe to delete or long-press menu).

### Edge Cases

- **Bluetooth permissions denied:** Show info banner: "Bluetooth permission is required to connect to your OBD-II adapter. Enable it in Settings." Link to device settings. All non-BLE features (snapshot history) remain accessible.
- **Bluetooth turned off on device:** Show prompt: "Turn on Bluetooth to scan for OBD-II adapters." Do not auto-enable Bluetooth.
- **Adapter disconnects mid-scan:** Cancel the DTC read gracefully. Show: "Adapter disconnected during scan. Partial data was not saved. Reconnect and try again."
- **Adapter disconnects during live data:** Stop polling immediately. Show "Disconnected" status on all gauges. Preserve any logged data up to the disconnect point.
- **Vehicle ignition off:** ELM327 initialization will fail (no ECU response). Handle as init failure with message: "No ECU response. Make sure your vehicle's ignition is ON (engine running or accessory mode)."
- **Unsupported OBD protocol:** Some older vehicles use protocols that generic ELM327 adapters cannot communicate with. After ATSP0 fails, try protocols 1-9 individually. If all fail: "Your vehicle's OBD protocol is not supported by this adapter."
- **Unknown DTC code:** If a code is not in the embedded database, display it with description "Unknown code - consult a mechanic" and severity "info". Log the unknown code for potential database updates.
- **Very large number of DTCs (20+):** Paginate the DTC list (show 10 at a time with "Show More"). Performance target: snapshot creation with 50 DTCs completes in under 500ms.
- **Concurrent BLE operations:** Only one BLE command can be in-flight at a time. Queue commands and process sequentially with a 3-second per-command timeout.
- **Multiple vehicles, one adapter:** The adapter is connected to whichever car it is physically plugged into. The user must select which vehicle the snapshot belongs to before reading. If only one vehicle exists, auto-select it.
- **No vehicles exist:** Show empty state: "Add a vehicle before running diagnostics" with CTA to add vehicle.
- **App backgrounded during live data:** Stop BLE polling (iOS kills BLE background connections for non-essential apps). On foreground return, prompt to reconnect.
- **Module disabled mid-connection:** BLE connection is severed. No crash. Data from current session (pre-save) is lost.
- **Web platform:** No scan/connect/read functionality. Show snapshot history read from SQLite. Show info banner: "Connect your phone to read vehicle diagnostics. This feature requires Bluetooth."
- **BLE adapter requires pairing PIN:** Some adapters require a PIN (commonly "1234" or "0000"). If pairing fails, prompt: "Your adapter may require a PIN. Check the adapter's manual. Common PINs: 1234, 0000."
- **ELM327 clone/counterfeit adapters:** Many cheap adapters are ELM327 clones with firmware bugs. Handle malformed responses gracefully (parse what you can, skip what you cannot). Log parsing failures for debugging.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Navigating to Diagnostics shows an onboarding card if no adapter has been previously connected, with clear instructions about the required hardware.
- [ ] **AC-2:** Tapping "Scan for Adapters" requests Bluetooth permission (if not granted) and then begins a BLE scan showing discovered adapters as cards.
- [ ] **AC-3:** Each discovered adapter card shows the device name, signal strength, and a "Connect" button.
- [ ] **AC-4:** Tapping "Connect" on an adapter card initiates BLE connection and ELM327 initialization. A loading state shows "Connecting..." with a progress indicator.
- [ ] **AC-5:** After successful connection, the screen shows "Connected" status with adapter name and detected OBD protocol.
- [ ] **AC-6:** Tapping "Read Diagnostics" sends OBD commands and displays results: MIL status, DTC count, and a list of DTC cards sorted by severity.
- [ ] **AC-7:** Each DTC card shows the code, system category badge, human-readable description, severity badge (color-coded), and pending indicator where applicable.
- [ ] **AC-8:** Tapping "Clear Codes" shows a confirmation dialog. Confirming clears DTCs and resets MIL, with visual confirmation of success.
- [ ] **AC-9:** Tapping "Live Data" shows real-time gauges for supported PIDs, updating continuously while connected.
- [ ] **AC-10:** The snapshot history list shows past diagnostic snapshots sorted newest-first, each showing date, DTC count, and MIL status.
- [ ] **AC-11:** Tapping a historical snapshot opens its detail view with full DTC list.
- [ ] **AC-12:** Swiping to delete a snapshot removes it from the list and database.
- [ ] **AC-13:** On web, the Diagnostics page shows snapshot history with an info banner explaining BLE is mobile-only. No scan/connect functionality appears on web.
- [ ] **AC-14:** When the adapter disconnects unexpectedly, a visible status change occurs and the user is prompted to reconnect.
- [ ] **AC-15:** When no vehicles exist, the Diagnostics screen shows an empty state with a CTA to add a vehicle.
- [ ] **AC-16:** When the user has multiple vehicles, a vehicle selector appears before reading diagnostics so the snapshot is associated with the correct vehicle.

### Technical Criteria
- [ ] **TC-1:** Schema migration V3 creates cr_diagnostic_snapshots, cr_diagnostic_codes, and cr_live_data_logs tables with all columns, foreign keys, and indexes, using the cr_ prefix.
- [ ] **TC-2:** BLE scan filters to ELM327-compatible device names/services and times out after 10 seconds.
- [ ] **TC-3:** ELM327 initialization sends the correct AT command sequence (ATZ, ATE0, ATL0, ATS0, ATH0, ATSP0, 0100) and retries up to 3 times on failure.
- [ ] **TC-4:** Mode 03 DTC response parsing correctly decodes hex bytes into standard DTC format (e.g., "43 01 03 01" decodes to "P0301").
- [ ] **TC-5:** Mode 07 pending DTC response parsing correctly identifies pending codes and marks them with is_pending = 1.
- [ ] **TC-6:** Mode 01 PID 01 response correctly extracts MIL status bit (bit A7 of byte A).
- [ ] **TC-7:** DTC lookup returns correct description and severity for all standard P0xxx codes in the embedded database.
- [ ] **TC-8:** Unknown DTC codes return a fallback description ("Unknown code - consult a mechanic") with severity "info".
- [ ] **TC-9:** Mode 04 clear command is sent only after user confirmation and followed by a verification re-read.
- [ ] **TC-10:** Live data PID polling respects a 500ms interval and round-robins across displayed PIDs.
- [ ] **TC-11:** Live data recording persists PID values to cr_live_data_logs with correct timestamps.
- [ ] **TC-12:** BLE commands are queued and processed sequentially (no concurrent writes to the adapter).
- [ ] **TC-13:** Snapshot creation with 50 DTCs completes in under 500ms (SQLite batch insert).
- [ ] **TC-14:** Deleting a snapshot CASCADE-deletes associated diagnostic codes.
- [ ] **TC-15:** Deleting a vehicle CASCADE-deletes all associated snapshots, codes, and live data logs.
- [ ] **TC-16:** The embedded DTC database JSON loads and indexes correctly at app startup (under 200ms parse time).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Diagnostic data must NOT be sent to any server, API, or cloud service. All processing is on-device.
- [ ] **NC-2:** The app must NOT auto-enable Bluetooth without user interaction.
- [ ] **NC-3:** Clearing DTCs must NOT proceed without explicit user confirmation via the confirmation dialog.
- [ ] **NC-4:** BLE operations must NOT crash or freeze if the adapter disconnects mid-command. All BLE calls must have timeouts.
- [ ] **NC-5:** Live data polling must NOT continue when the app is backgrounded (conserve battery and respect iOS BLE background restrictions).
- [ ] **NC-6:** The Diagnostics screen on web must NOT show scan/connect/read functionality. Only snapshot history is available.
- [ ] **NC-7:** Partial DTC reads (from a mid-scan disconnect) must NOT be saved as a snapshot. Only complete reads are persisted.
- [ ] **NC-8:** The ELM327 initialization must NOT hang indefinitely. Each command has a 5-second timeout with a maximum of 3 retries.

## UI Specification

### Mobile (Expo)

**Diagnostics Main Screen:**
- Background: `#0A0A0F` (background token)
- Top section: Connection status card
  - Disconnected: `rgba(255,255,255,0.04)` glass card, adapter icon (gray), "Not Connected" text, "Scan for Adapters" button in accent color (`#6366F1`)
  - Connected: glass card with green border (`#30D158`), adapter icon (green), adapter name, protocol, "Disconnect" button
- Middle section: Action buttons (only when connected)
  - "Read Diagnostics" - primary button, accent color background, full width
  - "Live Data" - secondary button, glass background with accent border
  - "Clear Codes" - tertiary button, glass background with danger border (`#FF453A`)
- Bottom section: "Snapshot History" list
  - Section header: "History" in `textSecondary` color
  - Snapshot cards: glass background, date (primary text), "X codes found" (secondary text), MIL indicator dot (red if ON, green if OFF)
  - Empty history: "No diagnostic snapshots yet" with car health icon
- Module accent: `#6366F1` (indigo, from definition.ts)

**Adapter Scan Overlay (modal):**
- Semi-transparent backdrop: `rgba(10, 10, 15, 0.85)` with blur
- Scanning indicator: pulsing ring animation in accent color
- Discovered adapter cards: glass background, device name (primary), signal strength bars, "Connect" button
- "Scan Again" button at bottom
- "Cancel" button to dismiss

**Diagnostic Detail Screen (snapshot view):**
- MIL status banner at top:
  - MIL ON: `#FF453A` background, exclamation icon, "Check Engine Light ON"
  - MIL OFF: `#30D158` background, checkmark icon, "Check Engine Light OFF"
- DTC count summary: "X Active Codes, Y Pending Codes"
- DTC card list, sorted by severity:
  - Critical: left border `#FF453A`, exclamation icon
  - Warning: left border `#FFD60A`, alert triangle icon
  - Info: left border `#30D158`, info circle icon
- Each DTC card: glass background, code in monospace font (large), system badge pill (e.g., "Powertrain" in muted color), description text, severity badge, "Pending" indicator if applicable
- "Clear Codes" button at bottom (danger style)
- Notes field: editable text area for user annotations

**Live Data Screen:**
- Grid layout: 2 columns of circular gauges
- Each gauge:
  - Outer ring: `rgba(255,255,255,0.06)` track, accent color for filled portion
  - Center: current value in large text, PID name below in small text, unit label
  - Min/max labels at gauge edges
- "Record" toggle button: red dot indicator when recording is active
- "Back" button returns to Diagnostics screen
- Disconnected state: all gauges show "--" with "Disconnected" label

### Web (Next.js)

- Route: `/car/diagnostics`
- Same tokens via CSS variables
- Layout: sidebar navigation (existing), main content area
- **No BLE functionality on web.** Show info banner at top: "Vehicle diagnostics require a Bluetooth connection. Use the MyCar mobile app to scan your vehicle."
- Snapshot history list with the same card design as mobile (glass morphism via backdrop-filter)
- Tapping a snapshot opens detail view in main content area (not modal)
- DTC cards use the same color-coded severity system
- No scan/connect/live data sections visible

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty (no vehicles) | Centered car icon, "Add a vehicle before running diagnostics" + CTA button | No vehicles in cr_vehicles |
| Empty (no snapshots) | Connection status card + action buttons (if connected) + "No diagnostic snapshots yet" | Vehicle exists but no snapshots |
| Disconnected | Connection card showing "Not Connected", "Scan for Adapters" button, snapshot history visible | No BLE connection active |
| Scanning | Modal overlay with pulsing scan animation, discovered adapters appearing | BLE scan in progress |
| Connecting | Connection card showing "Connecting..." with spinner | BLE GATT connection + ELM327 init in progress |
| Connected | Green-bordered connection card, action buttons enabled | BLE connection established and ELM327 initialized |
| Reading | "Reading diagnostics..." overlay with progress | OBD commands being sent and parsed |
| Error (BLE) | Red banner: "Adapter disconnected" or "Could not initialize adapter" + retry button | BLE connection failure or init failure |
| Error (permissions) | Info banner: "Bluetooth permission required" + link to Settings | Bluetooth permission denied |
| Success (no codes) | MIL OFF banner, "No diagnostic trouble codes found. Your vehicle is healthy!" | DTC read returns zero codes |
| Success (codes found) | MIL status banner, DTC card list sorted by severity | DTC read returns one or more codes |
| Live Data Active | Grid of updating gauges with values | Live data polling active |
| Live Data Disconnected | Gauges show "--", "Disconnected" label | Adapter disconnected during live data |
| Web (read-only) | Snapshot history + info banner about mobile requirement | Viewing diagnostics on web |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/obd-engine.test.ts)
- [ ] `parseDtcResponse`: correctly decodes Mode 03 response "43 01 03 01" into DTC "P0301"
- [ ] `parseDtcResponse`: correctly decodes "43 00 00 00" as no DTCs
- [ ] `parseDtcResponse`: correctly handles multi-frame response with 5+ DTCs
- [ ] `parseDtcResponse`: handles "B", "C", and "U" prefix codes (body, chassis, network)
- [ ] `parseDtcResponse`: returns empty array for malformed/empty response
- [ ] `parsePendingDtcResponse`: correctly parses Mode 07 response and marks codes as pending
- [ ] `parseMilStatus`: extracts MIL ON from byte where bit A7 is set
- [ ] `parseMilStatus`: extracts MIL OFF from byte where bit A7 is clear
- [ ] `parseMilStatus`: returns false for malformed response
- [ ] `parsePidValue(0x0C)`: correctly computes RPM from two-byte response (formula: (A*256+B)/4)
- [ ] `parsePidValue(0x05)`: correctly computes coolant temp from single byte (formula: A-40)
- [ ] `parsePidValue(0x0D)`: correctly reads vehicle speed from single byte
- [ ] `parsePidValue(0x04)`: correctly computes engine load percentage (formula: A*100/255)
- [ ] `parsePidValue`: returns null for unsupported PID
- [ ] `buildElm327InitSequence`: returns correct AT command array in order
- [ ] `buildDtcReadCommand`: returns "03" for stored DTCs
- [ ] `buildDtcClearCommand`: returns "04" for clear
- [ ] `buildPidReadCommand(0x0C)`: returns "010C" for RPM
- [ ] `classifyDtcSystem("P0301")`: returns "powertrain"
- [ ] `classifyDtcSystem("B0100")`: returns "body"
- [ ] `classifyDtcSystem("C0100")`: returns "chassis"
- [ ] `classifyDtcSystem("U0100")`: returns "network"

### Unit Tests (modules/car/src/__tests__/dtc-database.test.ts)
- [ ] `lookupDtc("P0300")`: returns description "Random/Multiple Cylinder Misfire Detected" and severity "critical"
- [ ] `lookupDtc("P0420")`: returns description containing "Catalyst System Efficiency" and severity "warning"
- [ ] `lookupDtc("P0171")`: returns description containing "System Too Lean" and severity "warning"
- [ ] `lookupDtc("PFFFF")`: returns fallback description for unknown code
- [ ] `lookupDtc`: database contains at least 2500 entries
- [ ] `getDtcSeverity`: all P03xx (misfire) codes are rated "critical"
- [ ] `getDtcSeverity`: P04xx (emission) codes are rated "warning"
- [ ] `getDtcSeverity`: returns "info" for codes without explicit severity mapping

### Integration Tests
- [ ] Full flow: create vehicle, create snapshot with 3 DTCs, verify snapshot and codes persisted in SQLite, detail screen shows correct data
- [ ] Full flow: create snapshot, delete snapshot, verify CASCADE deletes associated codes
- [ ] Full flow: delete vehicle, verify all snapshots, codes, and live data logs are CASCADE-deleted
- [ ] Full flow: log 50 live data readings, verify all persisted with correct vehicle_id, pid, value, unit, timestamps
- [ ] Error flow: malformed DTC response from adapter, no snapshot created, error message shown to user
- [ ] Error flow: BLE disconnect mid-read, no partial snapshot saved, reconnect prompt shown

### QA Verification Script

1. Open the app on iOS simulator or physical device.
2. Navigate to MyCar module. Ensure at least one vehicle exists (add one if needed).
3. Navigate to Dashboard tab. Verify a "Diagnostics" section or button is visible. -- Verifies navigation entry point.
4. Tap "Diagnostics." Verify the Diagnostics screen loads with connection status card and empty history state. -- Corresponds to AC-1, AC-15 (skip if vehicle exists).
5. Tap "Scan for Adapters." If Bluetooth permission prompt appears, grant it. -- Corresponds to AC-2.
6. **Verify:** A scan overlay/modal appears with a scanning animation. -- Corresponds to AC-2.
7. If a BLE ELM327 adapter is available and plugged into a car with ignition on: verify adapter cards appear with device name and signal strength. -- Corresponds to AC-3.
8. If no physical adapter available: verify "No adapters found" message appears after 10 seconds. Dismiss and verify snapshot history (empty) is still accessible. -- Edge case coverage.
9. (With adapter) Tap "Connect" on an adapter card. -- Corresponds to AC-4.
10. **Verify:** Loading state shows "Connecting..." with a progress indicator. -- Corresponds to AC-4.
11. **Verify:** After successful connection, "Connected" status shows adapter name and OBD protocol. -- Corresponds to AC-5.
12. Tap "Read Diagnostics." -- Corresponds to AC-6.
13. **Verify:** Reading progress indicator appears briefly. -- Covers reading state.
14. **Verify:** Results display: MIL status banner (ON/OFF), DTC count, list of DTC cards sorted by severity. -- Corresponds to AC-6, AC-7.
15. **Verify:** Each DTC card shows code, system badge, description, severity badge. -- Corresponds to AC-7.
16. **Verify:** A snapshot entry appears in the History section. -- Corresponds to AC-10.
17. Tap "Clear Codes." -- Corresponds to AC-8.
18. **Verify:** Confirmation dialog appears with warning text. -- Corresponds to AC-8.
19. Tap "Confirm." -- Corresponds to AC-8.
20. **Verify:** Codes are cleared, MIL status updates to OFF (if codes existed). Success toast appears. -- Corresponds to AC-8.
21. Tap "Live Data." -- Corresponds to AC-9.
22. **Verify:** Gauge grid appears with real-time updating values for RPM, coolant temp, speed, etc. -- Corresponds to AC-9.
23. Toggle "Record" on. Wait 10 seconds. Toggle "Record" off. -- Covers live data logging.
24. Navigate back to Diagnostics. Tap a snapshot in History. -- Corresponds to AC-11.
25. **Verify:** Detail view opens with full DTC list for that snapshot. -- Corresponds to AC-11.
26. Swipe to delete a snapshot. -- Corresponds to AC-12.
27. **Verify:** Snapshot is removed from the list. -- Corresponds to AC-12.
28. Disconnect the adapter (unplug or turn off Bluetooth). -- Corresponds to AC-14.
29. **Verify:** Status changes to "Disconnected" with reconnect prompt. -- Corresponds to AC-14.
30. Open the web app at `/car/diagnostics`. -- Corresponds to AC-13.
31. **Verify:** Snapshot history is visible. Info banner explains BLE is mobile-only. No scan/connect buttons. -- Corresponds to AC-13.
32. Add a second vehicle on mobile. Navigate to Diagnostics with adapter connected. -- Corresponds to AC-16.
33. **Verify:** Vehicle selector appears before reading diagnostics. -- Corresponds to AC-16.
34. Delete all vehicles. Navigate to Diagnostics. -- Corresponds to AC-15.
35. **Verify:** Empty state shows "Add a vehicle before running diagnostics" with CTA. -- Corresponds to AC-15.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 10 (Massive, Complexity raw score 0), ALL gstack skills are REQUIRED. This is the most technically challenging Car feature.

### Required for ALL features:
- [ ] `/function-gate-runner` - run after code changes, must pass
- [ ] `/review` - run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` - navigate to `/car/diagnostics`, click every button, verify all states (loading, empty, disconnected, scanning, connecting, connected, reading, error-ble, error-permissions, success-no-codes, success-codes-found, live-data-active, live-data-disconnected, web-read-only)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` - run on this spec BEFORE building. Fix issues found. **MANDATORY for this feature.**

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) - validate BLE integration approach, ELM327 protocol handling, and DTC database strategy before spec finalization. **MANDATORY for this feature.**

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` - generate eval suite for `obd-engine.ts` (DTC parsing, PID value computation, ELM327 protocol handling)
- [ ] `/domain-engine-benchmarker` - generate eval suite for `dtc-database.ts` (DTC lookup, severity classification)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` - car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`
- [ ] `/design-review` - batch visual QA (mandatory for Massive features per pipeline)

## Handoff State

### Before This Work
- Car module has 5 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings, cr_maintenance_schedules
- Schema version 2 with migrations V1 and V2
- No diagnostic capability exists. No BLE integration. No DTC database.
- The module is a passive maintenance and fuel log recorder with no live vehicle communication.
- No `react-native-ble-plx` dependency in the project.

### After This Work
- Car module has 8 tables (new: cr_diagnostic_snapshots, cr_diagnostic_codes, cr_live_data_logs) with 5 new indexes
- Schema version 3, migration V3 added
- Full OBD-II diagnostic lifecycle: BLE scan, adapter connect, ELM327 initialize, DTC read/parse/store, DTC clear, live data read/log
- Embedded DTC database with ~3000 standard codes and severity ratings
- `obd-engine.ts` contains BLE management, ELM327 protocol layer, OBD-II command builders, and response parsers
- `dtc-database.ts` contains the DTC lookup and severity classification functions
- Mobile: full BLE diagnostic flow with scan, connect, read, clear, live data gauges
- Web: snapshot history view only (no BLE)
- New dependency: `react-native-ble-plx` added to mobile app

### Files Changed

- `modules/car/src/types.ts` - Add DiagnosticSnapshotSchema, DiagnosticCodeSchema, LiveDataReadingSchema, OBDPidSchema, DTCSeveritySchema, DtcSystemSchema Zod schemas and types
- `modules/car/src/db/schema.ts` - Add CREATE_DIAGNOSTIC_SNAPSHOTS, CREATE_DIAGNOSTIC_CODES, CREATE_LIVE_DATA_LOGS tables, 5 new indexes
- `modules/car/src/db/crud.ts` - Add snapshot CRUD (createSnapshot, getSnapshotsByVehicle, getSnapshotById, deleteSnapshot), code read (getCodesBySnapshot), live data CRUD (logLiveData, getLiveDataByVehicle, purgeLiveDataOlderThan)
- `modules/car/src/engines/obd-engine.ts` - NEW: scanForAdapters, connectToAdapter, initializeElm327, readDtcs, clearDtcs, readLiveData, parseDtcResponse, parsePendingDtcResponse, parseMilStatus, parsePidValue, buildElm327InitSequence, buildDtcReadCommand, buildDtcClearCommand, buildPidReadCommand, classifyDtcSystem
- `modules/car/src/engines/dtc-database.ts` - NEW: lookupDtc, getDtcSeverity, loadDtcDatabase, DTC_DATABASE constant
- `modules/car/src/engines/dtc-data.json` - NEW: embedded DTC database (~3000 entries, ~150KB)
- `modules/car/src/definition.ts` - Add CAR_MIGRATION_V3, update schemaVersion to 3
- `modules/car/src/index.ts` - Re-export new types and engine functions
- `modules/car/src/__tests__/obd-engine.test.ts` - NEW: 22+ unit tests for OBD engine parsing and command building
- `modules/car/src/__tests__/dtc-database.test.ts` - NEW: 8+ unit tests for DTC lookup and severity
- `apps/mobile/app/(car)/diagnostics.tsx` - NEW: Diagnostics main screen (scan, connect, snapshot history)
- `apps/mobile/app/(car)/diagnostic-detail.tsx` - NEW: Snapshot detail view (DTC list, severity breakdown)
- `apps/mobile/app/(car)/live-data.tsx` - NEW: Real-time gauge display
- `apps/mobile/app/(car)/components/BleAdapterCard.tsx` - NEW: Discovered adapter card
- `apps/mobile/app/(car)/components/DtcCodeCard.tsx` - NEW: DTC display card with severity
- `apps/mobile/app/(car)/components/LiveGauge.tsx` - NEW: Circular gauge component
- `apps/web/app/car/diagnostics/page.tsx` - NEW: Diagnostics page (snapshot history, no BLE)

### Known Limitations
- V1 supports only generic ELM327-compatible BLE adapters. Proprietary adapters (FIXD, BlueDriver) use non-standard protocols and are not supported.
- V1 does not support Wi-Fi OBD-II adapters (only BLE).
- Live data PID support depends on the vehicle's ECU. Not all PIDs are available on all vehicles.
- The embedded DTC database covers standard (SAE J2012) codes. Manufacturer-specific codes (P1xxx, P3xxx) have limited coverage.
- No freeze frame data (Mode 02) in V1 - this provides the sensor values at the time a DTC was set.
- No emission readiness (Mode 06) monitoring in V1.
- No continuous monitoring or background scanning - user must manually initiate each diagnostic read.
- Web platform has no diagnostic read capability - only history viewing.
- iOS may require the app to declare Bluetooth usage in Info.plist with a usage description string.

### Context for Next Agent
- The `react-native-ble-plx` library requires native module linking. On iOS, the `NSBluetoothAlwaysUsageDescription` key must be added to `Info.plist`. On Android, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `ACCESS_FINE_LOCATION` permissions must be declared in `AndroidManifest.xml`.
- ELM327 communication is text-based over BLE serial. Each command is sent as a UTF-8 string terminated by a carriage return (`\r`). Responses are also text, terminated by `>` (the ELM327 prompt character). Parse responses by splitting on `\r` and filtering empty lines.
- DTC codes are encoded in 2 bytes. The first 2 bits determine the system prefix (00=P, 01=C, 10=B, 11=U). The remaining 14 bits form the numeric code. Example: hex `0103` = binary `0000 0001 0000 0011` = P0103.
- The `react-native-ble-plx` library uses a singleton `BleManager`. Create it once at engine initialization, not per-scan. Dispose it when the module is disabled.
- Live data polling should use `requestAnimationFrame` or `setInterval` with a 500ms delay, not tight loops. Each PID read takes ~50-100ms over BLE, so polling 6 PIDs takes ~300-600ms per cycle.
- The DTC database JSON should be lazy-loaded (not imported at module registration time) to avoid blocking app startup. Load it on first diagnostic screen mount.
- Separate the BLE transport layer (scan, connect, send, receive) from the OBD protocol layer (command building, response parsing) in the engine. This makes the protocol layer unit-testable without mocking BLE.
