// MyMood V3 Schema -- SOS, Attachments, Self-Care Suggestions, Guided Meditation, Virtual Pet, Focus Music

// ── SOS ─────────────────────────────────────────────────────────────────

export const CREATE_SOS_SESSIONS = `
CREATE TABLE IF NOT EXISTS mo_sos_sessions (
  id TEXT PRIMARY KEY,
  trigger_mood_score INTEGER CHECK(trigger_mood_score >= 1 AND trigger_mood_score <= 10),
  steps_completed INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  exit_mood_score INTEGER CHECK(exit_mood_score >= 1 AND exit_mood_score <= 10),
  breathing_pattern TEXT,
  grounding_completed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EMERGENCY_CONTACTS = `
CREATE TABLE IF NOT EXISTS mo_emergency_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  relationship TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Attachments ─────────────────────────────────────────────────────────

export const CREATE_ATTACHMENTS = `
CREATE TABLE IF NOT EXISTS mo_attachments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES mo_entries(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('photo', 'voice')),
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size_bytes INTEGER NOT NULL,
  duration_seconds REAL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Self-Care Suggestions ───────────────────────────────────────────────

export const CREATE_SUGGESTION_HISTORY = `
CREATE TABLE IF NOT EXISTS mo_suggestion_history (
  id TEXT PRIMARY KEY,
  suggestion_key TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('data_driven', 'catalog', 'cross_module')),
  shown_at TEXT NOT NULL,
  action TEXT CHECK(action IN ('completed', 'dismissed', 'ignored')),
  acted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Guided Meditation ───────────────────────────────────────────────────

export const CREATE_MEDITATION_TEMPLATES = `
CREATE TABLE IF NOT EXISTS mo_meditation_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration_seconds INTEGER NOT NULL,
  steps_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MEDITATION_SESSIONS = `
