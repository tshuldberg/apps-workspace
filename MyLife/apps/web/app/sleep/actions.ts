'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createDream,
  createEntry,
  createGoal,
  createNap,
  saveFactorLog,
  saveHygieneCheck,
  deleteEntry,
  deleteDream,
  deactivateGoal,
  filterDreams,
  getDream,
  setDreamDictionaryNote,
  listDreams,
  searchDreams,
  updateEntry,
  updateDream,
  updateGoal,
  type CreateSleepEntryInput,
  type DreamCreateInput,
  type DreamFilterState,
  type UpdateSleepEntryInput,
  type DreamUpdateInput,
  SLEEP_HYGIENE_PRACTICE_IDS,
  SleepGoalTypeSchema,
  serializeEnabledHygienePracticeIds,
  type SleepHygienePracticeId,
} from '@mylife/sleep';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('sleep');
  return adapter;
}

function revalidateSleepPaths(entryId?: string) {
  revalidatePath('/sleep');
  revalidatePath('/sleep/log');
  revalidatePath('/sleep/factors');
  revalidatePath('/sleep/factors/log');
  revalidatePath('/sleep/dreams');
  revalidatePath('/sleep/dreams/patterns');
  revalidatePath('/sleep/dreams/dictionary');
  revalidatePath('/sleep/dreams/log');
  revalidatePath('/sleep/goals');
  revalidatePath('/sleep/hygiene');
  revalidatePath('/sleep/naps');
  revalidatePath('/sleep/naps/log');
  revalidatePath('/sleep/settings');

  if (entryId) {
    revalidatePath(`/sleep/entry/${entryId}`);
    revalidatePath(`/sleep/entry/${entryId}/edit`);
  }
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function writeSleepSetting(key: string, value: string) {
  db().execute(
    `INSERT INTO sl_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeClockTime(value: string, fallback: string): string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function formStringArray(
  formData: FormData,
  key: string,
): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string');
}

function parsePracticeIds(values: readonly string[]): SleepHygienePracticeId[] {
  const allowed = new Set<string>(SLEEP_HYGIENE_PRACTICE_IDS);
  return values.filter(
    (value): value is SleepHygienePracticeId => allowed.has(value),
  );
}

function revalidateDreamPaths(dreamId?: string, entryId?: string | null) {
  revalidateSleepPaths(entryId ?? undefined);

  if (dreamId) {
    revalidatePath(`/sleep/dreams/${dreamId}`);
  }
}

export async function addMorningLogEntry(input: CreateSleepEntryInput) {
  const entry = createEntry(db(), input);
  revalidateSleepPaths(entry.id);
  return entry;
}

export async function updateMorningLogEntry(
  id: string,
  input: UpdateSleepEntryInput,
) {
  const entry = updateEntry(db(), id, input);
  if (!entry) {
    throw new Error('Sleep entry not found.');
  }

  revalidateSleepPaths(id);
  return entry;
}

export async function deleteMorningLogEntry(id: string) {
  const deleted = deleteEntry(db(), id);
  if (!deleted) {
    throw new Error('Sleep entry not found.');
  }

  revalidateSleepPaths(id);
  return true;
}

export async function createSleepGoalAction(formData: FormData) {
  const type = SleepGoalTypeSchema.parse(formString(formData, 'type'));
  const targetValue = formString(formData, 'target_value');
  const notes = formString(formData, 'notes');
  const startDate = formString(formData, 'start_date');

  createGoal(db(), {
    type,
    target_value: targetValue,
    start_date: startDate || undefined,
    notes: notes || null,
  });
  revalidateSleepPaths();
}

export async function updateSleepGoalAction(formData: FormData) {
  const id = formString(formData, 'id');
  const typeValue = formString(formData, 'type');
  const targetValue = formString(formData, 'target_value');
  const notes = formString(formData, 'notes');
  const type = typeValue ? SleepGoalTypeSchema.parse(typeValue) : undefined;

  const goal = updateGoal(db(), id, {
    ...(type ? { type } : {}),
    ...(targetValue ? { target_value: targetValue } : {}),
    notes: notes || null,
  });
  if (!goal) {
    throw new Error('Sleep goal not found.');
  }
  revalidateSleepPaths();
}

export async function deactivateSleepGoalAction(formData: FormData) {
  const id = formString(formData, 'id');
  const goal = deactivateGoal(db(), id);
  if (!goal) {
    throw new Error('Sleep goal not found.');
  }
  revalidateSleepPaths();
}

export async function saveSleepSettingsAction(formData: FormData) {
  const targetHours = formString(formData, 'target_hours') || '8';
  const reminderEnabled = formData.get('reminder_enabled') === 'on';
  const reminderMinutes = formString(formData, 'reminder_minutes') || '30';
  const targetBedtime = formString(formData, 'target_bedtime') || '22:30';
  const restrictionEnabled = formData.get('restriction_enabled') === 'on';

  writeSleepSetting('sleep.targetHours', targetHours);
  writeSleepSetting('sleep.reminder.enabled', reminderEnabled ? 'true' : 'false');
  writeSleepSetting('sleep.reminder.minutesBefore', reminderMinutes);
  writeSleepSetting('sleep.reminder.targetBedtime', targetBedtime);
  writeSleepSetting(
    'sleep.restriction.enabled',
    restrictionEnabled ? 'true' : 'false',
  );
  revalidateSleepPaths();
}

export async function addSleepNapAction(formData: FormData) {
  const date = formString(formData, 'date') || todayDate();
  const startTime = normalizeClockTime(
    formString(formData, 'start_time'),
    '14:00',
  );
  const duration = Number(formString(formData, 'duration_minutes') || '20');
  const qualityValue = Number(formString(formData, 'quality'));
  const notes = formString(formData, 'notes');
  const mode = formString(formData, 'mode');

  if (!Number.isInteger(duration) || duration <= 0) {
    throw new Error('Nap duration must be a positive whole number.');
  }

  createNap(db(), {
    date,
    start_time: `${date}T${startTime}:00.000Z`,
    duration_minutes: duration,
    intentional:
      formData.get('intentional') === 'on' || mode === 'about_to_nap',
    ...(qualityValue >= 1 && qualityValue <= 5
      ? { quality: qualityValue }
      : {}),
    notes: notes || undefined,
  });
  revalidateSleepPaths();
  redirect('/sleep/naps');
}

export async function saveSleepHygieneChecksAction(formData: FormData) {
  const date = formString(formData, 'date') || todayDate();
  const practiceIds = parsePracticeIds(formStringArray(formData, 'practice_id'));
  const metIds = new Set(formStringArray(formData, 'met'));

  for (const practiceId of practiceIds) {
    saveHygieneCheck(db(), {
      date,
      practice_id: practiceId,
      met: metIds.has(practiceId),
      source: 'manual',
    });
  }

  revalidateSleepPaths();
}

export async function saveSleepHygienePracticesAction(formData: FormData) {
  const selected = parsePracticeIds(
    formStringArray(formData, 'enabled_practice'),
  );

  writeSleepSetting(
    'sleep.hygiene.enabledPractices',
    serializeEnabledHygienePracticeIds(selected),
  );
  revalidateSleepPaths();
}

export async function saveSleepFactorLog(
  input: Parameters<typeof saveFactorLog>[1],
) {
  const factor = saveFactorLog(db(), input);
  revalidateSleepPaths(factor.sleep_entry_id ?? undefined);
  return factor;
}

export async function queryDreamArchive(
  filters: DreamFilterState = {},
) {
  const adapter = db();
  const trimmedQuery = filters.query?.trim() ?? '';
  const dreamRows = trimmedQuery
    ? searchDreams(adapter, trimmedQuery, {
        type: filters.type ?? undefined,
        limit: 250,
      })
    : listDreams(adapter, {
        type: filters.type ?? undefined,
        limit: 250,
      });

  return filterDreams(dreamRows, {
    ...filters,
    query: trimmedQuery ? undefined : filters.query,
  });
}

export async function addDreamLog(input: DreamCreateInput) {
  const adapter = db();
  const dream = createDream(adapter, input);
  revalidateDreamPaths(dream.id, dream.sleep_entry_id);
  return dream;
}

export async function updateDreamLog(
  id: string,
  input: DreamUpdateInput,
) {
  const adapter = db();
  const existing = getDream(adapter, id);
  if (!existing) {
    throw new Error('Dream not found.');
  }

  const dream = updateDream(adapter, id, input);
  if (!dream) {
    throw new Error('Dream not found.');
  }

  revalidateDreamPaths(id, dream.sleep_entry_id ?? existing.sleep_entry_id);
  return dream;
}

export async function deleteDreamLog(id: string) {
  const adapter = db();
  const existing = getDream(adapter, id);
  if (!existing) {
    throw new Error('Dream not found.');
  }

  const deleted = deleteDream(adapter, id);
  if (!deleted) {
    throw new Error('Dream not found.');
  }

  revalidateDreamPaths(id, existing.sleep_entry_id);
  return true;
}

export async function saveDreamDictionaryThemeNote(
  theme: string,
  note: string | null | undefined,
) {
  const notes = setDreamDictionaryNote(db(), theme, note);
  revalidatePath('/sleep/dreams/dictionary');
  revalidatePath('/sleep/dreams/patterns');
  return notes;
}
