CREATE TABLE floor_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true
);

CREATE TABLE floor_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES floor_areas(id) ON DELETE CASCADE,
  shape text NOT NULL CHECK (shape IN ('round', 'square', 'rectangle', 'banquette', 'bar')),
  pos_x integer DEFAULT 0,
  pos_y integer DEFAULT 0,
  width integer DEFAULT 60,
  height integer DEFAULT 60,
  rotation integer DEFAULT 0,
  capacity_min integer DEFAULT 1,
  capacity_max integer DEFAULT 4,
  combinable_with uuid[] DEFAULT '{}',
  server_zone text,
  table_number text,
  active boolean DEFAULT true
);

CREATE TABLE floor_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
