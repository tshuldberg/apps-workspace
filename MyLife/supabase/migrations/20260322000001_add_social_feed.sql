-- Friend Connections
CREATE TABLE IF NOT EXISTS friend_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (requester_id, responder_id)
);

-- Synced Share Events
CREATE TABLE IF NOT EXISTS synced_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('book_rating', 'book_review', 'book_finished', 'book_started', 'book_added')),
  book_title TEXT NOT NULL,
  book_cover_url TEXT,
  book_authors TEXT,
  rating REAL,
  review_excerpt TEXT,
  visibility TEXT NOT NULL DEFAULT 'friends'
    CHECK (visibility IN ('friends', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS friend_connections_requester_idx ON friend_connections(requester_id);
CREATE INDEX IF NOT EXISTS friend_connections_responder_idx ON friend_connections(responder_id);
CREATE INDEX IF NOT EXISTS friend_connections_status_idx ON friend_connections(status);
CREATE INDEX IF NOT EXISTS synced_share_events_user_idx ON synced_share_events(user_id);
CREATE INDEX IF NOT EXISTS synced_share_events_created_idx ON synced_share_events(created_at DESC);
CREATE INDEX IF NOT EXISTS synced_share_events_visibility_idx ON synced_share_events(visibility);

-- RLS Policies
ALTER TABLE friend_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own connections" ON friend_connections
  FOR SELECT USING (requester_id = auth.uid() OR responder_id = auth.uid());

CREATE POLICY "Users can send requests" ON friend_connections
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can update own connections" ON friend_connections
  FOR UPDATE USING (requester_id = auth.uid() OR responder_id = auth.uid());

CREATE POLICY "Users see friend events" ON synced_share_events
  FOR SELECT USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR (visibility = 'friends' AND EXISTS (
      SELECT 1 FROM friend_connections
      WHERE status = 'accepted'
        AND ((requester_id = auth.uid() AND responder_id = synced_share_events.user_id)
          OR (responder_id = auth.uid() AND requester_id = synced_share_events.user_id))
    ))
  );

CREATE POLICY "Users can create events" ON synced_share_events
  FOR INSERT WITH CHECK (user_id = auth.uid());
