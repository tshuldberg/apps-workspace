import { Platform } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import type {
  HealthInputOptions,
  HealthKitPermissions,
  HealthPermission,
  HealthValue,
} from 'react-native-health';
import type { Permission } from 'react-native-health-connect';

export interface HealthSyncStatus {
  available: boolean;
  platform: 'ios' | 'android' | 'unsupported';
  reason: string;
}

export interface HealthSyncResult {
  importedWeightEntries: number;
  exportedFasts: number;
  message: string;
}

interface CompletedFastRow {
  id: string;
  protocol: string;
  target_hours: number;
  started_at: string;
  ended_at: string;
}

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';
const DEFAULT_LOOKBACK_DAYS = 120;
const MAX_SYNC_FASTS = 200;
const IMPORT_CURSOR_KEY = 'healthLastWeightImportAt';
const EXPORT_CURSOR_KEY = 'healthLastFastExportAt';

type WeightUnit = 'lbs' | 'kg';

function createId(prefix: string): string {
  const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof maybeCrypto?.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Health sync failed due to an unknown error.';
}

function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(`SELECT value FROM ft_settings WHERE key = ?`, [key]);
  return rows[0]?.value ?? null;
}

function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(`INSERT OR REPLACE INTO ft_settings (key, value) VALUES (?, ?)`, [key, value]);
}

function getWeightUnit(db: DatabaseAdapter): WeightUnit {
  const value = getSetting(db, 'weightUnit');
  return value === 'kg' ? 'kg' : 'lbs';
}

function getDefaultImportStartIso(db: DatabaseAdapter): string {
  const existing = getSetting(db, IMPORT_CURSOR_KEY);
  if (existing) return existing;
  const start = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 3600 * 1000);
  return start.toISOString();
}

function getExportCursor(db: DatabaseAdapter): string | null {
  return getSetting(db, EXPORT_CURSOR_KEY);
}

function listCompletedFastsForExport(db: DatabaseAdapter): CompletedFastRow[] {
  const since = getExportCursor(db);
  if (since) {
    return db.query<CompletedFastRow>(
      `SELECT id, protocol, target_hours, started_at, ended_at
       FROM ft_fasts
       WHERE ended_at IS NOT NULL AND ended_at > ?
       ORDER BY ended_at ASC
       LIMIT ?`,
      [since, MAX_SYNC_FASTS],
    );
  }

  return db.query<CompletedFastRow>(
    `SELECT id, protocol, target_hours, started_at, ended_at
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
     ORDER BY ended_at ASC
     LIMIT ?`,
    [MAX_SYNC_FASTS],
  );
}

function insertImportedWeightIfMissing(
  db: DatabaseAdapter,
  value: number,
  unit: WeightUnit,
  recordedAt: string,
): boolean {
  const parsedDate = new Date(recordedAt);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const date = parsedDate.toISOString().slice(0, 10);
  const rounded = Math.round(value * 1000) / 1000;

  const exists = db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM ft_weight_entries
     WHERE date = ? AND unit = ? AND ABS(weight_value - ?) < 0.001`,
    [date, unit, rounded],
  );

  if ((exists[0]?.count ?? 0) > 0) {
    return false;
  }

  db.execute(
    `INSERT INTO ft_weight_entries (id, weight_value, unit, date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      createId('weight'),
      rounded,
      unit,
      date,
      'Imported from health platform',
      new Date().toISOString(),
    ],
  );

  return true;
}

function mapSdkStatusMessage(sdkStatus: number, availableConstant: number): string {
  if (sdkStatus === availableConstant) {
    return 'Health Connect is available.';
  }
  if (sdkStatus === 2) {
    return 'Health Connect needs an update on this device.';
  }
  return 'Health Connect is unavailable on this device.';
}

function callbackToPromise<T>(
  invoke: (callback: (error: unknown, result: T) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    invoke((error, result) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      resolve(result);
    });
  });
}

async function getAndroidHealthStatus(): Promise<HealthSyncStatus> {
  try {
    const healthConnect = await import('react-native-health-connect');
    const sdkStatus = await healthConnect.getSdkStatus(HEALTH_CONNECT_PACKAGE);

    if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return {
        available: false,
        platform: 'android',
        reason: mapSdkStatusMessage(
          sdkStatus,
          healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE,
        ),
      };
    }

    return {
      available: true,
      platform: 'android',
      reason: 'Health Connect is ready.',
    };
  } catch (error) {
    return {
      available: false,
      platform: 'android',
      reason:
        `Health Connect native module is unavailable in this build. ` +
        `Use an EAS/custom dev client. ${normalizeError(error)}`,
    };
  }
}

