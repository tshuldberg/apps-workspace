# Feature Spec: RSVP Guest Messaging/Chat

## Metadata
- **Module:** rsvp
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** RSVP system (built), event comments (built, rv_comments)
- **Blocks:** none

## Business Context

### Why This Feature Exists
When guests RSVP to an event, coordination happens outside the platform -- in group texts, WhatsApp threads, or DMs. "What should I bring?" "Can I park on the street?" "Running 10 minutes late." Partiful solved this with in-app messaging, making the event page the single source of truth for all coordination. Without this, MyRSVP loses the conversation to iMessage and the host has to relay information between two platforms.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Partiful | Yes | Free | In-event chat thread, real-time messaging, push notifications |
| Evite | No | N/A | Comments exist but not a chat experience (no real-time) |
| RSVPify | No | N/A | No guest-to-guest messaging |
| Invyt | Partial | Free | Group chat for event coordination |

### Target User
Guests coordinating logistics for an upcoming event: carpooling, what to bring, arrival timing. Hosts who want to communicate with all guests without managing a separate group chat. Currently these users create a group text that excludes people who declined or were added late.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/db/schema.ts                -- V3: rv_messages table
modules/rsvp/src/definition.ts               -- Add to RSVP_MIGRATION_V3
modules/rsvp/src/types.ts                    -- EventMessage, MessageThread types
modules/rsvp/src/db/crud.ts                  -- Message CRUD operations
modules/rsvp/src/index.ts                    -- Re-export messaging API
modules/rsvp/src/__tests__/messaging.test.ts -- Messaging CRUD tests
apps/mobile/app/(rsvp)/chat.tsx              -- Mobile chat screen
apps/web/app/rsvp/[eventId]/chat/page.tsx    -- Web chat page
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Event Detail
                 └── "Chat" tab or button ← YOU ARE HERE
```

### Data Model

```sql
-- V3 Migration: Add event messaging

