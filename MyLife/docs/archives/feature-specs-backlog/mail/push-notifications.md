# Feature Spec: Push Notifications

## Metadata
- **Module:** mail
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [2] x2 + CrossModule [1] x1 + PaidUser [1] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Full IMAP implementation (needs background mail sync to trigger notifications)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Email is useless if you do not know it arrived. Every email client delivers push notifications for new messages. Without push, users must manually open MyMail and refresh to see new mail, which is a regression from every other email app they have used since 2008. Push notifications are the difference between a mail client and a mail viewer you occasionally check.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No | Push via Google Play Services / APNs. Per-label notification settings. Bundled for promotions. |
| Outlook | Yes | No | Focused inbox: only "Focused" messages push by default. Per-account toggle. |
| Superhuman | Yes | Yes ($30/mo) | Instant push with VIP/priority filtering. Notification includes snippet. |
| Spark | Yes | No | Smart notifications: only "important" mail pushes by default. Per-account and per-folder toggles. |
| ProtonMail | Yes | No | Push via ProtonMail bridge. Notification shows sender + subject (encrypted preview). |

### Target User
Any mobile email user who expects to be notified of new messages without opening the app. This is every single MyMail user on mobile.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: NotificationPreferences, NotificationPayload
  db/schema.ts                        -- V2 migration: ml_notification_preferences table
  db/crud.ts                          -- New CRUD: get/update notification preferences per account
  engine/notifications.ts             -- NEW: notification builder, quiet hours check, VIP filter

apps/mobile/app/(mail)/
  settings/notifications.tsx           -- NEW: per-account notification settings screen
  hooks/useMailNotifications.ts        -- NEW: hook for registering push token, handling foreground notifications

apps/web/app/mail/
  settings/notifications/page.tsx      -- NEW: notification settings (web push API)
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Settings tab
            └── Notifications ← YOU ARE HERE
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS ml_notification_preferences (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  quiet_start TEXT,
  quiet_end TEXT,
  vip_only INTEGER NOT NULL DEFAULT 0,
  show_preview INTEGER NOT NULL DEFAULT 1,
  sound TEXT DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id)
);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), mail IMAP sync (background fetch trigger)
- **External:** `expo-notifications` (mobile push), Expo Push Service (token registration), Web Push API (web)
- **Cross-Module:** Hub notification center (if built, mail notifications should integrate)

## Functional Requirements

### User Stories
1. As a mail user, I want to receive push notifications when new email arrives so that I stay informed without opening the app.
2. As a mail user, I want to configure quiet hours so that I am not disturbed during sleep or focus time.
3. As a mail user, I want VIP-only mode so that only important senders trigger notifications.
4. As a mail user, I want per-account notification toggles so that I can silence noisy accounts.
5. As a mail user, I want to see sender and subject in the notification so that I can triage without opening the app.

### Behavior Specification

1. On first app launch after enabling mail module, system requests notification permission (expo-notifications)
2. If granted, system registers push token with Expo Push Service
3. When background sync detects new messages (via IMAP IDLE or periodic fetch), for each new message:
   a. Check if notifications are enabled for that account
   b. Check quiet hours: if current time is within quiet_start..quiet_end, skip
   c. Check VIP-only: if enabled and sender is not in contacts/VIP list, skip
   d. Build notification: title = sender name, body = subject line (or "New message" if show_preview is false)
   e. Deliver local notification via expo-notifications
4. Tapping the notification opens MyMail to the specific message
5. Badge count on app icon updates to total unread count across all accounts
6. Notification settings screen shows toggle per account, quiet hours picker, VIP-only toggle, preview toggle, sound picker

### Edge Cases

- Notification permission denied: show banner in mail settings "Enable notifications in System Settings" with deep link
- Multiple new messages arrive at once: batch into "3 new messages from [account]" instead of 3 separate pushes
- User is actively viewing inbox when new message arrives: do not show push notification, just update the list
- Quiet hours span midnight (e.g., 22:00 to 07:00): handle wrap-around correctly
- Account deleted while notification is pending: cancel pending notification for that account
- App is force-killed: background fetch via iOS Background App Refresh or Android WorkManager must still trigger
- Web: use Service Worker + Web Push API for browser notifications when tab is not focused
- No IMAP connection (offline): queue notification check for when connectivity returns

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** New email triggers a push notification on mobile within 60 seconds of IMAP sync
- [ ] **AC-2:** Notification shows sender name and subject line
- [ ] **AC-3:** Tapping notification opens the specific message in MyMail
- [ ] **AC-4:** Badge count reflects total unread messages
- [ ] **AC-5:** Quiet hours suppress all notifications during configured window
- [ ] **AC-6:** VIP-only mode suppresses notifications from non-VIP senders
- [ ] **AC-7:** Per-account toggle disables notifications for that account
- [ ] **AC-8:** Multiple simultaneous messages batch into a single notification