async function getAppleHealthStatus(): Promise<HealthSyncStatus> {
  try {
    const appleHealthModule = await import('react-native-health');
    const appleHealthKit = appleHealthModule.default;
    const available = await callbackToPromise<boolean>((cb) => appleHealthKit.isAvailable(cb));

    return available
      ? { available: true, platform: 'ios', reason: 'Apple Health is ready.' }
      : {
        available: false,
        platform: 'ios',
        reason: 'Apple Health is not available on this device.',
      };
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

async function syncAndroidHealthConnect(
  db: DatabaseAdapter,
  options: { readWeight: boolean; writeFasts: boolean },
): Promise<HealthSyncResult> {
  const healthConnect = await import('react-native-health-connect');
  const sdkStatus = await healthConnect.getSdkStatus(HEALTH_CONNECT_PACKAGE);

  if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      message: mapSdkStatusMessage(
        sdkStatus,
        healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE,
      ),
    };
  }

  const initialized = await healthConnect.initialize(HEALTH_CONNECT_PACKAGE);
  if (!initialized) {
    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      message: 'Failed to initialize Health Connect.',
    };
  }

  const permissions: Permission[] = [];
  if (options.readWeight) {
    permissions.push({ accessType: 'read', recordType: 'Weight' });
  }
  if (options.writeFasts) {
    permissions.push({ accessType: 'write', recordType: 'ExerciseSession' });
  }

  if (permissions.length > 0) {
    await healthConnect.requestPermission(permissions);
  }

  const preferredUnit = getWeightUnit(db);
  let importedWeightEntries = 0;
  let exportedFasts = 0;

  if (options.readWeight) {
    let pageToken: string | undefined;
    let newestSeenAt = getDefaultImportStartIso(db);

    do {
      const records = await healthConnect.readRecords('Weight', {
        timeRangeFilter: {
          operator: 'after',
          startTime: getDefaultImportStartIso(db),
        },
        pageSize: 500,
        ...(pageToken ? { pageToken } : {}),
      });

      for (const record of records.records) {
        const weightValue = preferredUnit === 'kg'
          ? record.weight.inKilograms
          : record.weight.inPounds;

        if (
          Number.isFinite(weightValue) &&
          insertImportedWeightIfMissing(db, weightValue, preferredUnit, record.time)
        ) {
          importedWeightEntries += 1;
        }

        if (record.time > newestSeenAt) {
          newestSeenAt = record.time;
        }
      }

      pageToken = records.pageToken;
      if (!pageToken) {
        setSetting(db, IMPORT_CURSOR_KEY, newestSeenAt);
      }
    } while (pageToken);
  }

  if (options.writeFasts) {
    const fasts = listCompletedFastsForExport(db);
    if (fasts.length > 0) {
      const payload = fasts.map((fast) => ({
        recordType: 'ExerciseSession' as const,
        startTime: fast.started_at,
        endTime: fast.ended_at,
        exerciseType: healthConnect.ExerciseType.OTHER_WORKOUT,
        title: `Fast ${fast.protocol}`,
        notes: `Fasting window tracked in MyLife Fast (${fast.target_hours}h target).`,
        metadata: {
          clientRecordId: `mylife-fast-${fast.id}`,
          clientRecordVersion: 1,
        },
      }));

      const inserted = await healthConnect.insertRecords(payload);
      exportedFasts = inserted.length;
      setSetting(db, EXPORT_CURSOR_KEY, fasts[fasts.length - 1].ended_at);
    }
  }

  return {
    importedWeightEntries,
    exportedFasts,
    message: `Health sync complete. Imported ${importedWeightEntries} weight entr${importedWeightEntries === 1 ? 'y' : 'ies'} and exported ${exportedFasts} fast${exportedFasts === 1 ? '' : 's'}.`,
  };
}

