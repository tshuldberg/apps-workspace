import type { DatabaseAdapter } from '@mylife/db';
import type {
  HealthInputOptions,
  HealthKitPermissions,
  HealthPermission,
  HealthValue,
} from 'react-native-health';
import type { HealthSyncStatus, HealthSyncResult, HealthDataTypeConfig, CompletedFastRow } from './types';
import {
  callbackToPromise,
  normalizeError,
  getSyncCursor,
  recordSyncEvent,
  getWeightUnit,
  insertVitalIfMissing,
  insertSleepIfMissing,
  insertWeightIfMissing,
  getLegacySetting,
  setLegacySetting,
} from './utils';

const MAX_SYNC_FASTS = 200;
const EXPORT_CURSOR_KEY = 'healthLastFastExportAt';

export async function getAppleHealthStatus(): Promise<HealthSyncStatus> {
  try {
    const appleHealthModule = await import('react-native-health');
    const appleHealthKit = appleHealthModule.default;
    const available = await callbackToPromise<boolean>((cb) => appleHealthKit.isAvailable(cb));

    return available
      ? { available: true, platform: 'ios', reason: 'Apple Health is ready.' }
      : { available: false, platform: 'ios', reason: 'Apple Health is not available on this device.' };
  } catch (error) {
    return {
      available: false,
      platform: 'ios',
      reason:
        `Apple Health native module is unavailable in this build. ` +
        `Use an EAS/custom dev client. ${normalizeError(error)}`,
    };
  }
}

function buildPermissions(
  appleHealthModule: typeof import('react-native-health'),
  enabledTypes: HealthDataTypeConfig[],
  writeFasts: boolean,
): HealthKitPermissions {
  const readPermissions: HealthPermission[] = [];
  const writePermissions: HealthPermission[] = [];

  for (const dt of enabledTypes) {
    if (!dt.appleHealthType) continue;

    // Map HealthKit type names to react-native-health permission enums
    const permMap: Record<string, HealthPermission[]> = {
      HeartRate: [appleHealthModule.HealthPermission.HeartRate],
      RestingHeartRate: [appleHealthModule.HealthPermission.RestingHeartRate],
      HeartRateVariabilitySDNN: [appleHealthModule.HealthPermission.HeartRateVariability],
      OxygenSaturation: [appleHealthModule.HealthPermission.OxygenSaturation],
      BloodPressureSystolic: [
        appleHealthModule.HealthPermission.BloodPressureSystolic,
        appleHealthModule.HealthPermission.BloodPressureDiastolic,
      ],
      BodyTemperature: [appleHealthModule.HealthPermission.BodyTemperature],
      RespiratoryRate: [appleHealthModule.HealthPermission.RespiratoryRate],
      StepCount: [appleHealthModule.HealthPermission.StepCount],
      ActiveEnergyBurned: [appleHealthModule.HealthPermission.ActiveEnergyBurned],
      SleepAnalysis: [appleHealthModule.HealthPermission.SleepAnalysis],
      Weight: [
        appleHealthModule.HealthPermission.Weight,
        appleHealthModule.HealthPermission.BodyMass,
      ],
    };

    const perms = permMap[dt.appleHealthType];
    if (perms) readPermissions.push(...perms);
  }

  if (writeFasts) {
    writePermissions.push(
      appleHealthModule.HealthPermission.MindfulSession,
      appleHealthModule.HealthPermission.Workout,
    );
  }

  return { permissions: { read: readPermissions, write: writePermissions } };
}

