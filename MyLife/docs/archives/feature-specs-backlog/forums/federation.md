# Feature Spec: Federation

## Metadata
- **Module:** forums
- **Priority Score:** 10 / 50 (C-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [1] x3 + Complexity [0] x2 + CrossModule [1] x1 + PaidUser [0] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 12-15 hours
- **Depends On:** User profiles (federated identity), Real-time updates (cross-instance sync)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Federation is the antidote to platform lock-in. When a single company controls all community infrastructure, users are subject to arbitrary policy changes, data harvesting, and enshittification. Lemmy proved that federated forums are viable (50,000+ MAU across 1,000+ instances after Reddit's API pricing changes in 2023). Federation aligns perfectly with MyLife's anti-enshittification pledge: users can run their own instance, communities can migrate between hosts, and no single entity controls the network. This is a long-term strategic differentiator, not an immediate user acquisition feature.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Discord | No | N/A | Fully centralized. All data on Discord servers. No federation or self-hosting. |
| Reddit | No | N/A | Fully centralized. Third-party API access severely restricted in 2023. |
| Lemmy | Yes | No | Full ActivityPub federation. Communities can be followed across instances. Posts, comments, votes, and user profiles federate. Each instance runs independently with its own moderation. |

### Target User
Privacy advocates, self-hosters, and communities burned by platform centralization decisions. Lemmy refugees who like federation but want a more polished, mobile-first experience. Organizations that need self-hosted community forums with the option to connect to the broader MyForums network. The low switching score (1/5) reflects that this is a philosophical differentiator, not a feature users actively search for when choosing a forum platform.

## Technical Context

### Where This Lives in MyLife

```
modules/forums/src/
  types.ts                            -- New Zod schemas: FederatedInstance, FederatedActor, ActivityPubObject
  cloud/client.ts                     -- MODIFIED: support for federated content resolution
  cloud/schema.sql                    -- New tables: fr_federated_instances, fr_federated_actors, fr_federation_queue
  federation/                         -- NEW directory
    activitypub.ts                    -- ActivityPub protocol implementation (inbox/outbox)
    webfinger.ts                      -- WebFinger user discovery (.well-known/webfinger)
    http-signatures.ts                -- HTTP Signatures for authenticated federation
    resolver.ts                       -- Remote actor/object resolution and caching
    outbox.ts                         -- Outgoing activity queue processor
    inbox.ts                          -- Incoming activity handler and validation
    transforms.ts                     -- MyForums <-> ActivityPub object transformers

supabase/functions/
  federation-inbox/index.ts           -- NEW: Edge Function to receive ActivityPub activities
  federation-outbox/index.ts          -- NEW: Edge Function to process outgoing federation queue

apps/web/app/
  .well-known/webfinger/route.ts      -- NEW: WebFinger endpoint for user discovery
  .well-known/nodeinfo/route.ts       -- NEW: NodeInfo endpoint for instance metadata
```

### Wireframe Position

```
Hub Dashboard
  └── MyForums card
       └── Community Detail
            └── Community Settings (mod/admin)
                 └── Federation tab ← YOU ARE HERE
                      ├── Toggle: "Allow this community to federate"
                      ├── Blocked instances list
                      ├── Federation status indicator (connected instances)
                      └── Instance allowlist (for restricted federation)
```

Federation also surfaces in:
1. User profile: federated handle display (e.g., `@username@mylife.app`)
2. Community discovery: search results include federated communities
3. Thread/reply display: federated content shows instance origin badge

### Data Model

```sql
-- Known federated instances
CREATE TABLE IF NOT EXISTS fr_federated_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  display_name TEXT,
  software TEXT,
  software_version TEXT,
  description TEXT,
  inbox_url TEXT NOT NULL,
  outbox_url TEXT,
  shared_inbox_url TEXT,
  public_key TEXT NOT NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  is_allowlisted BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Federated actors (remote users)
CREATE TABLE IF NOT EXISTS fr_federated_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES fr_federated_instances(id) ON DELETE CASCADE,
  actor_uri TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  inbox_url TEXT NOT NULL,
  outbox_url TEXT,
  public_key TEXT NOT NULL,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Federation activity queue (outgoing)
CREATE TABLE IF NOT EXISTS fr_federation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('Create', 'Update', 'Delete', 'Like', 'Undo', 'Follow', 'Accept', 'Reject', 'Announce')),
  actor_uri TEXT NOT NULL,
  object_json JSONB NOT NULL,
  target_inbox TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Federated content origin tracking
ALTER TABLE fr_threads ADD COLUMN IF NOT EXISTS
  federation_uri TEXT UNIQUE;
ALTER TABLE fr_threads ADD COLUMN IF NOT EXISTS
  federation_instance_id UUID REFERENCES fr_federated_instances(id);
ALTER TABLE fr_replies ADD COLUMN IF NOT EXISTS
  federation_uri TEXT UNIQUE;
ALTER TABLE fr_replies ADD COLUMN IF NOT EXISTS
  federation_instance_id UUID REFERENCES fr_federated_instances(id);
ALTER TABLE fr_communities ADD COLUMN IF NOT EXISTS
  federation_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fr_communities ADD COLUMN IF NOT EXISTS
  federation_uri TEXT UNIQUE;

-- Indexes
CREATE INDEX idx_fr_instances_domain ON fr_federated_instances (domain);
CREATE INDEX idx_fr_actors_uri ON fr_federated_actors (actor_uri);
CREATE INDEX idx_fr_actors_instance ON fr_federated_actors (instance_id);
CREATE INDEX idx_fr_federation_queue_status ON fr_federation_queue (status, created_at);
CREATE INDEX idx_fr_threads_federation ON fr_threads (federation_uri) WHERE federation_uri IS NOT NULL;
CREATE INDEX idx_fr_replies_federation ON fr_replies (federation_uri) WHERE federation_uri IS NOT NULL;

-- RLS
ALTER TABLE fr_federated_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Instances are publicly readable" ON fr_federated_instances FOR SELECT USING (true);

ALTER TABLE fr_federated_actors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Actors are publicly readable" ON fr_federated_actors FOR SELECT USING (true);

ALTER TABLE fr_federation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Queue is admin-only" ON fr_federation_queue FOR SELECT USING (false);
```

### Dependencies
- **Internal:** `@mylife/auth` (local user identity linked to federated actor), forums User Profiles (fr_profiles as local actor source), forums Real-time (for broadcasting federated content arrival)
- **External:** ActivityPub protocol (W3C standard), WebFinger (RFC 7033), HTTP Signatures (draft-cavage-http-signatures), NodeInfo protocol, Supabase Edge Functions (for HTTP endpoints), `node-fetch` or equivalent for outbound HTTP
- **Cross-Module:** Federation URI format uses the hub's domain, which affects `@mylife/auth` identity and could affect hub-level settings if users want to configure their instance domain.

## Functional Requirements

### User Stories
1. As an instance admin, I want to enable federation for my MyForums instance so communities can connect to the broader fediverse.
2. As a community mod, I want to toggle federation for my community so its threads and replies are visible to other instances.
3. As a user, I want to follow communities on other MyForums (or Lemmy) instances so I see their content in my feed.
4. As a user, I want my posts in federated communities to be visible to users on other instances.
5. As an instance admin, I want to block specific instances to protect my users from spam or harmful content.

### Behavior Specification

1. **Instance identity setup:** The instance admin configures the domain (e.g., `forums.mylife.app`) in hub settings. This generates a server-level RSA keypair stored in Supabase secrets. WebFinger and NodeInfo endpoints are deployed as Next.js API routes.
2. **WebFinger discovery:** When an external instance queries `/.well-known/webfinger?resource=acct:username@forums.mylife.app`, the endpoint returns the user's ActivityPub actor URL. This enables user discovery across the fediverse.
3. **Community federation toggle:** Mods can enable federation per-community in community settings. When enabled:
   - The community gets a federation_uri (e.g., `https://forums.mylife.app/ap/community/general`)
   - An ActivityPub Actor is created for the community (type: Group)
   - The community becomes discoverable by other instances
4. **Outgoing activities:** When a user creates a thread/reply in a federated community:
   - A `Create` activity is generated with the content as an ActivityPub `Note` (reply) or `Page` (thread)
   - The activity is queued in fr_federation_queue
   - The outbox Edge Function processes the queue: signs the activity with HTTP Signatures, delivers to all follower instance inboxes
   - Votes generate `Like`/`Undo` activities
   - Edits generate `Update` activities
   - Deletions generate `Delete` activities
5. **Incoming activities:** The federation-inbox Edge Function receives activities at `/.well-known/inbox`:
   - Validates HTTP Signature against the sender's public key
   - Resolves the actor if not cached in fr_federated_actors
   - Routes by activity type: `Create` -> new thread/reply, `Like` -> vote, `Delete` -> removal, `Follow` -> community subscription
   - Content is stored in fr_threads/fr_replies with federation_uri and federation_instance_id populated
6. **Remote community following:** Users can enter a federated community handle (e.g., `general@lemmy.world`) in the search bar. The system resolves the community via WebFinger, fetches its recent content, and adds it to the user's feed. A `Follow` activity is sent to the remote instance.
7. **Federated content display:** Threads and replies from federated instances show an instance badge (e.g., small "from lemmy.world" tag) below the author name. Federated author profiles link to their remote profile page (opens in-app browser).
8. **Instance blocking:** Admins can block instances in admin settings. Blocked instances:
   - Incoming activities are rejected at the inbox
   - Existing content from the blocked instance is hidden (soft filter, not deleted)
   - No outgoing activities are sent to blocked instances
9. **Instance allowlist:** For restricted federation, admins can enable allowlist mode where only explicitly approved instances can federate. Default is open federation (anyone can connect).
10. **Queue processing:** The outbox Edge Function runs on a schedule (every 30 seconds). Failed deliveries retry with exponential backoff (1m, 5m, 30m, 2h, 12h). After max_attempts (5), the activity is marked `dead` and an admin alert is logged.

### Edge Cases

- **Instance goes offline:** Outbound deliveries fail and queue for retry. After 5 attempts over ~15 hours, marked dead. When the instance comes back, it can re-fetch via outbox polling.
- **Spoofed activity:** HTTP Signature validation rejects activities not signed by the claimed actor's key. Public key is fetched from the actor's published keyId URL and cached.
- **Massive remote community:** Following a very active federated community could flood the local feed. Rate limiting: max 100 activities per remote community per hour. Excess activities are dropped with a log entry.
- **Schema mismatch:** Lemmy and MyForums may have different field limits or content types. The transforms layer maps between formats, truncating or adapting as needed. Unknown fields are ignored (forward compatibility).
- **Deleted remote user:** If a remote actor is deleted, incoming `Delete` activities for the actor mark their content as "[deleted]" locally (same as local user deletion).
- **Domain change:** If the local instance domain changes, all federation_uri values break. This requires a migration script to update URIs and re-announce to federated instances. Document as a manual admin operation.
- **Content moderation across instances:** Each instance applies its own moderation. A thread removed on the origin instance sends a `Delete` activity. A thread reported on a receiving instance is only hidden locally (the origin instance is not notified).
- **Hot start:** When federation is first enabled for a community with existing threads, the system does NOT backfill. Only new content is federated. Historical content can be manually federated via an admin "backfill" action.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Instance admin can configure the instance domain for federation
- [ ] **AC-2:** Community mods can toggle federation on/off per community in settings
- [ ] **AC-3:** Federated communities show a "federated" badge in the community header
- [ ] **AC-4:** Users can search for and follow communities on remote instances via handle (e.g., `general@lemmy.world`)
- [ ] **AC-5:** Threads and replies from remote instances appear in the feed with instance origin badge
- [ ] **AC-6:** Remote author names link to their federated profile (opens in-app browser)
- [ ] **AC-7:** Instance admin can block specific instances in admin settings
- [ ] **AC-8:** Blocked instance content is hidden from all users on the local instance
- [ ] **AC-9:** Local posts in federated communities are visible to users on remote instances

### Technical Criteria
- [ ] **TC-1:** WebFinger endpoint at `/.well-known/webfinger` returns correct ActivityPub actor URIs
- [ ] **TC-2:** NodeInfo endpoint at `/.well-known/nodeinfo` returns instance metadata
- [ ] **TC-3:** HTTP Signatures are validated on all incoming activities
- [ ] **TC-4:** Outgoing activities are signed with the instance's RSA keypair
- [ ] **TC-5:** Federation queue processes activities with exponential backoff retry
- [ ] **TC-6:** Dead activities (5 failed attempts) are logged and stop retrying
- [ ] **TC-7:** ActivityPub Create/Update/Delete/Like/Undo/Follow/Accept activities are handled correctly
- [ ] **TC-8:** Federated content is stored with federation_uri and federation_instance_id for origin tracking
- [ ] **TC-9:** Remote actor public keys are fetched, validated, and cached in fr_federated_actors
- [ ] **TC-10:** Rate limiting caps incoming activities at 100 per remote community per hour

### Negative Criteria
- [ ] **NC-1:** Activities from blocked instances must NOT be processed or stored
- [ ] **NC-2:** Activities with invalid HTTP Signatures must NOT be accepted
- [ ] **NC-3:** Federation must NOT expose private community content (only public and federated communities are visible)
- [ ] **NC-4:** Federation must NOT send activities for communities where federation is disabled
- [ ] **NC-5:** Historical content must NOT be backfilled automatically (admin-triggered only)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Federation toggle in community settings: standard iOS-style switch with `#F43F5E` accent
- Instance badge: small pill below author name, `rgba(255,255,255,0.04)` glass background, 10px text showing "from lemmy.world"
- Federated community badge: small globe icon next to community name
- Admin settings: dedicated "Federation" section in hub settings (not community settings) for instance-level config
- Blocked instances list: standard list with swipe-to-unblock

### Web (Next.js)

- Same tokens via CSS variables
- Federation settings accessible via community settings page
- WebFinger/NodeInfo: API routes at `.well-known/*`
- Instance badge: inline text with subtle border
- Admin federation dashboard: table of known instances with status, last seen, block/allow actions

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Resolving remote community..." spinner | Searching for federated community |
| Empty | "No federated content yet" in feed section | Federation enabled but no remote content received |
| Error | "Could not reach remote instance" with retry | Remote instance offline or DNS failure |
| Success | Mixed local and federated content in feed with origin badges | Federation active and content flowing |
| Partial | Some federated content visible, queue status shows pending deliveries | Outbox processing or remote instance slow |

## Test Requirements

### Unit Tests
- [ ] WebFinger response: correct JSON structure for known users
- [ ] WebFinger response: 404 for unknown users
- [ ] HTTP Signature generation: produces valid signature header
- [ ] HTTP Signature validation: accepts valid signatures, rejects invalid
- [ ] ActivityPub transforms: MyForums Thread -> ActivityPub Page
- [ ] ActivityPub transforms: ActivityPub Note -> MyForums Reply
- [ ] ActivityPub transforms: handles missing optional fields gracefully
- [ ] Queue retry logic: exponential backoff with correct intervals
- [ ] Queue retry logic: marks dead after max_attempts
- [ ] Rate limiter: allows 100 activities, rejects 101st from same community
- [ ] Instance block check: rejects activities from blocked domains

### Integration Tests
- [ ] Full outbound flow: create thread in federated community -> activity queued -> signed and delivered
- [ ] Full inbound flow: receive valid Create activity -> thread appears in local community
- [ ] Follow flow: search remote community -> send Follow -> receive Accept -> content starts flowing
- [ ] Block flow: block instance -> existing content hidden -> new incoming activities rejected
- [ ] Edit flow: edit local thread -> Update activity sent to followers
- [ ] Delete flow: delete local thread -> Delete activity sent to followers

### QA Verification Script

1. Set up two test instances (Instance A at test-a.local, Instance B at test-b.local)
2. On Instance A: configure federation domain in admin settings -- corresponds to AC-1
3. On Instance A: create a community "test-community", enable federation -- corresponds to AC-2
4. Verify: community shows "federated" badge -- corresponds to AC-3
5. On Instance B: search for `test-community@test-a.local`
6. Verify: community appears in search results -- corresponds to AC-4
7. On Instance B: follow the remote community
8. On Instance A: create a thread in the federated community
9. Verify on Instance B: thread appears in feed with "from test-a.local" badge -- corresponds to AC-5, AC-9
10. On Instance B: click the remote author name
11. Verify: opens remote profile page -- corresponds to AC-6
12. On Instance A: reply to the thread
13. Verify on Instance B: reply appears in real-time (or within 30s queue cycle)
14. On Instance B admin: block Instance A -- corresponds to AC-7
15. Verify: all content from Instance A disappears from feed -- corresponds to AC-8
16. On Instance A: create another thread
17. Verify on Instance B: thread does NOT appear -- corresponds to NC-1
18. On Instance B admin: unblock Instance A
19. Verify: previously hidden content reappears
20. Check `/.well-known/webfinger?resource=acct:testuser@test-a.local`
21. Verify: valid JSON response with actor URI -- corresponds to TC-1
22. Check `/.well-known/nodeinfo`
23. Verify: valid NodeInfo response -- corresponds to TC-2

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to federation settings, toggle federation, view federated content
- [ ] Batch QA: after 5 features in forums module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec before building (Complexity = 0, mandatory)

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization (Complexity = 0, mandatory)

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for ActivityPub transforms and queue processing

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyForums is a fully centralized platform. All communities, threads, and users exist on a single Supabase instance. No ability to connect with external community platforms or self-hosted instances.

### After This Work
ActivityPub federation: WebFinger user discovery, HTTP Signature authentication, bidirectional content federation (Create/Update/Delete/Like/Follow activities), remote community following, federated content display with origin badges, instance blocking, allowlist mode, and queue-based reliable delivery with retry. Compatible with Lemmy and other ActivityPub-compliant platforms.

### Files Changed
- `modules/forums/src/types.ts` -- Added FederatedInstance, FederatedActor, ActivityPubObject schemas
- `modules/forums/src/cloud/schema.sql` -- Added fr_federated_instances, fr_federated_actors, fr_federation_queue tables; added federation columns to fr_threads, fr_replies, fr_communities
- `modules/forums/src/cloud/client.ts` -- Added federated content resolution functions
- `modules/forums/src/federation/activitypub.ts` -- ActivityPub protocol implementation
- `modules/forums/src/federation/webfinger.ts` -- WebFinger discovery
- `modules/forums/src/federation/http-signatures.ts` -- HTTP Signature generation and validation
- `modules/forums/src/federation/resolver.ts` -- Remote actor/object resolution
- `modules/forums/src/federation/outbox.ts` -- Outgoing activity queue processor
- `modules/forums/src/federation/inbox.ts` -- Incoming activity handler
- `modules/forums/src/federation/transforms.ts` -- MyForums to ActivityPub transformers
- `supabase/functions/federation-inbox/index.ts` -- Edge Function for receiving activities
- `supabase/functions/federation-outbox/index.ts` -- Edge Function for processing outbox queue
- `apps/web/app/.well-known/webfinger/route.ts` -- WebFinger endpoint
- `apps/web/app/.well-known/nodeinfo/route.ts` -- NodeInfo endpoint

### Known Limitations
- No E2E encryption for federated content (ActivityPub does not natively support it)
- No federated DMs in v1 (only public community content federates)
- No federated voice channels (voice is always local)
- No migration tooling for moving communities between instances
- No federated moderation actions (mod actions are instance-local only)
- Mesh topology: each instance talks to every other instance directly (no relay infrastructure)
- Performance at scale: each federated community generates HTTP requests to every follower instance per activity. Large communities with many follower instances may create significant outbound traffic.

### Context for Next Agent
Federation is the most architecturally complex feature in the forums module. The `federation/` directory is designed as a standalone subsystem that can be extracted into its own package (`@mylife/federation`) if other modules need federation in the future. HTTP Signatures are the security-critical path: any bug in signature validation opens the system to spoofed content. The ActivityPub spec is large; prioritize compatibility with Lemmy first (largest federated forum platform) and Mastodon second (largest fediverse platform). Test with a local Lemmy instance during development.
