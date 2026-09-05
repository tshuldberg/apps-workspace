# Feature Spec: Direct Messaging

## Metadata
- **Module:** forums
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [1] x2 + CrossModule [2] x1 + PaidUser [1] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 5-6 hours
- **Depends On:** User profiles (fr_profiles needed for participant identity), Real-time updates (Supabase Realtime for live message delivery)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Community forums generate connections between people, but without private messaging those connections stay surface-level. Direct messaging lets users have 1:1 and small-group conversations that deepen relationships formed in public threads. Both Discord and Reddit treat DMs as essential to retention: Discord reports that users who send DMs are 3x more likely to remain active after 30 days. Reddit's chat feature processes billions of messages monthly.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Discord | Yes | No (Nitro adds larger uploads) | Full DM system: 1:1, group DMs (up to 10), message history, file sharing, reactions, typing indicators, read receipts |
| Reddit | Yes | No | Reddit Chat: 1:1 and group chats, real-time messaging, image sharing, conversation requests with accept/decline |
| Lemmy | No | N/A | No DM system (relies on external communication) |

### Target User
Forum members who form connections in public threads and want to continue conversations privately. Discord users who expect seamless DM alongside community channels. Reddit users accustomed to chat alongside subreddit participation. MyForums without DMs forces users to exchange contact info through other platforms, breaking the closed-loop experience.

## Technical Context

### Where This Lives in MyLife

```
modules/forums/src/
  types.ts                            -- New Zod schemas: Conversation, DirectMessage, ConversationParticipant
  cloud/client.ts                     -- New cloud functions: conversation CRUD, message send/receive
  cloud/schema.sql                    -- New tables: fr_conversations, fr_conversation_participants, fr_direct_messages
  cloud/realtime.ts                   -- MODIFIED: add DM channel subscriptions
  db/schema.ts                        -- New cache tables: fr_conversations_cache, fr_messages_cache
  db/crud.ts                          -- New cache CRUD for conversations and messages

apps/mobile/app/(forums)/
  messages.tsx                        -- NEW: conversation list screen
  conversation.tsx                    -- NEW: message thread screen
  new-message.tsx                     -- NEW: compose new DM (user search + compose)
  components/MessageBubble.tsx        -- NEW: individual message bubble
  components/ConversationCard.tsx     -- NEW: conversation list item

apps/web/app/forums/
  messages/page.tsx                   -- NEW: conversation list page
  messages/[id]/page.tsx              -- NEW: conversation detail page
  messages/new/page.tsx               -- NEW: new conversation page
```

### Wireframe Position

```
Hub Dashboard
  └── MyForums card
       └── Messages (accessed via icon in header bar, not a tab)
            └── Conversation List ← YOU ARE HERE
                 ├── Conversation cards (sorted by last message)
                 ├── Unread badge counts
                 └── "New Message" FAB
                      └── User search + compose
                           └── Message thread view
```

Messages are accessible from:
1. Envelope icon in the forums header bar (all screens)
2. "Message" button on user profile screens
3. Long-press on a username in threads/replies -> "Send Message"

### Data Model

