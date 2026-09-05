-- ════════════════════════════════════════════════════════════════════
-- MyForums — Supabase Cloud Schema
-- Prefix: fr_
-- ════════════════════════════════════════════════════════════════════

-- ── Enum types ──────────────────────────────────────────────────────

CREATE TYPE fr_community_type AS ENUM ('public', 'restricted', 'private');
CREATE TYPE fr_member_role AS ENUM ('owner', 'admin', 'moderator', 'member');
CREATE TYPE fr_member_status AS ENUM ('active', 'pending', 'banned', 'muted');
CREATE TYPE fr_thread_status AS ENUM ('open', 'locked', 'removed');
CREATE TYPE fr_vote_direction AS ENUM ('up', 'down');
CREATE TYPE fr_vote_target AS ENUM ('thread', 'reply');
CREATE TYPE fr_report_reason AS ENUM ('spam', 'harassment', 'misinformation', 'off_topic', 'nsfw', 'other');
CREATE TYPE fr_mod_action AS ENUM (
  'remove_thread', 'remove_reply', 'lock_thread', 'unlock_thread',
  'pin_thread', 'unpin_thread', 'ban_user', 'unban_user',
  'mute_user', 'unmute_user', 'edit_community'
);

-- ── Communities ─────────────────────────────────────────────────────

CREATE TABLE fr_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL UNIQUE CHECK (name ~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  description TEXT CHECK (char_length(description) <= 1000),
  icon_url TEXT,
  banner_url TEXT,
  community_type fr_community_type NOT NULL DEFAULT 'public',
  linked_module_id TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  thread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fr_communities_name_idx ON fr_communities (name);
CREATE INDEX fr_communities_type_idx ON fr_communities (community_type);
CREATE INDEX fr_communities_member_count_idx ON fr_communities (member_count DESC);

-- FTS on community name + description
ALTER TABLE fr_communities ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX fr_communities_search_idx ON fr_communities USING gin(search_vector);

-- ── Community Members ───────────────────────────────────────────────

CREATE TABLE fr_community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES fr_communities(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES auth.users(id),
  role fr_member_role NOT NULL DEFAULT 'member',
  status fr_member_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, profile_id)
);

CREATE INDEX fr_members_community_idx ON fr_community_members (community_id);
CREATE INDEX fr_members_profile_idx ON fr_community_members (profile_id);

-- ── Threads ─────────────────────────────────────────────────────────

CREATE TABLE fr_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES fr_communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 300),
  body TEXT NOT NULL CHECK (char_length(body) <= 40000),
  status fr_thread_status NOT NULL DEFAULT 'open',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  vote_score INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fr_threads_community_idx ON fr_threads (community_id);
CREATE INDEX fr_threads_author_idx ON fr_threads (author_id);
CREATE INDEX fr_threads_created_idx ON fr_threads (created_at DESC);
CREATE INDEX fr_threads_score_idx ON fr_threads (vote_score DESC);
CREATE INDEX fr_threads_pinned_idx ON fr_threads (community_id, is_pinned DESC, created_at DESC);

-- FTS on thread title + body
ALTER TABLE fr_threads ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;
CREATE INDEX fr_threads_search_idx ON fr_threads USING gin(search_vector);

-- ── Replies ─────────────────────────────────────────────────────────

CREATE TABLE fr_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES fr_threads(id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES fr_replies(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  vote_score INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  status fr_thread_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fr_replies_thread_idx ON fr_replies (thread_id);
CREATE INDEX fr_replies_parent_idx ON fr_replies (parent_reply_id);
CREATE INDEX fr_replies_author_idx ON fr_replies (author_id);
CREATE INDEX fr_replies_score_idx ON fr_replies (vote_score DESC);

-- ── Votes ───────────────────────────────────────────────────────────

CREATE TABLE fr_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES auth.users(id),
  target_type fr_vote_target NOT NULL,
  target_id UUID NOT NULL,
  direction fr_vote_direction NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, target_type, target_id)
);

CREATE INDEX fr_votes_target_idx ON fr_votes (target_type, target_id);

-- ── Bookmarks ───────────────────────────────────────────────────────

CREATE TABLE fr_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES auth.users(id),
  thread_id UUID NOT NULL REFERENCES fr_threads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, thread_id)
);

CREATE INDEX fr_bookmarks_profile_idx ON fr_bookmarks (profile_id);

-- ── User Stats ──────────────────────────────────────────────────────

