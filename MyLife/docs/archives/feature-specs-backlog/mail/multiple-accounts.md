# Feature Spec: Multiple Accounts

## Metadata
- **Module:** mail
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Full IMAP implementation (each account needs its own IMAP connection)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Most people have multiple email addresses: personal, work, side project, older accounts. Spark and Outlook differentiate from Gmail by offering unified inbox across multiple accounts. MyMail's data model already supports multiple accounts (ml_accounts with per-account foreign keys on messages/folders/drafts), but the UI currently assumes a single account. This feature activates multi-account support in the UI, making MyMail viable for users who juggle 2-5 email accounts.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Partial | No | Can add multiple Google accounts, but each has separate inbox. No unified view. |
| Outlook | Yes | No | Unified inbox across all accounts (Exchange, Gmail, Yahoo, IMAP). Per-account sidebar. Focused inbox spans all accounts. |
| Superhuman | Yes | Yes ($30/mo) | Multiple accounts with unified inbox. Account-specific settings. Send-as from any account. |
| Spark | Yes | No | Unified inbox + per-account folders. Account picker in compose. Color-coded account indicators. |

### Target User
Users with 2+ email accounts (personal + work, or personal + hobby + old account). Spark/Outlook users who use unified inbox daily. Power users who manage 3-5 accounts and want one client for all.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: UnifiedInboxFilter, AccountSwitcherState
  engine/unified-inbox.ts             -- NEW: merge and sort messages from multiple accounts

apps/mobile/app/(mail)/
  components/AccountSwitcher.tsx       -- NEW: dropdown/picker to switch between accounts or "All"
  components/AccountBadge.tsx          -- NEW: colored dot indicator showing which account a message belongs to
  settings/accounts.tsx                -- NEW: account list management (add, edit, remove, reorder)

apps/web/app/mail/
  components/AccountSwitcher.tsx       -- NEW: sidebar or dropdown account selector
  components/AccountBadge.tsx          -- NEW
  settings/accounts/page.tsx           -- NEW: account management page
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Inbox header
            └── Account Switcher (dropdown: All Accounts | Personal | Work) ← YOU ARE HERE
       └── Inbox messages
            └── Account badge on each message ← AND HERE
       └── Compose
            └── From picker (select which account to send from) ← AND HERE
       └── Settings
            └── Accounts (add/edit/remove) ← AND HERE
```

### Data Model

```sql
-- No new tables needed. The existing schema already supports multiple accounts:
-- ml_accounts: each row is an account
-- ml_messages: account_id foreign key
-- ml_folders: account_id foreign key
-- ml_drafts: account_id foreign key

-- V2 migration: add account display preferences
ALTER TABLE ml_accounts ADD COLUMN color TEXT DEFAULT '#3B82F6';
ALTER TABLE ml_accounts ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE ml_accounts ADD COLUMN is_default INTEGER DEFAULT 0;
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing multi-account data model, IMAP implementation (per-account connection)
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a mail user, I want to add multiple email accounts so that I can manage all my email in one app.
2. As a mail user, I want a unified inbox that shows messages from all accounts so that I have one place to check.
3. As a mail user, I want to filter the inbox by account so that I can focus on one account at a time.
4. As a mail user, I want to choose which account to send from so that I reply from the correct address.
5. As a mail user, I want each account color-coded so that I can visually distinguish which account a message belongs to.

### Behavior Specification

1. **Add Account:**
   a. User navigates to Settings > Accounts
   b. Taps "+ Add Account"
   c. Goes through the server setup wizard (same as Full IMAP Implementation spec)
   d. On success, account added to ml_accounts. Assigned a color from a palette.
   e. Initial sync begins for the new account.

2. **Account Switcher (Inbox):**
   a. Inbox header shows current filter: "All Accounts" (default) or a specific account name
   b. Tapping opens dropdown with options:
      - "All Accounts" (unified view)
      - Each account listed by display name + email + color dot
   c. Selecting an account filters inbox to only that account's messages
   d. "All Accounts" merges all accounts' messages sorted by received_at DESC

3. **Account Badge:**
   a. In unified view, each message row shows a small colored dot matching the account's color
   b. This allows instant visual identification of which account received the message
   c. In single-account view, badges are hidden (redundant)

