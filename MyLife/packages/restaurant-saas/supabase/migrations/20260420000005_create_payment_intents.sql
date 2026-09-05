CREATE TABLE payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid,
  stripe_payment_intent_id text UNIQUE NOT NULL,
  amount_cents integer NOT NULL,
  captured_cents integer DEFAULT 0,
  application_fee_cents integer DEFAULT 100,
  status text NOT NULL DEFAULT 'requires_payment_method',
  payment_method_id text,
  customer_id text,
  capture_method text DEFAULT 'manual',
  authorized_at timestamptz,
  captured_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'stripe',
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  processed_at timestamptz,
  error text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid REFERENCES payment_intents(id),
  stripe_dispute_id text UNIQUE NOT NULL,
  status text NOT NULL,
  amount_cents integer NOT NULL,
  reason text,
  evidence jsonb DEFAULT '{}',
  evidence_due_at timestamptz,
  outcome text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- payment_intents: accessible by restaurant users (through reservation -> restaurant)
-- For now, allow service role access only (webhooks use service role)
CREATE POLICY "Service role full access to payment_intents" ON payment_intents
  FOR ALL USING (true) WITH CHECK (true);

-- webhook_events: service role only
CREATE POLICY "Service role full access to webhook_events" ON webhook_events
  FOR ALL USING (true) WITH CHECK (true);

-- disputes: service role only (operators view via API)
CREATE POLICY "Service role full access to disputes" ON disputes
  FOR ALL USING (true) WITH CHECK (true);
