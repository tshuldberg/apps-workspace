CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  diner_id uuid,
  party_size integer NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 90,
  table_id uuid REFERENCES floor_tables(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'web_widget' CHECK (source IN ('web_widget', 'mylife_app', 'walk_in', 'phone', 'resy_passthrough')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled')),
  occasion text,
  special_requests text,
  dietary_notes text,
  policy_version_id uuid REFERENCES reservation_policies(id),
  consent_at timestamptz,
  consent_ip text,
  payment_intent_id uuid REFERENCES payment_intents(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reservations_restaurant_date ON reservations(restaurant_id, scheduled_at);
CREATE INDEX idx_reservations_status ON reservations(restaurant_id, status);
CREATE INDEX idx_reservations_table ON reservations(table_id, scheduled_at);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant users can view reservations" ON reservations
  FOR SELECT USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Restaurant staff can manage reservations" ON reservations
  FOR ALL USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'host'))
  );

-- Allow diners to view their own reservations (for the public booking page)
CREATE POLICY "Diners can view own reservations" ON reservations
  FOR SELECT USING (diner_id = auth.uid());

-- Allow insert from anonymous/authenticated for booking flow
CREATE POLICY "Anyone can create a reservation" ON reservations
  FOR INSERT WITH CHECK (true);
