# Feature Spec: Threading

## Metadata
- **Module:** mail
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [2] x2 + CrossModule [0] x1 + PaidUser [0] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Full IMAP implementation (needs Message-ID and References headers from IMAP)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Email threading is how users follow conversations. Gmail popularized threaded conversations in 2004 and it is now the expected default. Without threading, MyMail shows every reply as an isolated message, forcing users to mentally reconstruct conversations by scanning subjects and dates. The existing `groupByThread()` function in `engine/search.ts` does basic subject-based grouping, but real threading requires RFC 5322 Message-ID/In-Reply-To/References headers for accurate conversation reconstruction.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No | Conversation view: groups by subject + Message-ID/References. Collapsible thread with latest message expanded. Thread counter badge. |
| Outlook | Yes | No | Conversation view (optional, off by default). Groups by subject + headers. Collapsible with read/unread indicators. |
| Superhuman | Yes | Yes ($30/mo) | Split inbox with threaded conversations. Keyboard navigation through thread. Thread summary. |
| Spark | Yes | No | Smart threads with collapsible messages. Thread-level actions (archive all, mute thread). |

### Target User
Any email user with ongoing conversations. Gmail users who rely on threaded view. Professionals with email chains containing 5-50+ messages. Without threading, MyMail is disorienting for anyone accustomed to conversation view.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: MailThread, ThreadMessage, ThreadSortOrder
  db/schema.ts                        -- V2 migration: ml_threads table, add thread_id/message_id/in_reply_to/references to ml_messages
  db/crud.ts                          -- New: thread CRUD (create, get, list, getMessagesInThread)
  engine/threading.ts                 -- NEW: RFC 5322 thread builder (replaces simple groupByThread)

apps/mobile/app/(mail)/
  components/ThreadView.tsx            -- NEW: collapsible conversation view
  components/ThreadListItem.tsx        -- NEW: thread row in inbox (latest message + participant avatars + count badge)
  components/ThreadMessage.tsx         -- NEW: individual message within thread (collapsible)

