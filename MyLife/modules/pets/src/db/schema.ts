export const CREATE_PETS = `
CREATE TABLE IF NOT EXISTS pt_pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  birth_date TEXT,
  adoption_date TEXT,
  sex TEXT NOT NULL DEFAULT 'unknown',
  is_sterilized INTEGER NOT NULL DEFAULT 0,
  microchip_id TEXT,
  current_weight_grams INTEGER,
  image_uri TEXT,
  notes TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_VET_VISITS = `
CREATE TABLE IF NOT EXISTS pt_vet_visits (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  visit_date TEXT NOT NULL,
  visit_type TEXT NOT NULL DEFAULT 'other',
  reason TEXT NOT NULL,
  clinic_name TEXT,
  veterinarian TEXT,
  diagnosis TEXT,
  treatment TEXT,
  weight_grams INTEGER,
  cost_cents INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_VACCINATIONS = `
CREATE TABLE IF NOT EXISTS pt_vaccinations (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_given TEXT NOT NULL,
  next_due_date TEXT,
  veterinarian TEXT,
  lot_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MEDICATIONS = `
CREATE TABLE IF NOT EXISTS pt_medications (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT NOT NULL,
  interval_days INTEGER,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  next_due_at TEXT,
  last_given_at TEXT,
  prescribed_by TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MEDICATION_LOGS = `
CREATE TABLE IF NOT EXISTS pt_medication_logs (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL REFERENCES pt_medications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'given',
  logged_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WEIGHT_ENTRIES = `
CREATE TABLE IF NOT EXISTS pt_weight_entries (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  weight_grams INTEGER NOT NULL,
  body_condition_score INTEGER,
  logged_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FEEDING_SCHEDULES = `
CREATE TABLE IF NOT EXISTS pt_feeding_schedules (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  food_name TEXT,
  amount TEXT,
  feed_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EXPENSES = `
CREATE TABLE IF NOT EXISTS pt_expenses (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  spent_on TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EMERGENCY_CONTACTS = `
CREATE TABLE IF NOT EXISTS pt_emergency_contacts (
  id TEXT PRIMARY KEY,
  pet_id TEXT REFERENCES pt_pets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  hours TEXT,
  notes TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EXERCISE_LOGS = `
CREATE TABLE IF NOT EXISTS pt_exercise_logs (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  distance_km REAL,
  logged_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GROOMING_RECORDS = `
CREATE TABLE IF NOT EXISTS pt_grooming_records (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  grooming_type TEXT NOT NULL,
  groomed_at TEXT NOT NULL,
  next_due_date TEXT,
  provider TEXT,
  cost_cents INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TRAINING_LOGS = `
CREATE TABLE IF NOT EXISTS pt_training_logs (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  command_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'home',
  duration_minutes INTEGER,
  success_rating INTEGER,
  logged_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PET_PHOTOS = `
CREATE TABLE IF NOT EXISTS pt_pet_photos (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  image_uri TEXT NOT NULL,
  caption TEXT,
  milestone_tag TEXT,
  taken_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const BASE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS pt_pets_archived_idx ON pt_pets(is_archived, name)`,
  `CREATE INDEX IF NOT EXISTS pt_vet_visits_pet_idx ON pt_vet_visits(pet_id, visit_date DESC)`,
  `CREATE INDEX IF NOT EXISTS pt_vaccinations_pet_idx ON pt_vaccinations(pet_id, next_due_date)`,
  `CREATE INDEX IF NOT EXISTS pt_vaccinations_due_idx ON pt_vaccinations(next_due_date)`,
  `CREATE INDEX IF NOT EXISTS pt_medications_pet_idx ON pt_medications(pet_id, next_due_at)`,
  `CREATE INDEX IF NOT EXISTS pt_medications_due_idx ON pt_medications(next_due_at, is_active)`,
  `CREATE INDEX IF NOT EXISTS pt_medication_logs_med_idx ON pt_medication_logs(medication_id, logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS pt_weight_entries_pet_idx ON pt_weight_entries(pet_id, logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS pt_feeding_schedules_pet_idx ON pt_feeding_schedules(pet_id, feed_at)`,
  `CREATE INDEX IF NOT EXISTS pt_expenses_pet_idx ON pt_expenses(pet_id, spent_on DESC)`,
];

export const EXPANDED_CARE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS pt_emergency_contacts_pet_idx ON pt_emergency_contacts(pet_id, is_primary DESC, clinic_name ASC)`,
  `CREATE INDEX IF NOT EXISTS pt_exercise_logs_pet_idx ON pt_exercise_logs(pet_id, logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS pt_grooming_records_pet_idx ON pt_grooming_records(pet_id, groomed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS pt_grooming_records_due_idx ON pt_grooming_records(next_due_date)`,
  `CREATE INDEX IF NOT EXISTS pt_training_logs_pet_idx ON pt_training_logs(pet_id, logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS pt_pet_photos_pet_idx ON pt_pet_photos(pet_id, COALESCE(taken_at, created_at) DESC)`,
];

export const BASE_TABLES = [
  CREATE_PETS,
  CREATE_VET_VISITS,
  CREATE_VACCINATIONS,
  CREATE_MEDICATIONS,
  CREATE_MEDICATION_LOGS,
  CREATE_WEIGHT_ENTRIES,
  CREATE_FEEDING_SCHEDULES,
  CREATE_EXPENSES,
];

export const EXPANDED_CARE_TABLES = [
  CREATE_EMERGENCY_CONTACTS,
  CREATE_EXERCISE_LOGS,
  CREATE_GROOMING_RECORDS,
  CREATE_TRAINING_LOGS,
  CREATE_PET_PHOTOS,
];

// ── V3: Feeding Enhancement ──────────────────────────────────────────

export const FEEDING_SCHEDULE_ALTER_COLUMNS = [
  `ALTER TABLE pt_feeding_schedules ADD COLUMN portion_size REAL`,
  `ALTER TABLE pt_feeding_schedules ADD COLUMN portion_unit TEXT DEFAULT 'cups'`,
  `ALTER TABLE pt_feeding_schedules ADD COLUMN portion_unit_custom TEXT`,
  `ALTER TABLE pt_feeding_schedules ADD COLUMN meal_label TEXT`,
  `ALTER TABLE pt_feeding_schedules ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE pt_feeding_schedules ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`,
];

export const CREATE_FEEDING_LOGS = `
CREATE TABLE IF NOT EXISTS pt_feeding_logs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES pt_feeding_schedules(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  fed_at TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DIETARY_INFO = `
CREATE TABLE IF NOT EXISTS pt_dietary_info (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  allergies TEXT NOT NULL DEFAULT '[]',
  restrictions TEXT NOT NULL DEFAULT '[]',
  special_instructions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id)
)`;

export const CREATE_FOOD_TRANSITIONS = `
CREATE TABLE IF NOT EXISTS pt_food_transitions (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  previous_food TEXT NOT NULL,
  new_food TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const FEEDING_ENHANCEMENT_TABLES = [
  CREATE_FEEDING_LOGS,
  CREATE_DIETARY_INFO,
  CREATE_FOOD_TRANSITIONS,
];

export const FEEDING_ENHANCEMENT_INDEXES = [
  `CREATE INDEX IF NOT EXISTS pt_feeding_logs_schedule_date_idx ON pt_feeding_logs(schedule_id, date)`,
  `CREATE INDEX IF NOT EXISTS pt_feeding_logs_pet_date_idx ON pt_feeding_logs(pet_id, date)`,
  `CREATE INDEX IF NOT EXISTS pt_dietary_info_pet_idx ON pt_dietary_info(pet_id)`,
  `CREATE INDEX IF NOT EXISTS pt_food_transitions_pet_status_idx ON pt_food_transitions(pet_id, status)`,
];

// ── V4: B+C Feature Enhancement ──────────────────────────────────────

export const EXERCISE_LOG_ALTER_COLUMNS = [
  `ALTER TABLE pt_exercise_logs ADD COLUMN group_id TEXT`,
  `ALTER TABLE pt_exercise_logs ADD COLUMN start_time TEXT`,
];

export const CREATE_EXERCISE_GOALS = `
CREATE TABLE IF NOT EXISTS pt_exercise_goals (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  daily_goal_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id)
)`;

export const CREATE_INSURANCE_POLICIES = `
CREATE TABLE IF NOT EXISTS pt_insurance_policies (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  policy_number TEXT,
  coverage_type TEXT NOT NULL DEFAULT 'accident_illness',
  monthly_premium_cents INTEGER,
  deductible_cents INTEGER,
  annual_limit_cents INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INSURANCE_CLAIMS = `
CREATE TABLE IF NOT EXISTS pt_insurance_claims (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES pt_insurance_policies(id) ON DELETE CASCADE,
  claim_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  reimbursement_cents INTEGER,
  resolved_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EXPENSE_BUDGETS = `
CREATE TABLE IF NOT EXISTS pt_expense_budgets (
  id TEXT PRIMARY KEY,
  pet_id TEXT REFERENCES pt_pets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_budget_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, category)
)`;

export const CREATE_GROOMING_INTERVALS = `
CREATE TABLE IF NOT EXISTS pt_grooming_intervals (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  grooming_type TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, grooming_type)
)`;

export const CREATE_TRAINING_COMMANDS = `
CREATE TABLE IF NOT EXISTS pt_training_commands (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  command_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'learning',
  mastered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, command_name)
)`;

export const CREATE_DISMISSED_ALERTS = `
CREATE TABLE IF NOT EXISTS pt_dismissed_alerts (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  dismissed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, alert_id)
)`;

export const V4_TABLES = [
  CREATE_EXERCISE_GOALS,
  CREATE_INSURANCE_POLICIES,
  CREATE_INSURANCE_CLAIMS,
  CREATE_EXPENSE_BUDGETS,
  CREATE_GROOMING_INTERVALS,
  CREATE_TRAINING_COMMANDS,
  CREATE_DISMISSED_ALERTS,
];

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS pt_exercise_goals_pet_idx ON pt_exercise_goals(pet_id)`,
  `CREATE INDEX IF NOT EXISTS pt_exercise_logs_group_idx ON pt_exercise_logs(group_id)`,
  `CREATE INDEX IF NOT EXISTS pt_exercise_logs_pet_date_idx ON pt_exercise_logs(pet_id, logged_at)`,
  `CREATE INDEX IF NOT EXISTS pt_insurance_policies_pet_idx ON pt_insurance_policies(pet_id)`,
  `CREATE INDEX IF NOT EXISTS pt_insurance_claims_policy_idx ON pt_insurance_claims(policy_id, claim_date)`,
  `CREATE INDEX IF NOT EXISTS pt_expense_budgets_pet_idx ON pt_expense_budgets(pet_id, category)`,
  `CREATE INDEX IF NOT EXISTS pt_expenses_category_idx ON pt_expenses(pet_id, category, spent_on)`,
  `CREATE INDEX IF NOT EXISTS pt_grooming_intervals_pet_idx ON pt_grooming_intervals(pet_id)`,
  `CREATE INDEX IF NOT EXISTS pt_training_commands_pet_idx ON pt_training_commands(pet_id, status)`,
  `CREATE INDEX IF NOT EXISTS pt_dismissed_alerts_pet_idx ON pt_dismissed_alerts(pet_id)`,
];

export const ALL_TABLES = [...BASE_TABLES, ...EXPANDED_CARE_TABLES];
export const CREATE_INDEXES = [...BASE_INDEXES, ...EXPANDED_CARE_INDEXES];
