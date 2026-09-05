/**
 * SQLite schema for MyCar module.
 * All table names use the cr_ prefix to avoid collisions in the shared hub database.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 * Money stored as INTEGER (cents).
 */

// -- 1. Vehicles --
export const CREATE_VEHICLES = `
CREATE TABLE IF NOT EXISTS cr_vehicles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    color TEXT,
    vin TEXT,
    license_plate TEXT,
    odometer INTEGER NOT NULL DEFAULT 0,
    fuel_type TEXT NOT NULL DEFAULT 'gas',
    is_primary INTEGER NOT NULL DEFAULT 0,
    image_uri TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 2. Maintenance --
export const CREATE_MAINTENANCE = `
CREATE TABLE IF NOT EXISTS cr_maintenance (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'other',
    description TEXT,
    cost_cents INTEGER,
    odometer_at INTEGER,
    performed_at TEXT NOT NULL,
    next_due_date TEXT,
    next_due_odometer INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 3. Fuel Logs --
export const CREATE_FUEL_LOGS = `
CREATE TABLE IF NOT EXISTS cr_fuel_logs (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    gallons REAL NOT NULL,
    cost_cents INTEGER NOT NULL,
    odometer_at INTEGER NOT NULL,
    station TEXT,
    is_full_tank INTEGER NOT NULL DEFAULT 1,
    logged_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 4. Settings --
export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS cr_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 5. Maintenance Schedules --
export const CREATE_MAINTENANCE_SCHEDULES = `
CREATE TABLE IF NOT EXISTS cr_maintenance_schedules (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL DEFAULT 'custom',
    service_type_custom TEXT,
    interval_miles INTEGER,
    interval_months INTEGER,
    last_service_date TEXT,
    last_service_odometer INTEGER,
    next_due_odometer INTEGER,
    next_due_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    snooze_miles INTEGER NOT NULL DEFAULT 0,
    snooze_date_offset_days INTEGER NOT NULL DEFAULT 0,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SCHEDULE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_schedules_vehicle_active_idx ON cr_maintenance_schedules(vehicle_id, is_active)`,
  `CREATE INDEX IF NOT EXISTS cr_schedules_next_due_date_idx ON cr_maintenance_schedules(next_due_date ASC)`,
  `CREATE INDEX IF NOT EXISTS cr_schedules_next_due_odo_idx ON cr_maintenance_schedules(next_due_odometer ASC)`,
];

// -- Indexes --
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_maintenance_vehicle_idx ON cr_maintenance(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_maintenance_performed_idx ON cr_maintenance(performed_at)`,
  `CREATE INDEX IF NOT EXISTS cr_fuel_logs_vehicle_idx ON cr_fuel_logs(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_fuel_logs_logged_idx ON cr_fuel_logs(logged_at)`,
  `CREATE INDEX IF NOT EXISTS cr_vehicles_primary_idx ON cr_vehicles(is_primary)`,
];

// -- 6. Trips --
export const CREATE_TRIPS = `
CREATE TABLE IF NOT EXISTS cr_trips (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'personal',
    route_name TEXT,
    start_odometer INTEGER NOT NULL,
    end_odometer INTEGER NOT NULL,
    distance INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TRIP_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_trips_vehicle_idx ON cr_trips(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_trips_purpose_idx ON cr_trips(purpose)`,
  `CREATE INDEX IF NOT EXISTS cr_trips_started_idx ON cr_trips(started_at DESC)`,
];

// -- 7. Insurance Policies --
export const CREATE_INSURANCE_POLICIES = `
CREATE TABLE IF NOT EXISTS cr_insurance_policies (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    policy_number TEXT,
    coverage_type TEXT NOT NULL DEFAULT 'liability',
    premium_cents INTEGER,
    premium_frequency TEXT,
    deductible_cents INTEGER,
    start_date TEXT,
    end_date TEXT,
    agent_name TEXT,
    agent_phone TEXT,
    agent_email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 8. Insurance Documents --
export const CREATE_INSURANCE_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS cr_insurance_documents (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL REFERENCES cr_insurance_policies(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'other',
    image_uri TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INSURANCE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_insurance_vehicle_idx ON cr_insurance_policies(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_insurance_docs_policy_idx ON cr_insurance_documents(policy_id)`,
];

// -- 9. Registrations --
export const CREATE_REGISTRATIONS = `
CREATE TABLE IF NOT EXISTS cr_registrations (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    reg_state TEXT,
    reg_number TEXT,
    reg_expiration_date TEXT,
    inspection_type TEXT NOT NULL DEFAULT 'none',
    inspection_expiration_date TEXT,
    inspection_station TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 10. Registration Documents --
export const CREATE_REGISTRATION_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS cr_registration_documents (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL REFERENCES cr_registrations(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'other',
    image_uri TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_REGISTRATION_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_registrations_vehicle_idx ON cr_registrations(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_reg_docs_reg_idx ON cr_registration_documents(registration_id)`,
];