async function importVitals(
  db: DatabaseAdapter,
  appleHealthKit: Record<string, CallableFunction>,
  dataType: HealthDataTypeConfig,
): Promise<number> {
  const cursor = getSyncCursor(db, dataType.key);
  let imported = 0;
  let newestAt = cursor;

  try {
    const options: HealthInputOptions = {
      startDate: cursor,
      endDate: new Date().toISOString(),
      ascending: true,
      limit: 1000,
    };

    const samples = await callbackToPromise<HealthValue[]>((cb) => {
      // Use the appropriate HealthKit sample method based on type
      const methodMap: Record<string, string> = {
        HeartRate: 'getHeartRateSamples',
        RestingHeartRate: 'getRestingHeartRate',
        HeartRateVariabilitySDNN: 'getHeartRateVariabilitySamples',
        OxygenSaturation: 'getOxygenSaturationSamples',
        BloodPressureSystolic: 'getBloodPressureSamples',
        BodyTemperature: 'getBodyTemperatureSamples',
        RespiratoryRate: 'getRespiratoryRateSamples',
        StepCount: 'getDailyStepCountSamples',
        ActiveEnergyBurned: 'getActiveEnergyBurned',
      };

      const method = methodMap[dataType.appleHealthType!];
      if (method && typeof (appleHealthKit as Record<string, unknown>)[method] === 'function') {
        (appleHealthKit as Record<string, CallableFunction>)[method](options, cb);
      } else {
        cb(null, []);
      }
    });

    if (dataType.target.table !== 'hl_vitals') return 0;
    const target = dataType.target;

    for (const sample of samples) {
      const value = Number(sample.value);
      if (!Number.isFinite(value)) continue;

      const recordedAt = sample.startDate ?? sample.endDate ?? new Date().toISOString();

      // Blood pressure has systolic in value and diastolic in value2
      const valueSecondary = dataType.key === 'bloodPressure'
        ? Number((sample as unknown as Record<string, unknown>).value2 ?? 0)
        : null;

      if (insertVitalIfMissing(db, target.vitalType, value, target.unit, recordedAt, 'apple_health', valueSecondary)) {
        imported += 1;
      }

      if (recordedAt > newestAt) newestAt = recordedAt;
    }

    recordSyncEvent(db, dataType.key, 'read', imported, newestAt);
  } catch (error) {
    recordSyncEvent(db, dataType.key, 'read', 0, null, normalizeError(error));
  }

  return imported;
}

async function importSleep(
  db: DatabaseAdapter,
  appleHealthKit: Record<string, CallableFunction>,
): Promise<number> {
  const cursor = getSyncCursor(db, 'sleep');
  let imported = 0;
  let newestAt = cursor;

  try {
    const options: HealthInputOptions = {
      startDate: cursor,
      endDate: new Date().toISOString(),
      ascending: true,
      limit: 100,
    };

    const samples = await callbackToPromise<HealthValue[]>((cb) => {
      if (typeof appleHealthKit.getSleepSamples === 'function') {
        appleHealthKit.getSleepSamples(options, cb);
      } else {
        cb(null, []);
      }
    });

    for (const sample of samples) {
      const startTime = sample.startDate;
      const endTime = sample.endDate;
      if (!startTime || !endTime) continue;

      if (insertSleepIfMissing(db, startTime, endTime, null, null, null, null, 'apple_health')) {
        imported += 1;
      }

      if (endTime > newestAt) newestAt = endTime;
    }

    recordSyncEvent(db, 'sleep', 'read', imported, newestAt);
  } catch (error) {
    recordSyncEvent(db, 'sleep', 'read', 0, null, normalizeError(error));
  }

  return imported;
}

async function importWeight(
  db: DatabaseAdapter,
  appleHealthKit: Record<string, CallableFunction>,
  appleHealthModule: typeof import('react-native-health'),
): Promise<number> {
  const cursor = getSyncCursor(db, 'weight');
  const unit = getWeightUnit(db);
  let imported = 0;
  let newestAt = cursor;

  const options: HealthInputOptions = {
    startDate: cursor,
    endDate: new Date().toISOString(),
    ascending: true,
    limit: 500,
    unit: appleHealthModule.HealthUnit.pound,
  };

  const samples = await callbackToPromise<HealthValue[]>((cb) =>
    appleHealthKit.getWeightSamples(options, cb),
  );

  for (const sample of samples) {
    const pounds = Number(sample.value);
    if (!Number.isFinite(pounds)) continue;

    const normalizedValue = unit === 'kg' ? pounds * 0.45359237 : pounds;
    const recordedAt = sample.startDate ?? sample.endDate ?? new Date().toISOString();

    if (insertWeightIfMissing(db, normalizedValue, unit, recordedAt)) {
      imported += 1;
    }

    if (recordedAt > newestAt) newestAt = recordedAt;
  }

  recordSyncEvent(db, 'weight', 'read', imported, newestAt);
  // Also update legacy cursor for backward compat
  setLegacySetting(db, 'healthLastWeightImportAt', newestAt);

  return imported;
}

