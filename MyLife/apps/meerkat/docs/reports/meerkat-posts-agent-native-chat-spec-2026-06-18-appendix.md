# Meerkat Posts Spec - Research Appendix

Generated 2026-06-18 from workflow wf_c61b380d-7ed (15 agents, ~1.27M tokens). Structured backing data for the feature spec.


## Problem model (extracted from founder brain-dump)

```json
{
  "painPoints": [
    {
      "id": "pp-no-inline-replies",
      "title": "No inline replies; replying forces a thread",
      "description": "Slack has no inline reply to a single message. To respond to one message you must open a thread, and even then you cannot reply to one specific message inside the thread. The workaround is manually quoting parts of a message yourself. He calls the lack of inline replies 'absurd'.",
      "severity": "high"
    },
    {
      "id": "pp-thread-decay",
      "title": "Threads decay into history and never resurface",
      "description": "Threads fall back into the channel history and stay old even when still active. Unless you happen to have notifications turned on for that specific thread, finding an active thread again is even harder. There is no recency mechanism that pulls an active thread back up.",
      "severity": "blocker"
    },
    {
      "id": "pp-no-bumping",
      "title": "New activity does not bump a thread/post back to the top",
      "description": "When someone adds a comment to an old Facebook post, that post gets bumped to the top of the feed. Slack threads do the opposite: a new reply to an old thread leaves it buried. He singles this out as the most important missing mechanic ('why the fuck do not threads reply like that') and notes literally every other app does recency-bumping.",
      "severity": "blocker"
    },
    {
      "id": "pp-no-infinite-nesting",
      "title": "No infinite / sub-nested replies, so parallel takes clog the main thread",
      "description": "Slack cannot model the Facebook pattern where a top-level comment gets two different replies and you can answer each one individually without clogging the main thread. Without sub-nesting, divergent takes on one point collapse into one flat thread.",
      "severity": "high"
    },
    {
      "id": "pp-slack-only-sends",
      "title": "Slack is built only for SENDING messages, not reading/prioritizing/status",
      "description": "Slack is built for sending messages and nothing else. It is not built for reading messages, not meant for prioritizing work, and not meant for getting status. The product optimizes the send side and ignores the read/prioritize/status side entirely.",
      "severity": "blocker"
    },
    {
      "id": "pp-agents-brute-forced",
      "title": "Agents are brute-forced into Slack and it does not work",
      "description": "Teams have spent a long time trying to force agents into Slack. In his case it only reminded him how bad a platform Slack is. Agents are not first-class participants in the same control plane as humans; they are bolted on.",
      "severity": "blocker"
    },
    {
      "id": "pp-discord-telegram-agent-sprawl",
      "title": "Agent workflows elsewhere produce unmanageable thread/channel sprawl",
      "description": "Running something like a Hermes agent spins up a bunch of threads inside Discord that are impossible to manage (still better than Telegram). There is no real content system that an agent posts into and that bumps back up when the agent replies.",
      "severity": "medium"
    },
    {
      "id": "pp-wrong-abstractions",
      "title": "Messages, replies, threads, channels, and companies are all the wrong abstractions",
      "description": "There is a 'weird breakdown' across messages, replies, threads, channels, and companies. None of these are the right abstraction, and users are stuck fighting all of them all of the time.",
      "severity": "high"
    },
    {
      "id": "pp-slack-lock-in",
      "title": "Slack's cross-company connection model creates strong lock-in",
      "description": "Slack's connection system, where one user can belong to two companies, is really powerful and has captured almost every channel. He keeps Slack installed only so he can talk to another company despite finding it miserable. This makes Slack very hard to defeat.",
      "severity": "high"
    },
    {
      "id": "pp-workplace-shutdown",
      "title": "Facebook Workplace, the best-fit product, was killed",
      "description": "Facebook Workplace was the closest thing he has ever seen to a good context-management product for team work, but Meta announced it was ending all development in August of last year, so it is no longer an option.",
      "severity": "high"
    },
    {
      "id": "pp-teams-not-usable",
      "title": "The only alternative with these ideas is Microsoft Teams, which is unusable for real work",
      "description": "Teams apparently has some of these ideas somewhere, which is interesting, but because it is Microsoft Teams it will never be useful for real work.",
      "severity": "medium"
    }
  ],
  "desires": [
    {
      "id": "d-posts-primitive",
      "title": "Posts as the core primitive (between channel and thread)",
      "description": "Make the post the central primitive, sitting between a channel and a thread, the way a Facebook post does: it can live in a group, on your wall, or on someone else's wall, and it goes to the top of the feed when created or touched."
    },
    {
      "id": "d-threads-subprimitive",
      "title": "Threads as the sub-primitive on a post",
      "description": "Make threads the sub-primitive that hangs off a post, so they are easy to interface with for both humans and agents, instead of being a competing top-level concept."
    },
    {
      "id": "d-inline-replies",
      "title": "Inline replies that make sense",
      "description": "Be able to reply directly to a single message, including a single message inside a thread, without being forced into a separate thread or manually quoting."
    },
    {
      "id": "d-infinite-nesting",
      "title": "Infinite nesting / sub-nested comments",
      "description": "Support top-level comments on a post, threading within a comment, and sub-nesting within that, so two people can reply to one comment with different takes and each can be answered individually without clogging the main thread."
    },
    {
      "id": "d-recency-bumping",
      "title": "Recency bumping: activity resurfaces old content",
      "description": "When someone (human or agent) comments on an old post or thread, it gets bumped back to the top of the feed, exactly like Facebook. Recent things surface even if they live in an old thread."
    },
    {
      "id": "d-prioritization-reading-status",
      "title": "A chat app that helps you prioritize, read, and get status, not just send",
      "description": "The product should help him prioritize what he is supposed to be doing, bring up recent things even in old threads, give status, and support reading, not just optimize the send path the way Slack does."
    },
    {
      "id": "d-agents-same-control-plane",
      "title": "Agents as first-class participants in the same control plane",
      "description": "Agents should come in and be part of the same control plane the human is in, in a logical way, rather than being brute-forced bots bolted onto a send-only platform."
    },
    {
      "id": "d-fork-subcomment-send-agent",
      "title": "Fork a sub-comment and send an agent to explore it",
      "description": "Be able to branch off context easily: take a sub-comment, send an agent to go explore it, and have the agent come back with feedback. When the agent replies to the post, the post bumps back up."
    },
    {
      "id": "d-agent-content-system",
      "title": "An agent content system: post the work, agents reply and bump it",
      "description": "Replace unmanageable Discord/Telegram agent threads with a real content system: a group where you post the things you want to work on, and when an agent replies to a post it gets bumped back up to the top."
    },
    {
      "id": "d-open-source-standard",
      "title": "An open-source standard that is easy to adopt and play with",
      "description": "Ship this as an open-source standard, easy to adopt and experiment with, designed to slowly replace Slack rather than to replace it overnight."
    },
    {
      "id": "d-cross-company-connection",
      "title": "Cross-company connection, done right",
      "description": "Match Slack's powerful cross-company strength (one user in multiple companies) so people can talk across organizations, which is the lock-in that keeps him on Slack today."
    },
    {
      "id": "d-feels-like-facebook",
      "title": "Slack capability with a Facebook feel",
      "description": "He wants something with Slack's role but that feels more like Facebook Workplace and is built from the ground up to be far easier to interface with agents."
    }
  ],
  "primitiveCritique": {
    "currentPrimitives": [
      "message",
      "reply",
      "thread",
      "channel",
      "company"
    ],
    "whyTheyFail": "He states directly that across messages, replies, threads, channels, and companies, none of them are the right abstraction and users are stuck fighting all of them all of the time. The message is the wrong atom: Slack is built only to SEND messages, with no native inline reply, so responding forces a thread. The thread is a broken concept: it falls back into history, stays old even when active, cannot be bumped by new activity, has no inline reply to a single message inside it, and supports no sub-nesting, so parallel takes on one point clog the main thread. Channels are too coarse and threads too buried, with nothing in between. The company boundary is the one strong piece (cross-company connection drives lock-in) but it is bolted onto the wrong content model. Critically, none of these primitives were designed for agents, which is why agents have to be brute-forced in. The Facebook post is offered as proof of a better atom: it lives between a channel and a thread, bumps to the top on any new activity, supports top-level comments plus nested and sub-nested replies, and is equally easy for humans and agents to interface with.",
    "proposedPrimitives": [
      {
        "name": "Post",
        "definition": "The core primitive, modeled on a Facebook Workplace post. It lives in a group, on your wall, or on someone else's wall, goes to the top of the feed when created, and (most importantly) gets bumped back to the top whenever anyone (human or agent) comments on it. It is the unit you post the work you want to do into.",
        "sitsBetween": "Between a channel (too coarse, a container) and a thread (too granular and buried). The post is the missing middle abstraction."
      },
      {
        "name": "Thread",
        "definition": "Demoted from a competing top-level concept to a sub-primitive that hangs off a post. Threads become the easy-to-interface surface on a post, for humans and for agents, supporting comments, nested replies, and sub-nested replies under a single post.",
        "sitsBetween": "Below the Post and above an individual reply/comment. It is the post's reply structure, not a standalone object."
      },
      {
        "name": "Inline reply",
        "definition": "A reply targeted at one specific message, including a single message inside a thread, without being forced to open a separate thread or manually quote. Enables answering two divergent replies to the same comment individually without clogging the main thread.",
        "sitsBetween": "Below a Thread, the leaf-level response that addresses one message, enabled by infinite sub-nesting."
      },
      {
        "name": "Agent participant",
        "definition": "An agent that joins the same control plane as the human rather than being bolted on. It can be dispatched by forking a sub-comment ('send an agent to explore it'), works the post, and replies back into the post's thread; its reply bumps the post to the top like any human comment.",
        "sitsBetween": "A peer to the human inside the Post/Thread/inline-reply structure, operating in the same control plane rather than as an external bot integration."
      }
    ]
  },
  "agentRequirements": [
    "Agents must be first-class participants in the same control plane as humans, not brute-forced bots bolted onto a send-only platform",
    "Forking context must be cheap: take a sub-comment, dispatch an agent to explore it, and have it return with feedback ('fork-a-subcomment-send-an-agent')",
    "When an agent replies to a post, that post must bump back to the top of the feed exactly like a human comment",
    "The post/thread structure must be as easy for agents to interface with as it is for humans (threads as the agent-friendly sub-primitive on a post)",
    "Replace unmanageable Discord/Telegram agent thread sprawl with a real content system: a group where you post work and agents reply into bumping posts",
    "Support a Hermes-style agent pattern natively, not via per-task ephemeral threads that are impossible to manage",
    "Agent participation must be logical and legible, so the human can prioritize, read, and get status on what agents are doing, not just receive sent messages"
  ],
  "emotionalDrivers": [
    "Urgency and fear of a closing window ('We might have our last chance right now')",
    "Genuine pain and longing, not mild preference ('this hurts me, really hurts me: I want Facebook Workplace')",
    "Daily misery and resentment at being locked into a tool he hates ('feels miserable to use', kept only to talk to another company)",
    "Frustration bordering on anger at an obvious missing mechanic ('why the fuck do not threads reply like that')",
    "Grief over a dead product that was the closest thing to right (Workplace shut down)",
    "Builder's itch and regret ('I even started building this myself but I have been too busy')",
    "Yearning and desire for the ideal to exist ('I want this so bad', 'So good. I wish it existed')",
    "Contempt for incumbents that almost get it but are structurally unusable (Microsoft Teams)"
  ],
  "keyQuotes": [
    "We might have our last chance right now.",
    "Slack has a real locking problem. It is going to be really hard to defeat because Slack's connection system where one user can be in two companies is really powerful and it has gotten almost every channel.",
    "The lack of inline replies is absurd. You have to do a thread to reply.",
    "Threads themselves are pretty bad too because they just fall back in the history and if they are still active, finding them is even harder.",
    "Slack is built for sending messages. Nothing else... It is not meant for prioritizing work. It is not meant for getting status. It is meant for sending.",
    "I dream of a chat app that helps me prioritize what I am supposed to be doing, that brings up recent things even if they are happening in an old thread.",
    "take a sub comment and send an agent to go explore it and then come back with feedback. I want infinite nesting.",
    "I want agents to be able to come in and be part of the same control plane I am in, in a way that is logical.",
    "this hurts me, really hurts me: I want Facebook Workplace.",
    "when someone leaves a comment on an old post, that post gets bumped. Why the fuck do not threads reply like that?",
    "Facebook Workplace is the closest thing I have ever seen to a good context management product for working with a team on real work. Posts were a much better primitive than Slack messages.",
    "I think posts are a much better primitive because they fit somewhere between something like a channel and something like a thread, and then threads are the sub primitive on a post.",
    "you have an actual content system, a group where you post the things you want to work on, and then when your agent replies to the post it gets bumped back up. So good.",
    "I want this as an open source standard that is easy to adopt and play with. Not to replace Slack overnight, but to slowly replace Slack."
  ],
  "northStar": "An open-standard, agent-native team chat built on posts (a primitive between channel and thread) where every human or agent reply bumps the post back to the top, so it slowly erodes Slack by helping teams prioritize, read, and get status instead of just sending."
}
```


## Meerkat codebase map

