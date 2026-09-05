import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateLandingTabSchema,
  CreateSettingSchema,
  CreateSettingsSchema,
  CreateSettingKeySchema,
  DEFAULT_CREATE_SETTINGS,
  PortfolioVisibilitySchema,
  UpdateCreateSettingsInputSchema,
  type CreateSetting,
  type CreateSettingKey,
  type CreateSettings,
  type UpdateCreateSettingsInput,
} from '../../models/schemas';

interface SettingRow {
  key: string;
  value: string;
}

function serializeSetting(
  key: CreateSettingKey,
  value: CreateSettings[CreateSettingKey],
): string {
  if (
    key === 'defaultSessionMinutes' ||
    key === 'weeklyPracticeGoalMinutes'
  ) {
    return String(value);
  }
  if (key === 'captureReflectionPrompts') {
    return value ? '1' : '0';
  }
  return String(value);
}

function parseSettingValue(
  key: CreateSettingKey,
  rawValue: string,
): CreateSettings[CreateSettingKey] {
  switch (key) {
    case 'defaultLandingTab':
      return CreateLandingTabSchema
        .catch(DEFAULT_CREATE_SETTINGS.defaultLandingTab)
        .parse(rawValue);
    case 'defaultSessionMinutes': {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed)
        ? CreateSettingsSchema.shape.defaultSessionMinutes
            .catch(DEFAULT_CREATE_SETTINGS.defaultSessionMinutes)
            .parse(parsed)
        : DEFAULT_CREATE_SETTINGS.defaultSessionMinutes;
    }
    case 'weeklyPracticeGoalMinutes': {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed)
        ? CreateSettingsSchema.shape.weeklyPracticeGoalMinutes
            .catch(DEFAULT_CREATE_SETTINGS.weeklyPracticeGoalMinutes)
            .parse(parsed)
        : DEFAULT_CREATE_SETTINGS.weeklyPracticeGoalMinutes;
    }
    case 'portfolioVisibility':
      return PortfolioVisibilitySchema
        .catch(DEFAULT_CREATE_SETTINGS.portfolioVisibility)
        .parse(rawValue);
    case 'captureReflectionPrompts':
      return rawValue === '1' || rawValue === 'true';
  }
}

export function getCreateSetting(
  db: DatabaseAdapter,
  key: CreateSettingKey,
): string | null {
  const row = db.query<{ value: string }>(
    'SELECT value FROM ct_settings WHERE key = ?',
    [key],
  )[0];
  return row?.value ?? null;
}

export function setCreateSetting(
  db: DatabaseAdapter,
  key: CreateSettingKey,
  value: string,
): CreateSetting {
  db.execute(
    `INSERT INTO ct_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
  return CreateSettingSchema.parse({ key, value });
}

export function listCreateSettings(db: DatabaseAdapter): CreateSetting[] {
  return db
    .query<SettingRow>('SELECT key, value FROM ct_settings ORDER BY key ASC')
    .map((row) =>
      CreateSettingSchema.parse({
        key: CreateSettingKeySchema.parse(row.key),
        value: row.value,
      }),
    );
}

export function getCreateSettings(db: DatabaseAdapter): CreateSettings {
  const next: Record<CreateSettingKey, unknown> = {
    ...DEFAULT_CREATE_SETTINGS,
  };
  for (const row of listCreateSettings(db)) {
    next[row.key] = parseSettingValue(row.key, row.value);
  }
  return CreateSettingsSchema.parse(next);
}

export function saveCreateSettings(
  db: DatabaseAdapter,
  input: UpdateCreateSettingsInput,
): CreateSettings {
  const parsed = UpdateCreateSettingsInputSchema.parse(input);
  for (const [key, value] of Object.entries(parsed) as Array<
    [CreateSettingKey, CreateSettings[CreateSettingKey] | undefined]
  >) {
    if (value === undefined) continue;
    setCreateSetting(db, key, serializeSetting(key, value));
  }
  return getCreateSettings(db);
}
