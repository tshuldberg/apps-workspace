# Feature Spec: Full IMAP Implementation

## Metadata
- **Module:** mail
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [5] x3 + Complexity [1] x2 + CrossModule [0] x1 + PaidUser [0] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 8-10 hours
- **Depends On:** none (this is foundational infrastructure)
- **Blocks:** Push notifications (needs background sync), Attachments (MIME parsing), Encryption (TLS/SSL transport), Threading (Message-ID/References headers)

## Business Context

### Why This Feature Exists
MyMail currently has SQLite storage for messages but no actual IMAP protocol implementation. Messages are created manually via CRUD functions -- there is no way to connect to a real mail server, download messages, or send email. This feature transforms MyMail from a local message database into a real email client. Without IMAP, MyMail is a prototype. With IMAP, it is a functional mail client.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No | Custom protocol (not standard IMAP), but supports IMAP access. Push via Google infrastructure. |
| Outlook | Yes | No | Exchange ActiveSync + IMAP fallback. Auto-discovery via Autodiscover protocol. |
| Superhuman | Yes | Yes ($30/mo) | IMAP + SMTP with Gmail/Outlook OAuth. Background sync via their servers. |
| Spark | Yes | No | IMAP with OAuth for Gmail/Outlook. Proprietary push relay for instant notifications. |
| ProtonMail | Yes | No | Custom encrypted protocol. IMAP via ProtonMail Bridge desktop app. |

### Target User
Every MyMail user. Without IMAP, the module cannot function as an email client. This is the single most critical infrastructure feature.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: ImapConfig, SmtpConfig, SyncState, ConnectionStatus
  imap/client.ts                      -- NEW: IMAP connection manager (connect, authenticate, select mailbox)
  imap/sync.ts                        -- NEW: message sync engine (fetch new, detect deletions, folder sync)
  imap/parser.ts                      -- NEW: MIME message parser (headers, body, multipart)
  smtp/client.ts                      -- NEW: SMTP send engine (compose MIME, send via SMTP)
  db/schema.ts                        -- V2 migration: ml_sync_state table, add server_uid/message_id to ml_messages
  db/crud.ts                          -- New: sync state CRUD, message upsert by server_uid

apps/mobile/app/(mail)/
  server-setup.tsx                    -- MODIFIED: full server configuration (IMAP host/port/auth + SMTP host/port/auth)
  hooks/useImapSync.ts                -- NEW: background sync hook
  components/SyncIndicator.tsx        -- NEW: sync status bar (syncing/up-to-date/error)

apps/web/app/mail/
  setup/page.tsx                      -- MODIFIED: server configuration wizard
  hooks/useImapSync.ts                -- NEW: sync hook for web
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Settings > Server Setup ← CONFIGURATION HERE
       └── Inbox (sync indicator in header) ← SYNC STATUS HERE
```

### Data Model

```sql
-- V2 migration: add IMAP-specific columns to accounts
ALTER TABLE ml_accounts ADD COLUMN imap_host TEXT;
ALTER TABLE ml_accounts ADD COLUMN imap_port INTEGER DEFAULT 993;
ALTER TABLE ml_accounts ADD COLUMN imap_security TEXT DEFAULT 'ssl' CHECK(imap_security IN ('ssl', 'starttls', 'none'));
ALTER TABLE ml_accounts ADD COLUMN smtp_host TEXT;
ALTER TABLE ml_accounts ADD COLUMN smtp_port INTEGER DEFAULT 587;
ALTER TABLE ml_accounts ADD COLUMN smtp_security TEXT DEFAULT 'starttls' CHECK(smtp_security IN ('ssl', 'starttls', 'none'));
ALTER TABLE ml_accounts ADD COLUMN auth_method TEXT DEFAULT 'password' CHECK(auth_method IN ('password', 'oauth2'));
ALTER TABLE ml_accounts ADD COLUMN auth_token TEXT;