4. **From Picker (Compose):**
   a. Compose screen shows "From:" field with the default account
   b. Tapping "From:" opens account picker
   c. User selects which account to send from
   d. SMTP connection uses the selected account's credentials
   e. When replying, "From:" auto-selects the account that received the original message

5. **Account Management:**
   a. Settings > Accounts lists all accounts with color, email, display name, sync status
   b. Each account has: Edit (server settings), Color (picker), Set as Default, Remove
   c. Removing an account: confirmation dialog "This will delete all local messages for [email]. This action cannot be undone."
   d. Remove triggers CASCADE delete (ml_messages, ml_folders, ml_drafts, etc.)
   e. Drag to reorder accounts (affects dropdown order)

6. **Default Account:**
   a. One account marked as default (is_default=1)
   b. Default account used for: new compose (From field), push notification badge count, dashboard module card unread count
   c. Changing default: set is_default=0 on old, is_default=1 on new

### Edge Cases

- Only one account: account switcher hidden (no need to switch). Behaves like current single-account mode.
- All accounts removed: show "Add your first email account" setup screen
- Account sync fails for one of three accounts: show error indicator on that account only, other accounts continue normally
- Reply to forwarded message from different account: "From:" uses the account that received the forward, not the original sender's account
- Unified inbox with 5 accounts and 10,000+ messages: pagination (50 per page, load more on scroll)
- Two accounts on same server: separate IMAP connections, no connection pooling
- Account removal during active sync: cancel sync, then cascade delete
- Color collision (two accounts with same color): auto-suggest a different color, but allow override
- Compose without any account configured: redirect to account setup
- Account credentials expire (OAuth2): show "Re-authenticate" badge on that account

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Multiple accounts can be added via Settings > Accounts
- [ ] **AC-2:** Account switcher in inbox header allows filtering by account or "All Accounts"
- [ ] **AC-3:** Unified inbox shows messages from all accounts sorted by date
- [ ] **AC-4:** Account color dot badge on each message in unified view
- [ ] **AC-5:** "From:" picker in compose allows sending from any configured account
- [ ] **AC-6:** Reply auto-selects the account that received the original message
- [ ] **AC-7:** Default account used for new compose and badge count
- [ ] **AC-8:** Account removal deletes all local data for that account with confirmation
- [ ] **AC-9:** Account reordering via drag in settings

### Technical Criteria
- [ ] **TC-1:** Unified inbox query merges messages from multiple accounts sorted by received_at
- [ ] **TC-2:** Account filter query uses account_id WHERE clause
- [ ] **TC-3:** SMTP send uses the selected account's credentials
- [ ] **TC-4:** Account removal cascade deletes messages, folders, drafts, contacts, filters
- [ ] **TC-5:** Default account flag maintained correctly (only one at a time)
- [ ] **TC-6:** Per-account IMAP sync runs independently (one failure does not block others)
- [ ] **TC-7:** Color, sort_order, is_default columns added in migration

### Negative Criteria
- [ ] **NC-1:** Single account setup must NOT show account switcher (clean single-account UX)
- [ ] **NC-2:** Account removal must NOT happen without confirmation dialog
- [ ] **NC-3:** Unified inbox must NOT duplicate messages (each message belongs to one account)
- [ ] **NC-4:** Account credentials from one account must NOT be accessible to another account's operations

## UI Specification

### Mobile (Expo)
- Account switcher: pill button in inbox header, tapping opens bottom sheet with account list
  - "All Accounts" option with rainbow-ish icon
  - Each account: color dot (12px circle), display name, email in secondary text
- Account badge: 8px circle, positioned left of sender name, colored per-account
- From picker in compose: tappable row showing current account, opens same bottom sheet
- Account management: list with account cards, drag handle for reorder, color picker (8 preset colors)
- Account colors: `['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']`

### Web (Next.js)
- Account switcher: dropdown in mail sidebar header
- Account badge: same colored dot in message list
- From picker: dropdown in compose form
- Account management: page at `/mail/settings/accounts`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton inbox while multi-account merge query runs | First load |
| Empty | "Add your first email account" wizard | No accounts |
| Error | Per-account error badge (red dot on account in switcher) | One account's sync fails |
| Success | Unified inbox with colored account badges | Multiple accounts synced |
| Partial | Some accounts synced, one showing spinner | New account initial sync |