### Technical Criteria
- [ ] **TC-1:** ml_notification_preferences table created with correct schema
- [ ] **TC-2:** Push token registered with Expo Push Service on permission grant
- [ ] **TC-3:** Foreground notification suppressed when user is viewing inbox
- [ ] **TC-4:** Quiet hours wrap-around (crossing midnight) handled correctly
- [ ] **TC-5:** Account deletion cascades to notification preferences
- [ ] **TC-6:** Notification builder creates valid expo-notifications payload

### Negative Criteria
- [ ] **NC-1:** Notifications must NOT fire during quiet hours regardless of message priority
- [ ] **NC-2:** Notification content must NOT include message body (only sender + subject, subject optional)
- [ ] **NC-3:** Push tokens must NOT be sent to any server other than Expo Push Service
- [ ] **NC-4:** Disabled accounts must NOT trigger notifications

## UI Specification

### Mobile (Expo)
- Settings screen: `#0A0A0F` background, glass cards per account
- Account card: toggle switch (enabled/disabled), accent `#3B82F6`
- Quiet hours: time picker inputs for start/end, `rgba(240,240,245,0.65)` labels
- VIP-only toggle: switch with "Only notify for contacts" label
- Preview toggle: "Show message preview" with on/off switch
- Sound picker: flat list of 4 options (Default, Chime, Silent, System)

### Web (Next.js)
- Settings page at `/mail/settings/notifications`
- Same layout via CSS variables, time inputs instead of native picker
- "Enable browser notifications" button that triggers Web Push permission

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton for preferences | First load |
| Empty | Default preferences (all enabled, no quiet hours) | New account |
| Error | "Could not save preferences" toast with retry | DB write failure |
| Success | Saved preferences with toggles reflecting current state | Preferences loaded |
| Partial | Permission denied banner at top + normal settings below | OS permission denied |

## Test Requirements

### Unit Tests
- [ ] Notification builder: creates correct payload with sender and subject
- [ ] Notification builder: respects show_preview=false (hides subject)
- [ ] Quiet hours check: suppresses during window
- [ ] Quiet hours check: handles midnight wrap-around
- [ ] Quiet hours check: allows outside window
- [ ] VIP filter: suppresses non-VIP senders
- [ ] VIP filter: allows VIP senders
- [ ] Batch logic: groups 3+ messages into single notification
- [ ] Preference CRUD: create, read, update per account
- [ ] Preference CRUD: cascade delete with account

### Integration Tests
- [ ] Full flow: new message sync -> notification preferences check -> notification delivered
- [ ] Suppression flow: new message during quiet hours -> no notification fired

### QA Verification Script

1. Open MyMail on mobile
2. Navigate to Settings > Notifications
3. Verify: per-account toggles visible -- corresponds to AC-7
4. Enable notifications for test account
5. Grant notification permission when prompted
6. Send a test email to the configured account from another device
7. Wait up to 60 seconds
8. Verify: push notification appears with sender name and subject -- corresponds to AC-1, AC-2
9. Tap the notification
10. Verify: MyMail opens to the specific message -- corresponds to AC-3
11. Check app icon badge
12. Verify: badge shows unread count -- corresponds to AC-4
13. Set quiet hours to current time range (e.g., now to +1 hour)
14. Send another test email
15. Verify: no notification appears -- corresponds to AC-5
16. Remove quiet hours, enable VIP-only mode
17. Send email from a non-VIP sender
18. Verify: no notification appears -- corresponds to AC-6
19. Send 3 emails rapidly
20. Verify: single batched notification -- corresponds to AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to notification settings, verify toggles and state
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
No push notifications. Users must manually open MyMail to check for new messages. No notification preferences table.

### After This Work
Push notifications fire on new message arrival with per-account preferences, quiet hours, VIP filtering, and batching. Settings screen provides full control.

### Files Changed
- `modules/mail/src/types.ts` -- Added NotificationPreferences, NotificationPayload types
- `modules/mail/src/db/schema.ts` -- Added ml_notification_preferences table
- `modules/mail/src/db/crud.ts` -- Added preference CRUD
- `modules/mail/src/engine/notifications.ts` -- NEW: notification builder, quiet hours, VIP filter, batching
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/settings/notifications.tsx` -- NEW
- `apps/mobile/app/(mail)/hooks/useMailNotifications.ts` -- NEW
- `apps/web/app/mail/settings/notifications/page.tsx` -- NEW

### Known Limitations
- No server-side push (relies on background app refresh + IMAP sync, not real-time server push).
- No per-folder notification settings (only per-account).
- No notification actions (archive, reply from notification) in V1.

### Context for Next Agent
Push notifications depend on IMAP background sync being implemented. If building both, implement IMAP first. The notification engine is pure functions that can be unit tested without expo-notifications. The hook handles the platform-specific registration. Web push requires a Service Worker which should live in `apps/web/public/sw.js`.