// -- 11. GPS Trips --
export const CREATE_GPS_TRIPS = `
CREATE TABLE IF NOT EXISTS cr_gps_trips (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'personal',
    route_name TEXT,
    start_lat REAL,
    start_lng REAL,
    end_lat REAL,
    end_lng REAL,
    distance_meters REAL NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    polyline_encoded TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GPS_TRIP_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_gps_trips_vehicle_idx ON cr_gps_trips(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_gps_trips_started_idx ON cr_gps_trips(started_at DESC)`,
];

// -- 12. Tire Sets --
export const CREATE_TIRE_SETS = `
CREATE TABLE IF NOT EXISTS cr_tire_sets (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    brand TEXT,
    model_name TEXT,
    size TEXT,
    purchased_at TEXT,
    purchase_price_cents INTEGER,
    purchase_odometer INTEGER,
    is_current INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 13. Tire Measurements --
export const CREATE_TIRE_MEASUREMENTS = `
CREATE TABLE IF NOT EXISTS cr_tire_measurements (
    id TEXT PRIMARY KEY,
    tire_set_id TEXT NOT NULL REFERENCES cr_tire_sets(id) ON DELETE CASCADE,
    position TEXT NOT NULL,
    tread_depth_32nds INTEGER NOT NULL,
    measured_at TEXT NOT NULL,
    odometer_at INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 14. Tire Rotations --
export const CREATE_TIRE_ROTATIONS = `
CREATE TABLE IF NOT EXISTS cr_tire_rotations (
    id TEXT PRIMARY KEY,
    tire_set_id TEXT NOT NULL REFERENCES cr_tire_sets(id) ON DELETE CASCADE,
    rotated_at TEXT NOT NULL,
    odometer_at INTEGER,
    pattern TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TIRE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_tire_sets_vehicle_idx ON cr_tire_sets(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_tire_sets_current_idx ON cr_tire_sets(vehicle_id, is_current)`,
  `CREATE INDEX IF NOT EXISTS cr_tire_measurements_set_idx ON cr_tire_measurements(tire_set_id)`,
  `CREATE INDEX IF NOT EXISTS cr_tire_rotations_set_idx ON cr_tire_rotations(tire_set_id)`,
];

// -- 15. Parking Locations --
export const CREATE_PARKING_LOCATIONS = `
CREATE TABLE IF NOT EXISTS cr_parking_locations (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    accuracy REAL,
    level TEXT,
    spot TEXT,
    photo_uri TEXT,
    meter_expires_at TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    saved_at TEXT NOT NULL,
    cleared_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PARKING_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_parking_vehicle_active_idx ON cr_parking_locations(vehicle_id, is_active)`,
];

// -- 16. Recalls --
export const CREATE_RECALLS = `
CREATE TABLE IF NOT EXISTS cr_recalls (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    nhtsa_campaign_number TEXT NOT NULL,
    component TEXT,
    summary TEXT,
    consequence TEXT,
    remedy TEXT,
    is_acknowledged INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RECALL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_recalls_vehicle_idx ON cr_recalls(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_recalls_campaign_idx ON cr_recalls(nhtsa_campaign_number)`,
];

// -- 17. Diagnostic Snapshots --
export const CREATE_DIAGNOSTIC_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS cr_diagnostic_snapshots (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    adapter_name TEXT,
    protocol TEXT,
    snapshot_at TEXT NOT NULL,
    dtc_count INTEGER NOT NULL DEFAULT 0,
    mil_status INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 18. Diagnostic Codes --
export const CREATE_DIAGNOSTIC_CODES = `
CREATE TABLE IF NOT EXISTS cr_diagnostic_codes (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL REFERENCES cr_diagnostic_snapshots(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    system TEXT NOT NULL DEFAULT 'powertrain',
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    is_pending INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 19. Live Data Logs --
export const CREATE_LIVE_DATA_LOGS = `
CREATE TABLE IF NOT EXISTS cr_live_data_logs (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    pid TEXT NOT NULL,
    pid_name TEXT,
    value REAL NOT NULL,
    unit TEXT,
    logged_at TEXT NOT NULL
)`;

export const CREATE_DIAGNOSTIC_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cr_diag_snapshots_vehicle_idx ON cr_diagnostic_snapshots(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_diag_codes_snapshot_idx ON cr_diagnostic_codes(snapshot_id)`,
  `CREATE INDEX IF NOT EXISTS cr_live_data_vehicle_idx ON cr_live_data_logs(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS cr_live_data_vehicle_logged_idx ON cr_live_data_logs(vehicle_id, logged_at DESC)`,
];

/** All table creation statements in dependency order */
export const ALL_TABLES = [
  CREATE_VEHICLES,
  CREATE_MAINTENANCE,
  CREATE_FUEL_LOGS,
  CREATE_SETTINGS,
];

/** Seed SQL for default settings */
export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO cr_settings (key, value) VALUES ('distanceUnit', 'miles')`,
  `INSERT OR IGNORE INTO cr_settings (key, value) VALUES ('fuelUnit', 'gallons')`,
  `INSERT OR IGNORE INTO cr_settings (key, value) VALUES ('currencyCode', 'USD')`,
];
