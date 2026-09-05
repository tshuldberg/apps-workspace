# Feature Spec: PIN/Biometric Lock

## Metadata
- **Module:** mood
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [4] x1 + PaidUser [3] x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (standalone security feature)
- **Blocks:** none (but establishes a pattern reusable hub-wide)

## Business Context

### Why This Feature Exists
Mood tracking data is among the most sensitive personal information a user can generate. Logging emotions like "despair" or "rage" alongside activity correlations and journal notes creates a deeply private dataset. Users who share devices with family members or coworkers need confidence that nobody who picks up their phone can read their mood entries. Daylio (20M users, $35.99/yr) offers PIN lock as a core feature, and its absence in MyMood is a direct barrier to switching for privacy-conscious Daylio users. The high cross-module score (4/5) reflects that this pattern can be extended hub-wide to protect any sensitive module (Journal, Health, Cycle).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Daylio | Yes | Yes ($35.99/yr) | PIN lock with biometric option, locks on app switch, configurable timeout |
| Bearable | No | N/A | No lock feature |
| Reflectly | No | N/A | No lock feature |
| Calm | No | N/A | No lock feature (not a mood tracker) |

### Target User
Privacy-conscious mood trackers (18-55) who share devices with family, roommates, or coworkers. Daylio users ($35.99/yr) who want the same privacy lock but bundled in a hub. Also therapy-supported users who log sensitive emotional content and need assurance that their data is protected from casual device access.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                                  -- New schemas: ModuleLockConfig, LockMethod, LockTimeout
  db/schema.ts                              -- New table: mo_module_lock
  db/crud.ts                                -- New CRUD: lock config get/set/reset
  definition.ts                             -- Migration v2 (shared with other v2 features) or v3
  index.ts                                  -- Re-export new types

apps/mobile/app/(mood)/
  lock-screen.tsx                           -- NEW: Full-screen lock overlay
  lock-settings.tsx                         -- NEW: Privacy Lock settings screen
  components/LockGate.tsx                   -- NEW: Wrapper component for mood module root

apps/web/app/mood/
  lock/page.tsx                             -- NEW: Lock screen (web)
  settings/lock/page.tsx                    -- NEW: Lock settings (web)
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── [LOCK GATE] ← intercepts ALL access when enabled
            ├── Today tab
            ├── History tab
            ├── Insights tab
            └── Settings tab
                 └── Privacy & Security
                      └── App Lock ← YOU ARE HERE (configuration)
```

The lock gate intercepts ALL navigation into the mood module. The only screen accessible without authentication is the lock screen itself and the lock settings screen (which requires authentication to modify lock config).

### Data Model

```sql
-- New table: mo_module_lock (Migration v2 or v3)
-- Stores lock configuration only. PIN hash stored in platform secure storage (Keychain/Keystore).
CREATE TABLE IF NOT EXISTS mo_module_lock (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    is_enabled INTEGER NOT NULL DEFAULT 0,
    method TEXT,
    lock_timeout_seconds INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**method enum values:** `pin`, `biometric`, `biometricWithPin`

**lock_timeout_seconds values:** `0` (immediately), `60` (1 minute), `300` (5 minutes), `900` (15 minutes)

**Important:** The PIN hash and salt are stored in `expo-secure-store` (iOS Keychain / Android Keystore), NOT in SQLite. The `mo_module_lock` table stores only configuration metadata (method, timeout, failed attempt count, lockout timestamp).

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens)
- **External:**
  - `expo-local-authentication` -- biometric authentication (Face ID, Touch ID, fingerprint)
  - `expo-secure-store` -- secure PIN hash storage (Keychain on iOS, Keystore on Android)
  - `expo-crypto` -- SHA-256 hashing for PIN with salt
  - `zod` -- schema validation
- **Cross-Module:** None directly, but this pattern is designed to be extractable to a hub-level `@mylife/module-lock` package in the future. Keep the lock engine generic (accepts module ID, lock config) so it can be reused.

## Functional Requirements

### User Stories
1. As a privacy-conscious user, I want to lock MyMood behind a PIN or biometric authentication, so that nobody who picks up my device can read my mood entries.
2. As a user sharing a device with family, I want the lock to engage every time I leave the mood module, so my mood data is never visible to others.
3. As a user who forgets PINs, I want to use Face ID or fingerprint as my primary unlock method, so I can access my data quickly.
4. As a security-conscious user, I want the app to lock out after 5 failed PIN attempts, so brute-force attacks are prevented.

### Behavior Specification

