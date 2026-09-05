-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_layouts ENABLE ROW LEVEL SECURITY;

-- restaurants: user must be in restaurant_users for this restaurant
CREATE POLICY "Users can view their restaurants" ON restaurants
  FOR SELECT USING (
    id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners can update their restaurant" ON restaurants
  FOR UPDATE USING (
    id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role = 'owner')
  );

-- restaurant_users: can see co-workers at same restaurant
CREATE POLICY "Users can view co-workers" ON restaurant_users
  FOR SELECT USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners/managers can manage staff" ON restaurant_users
  FOR ALL USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
  );

-- floor_areas: via restaurant_id
CREATE POLICY "Restaurant users can view floor areas" ON floor_areas
  FOR SELECT USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners/managers/hosts can manage floor areas" ON floor_areas
  FOR ALL USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'host'))
  );

-- floor_tables: via area_id -> floor_areas.restaurant_id
CREATE POLICY "Restaurant users can view tables" ON floor_tables
  FOR SELECT USING (
    area_id IN (
      SELECT fa.id FROM floor_areas fa
      JOIN restaurant_users ru ON ru.restaurant_id = fa.restaurant_id
      WHERE ru.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners/managers/hosts can manage tables" ON floor_tables
  FOR ALL USING (
    area_id IN (
      SELECT fa.id FROM floor_areas fa
      JOIN restaurant_users ru ON ru.restaurant_id = fa.restaurant_id
      WHERE ru.user_id = auth.uid() AND ru.role IN ('owner', 'manager', 'host')
    )
  );

-- floor_layouts: via restaurant_id
CREATE POLICY "Restaurant users can view layouts" ON floor_layouts
  FOR SELECT USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners/managers can manage layouts" ON floor_layouts
  FOR ALL USING (
    restaurant_id IN (SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
  );