CREATE TABLE IF NOT EXISTS rv_messages (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    rsvp_id TEXT REFERENCES rv_rsvps(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    reply_to_id TEXT REFERENCES rv_messages(id) ON DELETE SET NULL,
    is_host_message INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS rv_messages_event_idx ON rv_messages(event_id);
CREATE INDEX IF NOT EXISTS rv_messages_created_idx ON rv_messages(event_id, created_at);
CREATE INDEX IF NOT EXISTS rv_messages_pinned_idx ON rv_messages(event_id, is_pinned);
```

**Design rationale:** This is a local chat log, not a real-time messaging system. Messages are stored in SQLite and displayed chronologically. No WebSocket or push notification infrastructure is needed. The existing `rv_comments` table is for the public event feed; `rv_messages` is for guest-to-guest coordination.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (chat bubble components, Cool Obsidian tokens)
- **External:** None. This is offline-first local messaging, not real-time sync.
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a guest, I want to send a message in the event chat so I can coordinate with other attendees.
2. As a host, I want to pin important messages (e.g., "Parking is on the left side") so guests see them first.
3. As a guest, I want to reply to a specific message to keep conversations threaded.
4. As a host, I want to delete inappropriate messages from the chat.

### Behavior Specification

**Viewing chat:**
1. User opens event detail
2. A "Chat" button/tab appears (with unread count badge if new messages exist)
3. Tapping opens the chat screen
4. Messages displayed chronologically (oldest at top, newest at bottom)
5. Pinned messages appear at the top in a sticky section
6. Each message shows: sender name, message text, timestamp, host badge (if from host)
7. Messages from the current user are right-aligned (chat bubble style)

**Sending a message:**
1. Text input at bottom of screen with send button
2. User types message (max 1000 chars) and taps send
3. Message saved to rv_messages with sender_name from RSVP record
4. Message appears in chat immediately
5. If user is the host, message marked with is_host_message=1

**Replying to a message:**
1. User long-presses (mobile) or hovers (web) a message
2. "Reply" option appears
3. Selecting "Reply" shows the original message in a quote above the input
4. New message saved with reply_to_id set to the original message's ID
5. Reply displays with quoted original message above it

**Pinning a message (host only):**
1. Host long-presses a message
2. "Pin" option appears (along with Reply, Delete)
3. Pinning sets is_pinned=1
4. Pinned messages appear in sticky section at top of chat
5. Max 3 pinned messages per event. Pinning a 4th unpins the oldest.

**Deleting a message:**
1. Host can delete any message. Guests can delete their own messages.
2. Delete removes the rv_messages record
3. If the deleted message has replies, replies remain but show "Original message deleted"

### Edge Cases
- **Guest who declined tries to chat:** Chat is view-only for declined guests. Show "RSVP to join the conversation" CTA.
- **Event with no RSVPs:** Chat shows "No guests yet. Invite friends to start chatting."
- **Very long message (>1000 chars):** Reject with "Message too long (max 1000 characters)"
- **Empty message:** Send button disabled. Cannot send empty or whitespace-only messages.
- **Guest removed from event:** Their messages remain but show "[Removed Guest]" as sender.
- **Rapid messages (spam):** Simple rate limit: max 10 messages per minute per sender. Show "Slow down" toast if exceeded.
- **Chat with 1000+ messages:** Paginate at 50 messages per page. "Load more" button at top for history.
- **Event deleted:** CASCADE deletes all messages.
- **Pinned message deleted:** Pin section updates immediately. Pin slot freed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Chat" button appears on event detail with unread badge
- [ ] **AC-2:** Messages display chronologically in chat bubble layout
- [ ] **AC-3:** Current user's messages are right-aligned, others left-aligned
- [ ] **AC-4:** Host messages show a host badge
- [ ] **AC-5:** User can send a message via text input + send button
- [ ] **AC-6:** User can reply to a specific message with quoted context
- [ ] **AC-7:** Host can pin messages (max 3), shown in sticky top section
- [ ] **AC-8:** Host can delete any message; guests can delete their own
- [ ] **AC-9:** Declined guests see chat as read-only with RSVP CTA
- [ ] **AC-10:** Messages paginate at 50 with "Load more" for history

### Technical Criteria
- [ ] **TC-1:** V3 migration creates rv_messages table with correct indexes
- [ ] **TC-2:** Messages stored with sender_name, event_id, timestamps
- [ ] **TC-3:** reply_to_id correctly references parent message
- [ ] **TC-4:** Pinned messages limited to 3 per event (oldest auto-unpinned)
- [ ] **TC-5:** Rate limiting: max 10 messages per minute per sender
- [ ] **TC-6:** Message text limited to 1000 characters
- [ ] **TC-7:** CASCADE delete removes all messages when event is deleted

### Negative Criteria
- [ ] **NC-1:** Declined guests must NOT be able to send messages
- [ ] **NC-2:** Guests must NOT be able to pin or delete others' messages
- [ ] **NC-3:** Messaging must NOT require network access (local SQLite)
- [ ] **NC-4:** Deleting a message with replies must NOT delete the replies

## UI Specification

### Mobile (Expo)
- **Background:** `#0A0A0F`
- **Chat bubbles:** Glass card style. Current user: `#FB7185` at 15% opacity, right-aligned. Others: `rgba(255,255,255,0.04)`, left-aligned.
- **Sender name:** `caption` typography in `rgba(240,240,245,0.65)` above bubble
- **Host badge:** Small rose dot next to host name
- **Pinned section:** Top of screen, glass background `rgba(255,255,255,0.08)`, pin icon, compact layout
- **Input bar:** Bottom-fixed, glass background, text input + send button (accent `#FB7185`)
- **Reply quote:** Above input bar, smaller bubble with "Replying to [name]" label, X to cancel

### Web (Next.js)
- Accessible at `/rsvp/[eventId]/chat`
- Standard chat layout: messages in center column, input at bottom
- Same glass token styling via CSS variables
- Hover actions (reply, pin, delete) instead of long-press

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty Chat | "No messages yet. Start the conversation!" | No messages exist |
| Active Chat | Chronological messages with input bar | Messages exist |
| Pinned Messages | Sticky section at top with up to 3 pinned messages | Host has pinned messages |
| Read-Only | Messages visible but input disabled, RSVP CTA shown | User has declined RSVP |
| Loading More | Spinner at top of chat | User taps "Load more" |
| Rate Limited | Toast: "Slow down! Try again in a moment." | >10 messages in 1 minute |

## Test Requirements

### Unit Tests
- [ ] `createMessage`: stores message with correct fields
- [ ] `getMessagesByEvent`: returns messages in chronological order
- [ ] `getMessagesByEvent`: paginates correctly (limit/offset)
- [ ] `getPinnedMessages`: returns only pinned messages (max 3)
- [ ] `pinMessage`: sets is_pinned=1
- [ ] `pinMessage`: unpins oldest when >3 pinned
- [ ] `unpinMessage`: sets is_pinned=0
- [ ] `deleteMessage`: removes message, preserves replies
- [ ] `getUnreadCount`: returns count of messages after last read timestamp
- [ ] `canSendMessage`: returns false for declined RSVP
- [ ] `canSendMessage`: returns true for going/maybe RSVP

### Integration Tests
- [ ] Send message -> verify stored in rv_messages -> appears in query
- [ ] Reply to message -> verify reply_to_id set -> reply shows quoted context
- [ ] Pin 4 messages -> verify only 3 pinned (oldest unpinned)
- [ ] Delete message with replies -> verify replies remain, show placeholder
- [ ] Delete event -> verify all messages CASCADE deleted
- [ ] V3 migration runs cleanly on existing V2 database

### QA Verification Script

1. Open MyRSVP, navigate to an event with 2+ going RSVPs
2. Tap "Chat" button
3. **Verify:** Empty chat state with "Start the conversation!" -- empty state
4. Type "Hey everyone!" and send
5. **Verify:** Message appears right-aligned (current user) -- AC-3
6. Switch to guest 2, open same event chat
7. **Verify:** Guest 1's message visible, left-aligned -- AC-2
8. Guest 2 sends "What should I bring?"
9. Switch to host view
10. Long-press Guest 2's message, tap "Pin"
11. **Verify:** Message appears in pinned section at top -- AC-7
12. Long-press Guest 1's message, tap "Reply"
13. Type "Bring snacks!" and send
14. **Verify:** Reply shows with quoted original message -- AC-6
15. **Verify:** Host messages show host badge -- AC-4
16. Create a guest who declined, open chat
17. **Verify:** Chat is read-only, RSVP CTA shown -- AC-9

## gstack Quality Gates

Based on Complexity Inverse score of 1 (Complex):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Complex features (Complexity <= 1):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature has UI:
- [ ] `/browse` -- navigate to chat, send messages, test all interactions

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- rv_comments exists for public event feed (single-threaded, no replies, no pinning)
- No guest-to-guest messaging capability
- Event coordination happens outside the app (texts, group chats)
- No rv_messages table

### After This Work
- V3 migration adds rv_messages table with indexes
- Full CRUD: createMessage, getMessagesByEvent, getPinnedMessages, pinMessage, unpinMessage, deleteMessage, getUnreadCount
- Chat screen on mobile and web with bubble layout
- Reply threading, message pinning (max 3), host badges
- Rate limiting and message length validation
- 11+ unit tests, 6+ integration tests

### Files Changed
- `modules/rsvp/src/db/schema.ts` -- V3 migration: rv_messages table
- `modules/rsvp/src/definition.ts` -- Add to RSVP_MIGRATION_V3
- `modules/rsvp/src/types.ts` -- EventMessage type
- `modules/rsvp/src/db/crud.ts` -- Message CRUD, pinning, rate limiting
- `modules/rsvp/src/index.ts` -- Re-export messaging API
- `modules/rsvp/src/__tests__/messaging.test.ts` -- Messaging CRUD and edge case tests
- `apps/mobile/app/(rsvp)/chat.tsx` -- Mobile chat screen
- `apps/web/app/rsvp/[eventId]/chat/page.tsx` -- Web chat page

### Known Limitations
- Not real-time: messages are stored locally and loaded on screen open (no WebSocket push)
- No read receipts or typing indicators
- No image/media messages (text only)
- No direct messages between guests (group chat only)
- No message search
- No notification when new messages are posted (local storage only)
- Rate limiting is per-session, not persistent (resets on app restart)

### Context for Next Agent
- This is a LOCAL chat, not a networked messaging system. All messages are stored in SQLite on the host's device. There is no server-side sync or real-time delivery. This is intentional for privacy-first design.
- The difference between `rv_comments` (existing) and `rv_messages` (new): comments are the public event feed visible to all (like Evite's wall). Messages are the coordination chat for going/maybe guests, with threading, pinning, and moderation.
- `reply_to_id` creates a simple threading model. Display replies inline (not collapsed threads). Show the quoted message content by joining with the parent message record.
- Rate limiting: track timestamps in memory (not database). On message send, check if the sender has sent 10+ messages in the last 60 seconds. This prevents spam but does not persist across app restarts.
- "Unread count" for the badge: store the last-read timestamp per event in `rv_settings` with key `chat_read:{eventId}`. Count messages with `created_at > last_read_timestamp`.
