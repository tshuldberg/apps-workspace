# Meerkat Posts: The Agent-Native, Open-Standard Workplace Successor

**Definitive Feature Specification**
Status: product architecture spec · Surface: Meerkat standalone app + `@mylife/sync` · Date: 2026-06-18

---

## Product thesis & north star

Slack optimized one verb - **send** - and left the other three jobs of work communication (read, prioritize, get status) structurally unbuilt, while burying every conversation in a decaying reverse-chronological stream where a new reply to an active thread sinks instead of rising. Meerkat already ships the hard parts of a better answer: signed, append-only `cm_messages` events, an end-to-end-encrypted sync engine with a content-blind relay (MK-044), an offline mailbox drain, self-sovereign friend-code identity, and per-entity scope caps. This spec turns that substrate into the thing the founder is grieving for: an **open-standard, agent-native team workspace built on POSTS** - a primitive that sits between a channel and a thread, owns its whole comment tree, and **bumps back to the top whenever any participant, human or agent, touches it**. Because every post and comment is a verified event the device already holds, ranking, triage, and status run client-side in a way no centralized competitor can match without reading your content, and an agent is just another keyed node in the same control plane - not a throttled, gatekept bot bolted onto a send-only surface.

> **North star:** *An open-standard, agent-native team chat built on posts (a primitive between channel and thread) where every human or agent reply bumps the post back to the top, so it slowly erodes Slack by helping teams prioritize, read, and get status instead of just sending.*

The strategy is **erosion via interop, not migration**. We bridge into and import from Slack/Workplace/Matrix so one Meerkat user joins an existing team's conversation (or carries a dead team's whole history) with near-zero migration cost, then accrue on the open side the things the incumbent structurally cannot offer - E2EE, no vendor delete-button, mesh/offline durability, agents as first-class members. "The product that integrates with everything becomes harder to remove than the one that integrates with nothing."

**A note on where the strategy and roadmap meet (founder-facing, see Open questions).** The thesis says interop is the whole point, yet the heavy interop work (live Matrix bridge, MLS, MIMI) is genuinely late-stage and external-dependent. The reconciliation in this revision is to split interop into two halves: the **federation-free import wedge** (Slack/Workplace history import, F7) moves up beside the core because it needs no relay, no live federation, and no two-sided network and directly weaponizes the Workplace 2026-06-01 deletion deadline; the **live federation work** (Matrix bridge, MLS, MIMI, DMA) stays sequenced late where its external dependencies actually live. The erosion thesis is therefore honored early by import and durability, not deferred to Phase 8.

---

## Decisions locked (2026-06-18 founder review)

Four of the six open questions are resolved; the build proceeds on these. The remaining three (Q3, Q5, Q6) are not on the MK-P01 critical path.