```sql
-- Conversations (1:1 and group)
CREATE TABLE IF NOT EXISTS fr_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT CHECK (char_length(title) <= 100),
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT CHECK (char_length(last_message_preview) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS fr_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES fr_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_muted BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Direct messages
CREATE TABLE IF NOT EXISTS fr_direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES fr_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'gif', NULL)),
  is_edited BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fr_conversations_last_msg ON fr_conversations (last_message_at DESC);
CREATE INDEX idx_fr_conv_participants_user ON fr_conversation_participants (user_id);
CREATE INDEX idx_fr_conv_participants_conv ON fr_conversation_participants (conversation_id);
CREATE INDEX idx_fr_messages_conv ON fr_direct_messages (conversation_id, created_at DESC);
CREATE INDEX idx_fr_messages_sender ON fr_direct_messages (sender_id);

-- RLS: Only participants can access conversations and messages
ALTER TABLE fr_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view conversations" ON fr_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fr_conversation_participants
      WHERE conversation_id = fr_conversations.id AND user_id = auth.uid()
    )
  );

ALTER TABLE fr_conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view participants" ON fr_conversation_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fr_conversation_participants cp
      WHERE cp.conversation_id = fr_conversation_participants.conversation_id AND cp.user_id = auth.uid()
    )
  );

ALTER TABLE fr_direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view messages" ON fr_direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fr_conversation_participants
      WHERE conversation_id = fr_direct_messages.conversation_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Authenticated users can send messages" ON fr_direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM fr_conversation_participants
      WHERE conversation_id = fr_direct_messages.conversation_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Senders can edit own messages" ON fr_direct_messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- Trigger: update conversation last_message_at on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE fr_conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.body, 200),
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON fr_direct_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- SQLite cache tables
CREATE TABLE IF NOT EXISTS fr_conversations_cache (
  id TEXT PRIMARY KEY,
  title TEXT,
  is_group INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  last_message_at TEXT,
  last_message_preview TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fr_messages_cache (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  is_edited INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** `@mylife/db` (SQLite cache), `@mylife/auth` (user identity), `@mylife/ui` (chat UI components), forums User Profiles (fr_profiles for display names/avatars), forums Real-time (Supabase Realtime for live delivery)
- **External:** Supabase Realtime (Postgres Changes for new messages, Broadcast for typing), Supabase Storage (for image attachments in DMs)
- **Cross-Module:** Could integrate with `@mylife/social` for cross-module DM notifications. Future: hub-level notification center could aggregate DM alerts.

## Functional Requirements

### User Stories
1. As a forum member, I want to send a private message to another member so we can discuss something without the whole community seeing.
2. As a user, I want to create a group conversation (up to 10 participants) for small-group coordination.
3. As a message recipient, I want to receive messages in real-time with typing indicators.
4. As a user receiving unwanted messages, I want to block a sender and report spam.
5. As a user, I want to see read receipts so I know when my message was seen.

### Behavior Specification

1. **Starting a 1:1 conversation:** From a user's profile, tap "Message". The app checks for an existing 1:1 conversation between the two users. If found, opens it. If not, creates a new fr_conversations row (is_group=false) with both users as participants and opens the compose view.
2. **Starting a group conversation:** From the messages screen, tap the "New Message" FAB. A user search screen appears. Select 2-10 users. Optionally set a group title. Creates fr_conversations (is_group=true) with all selected users as participants.
3. **Sending a message:** Type in the compose bar at the bottom of the conversation screen. Tap send (or press Enter on web). Message is inserted into fr_direct_messages. Supabase trigger updates fr_conversations.last_message_at and last_message_preview. Other participants receive the message via Supabase Realtime Postgres Changes subscription.
4. **Message display:** Messages render as chat bubbles: sent messages (right-aligned, `#F43F5E` background), received messages (left-aligned, glass background). Each bubble shows sender avatar (group only), message text, and timestamp. Consecutive messages from the same sender are grouped (no repeated avatar/name).
5. **Typing indicators:** When the user starts typing, a Broadcast event is sent to the conversation channel. Other participants see "X is typing..." below the message list. Same debounce rules as thread typing indicators (1 message per 2s).
6. **Read receipts:** When a user opens a conversation, fr_conversation_participants.last_read_at is updated to now(). The sender sees a small checkmark icon next to each message indicating delivery, and a double-checkmark when the recipient's last_read_at >= message.created_at.
7. **Unread badges:** The conversation list shows unread count per conversation (messages where created_at > participant's last_read_at). The messages icon in the header bar shows total unread count.
8. **Message editing:** Long-press a sent message -> "Edit". Opens inline editing. Edited messages show "(edited)" label. is_edited flag set to true.
9. **Message deletion:** Long-press -> "Delete". Sets is_deleted=true. Message body replaced with "This message was deleted" in UI. Original body retained in DB for moderation.
10. **Blocking:** From a conversation, tap the info icon -> "Block User". Uses existing fr_blocks table. Blocked users cannot send new messages. Existing conversations with blocked users are hidden from the conversation list.
11. **Image sharing in DMs:** Tap the image icon in the compose bar. Select an image. Image is uploaded to `forum-dm-media/{user_id}/{uuid}.webp`, URL stored in fr_direct_messages.media_url.
12. **Conversation list:** Sorted by last_message_at descending. Each card shows: participants' avatars (stacked for groups), conversation title or participant name, last message preview (truncated), relative timestamp, unread badge.

### Edge Cases

- **Messaging a blocked user:** Show toast "You have blocked this user" and prevent conversation creation.
- **Receiving message from blocked user:** Message is delivered to DB but hidden from the blocked user's view. Unblocking reveals full history.
- **Self-messaging:** Prevent creating a conversation with only yourself. Show error "Cannot message yourself."
- **Duplicate 1:1 conversation:** Before creating, query for existing conversation between the two users. If found, redirect to existing conversation.
- **Group with 1 person left:** If all other participants leave/are removed, the conversation remains accessible as a solo archive. No new messages can be sent.
- **Long message:** Max 5000 characters enforced client-side. Show character counter approaching limit (from 4500+).
- **Rapid message sending:** Optimistic UI: message appears immediately in chat, grayed until server confirms. If send fails, show retry button.
- **Network offline:** Messages are queued in SQLite cache with `pending` status. On reconnection, queued messages are sent in order. Recipients see messages with their original timestamps.
- **Message history pagination:** Load last 50 messages initially. Scroll up to load more (cursor-based pagination by created_at).
- **Module disabled:** DM subscriptions tear down. Messages are preserved in DB. Re-enabling shows full history.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can start a 1:1 conversation from another user's profile via "Message" button
- [ ] **AC-2:** User can create a group conversation with 2-10 participants and optional title
- [ ] **AC-3:** Messages appear as chat bubbles: sent (right, accent color), received (left, glass)
- [ ] **AC-4:** Messages are delivered in real-time to all conversation participants
- [ ] **AC-5:** Typing indicators show "X is typing..." for active participants
- [ ] **AC-6:** Read receipts show single check (delivered) and double check (read)
- [ ] **AC-7:** Conversation list shows unread badge count per conversation
- [ ] **AC-8:** Messages header icon shows total unread count
- [ ] **AC-9:** User can edit sent messages with "(edited)" label displayed
- [ ] **AC-10:** User can delete sent messages with "This message was deleted" placeholder
- [ ] **AC-11:** User can block a conversation participant
- [ ] **AC-12:** User can share images in conversations
- [ ] **AC-13:** Conversation list is sorted by most recent message

### Technical Criteria
- [ ] **TC-1:** fr_conversations, fr_conversation_participants, fr_direct_messages tables created with proper RLS
- [ ] **TC-2:** RLS ensures only conversation participants can read messages
- [ ] **TC-3:** Supabase trigger updates last_message_at and last_message_preview on new message
- [ ] **TC-4:** Realtime subscription delivers new messages with < 500ms latency
- [ ] **TC-5:** Offline messages queue in SQLite and sync on reconnection
- [ ] **TC-6:** Message history paginates at 50 per page with cursor-based pagination
- [ ] **TC-7:** Duplicate 1:1 conversations are prevented by pre-creation query
- [ ] **TC-8:** Blocked users cannot send messages (enforced server-side)

### Negative Criteria
- [ ] **NC-1:** Users must NOT be able to read messages from conversations they are not part of (RLS enforced)
- [ ] **NC-2:** Blocked users must NOT appear in conversation list of the blocker
- [ ] **NC-3:** Group conversations must NOT exceed 10 participants
- [ ] **NC-4:** Users must NOT be able to edit or delete other users' messages
- [ ] **NC-5:** Deleted messages must NOT show original body to recipients (only "This message was deleted")

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Conversation list cards: `rgba(255,255,255,0.04)` glass, 80px height, avatar(s) left, name + preview + time right
- Unread badge: `#F43F5E` circle with white count text, top-right of avatar
- Chat bubbles sent: `#F43F5E` background, `#F0F0F5` text, rounded 16px (top-left sharp for first in group)
- Chat bubbles received: `rgba(255,255,255,0.08)` background, `#F0F0F5` text, rounded 16px (top-right sharp for first in group)
- Compose bar: `rgba(255,255,255,0.04)` glass background, text input left, image icon + send button right
- Typing indicator: `rgba(255,255,255,0.04)` bar below messages, animated dots
- Read receipts: small checkmarks in `rgba(240,240,245,0.40)` below sent messages
- Group avatar: 2-3 overlapping circle avatars (28px each)

### Web (Next.js)

- Same tokens via CSS variables
- Split-pane layout: conversation list (left, 320px), active conversation (right, remaining)
- Messages at `/forums/messages`, individual at `/forums/messages/[id]`
- Keyboard: Enter to send, Shift+Enter for newline

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton conversation list / spinner in message area | Initial fetch |
| Empty | "No messages yet. Start a conversation!" with CTA button | No conversations |
| Error | "Could not load messages" with retry | Network failure |
| Success | Conversation list with messages flowing in real-time | Normal operation |
| Partial | Conversation list loaded, messages in selected conv still loading | Navigating between conversations |

## Test Requirements

### Unit Tests
- [ ] Conversation creation: 1:1 deduplication query returns existing conversation
- [ ] Conversation creation: group with title creates correctly
- [ ] Message schema validation: rejects body > 5000 chars, empty body
- [ ] Read receipt calculation: correct based on last_read_at vs message.created_at
- [ ] Unread count: accurately counts messages after last_read_at
- [ ] Block check: prevents conversation creation with blocked user
- [ ] Message queue: stores pending messages in SQLite when offline

### Integration Tests
- [ ] Full flow: start 1:1 -> send message -> recipient receives in real-time -> read receipt updates
- [ ] Group flow: create group -> all participants see conversation -> messages delivered to all
- [ ] Edit flow: send message -> edit it -> all participants see "(edited)" version
- [ ] Delete flow: send message -> delete it -> all participants see "This message was deleted"
- [ ] Offline flow: compose while offline -> reconnect -> message delivered with original timestamp
- [ ] Block flow: block user -> their messages hidden -> unblock -> messages reappear

### QA Verification Script

1. Open the app on two devices (User A and User B)
2. User A: navigate to User B's profile, tap "Message"
3. Verify: conversation screen opens -- corresponds to AC-1
4. User A: type "Hello" and send
5. Verify on User B: message appears in real-time in conversation list and detail -- corresponds to AC-4
6. Verify: User A sees single checkmark (delivered) -- corresponds to AC-6
7. User B: open the conversation
8. Verify: User A sees double checkmark (read) -- corresponds to AC-6
9. User A: start typing
10. Verify on User B: "User A is typing..." appears -- corresponds to AC-5
11. Verify: conversation list shows User A's conversation with "Hello" preview -- corresponds to AC-13
12. User B: send a reply "Hi there"
13. Verify: message renders as left-aligned glass bubble (received) on User A -- corresponds to AC-3
14. User A: long-press their "Hello" message, tap Edit, change to "Hello there"
15. Verify on User B: message shows "Hello there (edited)" -- corresponds to AC-9
16. User A: long-press, tap Delete
17. Verify on User B: message shows "This message was deleted" -- corresponds to AC-10
18. Create a group conversation: User A starts new message, selects User B + User C (if available), sets title "Test Group"
19. Verify: all participants see the group conversation -- corresponds to AC-2
20. User A: send an image in the conversation
21. Verify on User B: image renders inline in chat -- corresponds to AC-12
22. User B: tap info icon, "Block User A"
23. Verify: conversation with User A disappears from User B's list -- corresponds to AC-11
24. Navigate away and check the messages icon in header
25. Verify: unread badge shows correct count -- corresponds to AC-7, AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to messages, send/receive messages, test all 5 states
- [ ] Batch QA: after 5 features in forums module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec before building (Complexity = 1)

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization (Complexity = 1)

### Required if this feature contains business logic / calculation engine:
- [ ] Not applicable

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No private messaging capability exists in the forums module. Users can only communicate via public threads and replies. The fr_blocks table exists for blocking users but has no DM enforcement.

### After This Work
Full DM system: 1:1 and group conversations (up to 10), real-time message delivery via Supabase Realtime, typing indicators, read receipts, message editing/deletion, image sharing, offline message queuing, and block enforcement. Three new Supabase tables with RLS, two SQLite cache tables, mobile and web UI.

### Files Changed
- `modules/forums/src/types.ts` -- Added Conversation, DirectMessage, ConversationParticipant schemas
- `modules/forums/src/cloud/schema.sql` -- Added fr_conversations, fr_conversation_participants, fr_direct_messages tables
- `modules/forums/src/cloud/client.ts` -- Added conversation and message CRUD functions
- `modules/forums/src/cloud/realtime.ts` -- Added DM channel subscriptions
- `modules/forums/src/db/schema.ts` -- Added fr_conversations_cache, fr_messages_cache tables
- `modules/forums/src/db/crud.ts` -- Added conversation/message cache CRUD
- `modules/forums/src/definition.ts` -- Migration v3 (or v2 if profiles not yet applied)
- `apps/mobile/app/(forums)/messages.tsx` -- Conversation list screen
- `apps/mobile/app/(forums)/conversation.tsx` -- Message thread screen
- `apps/mobile/app/(forums)/new-message.tsx` -- New conversation compose
- `apps/mobile/app/(forums)/components/MessageBubble.tsx` -- Chat bubble component
- `apps/mobile/app/(forums)/components/ConversationCard.tsx` -- Conversation list card
- `apps/web/app/forums/messages/page.tsx` -- Web conversation list
- `apps/web/app/forums/messages/[id]/page.tsx` -- Web conversation detail
- `apps/web/app/forums/messages/new/page.tsx` -- Web new conversation

### Known Limitations
- No end-to-end encryption (messages readable by Supabase admin; encryption is a future feature)
- No message reactions (emoji reactions on DMs are deferred)
- No file attachments beyond images (PDFs, documents are deferred)
- No message search within conversations
- Group conversation max is 10 participants (larger groups should use community threads)

### Context for Next Agent
The DM system reuses the Supabase Realtime infrastructure from the Real-time Updates feature. The `cloud/realtime.ts` module should export a `createDMChannel(conversationId)` alongside the existing `createForumChannel(channelName)`. The fr_blocks table integration means the block checking logic lives in the cloud client functions, not in RLS (since RLS can check auth.uid() but not cross-reference fr_blocks for sender blocking). The offline queue in SQLite uses a `status` field ('pending', 'sent', 'failed') not present in the schema above; add it to fr_messages_cache.
