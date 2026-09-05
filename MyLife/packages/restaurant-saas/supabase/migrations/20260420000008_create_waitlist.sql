CREATE TABLE waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  diner_name text NOT NULL,
  phone text,
  party_size integer NOT NULL,
  dietary_notes text,
  joined_at timestamptz DEFAULT now(),
  estimated_wait_min integer,
  position integer,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'seated', 'walked_away')),
  ready_pinged_at timestamptz,
  walked_away_reason text,
  sms_consent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant users can view waitlist"
  ON waitlist FOR SELECT
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant staff can manage waitlist"
  ON waitlist FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'host')
  ));