## Test Requirements

### Unit Tests
- [ ] Unified inbox: merges messages from 2 accounts sorted by received_at
- [ ] Unified inbox: respects limit/offset pagination
- [ ] Account filter: returns only messages for specified account_id
- [ ] Default account: only one account has is_default=1
- [ ] Default account: setting new default clears old default
- [ ] Account removal: cascade deletes messages, folders, drafts
- [ ] Color assignment: auto-assigns unused color from palette
- [ ] Sort order: accounts returned in sort_order
- [ ] Reply "From" detection: identifies correct account from original message's account_id

### Integration Tests
- [ ] Full flow: add 2 accounts -> unified inbox shows both -> filter to one -> only that account's messages
- [ ] Compose flow: select account 2 as From -> send -> message uses account 2's SMTP

### QA Verification Script

1. Open MyMail on mobile
2. Verify: initial setup adds first account
3. Navigate to Settings > Accounts
4. Tap "+ Add Account"
5. Configure a second email account
6. Verify: second account appears in list with different color -- corresponds to AC-1
7. Navigate to Inbox
8. Verify: account switcher visible in header -- corresponds to AC-2
9. Verify: inbox shows messages from both accounts -- corresponds to AC-3
10. Verify: each message has a colored dot matching its account -- corresponds to AC-4
11. Tap account switcher, select account 2 only
12. Verify: inbox filters to account 2 messages only
13. Tap Compose
14. Verify: "From" field shows default account -- corresponds to AC-7
15. Tap "From" to switch accounts
16. Verify: picker shows both accounts -- corresponds to AC-5
17. Select account 2 and send a test email
18. Open a message received on account 1
19. Tap Reply
20. Verify: "From" auto-selects account 1 -- corresponds to AC-6
21. Navigate to Settings > Accounts
22. Long-press to reorder accounts
23. Verify: order updates -- corresponds to AC-9
24. Tap Remove on account 2
25. Verify: confirmation dialog appears -- corresponds to AC-8
26. Confirm removal
27. Verify: account 2 messages gone, account switcher hidden (single account) -- corresponds to NC-1

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to inbox with multiple accounts, verify switcher and badges
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
Data model supports multiple accounts but UI assumes single account. No account switcher, no unified inbox, no From picker, no account color badges. Adding a second account would create messages but they'd all display in a flat list with no distinction.

### After This Work
Full multi-account UX: account switcher with unified/per-account filter, color-coded badges, From picker in compose, smart reply account detection, account management (add/edit/remove/reorder/color), default account.

### Files Changed
- `modules/mail/src/types.ts` -- Added UnifiedInboxFilter, AccountSwitcherState types
- `modules/mail/src/engine/unified-inbox.ts` -- NEW: multi-account message merge and sort
- `modules/mail/src/db/schema.ts` -- V2 migration: color, sort_order, is_default columns on ml_accounts
- `modules/mail/src/db/crud.ts` -- Modified: getMessages supports multi-account merge
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/components/AccountSwitcher.tsx` -- NEW
- `apps/mobile/app/(mail)/components/AccountBadge.tsx` -- NEW
- `apps/mobile/app/(mail)/settings/accounts.tsx` -- NEW
- `apps/web/app/mail/components/AccountSwitcher.tsx` -- NEW
- `apps/web/app/mail/components/AccountBadge.tsx` -- NEW
- `apps/web/app/mail/settings/accounts/page.tsx` -- NEW

### Known Limitations
- No send-as/alias support (cannot send from an address not configured as a full account).
- No per-account notification sounds (uses global mail notification settings).
- No account-specific signatures.
- No account import/export (cannot migrate accounts between devices).

### Context for Next Agent
The existing data model already has account_id on all tables, so multi-account data isolation is already in place. The key work is UI: account switcher component, From picker, and unified inbox query. The unified inbox is just a `getMessages()` call without an accountId filter, ordered by received_at DESC. The AccountBadge color comes from ml_accounts.color (added in migration). When building Push Notifications or Contact Sync, respect the per-account model.