CREATE TABLE fr_user_stats (
  profile_id UUID PRIMARY KEY REFERENCES auth.users(id),
  thread_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  karma INTEGER NOT NULL DEFAULT 0,
  communities_joined INTEGER NOT NULL DEFAULT 0
);

-- ── Mod Actions ─────────────────────────────────────────────────────

CREATE TABLE fr_mod_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES fr_communities(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES auth.users(id),
  action_type fr_mod_action NOT NULL,
  target_id UUID,
  reason TEXT CHECK (char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fr_mod_actions_community_idx ON fr_mod_actions (community_id);
CREATE INDEX fr_mod_actions_created_idx ON fr_mod_actions (created_at DESC);

-- ── Reports ─────────────────────────────────────────────────────────

CREATE TABLE fr_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  community_id UUID NOT NULL REFERENCES fr_communities(id) ON DELETE CASCADE,
  target_type fr_vote_target NOT NULL,
  target_id UUID NOT NULL,
  reason fr_report_reason NOT NULL,
  details TEXT CHECK (char_length(details) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fr_reports_community_idx ON fr_reports (community_id);

-- ── Blocks ──────────────────────────────────────────────────────────

CREATE TABLE fr_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id),
  blocked_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX fr_blocks_blocker_idx ON fr_blocks (blocker_id);

-- ── Community Rules ─────────────────────────────────────────────────

CREATE TABLE fr_community_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES fr_communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 1000),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX fr_rules_community_idx ON fr_community_rules (community_id, position);

-- ── Tags ────────────────────────────────────────────────────────────

CREATE TABLE fr_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES fr_communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color TEXT CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  UNIQUE (community_id, name)
);

CREATE INDEX fr_tags_community_idx ON fr_tags (community_id);

-- ── Thread Tags (junction table) ────────────────────────────────────

CREATE TABLE fr_thread_tags (
  thread_id UUID NOT NULL REFERENCES fr_threads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES fr_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (thread_id, tag_id)
);

-- ════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════

-- Auto-update updated_at on communities
CREATE OR REPLACE FUNCTION fr_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fr_communities_updated_at
  BEFORE UPDATE ON fr_communities FOR EACH ROW EXECUTE FUNCTION fr_updated_at();

CREATE TRIGGER fr_threads_updated_at
  BEFORE UPDATE ON fr_threads FOR EACH ROW EXECUTE FUNCTION fr_updated_at();

CREATE TRIGGER fr_replies_updated_at
  BEFORE UPDATE ON fr_replies FOR EACH ROW EXECUTE FUNCTION fr_updated_at();

-- Maintain community thread_count on thread insert/delete
CREATE OR REPLACE FUNCTION fr_sync_thread_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE fr_communities SET thread_count = thread_count + 1 WHERE id = NEW.community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE fr_communities
    SET thread_count = greatest(0, thread_count - 1)
    WHERE id = OLD.community_id;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fr_thread_count_trigger
  AFTER INSERT OR DELETE ON fr_threads FOR EACH ROW EXECUTE FUNCTION fr_sync_thread_count();

-- Maintain thread reply_count on reply insert/delete
CREATE OR REPLACE FUNCTION fr_sync_reply_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE fr_threads SET reply_count = reply_count + 1 WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE fr_threads
    SET reply_count = greatest(0, reply_count - 1)
    WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fr_reply_count_trigger
  AFTER INSERT OR DELETE ON fr_replies FOR EACH ROW EXECUTE FUNCTION fr_sync_reply_count();

-- Update community member_count on member insert/delete
CREATE OR REPLACE FUNCTION fr_update_member_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE fr_communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
    -- Update user stats
    INSERT INTO fr_user_stats (profile_id, communities_joined) VALUES (NEW.profile_id, 1)
      ON CONFLICT (profile_id) DO UPDATE SET communities_joined = fr_user_stats.communities_joined + 1;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE fr_communities
    SET member_count = greatest(0, member_count - 1)
    WHERE id = OLD.community_id;
    UPDATE fr_user_stats
    SET communities_joined = greatest(0, communities_joined - 1)
    WHERE profile_id = OLD.profile_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fr_member_count_trigger
  AFTER INSERT OR DELETE ON fr_community_members FOR EACH ROW EXECUTE FUNCTION fr_update_member_count();