1. **Bump default - SHIP BOTH, decide live.** Build pure action-bump (the literal Facebook mechanic) AND unread-aware bump as first-class, one-tap-switchable feed sorts (B1–B4). Do not hard-pick a launch default in the spec; choose it from real dogfooding data. Engineering default until that call: **pure action-bump** (the founder's north star).
2. **Nesting - BOUNDED-BRANCH render.** Infinite `parent_id` addressability in data; the default view is two levels + named, independently-collapsible branches per comment (the branch render contract, A4). No raw infinite indent.
3. **Agent key custody - PLUGGABLE; always-on node is OPTIONAL, not default.** Custody is a user-configurable setting, never a forced model. **Default = on-device agent identity** (acts while the device is active). An **always-on node/server agent identity** is a supported, opt-in option (settings/config) for agents that must act while the phone is off - surfaced as a power-user choice with its own trust/hosting disclosure, never the default. The multi-identity foundation (E0 / MK-P10) is required regardless of which custody a user picks, so it must abstract custody behind one identity registry: a per-identity `custody: 'local' | 'remote_node'` with either a local secure-store ref or a remote node reference. This is a framing refinement to E0/E1, not a new phase.
4. **Proceed - write the MK-P01 implementation plan** (post schema + v2 `ChannelMessageEvent` contract). Done this session.

Still open (do NOT block MK-P01): cross-company adoption-flywheel mechanic (Q3), erosion timing import-vs-bridge (Q5), read-side viability before background drain (Q6).

---

## The primitive model

### Why Slack's five atoms are all wrong

The founder is explicit: across *message, reply, thread, channel, company*, "none of these are the right abstraction and users are stuck fighting all of them all of the time." Concretely:

- **The message is the wrong atom.** Slack is built only to send messages; there is no native inline reply, so responding to one message forces you into a thread. (`pp-no-inline-replies`, `pp-slack-only-sends`)
- **The thread is broken.** It falls back into history and stays old even when active, cannot be bumped by new activity, has no inline reply to a single message inside it, and supports no sub-nesting, so parallel takes on one point collapse into one flat thread. (`pp-thread-decay`, `pp-no-bumping`, `pp-no-infinite-nesting`)
- **Channels are the only org primitive** - too coarse, with threads too buried and nothing in between. (`pp-wrong-abstractions`)
- **The company boundary is the one strong piece** (cross-company connection drives lock-in) but it is bolted onto the wrong content model. (`pp-slack-lock-in`, `d-cross-company-connection`)
- **None were designed for agents**, which is why agents have to be brute-forced in. (`pp-agents-brute-forced`)

The Facebook Workplace **post** is the proof of a better atom: it lives between a channel and a thread, bumps to the top on any new activity, owns top-level comments plus nested replies, and is equally easy for humans and agents to interface with. Workplace was "the closest thing to a good context-management product for working with a team on real work" - and Meta killed it (read-only since 2025-09, deletion 2026-06-01), stranding customers (`pp-workplace-shutdown`). That dead product is our strategic wedge.

### The Meerkat primitive set

| Primitive | Definition | Sits between | Maps to |
|---|---|---|---|
| **Workspace / Community** | The org boundary and key domain. Owner-signed `CommunityDescriptor`, unforgeable `communityId`, members with roles, its own epoch key. A user can belong to many. | Above everything | `CommunityDescriptor` (existing) |
| **Channel / Group** | A container and audience/permission boundary inside a workspace ("who receives + who may post"). Placement-as-permission: a post inherits its channel's audience. Channels can be **forum-type** (post-only). | Workspace → Post | `CommunityChannel` in descriptor (existing) |
| **Post** | The core primitive. A durable, addressable anchor object with a **type** (discussion, task, announcement, decision), optional **title/tags**, a body, attachments, an author, and its own comment tree. Created → goes to top of channel feed. **Bumped to top on any verified child activity.** The unit you post work into. | Channel → Comment | **NEW: `cm_posts` (immutable signed header) + `post_id` on `cm_messages`** |
| **Comment (top-level)** | A reply attached directly to a post (`parent_id = post root`). Forms the first nesting level. | Post → Reply | `cm_messages` with `post_id` set, `parent_id = post id` |
| **Reply (nested)** | An inline reply targeting one specific message - a comment *or another reply*, including a single message inside a thread. `parent_id` points at any message id. Enables answering two divergent takes on one comment individually without clogging the main thread. **Render contract is bounded-branch, not raw infinite depth - see the legibility design below.** | Comment → leaf | `cm_messages` with `parent_id` = any message id |
| **Reaction** | A lightweight typed acknowledgement on a post, comment, or reply. Low-noise alternative to a reply; feeds local ranking. | Orthogonal | **NEW: activate dead `cm_reactions` + `ReactionEvent`** |
| **Agent-participant** | A keyed node (its own Ed25519/X25519 identity, fingerprint, friend code) that joins a workspace exactly like a human, signs its own events, can be addressed/@mentioned on a post or comment, dispatched by forking a sub-comment, and whose reply **bumps the post** like any human's. **Requires the multi-identity foundation below - the app holds exactly one `self` identity today.** | Peer to human inside Post/Comment/Reply | **NEW: multi-identity store, `kind` on `CommunityMember`, `agent`/`service` role, `author_kind` + `mentions` on event** |

**How this replaces Slack's mess:** one durable, addressable Post owns its entire reply tree *and* its audience, so a topic stays gathered in one place that re-surfaces on activity - instead of context scattered across scrollback with second-class, decaying threads. The thread is demoted from a competing top-level concept to *the post's reply structure*. Inline reply (any `parent_id`) makes "reply to one message" a first-class verb. Channels gain a real layer above them (workspaces) and a real layer below them (posts). The company boundary (the one good Slack piece) is preserved as the workspace - done privately, with no central org holding your data.

### Nesting & legibility - the branch render contract (was the spec's largest unpaid debt)

The founder's exact ask is structural and the storage half is the easy half: a top-level comment gets two divergent replies and he wants to answer each individually *without clogging the main thread*. "Without clogging" is the real product problem, not "store arbitrary depth." This revision pays that debt explicitly rather than hiding it behind a depth cap.

**Decision: bounded-branch rendering over a tree that stores any depth.** `parent_id` may point at any message id (so an agent or human can always reply to one exact message, and addressability is never lost), but the renderer is governed by an explicit branch model, not a naive indent-per-level cascade:

- **Two render levels by default, matching what Workplace shipped and the founder loved.** Level 0 = the post body. Level 1 = top-level comments. Level 2 = replies *to a specific comment*. This is the legible default. A reply whose `parent_id` is itself a level-2 reply does **not** create a level-3 indent; it is attributed inline ("↳ in reply to @B's take") and rendered inside the same level-2 branch. Depth beyond level 2 is preserved in data and addressable by permalink, but **flattened-with-attribution** in the default view, so divergent takes never produce an accordion of ever-narrowing columns.
- **Branch, not depth, is the unit of divergence.** When one comment receives two divergent replies (the founder's literal scenario), each reply opens a **named branch** under that comment. Branches render as sibling collapsible groups ("2 replies · @A's branch / @B's branch"), each independently expandable, each with its own reply box. Answering @A's take and @B's take happens in two different branch boxes, so the two conversations are visually separated at the same indent level instead of stacking into one flat thread or one runaway indent. This is the concrete answer to "answer two divergent takes without clogging."
- **Quote-anchored reply for cross-branch or deep references.** Replying to a message outside the current branch (or below level 2) renders the verified parent event as a quote block above the reply (A5) and files the reply in the *current* branch, rather than spawning a new indent level. The `parent_id` edge is intact for permalinks and agents; the human view stays two-level.
- **Collapse is per-branch, never per-message.** "View N more in this branch" expands one branch; it never collapses an entire post's tree into one "view N more replies" blob (the exact flat-thread clog the founder is fleeing).
- **CRDT/merge stays tractable** because each event is independently signed and ordered by HLC; an out-of-order reply whose `parent_id` (or whose branch root) hasn't arrived yet is held and grafted on arrival, then placed into its branch.

This is the founder's "infinite nesting" honored as *infinite addressability with bounded, branch-structured legibility* - the founder's actual goal - and it is surfaced as an explicit taste decision in **Open questions** so he can choose pure bounded-two-level vs branch-flattened-deep if he disagrees.

### Data-model sketch (grounded in existing `cm_` tables, with the two substrate mismatches fixed)

These are **`mk_`-app-local chat tables riding the existing sync engine** (registered in `COMMUNITY_SYNC_POLICY`), **NOT a new mesh module policy**. `mk_` device tables (identity/settings/pinned) stay out of the sync prefix map and never replicate, exactly as today.

**1. `ChannelMessageEvent` - extend the signed contract** (`packages/sync/src/protocol/channel-message.ts`). Any new field must be appended to `canonicalChannelMessage()` because the content id + Ed25519 signature cover it; bump to `version: 2` with a v1-compat decoder (new fields decode as `undefined`).

```ts
interface ChannelMessageEvent {
  version: 2;                       // was 1; v1 decodes with new fields = undefined
  id; communityId; channelId; authorDeviceId;
  body; attachments?; hlc; supersedes?;   // unchanged
  // NEW - all optional, all signature-covered:
  postId?:    string;   // root post this event belongs to (the bump target)
  parentId?:  string;   // exact message replied to (post id | comment id | reply id) - addressability
  branchId?:  string;   // the branch this reply files under (defaults to nearest level-1 comment) - render legibility
  authorKind?: 'human' | 'agent';        // provenance of the signer
  mentions?:  string[]; // addressed deviceIds (humans or agents) - drives attention + agent dispatch
  intent?:    'message' | 'react' | 'resolve' | 'agent_task' | 'agent_result';
}
```

**2. `cm_posts` - NEW replicated table, modeled as an IMMUTABLE signed header** (the post anchor). Declared in `COMMUNITY_DDL`, prefix maps in `MEERKAT_SYNC_PREFIXES`. **Substrate fix (critique weakMapping):** `ConflictStrategy` is per-table, not per-column, so the draft's "LWW on header, OR-set on tags in one table" is not expressible. Resolution: the post header is an **immutable signed event** (no LWW needed - identity fields never change), lifecycle/resolve is a **separate signed superseding event** (reuses the existing `supersedes` tombstone discipline), and tags live in their own `or_set` table. `cm_posts` registers with `conflictStrategy: 'lww'` only as a degenerate safety net for the header row that never actually contends.

```
cm_posts (PK id = the root cm_messages event id)   -- shared_workspace, immutable signed header
  id, community_id, channel_id, author_device_id, author_kind,
  post_type ('discussion'|'task'|'announcement'|'decision'),
  title (nullable),
  created_wall, created_counter,         -- original-send HLC (stable identity)
  signature                              -- header is itself a signed event
```

**2b. `cm_post_tags` - NEW replicated table, `conflictStrategy: 'or_set'`** (substrate fix). Tags are add/remove-as-a-set semantics and must be their own table to be expressible in the policy model.

```
cm_post_tags (PK post_id + tag)        -- shared_workspace, or_set
  post_id, community_id, tag, added_by_device_id, added_wall, added_counter
```

**2c. `cm_post_lifecycle` - NEW replicated table fed by signed `resolve` events** (substrate fix). Lifecycle (`open`/`resolved`/`archived` where archive is local-only, see I5) is set by an append-only signed superseding event, not a mutable column, mirroring edit/delete.

```
cm_post_lifecycle (PK post_id)         -- shared_workspace, latest-signed-event wins (deterministic by HLC)
  post_id, community_id, state ('open'|'resolved'), set_by_device_id, set_wall, set_counter, signature
```

**3. `cm_messages` - add columns** via the established `ensureAttachmentsJsonColumn` ALTER-TABLE migration pattern: `post_id`, `parent_id`, `branch_id`, `author_kind`, `mentions_json`, `intent`, plus an index on `(community_id, channel_id, post_id, branch_id, hlc_wall, hlc_counter)` for branch-aware tree assembly. `cm_message_attachments` is unchanged (still mirrors signed `attachments_json`).

**4. `cm_post_activity` - NEW personal_replica table (LOCAL, never replicates).** The bump is computed **locally from verified child events**, never from a remote "this is hot" claim - this keeps the transport-honesty boundary intact.

```
cm_post_activity (PK = post_id)        -- scope personal_replica, maxScope personal_replica
  post_id, community_id, channel_id,
  bumped_at_wall, bumped_at_counter,   -- max HLC of any verified child applied locally
  reply_count, last_author_device_id,  -- derived counters, local only
  unread_count                         -- per-post unread vs my read cursor
```

**Critical implementation note (critique weakMapping):** the bump derivation must live in the **channel-message merge path inside `@mylife/sync`**, not in app-layer `ChatProvider`. The mailbox drain applies verified channel events deep inside `applyChannelEvents`/merge (fail-closed), not in app code; the foreground engine session uses the same merge. Writing `cm_post_activity` as a **post-merge derived step in the one shared merge path** is the only way the foreground and background bump cannot drift, matching the existing single-dispatcher discipline.

**5. `cm_read_state` - extend (still personal_replica, never crosses a shared session).** Add per-post read cursors, per-branch read cursors, and per-post/per-channel `follow`/`mute`/`snooze_until`/`importance` columns. These are attention state and must stay device-local, exactly as the channel rule already requires.

**6. `cm_reactions` - ACTIVATE the dead table.** It already exists in `COMMUNITY_DDL` and `COMMUNITY_SYNC_POLICY` (`or_set`, `shared_workspace`) but has no helpers, no event, no UI. Add a signed `ReactionEvent` in `@mylife/sync`, insert/list/aggregate helpers in `community-core.ts`, `recordLocalChange` wiring in `ChatProvider`, the web twin, and channel UI. OR-set conflict strategy already prewired.

**Web parity:** every `cm_` schema/field change mirrors into `apps/meerkat-web/src/lib/meerkat-data.ts` + `schema.ts` and is gated by `check-meerkat-parity` (native is canonical).

---

## THE FEATURE LIST

Complexity: **S** ≤ ~1 plan-day · **M** ~2-4 days · **L** ~1-2 weeks · **XL** multi-week / multi-plan. Honesty notes enforce the rule: *never fake transport, presence, delivery, peer counts, or agent activity - every number shown must come from the engine or `cm_`/`sync_` tables.*

---

### A) Post / comment / reply primitives & nesting

**A1. Post creation (post-as-primitive)**
- *Pain/desire:* "posts are a much better primitive… between a channel and a thread" (`d-posts-primitive`, `pp-wrong-abstractions`). A post is one durable, addressable object that owns its reply tree and audience.
- *Substrate:* New immutable `cm_posts` header + a root `cm_messages` event with `intent='message'`, `post_id = self`. Signed and replicated via the existing dual path (engine `recordChange` live + `queueChannelMessageMailbox` offline). Placement-as-permission inherits the channel's audience via the community epoch key; `evaluateChannelPost` already gates who may post.
- *Complexity:* **L** (new tables + event fields + composer + feed swap).
- *Honesty:* Post shows only its real recorded author/timestamp; "posted" reflects a local recorded event, not remote receipt.

**A2. Post types (discussion / task / announcement / decision)**
- *Pain/desire:* Workplace placement + type made a post's purpose legible; a flat message has no type (`pp-wrong-abstractions`, `d-feels-like-facebook`).
- *Substrate:* `post_type` on the immutable `cm_posts` header (signature-covered). Type drives renderer + filtering. `task` type is the entry point for the agent task board (Theme E).
- *Complexity:* **S** on top of A1.
- *Honesty:* Type is author-declared metadata; no type implies a status the engine hasn't recorded.

**A3. Top-level comments**
- *Pain/desire:* a message cannot carry comments today; the only parent-link is `supersedes` (edit/tombstone), explicitly not a reply edge (`pp-no-inline-replies`).
- *Substrate:* `cm_messages` with `post_id` set + `parent_id = post root id`, `branch_id = self` (a top-level comment opens its own branch). **Tree-aware resolver replaces the current flat `resolveChannelMessages`** (which builds a single `visibleByRoot` map and flattens supersedes).
- *Complexity:* **M**.
- *Honesty:* Comment count is `reply_count` from locally applied verified events only.

**A4. Inline reply to any single message (addressability) + branch filing (legibility)**
- *Pain/desire:* the founder calls the lack of inline replies "absurd"; wants to "take a sub comment… I want infinite nesting" and answer two divergent replies individually without clogging the main thread (`pp-no-inline-replies`, `pp-no-infinite-nesting`, `d-inline-replies`, `d-infinite-nesting`).
- *Substrate:* `parent_id` points at *any* message id (post, comment, or reply) for full addressability; `branch_id` files the reply under its level-1 comment for bounded-branch rendering (see the branch render contract). New `listReplies(parentId)` + `listBranch(branchId)` queries + branch-aware tree resolver. Out-of-order arrival grafted on `parent_id`/`branch_id` resolution. Composer gains a reply target and a branch context, both distinct from edit mode.
- *Complexity:* **L** (branch-aware tree resolver + reply-target/branch composer + branch collapse UI). **This is where the legibility design lands, not a depth cap.**
- *Honesty:* A reply shows its real signed parent reference; quoting is a render of the actual parent event, never a fabricated excerpt.

**A5. Quote-reply / true inline quote**
- *Pain/desire:* Slack's only escape is manually quoting parts yourself; broadcast re-floods the channel (`pp-no-inline-replies`).
- *Substrate:* Render the verified parent event inline above the reply body using its `parent_id`; the quote carries the cross-branch/deep reference so the reply itself files into the current branch (keeps the two-level view legible). No new field beyond A4. The quote is the real event, content-addressed.
- *Complexity:* **S** on top of A4.
- *Honesty:* The quoted block is the actual signed source event; if the parent isn't locally held, show "source not yet synced" rather than a guessed quote.

**A6. Thread (sub-primitive) view per post**
- *Pain/desire:* "threads are the sub primitive on a post" - easy to interface with for humans and agents (`d-threads-subprimitive`).
- *Substrate:* New stacked route `channel/[communityId]/[channelId]/post/[postId]` (mirrors how `channel`/`files` routes register in `_layout.tsx`). Renders the post + branch-structured comment/reply tree.
- *Complexity:* **M**.
- *Honesty:* Tree shows only locally applied events; a "view thread" count is real.

**A7. Edit / delete posts, comments, replies (reuse + resolver rewrite)**
- *Pain/desire:* parity with current chat; durable but correctable content.
- *Substrate:* Existing `supersedes` superseding-event model does author-only edit/delete with local key shred. **Substrate honesty (critique weakMapping):** this is only "mostly free" once the resolver is tree-aware. A superseding edit must **re-declare the same `parent_id`/`branch_id`** and the rewritten resolver must thread `supersedes` *within* the branch, not over a flat list. Tied to the A3/A4 tree-resolver work.
- *Complexity:* **M** (was S - corrected; the resolver rewrite is the cost).
- *Honesty:* Edited/deleted state is a real signed superseding event, verified before apply.

**A8. Attachments on posts and comments**
- *Pain/desire:* posts own an attachment set (Workplace model).
- *Substrate:* Existing `attachments_json` (signed, canonical) + `cm_message_attachments` index + `ExpoBlobStore` out-of-band by `blob_hash`. **Must keep both in sync** for any post/comment touching attachments.
- *Complexity:* **S** (reuse).
- *Honesty:* Attachment "delivered" reflects real blob transfer over the session blob provider; the existing request/approve re-send flow (`cm_file_requests`) stays honest about availability.

---

### B) Recency bumping & feed ordering

**B1. Action-bumping (the headline mechanic)**
- *Pain/desire:* "when someone leaves a comment on an old post, that post gets bumped. Why the fuck do not threads reply like that?" - singled out as the most important missing mechanic (`pp-no-bumping`, `d-recency-bumping`).
- *Substrate:* On every verified child event applied locally, update `cm_post_activity.bumped_at` to the child's HLC, **derived in the shared `@mylife/sync` channel-merge path** (so engine session and `runMailboxDrainJob` cannot drift). The feed sorts posts by `bumped_at` desc. The bump is **local, from verified events only** - a paired device parking a comment for you while offline correctly bumps the post the moment the drain applies it.
- *Complexity:* **L** (new activity table + bump trigger in the shared merge path + feed sort).
- *Honesty:* The bump is driven by real applied rows; never show a post as "active now" on anything but applied `cm_messages`. No faked engagement counts.

**B2. Channel feed = bump-ordered post list (forum home)**
- *Pain/desire:* replace the flat IM transcript with a browsable index of posts, not a message firehose (`pp-thread-decay`, `d-posts-primitive`).
- *Substrate:* `channel/[channelId].tsx` swaps its flat `ScrollView` of `MessageBubble` for a `PostCard` list ordered by `cm_post_activity.bumped_at`. `PostCard` shows title/type/tags/reply-count/last-activity/reaction row + "view thread".
- *Complexity:* **L**.
- *Honesty:* Every count on a card is local/verified.

**B3. Unread-aware ordering + "new since you left" separator (NOW A LABELED FOUNDER DECISION, not a silent default)**
- *Pain/desire:* pure last-activity bump is itself an anti-pattern in the research (bumps stale posts, buries unread posts whose first line is already read). Borrow the fix, not the flaw.
- *Substrate:* Sort can float any post with `unread_count > 0` (from `cm_post_activity` vs extended `cm_read_state`) and draw a separator; raw recency (pure action-bump, the founder's literal north star) is available as a first-class sort.
- **Founder decision required (critique topPriority):** The draft silently made unread-aware the de-facto default, which quietly hedges the founder's headline mechanic ("every reply bumps to top like Facebook"). This revision does **not** choose for him. Launch default is surfaced in **Open questions**; the engineering default until he rules is **pure action-bump** (his stated north star), with unread-aware offered as a one-tap alternate sort, not the silent winner.
- *Complexity:* **M**.
- *Honesty:* Unread is computed from local read cursors vs locally applied events.

**B4. Multiple feed sorts (bumped / created / unread / mine)**
- *Pain/desire:* "forums die when good posts vanish because only latest matters" - provide created-date and status sorts too.
- *Substrate:* Query variants over `cm_posts` + `cm_post_activity`. No new sync.
- *Complexity:* **S**.
- *Honesty:* All local computation.

**B5. Cold-start priority-window for posts**
- *Pain/desire:* on first sync, surface the most-recently-active posts first.
- *Substrate:* `splitSnapshotForWindow` (MK-028) already ranks by `updated_at` recency for cold-start; generalize so post headers + recent comments arrive before deep backfill.
- *Complexity:* **M**.
- *Honesty:* Source label stays honest (community-node pull vs peer backfill), as `refreshCommunityFeed` already does.

---

### C) Prioritization / "what needs me" inbox / status & reading

**C0. Thin single-workspace "needs me" slice (NEW - early read story, Phase 2.5)**
- *Pain/desire:* the founder's differentiator is reading/prioritizing, but the full cross-workspace inbox (C1) is XL and lands late. Ship a visible read story early (critique roadmapFeedback).
- *Substrate:* Within one workspace, a "needs me" view = posts where I'm `@mentioned` (`mentions_json`) + direct replies to my authored events (`parent_id` → my id) + per-post unread (`cm_post_activity` vs `cm_read_state`). No cross-community aggregation, no salience model - just the structural subset. Reuses Phase 1/3 substrate only.
- *Complexity:* **M**.
- *Honesty:* Completeness is bounded by the last manual sync; copy says "current as of your last sync" and never estimates unseen-peer state. This honesty caveat is the same one the full inbox carries and is surfaced as an Open question about read-side viability before background drain/auto-dial.

**C1. Cross-workspace attention inbox (the read side)**
- *Pain/desire:* "Slack is built for sending… not for reading… not meant for prioritizing… not meant for getting status" (`pp-slack-only-sends`, `d-prioritization-reading-status`). The whole industry is moving from a *feed that flows* to an *inbox that waits*.
- *Substrate:* Top-level tab/route reading across all communities: posts where I'm `@mentioned`, replies to my authored events, posts I follow, agent results addressed to me. All computed **on-device** from verified events - impossible for a content-blind-relay competitor to do server-side. New `mk_attention` (personal_replica) holds inbox state.
- *Complexity:* **XL** (new surface, cross-community aggregation, triage actions).
- *Honesty:* Inbox = the set of verified, decrypted, subscribed events the node actually holds. **No "X unread across the mesh" estimate of what peers haven't sent yet.** In a manual-session, no-auto-dial world this read view is only as fresh as the last sync - stated in copy, and surfaced as a founder Open question about whether the read differentiator needs the deferred background-drain work to fully land.

**C2. Subscription-based attention boundary**
- *Pain/desire:* bound the surface before any ranking (Linear model). Something reaches you only via mention, reply-to-you, "I posted here", or explicit follow.
- *Substrate:* `mentions_json` + `parent_id` lineage + per-post `follow` flag in extended `cm_read_state`. `Unsubscribe`/`Unfollow` is a one-tap verb.
- *Complexity:* **M**.
- *Honesty:* Follow/mute state is personal_replica and never crosses a shared session.

**C3. Triage actions with terminal states (Accept / Snooze / Done / Dismiss)**
- *Pain/desire:* avoid the dead-end "read but still nagging" state of the unread dot; give every interrupt a terminal action.
- *Substrate:* Local state on `mk_attention`. **Snooze-with-wake-on-activity** (return at time T or on new verified child, whichever first). Save-for-later list.
- *Complexity:* **M**.
- *Honesty:* All local-only triage state; no sync, no leak of attention patterns.

**C4. On-device salience ranking ("important & unread")**
- *Pain/desire:* recency and importance are different axes; rank by P(I act) (Gmail Priority Inbox), trained on my actions, with explicit mark-important as the strongest signal.
- *Substrate:* A local model over action signals (open/reply/react/snooze/dismiss) stored in `ExpoNodeStore`/`mk_attention`. Runs entirely on-device because the relay is content-blind - ranking *cannot* happen anywhere else, which is the feature.
- *Complexity:* **L**.
- *Honesty:* Ranking reads only local signals; the importance score is never represented as a global/social signal.

**C5. Answered-vs-open status on posts (resolve)**
- *Pain/desire:* Slack can't mark a question answered; answered and open look identical in scrollback (`pp-thread-decay`).
- *Substrate:* `resolve` intent - a signed append-only event writes `cm_post_lifecycle.state='resolved'` (mirrors the edit/delete tombstone discipline). Verifiable, deterministic, replicates through the same path.
- *Complexity:* **M**.
- *Honesty:* "Resolved" is a real signed protocol row; **status that implies completion must never be self-asserted by optimistic UI** - it's set from the verified event.

**C6. Decision-time digest (pull, source-linked)**
- *Pain/desire:* structured digests beat pure inbox triage for high-volume readers; but always-on algorithmic recap loses (Discord killed ICYMI after ~18 months). Make it pull, scoped, source-linked.
- *Substrate:* A **local agent** assembles "what changed in workspaces you care about since you were last active" on demand, each line deep-linking to its real pinned event/post. Reuses the agent-participant runtime (Theme E).
- *Complexity:* **L**.
- *Honesty:* Each digest line links to a real applied event; nothing summarized that isn't locally held. "Since you were last active" means since your last sync, not a claim about real-time state.

**C7. Per-workspace / per-channel / per-post mute & quiet-collect-by-default**
- *Pain/desire:* reducing response-*expectation* is itself a prioritization mechanism (Twist); notification volume drives the cognitive harm.
- *Substrate:* Mute/snooze flags in extended `cm_read_state` (personal_replica). Default to quiet-collect; reserve real interrupts for true must-acts.
- *Complexity:* **S**.
- *Honesty:* Local-only; no presence broadcast implied.

---

### D) Reactions, mentions, quoting & true inline reply

**D1. Reactions (activate the dead table)**
- *Pain/desire:* low-noise acknowledgement on posts and comments without adding to the reply tree (Workplace model).
- *Substrate:* `cm_reactions` **already exists** in DDL + `COMMUNITY_SYNC_POLICY` (`or_set`, `shared_workspace`) but is dead. Add a signed `ReactionEvent` in `@mylife/sync` (follow `channel-message.ts` template), insert/list/aggregate helpers in `community-core.ts`, `recordLocalChange` wiring in `ChatProvider.react()`, web twin, channel UI. OR-set conflict strategy already prewired.
- *Complexity:* **M** (cheapest net-new because table + policy exist).
- *Honesty:* Reaction counts aggregate only locally applied verified reaction events.

**D2. Reactions feed local ranking + bump**
- *Pain/desire:* reactions are a ranking input and a status signal.
- *Substrate:* Reaction events are verified children → they contribute to C4 salience and B1 bump.
- *Complexity:* **S** on top of D1.
- *Honesty:* Local signal only.

**D3. @mentions of humans and agents**
- *Pain/desire:* direct addressing drives notifications and triggers agent workflows (Workplace bots were @-mentioned to start workflows).
- *Substrate:* `mentions_json` on the signed event (addressed `deviceId`s). Resolves names via `resolvePeerName`. Drives C0/C1/C2 attention and **E3 agent dispatch**. `verifyChannelMessage`/`evaluateChannelPost` extend cleanly.
- *Complexity:* **M**.
- *Honesty:* A mention is a real signed targeting event; "mentioned you" reflects a verified row.

**D4. True inline reply** - covered by **A4/A5** (same `parent_id`/`branch_id` mechanism). Listed here for completeness against `d-inline-replies`.

**D5. Promote-to-channel / broadcast a decision (honest "broadcast")**
- *Pain/desire:* Slack's "also send to channel" re-floods the channel; Teams' send-to-main is confusing. Keep the user-controlled visibility toggle but fix the flatness.
- *Substrate:* A reply can emit a single summary event to the channel feed (a new top-level post referencing the source post id) instead of dumping the whole transcript. Distinct, obvious scope choice.
- *Complexity:* **M**.
- *Honesty:* The broadcast is a real signed event; it does not claim wider delivery than the session/mailbox actually achieved.

---

### E) Agent-native control plane

**E0. Multi-identity foundation (NEW - foundational, blocks all of E)**
- *Pain/desire:* agents must hold their own on-device key, but the app today holds exactly one `self` identity (critique topPriority + weakMapping).
- *Substrate:* This is the real cost the draft hid inside E1. Today `mk_identity` has `PRIMARY KEY DEFAULT 'self'`, every helper hardcodes `WHERE id = 'self'`, `IdentityProvider` generates exactly one `DeviceIdentity`, and `configureSyncSecretStore` stores one device key. Before any agent can sign on-device, the identity layer must become **multi-identity**: `mk_identity` keyed by an identity id (the human `self` plus N agent identities), per-identity secure-store refs, an identity registry/selector, and a headless identity factory so an agent identity exists outside the RN foreground. `WorkspaceMemberRole` (today `'owner'|'admin'|'member'|'viewer'`) gains `'agent'|'service'` - a **signature-surface change to `canonicalDescriptor`** requiring a descriptor revision and version bump, not a UI tweak.
- *Complexity:* **XL** (foundational identity refactor - the riskiest single piece; explicitly **not** merely additive).
- *Honesty:* Each identity's events stay cryptographically attributable; the roster shows which identities are agents.

**E1. Agent identity as a first-class keyed node**
- *Pain/desire:* "agents… part of the same control plane I am in, in a way that is logical" - not brute-forced bots (`pp-agents-brute-forced`, `d-agents-same-control-plane`). Slack throttles agents to 1 req/min and walls data; Meerkat has *no structural reason* to make agents second-class.
- *Substrate:* On top of E0, an agent provisions like a device: its own `DeviceIdentity` (Ed25519 + X25519), fingerprint, friend code, via `generateDeviceIdentity`, stored under its own secure-store ref. Add `kind: 'human'|'agent'` + optional `capabilities`/`operatedBy` to `CommunityMember` (signature-covered in `canonicalDescriptor`). **Founder must decide custody model** (own-device agent vs always-on node vs user acting-on-behalf) - surfaced in Open questions; this spec assumes own-device-or-paired-node identity (option a/b), which is what E0 enables.
- *Complexity:* **L** on top of E0 (was XL-bundled; the foundational cost is now in E0).
- *Honesty:* An agent's authored events are cryptographically attributable like any member; the roster shows it is an agent, not a disguised human.

**E2. Agent membership / programmatic enrollment**
- *Pain/desire:* a real content system where agents are members, not webhook clients (`d-agent-content-system`).
- *Substrate:* Owner signs an agent member directly into the descriptor via `reviseCommunity` (skipping the human link-paste path), reusing `storeOwnedCommunity`'s epoch-wrap-per-DH-key so the agent receives the group key. Revocable like any member (membership rotation rotates the epoch).
- *Complexity:* **L**.
- *Honesty:* Agent membership is a signed descriptor revision; no implicit/ambient access.

**E3. Address an agent on a post or comment (dispatch by @mention)**
- *Pain/desire:* "take a sub comment and send an agent to go explore it" (`d-fork-subcomment-send-agent`). Least-privilege trigger: an agent acts only on explicit @mention or DM, never on an ambient feed of everything (Zulip/Hermes pattern).
- *Substrate:* `@agent` in `mentions_json` on a comment with `intent='agent_task'`. The agent's `runMailboxDrainJob`/`runBackgroundSyncOnce` loop (the existing fail-closed headless slice - "open only envelopes that verify, drop bad sig/wrong-recipient, nothing written") gets an "on applied agent-task → handler" step.
- *Complexity:* **L** (extend the drain dispatcher + agent handler).
- *Honesty:* The agent sees only the message addressed to it; "dispatched" reflects a real signed `agent_task` event applied on the agent node.

**E4. Fork-a-subcomment → dispatch-and-report-back, with an explicit context-fork boundary and engine-owned task state (deepened per critique)**
- *Pain/desire:* "send an agent… come back with feedback. When the agent replies to the post, the post bumps back up." Replace Discord/Telegram agent thread sprawl with a real content system (`d-fork-subcomment-send-agent`, `d-agent-content-system`, `pp-discord-telegram-agent-sprawl`). The research is explicit: flat-transcript-as-runtime is the core failure; the agent needs a context-isolated node plus engine-owned task state so concurrency and replay work.
- *Substrate (now specifies the fork boundary the draft omitted):*
  - **Context-fork boundary is explicit and bounded, not "the whole channel."** Dispatching from a sub-comment forks the agent with a **defined context envelope**: by default the **post subtree rooted at the dispatched comment** (the comment, its branch, and the post header), NOT the whole channel and NOT ambient feed. The dispatcher serializes exactly that subtree of verified `cm_messages` into the `agent_task` event; the agent runs in an **isolated context** seeded only by that envelope. The user can widen the envelope (whole post / named channels) explicitly, mirroring Hermes child-isolation.
  - **Engine-owned task state (blackboard/claims-lease) lives in a replicated task table, not in the transcript.** A new `cm_agent_tasks` (shared_workspace) row holds `task_id`, the post/comment anchor, the context-envelope descriptor, a **claim/lease** (which agent identity owns it, lease expiry), and a status fed only by signed protocol rows (E5). The agent works isolated and posts **one** signed `agent_result` event back into the post's tree → **B1 bumps the post**. Async park-and-drain matches Meerkat's manual-session + mailbox reality: the human need not stay connected for the agent to finish and deliver.
- *Complexity:* **XL**.
- *Honesty:* "Agent running" / "task delivered" must reflect a real engine/`sync_`/`cm_agent_tasks` row, not optimistic UI. Throttle programmatic post creation (Discord `default_thread_rate_limit` pattern) so a runaway agent can't flood the mesh.

**E5. Agent task board (forum-type channel)**
- *Pain/desire:* "a group where you post the things you want to work on, and when your agent replies it gets bumped back up" (`d-agent-content-system`). Avoid "thread per agent task" sprawl - the #threadfail problem at machine scale.
- *Substrate:* A forum-type channel where each task is one `post_type='task'` post with an owner agent identity (from `cm_agent_tasks`), applied tags, and lifecycle. Browsable index (B2) sorted by bump. **System-owned status tags** (queued/running/blocked/needs-human/done) applied only when a real signed protocol row justifies it - an agent **cannot** self-label its own task "done" (mirrors the verify-then-pin / fail-closed discipline).
- *Complexity:* **L** on top of E1-E4.
- *Honesty:* Status tags are engine-set from verified rows; never agent-asserted trust.

**E6. Human-in-the-loop approval gate - separated from cryptographic authorization (corrected per critique)**
- *Pain/desire:* unmanaged agent autonomy "becomes chaos"; Hermes ships ask/yolo/deny as governance.
- *Substrate (two distinct layers, no longer conflated):*
  - **(1) Real authorization is cryptographic and at apply-time on every device.** The agent's descriptor role (`agent`/`service`) + per-channel `postRoles` + `maxScope` caps are enforced by `evaluateChannelPost`/`evaluateInboundChange` when any peer applies the event. A misbehaving agent identity **cannot** exceed its granted scope no matter what its own node does. This is the security boundary. An agent whose role already grants `shared_workspace` does not need that re-permissioned by a UI dialog.
  - **(2) The AG-UI/Elicitation approval gate is a local UX courtesy on the operator's node** for actions the operator wants to eyeball before the agent signs/sends. It is convenience, not enforcement. **Do not** build on deprecated MCP Sampling.
- *Complexity:* **M**.
- *Honesty:* Security comes from (1); the UI gate (2) cannot be the thing standing between an over-scoped agent and the mesh - scope caps are.

**E7. On-device / attested inference (privacy-preserving agent)**
- *Pain/desire:* adding AI must not silently downgrade E2EE (Confer pattern: TEE + attestation, or local inference).
- *Substrate:* Prefer on-device inference so plaintext never leaves the node; where a heavier model is unavoidable, require attested TEE with client-verifiable measurements. Agent operates on already-decrypted-on-device events and emits its own signed `cm_messages`.
- *Complexity:* **XL** (mostly integration/policy, not Meerkat-core).
- *Honesty:* Never route plaintext through a remote model to get AI features without attestation; copy must not claim privacy the inference path doesn't have.

**E8. Agent capability manifest (Agent Card analog)**
- *Pain/desire:* legible, signed declaration of what an agent can read/do (Zulip `llms.txt` move; A2A Agent Card).
- *Substrate:* A signed manifest field on the agent's `CommunityMember`/identity bundle. Cross-node agent collaboration uses A2A-style opacity (Task/Artifact-shaped signed events), never internal memory/logs - aligns with metadata privacy (relay sees only sizes/timing).
- *Complexity:* **M**.
- *Honesty:* Capability is a signed, verifiable declaration; trust is per-identity TOFU like any peer.

---

### F) Open-standard / interop / erode-Slack strategy

**F1. Open, signed post/comment payload schema (the standard)**
- *Pain/desire:* "I want this as an open source standard that is easy to adopt and play with… to slowly replace Slack" (`d-open-source-standard`).
- *Substrate:* Publish the extended `ChannelMessageEvent` + `cm_posts` + `cm_post_tags` + `cm_post_lifecycle` + `ReactionEvent` + `cm_agent_tasks` as a documented, versioned open schema (post id, parent, branch, author identity + kind, mentions, tags, lifecycle, content refs, task envelope). The forum/post primitive becomes an **interop contract**, not a Meerkat-only feature - any conforming agent or client can read/write the board over the mesh.
- *Complexity:* **M** (spec + versioning discipline; the code is A-E).
- *Honesty:* Spec documents the real on-wire signed form; no aspirational fields.

**F7. Slack/Workplace history import (THE DAY-ONE EROSION WEDGE - moved up beside the core)**
- *Pain/desire:* Slack's 90-day free history + export-gated-to-tier holds memory hostage; Workplace customers face a hard **2026-06-01 deletion** with no first-party migration. This is the cheapest, federation-free wedge and it directly weaponizes the deadline the thesis leans on (critique roadmapFeedback + topPriority).
- *Substrate:* An importer that ingests a Slack/Workplace export into signed posts/comments/branches under a workspace key. Reuses `@mylife/migration` patterns. **Needs no relay, no live federation, no two-sided network** - which is exactly why it ships early. Lead positioning: "your team's knowledge is durable because it lives on your devices, not our datacenter."
- *Complexity:* **L**.
- *Honesty:* Imported content is labeled as imported (not live), and timestamps reflect the source, not fabricated activity.

**F3. Routable federation identity (email-shaped)**
- *Pain/desire:* precondition for federation and for giving agents first-class addresses; JID/Matrix-ID/MIMI-URI shape.
- *Substrate:* Add a routable form (`code-or-key @ relay-domain`) on top of friend codes + signed identity bundles, so a Meerkat ID can be reached from a Matrix/MIMI/XMPP peer.
- *Complexity:* **L**.
- *Honesty:* Reachability copy stays honest about what's actually deployed (no relay = no autonomous reachability today; `DEFAULT_RELAY_URL` is `''`).

**F2. MLS-native group keying alignment**
- *Pain/desire:* MLS (RFC 9420) is consolidating the industry (RCS, Discord, Matrix, MIMI). Don't be a crypto island; inherit forward secrecy + post-compromise security and a path to federate.
- *Substrate:* Align `@mylife/sync` epoch-key/group-commit machinery toward TreeKEM / KeyPackages / Commit-Welcome. Meerkat's existing per-community epoch key + membership rotation is conceptually close.
- *Complexity:* **XL**.
- *Honesty:* Pin one MLS profile and version it strictly; treat ciphersuite divergence as release-blocking (avoid XMPP's OMEMO fragmentation).

**F4. First bridge into Matrix (the live erosion wedge)**
- *Pain/desire:* erosion via interop - one Meerkat user joins an existing team's conversation with zero migration (`d-open-source-standard`). Matrix is the easiest open target (open spec, existing bridge ecosystem). **Concrete day-one entry experience (critique missingFeature):** a Meerkat user pastes a Matrix room invite; the bridge maps that room to a Meerkat channel/post feed; the user reads the room's messages as posts in Meerkat and (in the 1:1 write stage) replies that round-trip back. The "join a colleague's existing room with zero migration" experience is this flow, made explicit rather than implied.
- *Substrate:* A bridge maps a Matrix room ↔ a Meerkat channel/post feed. Start narrow (read, then 1:1 write). This is the **live** wedge; F7 import is the **federation-free** wedge that ships first.
- *Complexity:* **XL**.
- *Honesty:* Copy must state bridge scope precisely (read-only / 1:1 / dev-build / relay-dependent). Punish openwashing in our own UI.

**F5. MIMI hub-per-room posture + AppSync-style policy**
- *Pain/desire:* the closest standards-track "federated workspace" protocol (IETF MIMI over HTTPS + MLS).
- *Substrate:* Frame a Meerkat relay as a candidate MIMI-style hub that orders/authorizes while seeing only sizes/timing (already MK-044's design intent - a naming/spec alignment, not a re-architecture). Signed room-state proposals fit "security in the payload, not the channel."
- *Complexity:* **L** (alignment/spec; depends on F2).
- *Honesty:* Relay remains zero-knowledge; no plaintext task/metadata server.

**F6. DMA-mandated interop transport (scale lever)**
- *Pain/desire:* regulation pries open WhatsApp/Messenger; a small open client gains the legal right to reach billions while preserving E2EE.
- *Substrate:* A pluggable interop transport that can consume mandated gatekeeper APIs (protobuf stanzas + Signal Protocol). Architected as a first-class transport rung alongside relay/LAN.
- *Complexity:* **XL** (external-dependent; sequence last).
- *Honesty:* 1:1-only / region-gated scope stated in copy.

**F8. ActivityPub-shaped public/broadcast surface (kept separate)**
- *Pain/desire:* a public announcements/community-discovery feed where content is meant to be public anyway - *strictly separated* from the E2EE private team layer.
- *Substrate:* `published_blob` scope (sealed share / `buildShareLink`) for public announcements; map to AP Activity/Object only on the public surface. Never encrypt a social graph.
- *Complexity:* **L**.
- *Honesty:* Public content is clearly public; the private path is never AP.

---

### G) Identity, membership, multi-workspace, cross-org connection & the two-sided flywheel

**G1. Multi-workspace membership (one user, many orgs)**
- *Pain/desire:* Slack's cross-company connection "is really powerful and has gotten almost every channel" - the lock-in that keeps him on Slack (`pp-slack-lock-in`, `d-cross-company-connection`). Match the strength, done privately.
- *Substrate:* Mesh-sync multi-workspace already supports many workspaces per user, each with its own symmetric key, membership, scope boundary. A personal workspace auto-creates at first launch. Communities are workspaces.
- *Complexity:* **M** (substrate exists; surface the cross-workspace UX).
- *Honesty:* Membership rosters reflect the signed descriptor; no inflated member/online counts.

**G2. Cross-org connection - the two-sided ADOPTION flywheel that replaces Slack Connect's pull (rethought per critique)**
- *Pain/desire:* the founder stays on Slack ONLY because of cross-company connection. The draft's answer ("no lock-in, federation by default") correctly inverts Slack's model but missed the strategic point (critique missingFeature): Slack Connect is *sticky because it's a two-sided network*, and "no lock-in" is a privacy virtue but a **growth liability** unless something makes the second company adopt and stay.
- *Substrate + flywheel mechanic:*
  - **A shared durable artifact both sides depend on, owned by neither.** When two orgs connect, they share a **cross-org workspace** whose posts/decisions/agent task board live (E2EE, replicated) on **both** sides' devices. The institutional memory of the relationship (decisions, resolved threads, signed agreements as `decision` posts, agent results) is a durable artifact each side independently holds and can search offline. The counterparty cannot unilaterally delete the other side's copy - the artifact's durability is the stickiness, and it is *symmetric* (unlike Slack Connect's asymmetric host-owns-the-channel model).
  - **Free for both sides, no per-partner channel sprawl.** One cross-org workspace, not 1,000 Slack-Connect channels; no paid-on-both-sides gate. Lower friction to start *and* a durable reason to stay.
  - **Agents as a connection accelerant.** A vendor can drop an agent into the shared workspace that both sides address - a reason for the counterparty to keep the connection live (status, automated reporting) that Slack Connect structurally cannot offer.
- *Complexity:* **L**.
- *Honesty:* Connection state reflects real pairing/membership rows; never fake a "connected to org X" status. The durable-artifact claim is true because both sides physically hold the replicated, verified data.

**G3. Self-sovereign identity & verification (reuse)**
- *Pain/desire:* no account, no central registry; the key *is* the identity.
- *Substrate:* `generateDeviceIdentity`, 8-hex safety code (`getPublicKeyFingerprint`), friend-code rendezvous (MK-016) with self-signed bundle + TOFU pinning. Already shipped.
- *Complexity:* **S** (mostly reuse; add agent-kind surfacing, which depends on E0).
- *Honesty:* Friend code carries no key material; trust is Ed25519 self-signature + TOFU, stated plainly.

**G4. Role & post-permission model (incl. agent roles)**
- *Pain/desire:* placement-as-permission; agents need distinct grant/deny.
- *Substrate:* Extend `WorkspaceMemberRole` with `agent`/`service` (the same E0 descriptor signature-surface change); `evaluateChannelPost` grants/denies agent posting distinctly. Per-channel `postRoles` already enforced cryptographically at apply time on every device.
- *Complexity:* **M**.
- *Honesty:* Permission denials are real cryptographic apply-time checks, not UI-only.

**G5. Workspace navigation structure (shared, not per-user-private)**
- *Pain/desire:* Slack's flat namespace + private per-user Sections invisible to teammates is under-delivery; ship real shared structure.
- *Substrate:* Channel folders / labeled sections synced as scoped workspace entities (shared, navigable), not Slack's private sidebar sections.
- *Complexity:* **M**.
- *Honesty:* Structure is shared workspace data under the epoch key.

---

### H) Notifications, presence (honest), offline mailbox & delivery

**H1. Honest delivery model (manual relay + LAN + mailbox)**
- *Pain/desire:* messages must reach people even when offline, without faking transport.
- *Substrate:* Existing dual path - live engine session (relay MK-008 / LAN MK-007 dev-build) + sealed offline mailbox (`queueChannelMessageMailbox` → relay buffers → `runMailboxDrainJob`). Posts/comments/reactions/agent events all ride this.
- *Complexity:* **S** (reuse for new event kinds).
- *Honesty:* Hard rule - never fake "connected to mesh", a peer count, or a transfer in flight. Automatic auto-dial is NOT built; copy keeps saying so.

**H2. Content-free liveness → honest bump/notify**
- *Pain/desire:* know "something moved" without leaking content; notify only on real activity.
- *Substrate:* `community-notify.ts` content-free ping ("community X moved at T", carries no bytes) enqueues a pull; `shouldEmitMessageNotification` fires a user notification **only after real `applied>0`**. Post bump (B1) hangs off the same applied-count signal.
- *Complexity:* **M**.
- *Honesty:* A "message/agent finished" notification fires only after a real applied count; the data-only push only *enqueues* a drain.

**H3. Per-type notification routing (human / agent / mention)**
- *Pain/desire:* agents generate high volume; without their own filterable type they recreate notification fatigue and drown human signal.
- *Substrate:* Route by `author_kind` + `intent` + `mentions`; saved views (C1) split human mention / channel post / agent result / agent-needs-approval. Throttle agent-origin notifications.
- *Complexity:* **M**.
- *Honesty:* Counts per type are local/verified.

**H4. No fake presence; optional honest "active" only from real rows**
- *Pain/desire:* Meerkat has *no* ephemeral presence substrate; everything on the wire is a durable signed event or a mailbox delta. Reducing presence pressure is also a privacy + attention win (Twist).
- *Substrate:* Do **not** ship typing/online indicators that imply real-time presence the transport can't honor. If any "active" signal is shown, it derives strictly from real applied events (e.g., "last posted 3m ago" from an HLC), never an estimate.
- *Complexity:* **S** (mostly a constraint).
- *Honesty:* No "online now", no "seen by", no read receipts of others - `cm_read_state` is personal_replica and never crosses a shared session, by design.

**H5. Background drain wake for agent + human delivery**
- *Pain/desire:* an agent task can complete and deliver while the human's chat has moved on; the read-side differentiator (C1) is only as fresh as the last drain.
- *Substrate:* `runBackgroundSyncOnce` → `runMailboxDrainJob` (the one honest background slice). OS-scheduled runs + data-only push wake are wired but **DEFERRED behind a dev-build flag** (`background_sync_enabled`, default false); native modules lazy-load and no-op when absent (Expo Go safe). **Sequencing note:** because the read-side freshness depends on this, landing scheduled drain is what graduates C1 from "fresh as of last manual sync" to a genuinely passive inbox - surfaced as a founder Open question.
- *Complexity:* **M** (extend drain handlers for `agent_result`; scheduler stays deferred).
- *Honesty:* Scheduled cadence / push timing still need a dev build + two devices; copy says so. `last_background_run_at` records real runs only.

---

### I) Search, navigation & addressability of posts/threads

**I1. Stable, id-anchored post permalinks - NEW membership-gated community deep-link (substrate fix per critique)**
- *Pain/desire:* a conversation must be a stable, linkable, movable object; a link must survive rename/move/resolve (Zulip 9.0 `with` operator).
- *Substrate (corrected - does NOT extend `buildShareLink`):* The draft's "extend `buildShareLink`/`buildMagnetLink`" mapping is wrong: those APIs are hard-wired to `createSealedShare` and take `{contentId, linkKey}` where `contentId` is a sealed-blob manifest id and `linkKey` self-decrypts that blob. A `cm_messages` post is **not** a sealed share and has no `linkKey`. This is **net-new addressing**, not an extension. Spec a new **community/post deep-link format** (`communityId + channelId + postId + branchId? + epoch-key reference`) that resolves via the existing **community refresh / verify-then-apply** path, **not** `fetchAndPinFromHosts` (which is for sealed blobs). Opening it **requires community membership / the epoch key** (unlike a self-decrypting sealed share link); a non-member gets "you are not a member of this workspace," not content. The id anchor survives rename/move/resolve.
- *Complexity:* **M**.
- *Honesty:* Resolves local-first against held events; a non-member or not-yet-synced post is reported honestly, never reconstructed.

**I2. Narrow-style composable query layer**
- *Pain/desire:* recency and relevance are different axes; any view (a post, a sender, unread, has-attachment) should be a shareable filter (Zulip narrows).
- *Substrate:* A small composable filter (community, channel, post, branch, sender, `is:unread`, `has:attachment`, `mentions:me`, `kind:agent`) over `cm_posts`/`cm_messages`/`cm_post_activity` that both renders a view and serializes to a community deep-link (I1). Two first-class read modes: **Recent** (chronological / pure action-bump) and **Relevant** (ranked, C4).
- *Complexity:* **L**.
- *Honesty:* All query/ranking is local over verified events.

**I3. Full-text local search across posts & comments**
- *Pain/desire:* answered knowledge must be findable, not rotting in scrollback; no 90-day cliff.
- *Substrate:* SQLite FTS over locally held `cm_messages`/`cm_posts` bodies. Because content is on-device and E2EE, search runs client-side with no server reading content.
- *Complexity:* **M**.
- *Honesty:* Search covers only what the node holds; "not found" may mean "not yet synced", labeled as such.

**I4. Tag taxonomy & lifecycle filtering**
- *Pain/desire:* tags as a status/taxonomy layer; bounded (~8-15) to avoid recreating sprawl; required tags at creation, system-only status tags.
- *Substrate:* `cm_post_tags` (`or_set`); system-owned status tags engine-set from `cm_agent_tasks`/lifecycle rows (E5). Filter/sort the forum home by tag + lifecycle.
- *Complexity:* **M**.
- *Honesty:* Status tags reflect verified rows; author tags are clearly author-applied.

**I5. Auto-archive stale posts (garbage-collect sprawl)**
- *Pain/desire:* finished/stale tasks must leave the active board but stay searchable (Discord auto-archive; pinned never archives).
- *Substrate:* `archived` is a **local view state** derived from inactivity in `cm_post_activity` (NOT a replicated lifecycle write - only `open`/`resolved` replicate via `cm_post_lifecycle`); pinned posts exempt. Local index stays lean.
- *Complexity:* **S**.
- *Honesty:* Archive is a local view state derived from real activity; content is never deleted.

---

## Painpoint / desire coverage matrix

| id | Addressed by |
|---|---|
| `pp-no-inline-replies` / `d-inline-replies` | A4, A5, D4 (+ branch render contract) |
| `pp-thread-decay` / `d-recency-bumping` | B1, B2, B3, C5, I1 |
| `pp-no-bumping` / `d-recency-bumping` | **B1**, B2, E4 (default = pure action-bump pending founder call, B3) |
| `pp-no-infinite-nesting` / `d-infinite-nesting` | **A4**, A6, branch render contract (infinite addressability, bounded-branch legibility) |
| `pp-slack-only-sends` / `d-prioritization-reading-status` | **C0 (early), C1-C6**, I2 |
| `pp-agents-brute-forced` / `d-agents-same-control-plane` | **E0 (foundation), E1-E8** |
| `pp-discord-telegram-agent-sprawl` / `d-agent-content-system` | E4 (context-fork + task board), **E5**, I4, I5 |
| `pp-wrong-abstractions` | Primitive model, A1-A3, G1 |
| `pp-slack-lock-in` / `d-cross-company-connection` | **G1, G2 (two-sided flywheel)**, F3 |
| `pp-workplace-shutdown` | **F7 (day-one wedge)**, thesis |
| `pp-teams-not-usable` | Whole design (open, private, agent-native) |
| `d-posts-primitive` | **A1, A2**, B2 |
| `d-threads-subprimitive` | A6 |
| `d-fork-subcomment-send-agent` | **E3, E4 (context-fork boundary + engine-owned task state)** |
| `d-open-source-standard` | **F1**, F4, F5, F7 |
| `d-feels-like-facebook` | A1-A3, B1-B2, branch render, D1, G5 |

---

## Phased roadmap

Each phase is independently shippable and leaves the app honest and useful. The two structural fixes from the critique: (1) the **federation-free import wedge (F7)** moves up beside the core so the erosion thesis is honored early, decoupled from heavy live federation; (2) a **thin single-workspace read slice (C0, Phase 2.5)** makes the read-side differentiator visible before the XL cross-workspace inbox; (3) the **multi-identity refactor (E0)** is surfaced as a foundational prerequisite, not a Phase-5 surprise.

**Phase 0 - Schema foundation (no UX change).** Bump `ChannelMessageEvent` to v2 with `postId`/`parentId`/`branchId`/`authorKind`/`mentions`/`intent` (v1-compat decoder); add immutable `cm_posts`, `cm_post_tags` (or_set), `cm_post_lifecycle`, `cm_post_activity`, extend `cm_messages` + `cm_read_state`; register policy/prefix rules (per-table conflict strategies, fixed); mirror web twin; pass `check-meerkat-parity`. *Deliverable: schema + signed contract, zero faked anything.*

**Phase 1 - Posts, comments, branch-structured reply, threads.** A1-A8. The channel becomes a post feed + post-detail thread route with bounded-branch inline reply (infinite addressability, two-level legible render). *Fixes `pp-no-inline-replies`, `pp-no-infinite-nesting`; lands the primitive and pays the legibility debt.*

**Phase 2 - Recency bumping & feed ordering.** B1-B5. The headline mechanic, bump derived in the shared `@mylife/sync` merge path. *Fixes `pp-no-bumping`, `pp-thread-decay` - the founder's #1 ask. Default sort is pure action-bump pending the founder's B3 decision.*

**Phase 2.5 - Thin read slice + import wedge (NEW, early differentiator + early erosion).** C0 (single-workspace "needs me" from mentions+replies+unread) and **F7 (Slack/Workplace import)**. The read story becomes visible before the full inbox, and the cheapest federation-free erosion wedge ships while the Workplace 2026-06-01 deletion is still live news. *Partially fixes `pp-slack-only-sends` early; weaponizes `pp-workplace-shutdown`.*

**Phase 3 - Reactions & mentions.** D1-D5. Activate the dead `cm_reactions`; @mentions wire the attention + agent-dispatch substrate.

**Phase 4 - Prioritization / attention inbox (full).** C1-C7. The cross-workspace read side. *Fixes `pp-slack-only-sends` fully - the differentiator no content-blind competitor can match. Early completeness is bounded by manual-sync freshness until H5 background drain lands.*

**Phase 4.5 - Multi-identity foundation (NEW, prerequisite for agents).** E0. Refactor the single-`self` identity model into a multi-identity store + per-identity secure-store refs + headless identity factory; add `agent`/`service` to `WorkspaceMemberRole` (descriptor signature-surface change + version bump). *No agent product yet; this is the foundation Phase 5 silently assumed.*

**Phase 5 - Agent-native control plane (core).** E1-E6. Agent identity, membership, @-dispatch, context-fork-and-report-back with engine-owned task state, task board, separated cryptographic-authorization vs UX-approval gate. *Fixes `pp-agents-brute-forced`, `pp-discord-telegram-agent-sprawl`.*

**Phase 6 - Search & addressability.** I1-I5. Membership-gated community post permalinks (net-new addressing), narrow queries, FTS, tags, auto-archive.

**Phase 7 - Open standard & cross-org flywheel.** F1, F3, G1-G5. Publish the schema; routable identity; multi-workspace + the two-sided cross-org adoption flywheel (shared durable artifact). *Fixes `pp-slack-lock-in` with a replacement for Slack Connect's pull, not just its lock-in.*

**Phase 8 - Live interop & federation (erosion, heavy half).** F2 (MLS), F4 (Matrix bridge with the explicit day-one join experience), F5 (MIMI posture), F8 (AP public surface). *The slow live-federation Slack erosion; F7 import already shipped the federation-free half in Phase 2.5.*

**Phase 9 - Advanced agent + scale.** E7 (attested inference), E8 (capability manifest), F6 (DMA transport), H5 (scheduled background drain - also graduates the Phase-4 read side to passive). External-dependent; sequence last.

---

## Recommended decomposition into shippable sub-projects (one plan each)

| Plan | Scope | Theme | Size |
|---|---|---|---|
| **MK-P01** Post schema & v2 contract | Phase 0 (event v2, immutable `cm_posts`, `cm_post_tags` or_set, `cm_post_lifecycle`, activity table, read-state ext, per-table policy/prefix, web parity) | Foundation | L |
| **MK-P02** Post + comment + branch-structured reply | A1-A6 (composer with reply-target + branch, branch-aware tree resolver, post-detail route, branch render contract) | A | XL → split if needed |
| **MK-P03** Edit/delete/attachments parity for posts | A7-A8 (resolver-aware supersedes within branches) | A | M |
| **MK-P04** Recency bumping engine | B1-B5 (bump derivation in shared `@mylife/sync` merge path, feed sort, cold-start window, founder-selectable sort default) | B | L |
| **MK-P05** Reactions activation | D1-D2 (`ReactionEvent`, helpers, wiring, web twin, UI) | D | M |
| **MK-P06** Mentions & addressing | D3-D5 (mentions field, name resolve, broadcast) | D | M |
| **MK-P07** Early read slice + import wedge | **C0 (single-workspace needs-me) + F7 (Slack/Workplace import)** | C/F | M+L |
| **MK-P08** Attention inbox & triage (full) | C1-C3, C7 (cross-workspace inbox, subscription, snooze/done, mute) | C | XL |
| **MK-P09** On-device salience & digest | C4-C6 (local ranking, resolve, pull digest) | C | L |
| **MK-P10** Multi-identity foundation | **E0** (multi-identity store, per-identity secure-store refs, headless factory, `agent`/`service` role descriptor change) | E | XL (foundational, riskiest) |
| **MK-P11** Agent identity & membership | E1-E2 (agent keyed node on the E0 foundation, programmatic enrollment) | E | L |
| **MK-P12** Agent dispatch & report-back | E3-E5 (@-dispatch, context-fork boundary, `cm_agent_tasks` claims-lease, async subagent vocab, task board) | E | XL |
| **MK-P13** Agent governance | E6, E8, H3 (cryptographic authorization vs UX gate, capability manifest, per-type routing + throttle) | E/H | L |
| **MK-P14** Search & addressability | I1-I5 (membership-gated community permalinks, narrows, FTS, tags, auto-archive) | I | L |
| **MK-P15** Open schema, multi-workspace & cross-org flywheel | F1, F3, G1-G5 (incl. G2 two-sided shared-artifact flywheel) | F/G | L |
| **MK-P16** Honest notifications & delivery | H1-H2, H4-H5 (bump-notify on applied count, no-fake-presence guardrails, drain handlers, read-side freshness) | H | M |
| **MK-P17** MLS alignment | F2 | F | XL (research-heavy) |
| **MK-P18** Matrix bridge wedge | F4 (with explicit day-one join experience) | F | XL |
| **MK-P19** Attested agent inference | E7 | E | XL (external) |
| **MK-P20** MIMI posture / DMA transport | F5, F6 | F | XL (external) |

**Sequencing guidance:** MK-P01 → P02 → P04 is the critical path that delivers the founder's core thesis (posts + branch reply + bumping) in three plans. **MK-P07 (early read slice + import) ships right after the core** as the first differentiator-and-erosion signal, decoupled from the heavy federation work. MK-P05/P06 unblock both the full attention inbox (P08/P09) and agents. **MK-P10 (multi-identity, E0) is a hard prerequisite for all agent work (P11-P13) and is the riskiest XL - schedule it as foundational, not a Phase-5 surprise.** Heavy interop (P17-P20) is parallelizable and external-dependent; start MK-P18 (Matrix) early as a research spike because it's the live erosion wedge, but it gates nothing.

---

## Open questions for the founder

> **Update 2026-06-18:** Q1 (bump), Q2 (nesting), Q4 (agent custody) are RESOLVED - see **Decisions locked** near the top. Q3, Q5, Q6 below remain open and do not block MK-P01.

1. **[RESOLVED - ship both, decide live] Bump default - pure action-bump vs unread-aware.** Pure action-bumping (every reply floats the post) is your literal north star, but the research and our own B3 say pure recency-bump buries unread posts whose first line is already read. Which is the **default feed sort at launch**: your pure Facebook-style bump, or the research-backed unread-aware bump? We are holding pure action-bump as the engineering default and refusing to silently choose unread-aware (which the draft did) until you rule. This is a taste call you should own.

2. **[RESOLVED - bounded-branch] Infinite nesting vs bounded-branch legibility.** We chose infinite `parent_id` addressability with a **bounded two-level, branch-structured render** (each comment's divergent replies become named, independently collapsible branches) rather than raw infinite indent. Your stated ask was "infinite nesting," but your actual goal was "answer two divergent takes without clogging." Is infinite *visual* depth a hard requirement, or does the branch model (which is close to what Workplace shipped and you loved) satisfy the real need with far less render complexity? If you want true infinite indent, we will design it, but it reintroduces the clog you are fleeing.

3. **Cross-company adoption flywheel.** Cross-company connection is the lock-in that keeps you on Slack. Our answer is "no lock-in, federation by default" plus a **two-sided shared durable artifact** (G2) that both orgs hold and neither can delete out from under the other. But "no lock-in" is a privacy virtue and a growth liability. Is a symmetric, both-sides-own-it durable workspace the right stickiness mechanic to replace Slack Connect's network pull, or do you want a stronger pull (e.g., a connection-accelerant agent both sides depend on)?

4. **[RESOLVED - pluggable, on-device default, always-on node optional] Agent key custody model.** Agents must sign their own events, but the app today holds exactly one `self` identity (`mk_identity` PK DEFAULT `'self'`). Are agents (a) **separate identities running on the user's device**, (b) **identities on a separate always-on node/server**, or (c) **the user's own identity acting on their behalf**? Each has very different key-custody, trust, and "who signed this" implications. This spec assumes (a)/(b) and budgets the multi-identity refactor (E0) accordingly; (c) would be cheaper but blurs attribution. Which model do you want?

5. **Erosion timing - import now vs interop later.** The thesis says interop is the whole point, but heavy live federation (Matrix, MLS, MIMI, DMA) is genuinely late-stage. We moved the **federation-free Slack/Workplace import (F7)** up to Phase 2.5 as the day-one wedge that exploits the Workplace 2026-06-01 deletion, decoupled from the heavy bridge work. Do you agree import-as-wedge ships early and live-bridge ships late, or do you want the Matrix bridge prioritized even at its XL cost?

6. **Read-side viability before background drain.** In a manual-session, no-auto-dial world, the cross-workspace "what needs me" inbox is only as fresh as your last manual sync. Is the read-side differentiator acceptable in that degraded "fresh as of last sync" form (with honest copy), shipping early via the C0 thin slice, or does the prioritization story require the deferred background-drain / auto-dial work (H5) to actually land first to feel like a real inbox?

---

## Recommended first sub-project

**Ship MK-P01 (Post schema & v2 contract, Phase 0) first.** It is the single highest-leverage independently-shippable slice because every other plan - posts, branch reply, the headline bump mechanic, reactions, the attention inbox, and the entire agent control plane - sits on the v2 `ChannelMessageEvent` and the `cm_posts`/`cm_post_tags`/`cm_post_lifecycle`/`cm_post_activity` tables, so getting the signed contract and per-table conflict strategies right once unblocks all of them and getting them wrong forces a painful re-signing migration later. It is the only slice that lands the two corrected substrate decisions (immutable signed post header with lifecycle/tags as separate signed-event and or_set tables; membership-gated addressing assumptions) before any UI depends on the wrong shape. It ships with **zero faked anything and zero UX change** - pure schema, signed-contract, policy/prefix registration, and web-twin parity gated by `check-meerkat-parity` - so it cannot violate the transport-honesty boundary and cannot regress the running app. And because it is deliberately UX-invisible, it is safe to parallelize against design exploration for MK-P02, letting the critical path (P01 → P02 → P04) start immediately while the founder resolves the bump-default and nesting taste calls above.