CREATE TABLE IF NOT EXISTS mo_meditation_sessions (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES mo_meditation_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  steps_completed INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL,
  pre_mood_score INTEGER CHECK(pre_mood_score >= 1 AND pre_mood_score <= 10),
  post_mood_score INTEGER CHECK(post_mood_score >= 1 AND post_mood_score <= 10),
  completed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Virtual Pet ─────────────────────────────────────────────────────────

export const CREATE_PET = `
CREATE TABLE IF NOT EXISTS mo_pet (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  name TEXT NOT NULL DEFAULT 'Buddy',
  species TEXT NOT NULL DEFAULT 'egg',
  evolution_stage INTEGER NOT NULL DEFAULT 0,
  happiness INTEGER NOT NULL DEFAULT 50 CHECK(happiness >= 0 AND happiness <= 100),
  experience INTEGER NOT NULL DEFAULT 0,
  total_feeds INTEGER NOT NULL DEFAULT 0,
  streak_bonus INTEGER NOT NULL DEFAULT 0,
  last_fed_at TEXT,
  hatched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PET_ACTIVITIES = `
CREATE TABLE IF NOT EXISTS mo_pet_activities (
  id TEXT PRIMARY KEY,
  activity_type TEXT NOT NULL CHECK(activity_type IN ('mood_log', 'breathing', 'meditation', 'journal', 'workout', 'experiment', 'streak_bonus')),
  happiness_delta INTEGER NOT NULL,
  experience_delta INTEGER NOT NULL,
  source_module TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Focus Music ─────────────────────────────────────────────────────────

export const CREATE_FOCUS_SESSIONS = `
CREATE TABLE IF NOT EXISTS mo_focus_sessions (
  id TEXT PRIMARY KEY,
  preset_name TEXT NOT NULL,
  layers_json TEXT NOT NULL,
  target_duration_seconds INTEGER NOT NULL,
  actual_duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  pre_mood_score INTEGER CHECK(pre_mood_score >= 1 AND pre_mood_score <= 10),
  post_mood_score INTEGER CHECK(post_mood_score >= 1 AND post_mood_score <= 10),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SOUND_PRESETS = `
CREATE TABLE IF NOT EXISTS mo_sound_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layers_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Indexes ─────────────────────────────────────────────────────────────

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS mo_sos_sessions_started_idx ON mo_sos_sessions(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_attachments_entry_idx ON mo_attachments(entry_id)`,
  `CREATE INDEX IF NOT EXISTS mo_attachments_type_idx ON mo_attachments(type)`,
  `CREATE INDEX IF NOT EXISTS mo_suggestion_history_key_idx ON mo_suggestion_history(suggestion_key)`,
  `CREATE INDEX IF NOT EXISTS mo_suggestion_history_shown_idx ON mo_suggestion_history(shown_at DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_meditation_sessions_started_idx ON mo_meditation_sessions(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_meditation_templates_category_idx ON mo_meditation_templates(category)`,
  `CREATE INDEX IF NOT EXISTS mo_pet_activities_type_idx ON mo_pet_activities(activity_type)`,
  `CREATE INDEX IF NOT EXISTS mo_pet_activities_created_idx ON mo_pet_activities(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_focus_sessions_started_idx ON mo_focus_sessions(started_at DESC)`,
];

// ── Meditation Template Seeds ───────────────────────────────────────────

function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

function meditationSeed(
  id: string, name: string, desc: string, category: string,
  difficulty: string, durationSec: number, steps: { instruction: string; durationSeconds: number }[],
): string {
  return `INSERT OR IGNORE INTO mo_meditation_templates (id, name, description, category, difficulty, duration_seconds, steps_json, is_default, sort_order)
   VALUES ('${escapeSqlString(id)}', '${escapeSqlString(name)}', '${escapeSqlString(desc)}', '${escapeSqlString(category)}', '${escapeSqlString(difficulty)}', ${durationSec}, '${escapeSqlString(JSON.stringify(steps))}', 1, 0)`;
}

export const SEED_MEDITATION_TEMPLATES = [
  // beginner (3)
  meditationSeed('med-first-breath', 'First Breath', 'A gentle introduction to breathing meditation', 'beginner', 'beginner', 180, [
    { instruction: 'Find a comfortable position and close your eyes', durationSeconds: 15 },
    { instruction: 'Take a deep breath in through your nose', durationSeconds: 10 },
    { instruction: 'Slowly exhale through your mouth', durationSeconds: 10 },
    { instruction: 'Continue breathing naturally, noticing each breath', durationSeconds: 60 },
    { instruction: 'If your mind wanders, gently return to your breath', durationSeconds: 60 },
    { instruction: 'Slowly open your eyes and return to the room', durationSeconds: 25 },
  ]),
  meditationSeed('med-getting-started', 'Getting Started', 'Build your meditation practice from scratch', 'beginner', 'beginner', 300, [
    { instruction: 'Sit comfortably with your back straight', durationSeconds: 15 },
    { instruction: 'Close your eyes and take three deep breaths', durationSeconds: 20 },
    { instruction: 'Let your breathing return to its natural rhythm', durationSeconds: 30 },
    { instruction: 'Focus on the sensation of air entering your nostrils', durationSeconds: 60 },
    { instruction: 'Notice any thoughts without judgment, then return to breath', durationSeconds: 60 },
    { instruction: 'Expand awareness to your whole body breathing', durationSeconds: 60 },
    { instruction: 'Take three deep breaths and gently open your eyes', durationSeconds: 55 },
  ]),
  meditationSeed('med-ten-minute-calm', 'Ten Minute Calm', 'A complete beginner session for daily calm', 'beginner', 'beginner', 600, [
    { instruction: 'Find a quiet spot and settle into a comfortable position', durationSeconds: 20 },
    { instruction: 'Close your eyes and take five slow, deep breaths', durationSeconds: 30 },
    { instruction: 'Let your breathing become natural and effortless', durationSeconds: 30 },
    { instruction: 'Focus attention on each inhale and exhale', durationSeconds: 90 },
    { instruction: 'When thoughts arise, acknowledge them and let them pass', durationSeconds: 90 },
    { instruction: 'Bring attention to sounds around you, then back to breath', durationSeconds: 90 },
    { instruction: 'Notice how your body feels in this moment of stillness', durationSeconds: 90 },
    { instruction: 'Take three deep breaths and slowly return to awareness', durationSeconds: 60 },
    { instruction: 'Gently open your eyes, carrying this calm with you', durationSeconds: 100 },
  ]),

  // body_scan (3)
  meditationSeed('med-quick-body-check', 'Quick Body Check', 'A brief scan of your body from head to toe', 'body_scan', 'beginner', 300, [
    { instruction: 'Lie down or sit comfortably and close your eyes', durationSeconds: 15 },
    { instruction: 'Bring attention to the top of your head and face', durationSeconds: 40 },
    { instruction: 'Move awareness to your neck and shoulders', durationSeconds: 40 },
    { instruction: 'Notice sensations in your arms and hands', durationSeconds: 40 },
    { instruction: 'Scan through your chest and upper back', durationSeconds: 40 },
    { instruction: 'Bring attention to your abdomen and lower back', durationSeconds: 40 },
    { instruction: 'Notice your hips, legs, and feet', durationSeconds: 40 },
    { instruction: 'Take a full body breath and slowly open your eyes', durationSeconds: 45 },
  ]),
  meditationSeed('med-full-body-scan', 'Full Body Scan', 'A thorough relaxation journey through every body region', 'body_scan', 'intermediate', 900, [
    { instruction: 'Lie down comfortably and close your eyes', durationSeconds: 20 },
    { instruction: 'Take five deep breaths to settle in', durationSeconds: 30 },
    { instruction: 'Focus on the crown of your head', durationSeconds: 50 },
    { instruction: 'Relax your forehead, eyes, and jaw', durationSeconds: 60 },
    { instruction: 'Release tension in your neck and throat', durationSeconds: 60 },
    { instruction: 'Soften your shoulders and upper arms', durationSeconds: 60 },
    { instruction: 'Bring awareness to your forearms, wrists, and fingers', durationSeconds: 60 },
    { instruction: 'Breathe into your chest and ribcage', durationSeconds: 60 },
    { instruction: 'Release your belly and lower back', durationSeconds: 60 },
    { instruction: 'Relax your hips and pelvis', durationSeconds: 60 },
    { instruction: 'Soften your thighs and knees', durationSeconds: 60 },
    { instruction: 'Release your calves, ankles, and feet', durationSeconds: 60 },
    { instruction: 'Feel your entire body at rest', durationSeconds: 60 },
    { instruction: 'Slowly wiggle your fingers and toes, then open your eyes', durationSeconds: 200 },
  ]),
  meditationSeed('med-deep-release', 'Deep Release', 'An extended body scan for deep muscular relaxation', 'body_scan', 'advanced', 1200, [
    { instruction: 'Lie down in a comfortable position and close your eyes', durationSeconds: 20 },
    { instruction: 'Take ten slow breaths, releasing tension with each exhale', durationSeconds: 60 },
    { instruction: 'Scan your scalp and forehead, releasing any tightness', durationSeconds: 80 },
    { instruction: 'Relax your eyes, cheeks, and jaw completely', durationSeconds: 80 },
    { instruction: 'Soften your neck, feeling it lengthen', durationSeconds: 80 },
    { instruction: 'Let your shoulders drop away from your ears', durationSeconds: 80 },
    { instruction: 'Release through each arm to your fingertips', durationSeconds: 80 },
    { instruction: 'Breathe deeply into your chest, releasing tightness', durationSeconds: 80 },
    { instruction: 'Let your belly soften completely', durationSeconds: 80 },
    { instruction: 'Release your lower back into the surface beneath you', durationSeconds: 80 },
    { instruction: 'Relax your hips and glutes', durationSeconds: 80 },
    { instruction: 'Release down through your thighs and knees', durationSeconds: 80 },
    { instruction: 'Soften your calves and let your feet fall open', durationSeconds: 80 },
    { instruction: 'Feel a wave of relaxation from head to toe', durationSeconds: 80 },
    { instruction: 'Rest in complete stillness', durationSeconds: 120 },
    { instruction: 'Gently return awareness to the room and open your eyes', durationSeconds: 40 },
  ]),

  // visualization (3)
  meditationSeed('med-safe-place', 'Safe Place', 'Visualize a personal sanctuary of peace and safety', 'visualization', 'beginner', 300, [
    { instruction: 'Close your eyes and take three calming breaths', durationSeconds: 20 },
    { instruction: 'Imagine a place where you feel completely safe', durationSeconds: 40 },
    { instruction: 'Notice the colors, shapes, and light in this place', durationSeconds: 50 },
    { instruction: 'Feel the temperature and textures around you', durationSeconds: 50 },
    { instruction: 'Listen to the sounds of your safe place', durationSeconds: 50 },
    { instruction: 'Breathe in the peaceful atmosphere', durationSeconds: 50 },
    { instruction: 'Know you can return here anytime', durationSeconds: 20 },
    { instruction: 'Gently open your eyes, carrying this peace with you', durationSeconds: 20 },
  ]),
  meditationSeed('med-mountain-lake', 'Mountain Lake', 'Journey to a serene mountain lake in your mind', 'visualization', 'intermediate', 600, [
    { instruction: 'Close your eyes and breathe deeply', durationSeconds: 20 },
    { instruction: 'Imagine walking along a forest path toward mountains', durationSeconds: 60 },
    { instruction: 'Feel the pine-scented air and dappled sunlight', durationSeconds: 60 },
    { instruction: 'You arrive at a crystal-clear mountain lake', durationSeconds: 50 },
    { instruction: 'See the mountains reflected perfectly in still water', durationSeconds: 60 },
    { instruction: 'Sit beside the lake and feel the cool breeze', durationSeconds: 60 },
    { instruction: 'Watch thoughts float by like clouds above the peaks', durationSeconds: 60 },
    { instruction: 'Feel yourself becoming as calm and still as the lake', durationSeconds: 60 },
    { instruction: 'Breathe in the mountain air one last time', durationSeconds: 30 },
    { instruction: 'Slowly walk back along the path and open your eyes', durationSeconds: 140 },
  ]),
  meditationSeed('med-healing-light', 'Healing Light', 'Visualize warm healing light flowing through your body', 'visualization', 'intermediate', 900, [
    { instruction: 'Settle into a comfortable position and close your eyes', durationSeconds: 20 },
    { instruction: 'Take five deep breaths to center yourself', durationSeconds: 30 },
    { instruction: 'Imagine a warm, golden light above your head', durationSeconds: 60 },
    { instruction: 'Feel the light begin to pour down over your head', durationSeconds: 60 },
    { instruction: 'The light fills your face and neck with warmth', durationSeconds: 60 },
    { instruction: 'It flows through your shoulders and down your arms', durationSeconds: 80 },
    { instruction: 'The healing light fills your chest and heart', durationSeconds: 80 },
    { instruction: 'Feel it warm your belly and lower body', durationSeconds: 80 },
    { instruction: 'The light flows through your legs to your feet', durationSeconds: 80 },
    { instruction: 'Your entire body glows with healing warmth', durationSeconds: 100 },
    { instruction: 'Hold this feeling of wholeness and peace', durationSeconds: 100 },
    { instruction: 'Let the light settle and gently open your eyes', durationSeconds: 150 },
  ]),

  // mindfulness (3)
  meditationSeed('med-present-moment', 'Present Moment', 'Anchor yourself fully in the here and now', 'mindfulness', 'beginner', 300, [
    { instruction: 'Sit comfortably and close your eyes', durationSeconds: 15 },
    { instruction: 'Notice five things you can feel right now', durationSeconds: 50 },
    { instruction: 'Notice the sounds around you without labeling them', durationSeconds: 50 },
    { instruction: 'Feel the weight of your body in your seat', durationSeconds: 50 },
    { instruction: 'Notice your breath without changing it', durationSeconds: 50 },
    { instruction: 'Be fully present in this exact moment', durationSeconds: 50 },
    { instruction: 'Gently open your eyes with fresh awareness', durationSeconds: 35 },
  ]),
  meditationSeed('med-mindful-awareness', 'Mindful Awareness', 'Cultivate non-judgmental awareness of experience', 'mindfulness', 'intermediate', 600, [
    { instruction: 'Find a comfortable seat and close your eyes', durationSeconds: 15 },
    { instruction: 'Take three grounding breaths', durationSeconds: 20 },
    { instruction: 'Observe your thoughts as if watching clouds pass', durationSeconds: 80 },
    { instruction: 'Notice emotions arising without reacting to them', durationSeconds: 80 },
    { instruction: 'Bring attention to physical sensations', durationSeconds: 80 },
    { instruction: 'Listen to sounds near and far', durationSeconds: 80 },
    { instruction: 'Notice the spaces between thoughts', durationSeconds: 80 },
    { instruction: 'Rest in open awareness of all experience', durationSeconds: 80 },
    { instruction: 'Take a deep breath and gently open your eyes', durationSeconds: 85 },
  ]),
  meditationSeed('med-open-monitoring', 'Open Monitoring', 'Advanced practice of choiceless awareness', 'mindfulness', 'advanced', 900, [
    { instruction: 'Settle into stillness and close your eyes', durationSeconds: 20 },
    { instruction: 'Begin by focusing on your breath for a few cycles', durationSeconds: 40 },
    { instruction: 'Now release the focus on breath', durationSeconds: 20 },
    { instruction: 'Let awareness be open to whatever arises', durationSeconds: 100 },
    { instruction: 'Thoughts, feelings, sensations: let them all come and go', durationSeconds: 100 },
    { instruction: 'There is nothing to do, nowhere to go', durationSeconds: 100 },
    { instruction: 'If you get caught in a thought, simply notice and release', durationSeconds: 100 },
    { instruction: 'Rest in the space of pure awareness', durationSeconds: 100 },
    { instruction: 'Allow everything to be exactly as it is', durationSeconds: 100 },
    { instruction: 'Notice the awareness itself that holds all experience', durationSeconds: 100 },
    { instruction: 'Slowly bring awareness back and open your eyes', durationSeconds: 120 },
  ]),

  // sleep (3)
  meditationSeed('med-drift-off', 'Drift Off', 'A calming meditation to ease into sleep', 'sleep', 'beginner', 600, [
    { instruction: 'Lie comfortably in bed and close your eyes', durationSeconds: 15 },
    { instruction: 'Take five slow, deep breaths', durationSeconds: 30 },
    { instruction: 'Let your body sink into the mattress', durationSeconds: 50 },
    { instruction: 'Release any thoughts from the day', durationSeconds: 60 },
    { instruction: 'Imagine your mind becoming as dark and quiet as night', durationSeconds: 60 },
    { instruction: 'With each exhale, feel yourself sinking deeper', durationSeconds: 80 },
    { instruction: 'Let your breathing become soft and barely noticeable', durationSeconds: 80 },
    { instruction: 'There is nothing to do but rest', durationSeconds: 80 },
    { instruction: 'Allow sleep to come naturally', durationSeconds: 145 },
  ]),
  meditationSeed('med-sleep-body-scan', 'Sleep Body Scan', 'Progressive relaxation designed for bedtime', 'sleep', 'intermediate', 900, [
    { instruction: 'Lie in your sleeping position and close your eyes', durationSeconds: 15 },
    { instruction: 'Take three deep breaths, exhaling slowly', durationSeconds: 20 },
    { instruction: 'Relax your forehead and let your eyes soften', durationSeconds: 60 },
    { instruction: 'Unclench your jaw and relax your tongue', durationSeconds: 60 },
    { instruction: 'Let your shoulders melt into the pillow', durationSeconds: 60 },
    { instruction: 'Feel heaviness flow through your arms', durationSeconds: 80 },
    { instruction: 'Your chest rises and falls effortlessly', durationSeconds: 80 },
    { instruction: 'Your belly is soft and relaxed', durationSeconds: 80 },
    { instruction: 'Feel heaviness in your hips and legs', durationSeconds: 80 },
    { instruction: 'Your feet are completely relaxed', durationSeconds: 60 },
    { instruction: 'Your whole body is heavy, warm, and at peace', durationSeconds: 80 },
    { instruction: 'Let yourself drift into sleep', durationSeconds: 225 },
  ]),
  meditationSeed('med-night-sky', 'Night Sky', 'A soothing visualization of the night sky for sleep', 'sleep', 'intermediate', 1200, [
    { instruction: 'Lie down comfortably and close your eyes', durationSeconds: 15 },
    { instruction: 'Take five calming breaths', durationSeconds: 30 },
    { instruction: 'Imagine lying on soft grass on a warm night', durationSeconds: 60 },
    { instruction: 'Look up at a vast, clear night sky full of stars', durationSeconds: 80 },
    { instruction: 'Each star is a thought: distant, tiny, peaceful', durationSeconds: 80 },
    { instruction: 'Watch a shooting star streak across the darkness', durationSeconds: 80 },
    { instruction: 'Feel the gentle rotation of the earth beneath you', durationSeconds: 100 },
    { instruction: 'The sky grows darker and more peaceful', durationSeconds: 100 },
    { instruction: 'The stars blur softly as your eyes grow heavy', durationSeconds: 100 },
    { instruction: 'You are held by the vast, quiet darkness', durationSeconds: 100 },
    { instruction: 'Let the night sky wrap around you like a blanket', durationSeconds: 100 },
    { instruction: 'Drift into deep, restful sleep', durationSeconds: 255 },
  ]),
];

// ── Sound Preset Seeds ──────────────────────────────────────────────────

export const SEED_SOUND_PRESETS = [
  `INSERT OR IGNORE INTO mo_sound_presets (id, name, layers_json, is_default, sort_order)
   VALUES ('preset-rain', 'Rain', '${JSON.stringify([{ sound: 'rain', volume: 0.7 }, { sound: 'thunder_distant', volume: 0.2 }])}', 1, 0)`,
  `INSERT OR IGNORE INTO mo_sound_presets (id, name, layers_json, is_default, sort_order)
   VALUES ('preset-ocean', 'Ocean', '${JSON.stringify([{ sound: 'ocean', volume: 0.8 }, { sound: 'wind', volume: 0.3 }])}', 1, 1)`,
  `INSERT OR IGNORE INTO mo_sound_presets (id, name, layers_json, is_default, sort_order)
   VALUES ('preset-forest', 'Forest', '${JSON.stringify([{ sound: 'birds', volume: 0.5 }, { sound: 'wind', volume: 0.3 }, { sound: 'creek', volume: 0.4 }])}', 1, 2)`,
  `INSERT OR IGNORE INTO mo_sound_presets (id, name, layers_json, is_default, sort_order)
   VALUES ('preset-cafe', 'Cafe', '${JSON.stringify([{ sound: 'cafe', volume: 0.6 }])}', 1, 3)`,
  `INSERT OR IGNORE INTO mo_sound_presets (id, name, layers_json, is_default, sort_order)
   VALUES ('preset-white-noise', 'White Noise', '${JSON.stringify([{ sound: 'white_noise', volume: 0.5 }])}', 1, 4)`,
];

// ── Combined V3 Migration ───────────────────────────────────────────────

export const MOOD_V3_UP = [
  CREATE_SOS_SESSIONS,
  CREATE_EMERGENCY_CONTACTS,
  CREATE_ATTACHMENTS,
  CREATE_SUGGESTION_HISTORY,
  CREATE_MEDITATION_TEMPLATES,
  CREATE_MEDITATION_SESSIONS,
  CREATE_PET,
  CREATE_PET_ACTIVITIES,
  CREATE_FOCUS_SESSIONS,
  CREATE_SOUND_PRESETS,
  ...V3_INDEXES,
  ...SEED_MEDITATION_TEMPLATES,
  ...SEED_SOUND_PRESETS,
];

export const MOOD_V3_DOWN = [
  'DROP TABLE IF EXISTS mo_sound_presets',
  'DROP TABLE IF EXISTS mo_focus_sessions',
  'DROP TABLE IF EXISTS mo_pet_activities',
  'DROP TABLE IF EXISTS mo_pet',
  'DROP TABLE IF EXISTS mo_meditation_sessions',
  'DROP TABLE IF EXISTS mo_meditation_templates',
  'DROP TABLE IF EXISTS mo_suggestion_history',
  'DROP TABLE IF EXISTS mo_attachments',
  'DROP TABLE IF EXISTS mo_emergency_contacts',
  'DROP TABLE IF EXISTS mo_sos_sessions',
];
