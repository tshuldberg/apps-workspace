import type { DatabaseAdapter } from '@mylife/db';
import {
  AssignmentViewSchema,
  ClassesFoundationChecklistItemSchema,
  ClassesSettingsSchema,
  ClassesSettingSchema,
  ClassesStarterStatsSchema,
  DEFAULT_CLASSES_SETTINGS,
  GradeScaleSchema,
  ScheduleDensitySchema,
  UpdateClassesSettingsInputSchema,
  WeekStartsOnSchema,
  type ClassesFoundationChecklistItem,
  type ClassesSetting,
  type ClassesSettingKey,
  type ClassesSettings,
  type ClassesStarterStats,
  type UpdateClassesSettingsInput,
} from '../types';

interface SettingRow {
  key: string;
  value: string;
}

function serializeSetting(key: ClassesSettingKey, value: ClassesSettings[ClassesSettingKey]): string {
  if (key === 'assignmentReminderOffsets') {
    return JSON.stringify(value);
  }
  if (key === 'showWeekends' || key === 'requireBiometricLock') {
    return value ? '1' : '0';
  }
  return String(value);
}

function parseSettingValue(
  key: ClassesSettingKey,
  rawValue: string,
): ClassesSettings[ClassesSettingKey] {
  switch (key) {
    case 'activeTermLabel':
    case 'campusLabel':
      return rawValue;
    case 'weekStartsOn':
      return WeekStartsOnSchema.catch(DEFAULT_CLASSES_SETTINGS.weekStartsOn).parse(rawValue);
    case 'scheduleDensity':
      return ScheduleDensitySchema.catch(DEFAULT_CLASSES_SETTINGS.scheduleDensity).parse(rawValue);
    case 'gradeScale':
      return GradeScaleSchema.catch(DEFAULT_CLASSES_SETTINGS.gradeScale).parse(rawValue);
    case 'defaultStudyMinutes': {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed)
        ? ClassesSettingsSchema.shape.defaultStudyMinutes.catch(
          DEFAULT_CLASSES_SETTINGS.defaultStudyMinutes,
        ).parse(parsed)
        : DEFAULT_CLASSES_SETTINGS.defaultStudyMinutes;
    }
    case 'focusBreakMinutes': {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed)
        ? ClassesSettingsSchema.shape.focusBreakMinutes.catch(
          DEFAULT_CLASSES_SETTINGS.focusBreakMinutes,
        ).parse(parsed)
        : DEFAULT_CLASSES_SETTINGS.focusBreakMinutes;
    }
    case 'assignmentView':
      return AssignmentViewSchema.catch(DEFAULT_CLASSES_SETTINGS.assignmentView).parse(rawValue);
    case 'assignmentReminderOffsets': {
      try {
        return ClassesSettingsSchema.shape.assignmentReminderOffsets.parse(
          JSON.parse(rawValue),
        );
      } catch {
        return DEFAULT_CLASSES_SETTINGS.assignmentReminderOffsets;
      }
    }
    case 'showWeekends':
      return rawValue === '1' || rawValue === 'true';
    case 'defaultTravelMinutes': {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed)
        ? ClassesSettingsSchema.shape.defaultTravelMinutes.catch(
          DEFAULT_CLASSES_SETTINGS.defaultTravelMinutes,
        ).parse(parsed)
        : DEFAULT_CLASSES_SETTINGS.defaultTravelMinutes;
    }
    case 'requireBiometricLock':
      return rawValue === '1' || rawValue === 'true';
    case 'privacyConsentAcknowledgedAt':
      return rawValue;
  }
}

export function getClassesSetting(
  db: DatabaseAdapter,
  key: ClassesSettingKey,
): string | null {
  const row = db.query<{ value: string }>(
    'SELECT value FROM cs_settings WHERE key = ?',
    [key],
  )[0];
  return row?.value ?? null;
}

