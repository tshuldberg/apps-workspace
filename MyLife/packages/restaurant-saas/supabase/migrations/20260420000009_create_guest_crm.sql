-- Guest CRM: diner profiles, auto-tags, allergen tracking

CREATE TABLE diners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text,
  display_name text NOT NULL,
  stripe_customer_id text,
  default_payment_method_id text,
  e2e_public_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE restaurant_diner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  diner_id uuid NOT NULL REFERENCES diners(id) ON DELETE CASCADE,
  visit_count integer DEFAULT 0,
  last_visit_at timestamptz,
  lifetime_spend_cents bigint DEFAULT 0,
  vip boolean DEFAULT false,
  banned boolean DEFAULT false,
  banned_reason text,
  allergens text[] DEFAULT '{}',
  preferences jsonb DEFAULT '{}',
  notes text,
  auto_tags jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, diner_id)
);

ALTER TABLE diners ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_diner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diners can view own profile" ON diners FOR SELECT USING (id = auth.uid());
CREATE POLICY "Service role manages diners" ON diners FOR ALL USING (true);

CREATE POLICY "Restaurant users can view guest profiles" ON restaurant_diner_profiles
  FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()));
CREATE POLICY "Managers can manage guest profiles" ON restaurant_diner_profiles
  FOR ALL USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'host')));
