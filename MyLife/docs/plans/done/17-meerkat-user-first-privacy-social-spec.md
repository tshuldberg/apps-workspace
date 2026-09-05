# 17 - Meerkat: User-First Privacy Social Product Spec

| Field | Value |
|-------|-------|
| Status | Draft for founder review |
| Owner | Meerkat |
| Date | 2026-06-23 |
| Scope | `apps/meerkat`, `apps/meerkat-web`, `packages/sync`, `packages/meerkat-relay` |
| Product bar | iOS App Store quality, simple enough for an 8-year-old to join and use |

## Mission

Meerkat is a paid, privacy-first social app for friends, communities, posts,
messages, and files. It should feel as easy as Discord to join and use, while
keeping privacy and user control as the core product promise.

The network, relay, node, sync, and encryption layer stays real, but it is not the
main interface. Users should not need to understand relays, nodes, sync sessions,
transport rungs, host registries, or seeding. They should understand:

1. Who can see this?
2. Where do I post or reply?
3. What is new?
4. Who am I connected to?
5. What do I want my feed to show?

The product promise:

> Meerkat lets you talk, post, follow, join communities, and share files while
> staying in control of who can see what.

## Locked Product Decisions

These decisions are accepted founder direction for this spec.

1. **Paid app:** Meerkat is a one-time $4.99 app purchase.
2. **Privacy-first:** Users and privacy are the focus. The app is not a crypto UI
   and not a network dashboard.
3. **Simple social shape:** The user mental model is Discord-simple: join a
   community, read channels, post, reply, message friends, and share files.
4. **Hosted public reach costs money:** Public feeds, public community hosting,
   always-on hosted servers, public data storage, and cloud backups create real
   storage, bandwidth, and moderation expense. These are paid services.
5. **Friends and followers both matter:** Friends are the private trust graph.
   Followers are the lightweight social graph. Final scope and sequencing still
   need founder decision.
6. **Encrypted and anonymous options matter:** The product should support private,
   encrypted, pseudonymous, and anonymous-feeling usage where appropriate. The
   exact abuse and moderation model needs final founder decision.
7. **Plain privacy scopes:** The interface can show simple audience labels.
   Examples: `Only me`, `Friends`, `Connections`, `Followers`, `This community`,
   `Selected people`, `Public`.
8. **Original poster controls the thread:** Every post has audience rules chosen
   by the original poster. Replies inherit those rules. If a post is visible only
   to friends or connections, replies stay inside that audience too.
9. **User-controlled feed:** The feed is not a black-box engagement machine.
   Users can choose sources, filters, and ranking behavior.

## Product Principles

### 1. Privacy Is The Interface

Privacy cannot live in advanced settings. Every composer, reply box, file share,
DM, and community post needs a visible audience control.

Bad:

- "Encrypted shared_workspace scope"
- "Published blob"
- "Relay-hosted public object"

Good:

- "Only friends can see this"
- "Replies stay private"
- "This community can see this"
- "Public, uses hosted storage"

### 2. The App Hides Infrastructure

Normal users should never see "relay", "node", "transport", "seed", "sync
session", or "host registry" in the primary experience.

Allowed in normal UI:

- `Sent`
- `Saved`
- `Backed up`
- `Waiting for connection`
- `Available offline`
- `Hosted for this community`

Allowed in advanced settings:

- relay URL
- local node status
- transport path
- storage diagnostics
- sync history

### 3. The Feed Obeys The User

The feed starts simple and becomes configurable.

Default feed modes:

- `For You`: a saved mix the user controls
- `Friends`: friends and connection-only posts
- `Communities`: joined community posts and selected channel highlights
- `Unread`: new messages, replies, mentions, files, and posts
- `Public`: only if public hosted sources are enabled

Plain filter controls:

- People
- Friends
- Followers
- Communities
- Posts
- Chats
- Files
- Unread
- Private
- Public

Do not start with "algorithm settings." Start with "What do you want to see?"

### 4. Public Is Paid Because Public Has Cost

The $4.99 app should cover private local use and the right to use the product.
Public reach and hosted durability are not free by default.

