CREATE TABLE reservation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  cancellation_window_hrs integer DEFAULT 24,
  no_show_fee_cents integer DEFAULT 2500,
  deposit_cents integer DEFAULT 0,
  deposit_per_person boolean DEFAULT false,
  policy_text text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, version)
);

ALTER TABLE reservation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant users can view policies" ON reservation_policies
  FOR SELECT USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners/managers can manage policies" ON reservation_policies
  FOR ALL USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
  );