-- Update user stats and karma on vote insert/update/delete
CREATE OR REPLACE FUNCTION fr_update_karma_on_vote() RETURNS trigger AS $$
DECLARE
  target_author UUID;
  karma_delta INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    karma_delta := CASE WHEN NEW.direction = 'up' THEN 1 ELSE -1 END;
  ELSIF TG_OP = 'DELETE' THEN
    karma_delta := CASE WHEN OLD.direction = 'up' THEN -1 ELSE 1 END;
  ELSE
    karma_delta :=
      (CASE WHEN NEW.direction = 'up' THEN 1 ELSE -1 END) -
      (CASE WHEN OLD.direction = 'up' THEN 1 ELSE -1 END);
  END IF;

  IF COALESCE(NEW.target_type, OLD.target_type) = 'thread' THEN
    SELECT author_id INTO target_author FROM fr_threads WHERE id = COALESCE(NEW.target_id, OLD.target_id);
    UPDATE fr_threads
    SET vote_score = vote_score + karma_delta
    WHERE id = COALESCE(NEW.target_id, OLD.target_id);
  ELSE
    SELECT author_id INTO target_author FROM fr_replies WHERE id = COALESCE(NEW.target_id, OLD.target_id);
    UPDATE fr_replies
    SET vote_score = vote_score + karma_delta
    WHERE id = COALESCE(NEW.target_id, OLD.target_id);
  END IF;

  IF target_author IS NOT NULL AND karma_delta != 0 THEN
    INSERT INTO fr_user_stats (profile_id, karma) VALUES (target_author, karma_delta)
      ON CONFLICT (profile_id) DO UPDATE SET karma = fr_user_stats.karma + karma_delta;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fr_karma_trigger
  AFTER INSERT OR UPDATE OR DELETE ON fr_votes FOR EACH ROW EXECUTE FUNCTION fr_update_karma_on_vote();

-- ════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE fr_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_mod_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_community_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE fr_thread_tags ENABLE ROW LEVEL SECURITY;

-- Public reads for public communities + their content
CREATE POLICY "anon_read_public_communities" ON fr_communities
  FOR SELECT USING (community_type = 'public');

CREATE POLICY "anon_read_threads" ON fr_threads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM fr_communities WHERE id = community_id AND community_type = 'public')
    AND status != 'removed'
  );

CREATE POLICY "anon_read_replies" ON fr_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fr_threads t
      JOIN fr_communities c ON c.id = t.community_id
      WHERE t.id = thread_id AND c.community_type = 'public' AND t.status != 'removed'
    )
    AND status != 'removed'
  );

CREATE POLICY "anon_read_user_stats" ON fr_user_stats
  FOR SELECT USING (true);

CREATE POLICY "anon_read_rules" ON fr_community_rules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM fr_communities WHERE id = community_id AND community_type = 'public')
  );

CREATE POLICY "anon_read_tags" ON fr_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM fr_communities WHERE id = community_id AND community_type = 'public')
  );

CREATE POLICY "anon_read_thread_tags" ON fr_thread_tags
  FOR SELECT USING (true);

-- Auth-required: own membership reads
CREATE POLICY "auth_read_own_memberships" ON fr_community_members
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Auth-required writes
CREATE POLICY "auth_create_community" ON fr_communities
  FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());

CREATE POLICY "auth_join_community" ON fr_community_members
  FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());

CREATE POLICY "auth_leave_community" ON fr_community_members
  FOR DELETE TO authenticated USING (profile_id = auth.uid());

CREATE POLICY "auth_create_thread" ON fr_threads
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "auth_update_own_thread" ON fr_threads
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "auth_create_reply" ON fr_replies
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "auth_update_own_reply" ON fr_replies
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "auth_cast_vote" ON fr_votes
  FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());

CREATE POLICY "auth_remove_vote" ON fr_votes
  FOR DELETE TO authenticated USING (profile_id = auth.uid());

CREATE POLICY "auth_manage_bookmarks" ON fr_bookmarks
  FOR ALL TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE POLICY "auth_create_report" ON fr_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "auth_manage_blocks" ON fr_blocks
  FOR ALL TO authenticated USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- Mod actions: only visible to community moderators+
CREATE POLICY "mod_read_actions" ON fr_mod_actions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM fr_community_members
      WHERE community_id = fr_mod_actions.community_id
        AND profile_id = auth.uid()
        AND role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY "mod_create_actions" ON fr_mod_actions
  FOR INSERT TO authenticated WITH CHECK (
    moderator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM fr_community_members
      WHERE community_id = fr_mod_actions.community_id
        AND profile_id = auth.uid()
        AND role IN ('owner', 'admin', 'moderator')
    )
  );