**Enabling the lock (first time):**
1. User navigates to MyMood > Settings > Privacy & Security > App Lock.
2. User toggles "Enable Lock" on.
3. Lock method selector appears: "PIN Only", "Biometric Only", "Biometric + PIN".
4. If user selects "PIN Only" or "Biometric + PIN":
   - PIN setup screen: 4-6 digit numeric keypad with dot indicators.
   - User enters PIN. Prompt: "Confirm your PIN". User re-enters.
   - If PINs match: PIN is hashed with a random salt via SHA-256, hash+salt stored in expo-secure-store.
   - If PINs don't match: shake animation, "PINs don't match. Try again."
5. If user selects "Biometric Only":
   - System checks `expo-local-authentication` for available biometric types.
   - If biometric available: prompt user to verify with biometric to confirm setup.
   - If no biometric available: show "Biometric not available on this device. Set up a PIN instead." and gray out the option.
6. Lock timeout selector: "Immediately" (default), "1 minute", "5 minutes", "15 minutes".
7. Lock is now active. The `mo_module_lock` record is created/updated.

**Lock engagement:**
1. Lock engages when the user navigates away from the mood module (exits to hub dashboard or another module).
2. If lock_timeout_seconds > 0: a timer starts. If the user returns within the timeout, no re-authentication required.
3. Lock also engages when the app returns from background (AppState changes from background to active) after the timeout has elapsed.
4. The lock timestamp is stored in memory (not persisted) to track when the last successful auth occurred.

**Lock screen (authentication):**
1. When the user navigates to MyMood and the lock is engaged:
2. Full-screen overlay appears covering all mood content.
3. Center: MyMood icon (mood emoji) + "MyMood is Locked" text.
4. Below: authentication input based on configured method.
   - PIN: dot indicators (4-6 dots) + numeric keypad (0-9) + backspace.
   - Biometric: "Use [Face ID/Touch ID] to unlock" with biometric icon. Biometric prompt fires automatically.
   - Biometric + PIN: biometric prompt first, "Use PIN instead" link below.
5. On correct PIN entry: unlock animation (brief scale + fade), lock screen dismisses, mood content visible.
6. On biometric success: same unlock animation.
7. On wrong PIN: "Incorrect PIN" with shake animation, failed_attempts increments.
8. On biometric failure: "Try again" with biometric retry button, or "Use PIN instead" link.

**Brute-force protection:**
1. After 5 consecutive failed PIN attempts:
2. Module locks for 5 minutes. Display: "Too many attempts. Try again in 5:00" with countdown.
3. `locked_until` is set to now + 5 minutes in mo_module_lock.
4. The countdown is visible. When it reaches 0, the keypad re-enables.
5. Successful authentication resets failed_attempts to 0.