-- Add server UID to messages for sync dedup
ALTER TABLE ml_messages ADD COLUMN server_uid TEXT;
ALTER TABLE ml_messages ADD COLUMN message_id TEXT;
ALTER TABLE ml_messages ADD COLUMN headers TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ml_messages_server_uid_idx ON ml_messages(account_id, server_uid);

-- Sync state tracking
CREATE TABLE IF NOT EXISTS ml_sync_state (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  folder TEXT NOT NULL,
  last_uid TEXT,
  last_sync_at TEXT,
  uidvalidity TEXT,
  status TEXT DEFAULT 'idle' CHECK(status IN ('idle', 'syncing', 'error')),
  error_message TEXT,
  UNIQUE(account_id, folder)
);

CREATE INDEX IF NOT EXISTS ml_sync_state_account_idx ON ml_sync_state(account_id);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing mail CRUD and types
- **External:** IMAP/SMTP library (e.g., `imapflow` for IMAP, `nodemailer` for SMTP on Node; for React Native, use a JS IMAP implementation or native module)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a mail user, I want to connect MyMail to my email server so that I can send and receive real email.
2. As a mail user, I want automatic background sync so that new messages appear without manual refresh.
3. As a mail user, I want to send emails from MyMail so that it functions as a complete email client.
4. As a mail user, I want server-side folder structure mirrored locally so that my organization is preserved.
5. As a mail user, I want actions (read, star, move, delete) synced back to the server so that changes appear in other clients.

### Behavior Specification

1. **Account Setup:**
   a. User navigates to Settings > Server Setup
   b. Enters email address. System attempts auto-discovery (common providers: Gmail, Outlook, Yahoo, iCloud -- use known IMAP/SMTP settings)
   c. If auto-discovery fails, user manually enters IMAP host, port, security, SMTP host, port, security
   d. User enters credentials (password or OAuth2 token)
   e. System tests connection: IMAP LOGIN + SMTP EHLO
   f. On success, account is saved. Initial sync begins.

2. **Initial Sync:**
   a. Connect to IMAP server via SSL/STARTTLS
   b. LIST all mailboxes on server -> create ml_folders entries for each
   c. For each folder (starting with INBOX):
      - SELECT folder, get UIDVALIDITY
      - FETCH last 500 messages: UID, FLAGS, ENVELOPE, BODYSTRUCTURE
      - Parse envelope: from, to, subject, date
      - Store in ml_messages with server_uid
      - Update ml_sync_state with last_uid
   d. Show progress indicator: "Syncing inbox... 250/500"

3. **Incremental Sync:**
   a. On app foreground or every 5 minutes in background:
      - SELECT folder, check UIDVALIDITY (if changed, full resync needed)
      - FETCH UIDs since last_uid
      - Download new message envelopes + bodies
      - Detect flag changes (read/starred) on existing messages
      - Detect deletions (UIDs no longer on server)
   b. Update sync indicator: spinner while syncing, checkmark when done

4. **Send Email:**
   a. User composes message in Compose screen
   b. Taps Send
   c. System constructs MIME message (headers + body + attachments if any)
   d. Connects to SMTP server, authenticates
   e. Sends via SMTP MAIL FROM + RCPT TO + DATA
   f. On success, appends copy to Sent folder via IMAP APPEND
   g. Shows "Sent" confirmation toast

5. **Two-Way Sync:**
   a. Mark as read in MyMail -> IMAP STORE +FLAGS (\Seen) on server
   b. Star in MyMail -> IMAP STORE +FLAGS (\Flagged) on server
   c. Move to folder -> IMAP COPY + STORE +FLAGS (\Deleted) + EXPUNGE
   d. Delete -> IMAP STORE +FLAGS (\Deleted) + EXPUNGE (or move to Trash folder)

### Edge Cases