Paid services can include:

- hosted public community feed
- always-on community history
- hosted files and media
- cloud backup of local data
- hosted community node
- public discovery
- larger mailbox retention
- higher storage and bandwidth limits

### 5. Replies Inherit The Original Privacy Rule

When someone replies to a post, the reply cannot expand the audience.

Examples:

- Original post: `Friends`
  - Replies: friends only.
- Original post: `This community`
  - Replies: members who can see the original post.
- Original post: `Selected people`
  - Replies: selected people only.
- Original post: `Public`
  - Replies: public, subject to moderation and hosted cost rules.

This is the user trust model. Breaking it would make the product unsafe.

## Target Users

### Primary V1 Users

- Friend groups that want private posting and chat.
- Families that want simple private spaces.
- Small communities, teams, clubs, and creator groups.
- Privacy-conscious users who do not want central-platform data mining.
- Users who want a social feed they can control.

### Not The V1 Target

- Children as the literal audience. "8-year-old usable" is the simplicity bar,
  not a child-safety launch claim.
- Fully public social media at internet scale.
- Anonymous public message boards.
- Crypto users looking for token mechanics.
- Enterprise compliance buyers.

## Product Shape

### Primary Navigation

Recommended V1 tab structure:

1. **Feed**
2. **Communities**
3. **Messages**
4. **Friends**
5. **Me**

Advanced node/settings surfaces should move under `Me` or `Settings`, not the
primary tab bar.

### First-Run Onboarding

The onboarding goal is one successful connection or community join in under 60
seconds.

Steps:

1. Welcome: "Private social, controlled by you."
2. Name: choose a friendly name.
3. Friend code: show a simple shareable code.
4. Join or invite:
   - scan QR
   - paste invite link
   - share your code
   - create a community
5. First action:
   - send first message
   - make first post
   - add first friend

No relay setup in onboarding.
No manual sync concept in onboarding.
No cryptographic vocabulary in onboarding.

### Communities

Communities should feel like Discord:

- community icon
- member list
- channels
- posts
- files
- invite link
- roles, hidden until needed
- moderation, hidden until needed

V1 channel types:

- chat channel
- announcement channel
- files channel or files view
- posts view

Later:

- voice/video
- screen share
- bots/agents
- public directory

### Messages

Messages includes:

- 1:1 DMs
- group DMs
- message requests
- friend requests
- recent conversations

Important privacy rule:

DMs are private conversations. They should never appear in public feeds. They can
appear in the user's own `Unread` or `Messages` feed if the user chooses.

### Friends And Followers

Friends and followers solve different jobs.

#### Friends

Friends are mutual trust relationships.

Pros:

- clear privacy boundary
- safer for private posts
- works well for family and close friends
- supports private DMs and connection-only replies
- easier mental model for nontechnical users

Cons:

- slower growth
- more friction
- less useful for creators and public communities

Recommended use:

- private posts
- private replies
- DMs
- file sharing
- family and close-group communities

#### Followers

Followers are lightweight one-way relationships.

Pros:

- better for creators
- better for discovery
- useful for public or semi-public communities
- supports personalized feeds
- lets users keep up without mutual approval

Cons:

- privacy is harder to explain
- moderation costs rise
- public storage costs rise
- abuse risk is higher

Recommended use:

- public posts
- community announcements
- creator-style updates
- feed personalization

#### Recommendation

Build both concepts, but sequence carefully:

- V1: Friends as the default private trust graph.
- V1.1: Followers for public and creator-style behavior.
- V1.1 or V1.2: Public discovery and paid hosted public feeds.

Founder decision needed: whether followers ship in V1 or V1.1.

## Audience Rules

Every post, reply, file, and message has an audience.

### Required V1 Audience Labels

| Label | Meaning | Reply Rule |
|-------|---------|------------|
| `Only me` | Private draft or saved item | No replies |
| `Friends` | Mutual friends can see it | Replies stay friends-only |
| `Connections` | Friends plus selected trusted connections | Replies stay inside original audience |
| `Selected people` | Manually chosen people | Replies stay inside selected audience |
| `This community` | Members with access to the channel/post | Replies stay in that community scope |
| `Public` | Anyone with public access can see it | Replies public and hosted-cost eligible |