export function setClassesSetting(
  db: DatabaseAdapter,
  key: ClassesSettingKey,
  value: string,
): ClassesSetting {
  db.execute(
    `INSERT INTO cs_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
  return ClassesSettingSchema.parse({ key, value });
}

export function listClassesSettings(db: DatabaseAdapter): ClassesSetting[] {
  return db
    .query<SettingRow>('SELECT key, value FROM cs_settings ORDER BY key ASC')
    .map((row) => ClassesSettingSchema.parse(row));
}

export function getClassesSettings(db: DatabaseAdapter): ClassesSettings {
  const next: Record<ClassesSettingKey, unknown> = {
    ...DEFAULT_CLASSES_SETTINGS,
  };
  for (const row of listClassesSettings(db)) {
    next[row.key] = parseSettingValue(row.key, row.value);
  }
  return ClassesSettingsSchema.parse(next);
}

export function saveClassesSettings(
  db: DatabaseAdapter,
  input: UpdateClassesSettingsInput,
): ClassesSettings {
  const parsed = UpdateClassesSettingsInputSchema.parse(input);
  for (const [key, value] of Object.entries(parsed) as Array<
    [ClassesSettingKey, ClassesSettings[ClassesSettingKey] | undefined]
  >) {
    if (value === undefined) continue;
    setClassesSetting(db, key, serializeSetting(key, value));
  }
  return getClassesSettings(db);
}

function formatReminderOffset(minutes: number): string {
  if (minutes === 0) return 'at due time';
  if (minutes % 10080 === 0) {
    const weeks = minutes / 10080;
    return `${weeks} week${weeks === 1 ? '' : 's'} before`;
  }
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? '' : 's'} before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'} before`;
  }
  return `${minutes} min before`;
}

export function formatClassesReminderSummary(offsets: number[]): string {
  if (offsets.length === 0) return 'No reminders yet';
  return offsets
    .slice()
    .sort((left, right) => right - left)
    .map(formatReminderOffset)
    .join(' • ');
}

export function getClassesStarterStats(db: DatabaseAdapter): ClassesStarterStats {
  const settings = getClassesSettings(db);
  const customPreferenceCount = (
    Object.keys(DEFAULT_CLASSES_SETTINGS) as Array<keyof ClassesSettings>
  ).reduce((count, key) => {
    const baseline = DEFAULT_CLASSES_SETTINGS[key];
    const current = settings[key];
    return JSON.stringify(baseline) === JSON.stringify(current) ? count : count + 1;
  }, 0);

  return ClassesStarterStatsSchema.parse({
    currentTermLabel: settings.activeTermLabel.trim() || 'No current term yet',
    customPreferenceCount,
    reminderSummary: formatClassesReminderSummary(settings.assignmentReminderOffsets),
    dailyFocusLabel: `${settings.defaultStudyMinutes} min focus + ${settings.focusBreakMinutes} min break`,
  });
}

export function getClassesFoundationChecklist(
  db: DatabaseAdapter,
): ClassesFoundationChecklistItem[] {
  const settings = getClassesSettings(db);
  return [
    {
      id: 'term',
      label: 'Name your current term',
      description: 'Give the schedule and grades surfaces a semester to anchor around.',
      ready: settings.activeTermLabel.trim().length > 0,
    },
    {
      id: 'campus',
      label: 'Add a campus or school label',
      description: 'Keep schedule, commute, and teacher details tied to the right place.',
      ready: settings.campusLabel.trim().length > 0,
    },
    {
      id: 'reminders',
      label: 'Choose assignment reminder timing',
      description: 'Decide how early MyClasses should surface due dates once assignments land.',
      ready: settings.assignmentReminderOffsets.length > 0,
    },
    {
      id: 'focus',
      label: 'Tune your study rhythm',
      description: 'Set a focus block and break cadence before study sessions and timers arrive.',
      ready:
        settings.defaultStudyMinutes !== DEFAULT_CLASSES_SETTINGS.defaultStudyMinutes ||
        settings.focusBreakMinutes !== DEFAULT_CLASSES_SETTINGS.focusBreakMinutes,
    },
  ].map((item) => ClassesFoundationChecklistItemSchema.parse(item));
}
