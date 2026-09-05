# MyForums - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-10
> **Status:** Draft
> **Author:** Claude (module-dev agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyForums
- **Tagline:** Community discussions, your way
- **Module ID:** `forums`
- **Feature ID Prefix:** `FR`
- **Table Prefix:** `fr_`
- **Accent Color:** `#F43F5E` (rose)
- **Icon:** `💬`
- **Storage Type:** `supabase` (multi-user, networked)
- **Tier:** `premium`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Community Builder | Ages 20-40, wants to host topic-focused discussions | Create and moderate boards, build engaged communities around shared interests |
| Casual Participant | Ages 18-50, browses and comments occasionally | Read interesting discussions, reply when motivated, follow topics they care about |
| Cross-Module Enthusiast | Active MyLife user across books/recipes/workouts | Discuss books they read, share workout advice, exchange recipes with other MyLife users |
| Privacy Advocate | Any age, left Reddit/Twitter over data concerns | Participate in discussions without algorithmic manipulation, tracking, or ad targeting |
| Knowledge Sharer | Ages 25-55, enjoys teaching and helping others | Write detailed answers, build reputation through helpful contributions |

### 1.3 Core Value Proposition

MyForums is a privacy-first community discussion platform that lives inside the MyLife hub. It provides Reddit-style boards and threaded discussions without ads, tracking, algorithmic manipulation, or engagement-maximizing dark patterns. Users can create communities around any topic, with first-class integration to other MyLife modules (book clubs, recipe sharing, workout advice, surf conditions, etc.).

Unlike Reddit, MyForums does not:
- Sell user data or browsing habits to advertisers
- Use algorithms to amplify outrage or maximize engagement time
- Show targeted ads between posts
- Track reading behavior for recommendation engines
- Employ infinite scroll dark patterns or notification spam

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Reddit | Massive community, broad topic coverage, mature moderation tools | Ads, algorithmic feed manipulation, data harvesting, hostile API pricing | Zero ads, no algorithmic manipulation, privacy-first |
| Discourse | Self-hosted option, excellent moderation, trust levels | Requires server setup, no mobile-first experience, complex admin | Built into MyLife hub, mobile-first, zero setup |
| Lemmy/Fediverse | Decentralized, open source, no corporate control | Fragmented communities, inconsistent UX, steep learning curve | Unified hub experience, consistent UX, integrated with other modules |
| Discord | Real-time chat, voice, screen sharing | Not threaded (chat UX, not forum UX), requires account, data collection | Threaded forum model (better for lasting discussions), privacy-first |
| Hacker News | Clean interface, quality discussion culture | No topic boards, limited features, web-only | Topic boards, rich media, cross-platform, module integration |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- No analytics, no telemetry, no tracking of reading patterns or browsing behavior
- No advertising of any kind; no data sold to third parties
- No algorithmic feed manipulation: feeds are sorted chronologically or by community vote, never by an engagement-maximizing algorithm
- Users control their visibility: post publicly, to followers only, or anonymously within communities
- Moderation is community-driven by elected moderators, not by an opaque content algorithm
- Community data belongs to community members, not to a platform
- All social features require an explicit opt-in via the `@mylife/social` profile system
- Users can export their full posting history at any time
- Account deletion removes all content (hard delete, not soft archive)

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| FR-001 | Communities (Boards) | P0 | Core | None | Not Started |
| FR-002 | Threads (Posts) | P0 | Core | FR-001 | Not Started |
| FR-003 | Replies (Threaded Comments) | P0 | Core | FR-002 | Not Started |
| FR-004 | Voting System | P0 | Core | FR-002, FR-003 | Not Started |
| FR-005 | User Profiles (Social Integration) | P0 | Core | @mylife/social | Not Started |
| FR-006 | Categories and Tags | P1 | Organization | FR-001 | Not Started |
| FR-007 | Full-Text Search | P1 | Discovery | FR-002 | Not Started |
| FR-008 | Community Moderation | P1 | Moderation | FR-001, FR-005 | Not Started |
| FR-009 | User Reputation (Karma) | P1 | Social | FR-004, FR-005 | Not Started |
| FR-010 | Notifications | P1 | Engagement | FR-003, FR-005 | Not Started |
| FR-011 | Cross-Module Boards | P1 | Integration | FR-001 | Not Started |
| FR-012 | Rich Text (Markdown) | P0 | Core | FR-002 | Not Started |
| FR-013 | Media Attachments | P1 | Core | FR-002 | Not Started |
| FR-014 | Bookmarks and Saved Posts | P1 | User | FR-002, FR-005 | Not Started |
| FR-015 | User Blocking and Muting | P1 | Safety | FR-005 | Not Started |
| FR-016 | Content Reporting | P1 | Moderation | FR-002, FR-005 | Not Started |
| FR-017 | Community Rules | P1 | Moderation | FR-001 | Not Started |
| FR-018 | Pinned Threads | P1 | Moderation | FR-002, FR-008 | Not Started |
| FR-019 | Thread Locking | P1 | Moderation | FR-002, FR-008 | Not Started |
| FR-020 | User Flair | P2 | Social | FR-001, FR-005 | Not Started |
| FR-021 | Polls | P2 | Engagement | FR-002 | Not Started |
| FR-022 | Draft Posts | P2 | User | FR-002 | Not Started |
| FR-023 | Post History and Edit Log | P2 | Transparency | FR-002 | Not Started |
| FR-024 | Community Analytics (Mod Dashboard) | P2 | Moderation | FR-008 | Not Started |
| FR-025 | Activity Feed Integration | P1 | Social | FR-002, @mylife/social | Not Started |
| FR-026 | Share Cards | P2 | Social | FR-002, @mylife/social | Not Started |
| FR-027 | Leaderboard Integration | P2 | Social | FR-009, @mylife/social | Not Started |
| FR-028 | Data Export | P2 | User | FR-002 | Not Started |
| FR-029 | Onboarding | P2 | Onboarding | FR-001, FR-005 | Not Started |
| FR-030 | Settings | P1 | Settings | FR-005 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

---

## 3. Feature Specifications

### FR-001: Communities (Boards)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FR-001 |
| **Feature Name** | Communities (Boards) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a user, I want to create and join topic-focused communities, so that I can find and participate in discussions about subjects I care about.

**Secondary:**
> As a community creator, I want to configure my community's description, rules, and visibility, so that I can shape the culture and scope of discussions.

#### 3.3 Detailed Description

Communities are the top-level organizational unit in MyForums. They function similarly to subreddits on Reddit or categories on Discourse. Each community has a name, description, optional icon/banner image, and a set of rules defined by the creator.

Communities can be:
- **Public** - Anyone can view and join. Posts are visible to all authenticated users.
- **Restricted** - Anyone can view, but only approved members can post. Membership requires approval.
- **Private** - Only members can view or post. Membership is invite-only.

Each community has a creator (who becomes the first owner) and zero or more moderators. The creator can transfer ownership.

**Community settings:**
- Name (3-100 characters, unique across all communities, lowercase alphanumeric + hyphens)
- Display name (1-100 characters)
- Description (up to 1000 characters)
- Icon URL (optional, stored in Supabase Storage)
- Banner URL (optional)
- Community type (public / restricted / private)
- Categories (optional, see FR-006)
- Default sort order for threads (newest / top / active)
- Allow anonymous posting (boolean, default false)
- Linked module ID (optional, see FR-011)

#### 3.4 Prerequisites

**Feature Dependencies:** None (foundational feature)

**External Dependencies:**
- Supabase backend for multi-user data
- `@mylife/social` profile for community creation and membership

#### 3.5 Acceptance Criteria

- [ ] Users can create a community with name, description, and type
- [ ] Users can browse public communities in a directory
- [ ] Users can join public communities instantly
- [ ] Restricted communities show a "request to join" flow
- [ ] Private communities are only visible to members
- [ ] Community creator becomes owner with full admin rights
- [ ] Community settings are editable by owner and admins
- [ ] Communities display member count, thread count, and creation date

---

### FR-002: Threads (Posts)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FR-002 |
| **Feature Name** | Threads (Posts) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a community member, I want to create discussion threads with a title and body, so that I can start conversations and share content with the community.

**Secondary:**
> As a reader, I want to browse threads sorted by newest, top-voted, or most active, so that I can find the most relevant discussions.

#### 3.3 Detailed Description

Threads are the primary content unit within a community. Each thread has a title, body (markdown), and belongs to exactly one community. Threads can optionally be tagged (FR-006), pinned by moderators (FR-018), or locked to prevent new replies (FR-019).

**Thread types:**
- **Text** - Standard markdown post with optional inline images
- **Link** - URL share with optional commentary (auto-preview via unfurling)
- **Poll** - Question with voting options (FR-021)

**Thread fields:**
- Title (1-300 characters)
- Body (markdown, up to 40,000 characters)
- Thread type (text / link / poll)
- Link URL (for link type threads)
- Community ID
- Author profile ID
- Is anonymous (boolean, only if community allows it)
- Is pinned (moderator-controlled)
- Is locked (moderator-controlled)
- Tags (many-to-many via join table)
- Category (optional, if community uses categories)
- Vote score (denormalized)
- Reply count (denormalized)
- View count (denormalized, incremented server-side)

**Sorting options:**
- **Newest** - Chronological by creation date (default)
- **Top** - By vote score (day / week / month / year / all time)
- **Active** - By most recent reply

#### 3.4 Acceptance Criteria

- [ ] Users can create text, link, and poll threads within a community
- [ ] Thread body supports full markdown rendering (FR-012)
- [ ] Threads display title, author, vote score, reply count, and age
- [ ] Users can sort threads by newest, top, or active
- [ ] Users can edit their own threads (with edit history tracked)
- [ ] Users can delete their own threads (hard delete with confirmation)
- [ ] Moderators can pin, lock, and remove threads

---

### FR-003: Replies (Threaded Comments)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FR-003 |
| **Feature Name** | Replies (Threaded Comments) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a community member, I want to reply to threads and to other replies, so that I can participate in discussions and respond to specific points.

#### 3.3 Detailed Description

Replies use a threaded (nested) model where each reply can have a parent reply, forming a tree structure. The nesting depth is capped at 10 levels for readability; deeper replies are flattened to level 10 with a "replying to @handle" indicator.

**Reply fields:**
- Body (markdown, 1-10,000 characters)
- Thread ID
- Parent reply ID (null for top-level replies)
- Author profile ID
- Is anonymous (boolean, matches community setting)
- Depth (computed, 0 for top-level)
- Vote score (denormalized)
- Child count (denormalized)

**Quote support:** Users can quote specific text from the parent thread or reply using `> quoted text` markdown syntax. The UI provides a "quote reply" button that auto-populates the reply editor with the selected text.

#### 3.4 Acceptance Criteria

- [ ] Users can post top-level replies to threads
- [ ] Users can reply to existing replies (nested threading)
- [ ] Nesting caps at depth 10 with flattened display
- [ ] Reply body supports markdown
- [ ] Users can edit their own replies (with edit indicator)
- [ ] Users can delete their own replies
- [ ] Moderators can remove replies
- [ ] Reply count on thread updates automatically via trigger

---

### FR-004: Voting System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FR-004 |
| **Feature Name** | Voting System |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a community member, I want to upvote or downvote threads and replies, so that the best content rises to the top and low-quality content sinks.

#### 3.3 Detailed Description

Simple upvote/downvote system on both threads and replies. Each user can cast one vote per item (up or down). Votes are stored in a single `fr_votes` table using a polymorphic `target_type` column (`thread` or `reply`). The net vote score is denormalized on threads and replies for fast sorting.

**Design decisions:**
- Vote counts are public (total score visible), but individual votes are private (you cannot see who voted what)
- No vote fuzzing or score hiding
- Downvotes require a minimum reputation threshold (FR-009) to prevent abuse by new accounts. Initially set to 0 (no restriction) until the reputation system is implemented.
- Self-voting is blocked at the database constraint level

#### 3.4 Acceptance Criteria

- [ ] Users can upvote or downvote threads
- [ ] Users can upvote or downvote replies
- [ ] Tapping the same vote direction toggles it off (un-vote)
- [ ] Tapping the opposite direction switches the vote
- [ ] Vote score updates in real-time via Supabase Realtime
- [ ] Users cannot vote on their own content (constraint enforced)
- [ ] Net score is denormalized on threads/replies via trigger

---

### FR-005: User Profiles (Social Integration)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FR-005 |
| **Feature Name** | User Profiles (Social Integration) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 Detailed Description

MyForums uses the existing `@mylife/social` profile system rather than creating its own user profiles. When a user enters MyForums for the first time, they must have an active social profile (handle, display name, avatar). If they do not have one, they are prompted to create one.

**Forum-specific profile extensions:**
- Karma score (sum of all vote scores received on threads and replies)
- Thread count (number of threads authored)
- Reply count (number of replies authored)
- Communities joined (list)
- Member since (first forum activity date)

These are stored in a `fr_user_stats` table that references the `social_profiles.id`.

#### 3.3 Acceptance Criteria

- [ ] Forum features require an active `@mylife/social` profile
- [ ] Forum user stats are tracked in `fr_user_stats`
- [ ] Profile pages show karma, thread count, reply count, communities
- [ ] Clicking a username anywhere navigates to their profile

---

### FR-008: Community Moderation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FR-008 |
| **Feature Name** | Community Moderation |
| **Priority** | P1 |
| **Category** | Moderation |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a community moderator, I want tools to manage content and members, so that I can maintain a healthy discussion environment.

#### 3.3 Detailed Description

Each community has a moderation team with three role tiers:
- **Owner** - Full control (transfer ownership, delete community, manage all mods)
- **Admin** - Manage moderators, configure community settings, all mod powers
- **Moderator** - Remove/lock/pin threads, remove replies, ban/mute users

**Moderation actions:**
- Remove thread (soft delete, visible to mods with removal reason)
- Remove reply (soft delete)
- Lock thread (prevent new replies)
- Pin thread (sticky to top of community feed)
- Ban user from community (with duration: permanent, 1d, 7d, 30d)
- Mute user in community (can read but not post, with duration)
- Approve/reject membership requests (restricted communities)

**Moderation log:**
All moderation actions are logged in `fr_mod_actions` with the moderator's profile ID, action type, target, reason, and timestamp. This log is visible to all moderators of the community for transparency.

#### 3.4 Acceptance Criteria

- [ ] Owners can promote members to admin or moderator
- [ ] Moderators can remove threads and replies with a reason
- [ ] Moderators can lock and pin threads
- [ ] Moderators can ban and mute users with configurable duration
- [ ] All mod actions are logged and visible to the mod team
- [ ] Banned users see a clear message explaining the ban
- [ ] Muted users can read but get an error when trying to post

---

### FR-011: Cross-Module Boards

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FR-011 |
| **Feature Name** | Cross-Module Boards |
| **Priority** | P1 |
| **Category** | Integration |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a MyLife user, I want discussion boards that are linked to other modules I use, so that I can discuss books, recipes, workouts, and other topics with fellow users.

#### 3.3 Detailed Description

Communities can be optionally linked to a MyLife module via the `linked_module_id` field. Linked communities are surfaced within the host module's UI (e.g., a "Discuss" tab in MyBooks, a "Community" tab in MyRecipes).

**Pre-seeded module communities** (created by the system on first launch):

| Community | Linked Module | Description |
|-----------|---------------|-------------|
| `book-club` | `books` | Book discussions, reading recommendations, reviews |
| `recipe-exchange` | `recipes` | Share recipes, cooking tips, ingredient substitutions |
| `workout-advice` | `workouts` | Training programs, form checks, progress sharing |
| `surf-report` | `surf` | Spot reports, conditions, gear reviews |
| `budget-tips` | `budget` | Budgeting strategies, savings goals, financial advice |
| `fasting-community` | `fast` | Fasting protocols, tips, progress sharing |
| `nutrition-talk` | `nutrition` | Diet discussions, meal planning, macro tracking |
| `pet-owners` | `pets` | Pet care, vet advice, cute pet photos |
| `garden-talk` | `garden` | Gardening tips, plant identification, seasonal planning |
| `general` | (none) | General discussion, off-topic, introductions |

**Cross-module thread linking:**
Threads can optionally reference a specific entity from the linked module (e.g., a specific book, recipe, or workout plan) via `linked_entity_type` and `linked_entity_id` fields on the thread. The UI renders a card preview of the linked entity above the thread body.

#### 3.4 Acceptance Criteria

- [ ] Communities can be linked to a ModuleId
- [ ] Linked communities appear in the linked module's UI
- [ ] Pre-seeded communities are created on first launch
- [ ] Threads can reference specific module entities
- [ ] Entity cards render inline with the thread

---

## 4. Data Model

### 4.1 Supabase Schema

All forum tables use the `fr_` prefix and live in the shared Supabase database alongside `social_*` tables.

```sql
-- ============================================================================
-- MyForums Supabase Migration
--
-- Privacy-first community discussion forums. All tables use Row-Level Security.
-- Forums require an active social profile from @mylife/social.
-- ============================================================================

-- ── Communities ──────────────────────────────────────────────────────────

create table if not exists fr_communities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  display_name     text not null,
  description      text,
  icon_url         text,
  banner_url       text,
  community_type   text not null default 'public'
                   check (community_type in ('public', 'restricted', 'private')),
  creator_id       uuid not null references social_profiles(id) on delete cascade,
  linked_module_id text,
  default_sort     text not null default 'newest'
                   check (default_sort in ('newest', 'top', 'active')),
  allow_anonymous  boolean not null default false,
  member_count     integer not null default 0,
  thread_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint fr_communities_name_unique unique (name),
  constraint fr_communities_name_format check (name ~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$'),
  constraint fr_communities_display_name_length check (char_length(display_name) between 1 and 100),
  constraint fr_communities_description_length check (description is null or char_length(description) <= 1000)
);

create index fr_communities_creator_idx on fr_communities (creator_id);
create index fr_communities_module_idx on fr_communities (linked_module_id);
create index fr_communities_type_idx on fr_communities (community_type);

alter table fr_communities enable row level security;

-- Public and restricted communities visible to all authenticated users
-- Private communities visible only to members
create policy "Communities visible by type"
  on fr_communities for select
  using (
    community_type in ('public', 'restricted')
    or creator_id in (select id from social_profiles where user_id = auth.uid())
    or id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
    )
  );

create policy "Users create communities"
  on fr_communities for insert
  with check (
    creator_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Owners update communities"
  on fr_communities for update
  using (
    creator_id in (select id from social_profiles where user_id = auth.uid())
    or id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin')
    )
  );

create policy "Owners delete communities"
  on fr_communities for delete
  using (
    creator_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Community Members ───────────────────────────────────────────────────

create table if not exists fr_community_members (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references fr_communities(id) on delete cascade,
  profile_id    uuid not null references social_profiles(id) on delete cascade,
  role          text not null default 'member'
                check (role in ('owner', 'admin', 'moderator', 'member')),
  status        text not null default 'active'
                check (status in ('active', 'pending', 'banned', 'muted')),
  ban_expires   timestamptz,
  mute_expires  timestamptz,
  joined_at     timestamptz not null default now(),

  constraint fr_community_members_unique unique (community_id, profile_id)
);

create index fr_community_members_community_idx on fr_community_members (community_id);
create index fr_community_members_profile_idx on fr_community_members (profile_id);
create index fr_community_members_status_idx on fr_community_members (status);

alter table fr_community_members enable row level security;

-- Members visible to other members and in public communities
create policy "Community members visible"
  on fr_community_members for select
  using (
    community_id in (
      select id from fr_communities where community_type in ('public', 'restricted')
    )
    or profile_id in (select id from social_profiles where user_id = auth.uid())
    or community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
    )
  );

-- Users can join public communities directly
create policy "Users join communities"
  on fr_community_members for insert
  with check (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Users can leave communities (delete own membership)
create policy "Users leave communities"
  on fr_community_members for delete
  using (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Admins/owners can update member roles and status
create policy "Admins manage members"
  on fr_community_members for update
  using (
    community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin', 'moderator')
    )
  );


-- ── Community Rules ─────────────────────────────────────────────────────

create table if not exists fr_community_rules (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references fr_communities(id) on delete cascade,
  position      integer not null default 0,
  title         text not null,
  description   text not null,
  created_at    timestamptz not null default now(),

  constraint fr_community_rules_title_length check (char_length(title) between 1 and 200),
  constraint fr_community_rules_description_length check (char_length(description) between 1 and 1000)
);

create index fr_community_rules_community_idx on fr_community_rules (community_id, position);

alter table fr_community_rules enable row level security;

-- Rules visible when community is visible
create policy "Rules visible with community"
  on fr_community_rules for select
  using (
    community_id in (select id from fr_communities)
  );

-- Admins manage rules
create policy "Admins manage rules"
  on fr_community_rules for all
  using (
    community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin')
    )
  )
  with check (
    community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin')
    )
  );


-- ── Categories ──────────────────────────────────────────────────────────

create table if not exists fr_categories (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references fr_communities(id) on delete cascade,
  name          text not null,
  color         text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),

  constraint fr_categories_name_length check (char_length(name) between 1 and 50),
  constraint fr_categories_unique unique (community_id, name)
);

create index fr_categories_community_idx on fr_categories (community_id, position);

alter table fr_categories enable row level security;

create policy "Categories visible with community"
  on fr_categories for select
  using (community_id in (select id from fr_communities));

create policy "Admins manage categories"
  on fr_categories for all
  using (
    community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin')
    )
  )
  with check (
    community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin')
    )
  );


-- ── Tags ────────────────────────────────────────────────────────────────

create table if not exists fr_tags (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references fr_communities(id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now(),

  constraint fr_tags_name_length check (char_length(name) between 1 and 30),
  constraint fr_tags_unique unique (community_id, name)
);

create index fr_tags_community_idx on fr_tags (community_id);

alter table fr_tags enable row level security;

create policy "Tags visible with community"
  on fr_tags for select
  using (community_id in (select id from fr_communities));

create policy "Members create tags"
  on fr_tags for insert
  with check (
    community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and status = 'active'
    )
  );


-- ── Threads ─────────────────────────────────────────────────────────────

create table if not exists fr_threads (
  id                 uuid primary key default gen_random_uuid(),
  community_id       uuid not null references fr_communities(id) on delete cascade,
  author_id          uuid not null references social_profiles(id) on delete cascade,
  category_id        uuid references fr_categories(id) on delete set null,
  title              text not null,
  body               text not null,
  thread_type        text not null default 'text'
                     check (thread_type in ('text', 'link', 'poll')),
  link_url           text,
  is_anonymous       boolean not null default false,
  is_pinned          boolean not null default false,
  is_locked          boolean not null default false,
  is_removed         boolean not null default false,
  removal_reason     text,
  linked_entity_type text,
  linked_entity_id   text,
  vote_score         integer not null default 0,
  reply_count        integer not null default 0,
  view_count         integer not null default 0,
  last_activity_at   timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint fr_threads_title_length check (char_length(title) between 1 and 300),
  constraint fr_threads_body_length check (char_length(body) between 1 and 40000),
  constraint fr_threads_link_url_for_link check (
    thread_type != 'link' or link_url is not null
  )
);

create index fr_threads_community_idx on fr_threads (community_id, created_at desc);
create index fr_threads_community_score_idx on fr_threads (community_id, vote_score desc);
create index fr_threads_community_activity_idx on fr_threads (community_id, last_activity_at desc);
create index fr_threads_author_idx on fr_threads (author_id);
create index fr_threads_category_idx on fr_threads (category_id);

alter table fr_threads enable row level security;

-- Threads visible in communities the user can see (non-removed, or user is author/mod)
create policy "Threads visible in accessible communities"
  on fr_threads for select
  using (
    (is_removed = false or author_id in (select id from social_profiles where user_id = auth.uid()))
    and community_id in (select id from fr_communities)
  );

-- Active members can create threads
create policy "Members create threads"
  on fr_threads for insert
  with check (
    author_id in (select id from social_profiles where user_id = auth.uid())
    and community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and status = 'active'
    )
  );

-- Authors can update their own non-removed threads
create policy "Authors update own threads"
  on fr_threads for update
  using (
    author_id in (select id from social_profiles where user_id = auth.uid())
    or community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin', 'moderator')
    )
  );

-- Authors can delete own threads
create policy "Authors delete own threads"
  on fr_threads for delete
  using (
    author_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Thread Tags (Join Table) ────────────────────────────────────────────

create table if not exists fr_thread_tags (
  thread_id  uuid not null references fr_threads(id) on delete cascade,
  tag_id     uuid not null references fr_tags(id) on delete cascade,

  primary key (thread_id, tag_id)
);

create index fr_thread_tags_tag_idx on fr_thread_tags (tag_id);

alter table fr_thread_tags enable row level security;

create policy "Thread tags visible with thread"
  on fr_thread_tags for select
  using (thread_id in (select id from fr_threads));

create policy "Thread authors manage tags"
  on fr_thread_tags for all
  using (
    thread_id in (
      select id from fr_threads
      where author_id in (select id from social_profiles where user_id = auth.uid())
    )
  )
  with check (
    thread_id in (
      select id from fr_threads
      where author_id in (select id from social_profiles where user_id = auth.uid())
    )
  );


-- ── Replies ─────────────────────────────────────────────────────────────

create table if not exists fr_replies (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references fr_threads(id) on delete cascade,
  parent_id       uuid references fr_replies(id) on delete cascade,
  author_id       uuid not null references social_profiles(id) on delete cascade,
  body            text not null,
  depth           integer not null default 0,
  is_anonymous    boolean not null default false,
  is_removed      boolean not null default false,
  removal_reason  text,
  vote_score      integer not null default 0,
  child_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint fr_replies_body_length check (char_length(body) between 1 and 10000),
  constraint fr_replies_max_depth check (depth <= 10)
);

create index fr_replies_thread_idx on fr_replies (thread_id, created_at);
create index fr_replies_parent_idx on fr_replies (parent_id);
create index fr_replies_author_idx on fr_replies (author_id);

alter table fr_replies enable row level security;

create policy "Replies visible in accessible threads"
  on fr_replies for select
  using (
    (is_removed = false or author_id in (select id from social_profiles where user_id = auth.uid()))
    and thread_id in (select id from fr_threads)
  );

create policy "Members create replies"
  on fr_replies for insert
  with check (
    author_id in (select id from social_profiles where user_id = auth.uid())
    and thread_id in (
      select id from fr_threads
      where is_locked = false
      and community_id in (
        select community_id from fr_community_members
        where profile_id in (select id from social_profiles where user_id = auth.uid())
        and status = 'active'
      )
    )
  );

create policy "Authors update own replies"
  on fr_replies for update
  using (
    author_id in (select id from social_profiles where user_id = auth.uid())
    or thread_id in (
      select id from fr_threads
      where community_id in (
        select community_id from fr_community_members
        where profile_id in (select id from social_profiles where user_id = auth.uid())
        and role in ('owner', 'admin', 'moderator')
      )
    )
  );

create policy "Authors delete own replies"
  on fr_replies for delete
  using (
    author_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Votes ───────────────────────────────────────────────────────────────

create table if not exists fr_votes (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references social_profiles(id) on delete cascade,
  target_type  text not null check (target_type in ('thread', 'reply')),
  target_id    uuid not null,
  value        integer not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),

  constraint fr_votes_unique unique (profile_id, target_type, target_id)
);

create index fr_votes_target_idx on fr_votes (target_type, target_id);
create index fr_votes_profile_idx on fr_votes (profile_id);

alter table fr_votes enable row level security;

-- Votes readable by the voter themselves (individual votes are private)
create policy "Users see own votes"
  on fr_votes for select
  using (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Users manage own votes"
  on fr_votes for all
  using (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  )
  with check (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Bookmarks ───────────────────────────────────────────────────────────

create table if not exists fr_bookmarks (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references social_profiles(id) on delete cascade,
  thread_id    uuid not null references fr_threads(id) on delete cascade,
  created_at   timestamptz not null default now(),

  constraint fr_bookmarks_unique unique (profile_id, thread_id)
);

create index fr_bookmarks_profile_idx on fr_bookmarks (profile_id, created_at desc);

alter table fr_bookmarks enable row level security;

create policy "Users manage own bookmarks"
  on fr_bookmarks for all
  using (profile_id in (select id from social_profiles where user_id = auth.uid()))
  with check (profile_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Reports ─────────────────────────────────────────────────────────────

create table if not exists fr_reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references social_profiles(id) on delete cascade,
  target_type   text not null check (target_type in ('thread', 'reply', 'community')),
  target_id     uuid not null,
  reason        text not null,
  details       text,
  status        text not null default 'pending'
                check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by   uuid references social_profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),

  constraint fr_reports_reason_length check (char_length(reason) between 1 and 100),
  constraint fr_reports_details_length check (details is null or char_length(details) <= 1000)
);

create index fr_reports_target_idx on fr_reports (target_type, target_id);
create index fr_reports_status_idx on fr_reports (status);

alter table fr_reports enable row level security;

-- Reporters can see their own reports; mods can see reports for their communities
create policy "Users see own reports"
  on fr_reports for select
  using (
    reporter_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Users create reports"
  on fr_reports for insert
  with check (
    reporter_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Mods can update report status
create policy "Mods review reports"
  on fr_reports for update
  using (
    exists (
      select 1 from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin', 'moderator')
    )
  );


-- ── Moderation Actions Log ──────────────────────────────────────────────

create table if not exists fr_mod_actions (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid not null references fr_communities(id) on delete cascade,
  moderator_id   uuid not null references social_profiles(id) on delete cascade,
  action_type    text not null check (action_type in (
    'remove_thread', 'restore_thread', 'lock_thread', 'unlock_thread',
    'pin_thread', 'unpin_thread', 'remove_reply', 'restore_reply',
    'ban_user', 'unban_user', 'mute_user', 'unmute_user',
    'promote_mod', 'demote_mod', 'approve_member', 'reject_member'
  )),
  target_type    text not null check (target_type in ('thread', 'reply', 'user')),
  target_id      uuid not null,
  reason         text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),

  constraint fr_mod_actions_reason_length check (reason is null or char_length(reason) <= 500)
);

create index fr_mod_actions_community_idx on fr_mod_actions (community_id, created_at desc);

alter table fr_mod_actions enable row level security;

-- Mod actions visible to community mods
create policy "Mods see mod actions"
  on fr_mod_actions for select
  using (
    community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin', 'moderator')
    )
  );

create policy "Mods create mod actions"
  on fr_mod_actions for insert
  with check (
    moderator_id in (select id from social_profiles where user_id = auth.uid())
    and community_id in (
      select community_id from fr_community_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
      and role in ('owner', 'admin', 'moderator')
    )
  );


-- ── User Stats ──────────────────────────────────────────────────────────

create table if not exists fr_user_stats (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references social_profiles(id) on delete cascade,
  karma         integer not null default 0,
  thread_count  integer not null default 0,
  reply_count   integer not null default 0,
  first_active  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint fr_user_stats_profile_unique unique (profile_id)
);

alter table fr_user_stats enable row level security;

-- User stats are publicly readable
create policy "User stats readable"
  on fr_user_stats for select
  using (true);

-- System-managed via triggers (no direct user writes)
create policy "System manages user stats"
  on fr_user_stats for all
  using (profile_id in (select id from social_profiles where user_id = auth.uid()))
  with check (profile_id in (select id from social_profiles where user_id = auth.uid()));


-- ── User Blocks ─────────────────────────────────────────────────────────

create table if not exists fr_user_blocks (
  id           uuid primary key default gen_random_uuid(),
  blocker_id   uuid not null references social_profiles(id) on delete cascade,
  blocked_id   uuid not null references social_profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),

  constraint fr_user_blocks_unique unique (blocker_id, blocked_id),
  constraint fr_user_blocks_no_self check (blocker_id != blocked_id)
);

create index fr_user_blocks_blocker_idx on fr_user_blocks (blocker_id);

alter table fr_user_blocks enable row level security;

create policy "Users manage own blocks"
  on fr_user_blocks for all
  using (blocker_id in (select id from social_profiles where user_id = auth.uid()))
  with check (blocker_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Notifications ───────────────────────────────────────────────────────

create table if not exists fr_notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references social_profiles(id) on delete cascade,
  actor_id      uuid references social_profiles(id) on delete set null,
  type          text not null check (type in (
    'thread_reply', 'reply_reply', 'thread_vote', 'reply_vote',
    'mention', 'mod_action', 'community_invite'
  )),
  target_type   text not null check (target_type in ('thread', 'reply', 'community')),
  target_id     uuid not null,
  message       text not null,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now(),

  constraint fr_notifications_message_length check (char_length(message) between 1 and 500)
);

create index fr_notifications_recipient_idx on fr_notifications (recipient_id, is_read, created_at desc);

alter table fr_notifications enable row level security;

create policy "Users see own notifications"
  on fr_notifications for select
  using (recipient_id in (select id from social_profiles where user_id = auth.uid()));

create policy "Users update own notifications"
  on fr_notifications for update
  using (recipient_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Thread Edit History ─────────────────────────────────────────────────

create table if not exists fr_edit_history (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('thread', 'reply')),
  target_id   uuid not null,
  editor_id   uuid not null references social_profiles(id) on delete cascade,
  old_body    text not null,
  new_body    text not null,
  edited_at   timestamptz not null default now()
);

create index fr_edit_history_target_idx on fr_edit_history (target_type, target_id, edited_at desc);

alter table fr_edit_history enable row level security;

-- Edit history visible when the parent content is visible
create policy "Edit history readable"
  on fr_edit_history for select
  using (true);

create policy "Editors create edit history"
  on fr_edit_history for insert
  with check (
    editor_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Helper Functions / Triggers ─────────────────────────────────────────

-- Auto-update vote_score on threads
create or replace function fr_update_thread_vote_score()
returns trigger as $$
begin
  if NEW.target_type = 'thread' then
    update fr_threads
    set vote_score = (
      select coalesce(sum(value), 0)
      from fr_votes
      where target_type = 'thread' and target_id = NEW.target_id
    )
    where id = NEW.target_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger fr_vote_thread_score_trigger
  after insert or update or delete on fr_votes
  for each row execute function fr_update_thread_vote_score();

-- Auto-update vote_score on replies
create or replace function fr_update_reply_vote_score()
returns trigger as $$
begin
  if (TG_OP = 'DELETE' and OLD.target_type = 'reply') or
     (TG_OP != 'DELETE' and NEW.target_type = 'reply') then
    update fr_replies
    set vote_score = (
      select coalesce(sum(value), 0)
      from fr_votes
      where target_type = 'reply' and target_id = coalesce(NEW.target_id, OLD.target_id)
    )
    where id = coalesce(NEW.target_id, OLD.target_id);
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_vote_reply_score_trigger
  after insert or update or delete on fr_votes
  for each row execute function fr_update_reply_vote_score();

-- Auto-update reply_count and last_activity_at on threads
create or replace function fr_update_thread_reply_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update fr_threads
    set reply_count = reply_count + 1,
        last_activity_at = now()
    where id = NEW.thread_id;
  elsif TG_OP = 'DELETE' then
    update fr_threads
    set reply_count = greatest(0, reply_count - 1)
    where id = OLD.thread_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_reply_count_trigger
  after insert or delete on fr_replies
  for each row execute function fr_update_thread_reply_count();

-- Auto-update child_count on parent replies
create or replace function fr_update_reply_child_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.parent_id is not null then
    update fr_replies
    set child_count = child_count + 1
    where id = NEW.parent_id;
  elsif TG_OP = 'DELETE' and OLD.parent_id is not null then
    update fr_replies
    set child_count = greatest(0, child_count - 1)
    where id = OLD.parent_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_reply_child_count_trigger
  after insert or delete on fr_replies
  for each row execute function fr_update_reply_child_count();

-- Auto-update member_count on communities
create or replace function fr_update_community_member_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.status = 'active' then
    update fr_communities set member_count = member_count + 1 where id = NEW.community_id;
  elsif TG_OP = 'DELETE' and OLD.status = 'active' then
    update fr_communities set member_count = greatest(0, member_count - 1) where id = OLD.community_id;
  elsif TG_OP = 'UPDATE' then
    if OLD.status != 'active' and NEW.status = 'active' then
      update fr_communities set member_count = member_count + 1 where id = NEW.community_id;
    elsif OLD.status = 'active' and NEW.status != 'active' then
      update fr_communities set member_count = greatest(0, member_count - 1) where id = NEW.community_id;
    end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_community_member_count_trigger
  after insert or update or delete on fr_community_members
  for each row execute function fr_update_community_member_count();

-- Auto-update thread_count on communities
create or replace function fr_update_community_thread_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update fr_communities set thread_count = thread_count + 1 where id = NEW.community_id;
  elsif TG_OP = 'DELETE' then
    update fr_communities set thread_count = greatest(0, thread_count - 1) where id = OLD.community_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_community_thread_count_trigger
  after insert or delete on fr_threads
  for each row execute function fr_update_community_thread_count();

-- Auto-update user stats on thread/reply creation
create or replace function fr_update_user_stats_on_thread()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into fr_user_stats (profile_id, thread_count)
    values (NEW.author_id, 1)
    on conflict (profile_id)
    do update set thread_count = fr_user_stats.thread_count + 1,
                  updated_at = now();
  elsif TG_OP = 'DELETE' then
    update fr_user_stats
    set thread_count = greatest(0, thread_count - 1), updated_at = now()
    where profile_id = OLD.author_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_user_stats_thread_trigger
  after insert or delete on fr_threads
  for each row execute function fr_update_user_stats_on_thread();

create or replace function fr_update_user_stats_on_reply()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into fr_user_stats (profile_id, reply_count)
    values (NEW.author_id, 1)
    on conflict (profile_id)
    do update set reply_count = fr_user_stats.reply_count + 1,
                  updated_at = now();
  elsif TG_OP = 'DELETE' then
    update fr_user_stats
    set reply_count = greatest(0, reply_count - 1), updated_at = now()
    where profile_id = OLD.author_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_user_stats_reply_trigger
  after insert or delete on fr_replies
  for each row execute function fr_update_user_stats_on_reply();

-- Auto-update karma on vote changes
create or replace function fr_update_karma()
returns trigger as $$
declare
  content_author uuid;
begin
  -- Find the author of the voted content
  if coalesce(NEW.target_type, OLD.target_type) = 'thread' then
    select author_id into content_author
    from fr_threads where id = coalesce(NEW.target_id, OLD.target_id);
  else
    select author_id into content_author
    from fr_replies where id = coalesce(NEW.target_id, OLD.target_id);
  end if;

  if content_author is not null then
    -- Recalculate karma from all votes on this user's content
    update fr_user_stats
    set karma = (
      select coalesce(sum(v.value), 0)
      from fr_votes v
      join fr_threads t on v.target_type = 'thread' and v.target_id = t.id and t.author_id = content_author
      union all
      select coalesce(sum(v.value), 0)
      from fr_votes v
      join fr_replies r on v.target_type = 'reply' and v.target_id = r.id and r.author_id = content_author
    ) as total_karma,
    updated_at = now()
    where profile_id = content_author;
  end if;

  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger fr_karma_trigger
  after insert or update or delete on fr_votes
  for each row execute function fr_update_karma();

-- Auto-update updated_at timestamps
create trigger fr_communities_updated_at
  before update on fr_communities
  for each row execute function update_updated_at();

create trigger fr_threads_updated_at
  before update on fr_threads
  for each row execute function update_updated_at();

create trigger fr_replies_updated_at
  before update on fr_replies
  for each row execute function update_updated_at();

create trigger fr_user_stats_updated_at
  before update on fr_user_stats
  for each row execute function update_updated_at();


-- ── Full-Text Search ────────────────────────────────────────────────────

-- GIN index for full-text search across threads
alter table fr_threads add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;

create index fr_threads_search_idx on fr_threads using gin (search_vector);

-- GIN index for full-text search across replies
alter table fr_replies add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(body, ''))
  ) stored;

create index fr_replies_search_idx on fr_replies using gin (search_vector);
```

### 4.2 Table Summary

| Table | Description | Row Count Estimate |
|-------|-------------|-------------------|
| `fr_communities` | Community/board definitions | Hundreds |
| `fr_community_members` | Membership + roles | Thousands |
| `fr_community_rules` | Per-community rules | Hundreds |
| `fr_categories` | Per-community thread categories | Hundreds |
| `fr_tags` | Per-community user-created tags | Thousands |
| `fr_threads` | Discussion threads | Tens of thousands |
| `fr_thread_tags` | Thread-to-tag join table | Tens of thousands |
| `fr_replies` | Threaded replies | Hundreds of thousands |
| `fr_votes` | Upvotes/downvotes on threads and replies | Hundreds of thousands |
| `fr_bookmarks` | User-saved threads | Thousands |
| `fr_reports` | Content/community reports | Hundreds |
| `fr_mod_actions` | Moderation action log | Thousands |
| `fr_user_stats` | Per-user karma, counts | Thousands |
| `fr_user_blocks` | User block relationships | Hundreds |
| `fr_notifications` | In-app notifications | Tens of thousands |
| `fr_edit_history` | Thread/reply edit history | Thousands |

**Total: 16 tables**

### 4.3 Entity Relationship Summary

```
fr_communities 1 ── * fr_community_members * ── 1 social_profiles
fr_communities 1 ── * fr_community_rules
fr_communities 1 ── * fr_categories
fr_communities 1 ── * fr_tags
fr_communities 1 ── * fr_threads
fr_communities 1 ── * fr_mod_actions
fr_threads     1 ── * fr_replies
fr_threads     * ── * fr_tags (via fr_thread_tags)
fr_threads     1 ── * fr_bookmarks
fr_replies     1 ── * fr_replies (self-referencing parent)
fr_votes       * ── 1 social_profiles
fr_reports     * ── 1 social_profiles
fr_user_stats  1 ── 1 social_profiles
fr_user_blocks * ── 1 social_profiles
fr_notifications * ── 1 social_profiles
fr_edit_history * ── 1 social_profiles
```

---

## 5. ModuleDefinition

```typescript
import type { ModuleDefinition } from '@mylife/module-registry';

export const FORUMS_MODULE: ModuleDefinition = {
  id: 'forums',
  name: 'MyForums',
  tagline: 'Community discussions, your way',
  icon: '\u{1F4AC}',  // 💬
  accentColor: '#F43F5E',
  tier: 'premium',
  storageType: 'supabase',
  // No local SQLite migrations -- all data lives in Supabase
  schemaVersion: 1,
  tablePrefix: 'fr_',
  navigation: {
    tabs: [
      { key: 'feed', label: 'Feed', icon: 'home' },
      { key: 'communities', label: 'Communities', icon: 'users' },
      { key: 'search', label: 'Search', icon: 'search' },
      { key: 'bookmarks', label: 'Saved', icon: 'bookmark' },
      { key: 'profile', label: 'Profile', icon: 'user' },
    ],
    screens: [
      { name: 'community-detail', title: 'Community' },
      { name: 'thread-detail', title: 'Thread' },
      { name: 'create-thread', title: 'New Thread' },
      { name: 'create-community', title: 'New Community' },
      { name: 'community-settings', title: 'Community Settings' },
      { name: 'mod-dashboard', title: 'Moderation' },
      { name: 'notifications', title: 'Notifications' },
      { name: 'user-profile', title: 'User Profile' },
    ],
  },
  requiresAuth: true,
  requiresNetwork: true,
  version: '0.1.0',
};
```

---

## 6. Social Package Integration

### 6.1 New Activity Types

The following activity types should be added to `ActivityTypeSchema` in `packages/social/src/types.ts`:

```typescript
// Forums
'forums_thread_created',     // User created a new discussion thread
'forums_reply_posted',       // User replied to a thread
'forums_community_created',  // User created a new community
'forums_karma_milestone',    // User reached a karma milestone (100, 500, 1000, etc.)
```

### 6.2 SOCIAL_CAPABLE_MODULES Extension

Add `'forums'` to the `SOCIAL_CAPABLE_MODULES` array in `packages/social/src/types.ts`.

### 6.3 Activity Emitter Helpers

Add the following to `packages/social/src/activity-emitter.ts`:

```typescript
/** Emit a forum thread creation activity. */
export function emitForumThreadCreated(title: string, metadata: {
  threadTitle: string;
  communityName: string;
  communityId: string;
}) {
  return emitActivity({
    moduleId: 'forums',
    type: 'forums_thread_created',
    title,
    metadata,
  });
}

/** Emit a forum reply activity. */
export function emitForumReplyPosted(title: string, metadata: {
  threadTitle: string;
  communityName: string;
  threadId: string;
}) {
  return emitActivity({
    moduleId: 'forums',
    type: 'forums_reply_posted',
    title,
    metadata,
  });
}
```

### 6.4 New Share Card Types

Add to `ShareCardTypeSchema`:

```typescript
'forum_thread'       // Share a specific thread as a card
'forum_reputation'   // Share karma/reputation milestone
```

### 6.5 Leaderboard Scoring

Forum activities should contribute to leaderboards:

| Activity Type | Default Points |
|--------------|---------------|
| `forums_thread_created` | 3 |
| `forums_reply_posted` | 1 |
| `forums_karma_milestone` | 5 |

### 6.6 Relationship with Social Groups

The existing `social_groups` table in `@mylife/social` and `fr_communities` serve different purposes:

- **social_groups**: Small, private groups of friends for coordinated activities (challenges, shared goals)
- **fr_communities**: Public or semi-public discussion boards for topic-focused conversations

They are separate entities. However, a `social_group` could optionally create a linked `fr_community` as its private discussion space. This is a P2 feature (group-linked communities).

---

## 7. Cross-Module Integration Map

| Module | Integration Type | Description |
|--------|-----------------|-------------|
| **MyBooks** | Linked community (`book-club`) | Discuss books, share reviews, reading recommendations. Threads can link to a specific book via `linked_entity_type: 'book'`. |
| **MyRecipes** | Linked community (`recipe-exchange`) | Share cooking tips, recipe modifications, ingredient substitutions. Threads can link to a specific recipe. |
| **MyWorkouts** | Linked community (`workout-advice`) | Training programs, form checks, progress photos. Threads can link to a workout plan or exercise. |
| **MySurf** | Linked community (`surf-report`) | Spot reports, conditions, gear reviews. Threads can link to a surf spot. |
| **MyBudget** | Linked community (`budget-tips`) | Financial advice, budgeting strategies. No entity linking (privacy-sensitive). |
| **MyFast** | Linked community (`fasting-community`) | Fasting protocols, tips, progress. Threads can reference a fasting protocol. |
| **MyNutrition** | Linked community (`nutrition-talk`) | Diet discussions, macro tracking tips. Threads can link to food items. |
| **MyPets** | Linked community (`pet-owners`) | Pet care advice, vet tips, cute photos. Threads can link to a pet profile. |
| **MyGarden** | Linked community (`garden-talk`) | Gardening tips, plant identification. Threads can link to a plant. |
| **MyHabits** | No linked community | Habits are too personal for dedicated community discussion. Users can discuss in `general`. |
| **MyMood** | No linked community | Mood data is highly sensitive. No cross-module linking. |
| **MyJournal** | No linked community | Journal entries are private by definition. |

### 7.1 Cross-Module Entity Card Pattern

When a thread has `linked_entity_type` and `linked_entity_id` set, the thread detail screen renders a preview card above the body. The card is rendered by the source module's UI component:

```typescript
interface LinkedEntityCard {
  moduleId: ModuleId;
  entityType: string;    // 'book', 'recipe', 'workout', 'spot', etc.
  entityId: string;
  // Rendered by the source module's card component
}
```

This requires each participating module to export a `ForumEntityCard` component that accepts an entity ID and renders a compact preview. This is a P2 feature that can be implemented incrementally per module.

---

## 8. Navigation and UI Structure

### 8.1 Tab Bar

| Tab | Screen | Description |
|-----|--------|-------------|
| Feed | Home feed | Aggregated threads from joined communities, sorted by newest/top/active |
| Communities | Community browser | Directory of all public communities + user's joined communities |
| Search | Full-text search | Search threads and replies across all accessible communities |
| Saved | Bookmarks | User's saved/bookmarked threads |
| Profile | Forum profile | Karma, thread/reply counts, community memberships, posting history |

### 8.2 Key Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Community Detail | `/forums/c/:name` | Thread list for a specific community, community info sidebar |
| Thread Detail | `/forums/t/:id` | Thread body + threaded replies |
| New Thread | `/forums/c/:name/new` | Thread creation form (title, body, type, tags) |
| New Community | `/forums/new` | Community creation form |
| Community Settings | `/forums/c/:name/settings` | Community config (owner/admin only) |
| Mod Dashboard | `/forums/c/:name/mod` | Reports queue, mod log, member management |
| Notifications | `/forums/notifications` | Reply notifications, mentions, mod actions |
| User Profile | `/forums/u/:handle` | User's forum activity, karma, communities |

### 8.3 Design Tokens

MyForums uses the Cool Obsidian design system with the rose accent color:

| Token | Value | Usage |
|-------|-------|-------|
| Accent | `#F43F5E` | Primary action buttons, active tab, links |
| Accent Soft | `rgba(244, 63, 94, 0.12)` | Vote button active state background |
| Upvote | `#F43F5E` (accent) | Upvote arrow active |
| Downvote | `#64748B` (slate) | Downvote arrow active |
| Thread Card | `surface` (#12121A) | Thread list item background |
| Reply Indent | `border` (rgba(255,255,255,0.06)) | Left border for nested reply indentation |

---

## 9. Privacy and Safety

### 9.1 Content Moderation Philosophy

MyForums uses a community-driven moderation model:

1. **Community moderators** (elected by the community owner) handle day-to-day moderation
2. **Report system** allows any user to flag content for moderator review
3. **No algorithmic content moderation** - humans review all reported content
4. **Moderation transparency** - all mod actions are logged and visible to the mod team
5. **Appeal process** - banned users can message community admins to appeal

### 9.2 Anti-Abuse Measures

- **Rate limiting** - Thread creation: 5 per hour. Reply creation: 30 per hour. Vote: 100 per hour.
- **New account restrictions** - Accounts less than 24 hours old cannot create communities or post in more than 3 communities.
- **Spam prevention** - Duplicate content detection (hash-based). Link-only posts require minimum karma.
- **Block system** - Blocked users' content is hidden from the blocker. Blocked users cannot reply to the blocker's content.
- **Report queue** - Reports trigger a notification to community moderators. Unreviewed reports older than 72 hours are escalated.

### 9.3 Anonymous Posting

Communities can optionally enable anonymous posting. When enabled:
- The author's profile is replaced with a generic "Anonymous" label
- The `is_anonymous` flag is set on the thread/reply
- The actual `author_id` is still stored for moderation purposes (mods can see who posted)
- Anonymous posts still contribute to the author's stats (thread_count, reply_count) but not to visible karma
- This is useful for sensitive topics (health, finances, personal struggles)

### 9.4 Data Ownership

- Users can export all their posting history (threads + replies) as JSON or Markdown
- Users can delete their account, which hard-deletes all their content (CASCADE)
- Community owners can export full community data
- No data is retained after deletion (hard delete, not soft archive for user content)

---

## 10. Implementation Phases

### Phase 1: Foundation (P0 features)
- FR-001: Communities
- FR-002: Threads
- FR-003: Replies
- FR-004: Voting
- FR-005: Social profile integration
- FR-012: Markdown rendering
- Supabase migration, basic RLS

### Phase 2: Organization and Safety (P1 features)
- FR-006: Categories and Tags
- FR-007: Full-text search
- FR-008: Moderation tools
- FR-009: Karma/reputation
- FR-010: Notifications
- FR-011: Cross-module boards
- FR-015: User blocking
- FR-016: Content reporting
- FR-017: Community rules
- FR-018: Pinned threads
- FR-019: Thread locking
- FR-025: Activity feed integration
- FR-030: Settings

### Phase 3: Polish (P2 features)
- FR-013: Media attachments
- FR-014: Bookmarks
- FR-020: User flair
- FR-021: Polls
- FR-022: Draft posts
- FR-023: Edit history
- FR-024: Mod analytics dashboard
- FR-026: Share cards
- FR-027: Leaderboard integration
- FR-028: Data export
- FR-029: Onboarding

---

## 11. Supabase Realtime Subscriptions

MyForums leverages Supabase Realtime for live updates:

| Channel | Table | Events | Use Case |
|---------|-------|--------|----------|
| `thread:{id}` | `fr_replies` | INSERT | New replies appear in real-time |
| `thread:{id}` | `fr_threads` | UPDATE | Vote score, lock/pin status changes |
| `community:{id}` | `fr_threads` | INSERT | New threads appear in community feed |
| `notifications:{profileId}` | `fr_notifications` | INSERT | Badge count updates |

---

## 12. Performance Considerations

- **Thread list pagination**: Cursor-based pagination using `created_at` or `vote_score` + `id` as tiebreaker. Page size: 25 threads.
- **Reply tree loading**: Fetch top-level replies first (depth=0), lazy-load nested replies on expansion. Max 50 replies per fetch.
- **Vote score denormalization**: Stored directly on threads/replies via trigger, avoiding COUNT aggregation on read.
- **Full-text search**: Postgres `tsvector` with GIN index. Weighted: title (A) > body (B). Query uses `plainto_tsquery` for user input.
- **Notification batching**: Multiple votes on the same content within 5 minutes are batched into a single notification.
- **Community member count**: Denormalized on `fr_communities` via trigger, not computed on read.