### Composer Behavior

The composer must show:

- current audience
- one-sentence explanation
- whether replies inherit the same audience
- whether hosted storage or public fees may apply

Example:

```text
Audience: Friends
Only your friends can see this. Replies stay friends-only.
```

Public example:

```text
Audience: Public
Anyone can see this. Public posts use hosted storage.
```

### Invalid Actions

The app must block:

- replying publicly to a private post;
- forwarding private thread replies into public surfaces;
- showing private DMs in public feed views;
- adding non-members to a private community thread without explicit poster/admin
  permission;
- expanding audience after replies exist, unless the original poster confirms a
  clear warning.

## Feed Spec

### Feed Goal

The feed answers:

> What do I want to see right now?

It should not optimize for addiction. It should optimize for user intent.

### Feed Sources

V1 sources:

- posts by friends
- posts in joined communities
- replies to the user's posts
- mentions
- unread community messages
- files shared with the user
- selected DMs and group DMs, only in private feed modes

V1.1 sources:

- followed users
- followed communities
- public community posts
- creator announcements

V1.2 sources:

- public directory recommendations
- agent-curated saved feeds
- cross-community topic feeds

### Feed Controls

Layer 1, simple toggles:

- Friends
- Communities
- Messages
- Posts
- Files
- Unread
- Public

Layer 2, saved feeds:

- "Family"
- "Work"
- "Close friends"
- "Announcements"
- "Files I need"
- "Public communities"

Layer 3, natural language:

- "Show me posts from hiking communities but no group chats"
- "Show unread files from work communities"
- "Only close friends and family"

Layer 3 depends on the feed engine, saved feed format, and privacy-safe local
ranking. It is not a launch requirement.

### Feed Ranking

Default ranking should be explainable.

Signals:

- unread first
- direct replies to me
- mentions
- close friends
- pinned communities
- recent activity
- saved feed preference

Do not rank based on server-readable content. If content is encrypted and local
only, ranking should happen locally on the device after decryption.

### Feed Item Types

V1 feed items:

- post
- reply
- community message highlight
- DM unread card
- file card
- mention card
- invite/request card

Each item shows:

- who posted
- where it came from
- audience label
- why it is in the feed
- quick action

Example:

```text
Alex in Family
Friends only
Shown because you follow Alex
```

## Anonymous And Pseudonymous Use

The product should support privacy-preserving identity without becoming an abuse
engine.

### Option A: Per-Community Pseudonyms

Users can have different display names and avatars per community.

Pros:

- strong privacy for sensitive communities
- easier moderation than full anonymity
- good for health, recovery, local groups, creator fandoms
- aligns with existing community profile direction

Cons:

- less anonymous than some users may want
- requires community-level profile controls

Recommendation: ship this first.

### Option B: Anonymous Posting Inside A Community

Community owners can allow anonymous posts where members do not see the poster's
normal name.

Pros:

- useful for sensitive topics
- can make communities safer for vulnerable users
- still tied to a real member identity for local enforcement

Cons:

- moderation burden
- abuse risk
- needs clear owner controls

Recommendation: allow this only as a community setting, off by default.

### Option C: Global Anonymous Identity

Users can publish through a global anonymous identity not tied to a community
profile.

Pros:

- strongest user privacy feel
- powerful for public whistleblowing or sensitive public posting

Cons:

- highest abuse risk
- hardest moderation and reporting model
- higher App Store and legal scrutiny

Recommendation: do not ship in V1.

Founder decision needed: whether Option B ships in V1 or V1.1.

## Monetization

### Base Product

One-time app purchase:

- $4.99
- unlocks the app
- includes local private use
- includes joining and creating private communities
- includes local encrypted storage
- includes private posts, friends, DMs, and files within device/local limits

### Paid Hosted Services

Paid services are tied to real costs:

- hosted relay capacity
- hosted community history
- public feed hosting
- cloud backup
- large files
- long retention
- always-on community node
- public discovery

Possible packaging:

| Plan | Buyer | Includes |
|------|-------|----------|
| Personal Backup | Individual | encrypted backup, roaming, recovery |
| Community Host | Community owner | always-on history, files, mailbox retention |
| Public Reach | Poster or community | public posts, public feed inclusion, discovery |
| Plus | Individual | higher limits, hosted convenience, optional identity/account features |

Founder decision needed: exact plan names, price points, and who pays for public
reach.

## User Experience Requirements

### Apple-Level Simplicity Bar

Every primary action should be obvious without reading docs:

- join community from link
- scan QR
- add friend
- post
- reply
- change audience
- filter feed
- send file
- mute/block/report
- back up account

If a user must understand the network model to complete a normal action, the UI
has failed.

### Copy Rules

Use:

- "Who can see this?"
- "Replies stay private"
- "Saved on your device"
- "Backed up"
- "Waiting for connection"
- "Hosted for this community"

Avoid:

- relay
- node
- transport
- mesh
- ciphertext
- shared_workspace
- published_blob
- sync session

Advanced settings can expose technical detail, but primary flows cannot.

### Safety States

The app must clearly show:

- private
- public
- backed up
- not backed up
- waiting
- sent
- failed
- hosted
- local only

The app must never show:

- fake online counts
- fake delivery
- fake public reach
- fake backup status
- fake "connected to mesh"

## Data And Protocol Requirements

This section is intentionally product-facing. It names required behavior, not
exact implementation.

### Post Entity

Every post needs:

- id
- author identity
- author display identity for the target audience
- body
- attachments
- audience rule
- reply rule
- created timestamp
- edited/deleted state
- source community or DM context
- public/hosted requirement flag

### Audience Rule

Every audience rule needs:

- audience type
- allowed viewers
- allowed reply writers
- whether replies inherit scope
- whether audience can be expanded later
- whether hosted storage is required
- whether public moderation rules apply

### Feed Item

Every feed item needs:

- source type
- source id
- item type
- audience label
- reason shown
- local ranking score
- unread state
- mute/block/report status

### Privacy Invariant

No receiver should be able to see a post, reply, file, or feed card unless the
original audience rule allows that receiver.

This must be enforced below the UI. The UI is not the security boundary.

## V1 Scope

V1 should ship:

- $4.99 paid app
- simple onboarding
- friend codes and invite links
- communities
- channels
- friends
- private posts
- replies that inherit audience
- user-controlled feed, layer 1 toggles
- private files
- DMs if engineering confirms schema reuse is clean
- pseudonymous community profiles
- local encrypted storage
- hosted services surfaced only when needed
- plain audience labels everywhere

V1 should not ship:

- public directory
- global anonymous identity
- black-box recommendations
- voice/video
- bots/agent posting
- payments between users
- public internet-scale feed

## V1.1 Scope

V1.1 should add:

- followers
- followed-user feed source
- followed-community feed source
- public community posts behind paid hosted capacity
- saved feed presets
- community-owner hosted storage plans
- optional anonymous posting per community, if approved

## V1.2 Scope

V1.2 should add:

- public discovery directory
- creator/community public profiles
- agent-created saved feeds
- stronger moderation workflows
- community verification badges
- larger public-hosted feed surfaces

## Decision Matrix For Founder Review

### Friends And Followers

| Option | Scope | Pros | Cons | Recommendation |
|--------|-------|------|------|----------------|
| Friends only in V1 | Ship private trust graph first | safest, simplest | weaker discovery | Good if speed matters |
| Friends + followers in V1 | Ship both graphs | better social product | more complexity | Best if feed is core on day one |
| Followers in V1.1 | Sequence after private launch | lower risk | delayed creator behavior | Recommended default |

### Anonymous Use

| Option | Scope | Pros | Cons | Recommendation |
|--------|-------|------|------|----------------|
| Per-community pseudonyms | V1 | privacy with accountability | needs profile controls | Recommended |
| Community anonymous mode | V1.1 or gated V1 | powerful for sensitive groups | abuse risk | Founder decision |
| Global anonymous identity | Later | strongest privacy | highest abuse and legal risk | Defer |