```json
[
  {
    "area": "community data layer",
    "currentPrimitives": [
      "cm_messages (PK id): the single append-only event log. One row = one immutable, sender-signed event. Columns: id, community_id, channel_id, author_device_id, body, attachments_json (TEXT, default '[]'), hlc_wall, hlc_counter, supersedes_id (nullable), supersedes_deleted (0/1, nullable), signature, updated_at (= hlc.wall). Index cm_messages_channel on (community_id, channel_id, hlc_wall, hlc_counter, author_device_id). New rows added via INSERT OR IGNORE so the log is idempotent on id.",
      "cm_message_attachments (PK id = `${messageId}:${attachment.id}`): denormalized index of per-message attachment metadata. Columns: id, message_id, community_id, channel_id, attachment_id, blob_hash, name, mime_type, size, updated_at. The bytes are NOT here (moved separately by blob_hash via the session blob provider); this is metadata only. Mirrors the attachments_json already embedded inside the signed cm_messages event (the JSON is the canonical, signed copy; this table is a query/index convenience).",
      "cm_reactions (PK id): table EXISTS in COMMUNITY_DDL and in COMMUNITY_SYNC_POLICY (or_set, shared_workspace) but is DEAD/UNWIRED. Columns: id, community_id, message_id, emoji_shortcode, member_device_id, updated_at. No helper, no insert/read, no sync-engine event, no UI references it anywhere in app or @mylife/sync (only in the DDL string and one test). Reactions do not actually function.",
      "cm_read_state (PK id = `${communityId}:${channelId}`): personal-replica last-read cursor per channel. Columns: id, community_id, channel_id, last_read_wall, last_read_counter (nullable HLC), updated_at. Scope personal_replica/maxScope personal_replica (must never cross a shared-community session). Drives unread counts via countUnreadChannelMessages / listCommunityChannelUnreadCounts.",
      "cm_file_requests (PK id = requestId): LOCAL-ONLY request/approve/restore state machine for the file re-send flow. Deliberately OMITTED from the sync policy so it never replicates. Columns include direction, counterparty_device_id, status, detail.",
      "cm_snapshots (PK community_id, channel_id): LOCAL-ONLY rolling-snapshot index (one per channel). Metadata only; the snapshot pieces live in a host-style piece store. Columns: epoch, snapshot_id, info_hash, through_wall, through_counter, manifest_json, event_count, created_at.",
      "cm_feed_cursor (PK community_id, channel_id): LOCAL-ONLY warm-tail cursor (last_wall, last_counter). Written ROW-ONLY, never through engine.recordChange. Tracks how far the host-feed pull/snapshot import has advanced.",
      "ChannelMessageEvent (the @mylife/sync wire/domain shape behind a cm_messages row): { version:1, id (content hash, 32 hex chars of sha512 over canonical form + signature), communityId, channelId, authorDeviceId (Ed25519 device id), body, attachments?: ChannelMessageAttachment[], hlc:{wall,counter}, supersedes?:{id,deleted}, signature }. createChannelMessage signs it; verifyChannelMessage re-derives the id and checks the Ed25519 signature; an event failing verification is dropped (invalid count).",
      "Edits and deletes ARE supported, as immutable superseding events (NOT in-place mutation): an edit is a new signed event with supersedes:{id, deleted:false}; a delete is a new signed event with body:'' and supersedes:{id, deleted:true}. resolveChannelMessages folds the log: edits keep the original root's slot, deletes remove it. Only the author device may edit/delete (enforced in ChatProvider by authorDeviceId === identity.publicKey). Delete also calls destroyChannelMessageKeys to shred the local per-event key.",
      "Ordering/clock: hybrid logical clock (Hlc = wall + per-author counter). nextHlc advances from highestHlc(db, community, channel). compareChannelMessages gives a deterministic total order (wall, counter, authorDeviceId, id). No server timestamp authority."
    ],
    "capabilities": [
      "Flat per-channel message feed: a signed, append-only event log keyed by (community_id, channel_id), rendered in deterministic HLC order. Idempotent merge via INSERT OR IGNORE on the content-hash id.",
      "Edit and delete as superseding signed events (supersedes chain), folded to a visible list by resolveChannelMessages. listChannelMessageThreadIds walks a supersedes chain to find all event ids sharing one root (this is the edit/tombstone chain, NOT user-facing reply threads).",
      "Author-only mutation: edit/delete enforced to the originating device by Ed25519 author identity.",
      "File attachments: signed attachment metadata embedded in the event (attachments_json) plus a denormalized cm_message_attachments index; bytes move out-of-band by blob_hash; a request/approve/decline re-send flow over cm_file_requests.",
      "Unread tracking: personal-replica cm_read_state HLC cursor -> per-channel and per-community unread counts.",
      "Offline + host-feed delivery: messages queued to a per-channel mailbox (queueChannelMessageMailbox), merged on drain (mergeChannelMessageEvents with signature verification), plus rolling encrypted snapshots (cm_snapshots) and warm cursor (cm_feed_cursor) for host-seeded scrollback / pull-now refresh.",
      "Channels are defined in the owner-signed CommunityDescriptor (CommunityChannel { id, name, postRoles? }); messages reference a community+channel by id only. There is no cm_channels table - channel existence and post-permission live entirely in the descriptor, validated against it at render time (channel unavailable when no signed descriptor exists)."
    ],
    "relevantFiles": [
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/community-core.ts",
        "role": "Canonical cm_ schema (COMMUNITY_DDL), COMMUNITY_SYNC_POLICY (which cm_ tables replicate + scope/conflict), row<->event mappers, merge/list/read-state/unread helpers, supersedes-chain walker, snapshot + feed-cursor + refresh logic. Primary place a new schema/field attaches."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/channel-message.ts",
        "role": "@mylife/sync source of the ChannelMessageEvent contract: interface, canonical form, createChannelMessage (sign), verifyChannelMessage, channelMessageId, compareChannelMessages, resolveChannelMessages (edit/delete fold), nextHlc. The signed event shape any new field must be added to here first (it is part of the signature)."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/community.ts",
        "role": "CommunityDescriptor + CommunityChannel + CommunityMember definitions. Channels and post-roles live in the owner-signed descriptor, not a DB table. Where a channel/thread-container or agent-member field would attach at the community-structure level."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/providers/ChatProvider.tsx",
        "role": "send/edit/delete event construction (createChannelMessage with supersedes for edit/delete), mailbox queueing, recordLocalChange replication of cm_messages + cm_message_attachments, optimistic local-message reducer (ChannelChatItem)."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx",
        "role": "Channel chat UI: flat bubble list, edit/delete affordances, attachment compose, file-request approve panel, host-history import. No reply/thread/reaction UI exists; messages render as one flat ordered list."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/db.ts",
        "role": "mk_ schema (identity, settings k/v, pinned). mk_ tables are outside the sync prefix map and never replicate. Holds per-community personal prefs (auto_update:, last_pulled:) as settings rows."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat-web/src/lib/meerkat-data.ts",
        "role": "Web twin of the cm_ data helpers (snapshots/cursor/refresh/auto-update/last-pulled). Must stay in lockstep with community-core.ts - any cm_ schema change has to be mirrored here and gated by check-meerkat-parity."
      }
    ],
    "gapsVsVision": [
      "Posts-as-primitive: today the primitive is a chat MESSAGE event (body + attachments) scoped to a channel, not a richer 'post' (no title, tags, post-type, link/embed, structured payload, or post-level visibility). A post primitive would need new fields on the signed ChannelMessageEvent (canonical form + signature) or a new sibling event type; cm_messages.body is a single free-text TEXT column.",
      "Nested threads / replies do NOT exist. The only parent->child relation in the schema is supersedes (edit/tombstone chain of the SAME logical message), not a reply-to graph. There is no parent_id/root_id/reply_to/thread_id field, no thread container, and resolveChannelMessages explicitly collapses supersedes into one slot. listChannelMessageThreadIds is a misnomer: it returns the supersedes chain, not a conversation thread. Real threading needs a new reply/parent reference field on the event plus a tree-aware resolver and UI.",
      "Bumping / recency ordering is not modeled. Ordering is strictly by author HLC (compareChannelMessages: wall, counter, author, id). There is no last_activity / bumped_at / reply_count column, no notion of a post floating to the top on new activity, and unread is a simple HLC>cursor count. A bump model would need a recency field updated on child events (which fights the append-only, no-in-place-mutation design).",
      "Reactions are declared but DEAD. cm_reactions exists in DDL + sync policy (or_set) but has zero helpers, zero writes/reads, zero sync events, and zero UI. There is no ReactionEvent in @mylife/sync (unlike ChannelMessageEvent). To work it needs: a signed reaction event type in @mylife/sync, insert/list/aggregate helpers in community-core.ts, recordLocalChange wiring in ChatProvider, the web twin, and channel UI.",
      "Agent participants are unmodeled. author_device_id is a raw Ed25519 device id; identity/trust comes only from paired devices + the signed descriptor member list (CommunityMember has deviceId/role/displayName/dhPublicKey, roles are workspace owner/admin/member only). There is no member-type/is-agent/bot/automation flag, no agent capability or permission field, and post-permission (postRoles) is role-based with no agent concept. An agent member would need a new member kind/capabilities in CommunityDescriptor and likely an author-kind field on the event.",
      "Attachments are duplicated (signed attachments_json inside cm_messages AND a denormalized cm_message_attachments index) - any post/thread/reaction extension that touches attachments must keep both in sync.",
      "No content-type/schema-version discriminator on the event beyond version:1 - introducing posts vs replies vs reactions as event variants will need a type/kind discriminator added to the canonical signed form (a breaking signature-surface change)."
    ],
    "extensionPoints": [
      "@mylife/sync ChannelMessageEvent interface + canonicalChannelMessage() in packages/sync/src/protocol/channel-message.ts: the single place to add signed fields (e.g. replyToId/rootId for threads, postType/title/tags for posts-as-primitive, authorKind for agents). ANY new field must be appended to the canonical array (and bumped/version-guarded) because the content id + Ed25519 signature cover it.",
      "COMMUNITY_DDL in community-core.ts: add columns to cm_messages (e.g. reply_to_id, root_id, post_type, bumped_at) plus matching indexes; or activate cm_reactions and add the sibling cm_* table. ensureCommunityTables already runs all DDL; ensureAttachmentsJsonColumn shows the established ALTER-TABLE migration pattern for adding a column to an existing cm_messages.",
      "COMMUNITY_SYNC_POLICY.entityRules in community-core.ts: register replication scope + conflict strategy for any new cm_ table (cm_reactions already has an or_set rule prewired; a new threads/posts table would need its own rule, and cm_messages stays or_set/shared_workspace). Omitting a table here (like cm_file_requests/cm_snapshots/cm_feed_cursor) keeps it local-only.",
      "Row<->event mappers in community-core.ts (channelMessageRowFromEvent / channelMessageEventFromRow) and insertMessageRow's column list: extend these in lockstep with the event interface so new fields round-trip through SQLite.",
      "resolveChannelMessages() in channel-message.ts: the fold algorithm to extend for thread trees (currently flattens supersedes); a recency/bump sort would also slot in alongside compareChannelMessages.",
      "ChatProvider.tsx sendMessage/editMessage/deleteMessage + recordMessageEvent: where new event kinds (reply, reaction, post) get created, signed, recorded, and replicated via recordLocalChange; add new methods here (e.g. react(), reply()).",
      "CommunityChannel / CommunityMember in packages/sync/src/protocol/community.ts: add a member kind/agent capability or channel post-type config to the owner-signed descriptor (this is the trusted place to declare agent participants and per-channel post rules).",
      "cm_reactions table (already in DDL + policy): the cheapest extension point to make reactions real - add a signed reaction event type in @mylife/sync, helpers + recordLocalChange wiring, and the web twin in meerkat-web/src/lib/meerkat-data.ts (parity-gated).",
      "Web twin apps/meerkat-web/src/lib/meerkat-data.ts + schema.ts: every cm_ schema/field change must be mirrored here to pass check-meerkat-parity (native is canonical)."
    ]
  },
  {
    "area": "chat UI",
    "currentPrimitives": [
      "Communities tab (communities.tsx): vertical ScrollView of community panels. Each panel = header (name + role badge), meta line (rev/member count/short id), a flat Channels list, a Files row, a Members list, invite/leave actions. Create-community and join-by-link forms sit at the top.",
      "Channel row: a single Pressable per channel showing '#name', a post-permission subtitle ('owner/admin can post' or 'all members post'), and a right-aligned unread pill. Tapping routes to /channel/[communityId]/[channelId].",
      "Channel chat screen (channel/[communityId]/[channelId].tsx): a single flat IM-style transcript. Header (back, '#channel' + community name, Files icon, Refresh icon, Host-history toggle) > ScrollView of MessageBubble rows > KeyboardAvoidingView composer (attach paperclip, multiline TextInput, send/check button).",
      "MessageBubble: left-aligned bubble with body text, attachment list, and a footer line 'AuthorName · HH:MM · Recorded event|Edited event'. Author's own messages get inline Edit (pencil) + Delete (trash) icons. No avatars, no reply affordance, no reaction affordance, no grouping.",
      "Composer model: single draft string + draftAttachments array. Send creates one signed ChannelMessageEvent. Edit mode swaps the same composer into an edit-banner state targeting one prior event; there is no separate reply target.",
      "Unread badges: per-channel integer pill on the Communities list (listCommunityChannelUnreadCounts) and a per-channel unreadCount from the channel hook. Computed by counting visible events with HLC greater than the cm_read_state last-read HLC for that channel. markChannelRead fires on channel open / reload (reads the whole channel as read).",
      "Optimistic local messages: chat-state reducer tracks pending (status 'sending') and failed messages by clientId, rendered as distinct local/failed bubbles appended after recorded events.",
      "Host-history import panel: collapsible panel in the channel header to paste a signed encrypted history manifest and backfill scrollback (manual only).",
      "Incoming file-request panel: in-channel panel listing members' pending file requests with Approve/Decline."
    ],
    "capabilities": [
      "Create a signed community (owner), share 48h expiring signed invite links, join from a pasted link, leave a community.",
      "Per-community channel list with role-gated posting (owner/admin-only channels like 'announcements' enforced at apply by the engine).",
      "Live channel chat: compose + send a signed cm_messages event, edit own message (supersedes, keeps slot), delete own message (tombstone + local key shred). All append-only, HLC-ordered.",
      "Attachments: pick one or more files, size-capped per channel blob policy, stored via ExpoBlobStore, referenced by cm_message_attachments, rendered as AttachmentCard / local chip.",
      "Per-channel unread counts and badges driven by cm_read_state HLC watermark; auto mark-read on open.",
      "Optimistic send with sending/failed states and tap-to-clear error panel.",
      "Manual host-history backfill via pasted manifest (verify-then-import, gated on having the community group key).",
      "Best-effort offline mailbox delivery: messages queue to a paired device's relay mailbox; foreground drain on channel open applies inbound events, file grants, and requests.",
      "In-channel file request/grant flow (request a file again, owner approves to re-send local copy over the relay)."
    ],
    "relevantFiles": [
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/(tabs)/communities.tsx",
        "role": "Communities tab: community panels, flat channel list with unread pills, members, invite/join/leave, Files row. Entry point that routes into channel chat."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx",
        "role": "Channel chat screen: flat IM transcript, MessageBubble (body + footer + edit/delete), composer with attachments, host-history panel, file-request panel. Primary surface to extend for a post feed / threads."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/providers/ChatProvider.tsx",
        "role": "Chat context + useChannel hook: sendMessage/editMessage/deleteMessage/importHistory/markRead, optimistic pending/failed, message list assembly. The state layer any feed/thread UI must extend."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/chat-state.ts",
        "role": "Reducer for optimistic local messages (compose/reconcile/fail/refresh). Tracks pending+failed by clientId; revision triggers reload."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/community-core.ts",
        "role": "cm_ schema + helpers: listChannelMessages, listCommunityChannelUnreadCounts, countUnreadChannelMessages, markChannelRead, highestHlc, listChannelMessageThreadIds (edit-chain only), insert/merge events. Data layer where reply/parent fields and bump-ordering queries would be added."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/channel-message.ts",
        "role": "ChannelMessageEvent contract + compareChannelMessages (HLC order) + resolveChannelMessages (edit/delete collapse, original-slot ordering). 'supersedes' is the only parent-link primitive today; no reply/parent field exists."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/(tabs)/_layout.tsx",
        "role": "Tab + stack registration for communities, channel/[communityId]/[channelId], files/[communityId]. Where a new post-detail or thread route would be registered."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/components/AttachmentCard.tsx",
        "role": "Attachment renderer used inside message bubbles; reused as-is in any post/comment renderer."
      }
    ],
    "gapsVsVision": [
      "No post-feed concept: the channel is a single flat chronological IM transcript, not a list of top-level posts. There is no notion of a 'post' distinct from a 'message', no post detail screen, and no post composer separate from the inline message composer.",
      "No top-level comments: a message cannot carry comments. The only parent-link in the data model is 'supersedes' (edit/delete chain), which keeps the original slot and is explicitly not a reply edge.",
      "No nested replies / threading UI: listChannelMessageThreadIds walks only the edit/supersedes chain, not a reply tree. There is no parentId/rootId reply field on ChannelMessageEvent, no thread view, no collapse/expand, no reply-count or 'view thread' affordance.",
      "No bump-on-activity ordering: ordering is fixed by each message's original-send HLC (compareChannelMessages + resolveChannelMessages keep the original slot even on edit). A new comment/reply could not float its parent to the top; there is no last-activity timestamp per post/thread.",
      "No attention/priority surface: unread is a single per-channel integer watermark (cm_read_state HLC) with a pill badge. There is no per-post unread, no @mention/notification model, no 'priority'/'important'/'unread to me' inbox, no cross-community attention feed, no read receipts of others.",
      "No author identity affordance beyond a text label (resolvePeerName -> 'You'/displayName/short hex). No avatars, no per-author grouping, no presence - a Workplace-style feed would need richer author chrome.",
      "No reactions, no pinning, no post-level permissions beyond the channel-wide postRoles gate.",
      "Communities list is a flat channel list with no sectioning, no 'unread first' or activity-sorted ordering of channels/communities."
    ],
    "extensionPoints": [
      "ChannelMessageEvent (packages/sync/src/protocol/channel-message.ts): add an optional reply/parent edge (e.g. replyTo: {id} distinct from supersedes) here first, since it is the signed contract; resolveChannelMessages and compareChannelMessages are where post/thread grouping + bump-on-activity ordering would be implemented.",
      "community-core.ts: add new queries (e.g. listTopLevelPosts, listReplies(parentId), last-activity per root, per-post unread) and a migration adding a parent/root column + index alongside the existing supersedes columns; listChannelMessageThreadIds already shows the pattern for walking event chains.",
      "ChatProvider.tsx / useChannel: extend the context with reply-aware send (sendMessage gains a parent target), a thread/post selector, and per-post read state; the optimistic reducer in chat-state.ts can be reused for reply composing.",
      "channel/[communityId]/[channelId].tsx: the flat ScrollView of MessageBubble is the swap point - a Workplace feed would render top-level PostCards here and route to a new post-detail/thread screen; the existing composer + attachment + edit/delete logic is reusable inside both a post composer and a comment composer.",
      "MessageBubble component: extend into PostCard (top-level, with reply-count + 'view thread' + reaction row) and CommentRow (nested) variants; author chrome (resolvePeerName) is the hook for adding avatars/mentions.",
      "_layout.tsx: register a new stacked route (e.g. channel/[communityId]/[channelId]/post/[postId]) for a post-detail/thread screen, mirroring how channel and files routes are registered.",
      "Unread/attention: cm_read_state + listCommunityChannelUnreadCounts is where a per-post or per-thread watermark and an attention/priority aggregate (cross-channel 'needs attention' surface) would be added; the unread-pill rendering in communities.tsx is the existing badge slot to generalize."
    ]
  },
  {
    "area": "sync + transport",
    "currentPrimitives": [
      "DeviceIdentity (Ed25519 signing key as deviceId + X25519 dhPublicKey + displayName) generated by generateDeviceIdentity; secrets in expo-secure-store, PRNG from expo-crypto (MK-001 boot order in meerkat-db.ts)",
      "Signed channel message events (cm_messages): createChannelMessage/verifyChannelMessage, Ed25519-signed canonical form, content-hash id, HLC (wall+counter) ordering, supersedes{id,deleted} for edit/delete tombstones; resolveChannelMessages collapses to visible list",
      "Two replication paths for cm_messages, both fed from the SAME signed event: (1) ENGINE SESSION via engine.recordChange(CM_MESSAGES_TABLE,...) -> ChangeTracker -> SYNC_DATA batches (signBatch/verifyBatch) over a live connection (relay or LAN); (2) OFFLINE MAILBOX via queueChannelMessageMailbox -> sealChannelMessageMailboxDelta -> park sealed envelope on a pair-private relay token (deriveMailboxToken from pairing secret + recipient deviceId)",
      "NativeSyncEngine.recordChange / syncWithConnection (initiator) / handleIncomingConnection (responder); runInitiatorSession/runResponderSession carry per-module signed SYNC_DATA batches with modulePolicies enforcement",
      "runSyncSessionJob: the single headless+manual relay session runner (both manual Sync screen and background opportunistic listen go through it, so paths cannot drift)",
      "runMailboxDrainJob: RECEIVE side. Joins each eligible peer's pair-private mailbox token + extraTokens, collects relay-buffered ciphertext, routes every envelope through ONE dispatcher (applyMailboxEnvelope) -> channel-message / file-request / file-grant / history-request/grant / join-request/grant handlers. Fail-closed: bad sig/wrong recipient/undecryptable/unknown-kind dropped + counted rejected, nothing written",
      "Mailbox envelope crypto: deriveMailboxToken (HKDF), sealMailboxDelta/openMailboxDelta (X25519 + secretbox), encodeMailboxEnvelope/decodeMailboxEnvelope. Relay sees only a 64-hex token + ciphertext sizes",
      "createSyncTables -> sync_* tables (sessions, paired_devices, audit, workspaces, workspace_members, workspace_keys, inbound_audit, tombstones, conflicts, ...). Pairing: createSignedPairingPayload/parseSignedPairingPayload (MK-015 self-signed bundle) -> completePairing -> insertPairedDevice with sharedSecretRef",
      "Module sync policy map (MEERKAT_SYNC_POLICIES) + prefix map (MEERKAT_SYNC_PREFIXES): only mp_pad, cm_ tables, and sync_workspace_keys replicate; mk_ tables are device-local by omission",
      "Group/epoch keys (community feed): createGroupCommit mints epoch key, key wraps replicate as shared_workspace (each sealed to one member's DH key); getCurrentEpochKey/unwrapEpochSecret; commitMemberAdd/commitMemberRemoval rotate",
      "Community feed liveness: content-FREE notify ping (deriveCommunityNotifyToken from descriptor genesisNonce, buildCommunityNotifyPing/drainCommunityNotifyPings) - wakes a pull, carries NO bytes; shouldEmitMessageNotification gates a user notification on real applied>0",
      "Rolling snapshots + warm cursor (cm_snapshots/cm_feed_cursor, LOCAL-ONLY): buildCommunitySnapshots, importChannelSnapshot, refreshCommunityFeed (community-node pull P2 or P3 peer backfill, honest source label)",
      "Priority-window split (splitSnapshotForWindow, MK-028): cold-start sends most-recently-updated rows first, backfill remainder in same session",
      "Inbound policy (evaluateInboundChange, MK-002): fail-closed authorization per change - peer_revoked / not_authorized / module_mismatch / scope checks / SAS gate / tombstone resurrection, audited to sync_inbound_audit",
      "Session hardening (MK-044): encryption REQUIRED by default, mandatory per-batch signatures, ack intersection, every frame inside a pairwise frame-envelope (sealFrame/openFrame) so relay sees only sizes+timing"
    ],
    "capabilities": [
      "Send a signed, immutable, edit/delete-capable text+attachment message to a channel and have it replicate to other community members two ways: live (engine session over relay or LAN) and store-and-forward (sealed offline mailbox the relay buffers until the recipient drains)",
      "End-to-end content confidentiality + authenticity: every message is Ed25519-signed by the author device and re-verified before DB write; engine-session payloads and mailbox deltas are encrypted (X25519+secretbox / frame-envelope); the relay is zero-knowledge (sees only opaque tokens + ciphertext sizes, no device ids, message types, or timestamps)",
      "Offline delivery that works with NO peer online: a paired sender parks a sealed delta on the recipient's pair-private mailbox token; the recipient drains it on next wake (foreground button or best-effort background run via runBackgroundSyncOnce/runMailboxDrainJob)",
      "Per-community group encryption with epoch keys + membership rotation (add/remove a member rotates the epoch; key wraps replicate sealed-per-member)",
      "Content-free liveness signal: a notify ping tells a subscriber 'community X moved at time T' without leaking any content, enqueuing a pull; a real message notification only fires after applied>0",
      "HLC total ordering + edit/delete tombstones + OR-set/LWW conflict strategies per cm_ table; unread counts (cm_read_state, personal_replica scope that never crosses a shared community session)",
      "Backfill/catch-up: history-request/grant mailbox handoff, rolling channel snapshots, community-node pull, and priority-window cold start",
      "Scope-enforced replication: per-entity defaultScope/maxScope caps + fail-closed inbound policy prevent any peer (even paired+encrypted) from writing outside a table's declared scope, smuggling a foreign module, resurrecting a tombstone, or pushing a sensitive module without SAS verification"
    ],
    "relevantFiles": [
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/sync-core.ts",
        "role": "App sync wiring: synced-prefix map + module policy map (which tables replicate), pad bellwether, rendezvous token derivation, signed pairing payload parse/build, ensureSyncSchema"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/community-core.ts",
        "role": "cm_ schema + COMMUNITY_SYNC_POLICY (cm_messages/attachments/reactions shared_workspace, cm_read_state personal_replica); merge/insert/verify helpers; snapshot+cursor+notify+refresh feed core. The exact place a new chat primitive's table + scope rule is declared"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/background-sync.ts",
        "role": "runBackgroundSyncCore (pure) + runBackgroundSyncOnce (expo wiring): drains mailboxes + optional opportunistic listen; resolveDrainPeers; builds per-kind handlers + community extraTokens. The receive-side dispatcher assembly point"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/providers/SyncProvider.tsx",
        "role": "queueChannelMessageMailbox (seal+park offline), recordLocalChange (engine.recordChange), runRelaySession/runLanSession/startLanListening (live transport), parkEnvelopeOnRelay, queueFileRequest/Grant. The app-side SEND surface a new primitive must extend"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/providers/ChatProvider.tsx",
        "role": "sendMessage/editMessage/deleteMessage: builds the signed event, recordMessageEvent (-> engine recordChange for live path), queueChannelMessageMailbox (-> offline path). The dual-write pattern any new event type must follow"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/channel-message.ts",
        "role": "ChannelMessageEvent contract: canonical form, signing, content-hash id, HLC, supersedes, resolveChannelMessages. The event-schema template for sub-thread addressing / new event kinds"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/mailbox-drain.ts",
        "role": "runMailboxDrainJob + the ONE dispatcher fold; MailboxDrainPeer/extraTokens. Where a new mailbox kind plugs in via MailboxEnvelopeHandlers"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/mailbox-dispatch.ts",
        "role": "applyMailboxEnvelope + MailboxEnvelopeHandlers union (channelMessage/file/history/join). The single extension point for new offline-deliverable event kinds (referenced via index.ts)"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/inbound-policy.ts",
        "role": "evaluateInboundChange (MK-002): fail-closed per-change authorization + scope/SAS/tombstone gates that any new replicated table is subject to"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/engine/session-job.ts",
        "role": "runSyncSessionJob: the single live-session runner shared by manual + background relay paths"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/engine/sync-engine.native.ts",
        "role": "NativeSyncEngine: recordChange/syncWithConnection/handleIncomingConnection, modulePolicies. The live-replication engine"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/types.ts",
        "role": "Scope model (SyncScope, SYNC_SCOPE_RANK, isScopeWithinMaxScope), DeviceIdentity, SyncEntityAcl, SyncEncryptionMode, SyncSecurityPreference, FeedPollIntervalMs, HistoryScope"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/community-notify.ts",
        "role": "Content-free notify ping + admin poll cadence: the only existing 'something changed' liveness signal (closest substrate to presence/bump signals)"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/sync-window.ts",
        "role": "splitSnapshotForWindow: priority-batch primitive (closest existing analog to prioritization/bumped-feed ordering at the wire level)"
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/index.ts",
        "role": "@mylife/sync barrel: the single import surface; any new primitive must be exported here, not parallel-wired"
      }
    ],
    "gapsVsVision": [
      "No presence/status/typing substrate at all: there is NO ephemeral, non-persisted signal type. Everything that crosses the wire is a durable signed event written to a table or a mailbox delta. The only liveness primitive is the content-free community-notify ping (one-shot 'feed moved at T'), which has no per-member online/typing/last-seen semantics and no TTL/expiry beyond relay buffering. Presence would need a new ephemeral, non-replicated, fail-open signal class the inbound policy currently has no category for",
      "No sub-thread / reply addressing: ChannelMessageEvent only has supersedes{id,deleted} (edit/delete of the SAME logical message). There is no parentId/rootId/threadId field, no thread index, and listChannelMessageThreadIds reuses the supersedes chain (edit history), NOT replies. Sub-thread addressing requires a new event field + a thread index table + ordering/unread rollups per thread",
      "No agent/bot identity class: DeviceIdentity is a single Ed25519 device key with a displayName; there is NO deviceType/isBot/principal-kind, no notion of a non-human participant, no capability/permission scoping per identity, and no way to distinguish an agent's authored events from a human's. SyncSecuritySubjectType is default/workspace/direct only. 'Agents as participants' needs an identity-kind tag in the signed identity bundle + community member record, an authorization model for agent capabilities, and likely a separate key custody story (an agent key not in the device keychain)",
      "No prioritization / bumped-feed signal in the data model: messages are totally ordered by HLC only (wall,counter,author,id). There is no priority/importance/pin/bump field on cm_messages, no per-message or per-thread ranking signal, and no way for a sender to mark urgency. splitSnapshotForWindow ranks by updated_at recency for cold-start only, not user-facing feed ordering. Bumped feeds need a mutable ordering/priority signal that itself replicates (and a conflict strategy for it)",
      "Delivery is store-and-forward + manual/opportunistic, not real-time push: there is NO always-on connection, NO automatic peer auto-dial, and NO deployed relay (DEFAULT_RELAY_URL is ''). Background drain is best-effort/on-demand (dev-flag gated). Anything needing low-latency presence or live cursors lacks the persistent transport to carry it",
      "Read/unread is local-only and coarse: cm_read_state is personal_replica and never crosses a community session, so there are NO delivery/read RECEIPTS visible to other members (by design: copy must not claim a remote member received/read a message). Presence-grade 'seen by' would need a new receipt-sharing model that does not currently exist",
      "No per-message TTL/ephemerality wired into chat: SyncExpiringEntity / disappearing-messages primitives exist in the package but cm_messages are durable; an ephemeral presence/status event has no home table or expiry path in the app",
      "Scope model has only 4 fixed tiers (device_local/personal_replica/shared_workspace/published_blob): a presence signal that should be shared-but-ephemeral, or an agent-scoped capability, does not map cleanly onto these caps and the fail-closed inbound policy"
    ],
    "extensionPoints": [
      "NEW OFFLINE EVENT KIND -> add a MailboxEnvelopeHandlers entry: seal with a new *MailboxKind constant + sealXMailbox/openXMailbox helpers in packages/sync/src/protocol/, register the handler in applyMailboxEnvelope's union, and wire it in BOTH background-sync.ts buildHandlers AND SyncProvider (foreground), so foreground+background cannot drift. This is how file-request/grant, history-backfill, and join-handoff were all added (the canonical pattern for any new addressable delivery)",
      "NEW REPLICATED TABLE -> declare it in community-core.ts COMMUNITY_SYNC_POLICY.entityRules (tableName + defaultScope + maxScope + conflictStrategy) and ensure its prefix maps in MEERKAT_SYNC_PREFIXES (sync-core.ts). The engine + inbound policy pick it up automatically; omit it from the policy to keep it LOCAL-ONLY. Sub-thread/thread-index/priority tables go here",
      "NEW SIGNED EVENT TYPE -> follow channel-message.ts: a canonical-form + Ed25519 sign/verify + content-hash id module, then dual-write via ChatProvider's recordMessageEvent (engine.recordChange for live) + a queue*Mailbox for offline. Reply/sub-thread events and bump/priority events should be modeled this way so they inherit the verify-then-apply guarantee",
      "NEW LIVENESS/PRESENCE SIGNAL -> extend community-notify.ts (deriveCommunityNotifyToken pattern: descriptor-derived token, content-free or minimal sealed payload, drainCommunityNotifyPings). This is the only existing ephemeral-ish channel; a presence ping would be a sibling primitive (new token info-string + payload + a drain handler) rather than a replicated table",
      "AGENT IDENTITY -> extend the signed identity bundle (protocol/identity-bundle.ts createSignedIdentityBundle / SignedIdentityBundle) and the community member record (CommunityMember in protocol/community.ts) with an identity-kind/capability field, plus add a SyncSecuritySubjectType or member-role variant for agents. evaluateInboundChange (inbound-policy.ts) is the single chokepoint to enforce agent-specific authorization. Keep agent keys behind the same configureSyncSecretStore abstraction (a separate ref) rather than the device keychain",
      "PRIORITIZATION SIGNAL -> a new replicated cm_ table (e.g. cm_message_priority / cm_pin) with an LWW conflict strategy, declared in COMMUNITY_SYNC_POLICY, surfaced through the existing resolveChannelMessages ordering layer; for cold-start ordering, splitSnapshotForWindow already accepts a recency rank that could be generalized",
      "TRANSPORT REUSE -> runSyncSessionJob (live) and runMailboxDrainJob (offline) are the two delivery runners; route any new real-time-ish or store-and-forward need through these, not a parallel socket. Relay backend is WebSocketRelayBackend; LAN is connectLanPeer/startLanListener. All are injected so new flows stay testable",
      "BARREL DISCIPLINE -> every new primitive must be exported from packages/sync/src/index.ts and consumed via @mylife/sync; the app owns no crypto and must not reimplement seal/sign/drain. The web twin (apps/meerkat-web/src/lib/meerkat-data.ts) must be kept in lockstep with community-core.ts for any feed/snapshot/refresh change"
    ]
  },
  {
    "area": "identity + membership + agents",
    "currentPrimitives": [
      "DeviceIdentity = Ed25519 signing keypair (publicKey is the canonical device id) + X25519 DH keypair; minted on first launch by generateDeviceIdentity, private keys stored in expo-secure-store, only public fields in mk_identity. This IS the participant.",
      "Fingerprint ('safety code') = first 8 hex chars of SHA-512(publicKey) via getPublicKeyFingerprint; UX-only out-of-band verification, not security-binding.",
      "Friend code (MEER-XXXX-... checksummed, or vanity word + Crockford suffix) = a rendezvous handle only. Carries NO key material. Stored in mk_settings (friend_code, rendezvous_id, friend_code_is_custom).",
      "Friend-code rendezvous (MK-016): publishIdentityToRendezvous puts a base64(JSON(signed identity bundle)) under the code's rendezvous id on a relay; resolveIdentityFromRendezvous fetches + verifies the self-signature. Trust = Ed25519 self-signature + TOFU pinning (getPinnedIdentity/pinIdentity).",
      "Signed identity bundle (MK-015) = createSignedIdentityBundle / verifySignedIdentityBundle; the portable, self-signed identity that travels in friend codes and pairing payloads.",
      "Pairing (1:1): SignedPairingPayload v2 wraps a signed identity bundle; parseSignedPairingPayload verifies before completePairing inserts a PairedDevice. A MITM DH-key swap fails signature verification.",
      "CommunityDescriptor = signed, portable document (no server, no public directory). communityId derived from genesis content (unforgeable). members[] = CommunityMember {deviceId, role, displayName?, dhPublicKey?}. roles = WorkspaceMemberRole 'owner'|'admin'|'member'|'viewer'. joinPolicy always 'invite_only'.",
      "Membership change = owner reviseCommunity() re-signs a new revision adding the member's deviceId+dhPublicKey; createGroupCommit then mints/wraps the epoch key for each member's DH key. Local rows land in sync_workspace_members + sync_communities.",
      "Invite/join = createCommunityInvite (owner/admin only, expiring, signed, self-contained meerkat://community/join# link carrying the full descriptor) -> joinCommunityFromLink verifies + bridges into a 'community' workspace.",
      "Channel posting = createChannelMessage(author: DeviceIdentity, input) Ed25519-signs cm_messages; authorDeviceId IS author.publicKey. Posting rights enforced at apply time on every receiving device via evaluateChannelPost (unknown_channel / not_community_member / channel_role_denied)."
    ],
    "capabilities": [
      "Self-sovereign identity: every device mints its own keypair offline; no account, no server, no central registry. Identity is the key.",
      "Out-of-band identity verification via the human-comparable 8-hex safety code (fingerprint).",
      "Discoverability via friend codes (random or vanity) resolved through a relay rendezvous, with self-signed bundle verification + TOFU pinning. No key material on the wire.",
      "1:1 pairing with MITM-resistant signed pairing payloads.",
      "Invite-only communities with signed, expiring, self-contained invite links that work offline once delivered.",
      "Role-based posting (owner/admin/member/viewer) enforced cryptographically at apply time on every device, not in UI and not on a server.",
      "Every channel message is individually Ed25519-signed by its author device and content-addressed; verifyChannelMessage rejects forgeries; messages are addressable/orderable by (hlc, authorDeviceId, id).",
      "Background mailbox drain (runBackgroundSyncOnce -> runMailboxDrainJob) already runs headless: fail-closed, opens only envelopes that verify against this device's key. This is the one existing autonomous/headless execution slice."
    ],
    "relevantFiles": [
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/(tabs)/identity.tsx",
        "role": "Identity UI: shows name, friend code (copy / new random / vanity), safety code (fingerprint), public key. No membership or agent concept."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/providers/IdentityProvider.tsx",
        "role": "Owns the on-device identity lifecycle: mints DeviceIdentity on first launch, persists/regenerates friend codes + vanity codes + rendezvous id. The single source for 'who am I'."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/identity/device-identity.ts",
        "role": "generateDeviceIdentity, signMessage/verifySignature, getPublicKeyFingerprint. Defines that a participant = an Ed25519 keypair. Identity-agnostic (no human/non-human flag)."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/node/friend-rendezvous.ts",
        "role": "publishIdentityToRendezvous / resolveIdentityFromRendezvous: friend-code-keyed identity discovery over a relay; self-signed bundle + TOFU."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/sync-core.ts",
        "role": "Pairing payload build/parse (buildSignedPairingPayload, parseSignedPairingPayload, pairingDataFromBundle) and rendezvous-token derivation. DEFAULT_RELAY_URL='' (no deployed relay = no autonomous reachability today)."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/community.ts",
        "role": "CommunityDescriptor + CommunityMember + roles, createCommunity/reviseCommunity/forkCommunity, invite create/parse/verify, joinCommunityFromLink, evaluateChannelPost. The membership + admission + posting-authority control plane."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/community-core.ts",
        "role": "Local community/channel schema (cm_messages etc.), storeOwnedCommunity (founder mints epoch + wraps keys per member DH key), feed refresh. Membership persistence + key distribution attach point."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/channel-message.ts",
        "role": "createChannelMessage(author: DeviceIdentity, input) + verifyChannelMessage. The posting entry point: it accepts ANY identity and signs with its key, so a non-human author is mechanically already possible."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/packages/sync/src/types.ts",
        "role": "WorkspaceMemberRole = owner|admin|member|viewer (+ Zod schema); DeviceIdentity interface. The enums to extend for an agent role / member kind."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/background-sync.ts",
        "role": "runBackgroundSyncCore / runBackgroundSyncOnce -> mailbox drain. The only existing headless execution path; closest analog to an agent runtime loop."
      },
      {
        "path": "/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/background-task-registration.ts",
        "role": "Deferred OS scheduler + push wake (lazy native, default off). Where a scheduled/always-on agent process would hook for autonomous wake."
      }
    ],
    "gapsVsVision": [
      "No non-human participant concept exists anywhere: zero references to agent/bot/automation/webhook/MCP in the meerkat app or @mylife/sync (only an incidental 'DMCA agent' legal string). Participants are undistinguished keypairs.",
      "No way to label or discover that a member is an agent/service: CommunityMember has no kind/type/capabilities field; WorkspaceMemberRole has no agent/service role; roster UI and policy treat all members identically.",
      "No headless agent runtime: identity is minted and driven only inside the React Native foreground (IdentityProvider useEffect). The only headless slice is the best-effort mailbox drain; there is no long-lived process that an agent could run as.",
      "No addressing primitive: messages have no recipient/mention/@-target field on the wire. ChannelMessageEvent has communityId/channelId/authorDeviceId/body but no 'to' or mention list, so an agent cannot be explicitly addressed and cannot scope a reply turn.",
      "No autonomous reachability: DEFAULT_RELAY_URL is '' (no deployed relay), auto-dial/auto-connect is explicitly NOT built, and a phone has no inbound web seed. An always-on agent has no transport to be reached on.",
      "No machine-grant / capability model: invites are owner/admin-minted for humans pasting links; there is no programmatic enrollment, scoped capability token, or revocable agent credential.",
      "No command/intent surface: communities are free-text chat only; there is no structured request/response or tool-call envelope an agent could parse or answer deterministically.",
      "No agent identity provenance: a self-signed bundle proves key control but nothing attests 'this key is an authorized agent operated by X', so trust in a non-human participant is purely TOFU like any peer."
    ],
    "extensionPoints": [
      "WorkspaceMemberRole (packages/sync/src/types.ts:26 + Zod at :703): add an 'agent'/'service' role so descriptors and evaluateChannelPost can grant/deny agent posting distinctly.",
      "CommunityMember (packages/sync/src/protocol/community.ts): add optional kind:'human'|'agent' and capabilities/operatedBy fields; canonicalDescriptor already enumerates member fields, so extend the signed tuple. Makes agents first-class in the signed roster.",
      "createChannelMessage(author: DeviceIdentity, input) (channel-message.ts:91): already identity-agnostic. Add an optional addressing field (mentions[]/replyTo deviceId) to ChannelMessageEvent + canonical form so an agent can be explicitly addressed and can scope responses; verifyChannelMessage/evaluateChannelPost extend cleanly.",
      "Invite path (createCommunityInvite/joinCommunityFromLink): add a programmatic enroll-agent flow (owner signs an agent member directly into the descriptor via reviseCommunity, skipping link paste), reusing storeOwnedCommunity's epoch-wrap-per-DH-key so the agent receives the group key.",
      "runBackgroundSyncOnce / runBackgroundSyncCore (data/background-sync.ts) + runMailboxDrainJob: the existing fail-closed headless drain is the natural hook for an agent loop. Extend with an 'on applied message -> agent handler -> createChannelMessage reply' step to give an agent a turn.",
      "background-task-registration.ts (deferred OS scheduler + push wake): where an always-on / scheduled agent process attaches for autonomous wake once a relay exists.",
      "DEFAULT_RELAY_URL (sync-core.ts:103) + connectRelayPeer/auto-dial: filling these is the prerequisite transport for an autonomous agent to be reachable without a human tapping Sync.",
      "IdentityProvider / generateDeviceIdentity: an agent provisions exactly like a device (its own keypair); a thin headless identity factory (no RN UI) would let an agent hold a DeviceIdentity outside the foreground app.",
      "Net-new surface needed for the vision: a structured command/tool-call message envelope (over the existing signed cm_messages) and an MCP/webhook bridge - neither exists today and both would be greenfield."
    ]
  }
]
```