- Invalid credentials: show "Authentication failed" error with option to re-enter credentials
- Server unreachable: show "Cannot connect to server" with retry button. Cache allows offline reading.
- UIDVALIDITY changed: full folder resync required. Warn user: "Folder structure changed on server, resyncing..."
- Connection timeout (30 seconds): abort, show error, retry on next interval
- Message too large to download (50+ MB): skip body fetch, show "Message too large" placeholder
- OAuth2 token expired: prompt user to re-authenticate
- Self-signed certificate: warn user, offer "Trust this certificate" option (stored per account)
- SMTP send failure: save message to Drafts, show error with specific reason
- Server returns non-standard IMAP responses: log and skip malformed entries
- Concurrent sync from another device: UIDVALIDITY + UID comparison handles conflicts
- Account has 100,000+ messages: paginate initial sync (oldest 500 per batch, most recent first)
- Offline mode: all CRUD operations queue locally, sync when connectivity returns

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Server setup wizard with auto-discovery for Gmail, Outlook, Yahoo, iCloud
- [ ] **AC-2:** Manual server configuration (IMAP + SMTP host, port, security) as fallback
- [ ] **AC-3:** Connection test verifies IMAP login + SMTP EHLO before saving
- [ ] **AC-4:** Initial sync downloads last 500 messages with progress indicator
- [ ] **AC-5:** Incremental sync detects new messages, flag changes, and deletions
- [ ] **AC-6:** Sync indicator shows current state (syncing/up-to-date/error)
- [ ] **AC-7:** Send email delivers via SMTP and copies to Sent folder
- [ ] **AC-8:** Read/star/move/delete changes sync back to IMAP server
- [ ] **AC-9:** Offline mode allows reading cached messages and queues writes

### Technical Criteria
- [ ] **TC-1:** IMAP connection uses SSL (993) or STARTTLS (143) based on config
- [ ] **TC-2:** SMTP connection uses STARTTLS (587) or SSL (465) based on config
- [ ] **TC-3:** ml_sync_state tracks per-folder last UID and UIDVALIDITY
- [ ] **TC-4:** server_uid uniqueness prevents duplicate message inserts
- [ ] **TC-5:** UIDVALIDITY change triggers full folder resync
- [ ] **TC-6:** Background sync runs every 5 minutes without keeping app in foreground
- [ ] **TC-7:** MIME parser extracts Content-Type, headers, multipart boundaries
- [ ] **TC-8:** SMTP sends valid RFC 5322 messages

### Negative Criteria
- [ ] **NC-1:** Credentials must NOT be stored in plaintext (use Keychain/Keystore or encrypted storage)
- [ ] **NC-2:** IMAP sync must NOT download full bodies of messages > 50 MB (fetch envelope only)
- [ ] **NC-3:** Connection failures must NOT block the UI (sync runs on background thread)
- [ ] **NC-4:** Self-signed cert trust must NOT apply globally (only per account)

## UI Specification

### Mobile (Expo)
- Server setup: wizard-style, 3 steps (Email -> Server config -> Test + Save)
  - Step 1: email input with `#3B82F6` accent
  - Step 2: auto-filled fields with option to edit, `#12121A` surface inputs
  - Step 3: connection test with animated spinner, green checkmark on success, red X on failure
- Sync indicator: small bar below inbox header, `#3B82F6` progress during sync, `#30D158` checkmark when done, `#FF453A` warning triangle on error

### Web (Next.js)
- Server setup: full page wizard at `/mail/setup`
- Sync indicator: subtle toast or status dot in mail header

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Connecting to server..." spinner during setup test | Connection test |
| Empty | Setup wizard (no account configured yet) | First launch |
| Error | "Authentication failed" / "Cannot connect" with retry + re-configure | Auth or network failure |
| Success | Inbox with messages, sync indicator shows "Up to date" | Sync complete |
| Partial | "Syncing... 250/500 messages" progress bar | Initial sync in progress |

## Test Requirements