**Changing lock settings:**
1. User navigates to Settings > Privacy & Security > App Lock (already authenticated since they're inside the module).
2. Changing method or timeout: applies immediately, updates mo_module_lock.
3. Changing PIN: requires entering current PIN first, then new PIN + confirm.
4. Disabling lock: requires current PIN or biometric, then toggles is_enabled = 0.

**Resetting the lock (forgot PIN):**
1. On the lock screen, link: "Forgot PIN?"
2. If biometric is configured (biometricWithPin method): prompt biometric. On success, navigate to PIN reset flow.
3. If PIN-only: display message "To reset your PIN, you'll need to clear MyMood's app data. Your mood entries will be preserved but the lock will be removed." This is an intentional trade-off favoring security.

### Edge Cases

- **Device does not support biometrics:** "Biometric Only" and "Biometric + PIN" options are grayed out with "Not available on this device." PIN-only is always available.
- **User removes biometric enrollment (e.g., deletes all fingerprints) after setup:** On next biometric prompt, the system returns an error. Fall back to PIN if configured (biometricWithPin), or show "Biometric no longer available. Please reconfigure your lock in Settings."
- **App killed and relaunched during lockout:** `locked_until` is persisted in SQLite. On relaunch, check if current time < locked_until and re-display countdown.
- **Clock manipulation (user changes device time to bypass lockout):** `locked_until` is compared against `Date.now()`. If the device clock jumps backward, the lockout may be bypassed. This is an acceptable trade-off for an on-device privacy feature (not a high-security banking app).
- **Lock screen appears over push notifications:** Notification content should be hidden when lock is enabled. Set notification body to "MyMood" instead of "Time to log your mood!" when lock is active.
- **Module disabled while lock is enabled:** Lock is effectively bypassed (module not accessible anyway). Lock config preserved.
- **User switches between PIN and Biometric methods:** Old PIN hash remains in secure store until explicitly cleared. Switching to biometric does not delete the PIN.
- **Very rapid PIN entry (auto-fill or paste attack):** Each digit press is debounced at 50ms. Submission is throttled to 1 attempt per 500ms.
- **expo-secure-store unavailable (older Android without Keystore):** Fall back to encrypted-at-rest storage. PIN functionality still works but with reduced hardware security. Display a one-time info note.
- **User navigates to mood via deep link while locked:** Lock screen intercepts the deep link navigation. After authentication, the deep link destination is preserved and navigated to.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Enabling lock and setting a 4-digit PIN via the setup flow saves successfully. Exiting and re-entering MyMood presents the lock screen.
- [ ] **AC-2:** Entering the correct PIN on the lock screen unlocks the module with a brief animation.
- [ ] **AC-3:** Entering an incorrect PIN shows a shake animation and "Incorrect PIN" message.
- [ ] **AC-4:** After 5 incorrect PINs, the lockout screen appears with a 5-minute countdown timer.
- [ ] **AC-5:** After the lockout timer expires, the PIN keypad is re-enabled and a correct PIN unlocks the module.
- [ ] **AC-6:** Biometric lock (Face ID/Touch ID) prompts automatically when the lock screen appears.
- [ ] **AC-7:** Biometric success unlocks the module. Biometric failure shows "Try again" with a retry button.
- [ ] **AC-8:** "Biometric + PIN" mode shows biometric first, with "Use PIN instead" link that switches to PIN keypad.
- [ ] **AC-9:** Lock timeout "Immediately" requires re-auth every time the user leaves and returns to mood.
- [ ] **AC-10:** Lock timeout "5 minutes" allows re-entry without auth if the user returns within 5 minutes.
- [ ] **AC-11:** Disabling the lock requires current PIN or biometric authentication.
- [ ] **AC-12:** Changing the PIN requires entering the current PIN first, then new PIN + confirmation.
- [ ] **AC-13:** Devices without biometric hardware show biometric options grayed out with "Not available."

### Technical Criteria
- [ ] **TC-1:** PIN hash + salt stored in expo-secure-store (iOS Keychain / Android Keystore), not in SQLite.
- [ ] **TC-2:** PIN hashed with SHA-256 using a cryptographically random salt (at least 16 bytes).
- [ ] **TC-3:** `mo_module_lock` table created with singleton constraint (id = 'singleton').
- [ ] **TC-4:** `failed_attempts` increments on each wrong PIN and resets to 0 on successful auth.
- [ ] **TC-5:** `locked_until` is persisted to SQLite and survives app kill/relaunch.
- [ ] **TC-6:** Lock state check runs synchronously before any mood screen renders (no flash of content).
- [ ] **TC-7:** `expo-local-authentication` `hasHardwareAsync()` and `isEnrolledAsync()` checked before offering biometric options.
- [ ] **TC-8:** Lock timeout tracked in memory (last successful auth timestamp), not persisted to disk.
- [ ] **TC-9:** PIN submission throttled to 1 attempt per 500ms to prevent rapid-fire brute force.
- [ ] **TC-10:** Notification content hidden ("MyMood" only, no mood details) when lock is enabled.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** PIN must NEVER be stored in plaintext anywhere (SQLite, AsyncStorage, logs, or debug output).
- [ ] **NC-2:** Mood data must NOT flash on screen before the lock screen renders. The lock gate must intercept navigation synchronously.
- [ ] **NC-3:** Failed attempt count must NOT reset on app restart (persisted in SQLite).
- [ ] **NC-4:** Disabling the lock must NOT be possible without authenticating first.
- [ ] **NC-5:** Lock configuration changes must NOT affect mood entry data (no reads, writes, or deletes to mo_entries).

## UI Specification

### Mobile (Expo)

**Lock Screen:**
- Full-screen overlay: `#0A0A0F` (background token), covers entire mood module
- Center: MyMood emoji icon (large, 64px) + "MyMood is Locked" in text color
- PIN mode: 4-6 dot indicators (empty circles, fill with accent color on digit entry), numeric keypad (0-9) in a 3x4 grid + backspace, glass card background
- Biometric mode: biometric icon (Face ID or fingerprint), "Use [Face ID] to unlock" text, tap to retry
- Combined mode: biometric prompt auto-fires, "Use PIN instead" link in textSecondary below
- Failed state: dots shake horizontally (300ms), "Incorrect PIN" in danger color (`#FF453A`), attempt counter "2 of 5"
- Lockout state: "Too many attempts" in danger color, countdown timer "Try again in 4:32", keypad disabled (opacity 0.3)
- Module accent: `#FB923C` (orange, dot fill color and active elements)

**Lock Settings Screen:**
- Background: `#0A0A0F`
- "Privacy Lock" title at top
- Master toggle: "Enable Lock" with switch component
- When enabled:
  - Method selector: segmented control "PIN" / "Biometric" / "Both" (glass background)
  - Timeout selector: list of radio options "Immediately", "1 minute", "5 minutes", "15 minutes"
  - "Change PIN" button (if PIN configured): glass card, accent color text
  - "Reset Lock" button: glass card, danger color text

### Web (Next.js)

- Lock screen at `/mood/lock` route (full-page, no sidebar visible)
- PIN input via a focused numeric text field (styled as dot indicators), keyboard input only (no on-screen keypad)
- Biometric not available on web; PIN-only lock
- Lock settings at `/mood/settings/lock`
- Same glass morphism styling via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Disabled | No lock screen, direct access to mood | Lock not enabled in settings |
| Locked (PIN) | Full-screen lock with keypad | Navigating to mood with PIN lock enabled |
| Locked (Biometric) | Full-screen lock with biometric prompt | Navigating to mood with biometric lock |
| PIN Entry | Dots filling as digits are entered | User typing on keypad |
| Failed Attempt | Shake animation, attempt counter | Wrong PIN entered |
| Lockout | Countdown timer, disabled keypad | 5 consecutive failed PINs |
| Unlocked | Lock screen dismisses, mood content visible | Correct auth |
| Settings | Lock configuration form | User in Settings > Privacy > App Lock |

## Test Requirements

### Unit Tests
- [ ] `hashPin`: produces different hashes for different PINs with same salt
- [ ] `hashPin`: produces same hash for same PIN and salt (deterministic)
- [ ] `verifyPin`: returns true for correct PIN, false for incorrect
- [ ] `checkLockout`: returns locked = true when failed_attempts >= 5 and locked_until > now
- [ ] `checkLockout`: returns locked = false when locked_until < now (expired)
- [ ] `checkLockout`: resets failed_attempts on successful auth
- [ ] `isTimeoutElapsed`: returns true when last_auth + timeout < now
- [ ] `isTimeoutElapsed`: returns false when last_auth + timeout > now
- [ ] `isTimeoutElapsed`: returns true (lock immediately) when timeout = 0
- [ ] `getLockConfig`: returns null when no lock configured
- [ ] `getLockConfig`: returns config with correct method and timeout
- [ ] Zod validation: rejects PIN shorter than 4 digits
- [ ] Zod validation: rejects PIN longer than 6 digits
- [ ] Zod validation: rejects non-numeric PIN
- [ ] Zod validation: accepts valid lock methods (pin, biometric, biometricWithPin)
- [ ] Zod validation: accepts valid timeout values (0, 60, 300, 900)

### Integration Tests
- [ ] Full flow: enable lock, set PIN, exit module, re-enter, verify lock screen appears, enter correct PIN, verify unlock
- [ ] Lockout flow: enter wrong PIN 5 times, verify lockout, wait/simulate timeout, enter correct PIN
- [ ] Settings flow: change method from PIN to biometric, verify biometric prompt on next lock
- [ ] Disable flow: disable lock with correct PIN, verify no lock screen on re-entry

### QA Verification Script

1. Open the app on iOS simulator with Face ID enabled.
2. Navigate to MyMood > Settings > Privacy & Security > App Lock.
3. Toggle "Enable Lock" on. Select "PIN Only". Enter PIN "1234", confirm "1234". Set timeout "Immediately". -- Verifies setup flow.
4. Navigate to Hub Dashboard (exit mood). -- Triggers lock engagement.
5. Tap MyMood card to re-enter. Verify full-screen lock screen with PIN keypad. -- Corresponds to AC-1.
6. Enter wrong PIN "5678". Verify shake animation and "Incorrect PIN (1 of 5)". -- Corresponds to AC-3.
7. Enter correct PIN "1234". Verify unlock animation and mood content visible. -- Corresponds to AC-2.
8. Exit and re-enter mood. Enter wrong PIN 5 times. Verify lockout with countdown. -- Corresponds to AC-4.
9. Wait for countdown to expire (or simulate). Enter correct PIN. Verify unlock. -- Corresponds to AC-5.
10. Go to Settings > App Lock. Change method to "Biometric + PIN".
11. Exit and re-enter mood. Verify Face ID prompt appears automatically. -- Corresponds to AC-6.
12. Cancel Face ID. Verify "Use PIN instead" link appears. Tap it. Enter PIN. Verify unlock. -- Corresponds to AC-8.
13. Exit and re-enter mood. Allow Face ID to succeed. Verify instant unlock. -- Corresponds to AC-7.
14. Go to Settings > App Lock. Change timeout to "5 minutes".
15. Exit mood. Re-enter within 1 minute. Verify no lock screen. -- Corresponds to AC-10.
16. Wait > 5 minutes (or simulate). Re-enter mood. Verify lock screen appears. -- Corresponds to AC-10.
17. Go to Settings > App Lock. Tap "Change PIN". Verify current PIN required first. Enter current, then new PIN + confirm. -- Corresponds to AC-12.
18. Go to Settings > App Lock. Toggle "Disable Lock". Verify current auth required. Authenticate. Verify lock disabled. -- Corresponds to AC-11.
19. Test on a device/simulator without biometric hardware. Verify biometric options grayed out. -- Corresponds to AC-13.
20. Repeat steps 2-7 on web at `/mood/settings/lock` and `/mood/lock` (PIN only, no biometric on web). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to mood with lock enabled, test all lock states (PIN entry, biometric, failed, lockout, unlocked, settings)
- [ ] Batch QA: after 5 features in mood module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Mood module has no privacy lock or authentication gate
- All mood data (entries, emotions, breathing sessions) is accessible to anyone with device access
- mo_settings exists for key/value preferences but no lock configuration
- No dependency on expo-local-authentication, expo-secure-store, or expo-crypto

### After This Work
- New mo_module_lock table (singleton row) stores lock configuration and lockout state
- PIN hash + salt stored securely in expo-secure-store (never in SQLite)
- LockGate wrapper component intercepts all navigation into mood module
- Full-screen lock screen with PIN keypad, biometric prompt, and lockout timer
- Lock settings screen in Settings > Privacy & Security > App Lock
- Three lock modes: PIN, Biometric, Biometric + PIN
- Configurable timeout: immediately, 1 min, 5 min, 15 min
- Anti-brute-force: 5 failed attempts = 5-minute lockout (persisted)
- Web: PIN-only lock (no biometric on web)

### Files Changed

- `modules/mood/src/types.ts` -- Add ModuleLockConfigSchema, LockMethodSchema, LockTimeoutSchema Zod schemas and types
- `modules/mood/src/db/schema.ts` -- Add CREATE_MODULE_LOCK table
- `modules/mood/src/db/crud.ts` -- Add lock CRUD: getLockConfig, setLockConfig, incrementFailedAttempts, resetFailedAttempts, setLockedUntil
- `modules/mood/src/definition.ts` -- Add migration v2/v3 for mo_module_lock table
- `modules/mood/src/index.ts` -- Re-export lock types and CRUD
- `apps/mobile/app/(mood)/lock-screen.tsx` -- NEW: Full-screen lock overlay with PIN keypad and biometric
- `apps/mobile/app/(mood)/lock-settings.tsx` -- NEW: Lock configuration screen
- `apps/mobile/app/(mood)/components/LockGate.tsx` -- NEW: Navigation interceptor component
- `apps/web/app/mood/lock/page.tsx` -- NEW: Web lock screen (PIN only)
- `apps/web/app/mood/settings/lock/page.tsx` -- NEW: Web lock settings

### Known Limitations
- Biometric not available on web (PIN only)
- Clock manipulation can bypass lockout timer (acceptable for consumer privacy app)
- "Forgot PIN" with PIN-only method requires clearing app data (by design, security trade-off)
- No export/backup of lock configuration; device-local only
- Lock is module-scoped (mood only). Hub-wide lock is a separate future feature.
- No biometric fallback if OS biometric API is unavailable (PIN is always the fallback)

### Context for Next Agent
- The lock gate (LockGate component) must render BEFORE any mood content. Wrap the mood module's root layout with this component. It should check lock state synchronously (from a context provider that loads lock config at mount time) and show the lock screen overlay without any flash of underlying content.
- PIN hash storage uses `expo-secure-store` with key `mylife_mood_pin_hash` and `mylife_mood_pin_salt`. These keys are specific to the mood module. If this pattern is later extracted to `@mylife/module-lock`, the keys should be parameterized by module ID.
- The `locked_until` field in mo_module_lock is stored as an ISO 8601 timestamp. On app launch, compare it against `Date.now()`. If the lockout has expired, display the keypad but do NOT reset `failed_attempts` until a successful auth. This prevents the timer expiry from being exploited.
- Web implementation uses a simpler model: PIN stored in a hashed cookie or localStorage (since web doesn't have Keychain). Use `SubtleCrypto` API for SHA-256 hashing on web. Biometric is not supported on web.
- This is the first MyLife module with a per-module authentication gate. The implementation should be clean enough to extract later. Keep the lock engine (hash/verify/lockout logic) in the module package, and keep the UI gate in the app layer. This separation enables future hub-wide reuse.