### Public Content

| Option | Scope | Pros | Cons | Recommendation |
|--------|-------|------|------|----------------|
| No public content V1 | private-first launch | safest, cheapest | less growth | Recommended |
| Public links only | limited public reach | easy sharing | weak discovery | Good V1.1 |
| Public directory | broad discovery | growth | moderation and storage cost | V1.2 |

### Feed Messages

| Option | Scope | Pros | Cons | Recommendation |
|--------|-------|------|------|----------------|
| Posts only by default | clean feed | misses chats | Recommended default |
| Include unread chats | useful | can feel noisy | user toggle |
| Include DMs | convenient | privacy-sensitive | private feed modes only |

## Acceptance Criteria

### Onboarding

- A new user can join a community from an invite link without seeing relay/node
  language.
- A new user can add a friend with a code or QR.
- A new user can post or send a message within 60 seconds.

### Privacy

- Every composer shows an audience label.
- Every reply inherits the original post audience.
- A private post cannot be made public by a reply.
- DMs never appear in public feeds.
- A public post clearly indicates hosted storage/reach.

### Feed

- Feed tab exists.
- User can toggle at least friends, communities, posts, chats, files, unread.
- Every feed item shows where it came from and why it is shown.
- Muted/blocked sources disappear from feed.

### Communities

- Community join feels like Discord-simple.
- Channels, posts, files, and members are easy to find.
- Advanced privacy/network state is not required to participate.

### Monetization

- App purchase is $4.99.
- Public or hosted data features show paid-service copy before use.
- Hosted storage cost is not hidden behind "free" language.

## Implementation Slices

### Slice 1: Information Architecture And Copy

Move Meerkat from node-first tabs to user-first tabs:

- Feed
- Communities
- Messages
- Friends
- Me

Rewrite user-facing copy to remove network language from primary surfaces.

### Slice 2: Audience Rule UI

Add a reusable audience selector and privacy label used by:

- post composer
- reply composer
- file share
- community post
- DM/group DM

### Slice 3: Post And Reply Product Surface

Build the consumer post UI on top of the existing MK-P01 post schema:

- post composer
- post card
- thread view
- reply inheritance
- edit/delete
- reactions later if ready

### Slice 4: Feed Engine Layer 1

Build a local feed engine with:

- source toggles
- unread state
- simple local ranking
- explainable feed reason
- mute/block/report filtering

### Slice 5: Friends And Messages

Ship the private graph:

- friend requests
- friend list
- 1:1 DM
- group DM if schema reuse is clean
- friends-only posts

### Slice 6: Paid Hosted Boundaries

Add product gates for:

- hosted backup
- hosted community history
- public posts
- public feed inclusion
- larger file/storage limits

### Slice 7: Polished Onboarding

Ship the 60-second first-use path:

- name
- friend code
- join/create
- first post/message
- feed appears populated

## Open Questions For Founder

1. Should followers ship in V1, or should V1 be friends-first with followers in
   V1.1?
2. Should community anonymous posting ship in V1, or wait until moderation tools
   are stronger?
3. Who pays for public reach: poster, community owner, viewer subscription, or a
   mix?
4. Should DMs be required in V1, or can V1 launch with friends, communities,
   posts, and group/community chat first?
5. Should the default feed include unread chat messages, or should chat messages
   be opt-in feed sources?
6. What is the first bellwether community for design and dogfood: family, friend
   group, creator community, club/team, or public interest community?
7. Should public links exist before the public directory?

## Recommended Founder Defaults

If no further decision is made, build this:

1. V1 is friends-first, private-first.
2. Followers wait until V1.1.
3. Per-community pseudonyms ship in V1.
4. Anonymous community posting waits until V1.1.
5. Public directory waits until V1.2.
6. Feed defaults to posts, replies, unread, files, and selected community
   highlights. DMs and raw chat streams are opt-in.
7. Public reach and hosted storage are paid services.
8. Every post and reply carries a visible audience rule.

This keeps the user promise sharp: simple social software where privacy is the
default, the user controls the feed, and public reach is paid because public reach
has real cost.