async function exportFasts(
  db: DatabaseAdapter,
  appleHealthKit: Record<string, CallableFunction>,
  appleHealthModule: typeof import('react-native-health'),
): Promise<number> {
  const since = getLegacySetting(db, EXPORT_CURSOR_KEY);
  let fasts: CompletedFastRow[];

  if (since) {
    fasts = db.query<CompletedFastRow>(
      `SELECT id, protocol, target_hours, started_at, ended_at
       FROM ft_fasts WHERE ended_at IS NOT NULL AND ended_at > ?
       ORDER BY ended_at ASC LIMIT ?`,
      [since, MAX_SYNC_FASTS],
    );
  } else {
    fasts = db.query<CompletedFastRow>(
      `SELECT id, protocol, target_hours, started_at, ended_at
       FROM ft_fasts WHERE ended_at IS NOT NULL
       ORDER BY ended_at ASC LIMIT ?`,
      [MAX_SYNC_FASTS],
    );
  }

  let exported = 0;

  for (const fast of fasts) {
    const minutes = Math.max(
      1,
      Math.round((new Date(fast.ended_at).getTime() - new Date(fast.started_at).getTime()) / 60000),
    );

    try {
      await callbackToPromise<HealthValue>((cb) =>
        appleHealthKit.saveMindfulSession(
          { startDate: fast.started_at, endDate: fast.ended_at, value: minutes },
          cb,
        ),
      );
      exported += 1;
    } catch {
      await callbackToPromise<HealthValue>((cb) =>
        appleHealthKit.saveWorkout(
          {
            type: appleHealthModule.HealthActivity.MindAndBody,
            startDate: fast.started_at,
            endDate: fast.ended_at,
            metadata: { sourceName: 'MyLife Fast', externalUUID: `mylife-fast-${fast.id}` },
          },
          cb,
        ),
      );
      exported += 1;
    }
  }

  if (fasts.length > 0) {
    setLegacySetting(db, EXPORT_CURSOR_KEY, fasts[fasts.length - 1].ended_at);
    recordSyncEvent(db, 'fasts', 'write', exported, fasts[fasts.length - 1].ended_at);
  }

  return exported;
}

export async function syncAppleHealth(
  db: DatabaseAdapter,
  options: { enabledTypes: HealthDataTypeConfig[]; writeFasts: boolean },
): Promise<HealthSyncResult> {
  const appleHealthModule = await import('react-native-health');
  const appleHealthKit = appleHealthModule.default as unknown as Record<string, CallableFunction>;

  const available = await callbackToPromise<boolean>((cb) =>
    (appleHealthKit as unknown as { isAvailable: (cb: (err: unknown, val: boolean) => void) => void }).isAvailable(cb),
  );
  if (!available) {
    return { importedWeightEntries: 0, exportedFasts: 0, importedVitals: 0, importedSleepSessions: 0, message: 'Apple Health is unavailable.' };
  }

  const permissions = buildPermissions(appleHealthModule, options.enabledTypes, options.writeFasts);
  await callbackToPromise<HealthValue>((cb) =>
    (appleHealthKit as unknown as { initHealthKit: (p: HealthKitPermissions, cb: (err: unknown, val: HealthValue) => void) => void }).initHealthKit(permissions, cb),
  );

  let importedVitals = 0;
  let importedSleepSessions = 0;
  let importedWeightEntries = 0;
  let exportedFasts = 0;

  // Import vitals
  const vitalTypes = options.enabledTypes.filter(
    (dt) => dt.target.table === 'hl_vitals' && dt.appleHealthType,
  );
  for (const dt of vitalTypes) {
    importedVitals += await importVitals(db, appleHealthKit as never, dt);
  }

  // Import sleep
  const sleepEnabled = options.enabledTypes.some((dt) => dt.key === 'sleep');
  if (sleepEnabled) {
    importedSleepSessions = await importSleep(db, appleHealthKit);
  }

  // Import weight
  const weightEnabled = options.enabledTypes.some((dt) => dt.key === 'weight');
  if (weightEnabled) {
    importedWeightEntries = await importWeight(db, appleHealthKit, appleHealthModule);
  }

  // Export fasts
  if (options.writeFasts) {
    exportedFasts = await exportFasts(db, appleHealthKit, appleHealthModule);
  }

  const parts: string[] = [];
  if (importedVitals > 0) parts.push(`${importedVitals} vital(s)`);
  if (importedSleepSessions > 0) parts.push(`${importedSleepSessions} sleep session(s)`);
  if (importedWeightEntries > 0) parts.push(`${importedWeightEntries} weight entr${importedWeightEntries === 1 ? 'y' : 'ies'}`);
  if (exportedFasts > 0) parts.push(`exported ${exportedFasts} fast(s)`);

  return {
    importedWeightEntries,
    exportedFasts,
    importedVitals,
    importedSleepSessions,
    message: parts.length > 0
      ? `Health sync complete: ${parts.join(', ')}.`
      : 'Health sync complete. No new data.',
  };
}
