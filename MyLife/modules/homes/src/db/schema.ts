export const CREATE_LISTINGS = `
CREATE TABLE IF NOT EXISTS hm_listings (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  bedrooms REAL NOT NULL DEFAULT 0,
  bathrooms REAL NOT NULL DEFAULT 0,
  sqft INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  is_saved INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TOURS = `
CREATE TABLE IF NOT EXISTS hm_tours (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES hm_listings(id) ON DELETE CASCADE,
  tour_at TEXT NOT NULL,
  agent_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hm_listings_status_idx ON hm_listings(status)`,
  `CREATE INDEX IF NOT EXISTS hm_listings_saved_idx ON hm_listings(is_saved)`,
  `CREATE INDEX IF NOT EXISTS hm_listings_price_idx ON hm_listings(price_cents)`,
  `CREATE INDEX IF NOT EXISTS hm_tours_listing_idx ON hm_tours(listing_id)`,
  `CREATE INDEX IF NOT EXISTS hm_tours_time_idx ON hm_tours(tour_at DESC)`,
];

export const ALL_TABLES = [CREATE_LISTINGS, CREATE_TOURS];

// ── V2: Properties & Maintenance ──

export const CREATE_PROPERTIES = `
CREATE TABLE IF NOT EXISTS hm_properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  year_built INTEGER,
  sqft INTEGER,
  property_type TEXT NOT NULL DEFAULT 'house',
  ownership_type TEXT NOT NULL DEFAULT 'own',
  listing_id TEXT REFERENCES hm_listings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MAINTENANCE_SCHEDULES = `
CREATE TABLE IF NOT EXISTS hm_maintenance_schedules (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'custom',
  task_type_custom TEXT,
  interval_months INTEGER NOT NULL,
  season_preference TEXT,
  last_completed_date TEXT,
  next_due_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  snooze_days INTEGER NOT NULL DEFAULT 0,
  snooze_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS hm_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const CREATE_V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hm_properties_type_idx ON hm_properties(property_type)`,
  `CREATE INDEX IF NOT EXISTS hm_schedules_property_active_idx ON hm_maintenance_schedules(property_id, is_active)`,
  `CREATE INDEX IF NOT EXISTS hm_schedules_next_due_idx ON hm_maintenance_schedules(next_due_date ASC)`,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO hm_settings (key, value) VALUES ('reminderNotificationsEnabled', 'true')`,
  `INSERT OR IGNORE INTO hm_settings (key, value) VALUES ('defaultRemindersOffered', 'true')`,
];

export const V2_TABLES = [CREATE_PROPERTIES, CREATE_MAINTENANCE_SCHEDULES, CREATE_SETTINGS];

// ── V3: B+C Features ──

export const CREATE_COST_ENTRIES = `
CREATE TABLE IF NOT EXISTS hm_cost_entries (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  schedule_id TEXT REFERENCES hm_maintenance_schedules(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  vendor TEXT,
  receipt_photo_uri TEXT,
  cost_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS hm_documents (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  file_uri TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  expiry_date TEXT,
  notes TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CONTRACTORS = `
CREATE TABLE IF NOT EXISTS hm_contractors (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES hm_properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  company TEXT,
  specialty TEXT NOT NULL DEFAULT 'general',
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  rating INTEGER,
  notes TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CONTRACTOR_SERVICES = `
CREATE TABLE IF NOT EXISTS hm_contractor_services (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL REFERENCES hm_contractors(id) ON DELETE CASCADE,
  schedule_id TEXT REFERENCES hm_maintenance_schedules(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  service_date TEXT NOT NULL,
  cost_cents INTEGER,
  rating INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INSURANCE_POLICIES = `
CREATE TABLE IF NOT EXISTS hm_insurance_policies (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'homeowners',
  coverage_amount_cents INTEGER NOT NULL DEFAULT 0,
  deductible_cents INTEGER NOT NULL DEFAULT 0,
  annual_premium_cents INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  document_id TEXT,
  agent_name TEXT,
  agent_phone TEXT,
  agent_email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ROOMS = `
CREATE TABLE IF NOT EXISTS hm_rooms (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'other',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INVENTORY_ITEMS = `
CREATE TABLE IF NOT EXISTS hm_inventory_items (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES hm_rooms(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date TEXT,
  purchase_price_cents INTEGER,
  estimated_value_cents INTEGER,
  condition TEXT NOT NULL DEFAULT 'good',
  photo_uri TEXT,
  warranty_expiry TEXT,
  document_id TEXT REFERENCES hm_documents(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_APPLIANCES = `
CREATE TABLE IF NOT EXISTS hm_appliances (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  room_id TEXT,
  inventory_item_id TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  model_number TEXT,
  serial_number TEXT,
  purchase_date TEXT,
  purchase_price_cents INTEGER,
  warranty_expiry TEXT,
  manual_uri TEXT,
  photo_uri TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  condition TEXT NOT NULL DEFAULT 'good',
  schedule_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PROJECTS = `
CREATE TABLE IF NOT EXISTS hm_projects (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  target_end_date TEXT,
  actual_end_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PROJECT_PHASES = `
CREATE TABLE IF NOT EXISTS hm_project_phases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES hm_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date TEXT,
  end_date TEXT,
  budget_cents INTEGER,
  contractor_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PROJECT_PHOTOS = `
CREATE TABLE IF NOT EXISTS hm_project_photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES hm_projects(id) ON DELETE CASCADE,
  phase_id TEXT,
  photo_uri TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT NOT NULL DEFAULT 'during',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hm_costs_property_idx ON hm_cost_entries(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_costs_category_idx ON hm_cost_entries(category)`,
  `CREATE INDEX IF NOT EXISTS hm_costs_date_idx ON hm_cost_entries(cost_date DESC)`,
  `CREATE INDEX IF NOT EXISTS hm_costs_schedule_idx ON hm_cost_entries(schedule_id)`,
  `CREATE INDEX IF NOT EXISTS hm_documents_property_idx ON hm_documents(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_documents_category_idx ON hm_documents(category)`,
  `CREATE INDEX IF NOT EXISTS hm_documents_expiry_idx ON hm_documents(expiry_date ASC)`,
  `CREATE INDEX IF NOT EXISTS hm_contractors_property_idx ON hm_contractors(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_contractors_specialty_idx ON hm_contractors(specialty)`,
  `CREATE INDEX IF NOT EXISTS hm_contractors_favorite_idx ON hm_contractors(is_favorite DESC)`,
  `CREATE INDEX IF NOT EXISTS hm_services_contractor_idx ON hm_contractor_services(contractor_id)`,
  `CREATE INDEX IF NOT EXISTS hm_services_schedule_idx ON hm_contractor_services(schedule_id)`,
  `CREATE INDEX IF NOT EXISTS hm_services_date_idx ON hm_contractor_services(service_date DESC)`,
  `CREATE INDEX IF NOT EXISTS hm_insurance_property_idx ON hm_insurance_policies(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_insurance_end_date_idx ON hm_insurance_policies(end_date ASC)`,
  `CREATE INDEX IF NOT EXISTS hm_insurance_type_idx ON hm_insurance_policies(policy_type)`,
  `CREATE INDEX IF NOT EXISTS hm_rooms_property_idx ON hm_rooms(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_rooms_sort_idx ON hm_rooms(property_id, sort_order ASC)`,
  `CREATE INDEX IF NOT EXISTS hm_items_room_idx ON hm_inventory_items(room_id)`,
  `CREATE INDEX IF NOT EXISTS hm_items_property_idx ON hm_inventory_items(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_items_category_idx ON hm_inventory_items(category)`,
  `CREATE INDEX IF NOT EXISTS hm_items_value_idx ON hm_inventory_items(estimated_value_cents DESC)`,
  `CREATE INDEX IF NOT EXISTS hm_appliances_property_idx ON hm_appliances(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_appliances_category_idx ON hm_appliances(category)`,
  `CREATE INDEX IF NOT EXISTS hm_appliances_warranty_idx ON hm_appliances(warranty_expiry ASC)`,
  `CREATE INDEX IF NOT EXISTS hm_projects_property_idx ON hm_projects(property_id)`,
  `CREATE INDEX IF NOT EXISTS hm_projects_status_idx ON hm_projects(status)`,
  `CREATE INDEX IF NOT EXISTS hm_phases_project_idx ON hm_project_phases(project_id)`,
  `CREATE INDEX IF NOT EXISTS hm_phases_sort_idx ON hm_project_phases(project_id, sort_order ASC)`,
  `CREATE INDEX IF NOT EXISTS hm_photos_project_idx ON hm_project_photos(project_id)`,
  `CREATE INDEX IF NOT EXISTS hm_photos_phase_idx ON hm_project_photos(phase_id)`,
];

export const V3_TABLES = [
  CREATE_COST_ENTRIES,
  CREATE_DOCUMENTS,
  CREATE_CONTRACTORS,
  CREATE_CONTRACTOR_SERVICES,
  CREATE_INSURANCE_POLICIES,
  CREATE_ROOMS,
  CREATE_INVENTORY_ITEMS,
  CREATE_APPLIANCES,
  CREATE_PROJECTS,
  CREATE_PROJECT_PHASES,
  CREATE_PROJECT_PHOTOS,
];
