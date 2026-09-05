/**
 * SQLite schema for MyRSVP module.
 * All table names use rv_ prefix to avoid collisions in the shared hub database.
 */

export const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS rv_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    location_name TEXT,
    location_address TEXT,
    cover_image_url TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    password TEXT,
    requires_approval INTEGER NOT NULL DEFAULT 0,
    allow_plus_ones INTEGER NOT NULL DEFAULT 1,
    max_guests INTEGER,
    waitlist_enabled INTEGER NOT NULL DEFAULT 1,
    allow_photo_album INTEGER NOT NULL DEFAULT 1,
    allow_comments INTEGER NOT NULL DEFAULT 1,
    allow_polls INTEGER NOT NULL DEFAULT 1,
    allow_cohosts INTEGER NOT NULL DEFAULT 1,
    allow_chip_in INTEGER NOT NULL DEFAULT 1,
    chip_in_url TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EVENT_COHOSTS = `
CREATE TABLE IF NOT EXISTS rv_event_cohosts (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INVITES = `
CREATE TABLE IF NOT EXISTS rv_invites (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    invitee_name TEXT NOT NULL,
    invitee_contact TEXT,
    invitee_type TEXT NOT NULL DEFAULT 'link',
    status TEXT NOT NULL DEFAULT 'invited',
    plus_one_limit INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RSVPS = `
CREATE TABLE IF NOT EXISTS rv_rsvps (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    invite_id TEXT REFERENCES rv_invites(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    guest_contact TEXT,
    response TEXT NOT NULL DEFAULT 'maybe',
    plus_ones_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    responded_at TEXT NOT NULL,
    checked_in_at TEXT,
    source TEXT NOT NULL DEFAULT 'app',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_QUESTIONS = `
CREATE TABLE IF NOT EXISTS rv_questions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    options_json TEXT NOT NULL DEFAULT '[]',
    required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_QUESTION_RESPONSES = `
CREATE TABLE IF NOT EXISTS rv_question_responses (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    rsvp_id TEXT NOT NULL REFERENCES rv_rsvps(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES rv_questions(id) ON DELETE CASCADE,
    answer_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_POLLS = `
CREATE TABLE IF NOT EXISTS rv_polls (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL DEFAULT '[]',
    multiple_choice INTEGER NOT NULL DEFAULT 0,
    is_open INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_POLL_VOTES = `
CREATE TABLE IF NOT EXISTS rv_poll_votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL REFERENCES rv_polls(id) ON DELETE CASCADE,
    rsvp_id TEXT REFERENCES rv_rsvps(id) ON DELETE SET NULL,
    guest_name TEXT,
    option_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ANNOUNCEMENTS = `
CREATE TABLE IF NOT EXISTS rv_announcements (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    send_channel TEXT NOT NULL DEFAULT 'all',
    scheduled_for TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_COMMENTS = `
CREATE TABLE IF NOT EXISTS rv_comments (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    rsvp_id TEXT REFERENCES rv_rsvps(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PHOTOS = `
CREATE TABLE IF NOT EXISTS rv_photos (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    rsvp_id TEXT REFERENCES rv_rsvps(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    caption TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EVENT_LINKS = `
CREATE TABLE IF NOT EXISTS rv_event_links (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'other',
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS rv_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rv_events_start_idx ON rv_events(start_at)`,
  `CREATE INDEX IF NOT EXISTS rv_invites_event_idx ON rv_invites(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_invites_status_idx ON rv_invites(status)`,
  `CREATE INDEX IF NOT EXISTS rv_rsvps_event_idx ON rv_rsvps(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_rsvps_response_idx ON rv_rsvps(response)`,
  `CREATE INDEX IF NOT EXISTS rv_rsvps_checkin_idx ON rv_rsvps(checked_in_at)`,
  `CREATE INDEX IF NOT EXISTS rv_questions_event_idx ON rv_questions(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_question_responses_rsvp_idx ON rv_question_responses(rsvp_id)`,
  `CREATE INDEX IF NOT EXISTS rv_polls_event_idx ON rv_polls(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_poll_votes_poll_idx ON rv_poll_votes(poll_id)`,
  `CREATE INDEX IF NOT EXISTS rv_announcements_event_idx ON rv_announcements(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_comments_event_idx ON rv_comments(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_photos_event_idx ON rv_photos(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_event_links_event_idx ON rv_event_links(event_id)`
];

export const ALL_TABLES = [
  CREATE_EVENTS,
  CREATE_EVENT_COHOSTS,
  CREATE_INVITES,
  CREATE_RSVPS,
  CREATE_QUESTIONS,
  CREATE_QUESTION_RESPONSES,
  CREATE_POLLS,
  CREATE_POLL_VOTES,
  CREATE_ANNOUNCEMENTS,
  CREATE_COMMENTS,
  CREATE_PHOTOS,
  CREATE_EVENT_LINKS,
  CREATE_SETTINGS,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO rv_settings (key, value) VALUES ('defaultTimezone', 'UTC')`,
  `INSERT OR IGNORE INTO rv_settings (key, value) VALUES ('rsvpCloseHoursBefore', '2')`,
  `INSERT OR IGNORE INTO rv_settings (key, value) VALUES ('defaultVisibility', 'private')`,
];

// --- V2 Migration: Calendar sync + Expense splitting ---

export const V2_ALTER_EVENTS_CALENDAR = `ALTER TABLE rv_events ADD COLUMN calendar_event_id TEXT`;

export const CREATE_EXPENSES = `
CREATE TABLE IF NOT EXISTS rv_expenses (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_by_name TEXT NOT NULL,
    split_type TEXT NOT NULL DEFAULT 'equal',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EXPENSE_SPLITS = `
CREATE TABLE IF NOT EXISTS rv_expense_splits (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL REFERENCES rv_expenses(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    is_settled INTEGER NOT NULL DEFAULT 0,
    settled_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rv_expenses_event_idx ON rv_expenses(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_expense_splits_expense_idx ON rv_expense_splits(expense_id)`,
  `CREATE INDEX IF NOT EXISTS rv_expense_splits_settled_idx ON rv_expense_splits(is_settled)`,
];

export const V2_TABLES = [
  V2_ALTER_EVENTS_CALENDAR,
  CREATE_EXPENSES,
  CREATE_EXPENSE_SPLITS,
  ...V2_INDEXES,
];

// --- V3 Migration: Recurring events, map/directions, designs, messaging, registry, seating ---

export const V3_ALTER_EVENTS = [
  `ALTER TABLE rv_events ADD COLUMN location_lat REAL`,
  `ALTER TABLE rv_events ADD COLUMN location_lng REAL`,
  `ALTER TABLE rv_events ADD COLUMN design_id TEXT`,
  `ALTER TABLE rv_events ADD COLUMN design_custom_json TEXT`,
];

export const CREATE_RECURRENCE_RULES = `
CREATE TABLE IF NOT EXISTS rv_recurrence_rules (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL DEFAULT 'weekly',
    interval_count INTEGER NOT NULL DEFAULT 1,
    day_of_week INTEGER,
    day_of_month INTEGER,
    end_type TEXT NOT NULL DEFAULT 'never',
    end_after_count INTEGER,
    end_by_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EVENT_SERIES = `
CREATE TABLE IF NOT EXISTS rv_event_series (
    id TEXT PRIMARY KEY,
    parent_event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    occurrence_event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    occurrence_index INTEGER NOT NULL,
    occurrence_date TEXT NOT NULL,
    is_cancelled INTEGER NOT NULL DEFAULT 0,
    is_modified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MESSAGES = `
CREATE TABLE IF NOT EXISTS rv_messages (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    rsvp_id TEXT REFERENCES rv_rsvps(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    reply_to_id TEXT REFERENCES rv_messages(id) ON DELETE SET NULL,
    is_host_message INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_REGISTRY_ITEMS = `
CREATE TABLE IF NOT EXISTS rv_registry_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    url TEXT,
    price_cents INTEGER,
    quantity_wanted INTEGER NOT NULL DEFAULT 1,
    quantity_claimed INTEGER NOT NULL DEFAULT 0,
    claimed_by_name TEXT,
    claimed_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TABLES_SEATING = `
CREATE TABLE IF NOT EXISTS rv_tables (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    shape TEXT NOT NULL DEFAULT 'round',
    capacity INTEGER NOT NULL DEFAULT 8,
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SEAT_ASSIGNMENTS = `
CREATE TABLE IF NOT EXISTS rv_seat_assignments (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES rv_tables(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    rsvp_id TEXT REFERENCES rv_rsvps(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    seat_number INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rv_recurrence_rules_event_idx ON rv_recurrence_rules(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_event_series_parent_idx ON rv_event_series(parent_event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_event_series_occurrence_idx ON rv_event_series(occurrence_event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_event_series_date_idx ON rv_event_series(occurrence_date)`,
  `CREATE INDEX IF NOT EXISTS rv_messages_event_idx ON rv_messages(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_messages_created_idx ON rv_messages(event_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS rv_messages_pinned_idx ON rv_messages(event_id, is_pinned)`,
  `CREATE INDEX IF NOT EXISTS rv_registry_items_event_idx ON rv_registry_items(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_registry_items_category_idx ON rv_registry_items(event_id, category)`,
  `CREATE INDEX IF NOT EXISTS rv_tables_event_idx ON rv_tables(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_seat_assignments_table_idx ON rv_seat_assignments(table_id)`,
  `CREATE INDEX IF NOT EXISTS rv_seat_assignments_event_idx ON rv_seat_assignments(event_id)`,
  `CREATE INDEX IF NOT EXISTS rv_seat_assignments_rsvp_idx ON rv_seat_assignments(rsvp_id)`,
];

export const V3_TABLES = [
  ...V3_ALTER_EVENTS,
  CREATE_RECURRENCE_RULES,
  CREATE_EVENT_SERIES,
  CREATE_MESSAGES,
  CREATE_REGISTRY_ITEMS,
  CREATE_TABLES_SEATING,
  CREATE_SEAT_ASSIGNMENTS,
  ...V3_INDEXES,
];