## External research dossiers

```json
[
  {
    "topic": "Structural and product limitations of Slack across six areas: reading/prioritizing/status vs sending, thread decay with no recency bump, no inline reply to a single message in a thread, channels as the only org primitive, multi-workspace / Slack Connect lock-in, and bolted-on AI agents/bots",
    "keyTakeaways": [
      "Slack is architecturally optimized for SENDING in real time, not for reading, prioritizing, or getting status. The feed is a bottomless reverse-chronological stream where every message carries equal weight, with no native ranking, no signal-vs-noise model, and no status/knowledge layer. The 'Catch Up' and Activity views are triage band-aids, not prioritization: users swipe through unreads one at a time and the only honest escape is to mark everything read and move on.",
      "Threads decay into history by design. Slack's most consequential threading decision was to HIDE thread replies from the channel ('the single most meaningful change we made'), so a new reply does NOT bump the thread back to the bottom of the channel. A decision discussed last week is unfindable after 50 new messages because of channel recency bias, and answered questions are indistinguishable from open ones in scrollback.",
      "There is no inline reply to a single message inside a thread. Slack deliberately capped threads at ONE level of replies after finding that replying-to-a-reply 'quickly became extremely complex.' A thread is a flat, append-only list, so you cannot branch, quote-reply, or address one specific message inline. The only escapes are crude: a 'broadcast' that re-floods the channel, or starting a wholly separate thread that loses the link to context.",
      "Channels are the only first-class organizing primitive. Slack has a FLAT channel namespace: no folders, no sub-channels, no true hierarchy. The only org tools are naming-convention prefixes (#nyc-eng-frontend) and per-user sidebar 'Sections' that are private to each member and invisible to teammates, so there is no shared, navigable structure of the workspace.",
      "Multi-workspace and Slack Connect are lock-in machines, not federation. Slack Connect requires ONE channel per external org (orgs report 1,000+), every participating org must be on a PAID plan, channel ownership is asymmetric (the inviter controls apps/settings), each side runs its own retention/governance independently, and there is no native federation across Slack instances or to Teams. Enterprise Grid is a one-way door (no downgrades), and 90-day free-tier history holds institutional memory hostage to the pricing desk.",
      "AI agents and bots are second-class citizens bolted onto a chat surface, not native participants. As of 2025-2026 Slack throttled conversations.history/conversations.replies for non-Marketplace apps to 1 request/minute and 15 messages/request (a Tier 3 -> Tier 1 cut), explicitly to stop customers from feeding their own Slack data to outside LLMs and to funnel them into first-party Agentforce/Slackbot. Agentforce agents stay tied to Salesforce as the system of record and are not a workspace-wide intelligence layer; classic apps are killed March 31, 2026."
    ],
    "relevantPrimitives": [
      "Reverse-chronological channel feed (the bottomless stream) as the only read surface",
      "Threads: flat, single-level, append-only, hidden-from-channel by default",
      "'Broadcast' / 'Also send to channel' as the only way a reply reaches the channel (re-floods it)",
      "Catch Up (mobile swipe) and Unreads (desktop) as triage UIs",
      "Activity view with category filters (Mentions, DMs, Threads, Reactions, VIPs) as the closest thing to prioritization",
      "Search modes: 'Recent' (reverse-chron) vs 'Relevant' (ranked) as separate read paths",
      "Channels (public/private) as the sole org primitive; naming-convention prefixes as pseudo-hierarchy",
      "Per-user sidebar Sections (private to each member, not shared)",
      "Slack Connect shared channels (one per external org) and multi-workspace channels in Enterprise Grid",
      "Bot/App platform: scopes, conversations.history/replies methods, rate-limit tiers, Marketplace gatekeeping",
      "Slackbot / Agentforce as first-party AI agents tied to Salesforce",
      "Enterprise Grid as the multi-workspace governance container (one-way door)",
      "90-day message-history cap on free tier; data export gated to higher tiers"
    ],
    "whatToBorrow": [
      "The Activity/VIP idea: let users designate high-priority people and surface their messages distinctly. Meerkat can do this honestly per-channel and per-agent without a server seeing the affinity graph.",
      "'Broadcast' as an explicit, opt-in choice (post a reply back to the channel) is a reasonable affordance; keep the user-controlled visibility toggle but fix the underlying flatness.",
      "Naming-convention prefixes and per-user sidebar sections show real demand for organization beyond a flat list. Demand exists; Slack just under-delivered. Ship real nested/labeled structure instead.",
      "Separating 'Recent' (chronological) from 'Relevant' (ranked) search acknowledges that recency and importance are different axes. Meerkat should treat them as two first-class read modes from day one.",
      "Threads-as-a-noise-reducer was the right instinct (channel noise is real). Borrow the goal (reduce channel noise) but not the mechanism (hiding + decaying threads with no recency bump)."
    ],
    "whatToAvoid": [
      "Do NOT hide thread activity from the channel with no recency bump. A reply to an active thread should be able to resurface that thread so live conversation does not silently decay into history.",
      "Do NOT cap threads at one flat level with no way to reply to a specific message. Support inline quote-reply / branching so a single message can be addressed without re-flooding the parent (the 'broadcast' hack) or forking context into a disconnected thread.",
      "Do NOT make channels the only organizing primitive. Avoid a flat namespace whose only structure is naming prefixes and private per-user sections that teammates cannot see.",
      "Do NOT treat every message with equal weight in a bottomless feed with no ranking, no status layer, and no way to mark a question answered. Avoid the 'never caught up' psychological trap.",
      "Do NOT build lock-in: per-partner channel proliferation, paid-plan-on-both-sides gates, asymmetric channel ownership, one-way Enterprise tiers, history held hostage behind retention/pricing, and no federation. This is the anti-pattern Meerkat's open-standard, mesh/relay design exists to refute.",
      "Do NOT bolt agents on as throttled, gatekept second-class API clients (1 req/min, Marketplace approval, data walled off to push first-party AI). Agents must be first-class participants with the same standing as humans.",
      "Do NOT trap institutional memory: avoid a 90-day history cliff and export-gated-to-higher-tiers. Encrypted local-first storage means the user already owns their history."
    ],
    "meerkatImplications": [
      "READING/STATUS: Because Meerkat is local-first with all content already on-device and end-to-end encrypted, ranking, triage, and 'what changed since I was offline' can run CLIENT-SIDE without a server reading content. Build a real prioritization/status layer (per-channel unread + per-sender/per-agent affinity, answered-vs-open markers) that Slack cannot offer without server-side reading. First-class AGENTS can act as the 'status getter' that summarizes and prioritizes for you, since an agent is a peer node, not a throttled API client.",
      "THREAD DECAY: Meerkat's signed cm_messages events sync through the mesh/relay engine; design thread events so a reply can emit an optional recency-bump event that resurfaces the thread in the channel ordering, defaulting to honest local recorded state (never claim remote read/receipt without a real protocol row). This directly fixes Slack's hide-and-decay model.",
      "INLINE REPLY: Model messages as a DAG, not a flat list. Each cm_messages row can carry a reply_to pointing at any specific message (including a reply), enabling true inline quote-reply and branching while staying append-only and signed. This is a schema decision to make now in community-core.ts before the wire format ossifies.",
      "ORG PRIMITIVE: Communities already give Meerkat a layer above channels that Slack lacks. Lean into it: communities > channels with room for nested/labeled structure and SHARED (not per-user-private) organization, synced as scoped entities. Avoid replicating Slack's flat namespace.",
      "MULTI-ORG / FEDERATION: Meerkat's mesh/relay + open-standard friend-code identity is the structural opposite of Slack Connect. No per-partner channel sprawl, no paid-plan-on-both-sides gate, no asymmetric owner, no central org that holds your data. Cross-org collaboration is just two nodes/communities with their own symmetric keys and scope boundaries. Market this as 'federation by default, no lock-in.'",
      "AGENTS FIRST-CLASS: Make agents real participants with device identities, friend codes, and signed messages in cm_messages, subject to the same MK-002 inbound enforcement and pairwise frame envelopes as humans. Because there is no central API to throttle and no Marketplace to approve, Meerkat has NO structural reason to make agents second-class. An agent can read/prioritize/seed/answer on-device with the user's keys, the exact thing Slack's 1-req/min rate limit and data-walling exist to prevent.",
      "DATA OWNERSHIP: Local-first encrypted storage means no 90-day history cliff and no export-gated-to-tier. Institutional memory lives on the user's device by default, structurally removing the lock-in Slack monetizes."
    ],
    "sources": [
      {
        "title": "5 Ways Slack Threads Get Lost (And How to Fix It) - Quickly Blog",
        "url": "https://askquickly.ai/blog/slack-threads-problem"
      },
      {
        "title": "Threads in Slack, a Long Design Journey (Part 2 of 2) - Slack Design",
        "url": "https://slack.design/articles/threads-in-slack-a-long-design-journey-part-2-of-2/"
      },
      {
        "title": "Use threads to organize discussions - Slack Help Center",
        "url": "https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions"
      },
      {
        "title": "Solving Information Overload in Slack Channels - Question Base",
        "url": "https://www.questionbase.com/resources/blog/solving-information-overload-in-slack-channels"
      },
      {
        "title": "Slack Catch Up: Swiping Right for Productivity - Raw.Studio",
        "url": "https://raw.studio/blog/slack-catch-up-swiping-right-for-productivity/"
      },
      {
        "title": "Slack Noise Is Killing Your Productivity - Thread Patrol",
        "url": "https://thread-patrol.com/blog/slack-noise-guide"
      },
      {
        "title": "Search at Slack - Engineering at Slack",
        "url": "https://slack.engineering/search-at-slack/"
      },
      {
        "title": "Is there a way to put Slack channels in a folder? - Quora",
        "url": "https://www.quora.com/Is-there-a-way-to-put-Slack-channels-in-a-folder"
      },
      {
        "title": "Organize your sidebar with custom sections - Slack Help Center",
        "url": "https://slack.com/help/articles/360043207674-Organize-your-sidebar-with-custom-sections"
      },
      {
        "title": "Understanding Slack Connect: Top 53 FAQs Answered - ClearFeed",
        "url": "https://clearfeed.ai/blogs/a-short-guide-to-using-slack-connect-with-customers-and-partners"
      },
      {
        "title": "Manage multi-workspace channels - Slack Help Center",
        "url": "https://slack.com/help/articles/115004485887-Manage-multi-workspace-channels"
      },
      {
        "title": "Slack Pricing in 2026: The Real Cost of the Salesforce Ecosystem - Bridge",
        "url": "https://bridgeapp.ai/resources/blog/slack-pricing-in-2026-the-real-cost-of-the-salesforce-ecosystem"
      },
      {
        "title": "Rate limit changes for non-Marketplace apps - Slack Developer Docs",
        "url": "https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/"
      },
      {
        "title": "About Slack's new rate limits - APIs You Won't Hate",
        "url": "https://apisyouwonthate.com/newsletter/about-slacks-new-rate-limits/"
      },
      {
        "title": "Salesforce's Slackbot Goes GA - The Real Test for Agentforce? - Futurum Group",
        "url": "https://futurumgroup.com/insights/salesforces-slackbot-goes-ga-is-this-the-real-test-for-agentforce/"
      },
      {
        "title": "Agentforce 2.0 in Slack - Slack Blog",
        "url": "https://slack.com/blog/news/limitless-workforce-with-agentforce-in-slack"
      }
    ]
  },
  {
    "topic": "Facebook Workplace (Workplace from Meta): content model, shutdown timeline, the Yammer/Viva Engage lineage, and why \"posts\" beat Slack messages as a context-management primitive",
    "keyTakeaways": [
      "Workplace's primitive was the POST placed in a context (a Group feed, a profile/wall, or the News Feed). A post is a durable, addressable object: it has a stable identity, an author, a body, an attachment set, reactions, and a comment tree hanging off it. Everything else (comments, replies, reactions) is a child of that one anchor object.",
      "Comment structure was a bounded tree: a post has top-level comments; each top-level comment has a single layer of nested replies. Sub-replies collapse into that one reply layer rather than recursing infinitely (the same Facebook model). This deliberate shallow nesting keeps a thread legible: you always know whether you are replying to the post or to a person inside it.",
      "Recency BUMPING is the core feed mechanic: when ANY comment lands on a post, Meta's 'action-bumping logic' re-surfaces that post toward the top of the relevant feed. A months-old post with a fresh question floats back up to the people who care, so a single thread accumulates the whole conversation over time instead of fragmenting into new messages. Bumping turns a post into a living, long-lived discussion anchor.",
      "Reactions (like, love, etc.) were lightweight signals attached to both posts and comments, used for acknowledgement/approval without adding noise to the comment tree, and also fed ranking.",
      "Groups vs profile: Groups were the primary container (public, private/closed, hidden), each with admins/moderators, membership, and its own feed. The profile/wall was the person-scoped surface. The News Feed was the cross-group aggregation ranked by ML. A post's placement (which group) defined its audience and permissions, not a separate ACL bolted on.",
      "Knowledge Library was the explicit answer to 'feeds are bad for reference content.' It sat next to the feed as a curated, hierarchical store (categories and subcategories) of STATIC company content (policies, handbooks, benefits) with a draft/proof/publish workflow and admin permissions, deliberately separating durable reference docs from the time-ordered, bump-driven post feed.",
      "Shutdown: Meta announced the wind-down on 2024-05-14. Phases: usable as normal until 2025-08-31; READ-ONLY mode from 2025-09-01 through 2026-05-31 (no new posts; data still downloadable); full termination and account/data DELETION on 2026-06-01. As of mid-2026, Workplace is in its final read-only stretch days before deletion. Meta's officially recommended commercial successor was Workvivo (Zoom-owned).",
      "Closest LINEAGE successor is Yammer -> Microsoft Viva Engage. Yammer founded 2008 (built inside Geni.com), acquired by Microsoft in 2012 for ~$1.2B, folded into Office 365, and rebranded to Viva Engage in February 2023. The Yammer code is still the engine under Viva Engage. Same primitive: communities containing posts/conversations, the enterprise-social 'outer loop' counterpart to Teams' 'inner loop.' It is a rebrand and evolution, not a rewrite.",
      "Why posts beat Slack messages as a context-management primitive: a post is ONE durable object that owns its entire reply tree and its audience, so a topic stays gathered in a single addressable place that bumps back up on new activity. Slack's primitive is the message in a time-ordered channel stream: context is scattered across the scrollback, threads are second-class and easy to miss, and important knowledge decays into ephemeral chatter that is hard to find later. Posts are async-first and 'outer loop' (findable, persistent, one-topic-per-anchor); chat is sync-first and 'inner loop' (fast, ephemeral, poor long-term findability)."
    ],
    "relevantPrimitives": [
      "Post (the anchor object): stable id, author, body, attachments, placed into exactly one context (group feed / wall / channel). The unit of audience + permissions + conversation.",
      "Context placement: the container a post lives in (Group, profile/wall, News Feed aggregation) defines who sees it; permission is a property of placement, not a separate ACL.",
      "Comment tree: top-level comments under a post, plus a single nested-reply layer per comment (shallow, bounded nesting; sub-replies fold into the one reply level).",
      "Reactions: lightweight typed acknowledgement signals on posts and comments; ranking input and low-noise alternative to a reply.",
      "Action-bumping / recency bump: new comment activity re-surfaces the parent post in the feed, so one thread accrues the whole conversation over time.",
      "Mentions (@): direct addressing inside posts/comments that drives notifications and can trigger workflows/bots.",
      "Groups (public / closed / hidden) with admin + moderator roles, membership, and per-group feeds.",
      "Knowledge Library: hierarchical categories/subcategories of static reference content with draft -> proof -> publish workflow and admin permissions, separate from the post feed.",
      "Bots / custom integrations as first-class participants: they post into groups, comment, react, get @-mentioned to kick off workflows (a 2016-era precedent for agents-as-participants).",
      "Inner-loop vs outer-loop split: chat/Teams = fast ephemeral inner loop; posts/communities = persistent findable outer loop."
    ],
    "whatToBorrow": [
      "Make the POST the primitive, not the message. One durable, addressable object that owns its reply tree and its audience. This is the single biggest reason Workplace/Yammer content stays findable where Slack scrollback rots.",
      "Adopt action-bumping: any new comment re-surfaces the parent post for the people in that context. It keeps a topic gathered in one anchor instead of spawning N new messages, and it revives stale-but-still-relevant threads automatically.",
      "Use shallow, bounded comment nesting (post -> top-level comment -> one reply layer). Infinite recursion destroys legibility; a fixed two-level tree is the proven sweet spot for 'am I replying to the post or to a person.'",
      "Separate durable reference content from the feed (a Knowledge Library equivalent) with its own hierarchy and a draft/proof/publish workflow. Don't ask the bump-driven feed to also be the docs store; the two have opposite half-lives.",
      "Treat placement-as-permission: a post's container defines its audience and access. Cleaner than per-message ACLs and maps directly onto a scope/workspace model.",
      "Make reactions a first-class low-noise acknowledgement channel on both posts and comments, distinct from replies.",
      "Keep the inner-loop / outer-loop distinction explicit in the product: fast ephemeral chat is a different surface from persistent, findable, one-topic posts. Don't collapse them into one undifferentiated stream.",
      "Make agents/bots first-class participants that can author posts, comment, react, and be @-mentioned to start workflows. Workplace shipped this in 2016 with humans-and-bots in the same comment tree."
    ],
    "whatToAvoid": [
      "Don't build the core on a time-ordered message stream as the primitive (the Slack model). It scatters a topic across scrollback, makes threads second-class, and turns durable knowledge into ephemeral chatter that is hard to find later.",
      "Don't centralize ranking/feed in a proprietary ML black box and tie content durability to a single vendor's data centers. Workplace users now face a hard 2026-06-01 deletion and a forced third-party migration precisely because the data and the platform were one company's silo.",
      "Don't conflate the reference store with the feed. Workplace had to bolt on Knowledge Library later because feeds are wrong for static policy docs; design the separation up front.",
      "Don't allow unbounded comment recursion or sync-only ephemeral content for anything meant to be remembered.",
      "Don't depend on server-mediated identity/notifications/migration as the only path. Meta's shutdown shows the cost: customers had no first-party export-to-successor and had to buy third-party migration (e.g., to Viva Engage) because data was locked to the host.",
      "Don't promise 'connected'/'live' status or activity that isn't backed by a real recorded event (relevant to Meerkat's transport-honesty rule; Workplace's feed presence/typing signals are exactly the kind of thing not to fake in a mesh app)."
    ],
    "meerkatImplications": [
      "Meerkat's mp_pad/cm_messages model is already message-event-shaped. A Workplace-style POST primitive maps cleanly onto a community channel: define a signed 'post' event that is a durable, addressable anchor (content id + author key + body + attachment refs), with comment and reaction events as children that reference the post's id. This gives one gathered, replicable thread per topic instead of a flat message log.",
      "Implement action-bumping as a per-channel personal-replica 'last_activity' HLC: when a child event (comment/reaction) for a post arrives and verifies, bump the post's local activity timestamp so it re-surfaces. Crucially, do the bump LOCALLY from verified events, never from a remote 'this is hot' claim, to keep the transport-honesty boundary intact (no faked engagement counts).",
      "Placement-as-permission maps directly onto Meerkat's scope/maxScope and workspace symmetric keys: a post inherits the audience of its channel/workspace. shared_workspace posts replicate; personal-replica state like read/last-activity (cm_read_state) must never be sent over the shared session, exactly as the channel rules already require.",
      "Build a Knowledge Library equivalent as a separate, higher-durability scope (published_blob / sealed share) rather than a feed event: static reference docs become sealed, pinned content addressed by content id, resolvable via the verify-then-pin path. This reuses the existing createSealedShare/fetchAndPinFromHosts machinery and keeps durable docs out of the bump-driven channel log.",
      "Agents-as-first-class-participants is the differentiator: where Workplace bolted bots onto a centralized feed, Meerkat can let an agent hold its own device identity/key and author signed post/comment events into a channel under the same Ed25519 + sealed-envelope rules as a human. An @-mention becomes a verifiable, signed targeting event that can trigger an agent's mailbox-drain/workflow, all e2e-encrypted, with the relay seeing only sizes and timing.",
      "Shallow bounded nesting (post -> comment -> one reply layer) is cheap to enforce in the event schema (a reply event may reference a comment id but a sub-reply must fold to that comment's level), and it keeps CRDT-style merge of the tree tractable for offline/mesh sync.",
      "The Workplace shutdown is the strategic wedge: it strands ~customers on a 2026-06-01 deletion deadline with no first-party migration and a forced move to Viva Engage/Workvivo. Meerkat's pitch is the inverse: open-standard, e2e-encrypted, mesh/relay posts whose content is content-addressed and owned by the participants, so there is no vendor with a delete button. Lead positioning with 'your team's knowledge is durable because it lives on your devices, not our datacenter.'",
      "Mirror the inner-loop/outer-loop split honestly: Meerkat channels (cm_messages) are the durable outer-loop post surface; keep any fast/ephemeral chat clearly separated and never let the feed silently double as the reference store, the exact mistake Workplace had to patch with Knowledge Library."
    ],
    "sources": [
      {
        "title": "Workplace has entered read-only mode (Facebook Help Center) - official shutdown phases",
        "url": "https://www.facebook.com/help/1167689491269151/"
      },
      {
        "title": "Facebook Workplace Shutting Down: What You Need to Know (Joyned) - dated phase timeline",
        "url": "https://www.joynedapp.com/en-us/blog/facebook-workplace-is-shutting-down"
      },
      {
        "title": "Workplace (software) - Wikipedia - launch, content model, shutdown announcement 2024-05-14, Workvivo successor",
        "url": "https://en.wikipedia.org/wiki/Workplace_(software)"
      },
      {
        "title": "Viva Engage - Wikipedia - Yammer 2008 founding, 2012 Microsoft acquisition ($1.2B), Feb 2023 rebrand",
        "url": "https://en.wikipedia.org/wiki/Viva_Engage"
      },
      {
        "title": "Yammer's Integration Into Viva Engage Is a Story of Evolution, Not Extinction (Reworked) - Yammer code still the engine; inner/outer loop",
        "url": "https://www.reworked.co/digital-workplace/yammers-integration-into-viva-engage-is-a-story-of-evolution-not-extinction/"
      },
      {
        "title": "Facebook Workplace: what it is, why it closes, and alternatives (Dev4Side) - groups, feed, reactions, mentions, Knowledge Library, shutdown reasons",
        "url": "https://www.dev4side.com/en/blog/facebook-workplace/"
      },
      {
        "title": "Group and Chat Bots - Workplace - Meta for Developers - bots posting/commenting/reacting, threaded replies, @mentions",
        "url": "https://developers.facebook.com/docs/workplace/bots/"
      },
      {
        "title": "Workplace Knowledge Library (LineZero) - categories/subcategories, draft/proof/publish, separate from feed",
        "url": "https://www.linezero.com/blog/workplace-launches-knowledge-library"
      },
      {
        "title": "Our Approach to Facebook Feed Ranking (Meta Transparency Center) - action-bumping logic, recency + comment signals",
        "url": "https://transparency.meta.com/features/ranking-and-content/"
      },
      {
        "title": "Prevent Brain Drain: Knowledge Management in Slack (Slack) - channels as record vs ephemeral DMs/messages",
        "url": "https://slack.com/blog/productivity/knowledge-management-in-slack"
      },
      {
        "title": "Office 365: Applying Inner Loop - Outer Loop Thinking (CMSWire) - posts/Yammer outer loop vs chat inner loop",
        "url": "https://www.cmswire.com/digital-workplace/office-365-applying-inner-loop-outer-loop-thinking-to-ownership/"
      },
      {
        "title": "Meta Workplace customers can now migrate to Microsoft Viva Engage (Neowin) - lineage successor migration path",
        "url": "https://www.neowin.net/news/meta-workplace-customers-can-now-easily-migrate-to-microsoft-viva-engage/"
      }
    ]
  },
  {
    "topic": "Zulip's stream + topic threading model: the missing primitive between channel and thread, addressable re-surfacing topics, narrows/filters, and the bot/agent API",
    "keyTakeaways": [
      "Zulip's core data model is two mandatory coordinates per message: a STREAM (now called 'channel' = who receives it) and a TOPIC (a short subject line = what it's about). Messages sharing the same channel+topic are the conversational thread. Topics are the unit of conversation, not the channel and not an optional reply chain.",
      "The topic is the 'missing primitive' between a noisy channel and a buried thread: it is lighter-weight than a channel (no membership, created by just typing a name, shortcut C) but heavier than a Slack thread (named, first-class, addressable, shown inline in the main view, not in a sidebar). Zulip frames it directly: 'Topics in Zulip fill the role of threads in other chat apps.'",
      "Topics fix Slack thread decay structurally. In Slack, a thread fades into a collapsed 'N replies' sidebar reference and old threads are buried as the channel scrolls. In Zulip, new activity RE-SURFACES the topic to the top of the channel's left sidebar, the Inbox, and Recent Conversations. Quote: 'New messages will pop a long-running thread to the top, rather than languishing in a forgotten sidebar.'",
      "Topics stay addressable. Every topic is a URL via the 'narrow' system. Zulip 9.0 (feature level 271) added the `with` operator, which keys a permanent link off a message ID so the link KEEPS WORKING even after the topic is renamed, moved between channels, or resolved. This makes a conversation a stable, linkable, movable object.",
      "A 'narrow' is a composable filter set (channel, topic, sender, search, dm, is:unread, is:followed, is:muted, has:reaction, mentions, with, id...). The active narrow IS the URL in the address bar, so any view (a topic, a search, one sender in one channel) is a shareable permalink. This is the same query layer the API uses to fetch messages.",
      "Topic lifecycle tooling makes threads manageable at scale: resolve a topic (checkmark, marks it done), move/split messages to another topic or channel, mute or follow individual topics, and (Zulip 11, Aug 2025) channel folders plus 'channels without topics' for flexibility. Follow a topic and you get notified on new activity without subscribing to the whole channel.",
      "Agents are first-class via a clean bot framework: a bot is triggered only by an @mention in a channel or a DM (so it never sees everything), Zulip POSTs the message to your URL (outgoing webhook) or runs an in-process Python handler (handle_message(message, bot_handler)), and the bot replies with simple JSON ({content: markdown} or {response_not_required: true}). The Zulip Botserver is a Flask app implementing this; bots also get a full REST API key for reactions/uploads.",
      "Current (mid-2026) state is strong and directly relevant: Zulip 11.0 (Aug 2025) shipped server-side E2EE push notifications, channel folders, message reminders; Zulip 12.0 (Apr 2026) turned E2EE push on end-to-end with rebuilt Flutter mobile apps, and added explicit LLM-agent affordances (agents discover web-public channels via an llms.txt instruction file; Atolio AI search keeps data local). Open source, self-hostable, Apache-2.0."
    ],
    "relevantPrimitives": [
      "Channel (formerly 'stream'): the delivery + access-control boundary = who receives messages. Membership-gated. Coarse-grained, like a Slack channel.",
      "Topic: a short named subject line attached to every message inside a channel. The conversation thread. Created by typing a name (no setup), renameable, resolvable, movable. THE missing mid-level primitive.",
      "channel+topic tuple: the actual addressable conversation key; all messages with the same tuple render together inline.",
      "Narrow: a JSON array of {operator, operand, negated} filters that defines a view AND serializes to the address-bar URL. The single query primitive shared by the UI, search, and the REST get-messages API.",
      "Narrow operators: channel/stream, channels:archived, topic, sender, search, dm / dm-including, is:unread / is:followed / is:muted, has:reaction, mentions, id, and with.",
      "`with` operator (Zulip 9.0, feature level 271): permanent topic link anchored to a message ID; survives topic rename / move / resolve. Stable conversation identity.",
      "Topic state: resolved (checkmark / done), muted (suppressed), followed (notify on new activity without channel subscription). Per-topic, not per-channel.",
      "Inbox + Recent Conversations + left-sidebar recent-topics: three surfaces where a topic re-surfaces on new activity (the anti-decay mechanism).",
      "Channel folders (Zulip 11.0): a grouping layer above channels for navigation/filtering at scale.",
      "Outgoing webhook: bot trigger via @mention or DM -> HTTP POST of the message to a configured URL; reply is JSON {content} (Zulip-flavored Markdown) or {response_not_required:true}; 10s default timeout.",
      "Interactive bot handler (in-process): Python class with usage() and handle_message(message, bot_handler); bot_handler.send_reply / send_message; full REST API key for reactions, uploads, etc. Zulip Botserver = Flask implementation of the webhook API.",
      "E2EE push notifications (Zulip 11 server-side, Zulip 12 end-to-end on Flutter apps): notification payloads encrypted server->device.",
      "llms.txt agent-discovery file (Zulip 12.0): a documented instruction surface so LLM agents can find/read web-public channels."
    ],
    "whatToBorrow": [
      "Make the topic a mandatory first-class coordinate on every message, not an optional reply chain. Two required keys: community/channel (who) + topic (what). This single decision is the entire fix for thread decay and is cheap to model in cm_messages (add a topic field to the existing signed channel-message event).",
      "Re-surface on activity, not on recency-of-first-post. When a new signed message lands in a topic (including via mailbox drain / mesh relay), bump that topic to the top of the channel's topic list, the Inbox, and unread badges. This is the behavior that beats Slack and it is purely a local ordering rule over cm_messages HLC timestamps.",
      "Adopt a narrow-style query layer as the addressing primitive: a small composable filter (community, channel, topic, sender, is:unread, has:attachment) that both renders a view and serializes to a shareable link. Meerkat already has share links / magnet links; a 'conversation narrow link' is the same idea applied to a topic.",
      "Steal the `with`-operator insight: anchor a permanent topic link to a content/message id, not to the topic name, so resolving/renaming/moving a topic never breaks an existing link. In a mesh world where a topic can be re-homed, a stable id-anchored permalink is essential.",
      "Per-topic follow / mute / resolve state as personal-replica data. Meerkat already has cm_read_state (per-channel last-read HLC, personal-replica). Extend that pattern to per-topic follow/mute/resolved flags that stay device-local / personal_replica and NEVER ride the shared community session.",
      "Topic resolve (checkmark) as a tombstone-style signed event, mirroring Meerkat's existing edit/delete tombstone events in cm_messages. A 'resolved' marker is a low-risk, append-only signed event that any peer can verify and apply deterministically.",
      "The bot trigger model: an agent only acts on explicit @mention or DM, the server forwards just that one message, and the reply is dead-simple JSON. This least-privilege trigger surface is exactly right for a privacy-first app: an agent should never have an ambient feed of everything, only the messages addressed to it.",
      "Document an agent-discovery / capability surface (Zulip's llms.txt move) so first-class agents in Meerkat have a defined, signed manifest of what they can read and do, rather than implicit access."
    ],
    "whatToAvoid": [
      "Do not copy Zulip's server-centric trust model wholesale. Zulip is self-hostable open source but its bot framework, narrows API, and message store all assume a central trusted server that sees plaintext and routes everything. Meerkat's threading must run over signed, encrypted cm_messages with no plaintext-trusting relay (the relay sees only sizes/timing per the MK-044 frame envelope).",
      "Do not adopt the outgoing-webhook HTTP-POST-the-plaintext-to-a-URL pattern for agents as-is. That model hands a message to an external server in cleartext. A first-class Meerkat agent must be a verifying participant operating on already-decrypted-on-device events, or an explicitly consented endpoint, not a webhook that exfiltrates plaintext off the node.",
      "Avoid Zulip's reliance on server-computed unread/inbox state and push-notification servers. Meerkat re-surfacing must be computed locally from HLC ordering and the mailbox-drain applied counts; do not introduce a server that maintains canonical per-user read state.",
      "Do not require a topic taxonomy to be globally consistent across all members in a partition-tolerant mesh. Zulip's server arbitrates topic moves/merges centrally. In a mesh, two peers can create the same topic name independently; design topic identity (stable id + display name) so concurrent creation merges cleanly instead of needing a central arbiter.",
      "Do not let per-topic personal state (followed/muted/resolved-for-me, read position) leak onto the shared community session. Zulip stores this server-side; Meerkat's CLAUDE.md already warns cm_read_state must never be sent over a shared community session, and the same rule must cover topic follow/mute state.",
      "Do not promise Zulip-grade real-time topic re-ordering across devices before the transport honesty boundary supports it. Re-surfacing is honest only for events actually applied locally (manual session or mailbox drain). Do not show a topic as 'active now' based on anything but real applied cm_messages rows."
    ],
    "meerkatImplications": [
      "The topic primitive maps almost directly onto Meerkat's existing cm_messages signed-event model: add a topic identifier (stable id + human label) to the channel message event. No new transport, no new crypto, no new synced table needed. Topics become a free organizational layer on top of the engine + mailbox path already shipped (MK-008/MK-030/043).",
      "Re-surfacing is a local ordering rule, which fits the mesh perfectly. Because Meerkat orders by HLC and applies messages via runMailboxDrainJob (fail-closed, only verified events written), the 'bump topic to top on new activity' behavior is deterministic per device and needs no server. A topic that a paired device parked for you while offline correctly re-surfaces the moment the drain applies its verified messages.",
      "Addressable topics extend Meerkat's existing link primitives. buildShareLink / buildMagnetLink already encode content addressing; a 'topic permalink' anchored to a signed message id (the `with`-operator insight) gives a stable, end-to-end-verifiable deep link into a conversation that survives a topic being moved/re-homed across the mesh. Trust still flows through verify-then-pin / verify-then-apply, never through the link itself.",
      "Per-topic follow/mute/resolved state slots into the personal_replica scope alongside cm_read_state: device-local or personal-replica only, capped by maxScope so it never escalates onto a shared_workspace community session. This is the same privacy boundary the codebase already enforces for last-read HLC.",
      "Agents as first-class participants should follow Zulip's least-privilege trigger (act only on @mention or DM) but invert the trust direction: a Meerkat agent is a local verifying node that operates on already-decrypted-on-device events and emits its own SIGNED cm_messages events into a topic, so the relay/mesh sees only ciphertext and the agent's authorship is cryptographically attributable like any member. No plaintext webhook off-device.",
      "Meerkat is well-positioned versus Zulip on exactly the axis Zulip is still catching up on: Zulip only reached end-to-end-encrypted push notifications in v11/v12 (2025-2026) and its message store is server-plaintext. Meerkat's E2EE-by-default, relay-sees-only-sizes posture (MK-044) means adopting Zulip's threading UX gives a strictly more private product: the best-cited fix for thread decay, on a transport Zulip does not have.",
      "Topic resolve and topic move should be append-only signed events mirroring Meerkat's existing edit/delete tombstones in cm_messages, so they replicate and converge through the same engine + mailbox path with no special-case sync code. Concurrent topic creation across a partition should merge by stable id, since there is no central server to arbitrate moves."
    ],
    "sources": [
      {
        "title": "Introduction to topics - Zulip help center",
        "url": "https://zulip.com/help/introduction-to-topics"
      },
      {
        "title": "Why Zulip? Efficient communication with organized team chat",
        "url": "https://zulip.com/why-zulip/"
      },
      {
        "title": "Streams and topics (Zulip Help Center)",
        "url": "https://zulip.com/help/about-streams-and-topics"
      },
      {
        "title": "Construct a narrow - Zulip API documentation",
        "url": "https://zulip.com/api/construct-narrow"
      },
      {
        "title": "Get messages - Zulip API documentation (with operator / narrows)",
        "url": "https://zulip.com/api/get-messages"
      },
      {
        "title": "Searching for messages - Zulip help center (URL permalinks)",
        "url": "https://zulip.com/help/search-for-messages"
      },
      {
        "title": "Outgoing webhooks - Zulip API documentation",
        "url": "https://zulip.com/api/outgoing-webhooks"
      },
      {
        "title": "Writing interactive bots - Zulip API documentation",
        "url": "https://zulip.com/api/writing-bots"
      },
      {
        "title": "Running interactive bots / Botserver - Zulip API documentation",
        "url": "https://zulip.com/api/running-bots"
      },
      {
        "title": "Zulip 11.0: Organized chat for distributed teams (Aug 2025)",
        "url": "https://blog.zulip.com/2025/08/13/zulip-11-0-released/"
      },
      {
        "title": "Zulip 12.0: Organized chat for distributed teams (Apr 2026)",
        "url": "https://blog.zulip.com/2026/04/27/zulip-12-0-released/"
      },
      {
        "title": "The threaded part is key here - Slack threads vs Zulip (Hacker News)",
        "url": "https://news.ycombinator.com/item?id=27149487"
      },
      {
        "title": "Zulip - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Zulip"
      }
    ]
  },
  {
    "topic": "Threading and forum-channel primitives in Teams, Discord, and Telegram as references for team + agent workflows, and why \"a thread per agent task\" collapses without a forum/post primitive",
    "keyTakeaways": [
      "Three different products converged on the same answer: a flat chat channel cannot hold many parallel conversations, so each conversation needs to become a first-class, addressable object. Discord forum channels (GUILD_FORUM, type 15) make every post a thread from creation with no main feed; Telegram added forum 'topics' in supergroups addressed by message_thread_id (General topic is id=1); Microsoft Teams shipped a threaded channel layout (GA mid-Aug 2025) that becomes the DEFAULT for the first channel of newly created teams starting May 2026.",
      "The mechanical distinction that matters: a Discord thread is a channel-like object (a 'temporary sub-channel'), not a message. A forum channel is a channel whose children are ONLY threads/posts. So 'post' and 'thread' are the same object in a forum, addressed by an id, with a parent_id, owner_id, applied_tags, and an archive state. This is the difference between an ephemeral reply branch and a durable, queryable record.",
      "'A thread per agent task' is the Slack #threadfail problem at machine scale. Slack's own design team documented it: offscreen threads are visible to no one except participants, new replies don't resurface in the channel, and a brilliant explanation gets 'buried in a channel with 10,000 messages and no one will ever find it again.' Spawn one ad-hoc thread per agent task and you get hundreds of invisible, unindexed, statusless side-channels with no top-level board to see what is running, blocked, or done.",
      "Forum/post primitives fix this with five concrete affordances: (1) a browsable channel HOME that is an index of topics, not a message firehose; (2) tags as a status/taxonomy layer (Discord recommends 8-15 tags; required tags force a category on creation; staff-only tags like triaged/resolved/needs-info are applied by moderators, not authors); (3) persistence and findability (a post survives, is searchable, can be pinned to never auto-archive); (4) per-topic follow/notify so you subscribe to the tasks you care about; (5) lifecycle states (open/closed/hidden/archived, auto-archive on inactivity) that garbage-collect sprawl automatically.",
      "AI 'agent sprawl' is now a named 2026 failure mode: spawning many isolated agent processes/conversations without a unifying control plane destroys visibility, governance, and security, and pollutes context. The fix the industry is reaching for is the same one chat apps reached for: a structured index/control plane over the spawned units, not more raw threads. LangGraph-style thread-based checkpointing gives each task a persistent, resumable state keyed by a thread id, which is the durable-object idea applied to orchestration state.",
      "Agents are becoming first-class workspace participants in 2026, not anonymous bots: tools give an agent its own user, a team-chosen name, its own email, and persistent memory, and let you plug Claude/GPT/Gemini in as a 'first-class queue participant' across Slack, Teams, and Discord. The platform primitive that makes this legible is the per-topic, identity-stamped post: you can see WHICH agent owns WHICH task and its status, instead of a wall of indistinguishable bot messages."
    ],
    "relevantPrimitives": [
      "Discord forum channel (GUILD_FORUM type 15) / media channel (type 16): thread-only channels where post == thread from creation, no direct messages in the channel, last_message_id points to the newest THREAD not message.",
      "Discord thread object: a channel-like 'temporary sub-channel' with parent_id, owner_id (creator), name, auto_archive_duration; public vs private (GUILD_PRIVATE_THREAD, invite-only) threads; guilds capped at a number of active threads and the auto-archive timer shrinks under load.",
      "Discord applied_tags / available_tags + REQUIRE_TAG flag: forum posts carry tags from a channel-defined taxonomy; REQUIRE_TAG forces a tag at creation. PINNED posts do not auto-archive.",
      "Discord rate/scale fields: rate_limit_per_user (per-thread slowmode), default_thread_rate_limit_per_user (throttles thread/post creation) -- directly relevant to a bot creating many posts programmatically.",
      "Telegram forum topics: forumTopic object with id, title, icon (custom emoji or color), status flags closed/hidden/pinned; General topic is non-deletable id=1; topics_pinned_limit caps pinned topics; manage_topics admin right gates creation/edit; channels.toggleForum converts a supergroup to a forum.",
      "Telegram Bot API topic routing: message_thread_id parameter on sendMessage/sendPhoto/etc routes a message to a topic; Chat.is_forum signals topic support; Message.is_topic_message + message_thread_id identify a topic message; can_manage_topics admin right; createForumTopic / editForumTopic / closeForumTopic / reopenForumTopic / deleteForumTopic.",
      "Microsoft Teams threaded channel layout: reply-in-thread-only vs reply-in-thread-and-channel; 'Followed Threads' per-thread subscription; send-to-main-channel to broadcast a decision back; layout-only change over the existing post/reply data model; ThreadedChannelCreation policy (Set-CsTeamsChannelsPolicy).",
      "Slack threads + All Threads view: the canonical cautionary primitive -- hiding replies from the channel made channels readable but pushed every side-conversation out of sight, requiring a separate central index (All Threads) to make threads discoverable again.",
      "Orchestration analog: LangGraph thread-based persistence/checkpointing -- each task is a thread id with a Postgres-backed, resumable state snapshot. The durable-object pattern applied to agent state rather than chat."
    ],
    "whatToBorrow": [
      "Make the agent task a forum-style POST, not an ephemeral chat thread. Borrow the Discord/Telegram invariant: post == thread from creation. Each agent task is one durable, addressable object (a cm_ 'topic' sub-type) with an owner, a parent channel/community, and a stable id that the mesh can sync and that the UI can deep-link to.",
      "Ship a browsable task INDEX as the channel home (the forum-home pattern), not a message firehose. The default screen for a community's agent work should be a queryable list of task-posts with their status, not a scroll of every reply. This is the single highest-leverage fix for the 'thread per task' problem.",
      "Adopt a tag taxonomy as the status + routing layer. Borrow Discord's split: REQUIRED tags chosen at creation (which agent, which capability/risk tier) and STAFF/SYSTEM-ONLY tags applied by the engine, not the author (queued / running / blocked / done / needs-human). Keep it to ~8-15 tags and prune dead ones, exactly as Discord's 2026 guidance says.",
      "Lifecycle states with auto-archive. Borrow closed/hidden/pinned (Telegram) and auto-archive-on-inactivity with PINNED-never-archives (Discord). A finished or stale agent task auto-archives out of the active board but stays searchable; a critical long-running task gets pinned. This is how you garbage-collect sprawl without deleting the record.",
      "Per-task follow/notify (Teams 'Followed Threads', Telegram per-topic notify). A human subscribes to the specific agent tasks they own or care about and gets the firehose off their notifications -- essential when dozens of agents run at once.",
      "Promote-to-main / broadcast-the-decision (Teams 'reply in thread and channel'). When an agent task reaches a decision or needs a human, it can surface a single summarized event to the parent channel without dumping its whole transcript. Keeps the index clean and the audit trail intact.",
      "Agents as first-class identities. Borrow the 2026 'agent as a real member' pattern -- give each agent its own identity (Meerkat already has friend-code identity: reuse it). Every task-post and every message is signed by an agent identity so the board shows WHO is doing WHAT, and trust/verification is per-identity.",
      "Create-rate throttles on programmatic post creation (Discord default_thread_rate_limit_per_user). When agents spawn task-posts automatically, throttle creation so a runaway agent cannot flood the index or the mesh."
    ],
    "whatToAvoid": [
      "Do NOT model agent tasks as ad-hoc reply threads off a chat message (the Slack default). That is exactly the #threadfail path: offscreen, unindexed, statusless, and buried within hours. Slack needed a whole separate 'All Threads' view to claw back discoverability after the fact.",
      "Do NOT rely on a flat chronological feed as the primary surface for parallel work. Discord's 2026 guide is explicit: 'forums die when good posts vanish because only latest matters.' A pure latest-activity sort hides completed-but-important tasks. Provide created-date and status sorts too.",
      "Avoid author-applied status tags for anything trust-bearing. If an agent can self-label its own task 'done' or 'safe', that is a trust hole. Mirror Discord staff-only tags and Meerkat's verify-then-pin ethic: status that implies completion or trust must be set by the engine from a real signed protocol row, never asserted by the participant.",
      "Do not let topic/tag taxonomy explode. Telegram and Discord both warn that uncontrolled topics/tags get noisy fast (one job per forum; 8-15 tags). An agent system that auto-mints a new tag per task will recreate the sprawl it was meant to solve.",
      "Do not copy Teams' confusing reply-mode UX blindly. Microsoft's own rollout drew criticism that 'reply in thread only' vs 'reply in thread and channel' is cryptic, and the subject-after-posting flow is unintuitive. If Meerkat adds promote-to-channel, make the two scopes obviously distinct.",
      "Do not centralize the index in a way that breaks the privacy model. Teams' whole pitch was governance via centralization (files into SharePoint, compliance hold). Telegram/Discord forums live on a central server. Meerkat's index must remain a mesh-synced, per-workspace-encrypted set of signed posts -- the 'control plane' cannot become a plaintext server that sees task metadata.",
      "Never fake a connected/active/received status on the task board. The same honesty rule as transport applies: a task-post's 'running' or 'delivered to agent' state must come from a real engine/protocol row, not optimistic UI. Agent sprawl gets dangerous precisely when the dashboard lies about what is actually live."
    ],
    "meerkatImplications": [
      "Add a forum/post primitive to the community layer: extend cm_ channels with a 'topic channel' (forum-style) sub-type where each agent task is one signed post-object (its own id, owner agent identity, parent community/channel, applied tags, lifecycle state). This is the structural fix for 'thread per agent task' and slots into the existing cm_messages + manual-session sync path rather than a parallel system.",
      "Reuse Meerkat's friend-code/identity layer to make agents first-class participants: every agent gets a signed identity, so each task-post and message is attributable and verifiable per-identity (createSignedIdentityBundle / verifySignedIdentityBundle / TOFU pinning). The task board shows which agent owns which task, and trust is per-agent, not per-channel.",
      "Status tags must be engine-set, not agent-asserted. Define a system-owned tag set (queued/running/blocked/needs-human/done) applied only when a real signed protocol row justifies it, mirroring the existing 'open only envelopes that verify, fail closed, nothing written on bad signature' discipline in runMailboxDrainJob. An agent cannot label its own task complete.",
      "Keep the index decentralized and E2E-encrypted. The 'forum home' is a per-workspace, mesh-synced view computed from signed posts under the workspace symmetric key. A relay only sees opaque, pairwise-enveloped frames (sizes/timing), never task ids, tags, agent identities, or status -- consistent with the MK-044 hardening. Do not introduce a plaintext task server.",
      "Apply maxScope to task-posts and especially to read/status state. A personal 'last-read' or 'followed task' state is personal_replica and must never be sent over a shared community session (same rule as cm_read_state). Agent task-posts that are workspace work are shared_workspace; anything device-private stays capped.",
      "Offline-first lifecycle via mailbox drain + auto-archive: a task-post parked for an offline agent/human syncs through the existing background mailbox drain; stale tasks auto-archive out of the active board (Discord pattern) but remain searchable locally. This prevents the local SQLite index from becoming the sprawl it was meant to cure, with zero fake 'delivered' claims.",
      "Honesty boundary for agents: the same 'never fake connected/peer-count/transfer-in-flight' rule extends to the agent board -- 'agent running' / 'task delivered' must reflect a real engine or sync_ row. Throttle programmatic post creation (Discord default_thread_rate_limit pattern) so a runaway agent cannot flood the mesh or the index.",
      "Open-standard angle: define the task-post as an open, signed payload schema (post id, parent, author identity, tags, lifecycle, content refs) so any conforming agent or client can read/write the board over the mesh -- the forum primitive becomes an interop contract, not a Meerkat-only feature, which is the differentiator versus the closed Teams/Discord/Telegram servers."
    ],
    "sources": [
      {
        "title": "Discord Developer Docs: Threads (and forum/media channel data model)",
        "url": "https://docs.discord.com/developers/topics/threads"
      },
      {
        "title": "Discord Support: Forum Channels FAQ",
        "url": "https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ"
      },
      {
        "title": "Why forum channels are amazing (Ray Zhou / Astrogation)",
        "url": "https://astrogation.substack.com/p/why-forum-channels-are-amazing"
      },
      {
        "title": "Discord Forum Channels: Setup, Tags, Moderation, and When to Use Them in 2026 (Space-Node)",
        "url": "https://space-node.net/blog/discord-forum-channels-setup-guide-2026"
      },
      {
        "title": "Threads in Microsoft Teams channels (Microsoft Adoption)",
        "url": "https://adoption.microsoft.com/en-us/microsoft-teams/new-chat-and-channels-experience/threads-in-channels/"
      },
      {
        "title": "Threaded Layout Available for Teams Channels (Practical365)",
        "url": "https://practical365.com/teams-threaded-layout/"
      },
      {
        "title": "First channel in new Microsoft Teams will default to threaded conversation layout (M365 Admin)",
        "url": "https://m365admin.handsontek.net/first-channel-new-microsoft-teams-will-default-threaded-conversation-layout/"
      },
      {
        "title": "Telegram Forums (Client API: forumTopic, General id=1, manage_topics, toggleForum)",
        "url": "https://core.telegram.org/api/forum"
      },
      {
        "title": "Telegram Bot API (message_thread_id, is_forum, is_topic_message, forum topic methods)",
        "url": "https://core.telegram.org/bots/api"
      },
      {
        "title": "Threads in Slack, a long design journey (part 2) - Slack Design",
        "url": "https://slack.design/articles/threads-in-slack-a-long-design-journey-part-2-of-2/"
      },
      {
        "title": "Slack's Threading Failure #threadfail (Brad Robertson, Medium)",
        "url": "https://medium.com/@brad.robertson/slack-threading-failure-threadfail-977859586d5a"
      },
      {
        "title": "What is AI Agent Sprawl? (IBM)",
        "url": "https://www.ibm.com/think/topics/ai-agent-sprawl"
      },
      {
        "title": "Best Multi-agent Orchestration Frameworks in 2026 (TrueFoundry)",
        "url": "https://www.truefoundry.com/blog/multi-agent-orchestration-frameworks"
      },
      {
        "title": "Plain - Best Slack-Native Support Tools for B2B SaaS in 2026 (Bring Your Own Agent / first-class queue participant)",
        "url": "https://www.plain.com/blog/best-slack-native-support-tools-2026"
      }
    ]
  },
  {
    "topic": "Open standards for federated/decentralized/E2EE team chat and social (Matrix, ActivityPub, Nostr, XMPP, MLS/MIMI) and the strategic playbook for an open \"Workplace successor\" that erodes Slack via interop",
    "keyTakeaways": [
      "No single existing standard is a turnkey 'open Slack.' Matrix is closest to a team-chat shape (Spaces=workspaces, rooms, threads, E2EE, calls, bridges) and has real 2026 enterprise pull (Belgian government rollout 2026, French gov, German military, healthcare; Discord-age-verification refugees in Feb 2026). ActivityPub is the social/feed layer (W3C standard, ~12M registered / ~2M MAU per FediDB, Threads federating to 100+ regions). Nostr is the censorship-resistant relay model. XMPP is the 25-year battle-tested federation substrate. Each owns one slice; the winning move is to compose them, not pick one.",
      "The real emerging blueprint for an OPEN cross-provider team-chat standard is IETF MIMI (More Instant Messaging Interoperability) running over HTTPS + MLS. As of 2026 the drafts are active (draft-ietf-mimi-protocol-05, draft-ietf-mimi-content-08). It defines provider-addressed identity URIs (mimi://a.example/u/alice, /r/clubhouse), a per-room 'hub' provider that orders/authorizes/distributes messages, MLS for E2EE group state, and AppSync proposals so servers enforce room policy without reading content. This is the closest thing to a standards-track 'federated workspace' protocol.",
      "MLS (RFC 9420) is the consolidation point for E2EE group chat and is winning by default in 2026: Google Messages + Apple Messages rolling out MLS-over-RCS (May 2026), Discord using MLS for call encryption, RCS adopting MLS for 100s of millions of devices, and Matrix migrating from Megolm/Olm to decentralized MLS (MSC4256). MLS gives forward secrecy + post-compromise security and scales from 2 to thousands of members. An open Workplace successor should be MLS-native from day one, not roll its own crypto.",
      "The strategic logic is 'erosion via interop,' not frontal assault. Slack's moat is network effects + ~2,600 app integrations + searchable history + Salesforce bundling lock-in (post-$27.7B acquisition). You do not beat that by asking teams to migrate; you bridge into it so a Meerkat user and a Slack user can be in the same conversation, then let the open side accrue the features Slack can't match (E2EE, self-sovereign identity, mesh/offline, agent-native). 'The product that integrates with everything becomes harder to remove than the one that integrates with nothing.'",
      "Bridges vs native federation is the central design tension. Bridges (Matrix-style) get you instant reach into WhatsApp/Slack/Discord/Telegram/Signal and are how erosion starts, but the XMPP-to-Meta briefing warns API-bridges don't scale (N providers = N bridges) and let incumbents 'claim openness while ensuring nothing happens.' Native federation (XMPP S2S, MIMI hub model) scales but needs the incumbent to actually implement it. The DMA is the forcing function: Element demonstrated 1:1 Matrix<->WhatsApp chats over the DMA APIs with E2EE preserved (Signal Protocol), but reachability defaults, multi-device limits, and federation scope remain unresolved.",
      "Regulation is doing the prying-open for you. The EU DMA (first review 27 Apr 2026: 'fit for purpose') forces WhatsApp + Messenger gatekeepers to interoperate on request while preserving E2EE; Meta's implementation has third parties build protobuf message stanzas encrypted with the Signal Protocol. This is the wedge: a small open client gains the legal right to talk to billions of incumbent users without the incumbent's permission. An open Workplace successor should be architected to consume these mandated interop APIs as a first-class transport.",
      "Agents-as-participants is the 2026 differentiator no incumbent owns natively. Agent protocols consolidated fast: MCP (~18k servers, agent-to-tool), A2A (agent-to-agent), ACP (REST-native), all now under the Linux Foundation's Agentic AI Foundation (co-founded by OpenAI, Anthropic, Google, Microsoft, AWS, Block; ~150 members). But agent-to-agent coordination inside a messaging fabric is still an open problem. A chat standard where agents are first-class members (their own identity, keys, room membership, MLS leaf) rather than bolted-on bots is a genuinely open lane."
    ],
    "relevantPrimitives": [
      "MLS / RFC 9420: TreeKEM group key agreement, forward secrecy + post-compromise security, 2-to-thousands members, asynchronous add/remove via Commits and Welcome messages, KeyPackages for offline join. The crypto core Meerkat should align its @mylife/sync group keying to.",
      "MIMI hub-provider model: one provider per room orders/authorizes/distributes; non-hub providers proxy their users; maps cleanly onto Meerkat's relay rung (a relay = a candidate hub) while keeping payloads opaque.",
      "MIMI identity URIs: provider/user/client/room/group addressing (mimi://provider/u/user, /r/room) - a federation-ready naming scheme analogous to Matrix IDs (@user:server) and XMPP JIDs (user@domain), all email-shaped (local-part + routable domain).",
      "AppSync proposals in MLS PublicMessages: room state (membership, roles, name, policy) changes carried as signed proposals servers can validate without decrypting content - lets a relay enforce policy blind. Directly relevant to Meerkat's 'security lives in the payload, not the channel.'",
      "Matrix Spaces: hierarchical room grouping that maps to workspaces/teams; the closest open primitive to a Slack workspace.",
      "Matrix threads + Megolm->MLS migration (MSC4256, decentralised MLS): how an existing federated network incrementally swaps its E2EE engine without forking the ecosystem.",
      "Matrix bridges (Slack/Discord/Telegram/WhatsApp/Signal/IRC): puppeting + portal rooms - the canonical erosion-via-interop mechanism.",
      "ActivityPub Activity/Object model (Create/Update/Announce/Follow, inbox/outbox, C2S + S2S): the open social/feed layer for any public broadcast surface; note the unsolved quote-post and restricted-reply gaps.",
      "Nostr NIP-17 (gift-wrapped DMs via NIP-44 + NIP-59) and NIP-EE (MLS-over-Nostr for group E2EE): metadata-hiding DM pattern and a relay-based group-messaging approach worth studying for Meerkat's metadata privacy goals.",
      "XMPP federation (S2S), JIDs, OMEMO (XEP-0384) double-ratchet E2EE, and Compliance Suites (XEP-0459): the longest-running proof that open federated messaging works at scale, plus a cautionary tale on E2EE fragmentation.",
      "DMA interop transport: third-party protobuf message stanzas encrypted with the Signal Protocol, delivered via gatekeeper APIs - a mandated bridge into WhatsApp/Messenger.",
      "Agent protocol stack: MCP (agent-to-tool), A2A (agent-to-agent), ACP (REST agent comms), governed by the Linux Foundation AAIF - the open rails to make agents real chat participants."
    ],
    "whatToBorrow": [
      "Be MLS-native for group E2EE. Align Meerkat's @mylife/sync group keying to RFC 9420 (TreeKEM, KeyPackages, Commit/Welcome) so it inherits forward secrecy + post-compromise security and can one day federate with Matrix/MIMI/RCS instead of being a crypto island.",
      "Adopt MIMI's hub-per-room + opaque-policy design. Meerkat already has a relay rung; frame a relay as a candidate MIMI-style hub that orders and authorizes messages while seeing only sizes/timing. AppSync-style signed room-state proposals fit Meerkat's 'security in the payload, not the channel' principle exactly.",
      "Use email-shaped, provider-routable identity (local-part + domain/key), like JIDs / Matrix IDs / MIMI URIs. This is the precondition for ever federating and for letting agents have first-class addresses. Meerkat's friend codes + signed identity bundles are a good start; add a routable form so a Meerkat ID can be reached from outside.",
      "Lead with bridges to start the erosion, even if imperfect. A one-way or 1:1 bridge into Slack/Matrix/WhatsApp (via DMA APIs where legal) lets a single Meerkat user join an existing team's conversation. That is the wedge: zero migration required, value accrues immediately, the open side adds E2EE/mesh/agents the incumbent can't.",
      "Make agents first-class members with their own identity, keys, and MLS leaf - not bolted-on webhooks. Wire MCP for tool access and A2A for agent-to-agent coordination inside rooms. This is the differentiating lane Slack/Teams/Matrix have not natively claimed and aligns with Meerkat's 'agents as first-class participants' thesis.",
      "Treat regulation (DMA) as a transport, not a footnote. Architect a pluggable interop transport that can consume mandated gatekeeper APIs (protobuf stanzas + Signal Protocol) so Meerkat gains the legal right to reach billions of WhatsApp/Messenger users on request.",
      "Borrow ActivityPub only for the public/broadcast surface (announcements, community feeds), keeping it strictly separate from the E2EE private team layer. Don't try to encrypt the social graph; use AP where the content is meant to be public anyway.",
      "Copy Matrix's incremental migration discipline (MSC4256, decentralised MLS): ship a real engine now, evolve the crypto/federation without forking users. Meerkat's MK-series MSC-style versioning already mirrors this."
    ],
    "whatToAvoid": [
      "Do not roll your own group crypto when MLS (RFC 9420) exists and is consolidating the whole industry (RCS, Discord, Matrix, MIMI). A bespoke scheme means you can never interoperate and you carry the audit burden alone.",
      "Do not over-index on a frontal 'migrate off Slack' pitch. Slack's moat is ~2,600 integrations, searchable history, network effects, and Salesforce bundling. Migration has real switching costs; teams won't move cold. Erosion via interop beats replacement.",
      "Do not trust API-only bridges as the end state. The XMPP-to-Meta briefing is explicit: N-provider API bridges don't scale and let incumbents perform openness while blocking real interop. Use bridges to bootstrap, but push toward native federation (MIMI/XMPP-style S2S).",
      "Do not inherit XMPP's E2EE fragmentation mistake. Multiple incompatible OMEMO versions (0.2.0-0.3.0 vs 0.9.0+) fractured the encrypted experience. Pin one MLS-based group-E2EE profile and version it strictly; treat ciphersuite divergence as a release-blocking concern.",
      "Do not assume ActivityPub solves private messaging or rich interactions. It has no E2EE story for DMs and still lacks formal quote-post / restricted-reply specs - it is a public-feed protocol, not a confidential team-chat protocol. Keep it out of the private path.",
      "Do not fake federation/connectivity in UI. Mirrors Meerkat's existing transport-honesty rule: if a bridge is 1:1-only, dev-build-only, or relay-dependent, the copy must say so. Incumbents and regulators both punish 'openwashing.'",
      "Do not bet on Nostr's relay model for confidential team workspaces without the new MLS-over-Nostr (NIP-EE) layer; raw Nostr leaks social-graph metadata and its DMs were a late, retrofitted concern. Borrow the metadata-hiding patterns (gift-wrap), not the bare relay broadcast model.",
      "Do not let agents in as unauthenticated bots. If agents are first-class, they need real identity, scoped keys, room-level authorization, and MLS membership - otherwise they become the spam/abuse and exfiltration vector that kills enterprise trust."
    ],
    "meerkatImplications": [
      "Meerkat is well-positioned: it already has on-device E2EE (@mylife/sync), a relay rung, a LAN/mesh rung, signed identity bundles + TOFU pinning, and an offline mailbox drain. The strategic gap to an 'open Workplace successor' is (1) MLS-native group keying, (2) a routable federation identity, (3) bridges, and (4) agents-as-members. Three of four are additive to existing primitives, not rewrites.",
      "Map Meerkat's relay to a MIMI-style hub-per-room and its sealed-share/community session to MLS groups. The existing 'opaque to relay' framing (relay sees only sizes/timing) is exactly MIMI's design intent - this is a naming/spec alignment, not a re-architecture. Investigate adopting MLS for cm_messages community sessions so groups inherit forward secrecy + PCS.",
      "Give every Meerkat identity an email-shaped routable form (e.g. code-or-key @ relay-domain) on top of friend codes, so a Meerkat node can eventually be addressed from a Matrix/MIMI/XMPP peer. This is the precondition for both federation and giving agents first-class addresses.",
      "Build the first bridge as the wedge: a single Meerkat user joining an existing team's Matrix room (Matrix is the easiest open target - open spec, existing bridge ecosystem) or, where DMA applies, a 1:1 bridge into WhatsApp. Keep copy honest about scope (1:1, dev-build, relay-dependent). This is the erosion entry point that requires zero team migration.",
      "Make agents first-class members of Meerkat communities: give an agent its own mk_identity row, device keys, and MLS leaf; authorize it per-channel; wire MCP for its tool calls and A2A for agent-to-agent coordination inside a channel. This is Meerkat's clearest differentiation vs Slack/Teams/Element and directly serves the 'agents as first-class participants' product thesis. Enforce fail-closed: bad-signature / wrong-recipient agent messages dropped and counted, like the existing mailbox drain.",
      "Position Meerkat as the private-first, E2EE, mesh/relay, agent-native edge of an open federation - not a standalone island. The 10-year bet: be MLS- and MIMI-compatible so that when the open federation reaches critical mass (RCS+MLS, Matrix+MLS, DMA-mandated WhatsApp interop), Meerkat is already speaking the language and inherits reach instead of fighting for it.",
      "Keep the public/social surface (community discovery, announcements) on an ActivityPub-style broadcast model strictly separated from the E2EE private channels - do not try to encrypt a social graph. This matches MyLife's per-entity maxScope scoping (published_blob vs shared_workspace).",
      "Sequence the roadmap as erosion: (1) MLS-native groups + routable identity (foundation), (2) one read/write bridge into Matrix (reach), (3) agents-as-members (differentiation), (4) DMA-API transport when a gatekeeper interop window opens (scale). Each step adds value standalone, so adoption friction stays near zero at every stage."
    ],
    "sources": [
      {
        "title": "Matrix (protocol) - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Matrix_(protocol)"
      },
      {
        "title": "The EU Digital Markets Act is here - Element blog",
        "url": "https://element.io/blog/the-eu-digital-markets-act-is-here/"
      },
      {
        "title": "draft-ietf-mimi-protocol-05: MIMI using HTTPS and MLS",
        "url": "https://datatracker.ietf.org/doc/draft-ietf-mimi-protocol/"
      },
      {
        "title": "draft-ietf-mimi-content-08: MIMI message content",
        "url": "https://datatracker.ietf.org/doc/draft-ietf-mimi-content/"
      },
      {
        "title": "RFC 9420 - The Messaging Layer Security (MLS) Protocol",
        "url": "https://datatracker.ietf.org/doc/rfc9420/"
      },
      {
        "title": "IETF: RCS adopts MLS (100s of millions of devices)",
        "url": "https://www.ietf.org/blog/rcs-adopts-mls/"
      },
      {
        "title": "Messaging Layer Security - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Messaging_Layer_Security"
      },
      {
        "title": "Decentralised MLS (Matrix / uhoreg)",
        "url": "https://matrix.uhoreg.ca/mls/decentralised.html"
      },
      {
        "title": "Beyond Olm: challenges and opportunities in MLS - Matrix Conference 2025",
        "url": "https://cfp.2025.matrix.org/matrix-conf-2025/talk/BAKSEA/"
      },
      {
        "title": "NIP-EE: E2EE Messaging using MLS over Nostr",
        "url": "https://github.com/nostr-protocol/nips/blob/master/EE.md"
      },
      {
        "title": "Nostr - Notes and Other Stuff Transmitted by Relays",
        "url": "https://nostr.org/"
      },
      {
        "title": "The Case for XMPP - Open Letter to Meta, technical briefing (XSF)",
        "url": "https://xmpp.org/announcements/open-letter-meta-dma/technical-briefing/"
      },
      {
        "title": "XEP-0384: OMEMO Encryption",
        "url": "https://xmpp.org/extensions/xep-0384.html"
      },
      {
        "title": "The XMPP Newsletter March 2026",
        "url": "https://xmpp.org/2026/04/the-xmpp-newsletter-march-2026/"
      },
      {
        "title": "ActivityPub Protocol: Understanding the Fediverse (dasroot)",
        "url": "https://dasroot.net/posts/2026/04/activitypub-fediverse-decentralized-social-networking/"
      },
      {
        "title": "Threads Expands Fediverse Sharing to 100 Regions - Social Media Today",
        "url": "https://www.socialmediatoday.com/news/threads-expands-fediverse-sharing-100-regions/719857/"
      },
      {
        "title": "Digital Markets Act - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Digital_Markets_Act"
      },
      {
        "title": "What the EU's First Digital Markets Act Review Actually Changes - Tech Policy Press",
        "url": "https://www.techpolicy.press/what-the-eus-first-digital-markets-act-review-actually-changes/"
      },
      {
        "title": "Agent Interoperability Protocols 2026: MCP, A2A, ACP and the Path to Convergence - Zylos Research",
        "url": "https://zylos.ai/research/2026-03-26-agent-interoperability-protocols-mcp-a2a-acp-convergence/"
      },
      {
        "title": "AI Agents in 2026: MCP, Memory Limits, and the Interoperability Wall - Conectia",
        "url": "https://conectia.pro/en/blog/ai-agents-mcp-interoperability-wall-2026"
      },
      {
        "title": "Embrace, extend, and extinguish - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Embrace,_extend,_and_extinguish"
      },
      {
        "title": "Slack Review 2026 - TeamHub (switching costs, integrations)",
        "url": "https://teamhub.com/blog/slack-review-2026/"
      },
      {
        "title": "Slack Pricing in 2026: The Real Cost of the Salesforce Ecosystem - BridgeApp",
        "url": "https://bridgeapp.ai/resources/blog/slack-pricing-in-2026-the-real-cost-of-the-salesforce-ecosystem"
      }
    ]
  },
  {
    "topic": "Agent-native chat: AI agents as first-class participants in a shared human+agent control plane (Hermes/Discord patterns, MCP, A2A, AG-UI, agent-addressable threads, forkable context, dispatch-and-report-back, human-in-the-loop), and why a post/thread primitive beats a flat message stream for LLM agents",
    "keyTakeaways": [
      "Agent-native is a distinct architecture, not an AI feature. Builder.io's definition (mid-2026): humans and AI agents operate the SAME product through one shared action model where every capability is defined once and exposed simultaneously as a UI mutation, an agent tool, an HTTP endpoint, a CLI command, and an MCP tool. The five principles are agent-UI parity ('anything the UI can do, the agent can do'), one shared action model, shared state/context, protocol-ready design, and governed execution (agents respect the same permissions, audit trails, and confirmation gates as human users).",
      "There is now a clean three-protocol stack that maps directly onto a chat control plane. MCP = agent-to-tools, A2A = agent-to-agent, AG-UI = agent-to-user. A2A moved to the Linux Foundation (vendor-neutral) and passed 150+ organizations in its first year with native integration in Azure AI Foundry, Amazon Bedrock AgentCore, and Google Cloud. Agents are deliberately 'opaque': they advertise capability via an Agent Card and collaborate over Tasks/Artifacts (JSON-RPC over HTTP + SSE) without revealing internal memory, logic, or tools.",
      "Hermes (Nous Research, ~193k GitHub stars since Feb 2026) is the clearest 'agent-in-Discord as a first-class participant' implementation: a single agent that lives across 16+ messaging platforms (Discord, Telegram, Slack, Signal, WhatsApp, CLI) from one gateway, with a browser control plane (session browser, cron manager, API-key governance, live log viewer) and per-action approval modes ask/yolo/deny framed explicitly as a governance decision a non-developer can audit.",
      "'Dispatch a sub-agent to explore then report back' is now a shipped, named tool pattern. Hermes async subagents (June 15-16 2026): delegate_task_async returns a task_id immediately, check_task polls non-blocking, steer_task injects messages mid-flight, collect_task blocks only when you want results, plus cancel_task / list_tasks. Each child runs in an isolated conversation/terminal/toolset and ONLY its final summary returns to the parent, keeping the parent context small. Claude Code and OpenCode mirror this with @-mention subagent dispatch, separate context windows, and scoped tool permissions.",
      "Treating a flat chat transcript as the runtime is the core failure mode for multi-agent systems. When the transcript is the source of truth, concurrency becomes guesswork (no structured way to know what another agent has claimed), failure handling degrades to 're-prompting and hoping,' and replay is impossible. The fix is an engine-owned structured layer: blackboards (shared execution map), workboards (per-task ownership/dependencies/decisions/retries/artifacts), and claims/leases so one agent owns a task until its lease expires.",
      "A post/thread is an addressable, forkable object; a flat message stream is not. Conversation Tree Architecture research (2026) shows flat unbounded context causes 'logical context poisoning' as distinct topics bleed together and degrade quality, while a tree of context-isolated nodes (each with its own local window and parent/child flow rules) gives focused local context and selective propagation. A thread has a stable id an agent can target, claim, fork a sub-investigation from, and post a structured result back into.",
      "Privacy-preserving AI-in-chat has a 2026 precedent that fits a private-first product: Confer (Moxie Marlinspike, Jan 2026) keeps AI chat end-to-end encrypted by running inference inside a TEE (confidential VM) reached over Noise pipes so the host never sees plaintext, plus remote attestation and reproducible builds so the client cryptographically verifies which model code is running. This is the template for adding an agent to an E2EE app without breaking the encryption promise."
    ],
    "relevantPrimitives": [
      "Agent Card (A2A): a JSON capability document an agent publishes so peers can discover what it does, how to call it, and its I/O types, before any task starts.",
      "Task + Artifact (A2A): long-lived, addressable units of delegated work that produce verifiable outputs, replacing free-text 'do this for me' messages.",
      "MCP Tools / Resources / Prompts + Elicitation: a server exposes callable tools and data; Elicitation pauses to request explicit human confirmation mid-task (the canonical human-in-the-loop gate). Note: MCP Sampling was deprecated as of protocol revision 2026-07-28 (SEP-2577), so do not build new flows on it.",
      "AG-UI events: an event-based agent-to-user protocol that streams partial output, syncs shared state, renders UI components, and emits approval-gate events to keep a human in the loop.",
      "Async subagent toolset (Hermes): delegate_task_async, check_task, steer_task, collect_task, cancel_task, list_tasks. The minimal vocabulary for non-blocking dispatch-and-report-back inside a live chat.",
      "@-mention dispatch (Slack Agentforce, Claude Code, OpenCode): an agent is addressed in a channel/thread exactly like a human teammate; the mention selects which agent runs, not the prompt it receives.",
      "Blackboard / Workboard / claims+leases: engine-owned structured task state that agents coordinate AGAINST instead of negotiating through chat messages, enabling safe parallelism and replay.",
      "Thread/node context isolation (Conversation Tree Architecture): each thread carries its own bounded local context with explicit parent->child and child->parent flow rules, preventing cross-topic context poisoning.",
      "Approval modes ask / yolo / deny (Hermes control plane): a per-action autonomy setting surfaced in a UI a non-developer can audit, treated as governance, not config.",
      "TEE + remote attestation + Noise channel (Confer): the cryptographic primitive set that lets an AI participate in an E2EE conversation while the client verifies the exact model code and the host never sees plaintext."
    ],
    "whatToBorrow": [
      "Model the agent as a real device participant, not a bot endpoint. Give each agent its own Ed25519/DH identity, fingerprint, and friend code via @mylife/sync, so it joins a community/channel exactly like a human node and every message it posts is signed and TOFU-pinned. This is already how Meerkat treats devices; an agent is just another keyed node.",
      "Make the channel/thread the addressable unit an agent operates on. Meerkat already has cm_messages signed channel events and a per-channel id; lean into thread/post addressing so an agent can be told 'work on cm_thread X' and post a structured result event back, rather than parsing a flat scrollback.",
      "Adopt the dispatch-and-report-back subagent vocabulary (delegate_async -> task_id -> poll/steer -> collect, child isolated, only summary returns). Map it onto a channel: a human posts or @mentions, the agent forks a sub-investigation off that sub-comment, and posts one signed summary cm_message back into the thread when done. The async, non-blocking shape matches Meerkat's manual-session + mailbox-drain reality (work can complete while the chat moves on).",
      "Make every agent action pass through the same governed-execution gate as a human (one shared action model). Reuse Meerkat's existing fail-closed posture: an agent action is just a signed event that must verify against the actor's key and respect maxScope; add an explicit ask/approve gate (AG-UI/Elicitation-style) before any action that writes shared state or sends to a peer.",
      "Treat structured thread state as engine-owned, not transcript-derived. Borrow blackboard/workboard/claims-leases: a lightweight per-thread task record (status, owner, lease, artifacts) the agent claims, so two devices/agents in the same community don't double-work the same request. This rides on the existing sync engine rather than inventing a new channel.",
      "Use the three-layer protocol mental model to scope work cleanly: MCP for what tools an agent may call locally on its node, A2A-style opaque Agent Cards for agent-to-agent capability discovery across the mesh (without leaking internal state, which matches A2A's opacity and Meerkat's metadata-privacy goals), and an AG-UI-style approval/stream event for the human-in-the-loop surface in the app.",
      "For the AI-in-an-E2EE-chat problem, follow Confer's pattern: prefer on-device/local inference so plaintext never leaves the node; where a heavier model is unavoidable, require attested TEE inference with client-verifiable measurements so adding an agent never silently downgrades the end-to-end encryption guarantee."
    ],
    "whatToAvoid": [
      "Do not let an agent read or act on a flat, unbounded message stream as its source of truth. That causes logical context poisoning and makes concurrency, replay, and 'who is doing what' unanswerable. Scope agents to a thread/node with bounded local context.",
      "Do not bolt the agent on as an out-of-band bot with side-channel access to the database or to peers. Agent-native means the agent uses the SAME signed-event actions and the SAME permission/scope boundaries as a human node; a privileged side channel breaks both the security model and auditability.",
      "Do not fake agent presence or progress. Consistent with Meerkat's transport-honesty rule, never show 'agent is working,' a peer count, or a delivered/seen state for a remote agent unless a real signed protocol row says so. Async subagent status must come from actual task records, not optimistic UI.",
      "Do not give agents blanket autonomy. Hermes ships ask/yolo/deny precisely because unmanaged autonomy across several agent-native surfaces 'becomes chaos.' Default sensitive or peer-sending actions to an explicit human approval gate.",
      "Do not route plaintext through a remote model to get AI features. That silently converts an E2EE app into a policy-trust app (only ~7 of 15 major AI chat platforms even offer E2EE in 2026). If you must use a server model, require attestation; otherwise keep inference on-device.",
      "Do not build new flows on MCP Sampling (deprecated in the 2026-07-28 revision). Use Elicitation / explicit tool calls and an AG-UI-style approval event for human-in-the-loop instead.",
      "Do not invent a parallel agent-messaging path outside the existing sync substrate. Meerkat already mandates extending @mylife/sync rather than parallel-wiring; agent events should be signed cm_/sync_ rows on the same engine, capped by maxScope, not a new unencrypted transport."
    ],
    "meerkatImplications": [
      "Agents fit Meerkat's node model cleanly: an agent is a keyed participant (own identity/fingerprint/friend code from @mylife/sync) that joins a community and posts signed cm_messages. This preserves end-to-end encryption, TOFU pinning, and the fail-closed inbound enforcement already in MK-002/MK-044 with no new trust assumptions.",
      "Channels are already the right primitive. cm_messages are per-channel signed events with a stable channel id, so 'address an agent to a thread, dispatch it to explore a sub-comment, have it report back' maps onto: @mention or post -> agent forks a sub-task -> posts one signed summary event into that channel. Add a thread/reply id to cm_messages if not present so sub-comments are individually addressable.",
      "The async dispatch-and-report-back shape matches Meerkat's manual-session + mailbox-drain reality. An agent task can be parked and drained via runMailboxDrainJob/runBackgroundSyncOnce: the human doesn't have to stay connected for the agent to finish and deliver its summary, and the existing applied>0 notification path can announce 'agent finished' honestly.",
      "Human-in-the-loop should reuse the existing fail-closed gate. Before an agent action writes shared_workspace state or sends to a peer, require an explicit approve step (ask/yolo/deny equivalent) surfaced in the app; agent actions that fail signature/scope checks are dropped and counted, exactly like today's mailbox path. This keeps the transport-honesty and security invariants intact.",
      "Privacy is the differentiator and the constraint: keep agent inference on-device by default to honor the private-first/mesh promise. If a heavier model is needed, follow Confer's attested-TEE pattern so adding AI never downgrades E2EE. This is a genuine product edge versus centralized agent-chat (Slack Agentforce, ChatGPT workspace agents) that read plaintext server-side.",
      "Cross-node agent collaboration should use A2A-style opacity, not shared internal state. If a peer's agent helps with a task, it advertises a capability (Agent Card analog) and exchanges Task/Artifact-shaped signed events, never internal memory or logs, which aligns with Meerkat's metadata-privacy goal (relay sees only sizes/timing) and the per-entity maxScope caps.",
      "Avoid a parallel agent transport: agent events ride the existing engine as signed sync_/cm_ rows capped by maxScope. cm_read_state must stay personal_replica (never shared), and any agent task/lease record needs an explicit scope so it cannot escalate, consistent with the mesh-sync per-entity scope rule.",
      "Honest UI copy still governs: show only real, recorded agent activity (task rows, applied counts, signed summaries). Never display a synthetic 'agent connected to the mesh,' an invented peer/agent count, or a delivered/seen indicator for a remote agent without a protocol row backing it."
    ],
    "sources": [
      {
        "title": "Agent-Native: The Next Architecture for Software (Builder.io)",
        "url": "https://www.builder.io/blog/agent-native-architecture"
      },
      {
        "title": "Linux Foundation Launches the Agent2Agent (A2A) Protocol Project",
        "url": "https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents"
      },
      {
        "title": "A2A Protocol Surpasses 150 Organizations, Lands in Major Cloud Platforms (Linux Foundation press)",
        "url": "https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year"
      },
      {
        "title": "Agent2Agent (A2A) Protocol Specification (a2a-protocol.org)",
        "url": "https://a2a-protocol.org/latest/specification/"
      },
      {
        "title": "What Is Agent2Agent (A2A) Protocol? (IBM)",
        "url": "https://www.ibm.com/think/topics/agent2agent-protocol"
      },
      {
        "title": "What Is AG-UI? Why the Agent-User Interaction Protocol Matters in 2026 (Nerova)",
        "url": "https://nerova.ai/guides/what-is-ag-ui-agent-user-interaction-protocol-2026"
      },
      {
        "title": "MCP Concepts: Sampling and Elicitation (Medium, Apr 2026)",
        "url": "https://medium.com/@__nagarajan__/mcp-concepts-sampling-and-elicitation-95c5c0c4df71"
      },
      {
        "title": "Sampling - Model Context Protocol (deprecation note, rev 2026-07-28)",
        "url": "https://modelcontextprotocol.io/specification/draft/client/sampling"
      },
      {
        "title": "Hermes Web Dashboard: The Agent Control Plane Has Arrived (Context Studios)",
        "url": "https://www.contextstudios.ai/blog/hermes-web-dashboard-the-agent-control-plane-has-arrived"
      },
      {
        "title": "Hermes Agent Adds Asynchronous Subagents (MarkTechPost, June 16 2026)",
        "url": "https://www.marktechpost.com/2026/06/16/hermes-agent-adds-asynchronous-subagents-so-delegated-work-no-longer-blocks-the-parent-chat/"
      },
      {
        "title": "Hermes Agent Ships Async Subagents (TechTimes, June 17 2026)",
        "url": "https://www.techtimes.com/articles/318549/20260617/hermes-agent-ships-async-subagents-delegated-work-no-longer-blocks-chat.htm"
      },
      {
        "title": "Create custom subagents (Claude Code Docs)",
        "url": "https://code.claude.com/docs/en/sub-agents"
      },
      {
        "title": "Subagents (OpenCode Docs)",
        "url": "https://opencode.ai/docs/agents/"
      },
      {
        "title": "Most AI Agent Frameworks Treat Chat as a Runtime. That's the Problem (DEV)",
        "url": "https://dev.to/tacshade/most-ai-agent-frameworks-treat-chat-as-a-runtime-thats-the-problem-1do"
      },
      {
        "title": "Conversation Tree Architecture: A Structured Framework for Context-Aware Multi-Branch LLM Conversations (arXiv)",
        "url": "https://arxiv.org/html/2603.21278v1"
      },
      {
        "title": "Durable Streams: The data primitive for the agent loop (GitHub)",
        "url": "https://github.com/durable-streams/durable-streams"
      },
      {
        "title": "An Illustrated Guide to Agentforce for Slack Developers",
        "url": "https://slack.dev/an-illustrated-guide-to-agentforce-for-slack-developers/"
      },
      {
        "title": "Agentforce 2.0 in Slack: agents @mentioned in channels, DMs, threads with human-in-the-loop controls",
        "url": "https://slack.com/ai-agents"
      },
      {
        "title": "Confer: Private inference (Confer blog, Jan 2026)",
        "url": "https://confer.to/blog/2026/01/private-inference/"
      },
      {
        "title": "Signal's Founder Turns His Attention to AI's Privacy Problem (Gizmodo, on Confer)",
        "url": "https://gizmodo.com/signals-founder-turns-his-attention-to-ais-privacy-problem-2000709897"
      },
      {
        "title": "2026 AI Chat Privacy Report: How 15 Leading Platforms Handle Your Data (Anuma)",
        "url": "https://www.anuma.ai/blog/2026-ai-chat-privacy-report"
      }
    ]
  },
  {
    "topic": "Feed prioritization, recency vs salience ranking, and \"what needs my attention\" attention-inbox primitives for work communication (and what they mean for a private-first, E2EE, mesh/relay, agents-first team app)",
    "keyTakeaways": [
      "The dominant 2026 shift is from a FEED that flows past you to an INBOX that waits for you. Slack explicitly reframed notifications this way: the new Activity hub 'waits for you, lets you process it on your terms' instead of being a stream you fall behind on. The unread-channel dot is being abandoned as the primary attention model.",
      "There are three distinct ordering philosophies, and they are not interchangeable: (a) RECENCY / activity-bump (last-message-wins, the Slack/Teams channel list), (b) SUBSCRIPTION-based attention (Linear Inbox: you only see issues you created, were assigned, were mentioned in, or subscribed to), and (c) SALIENCE RANKING (Gmail Priority Inbox: a per-user ML model ranks by probability you will act). A good 'help me read' surface usually layers subscription + salience, and treats raw recency as a fallback view, not the default.",
      "Activity-bump ordering (sort by last activity) is a recognized anti-pattern for prioritization: it bumps stale or low-value threads to the top whenever anyone posts, and buries threads with unread messages whose first message is already read. The fixes teams converge on are unread-AWARE sorting (any unread message floats the thread) and unread SEPARATORS (a 'new since you left' line) rather than pure reordering.",
      "Linear's model is the cleanest 'attention as a task system': notifications are subscription states you must explicitly clear. Snooze returns an item at a chosen time OR on new activity (whichever first); reminders are separate (they surface at the top of the issue without hiding it); Triage is a true QUEUE with Accept / Decline / Mark-Duplicate / Snooze, on-call rotation routing, and LLM 'Triage Intelligence' that suggests assignee/labels and surfaces likely duplicates.",
      "Gmail Priority Inbox is the canonical salience engine: a per-user statistical model that ranks mail 'by how likely the user is to act on that mail,' trained continuously on what you open, reply to, archive, or ignore. Crucially, Google states direct user input (mark important / not important) is the single strongest signal, the system is a feedback loop, and it exposes an 'Important and unread' section rather than a raw chronological list.",
      "Generic AI 'what you missed' digests are contested, not proven. Discord LAUNCHED ICYMI (a cross-server recap of missed messages, announcements, status changes, and AI conversation summaries) in Oct 2024 and KILLED it in April 2026, saying only that it 'helped us better understand how people want to stay connected.' That is a real negative result: a broad, always-on, algorithmic recap surface underperformed.",
      "But STRUCTURED, decision-time digests do win for high-volume readers. Async-standup tooling research (2026) found the best pattern is layered: 'collect via feeds, then condense high-value items into one decision-time brief,' and that a digest layer 'routinely outperforms pure inbox triage.' The differentiator that actually saves time is QUERYABILITY: being able to ask 'what is the current state of X' and get a sourced answer instead of scrolling a channel.",
      "Twist's thesis is that prioritization is a culture problem encoded in UI: persistent thread titles (so a topic has an address and a lifecycle), removal of presence/'online' indicators (which removes the implicit demand for an instant reply), and snooze-everything controls. Reducing the EXPECTATION of real-time response is itself a prioritization mechanism, separate from any ranking algorithm.",
      "The cognitive cost is measurable and argues for ruthless filtering, not smarter buzzing. 2026 HCI research finds a notification disrupts cognition for ~7 seconds driven by perceptual salience + relevance appraisal, that notification VOLUME (not just screen time) drives the damage, and that a healthy signal-to-noise target is >30% of alerts being actionable. The product job is to RAISE the bar for what interrupts, not to deliver more.",
      "Hey (email) shows the value of routing inbound into distinct surfaces with different read-contracts: Imbox (must-read, allowlisted senders), The Feed (ambient newsletters, scroll-and-skim), and Paper Trail (receipts/transactional). A 'Screener' forces an explicit allow decision on every new sender. The lesson is that not all messages deserve the same surface, and the user (or a screener) should classify the channel, not just the message."
    ],
    "relevantPrimitives": [
      "Subscription-based notification (Linear): something reaches you only via an explicit relationship - you created it, you were assigned, you were @mentioned, or you subscribed. Unsubscribe (Shift+S) is a first-class verb. This bounds the attention surface BEFORE any ranking happens.",
      "Snooze-with-wake-on-activity (Linear): hide an item until time T OR until it changes, whichever comes first. Distinct from a plain reminder, which surfaces context without hiding it.",
      "Triage queue with terminal actions (Linear): Accept / Decline / Mark-Duplicate / Snooze, plus rule-based routing on entry and on-call rotation so 'whose attention' is an assignable, schedulable property, not an ambient hope.",
      "Per-user salience model trained on actions (Gmail Priority Inbox): rank by P(act) using open/reply/archive/ignore signals; treat explicit user 'important / not important' as the highest-weight feature; expose an 'important and unread' cut.",
      "Saved views / filtered facets (Slack Activity): persistent, named filters by type (mention, DM, thread reply, reaction, app), by channel, or by section, plus dense-vs-detailed layout toggles and full keyboard triage (work the whole queue without the mouse).",
      "Bulk triage operations: mark-all-read, bulk-clear, clear-all-read - treating the inbox as a workable batch, not a one-at-a-time stream.",
      "Unread-aware ordering + unread separator: float any thread with ANY unread message; draw a 'new since you were last here' line rather than silently reordering.",
      "Routing-into-surfaces with read-contracts (Hey): split inbound into Must-read / Ambient-feed / Transactional, with a sender Screener (allowlist) deciding which surface a source lands in.",
      "Decision-time digest (async standups): a layered model that collects via feeds then condenses high-value items into a single brief, plus a queryable state surface ('ask, get a sourced answer').",
      "Save-for-later / remind-me-on-a-message (Slack Later): defer an item out of the live surface into a personal follow-up list with optional reminder time - a per-user, non-broadcast triage action."
    ],
    "whatToBorrow": [
      "Make the default surface an INBOX that waits, not a feed that flows. Items appear because they need YOU (mention, assignment, reply to your thread, subscription), and you clear them explicitly. This is the single highest-leverage idea and it maps cleanly onto a private node that already knows who you are.",
      "Adopt subscription semantics as the attention boundary: @mention, assignment, 'I posted here', and explicit subscribe are the only paths to your inbox; Unsubscribe is a one-keystroke verb. This bounds the problem before any ranking, which matters even more when ranking must run on-device.",
      "Ship Linear-style snooze (return at time T or on new activity) and a separate reminder, plus a save-for-later list. These are per-user, local-only triage states - perfect for a personal_replica scope that never has to leave the device.",
      "Give every interrupt a terminal action: a message/thread/agent-task in the attention surface should be clearable via Accept/Done, Decline/Dismiss, Snooze, or Convert-to-task. Avoid the dead-end 'read but still nagging' state that the unread dot creates.",
      "Provide saved/filtered views and bulk triage from day one (filter by mention vs channel vs agent-output; dense layout; mark-all-read; full keyboard control). This is cheap to build and is exactly what beats the unread-channel dot.",
      "Use unread-aware sorting with an unread separator instead of last-activity bump. Any unread floats the thread; draw a 'new since you left' line; offer raw recency only as a secondary view.",
      "Run salience ranking and digests LOCALLY using on-device action signals (what you open, reply to, react to, snooze, dismiss). Gmail proves user actions are the best training signal, and because Meerkat is E2EE with a content-blind relay, client-side ranking is not a compromise - it is the only place ranking can legally happen.",
      "Build a STRUCTURED, on-demand, decision-time digest (Twist/async-standup pattern) rather than an always-on algorithmic recap: 'here is what changed in workspaces you care about since you were last active,' generated by a local agent, with each line linked to its source for queryability. Make it pull, not push.",
      "Treat reducing response-EXPECTATION as a feature (Twist): persistent thread titles so topics have an address; no global 'online' presence broadcast by default (which also helps metadata privacy); per-workspace and per-thread mute/snooze. Less pressure is a prioritization mechanism, not just a wellness nicety."
    ],
    "whatToAvoid": [
      "Do not make last-activity (activity-bump) the default sort for the primary attention surface. It bumps stale threads on any reply and buries unread threads whose first line is already read. It is a documented anti-pattern; use it only as an opt-in 'recent activity' view.",
      "Do not ship a broad, always-on, algorithmic 'what you missed' recap as a headline feature. Discord launched exactly that (ICYMI) and retired it in ~18 months. Generic cross-context AI recap underperformed; prefer structured, scoped, pull-based, source-linked digests instead.",
      "Do not lean on the unread dot / unread count as the prioritization model. The whole industry is explicitly moving away from it (Slack rebuilt around Activity; Linear uses subscription + triage). An unread count tells you there is noise, not what needs you.",
      "Do not interrupt to feel responsive. ~7s of cognitive disruption per notification, and volume (not screen time) drives the harm; aim for >30% of pushes being actionable. Default to digesting/quiet-collecting and reserve real interrupts for true must-acts.",
      "Do not assume server-side ranking or summarization is available - in an E2EE, content-blind-relay design the server cannot read content, so any ranking/digest that depends on reading message bodies on a server is architecturally impossible. Design for on-device only.",
      "Do not sync personal attention state (read position, snooze, importance flags, salience model) as shared data. It is per-device/personal and leaks attention patterns; keep it in personal_replica scope and never on a shared session.",
      "Do not let agent output flood the same lane as human messages. First-class agents will generate high volume; without their own filterable type/section and their own digest treatment they will recreate notification fatigue and drown the human signal.",
      "Do not fake a 'caught up' or 'X unread across the mesh' status. (Already a hard rule for Meerkat transport copy.) The same honesty applies to attention surfaces: every count or 'needs attention' signal must come from real local state, not an optimistic estimate of what peers parked for you."
    ],
    "meerkatImplications": [
      "Salience belongs on the device, and that is a feature, not a constraint. Because the relay is content-blind (sees only sizes and timing) and payloads are E2EE, ALL ranking, importance scoring, and digesting must run client-side on local action signals. Gmail-style 'rank by P(I act), trained on my behavior' is directly portable to an ExpoNodeStore-backed local model that no server ever sees.",
      "Per-entity maxScope already encodes a salience tier. device_local / personal_replica / shared_workspace / published_blob is effectively a priority ladder: shared_workspace channel messages and direct @mentions are high-salience interrupts; published_blob announcements are ambient (Hey 'Feed'); personal_replica is your own bookkeeping. The attention inbox can read scope as a first ranking signal for free.",
      "cm_read_state (HLC per channel, personal_replica, explicitly never sent on a shared session) is the correct and existing primitive for per-device attention state. Snooze flags, importance marks, save-for-later, and the local salience model should live in the same personal-replica lane and inherit its no-sync guarantee.",
      "Agents must be a first-class, separately-filterable notification TYPE with their own digest. Build the Slack-Activity 'saved views by type' so a user can split human mention / channel message / agent result / agent-needs-approval. An agent's natural role here is to run the LOCAL salience pass and produce the decision-time digest ('what changed in your workspaces since you were last on'), since it can read plaintext on-device that the relay cannot.",
      "Subscription + Triage maps onto mesh delivery honestly. A message reaches your inbox only via mention/assignment/subscription, and the background mailbox drain already only opens envelopes that verify for THIS device (fail-closed). So 'what needs my attention' is exactly the set of verified, decrypted, subscribed events the node actually holds - no faked peer state, fully consistent with the transport-honesty boundary.",
      "Build inbox/triage as the read-side companion to channels. Today communities.tsx + channel chat is the SEND side; the missing READ side is a cross-workspace attention inbox (mentions, replies-to-me, agent results, unread-aware threads) with snooze, save-for-later, bulk mark-read, saved views, and an on-demand local digest. New mk_/cm_ personal-replica tables (e.g. mk_attention / extend cm_read_state) hold snooze, importance, and last-read, all no-sync.",
      "Reduce response-expectation as a privacy AND attention win. Not broadcasting global presence (Twist's no-'online') simultaneously lowers reply pressure and reduces metadata the relay/peers could correlate - it aligns the prioritization goal with Meerkat's metadata-privacy goal. Per-workspace mute/snooze and quiet-collect-by-default fit the mesh's intermittent connectivity, where 'real-time' is already not guaranteed.",
      "Digests should be PULL and source-linked, not an always-on push recap (learn from Discord ICYMI's retirement). A local agent assembles 'here is what changed' on open, each line deep-linking to the real pinned event/channel message; the data-only-push path stays reserved for actually enqueuing a drain, and a 'message received' notification still fires ONLY after a real applied>0 count, preserving the existing honesty rule."
    ],
    "sources": [
      {
        "title": "Slack Activity: The Triage Approach to Notification Overload",
        "url": "https://slack.com/blog/news/slack-activity-triage-for-notifications"
      },
      {
        "title": "Get your work done from the Activity view (Slack Help)",
        "url": "https://slack.com/help/articles/19693583638803-Triage-notifications-in-the-Activity-tab"
      },
      {
        "title": "Linear Docs - Inbox",
        "url": "https://linear.app/docs/inbox"
      },
      {
        "title": "Linear Docs - Triage",
        "url": "https://linear.app/docs/triage"
      },
      {
        "title": "Linear Changelog - Auto-apply triage suggestions (Product Intelligence)",
        "url": "https://linear.app/changelog/2025-09-19-auto-apply-triage-suggestions"
      },
      {
        "title": "The Learning Behind Gmail Priority Inbox (Aberdeen, Pacovsky, Slater - Google Research)",
        "url": "https://research.google.com/pubs/archive/36955.pdf"
      },
      {
        "title": "Gmail AI Inbox 2026: How Smart Prioritization Actually Works",
        "url": "https://www.getmailbird.com/gmail-ai-inbox-prioritization-vs-desktop-clients/"
      },
      {
        "title": "Why We're Betting Against Real-Time Team Messaging Apps Like Slack (Twist / Doist)",
        "url": "https://async.twist.com/betting-against-slack/"
      },
      {
        "title": "Doist redesigns Twist, the Slack alternative focused on async work (TechCrunch)",
        "url": "https://techcrunch.com/2021/10/12/doist-redesigns-twist-the-slack-alternative-focused-on-async-work/"
      },
      {
        "title": "Discord ends ICYMI feature used for missed messages and updates (Dexerto)",
        "url": "https://www.dexerto.com/entertainment/discord-ends-icymi-feature-used-for-missed-messages-and-updates-3351095/"
      },
      {
        "title": "ICYMI (In Case You Missed It) - No Longer Available After April 13, 2026 (Discord Support)",
        "url": "https://support.discord.com/hc/en-us/articles/25667810266775-ICYMI-In-Case-You-Missed-It-No-Longer-Available-After-April-13-2026"
      },
      {
        "title": "First Impressions of Hey (Imbox / Feed / Paper Trail / Screener)",
        "url": "https://mariusmasalar.me/first-impressions-of-hey"
      },
      {
        "title": "Basecamp launches Hey, a hosted email service for neat freaks (TechCrunch)",
        "url": "https://techcrunch.com/2020/06/16/basecamp-launches-hey-a-hosted-email-service-for-neat-freaks/"
      },
      {
        "title": "11 Best Async Standup Tools & Software for Dev Teams (2026) - digest vs inbox triage, queryability",
        "url": "https://gitmore.io/blog/best-async-standup-tools"
      },
      {
        "title": "Attention hijacked: How notifications disrupt cognitive processing (ScienceDirect, 2026)",
        "url": "https://www.sciencedirect.com/science/article/pii/S0747563226000233"
      },
      {
        "title": "Alert fatigue solutions for DevOps teams in 2025 (signal-to-noise KPI) - incident.io",
        "url": "https://incident.io/blog/alert-fatigue-solutions-for-dev-ops-teams-in-2025-what-works"
      },
      {
        "title": "UX: update chat channel sorting to include unread threads (Discourse PR #29617)",
        "url": "https://github.com/discourse/discourse/pull/29617"
      }
    ]
  }
]
```


