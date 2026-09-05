CREATE TABLE audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  rules jsonb NOT NULL DEFAULT '[]',
  size_cached integer DEFAULT 0,
  refreshed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  subject text,
  body_md text NOT NULL,
  variables jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  template_id uuid REFERENCES templates(id),
  audience_id uuid REFERENCES audiences(id),
  scheduled_at timestamptz,
  sent_at timestamptz,
  send_count integer DEFAULT 0,
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  unsubscribe_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  consent_check_passed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant users can view audiences" ON audiences FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()));
CREATE POLICY "Marketing staff can manage audiences" ON audiences FOR ALL USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'marketing')));

CREATE POLICY "Restaurant users can view templates" ON templates FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()));
CREATE POLICY "Marketing staff can manage templates" ON templates FOR ALL USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'marketing')));

CREATE POLICY "Restaurant users can view campaigns" ON campaigns FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()));
CREATE POLICY "Marketing staff can manage campaigns" ON campaigns FOR ALL USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'marketing')));
