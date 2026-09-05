CREATE TABLE restaurant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'host', 'server', 'marketing')),
  can_manage_billing boolean DEFAULT false,
  can_manage_staff boolean DEFAULT false,
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(restaurant_id, user_id)
);