### Unit Tests
- [ ] Auto-discovery: returns correct IMAP/SMTP config for Gmail
- [ ] Auto-discovery: returns correct config for Outlook
- [ ] Auto-discovery: returns null for unknown provider (falls back to manual)
- [ ] MIME parser: extracts subject, from, to, date from simple message
- [ ] MIME parser: handles multipart/alternative (text + HTML)
- [ ] MIME parser: handles multipart/mixed (body + attachments)
- [ ] MIME parser: handles nested multipart
- [ ] MIME builder: constructs valid RFC 5322 message
- [ ] Sync state: upsert creates new record
- [ ] Sync state: upsert updates existing record
- [ ] Message upsert: inserts new message by server_uid
- [ ] Message upsert: skips duplicate server_uid
- [ ] Flag sync: maps IMAP \Seen to is_read=1
- [ ] Flag sync: maps IMAP \Flagged to is_starred=1

### Integration Tests
- [ ] Full setup flow: enter credentials -> test connection -> initial sync -> messages appear
- [ ] Send flow: compose -> send via SMTP -> message appears in Sent folder
- [ ] Two-way sync: mark read in MyMail -> flag set on server

### QA Verification Script

1. Open MyMail on mobile
2. Navigate to Settings > Server Setup
3. Enter a Gmail address
4. Verify: auto-discovery fills IMAP (imap.gmail.com:993) and SMTP (smtp.gmail.com:587) -- corresponds to AC-1
5. Enter credentials (app password for Gmail)
6. Tap "Test Connection"
7. Verify: spinner, then green checkmark -- corresponds to AC-3
8. Tap Save
9. Verify: progress indicator "Syncing inbox..." -- corresponds to AC-4
10. Wait for sync to complete
11. Verify: inbox shows messages from Gmail -- corresponds to AC-5
12. Verify: sync indicator shows "Up to date" -- corresponds to AC-6
13. Tap Compose, write a test email, tap Send
14. Verify: "Sent" toast, message appears in Sent folder -- corresponds to AC-7
15. Mark a message as read in MyMail
16. Check the same message in Gmail web
17. Verify: message is also marked read in Gmail -- corresponds to AC-8
18. Turn on airplane mode
19. Verify: cached messages still readable -- corresponds to AC-9
20. Turn off airplane mode
21. Verify: sync resumes and updates

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if Complexity <= 2 (this is a Large feature):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to setup wizard and inbox, verify sync flow
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
Mail module has SQLite storage and CRUD but no IMAP/SMTP connectivity. Messages are created locally only. No real email send/receive capability. The module is essentially a local message database.

### After This Work
Full IMAP/SMTP integration: connect to any standard mail server, download messages, send email, two-way sync of read/star/move/delete flags, background refresh, offline cache.

### Files Changed
- `modules/mail/src/types.ts` -- Added ImapConfig, SmtpConfig, SyncState, ConnectionStatus types
- `modules/mail/src/imap/client.ts` -- NEW: IMAP connection manager
- `modules/mail/src/imap/sync.ts` -- NEW: sync engine
- `modules/mail/src/imap/parser.ts` -- NEW: MIME parser
- `modules/mail/src/smtp/client.ts` -- NEW: SMTP send engine
- `modules/mail/src/db/schema.ts` -- V2 migration: sync state table, new columns on accounts/messages
- `modules/mail/src/db/crud.ts` -- Added sync state CRUD, message upsert
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/server-setup.tsx` -- MODIFIED: full wizard
- `apps/mobile/app/(mail)/hooks/useImapSync.ts` -- NEW
- `apps/mobile/app/(mail)/components/SyncIndicator.tsx` -- NEW
- `apps/web/app/mail/setup/page.tsx` -- MODIFIED
- `apps/web/app/mail/hooks/useImapSync.ts` -- NEW

### Known Limitations
- No IMAP IDLE (real-time push). Uses polling every 5 minutes.
- No OAuth2 flow UI (user must generate app passwords for Gmail/Outlook).
- No Exchange ActiveSync (IMAP/SMTP only).
- Initial sync limited to last 500 messages per folder.

### Context for Next Agent
This is the most complex mail feature. Build it first before Push Notifications, Threading, Attachments, and Encryption -- they all depend on real IMAP data. The MIME parser is critical for attachments (multipart/mixed) and threading (Message-ID/References headers). The sync engine must be resilient to network interruptions. Credential storage should use `expo-secure-store` on mobile and the OS keychain wrapper on web.