## Adversarial completeness critique

```json
{
  "missingFeatures": [
    {
      "title": "True inline reply IS spec'd, but reply-to-two-people-without-clogging-the-thread is asserted, never designed at the render/collapse layer",
      "why": "The founder's exact ask is structural: a top-level comment gets two divergent replies and you answer each individually WITHOUT clogging the main thread. The spec hits the storage half (parent_id points at any message id) but the 'without clogging' half is the actual product problem, and it is hand-waved into one sentence: 'the renderer collapses beyond a configurable depth into view N more replies with an indent cap.' There is no design for HOW two parallel sub-threads render side by side, how you visually distinguish 'reply to the comment' vs 'reply to person A's take vs person B's take,' or how the collapse avoids re-creating the exact flat-thread clog it claims to solve. Workplace solved legibility with BOUNDED two-level nesting; the spec chose infinite nesting and then owes a real legibility design it never pays.",
      "mapping": "A4/A6 claim infinite parent_id + collapse UI but the matrix maps pp-no-infinite-nesting to 'A4, A6' with zero treatment of the divergent-takes render contract; needs a dedicated sub-thread/branch rendering spec, not a depth cap"
    },
    {
      "title": "The bump mechanic's interaction with the attention-inbox anti-pattern is acknowledged (B3) but the founder's literal demand ('threads should reply like Facebook') is quietly down-ranked",
      "why": "The founder singles out bumping as THE most important missing mechanic ('why the fuck do not threads reply like that'). The spec correctly ships B1 action-bumping, but then B3 immediately argues pure bump is itself an anti-pattern and floats unread-first sorting as the real default. That is good product instinct from the research, but it is a SILENT reversal of the founder's stated north star (every reply bumps to top). The spec never surfaces this as a decision-for-the-founder: 'you asked for Facebook bumping; the research says pure recency-bump buries unread; here is the trade.' An adversarial founder reading this will feel his headline mechanic got hedged without his consent.",
      "mapping": "B1 vs B3 internal tension; matrix maps pp-no-bumping to B1/B2/E4 but B3 changes the default ordering away from pure bump without flagging it as a founder decision"
    },
    {
      "title": "Open-standard EROSION PLAYBOOK is present as a feature list (F1-F8) but the actual 'erosion via interop' sequencing/mechanics are thin where it matters most",
      "why": "The research is emphatic that bridges bootstrap erosion but API-bridges don't scale and let incumbents openwash, and that the wedge is 'one Meerkat user joins an existing team's conversation with zero migration.' The spec lists a Matrix bridge (F4, XL) and says 'start narrow,' but never specifies the single concrete erosion entry experience: what does a Meerkat user actually DO on day one to sit in a colleague's Slack/Matrix room. F4 is XL and 'gates nothing,' which means the erosion strategy is effectively deferred indefinitely while the post/bump/agent core ships. The strategic thesis (erode Slack) and the roadmap (interop is Phase 8, last) are in direct tension and the spec doesn't reconcile it.",
      "mapping": "F-theme + thesis; Phase 8 sequencing buries the erosion wedge behind 7 phases despite the thesis claiming erosion is the whole point"
    },
    {
      "title": "Multi-company connection LOCK-IN EQUIVALENT is mapped to substrate that exists, but the lock-in MECHANISM (why users can't leave) is never designed",
      "why": "The founder keeps Slack ONLY because of cross-company connection; it is the lock-in that beats every competitor. The spec's answer (G1/G2: 'two nodes with their own keys, federation by default, no lock-in') correctly inverts Slack's model but misses the strategic point: Slack's cross-company connection is STICKY precisely because it's a two-sided network. 'No lock-in' is a privacy virtue but a GROWTH liability. The spec markets 'federation by default, no lock-in' without answering: what makes a second company join and STAY? There is no equivalent stickiness mechanic (no shared durable artifact both sides depend on, no reason the counterparty can't just leave). The founder's actual need is to REPLICATE the pull of cross-company connection, not just to avoid its lock-in.",
      "mapping": "G2 + d-cross-company-connection; spec refutes Slack's lock-in but provides no replacement adoption/retention flywheel for two-sided cross-org use"
    },
    {
      "title": "Agent fork-a-subcomment-and-report (E4) is well-grounded but the 'fork CONTEXT cheaply' requirement is under-specified vs the Conversation-Tree research",
      "why": "The founder wants to 'take a sub-comment and send an agent to go explore it.' The research is explicit that flat-transcript-as-runtime is the core failure and that the agent needs a context-ISOLATED node (Conversation Tree Architecture) plus engine-owned task state (blackboard/workboard/claims-leases) so concurrency and replay work. The spec maps E4 to Hermes delegate_async vocabulary and 'one signed agent_result event,' but never specifies what CONTEXT the agent forks with (just the sub-comment? the whole post tree? the channel?), how isolation is enforced, or where the workboard/claims-lease lives. Without that, 'fork a sub-comment' degrades to 'pass one message body to an LLM,' which is exactly the thin integration the founder is fleeing.",
      "mapping": "E4 + agentRequirements 'forking context must be cheap'; spec has the dispatch verb but not the context-fork boundary or engine-owned task state the research demands"
    },
    {
      "title": "Prioritization/reading/status (the read side) is comprehensive on paper but the founder's framing 'built for sending not reading' is not validated against Meerkat's honesty/transport reality",
      "why": "C1 cross-workspace attention inbox is the differentiator and is correctly placed client-side. But it is rated XL and lands in Phase 4, AFTER posts/bump/reactions. The founder's pain is that the product helps him READ and PRIORITIZE; shipping the read side fourth means the early app is still a send/post tool. More critically, the inbox depends on mentions (Phase 3) and on cross-community aggregation that only works for content the node actually holds via manual sessions/mailbox drain. In a manual-session world with no auto-dial, 'what needs me across all workspaces' is only as complete as your last manual sync, and the spec's honesty note admits this but doesn't grapple with how degraded the read experience is until background/auto-dial exists.",
      "mapping": "C1-C6 + pp-slack-only-sends; the read side is real but sequenced late and its completeness is gated by the unbuilt auto-dial, which undercuts the core differentiator early"
    }
  ],
  "weakMappings": [
    {
      "feature": "I1 post permalinks 'extend buildShareLink/buildMagnetLink to a post permalink anchored to a signed message id'",
      "issue": "buildShareLink is hard-wired to createSealedShare: it takes {contentId, linkKey} where contentId is a sealed-blob manifest id and linkKey decrypts that blob (verified in node/direct-client.ts and node/share-link.ts). A cm_messages event is NOT a sealed share and has no linkKey. You cannot 'extend' buildShareLink to address a channel post without either sealing every post as a blob (defeats the replicated cm_ model) or building a brand-new addressing scheme. The Zulip 'with operator' insight is sound, but the substrate mapping is wrong: this is net-new addressing, not an extension.",
      "fix": "Drop the buildShareLink framing. Spec a new community/post deep-link format (communityId + channelId + postId + epoch-key reference) that resolves via the existing community refresh/verify-then-apply path, NOT via fetchAndPinFromHosts (which is for sealed blobs). Be explicit that opening it requires community membership/epoch key, unlike a sealed share link which is self-decrypting."
    },
    {
      "feature": "cm_posts policy: 'LWW on header fields, OR-set on tags' in a single replicated table",
      "issue": "ConflictStrategy is per-TABLE in entityRules (confirmed: 'lww' | 'or_set' | 'counter' | 'document_crdt' | 'manual_review' in module-registry/src/types.ts), not per-column. You cannot declare LWW for title/lifecycle and OR-set for tags on the same cm_posts table. The spec's data-model sketch asserts a mixed strategy the policy model cannot express.",
      "fix": "Either split tags into their own cm_post_tags table with conflictStrategy 'or_set' (header stays 'lww'), or model the whole post header as 'document_crdt'. Given posts are signed append-only header events anyway, the cleaner answer is: the post header is an immutable signed event (no LWW needed); lifecycle/resolve is a separate signed superseding event (like the existing supersedes tombstone); tags are a separate or_set table."
    },
    {
      "feature": "E1/E2 agent identity 'provisions exactly like a device' via a 'headless identity factory' with a 'separate ref'",
      "issue": "The app's identity layer is built around a SINGLE self-identity: mk_identity has PRIMARY KEY DEFAULT 'self' and all helpers hardcode WHERE id = 'self' (db.ts); IdentityProvider generates exactly one DeviceIdentity; configureSyncSecretStore stores one device key. 'An agent provisions exactly like a device' understates that the app currently cannot hold a second identity at all. WorkspaceMemberRole is also 'owner'|'admin'|'member'|'viewer' only (types.ts) with no agent/service value, so 'add an agent value to WorkspaceMemberRole' is a real protocol change to the signed descriptor, not a surfacing tweak.",
      "fix": "Re-scope E1 from XL-additive to 'foundational identity refactor': the single-self mk_identity model and one-key secure-store assumption must become multi-identity before an agent can hold its own key on-device. State plainly that an agent on the same phone is a second local identity in a system that today assumes one. The WorkspaceMemberRole extension is a canonicalDescriptor signature-surface change requiring a descriptor revision and version bump."
    },
    {
      "feature": "A7 'edit/delete posts/comments/replies reuse the existing supersedes model, orthogonal to parent_id'",
      "issue": "Plausible but unproven and slightly optimistic. supersedes today is resolved by resolveChannelMessages which assumes a FLAT list (it builds rootByEventId and a single visibleByRoot map). Once parent_id exists, a superseding edit must preserve the parent edge AND the tree position; resolveChannelMessages does not currently carry parent_id through the supersedes chain. 'Mostly free / S' undersells the resolver rewrite.",
      "fix": "Acknowledge resolveChannelMessages must be rewritten to be tree-aware (it currently flattens). Edit/delete reuse is only free if the superseding event re-declares the same parent_id and the resolver threads supersedes within the tree. Bump A7 from S to M and tie it to the A3/A4 tree-resolver work."
    },
    {
      "feature": "B1 bump 'updates cm_post_activity on every verified child event applied via engine session OR runMailboxDrainJob'",
      "issue": "Correct in principle (mailbox-drain applies verified channel events fail-closed), but the drain dispatcher (mailbox-dispatch.ts) routes by sealed inner-payload 'kind' and the only message kind is 'channel-message' whose handler does verify+merge into cm_messages. Computing a bump means the drain's channel handler (or a post-merge step) must ALSO derive post_id from the merged event and write cm_post_activity. The spec says 'update bumped_at in both apply paths' but doesn't note that the mailbox path applies events deep inside applyChannelEvents/merge, not in app code, so the bump trigger has to live in @mylife/sync, not just in the Meerkat app.",
      "fix": "Specify that the bump derivation lives in the channel-message merge path inside @mylife/sync (so foreground engine session and background drain cannot drift, matching the existing one-dispatcher discipline), with cm_post_activity written as a post-merge derived step. Don't imply it can be bolted on in app-layer ChatProvider only."
    },
    {
      "feature": "E6 'human-in-the-loop gate before an agent writes shared_workspace state, AG-UI/Elicitation-style'",
      "issue": "The gate is described as an app-surfaced approval, but Meerkat's actual enforcement (evaluateInboundChange / maxScope / evaluateChannelPost) runs at APPLY time on every device cryptographically. A UI approval gate on the SENDING node does not stop a misbehaving agent identity from signing and sending; only the descriptor postRoles + scope caps do. The spec gestures at both but conflates a UX confirmation with a cryptographic authorization boundary.",
      "fix": "Separate the two: (1) the real authorization is descriptor postRoles for the agent's role + maxScope caps enforced at apply-time on every peer (cryptographic, can't be bypassed); (2) the AG-UI approval is only a local UX courtesy on the operator's node. Make clear the security comes from (1), and an agent with a shared_workspace-capable role does NOT need (1)'s permission re-checked by (2)."
    }
  ],
  "roadmapFeedback": "The critical-path call (MK-P01 schema to P02 posts/reply to P04 bumping) is right and correctly delivers the founder's core thesis in three plans. Two structural problems. First, the erosion thesis and the phasing contradict each other: the document opens by declaring 'erosion via interop, not migration' as the strategy, then sequences ALL interop (Matrix bridge, Slack import, MLS, MIMI) into Phases 8-9 as 'external-dependent, sequence last.' If erosion is the strategy, a thin Slack/Workplace IMPORT (F7, just an L) is the cheapest possible wedge and should move up next to the core, decoupled from the heavy Matrix bridge and MLS work; institutional-memory import is the one interop slice that needs no live federation, no relay, and no two-sided network, and it directly weaponizes the Workplace 2026-06-01 deletion deadline the thesis leans on. Second, the read side (prioritization/inbox, the founder's stated differentiator) is Phase 4, behind posts, bumping, and reactions. That is defensible dependency ordering (the inbox needs mentions and post structure) but it means the differentiator that distinguishes this from 'yet another forum' is the fourth thing built, and its early completeness is capped by the still-unbuilt auto-dial. Consider a thin Phase-2.5 read slice (per-post unread + a single-workspace 'needs me' view from mentions+replies) so the read story is visible before the full XL cross-workspace inbox. Also: Phase 5 (agents) sits on an identity refactor (multi-identity on one device, agent role in the signed descriptor) that none of the earlier phases pay down, so MK-P09 is the riskiest XL and is mis-scoped as merely additive. Surface that as a foundational dependency, not a Phase-5 surprise. Finally, the honesty boundary is respected throughout (no faked presence, bump from applied rows only, scope caps for personal state) which is genuinely strong; the one place to watch is the attention inbox copy admitting 'X unread across the mesh' is impossible, which the spec handles correctly but which makes the read-side feel weaker in a manual-session world until background drain/auto-dial ship.",
  "openQuestions": [
    "Pure action-bumping (every reply floats the post) is the founder's literal north star, but the research and your own B3 say pure recency-bump buries unread posts whose first line is already read. Which is the DEFAULT feed sort at launch: founder-requested pure bump, or research-backed unread-aware bump? This is a taste call the spec made silently (B3) and should be the founder's.",
    "Infinite nesting vs legibility: you chose infinite parent_id storage with render-time collapse, explicitly rejecting Workplace's proven bounded two-level tree. The founder said 'I want infinite nesting' but his actual goal was 'answer two divergent takes without clogging.' Is infinite depth a hard requirement, or would a bounded tree (which Workplace shipped and he loved) satisfy the real need with far less render complexity?",
    "Cross-company connection is the lock-in that keeps the founder on Slack. Your answer is 'no lock-in, federation by default.' But what makes a SECOND company adopt and stay? Without a sticky shared artifact, 'no lock-in' is a growth liability. What is the two-sided adoption flywheel that replaces Slack Connect's network pull?",
    "Agents hold their own on-device key in a system whose entire identity layer assumes a single 'self' identity (mk_identity PK DEFAULT 'self'). Are agents (a) separate identities running on the user's device, (b) identities on a separate always-on node/server, or (c) the user's own identity acting on their behalf? Each has very different key-custody, trust, and 'who signed this' implications, and the spec implies (a) without confronting the single-identity refactor.",
    "Erosion strategy timing: the thesis says interop is the whole point, but the roadmap defers it to Phase 8-9. Should the cheap, federation-free Slack/Workplace IMPORT (F7) move up to ship alongside the core as the actual day-one wedge (especially given the Workplace 2026-06-01 deletion), decoupled from the heavy Matrix/MLS work?",
    "In a manual-session, no-auto-dial world, the cross-workspace 'what needs me' inbox is only as fresh as the last manual sync. Is the read-side differentiator viable before background drain/auto-dial exist, or does the prioritization story require the deferred background-sync work to actually land first?"
  ],
  "topPriorities": [
    "Re-scope the agent identity work (E1/E2/MK-P09) from 'XL but additive' to a FOUNDATIONAL multi-identity refactor: the app today holds exactly one 'self' identity (mk_identity PK DEFAULT 'self', one secure-store ref, WorkspaceMemberRole has no agent value). Confront how a second on-device identity, an agent role in the signed canonicalDescriptor, and key custody actually work before treating agents as a Phase-5 add-on.",
    "Fix the two concrete substrate mismatches in the data-model sketch: (a) post permalinks cannot 'extend buildShareLink' (that API is sealed-blob + linkKey only) and need a new membership-gated community/post deep-link; (b) 'LWW on header, OR-set on tags' in one cm_posts table is not expressible since ConflictStrategy is per-table; split tags into an or_set table or model lifecycle as a signed superseding event.",
    "Pay the legibility debt on infinite nesting: design the actual render contract for 'two divergent replies to one comment, answered individually, without clogging the thread' (the founder's real ask). A depth cap with 'view N more' is not a design. Decide explicitly between infinite-depth-with-real-branch-UI vs Workplace's bounded two-level tree, and put that decision in front of the founder.",
    "Surface the bump-default decision (pure action-bump vs unread-aware) to the founder rather than silently choosing unread-aware in B3. His headline mechanic is 'every reply bumps to top like Facebook'; the research-driven hedge is good but is a taste call he should own.",
    "Reconcile thesis vs roadmap on erosion: move the federation-free Slack/Workplace IMPORT (F7) up next to the core as the cheapest day-one wedge that exploits the Workplace 2026-06-01 deletion, decoupling it from the heavy Matrix bridge + MLS work that genuinely belongs late."
  ]
}
```