async function syncAppleHealth(
  db: DatabaseAdapter,
  options: { readWeight: boolean; writeFasts: boolean },
): Promise<HealthSyncResult> {
  const appleHealthModule = await import('react-native-health');
  const appleHealthKit = appleHealthModule.default;

  const available = await callbackToPromise<boolean>((cb) => appleHealthKit.isAvailable(cb));
  if (!available) {
    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      message: 'Apple Health is unavailable on this device.',
    };
  }

  const readPermissions: HealthPermission[] = [];
  const writePermissions: HealthPermission[] = [];

  if (options.readWeight) {
    readPermissions.push(
      appleHealthModule.HealthPermission.Weight,
      appleHealthModule.HealthPermission.BodyMass,
    );
  }
  if (options.writeFasts) {
    writePermissions.push(
      appleHealthModule.HealthPermission.MindfulSession,
      appleHealthModule.HealthPermission.Workout,
    );
  }

  const permissions: HealthKitPermissions = {
    permissions: {
      read: readPermissions,
      write: writePermissions,
    },
  };

  await callbackToPromise<HealthValue>((cb) =>
    appleHealthKit.initHealthKit(permissions, cb),
  );

  let importedWeightEntries = 0;
  let exportedFasts = 0;

  if (options.readWeight) {
    const unit = getWeightUnit(db);
    const importStartIso = getDefaultImportStartIso(db);
    let newestSeenAt = importStartIso;

    const sampleOptions: HealthInputOptions = {
      startDate: importStartIso,
      endDate: new Date().toISOString(),
      ascending: true,
      limit: 500,
      unit: appleHealthModule.HealthUnit.pound,
    };

    const samples = await callbackToPromise<HealthValue[]>((cb) =>
      appleHealthKit.getWeightSamples(sampleOptions, cb),
    );

    for (const sample of samples) {
      const pounds = Number(sample.value);
      if (!Number.isFinite(pounds)) continue;

      const normalizedValue = unit === 'kg'
        ? pounds * 0.45359237
        : pounds;
      const recordedAt = sample.startDate ?? sample.endDate ?? new Date().toISOString();

      if (insertImportedWeightIfMissing(db, normalizedValue, unit, recordedAt)) {
        importedWeightEntries += 1;
      }

      if (recordedAt > newestSeenAt) {
        newestSeenAt = recordedAt;
      }
    }

    setSetting(db, IMPORT_CURSOR_KEY, newestSeenAt);
  }

  if (options.writeFasts) {
    const fasts = listCompletedFastsForExport(db);
    for (const fast of fasts) {
      const minutes = Math.max(
        1,
        Math.round(
          (new Date(fast.ended_at).getTime() - new Date(fast.started_at).getTime()) / 60000,
        ),
      );

      try {
        await callbackToPromise<HealthValue>((cb) =>
          appleHealthKit.saveMindfulSession(
            {
              startDate: fast.started_at,
              endDate: fast.ended_at,
              value: minutes,
            },
            cb,
          ),
        );
        exportedFasts += 1;
      } catch {
        await callbackToPromise<HealthValue>((cb) =>
          appleHealthKit.saveWorkout(
            {
              type: appleHealthModule.HealthActivity.MindAndBody,
              startDate: fast.started_at,
              endDate: fast.ended_at,
              metadata: {
                sourceName: 'MyLife Fast',
                externalUUID: `mylife-fast-${fast.id}`,
              },
            },
            cb,
          ),
        );
        exportedFasts += 1;
      }
    }

    if (fasts.length > 0) {
      setSetting(db, EXPORT_CURSOR_KEY, fasts[fasts.length - 1].ended_at);
    }
  }

  return {
    importedWeightEntries,
    exportedFasts,
    message: `Health sync complete. Imported ${importedWeightEntries} weight entr${importedWeightEntries === 1 ? 'y' : 'ies'} and exported ${exportedFasts} fast${exportedFasts === 1 ? '' : 's'}.`,
  };
}

export function getHealthSyncStatus(): HealthSyncStatus {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      available: false,
      platform: 'unsupported',
      reason: 'Health sync is only available on iOS and Android devices.',
    };
  }

  return {
    available: true,
    platform: Platform.OS,
    reason: 'Health sync requires a custom development or production build.',
  };
}

export async function probeHealthSyncStatus(): Promise<HealthSyncStatus> {
  if (Platform.OS === 'android') {
    return getAndroidHealthStatus();
  }
  if (Platform.OS === 'ios') {
    return getAppleHealthStatus();
  }
  return getHealthSyncStatus();
}

export async function syncHealthData(
  db: DatabaseAdapter,
  options: { readWeight: boolean; writeFasts: boolean },
): Promise<HealthSyncResult> {
  if (!options.readWeight && !options.writeFasts) {
    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      message: 'Enable at least one sync option (read weight or write fasts).',
    };
  }

  try {
    if (Platform.OS === 'android') {
      return await syncAndroidHealthConnect(db, options);
    }

    if (Platform.OS === 'ios') {
      return await syncAppleHealth(db, options);
    }

    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      message: 'Health sync is only available on iOS and Android devices.',
    };
  } catch (error) {
    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      message: normalizeError(error),
    };
  }
}
