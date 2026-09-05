export const CREATE_MEDICATIONS = `
CREATE TABLE IF NOT EXISTS md_medications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dosage TEXT,
    unit TEXT,
    frequency TEXT NOT NULL DEFAULT 'daily',
    instructions TEXT,
    prescriber TEXT,
    pharmacy TEXT,
    refill_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DOSES = `
CREATE TABLE IF NOT EXISTS md_doses (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL REFERENCES md_medications(id) ON DELETE CASCADE,
    taken_at TEXT NOT NULL,
    skipped INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DOSE_LOGS = `
CREATE TABLE IF NOT EXISTS md_dose_logs (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL REFERENCES md_medications(id) ON DELETE CASCADE,
    scheduled_time TEXT NOT NULL,
    actual_time TEXT,
    status TEXT NOT NULL DEFAULT 'taken' CHECK (status IN ('taken', 'skipped', 'late', 'snoozed')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_REMINDERS = `
CREATE TABLE IF NOT EXISTS md_reminders (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL REFERENCES md_medications(id) ON DELETE CASCADE,
    time TEXT NOT NULL,
    days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    is_active INTEGER NOT NULL DEFAULT 1,
    snooze_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_REFILLS = `
CREATE TABLE IF NOT EXISTS md_refills (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL REFERENCES md_medications(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    refill_date TEXT NOT NULL,
    pharmacy TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INTERACTIONS = `
CREATE TABLE IF NOT EXISTS md_interactions (
    id TEXT PRIMARY KEY,
    drug_a TEXT NOT NULL,
    drug_b TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe')),
    description TEXT NOT NULL,
    source TEXT NOT NULL
)`;

export const CREATE_MEASUREMENTS = `
CREATE TABLE IF NOT EXISTS md_measurements (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('blood_pressure', 'blood_sugar', 'weight', 'temperature', 'custom')),
    value TEXT NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT,
    measured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MOOD_ENTRIES = `
CREATE TABLE IF NOT EXISTS md_mood_entries (
    id TEXT PRIMARY KEY,
    mood TEXT NOT NULL,
    energy_level TEXT NOT NULL CHECK (energy_level IN ('high', 'low')),
    pleasantness TEXT NOT NULL CHECK (pleasantness IN ('pleasant', 'unpleasant')),
    intensity INTEGER NOT NULL DEFAULT 3 CHECK (intensity BETWEEN 1 AND 5),
    notes TEXT,
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MOOD_ACTIVITIES = `
CREATE TABLE IF NOT EXISTS md_mood_activities (
    id TEXT PRIMARY KEY,
    mood_entry_id TEXT NOT NULL REFERENCES md_mood_entries(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SYMPTOMS = `
CREATE TABLE IF NOT EXISTS md_symptoms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SYMPTOM_LOGS = `
CREATE TABLE IF NOT EXISTS md_symptom_logs (
    id TEXT PRIMARY KEY,
    symptom_id TEXT NOT NULL REFERENCES md_symptoms(id) ON DELETE CASCADE,
    severity INTEGER NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
    notes TEXT,
    logged_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS md_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DIARY_ENTRIES = `
CREATE TABLE IF NOT EXISTS md_diary_entries (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL REFERENCES md_medications(id) ON DELETE CASCADE,
    dose_log_id TEXT REFERENCES md_dose_logs(id) ON DELETE SET NULL,
    mood TEXT,
    pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
    effectiveness INTEGER NOT NULL DEFAULT 3 CHECK (effectiveness BETWEEN 1 AND 5),
    side_effects TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// V1 indexes only (for original 3 tables)
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS md_doses_med_idx ON md_doses(medication_id)`,
  `CREATE INDEX IF NOT EXISTS md_doses_taken_idx ON md_doses(taken_at)`,
  `CREATE INDEX IF NOT EXISTS md_medications_active_idx ON md_medications(is_active)`,
];

// V1 tables (original 3)
export const ALL_TABLES = [CREATE_MEDICATIONS, CREATE_DOSES, CREATE_SETTINGS];

// V2 tables (new tables added in migration v2)
export const V2_TABLES = [
  CREATE_DOSE_LOGS,
  CREATE_REMINDERS,
  CREATE_REFILLS,
  CREATE_INTERACTIONS,
  CREATE_MEASUREMENTS,
  CREATE_MOOD_ENTRIES,
  CREATE_MOOD_ACTIVITIES,
  CREATE_SYMPTOMS,
  CREATE_SYMPTOM_LOGS,
];

// V2 indexes (only the new indexes for v2 tables)
export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS md_dose_logs_med_sched_idx ON md_dose_logs(medication_id, scheduled_time)`,
  `CREATE INDEX IF NOT EXISTS md_reminders_med_idx ON md_reminders(medication_id)`,
  `CREATE INDEX IF NOT EXISTS md_refills_med_idx ON md_refills(medication_id)`,
  `CREATE INDEX IF NOT EXISTS md_interactions_drugs_idx ON md_interactions(drug_a, drug_b)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS md_interactions_pair_idx ON md_interactions(drug_a, drug_b)`,
  `CREATE INDEX IF NOT EXISTS md_measurements_type_date_idx ON md_measurements(type, measured_at)`,
  `CREATE INDEX IF NOT EXISTS md_mood_entries_recorded_idx ON md_mood_entries(recorded_at)`,
  `CREATE INDEX IF NOT EXISTS md_mood_activities_entry_idx ON md_mood_activities(mood_entry_id)`,
  `CREATE INDEX IF NOT EXISTS md_symptom_logs_symptom_date_idx ON md_symptom_logs(symptom_id, logged_at)`,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO md_settings (key, value) VALUES ('reminderTime', '08:00')`,
];

// ---------------------------------------------------------------------------
// V3 tables: Blood Pressure, Blood Glucose, Insulin
// ---------------------------------------------------------------------------

export const CREATE_BP_READINGS = `
CREATE TABLE IF NOT EXISTS md_bp_readings (
    id TEXT PRIMARY KEY,
    systolic INTEGER NOT NULL CHECK (systolic > 0 AND systolic <= 300),
    diastolic INTEGER NOT NULL CHECK (diastolic > 0 AND diastolic <= 200),
    pulse INTEGER CHECK (pulse > 0 AND pulse <= 300),
    arm TEXT CHECK (arm IN ('left', 'right')),
    position TEXT CHECK (position IN ('sitting', 'standing', 'lying')),
    context TEXT CHECK (context IN ('morning', 'evening', 'after_exercise', 'after_medication', 'routine')),
    category TEXT NOT NULL CHECK (category IN ('normal', 'elevated', 'hypertension_1', 'hypertension_2', 'crisis')),
    notes TEXT,
    measured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GLUCOSE_READINGS = `
CREATE TABLE IF NOT EXISTS md_glucose_readings (
    id TEXT PRIMARY KEY,
    value REAL NOT NULL CHECK (value > 0 AND value <= 600),
    unit TEXT NOT NULL DEFAULT 'mg/dL' CHECK (unit IN ('mg/dL', 'mmol/L')),
    meal_context TEXT CHECK (meal_context IN ('fasting', 'before_meal', 'after_meal', 'bedtime', 'random', 'after_exercise')),
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    in_range INTEGER NOT NULL DEFAULT 0 CHECK (in_range IN (0, 1)),
    range_status TEXT NOT NULL DEFAULT 'in_range' CHECK (range_status IN ('very_low', 'low', 'in_range', 'high', 'very_high')),
    notes TEXT,
    measured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INSULIN_ENTRIES = `
CREATE TABLE IF NOT EXISTS md_insulin_entries (
    id TEXT PRIMARY KEY,
    medication_id TEXT REFERENCES md_medications(id) ON DELETE SET NULL,
    insulin_type TEXT NOT NULL CHECK (insulin_type IN ('rapid', 'short', 'intermediate', 'long', 'mixed', 'ultra_rapid')),
    units REAL NOT NULL CHECK (units > 0),
    dose_category TEXT NOT NULL DEFAULT 'correction' CHECK (dose_category IN ('basal', 'bolus', 'correction', 'mixed')),
    injection_site TEXT,
    carbs_covered INTEGER,
    blood_glucose_before REAL,
    notes TEXT,
    administered_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INJECTION_SITES = `
CREATE TABLE IF NOT EXISTS md_injection_sites (
    id TEXT PRIMARY KEY,
    site_name TEXT NOT NULL CHECK (site_name IN ('abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'arm_left', 'arm_right', 'buttock_left', 'buttock_right')),
    last_used_at TEXT NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_TABLES = [
  CREATE_BP_READINGS,
  CREATE_GLUCOSE_READINGS,
  CREATE_INSULIN_ENTRIES,
  CREATE_INJECTION_SITES,
];

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS md_bp_readings_measured_idx ON md_bp_readings(measured_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_bp_readings_category_idx ON md_bp_readings(category)`,
  `CREATE INDEX IF NOT EXISTS md_bp_readings_context_idx ON md_bp_readings(context)`,
  `CREATE INDEX IF NOT EXISTS md_glucose_readings_measured_idx ON md_glucose_readings(measured_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_glucose_readings_context_idx ON md_glucose_readings(meal_context)`,
  `CREATE INDEX IF NOT EXISTS md_glucose_readings_range_idx ON md_glucose_readings(range_status)`,
  `CREATE INDEX IF NOT EXISTS md_insulin_entries_admin_idx ON md_insulin_entries(administered_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_insulin_entries_type_idx ON md_insulin_entries(insulin_type)`,
  `CREATE INDEX IF NOT EXISTS md_insulin_entries_med_idx ON md_insulin_entries(medication_id)`,
  `CREATE INDEX IF NOT EXISTS md_injection_sites_site_idx ON md_injection_sites(site_name, last_used_at DESC)`,
];

// ---------------------------------------------------------------------------
// V4 tables: Caregiver alerts, A1c records, FODMAP, Weather, Pain, CGM
// ---------------------------------------------------------------------------

export const CREATE_CAREGIVERS = `
CREATE TABLE IF NOT EXISTS md_caregivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    relationship TEXT CHECK (relationship IN ('spouse', 'parent', 'child', 'sibling', 'friend', 'doctor', 'nurse', 'other')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CAREGIVER_ALERT_CONFIG = `
CREATE TABLE IF NOT EXISTS md_caregiver_alert_config (
    id TEXT PRIMARY KEY,
    caregiver_id TEXT NOT NULL REFERENCES md_caregivers(id) ON DELETE CASCADE,
    medication_id TEXT REFERENCES md_medications(id) ON DELETE CASCADE,
    alert_all_meds INTEGER NOT NULL DEFAULT 0,
    delay_minutes INTEGER NOT NULL DEFAULT 30,
    alert_method TEXT NOT NULL DEFAULT 'sms' CHECK (alert_method IN ('sms', 'email', 'both')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CAREGIVER_ALERTS = `
CREATE TABLE IF NOT EXISTS md_caregiver_alerts (
    id TEXT PRIMARY KEY,
    caregiver_id TEXT NOT NULL REFERENCES md_caregivers(id) ON DELETE CASCADE,
    medication_id TEXT REFERENCES md_medications(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('missed_dose', 'low_adherence', 'low_supply', 'custom')),
    message TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('sms', 'email')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_A1C_RECORDS = `
CREATE TABLE IF NOT EXISTS md_a1c_records (
    id TEXT PRIMARY KEY,
    value REAL NOT NULL CHECK (value >= 3.0 AND value <= 20.0),
    source TEXT NOT NULL CHECK (source IN ('estimated', 'lab')),
    average_glucose REAL,
    reading_count INTEGER,
    period_days INTEGER,
    notes TEXT,
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FODMAP_FOODS = `
CREATE TABLE IF NOT EXISTS md_fodmap_foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('fruit', 'vegetable', 'grain', 'dairy', 'protein', 'legume', 'nut_seed', 'sweetener', 'condiment', 'beverage', 'other')),
    fodmap_rating TEXT NOT NULL CHECK (fodmap_rating IN ('low', 'moderate', 'high')),
    fructose INTEGER NOT NULL DEFAULT 0 CHECK (fructose IN (0, 1)),
    lactose INTEGER NOT NULL DEFAULT 0 CHECK (lactose IN (0, 1)),
    fructan INTEGER NOT NULL DEFAULT 0 CHECK (fructan IN (0, 1)),
    galactan INTEGER NOT NULL DEFAULT 0 CHECK (galactan IN (0, 1)),
    polyol INTEGER NOT NULL DEFAULT 0 CHECK (polyol IN (0, 1)),
    serving_size TEXT,
    notes TEXT
)`;

export const CREATE_FOOD_DIARY = `
CREATE TABLE IF NOT EXISTS md_food_diary (
    id TEXT PRIMARY KEY,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_items TEXT NOT NULL,
    fodmap_rating TEXT NOT NULL CHECK (fodmap_rating IN ('low', 'moderate', 'high', 'unknown')),
    fodmap_types TEXT,
    portion_size TEXT,
    notes TEXT,
    eaten_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_STOOL_LOGS = `
CREATE TABLE IF NOT EXISTS md_stool_logs (
    id TEXT PRIMARY KEY,
    bristol_type INTEGER NOT NULL CHECK (bristol_type >= 1 AND bristol_type <= 7),
    urgency INTEGER NOT NULL DEFAULT 1 CHECK (urgency >= 1 AND urgency <= 5),
    pain_level INTEGER NOT NULL DEFAULT 0 CHECK (pain_level >= 0 AND pain_level <= 5),
    blood INTEGER NOT NULL DEFAULT 0 CHECK (blood IN (0, 1)),
    notes TEXT,
    logged_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WEATHER_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS md_weather_snapshots (
    id TEXT PRIMARY KEY,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    temperature_c REAL,
    humidity_percent REAL,
    pressure_mb REAL,
    pressure_change_3h REAL,
    wind_speed_kmh REAL,
    weather_code INTEGER,
    weather_description TEXT,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WEATHER_SYMPTOM_LINKS = `
CREATE TABLE IF NOT EXISTS md_weather_symptom_links (
    id TEXT PRIMARY KEY,
    weather_snapshot_id TEXT NOT NULL REFERENCES md_weather_snapshots(id) ON DELETE CASCADE,
    symptom_log_id TEXT NOT NULL REFERENCES md_symptom_logs(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(weather_snapshot_id, symptom_log_id)
)`;

export const CREATE_PAIN_ENTRIES = `
CREATE TABLE IF NOT EXISTS md_pain_entries (
    id TEXT PRIMARY KEY,
    body_zone TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    pain_type TEXT CHECK (pain_type IN ('sharp', 'dull', 'burning', 'throbbing', 'aching', 'stabbing', 'cramping', 'tingling', 'shooting', 'pressure')),
    duration_minutes INTEGER,
    radiation TEXT,
    notes TEXT,
    started_at TEXT NOT NULL,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CGM_READINGS = `
CREATE TABLE IF NOT EXISTS md_cgm_readings (
    id TEXT PRIMARY KEY,
    value REAL NOT NULL CHECK (value > 0 AND value <= 600),
    unit TEXT NOT NULL DEFAULT 'mg/dL' CHECK (unit IN ('mg/dL', 'mmol/L')),
    range_status TEXT NOT NULL CHECK (range_status IN ('very_low', 'low', 'in_range', 'high', 'very_high')),
    source TEXT NOT NULL DEFAULT 'healthkit' CHECK (source IN ('healthkit', 'manual', 'import')),
    device_name TEXT,
    measured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CGM_SYNC_STATE = `
CREATE TABLE IF NOT EXISTS md_cgm_sync_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    last_sync_at TEXT NOT NULL,
    last_anchor TEXT,
    readings_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_TABLES = [
  CREATE_CAREGIVERS,
  CREATE_CAREGIVER_ALERT_CONFIG,
  CREATE_CAREGIVER_ALERTS,
  CREATE_A1C_RECORDS,
  CREATE_FODMAP_FOODS,
  CREATE_FOOD_DIARY,
  CREATE_STOOL_LOGS,
  CREATE_WEATHER_SNAPSHOTS,
  CREATE_WEATHER_SYMPTOM_LINKS,
  CREATE_PAIN_ENTRIES,
  CREATE_CGM_READINGS,
  CREATE_CGM_SYNC_STATE,
];

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS md_caregivers_active_idx ON md_caregivers(is_active)`,
  `CREATE INDEX IF NOT EXISTS md_caregiver_alert_config_cg_idx ON md_caregiver_alert_config(caregiver_id)`,
  `CREATE INDEX IF NOT EXISTS md_caregiver_alerts_cg_idx ON md_caregiver_alerts(caregiver_id, sent_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_a1c_records_recorded_idx ON md_a1c_records(recorded_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_a1c_records_source_idx ON md_a1c_records(source)`,
  `CREATE INDEX IF NOT EXISTS md_fodmap_foods_name_idx ON md_fodmap_foods(name)`,
  `CREATE INDEX IF NOT EXISTS md_fodmap_foods_rating_idx ON md_fodmap_foods(fodmap_rating)`,
  `CREATE INDEX IF NOT EXISTS md_food_diary_eaten_idx ON md_food_diary(eaten_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_stool_logs_logged_idx ON md_stool_logs(logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_weather_snapshots_captured_idx ON md_weather_snapshots(captured_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_weather_symptom_links_ws_idx ON md_weather_symptom_links(weather_snapshot_id)`,
  `CREATE INDEX IF NOT EXISTS md_weather_symptom_links_sl_idx ON md_weather_symptom_links(symptom_log_id)`,
  `CREATE INDEX IF NOT EXISTS md_pain_entries_zone_idx ON md_pain_entries(body_zone, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_pain_entries_started_idx ON md_pain_entries(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_cgm_readings_measured_idx ON md_cgm_readings(measured_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_cgm_readings_range_idx ON md_cgm_readings(range_status)`,
];

// ---------------------------------------------------------------------------
// V5 tables: Healthcare contacts and appointments
// ---------------------------------------------------------------------------

export const CREATE_CONTACTS = `
CREATE TABLE IF NOT EXISTS md_contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'doctor' CHECK (type IN ('doctor', 'pharmacy', 'clinic', 'lab', 'therapist', 'specialist', 'emergency', 'insurance', 'other')),
    specialty TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_APPOINTMENTS = `
CREATE TABLE IF NOT EXISTS md_appointments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    appointment_type TEXT NOT NULL DEFAULT 'checkup' CHECK (appointment_type IN ('checkup', 'follow_up', 'lab', 'specialist', 'therapy', 'screening', 'procedure', 'vaccination', 'dental', 'eye_exam', 'other')),
    provider_contact_id TEXT REFERENCES md_contacts(id) ON DELETE SET NULL,
    provider_name TEXT,
    specialty TEXT,
    scheduled_at TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK (reminder_enabled IN (0, 1)),
    reminder_minutes_before INTEGER NOT NULL DEFAULT 120,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'missed')),
    linked_medication_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V5_TABLES = [
  CREATE_CONTACTS,
  CREATE_APPOINTMENTS,
];

export const V5_INDEXES = [
  `CREATE INDEX IF NOT EXISTS md_contacts_type_name_idx ON md_contacts(type, name)`,
  `CREATE INDEX IF NOT EXISTS md_appointments_scheduled_idx ON md_appointments(scheduled_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_appointments_status_idx ON md_appointments(status, scheduled_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_appointments_provider_idx ON md_appointments(provider_contact_id)`,
];

export const V6_TABLES = [CREATE_DIARY_ENTRIES];

export const V6_INDEXES = [
  `CREATE INDEX IF NOT EXISTS md_diary_entries_med_idx ON md_diary_entries(medication_id, recorded_at DESC)`,
  `CREATE INDEX IF NOT EXISTS md_diary_entries_dose_idx ON md_diary_entries(dose_log_id)`,
  `CREATE INDEX IF NOT EXISTS md_diary_entries_recorded_idx ON md_diary_entries(recorded_at DESC)`,
];