apps/web/app/mail/
  components/ThreadView.tsx            -- NEW: conversation view
  components/ThreadListItem.tsx        -- NEW
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Inbox (thread list view) ← THREAD LIST HERE
            └── Thread Detail (conversation view) ← THREAD VIEW HERE
                 └── Message 1 (collapsed)
                 └── Message 2 (collapsed)
                 └── Message 3 (expanded, latest)
                 └── Reply box (quick reply)
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS ml_threads (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  participant_emails TEXT NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 1,
  unread_count INTEGER NOT NULL DEFAULT 0,
  latest_message_at TEXT NOT NULL,
  is_muted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ml_threads_account_idx ON ml_threads(account_id);
CREATE INDEX IF NOT EXISTS ml_threads_latest_idx ON ml_threads(latest_message_at DESC);

-- Add threading fields to messages
ALTER TABLE ml_messages ADD COLUMN thread_id TEXT REFERENCES ml_threads(id) ON DELETE SET NULL;
ALTER TABLE ml_messages ADD COLUMN message_id_header TEXT;
ALTER TABLE ml_messages ADD COLUMN in_reply_to TEXT;
ALTER TABLE ml_messages ADD COLUMN "references" TEXT DEFAULT '[]';

CREATE INDEX IF NOT EXISTS ml_messages_thread_idx ON ml_messages(thread_id);
CREATE INDEX IF NOT EXISTS ml_messages_message_id_idx ON ml_messages(message_id_header);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `groupByThread()` in engine/search.ts (will be superseded)
- **External:** None (threading is pure logic over IMAP headers)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a mail user, I want my inbox to show threads (conversations) instead of individual messages so that I can follow email chains.
2. As a mail user, I want to expand/collapse individual messages in a thread so that I can read the conversation history.
3. As a mail user, I want thread-level actions (archive all, delete all, mute) so that I can manage conversations efficiently.
4. As a mail user, I want a quick reply box at the bottom of a thread so that I can respond without opening compose.
5. As a mail user, I want to mute a thread so that noisy conversations stop appearing in my inbox.

### Behavior Specification

1. **Thread Construction:**
   a. When a new message arrives via IMAP sync, extract headers: Message-ID, In-Reply-To, References
   b. Thread resolution algorithm:
      - If In-Reply-To or References contains a known message_id_header, assign to that message's thread
      - If no header match but subject (normalized) matches an existing thread, assign to it
      - If no match at all, create a new thread
   c. Update thread metadata: message_count, unread_count, latest_message_at, participant_emails

2. **Inbox Thread List:**
   a. Inbox shows threads instead of individual messages
   b. Each thread row shows:
      - Participant avatars (up to 3, stacked)
      - Latest sender name (or "Me" if user sent last)
      - Subject line (normalized, no Re:/Fwd:)
      - Snippet from latest message
      - Message count badge (e.g., "(5)")
      - Unread indicator (bold text + blue dot)
      - Timestamp of latest message
   c. Sorted by latest_message_at DESC

3. **Thread Detail View:**
   a. Opens as a vertical conversation
   b. All messages except the latest are collapsed (showing sender + first line)
   c. Tapping a collapsed message expands it (full body)
   d. Latest message is expanded by default
   e. Quick reply box at the bottom with To pre-filled and subject pre-set (Re: [subject])
   f. Thread-level actions in header: Archive All, Delete All, Mute Thread

4. **Mute Thread:**
   a. Muted threads set is_muted=1
   b. Muted threads do not trigger push notifications
   c. Muted threads stay in their folder but are de-emphasized (lower opacity)
   d. New messages in muted threads do not increment inbox unread count

5. **Thread-Level Actions:**
   a. Archive All: moves all messages in thread to Archive folder
   b. Delete All: moves all messages to Trash
   c. Mark Thread Read: marks all messages in thread as read
   d. Star Thread: stars the latest message

### Edge Cases

- Message has no headers (pre-IMAP messages in SQLite): fall back to subject-based grouping
- Thread has 100+ messages: virtualized list, load older messages on "Load more" scroll
- Reply to a reply (deep nesting): flatten to chronological order (not nested indentation)
- Message in thread moved to different folder: stays in thread, shows folder badge
- Thread spans multiple accounts (forwarded chain): each account has its own thread copy
- Muted thread receives new messages: thread updates silently (no notification, no unread count)
- Thread subject changes mid-conversation (Re: -> [New Subject]): keep in original thread if References header links them
- Two messages arrive simultaneously (same timestamp): sort by received order (rowid)
- User disables threading: fall back to flat message list (global setting)
- Thread with only sent messages (no replies): still shown as thread with count 1

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Inbox shows threads grouped by conversation, not individual messages
- [ ] **AC-2:** Thread row shows participant avatars, latest sender, subject, snippet, count badge
- [ ] **AC-3:** Tapping thread opens conversation view with collapsed messages
- [ ] **AC-4:** Latest message in thread is expanded by default
- [ ] **AC-5:** Tapping collapsed message expands it to show full body
- [ ] **AC-6:** Quick reply box at bottom of thread view
- [ ] **AC-7:** Thread-level actions: Archive All, Delete All, Mute, Mark Read
- [ ] **AC-8:** Muted threads de-emphasized and do not increment unread count
- [ ] **AC-9:** Thread count badge shows total messages in conversation

### Technical Criteria
- [ ] **TC-1:** ml_threads table created with correct schema
- [ ] **TC-2:** Thread resolution uses Message-ID/In-Reply-To/References headers (primary) and subject (fallback)
- [ ] **TC-3:** Thread metadata (count, unread, latest_at, participants) stays in sync
- [ ] **TC-4:** Thread list query returns in < 50ms for 1,000 threads
- [ ] **TC-5:** Muted thread flag suppresses notifications and unread count
- [ ] **TC-6:** Thread-level Archive/Delete applies to all messages in thread
- [ ] **TC-7:** New message correctly assigned to existing thread via headers

### Negative Criteria
- [ ] **NC-1:** Threads must NOT use nested/indented view (flat chronological only)
- [ ] **NC-2:** Muted threads must NOT send push notifications
- [ ] **NC-3:** Thread actions must NOT create orphaned messages (all messages move together)
- [ ] **NC-4:** Pre-IMAP messages without headers must NOT break thread view (fallback to subject grouping)

## UI Specification

### Mobile (Expo)
- Thread list item: `#12121A` surface, stacked avatars (left, overlapping 8px), text block (sender bold if unread, subject, snippet in secondary), count badge `rgba(59,130,246,0.2)` with `#3B82F6` text, timestamp right-aligned
- Thread detail: vertical scroll, message cards with collapse/expand animation (150ms)
- Collapsed message: single line -- avatar + "Sender name" + "First line of body..." + timestamp
- Expanded message: full message card with from/to/date header, full body, attachment list
- Quick reply: `#12121A` input bar pinned to bottom, Send button `#3B82F6`
- Muted indicator: reduced opacity (0.5) on thread row, bell-slash icon

### Web (Next.js)
- Thread list: table-like layout with the same info density
- Thread detail: right panel or full page, same collapse/expand pattern
- Quick reply: inline at bottom of thread panel
- Keyboard shortcuts: `n` next thread, `p` previous, `e` archive, `#` delete, `m` mute

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton thread rows | First inbox load |
| Empty | "No conversations yet" | No messages |
| Error | "Could not load thread" toast | DB query failure |
| Success | Thread list with conversation groups | Normal inbox |
| Partial | Thread with "Load more messages" at top | Thread has 50+ messages |

## Test Requirements

### Unit Tests
- [ ] Thread resolution: assigns message to thread via In-Reply-To header
- [ ] Thread resolution: assigns message to thread via References header
- [ ] Thread resolution: falls back to subject matching when no headers
- [ ] Thread resolution: creates new thread for unmatched message
- [ ] Thread metadata: message_count increments on new message
- [ ] Thread metadata: unread_count increments for unread messages
- [ ] Thread metadata: latest_message_at updates to newest received_at
- [ ] Thread metadata: participant_emails accumulates unique senders
- [ ] Thread CRUD: create thread, get by id, list by account
- [ ] Thread CRUD: getMessagesInThread returns chronological order
- [ ] Thread mute: is_muted flag persists
- [ ] Thread archive: moves all messages in thread to Archive
- [ ] Thread delete: moves all messages to Trash
- [ ] Subject normalization: strips Re:, Fwd:, FW: prefixes
- [ ] Cascade: deleting account removes threads

### Integration Tests
- [ ] Full flow: receive 3 related messages -> grouped into single thread -> thread view shows all 3
- [ ] Reply flow: open thread -> quick reply -> reply appears in thread

### QA Verification Script

1. Open MyMail on mobile
2. Ensure test account has at least one email conversation (3+ messages in a chain)
3. Navigate to Inbox
4. Verify: inbox shows threads, not individual messages -- corresponds to AC-1
5. Verify: thread row shows avatars, sender, subject, snippet, count badge "(3)" -- corresponds to AC-2, AC-9
6. Tap a thread with 3+ messages
7. Verify: conversation view opens with collapsed messages -- corresponds to AC-3
8. Verify: latest message is expanded -- corresponds to AC-4
9. Tap a collapsed message
10. Verify: message expands with full body -- corresponds to AC-5
11. Verify: quick reply box at bottom with pre-filled subject -- corresponds to AC-6
12. Type a reply and tap Send
13. Verify: reply appears in thread, count increments
14. Go back to inbox, long-press the thread
15. Verify: thread actions menu (Archive All, Delete All, Mute, Mark Read) -- corresponds to AC-7
16. Tap "Mute Thread"
17. Verify: thread de-emphasized with mute icon -- corresponds to AC-8
18. Send another test email to the muted thread
19. Verify: inbox unread count does not increment for the muted thread -- corresponds to AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to inbox and thread detail, verify grouping and expand/collapse
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
Basic subject-based grouping via `groupByThread()` in engine/search.ts (in-memory only, not persisted). No thread UI. Inbox shows flat message list.

### After This Work
RFC 5322-compliant threading: Message-ID/References-based thread resolution, persistent ml_threads table, conversation view with expand/collapse, quick reply, thread-level actions, mute support.

### Files Changed
- `modules/mail/src/types.ts` -- Added MailThread, ThreadMessage, ThreadSortOrder types
- `modules/mail/src/db/schema.ts` -- Added ml_threads table + thread columns on ml_messages
- `modules/mail/src/db/crud.ts` -- Added thread CRUD (create, get, list, getMessages, archive, delete, mute)
- `modules/mail/src/engine/threading.ts` -- NEW: thread resolution algorithm (replaces groupByThread)
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/components/ThreadView.tsx` -- NEW
- `apps/mobile/app/(mail)/components/ThreadListItem.tsx` -- NEW
- `apps/mobile/app/(mail)/components/ThreadMessage.tsx` -- NEW
- `apps/web/app/mail/components/ThreadView.tsx` -- NEW
- `apps/web/app/mail/components/ThreadListItem.tsx` -- NEW

### Known Limitations
- No nested/indented thread view (flat chronological only, like Gmail).
- No thread splitting (cannot separate a reply into its own thread).
- No thread-level snooze.
- Thread resolution is best-effort for messages without RFC 5322 headers.

### Context for Next Agent
The existing `groupByThread()` in engine/search.ts will be superseded by the new `engine/threading.ts`. Do not delete the old function immediately; other code may reference it. The threading engine should be a pure function: `resolveThread(message: MailMessage, existingThreads: MailThread[]): string` returning a thread_id. The ml_threads table denormalizes counts for fast inbox queries. When implementing Search, thread-aware search should group results by thread.
