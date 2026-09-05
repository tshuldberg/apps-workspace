# MyMail — Module Audit

**ID:** mail | **Prefix:** ml_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0
**One-line promise:** Self-hosted private email

## User Value
- Multi-account IMAP client with local SQLite metadata, no third-party servers touching mail
- Folder management + threaded conversations + full-text search + drafts + starring
- V2 extensions: attachments, filters/rules, contacts, calendar events, notification prefs, encryption keys, sync state
- All message data stays on-device; user owns the mail server relationship

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Multi-account IMAP config | src/db/crud.ts (ml_accounts) | shipped |
| Message CRUD + read/starred/move/delete | src/db/crud.ts | shipped |
| Draft composition + persistence | src/db/crud.ts (ml_drafts) | shipped |
| System + custom folders | src/db/crud.ts (ml_folders) | shipped |
| Full-text search (subject/from/body) | src/engine/search.ts | shipped |
| Thread grouping (Re:/Fwd:/FW: normalization) | src/engine/search.ts | shipped |
| Date range filtering | src/engine/search.ts | shipped |
| Unread counting + stats | src/db/crud.ts (getMailStats) | shipped |
| Attachments (V2) | schema V2, ml_attachments | shipped |
| Filters/rules (V2) | schema V2, ml_filters | shipped |
| Contacts (V2) | schema V2, ml_contacts | shipped |
| Threads table (V2) | schema V2, ml_threads | shipped |
| Calendar events (V2) | schema V2, ml_calendar_events | shipped |
| Notification preferences (V2) | schema V2, ml_notification_preferences | shipped |
| Encryption keys (V2) | schema V2, ml_encryption_keys | shipped |
| Sync state (V2) | schema V2, ml_sync_state | shipped |
| Automations engine | src/automations | shipped |
| Core engine | src/engine | shipped |

## Data Model
Prefix `ml_`, schema v2. V1 tables: ml_accounts, ml_messages, ml_drafts, ml_folders (8 indexes on account_id, folder, received_at, is_read, is_starred, compound account+folder). V2 adds ml_attachments, ml_filters, ml_contacts, ml_threads, ml_calendar_events, ml_notification_preferences, ml_encryption_keys, ml_sync_state plus ALTER statements to accounts + messages.

## Screens / User Flows
Mobile tabs: Inbox, Compose, Folders, Settings. Stack screens: message-detail, compose-message, server-setup, search, thread-detail, contacts, filter-editor, encryption-settings, notification-settings, accounts. 17 mobile route files, 13 web route files. `requiresAuth: true` and `requiresNetwork: true` at the module level.

## Distinctive / Moat-worthy
- Only mail client in MyLife suite; metadata stored locally with IMAP talking directly user-controlled server
- V2 adds the scaffolding for PGP/SMIME (encryption keys table) and client-side filters — no server-side rules
- Sits in a bundled privacy suite alongside notes, journal, mood, habits rather than as a standalone inbox

## Gaps vs competitors
- No JMAP support (Fastmail); IMAP-only today
- No shipped calendar UI — ml_calendar_events table exists but no dedicated screens
- No unified inbox across accounts (account filter exists but no merged view verified)
- Encryption keys table present; PGP send/receive pipeline not verified in code surface

## Investor-facing hook
A privacy-first Proton/Hey-style mail client that never touches our servers and bundles with the same SQLite the journal, mood, and notes modules already trust.
