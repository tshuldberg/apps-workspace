import type { DatabaseAdapter } from '@mylife/db';
import type { Permission } from 'react-native-health-connect';
import type { HealthSyncStatus, HealthSyncResult, HealthDataTypeConfig, CompletedFastRow } from './types';
import {
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

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';
const MAX_SYNC_FASTS = 200;
const EXPORT_CURSOR_KEY = 'healthLastFastExportAt';

function mapSdkStatusMessage(sdkStatus: number, availableConstant: number): string {
  if (sdkStatus === availableConstant) return 'Health Connect is available.';
  if (sdkStatus === 2) return 'Health Connect needs an update on this device.';
  return 'Health Connect is unavailable on this device.';
}

export async function getAndroidHealthStatus(): Promise<HealthSyncStatus> {
  try {
    const healthConnect = await import('react-native-health-connect');
    const sdkStatus = await healthConnect.getSdkStatus(HEALTH_CONNECT_PACKAGE);

    if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return {
        available: false,
        platform: 'android',
        reason: mapSdkStatusMessage(sdkStatus, healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE),
      };
    }

    return { available: true, platform: 'android', reason: 'Health Connect is ready.' };
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

function buildPermissions(
  enabledTypes: HealthDataTypeConfig[],
  writeFasts: boolean,
): Permission[] {
  const permissions: Permission[] = [];

  for (const dt of enabledTypes) {
    if (!dt.healthConnectRecordType) continue;
    permissions.push({
      accessType: 'read',
      recordType: dt.healthConnectRecordType as Permission['recordType'],
    });
  }

  if (writeFasts) {
    permissions.push({ accessType: 'write', recordType: 'ExerciseSession' });
  }

  return permissions;
}

async function importVitals(
  db: DatabaseAdapter,
  healthConnect: typeof import('react-native-health-connect'),
  dataType: HealthDataTypeConfig,
): Promise<number> {
  if (dataType.target.table !== 'hl_vitals' || !dataType.healthConnectRecordType) return 0;
  const target = dataType.target;

  const cursor = getSyncCursor(db, dataType.key);
  let imported = 0;
  let newestAt = cursor;

  try {
    let pageToken: string | undefined;

    do {
      const result = await healthConnect.readRecords(
        dataType.healthConnectRecordType as Parameters<typeof healthConnect.readRecords>[0],
        {
          timeRangeFilter: { operator: 'after', startTime: cursor },
          pageSize: 500,
          ...(pageToken ? { pageToken } : {}),
        },
      );

      for (const record of result.records) {
        const rec = record as Record<string, unknown>;
        let value: number;
        let valueSecondary: number | null = null;
        let recordedAt: string;

        // Extract value based on data type
        if (dataType.key === 'bloodPressure') {
          value = Number((rec.systolic as Record<string, unknown>)?.inMillimetersOfMercury ?? 0);
          valueSecondary = Number((rec.diastolic as Record<string, unknown>)?.inMillimetersOfMercury ?? 0);
          recordedAt = String(rec.time ?? '');
        } else if (dataType.key === 'steps') {
          value = Number(rec.count ?? 0);
          recordedAt = String(rec.startTime ?? rec.time ?? '');
        } else if (dataType.key === 'activeEnergy') {
          value = Number((rec.energy as Record<string, unknown>)?.inKilocalories ?? 0);
          recordedAt = String(rec.startTime ?? rec.time ?? '');
        } else if (dataType.key === 'bodyTemperature') {
          value = Number((rec.temperature as Record<string, unknown>)?.inFahrenheit ?? 0);
          recordedAt = String(rec.time ?? '');
        } else if (dataType.key === 'bloodOxygen') {
          value = Number((rec.percentage as Record<string, unknown>)?.value ?? rec.percentage ?? 0);
          recordedAt = String(rec.time ?? '');
        } else {
          // HeartRate, RestingHeartRate, HRV, RespiratoryRate
          value = Number((rec.beatsPerMinute ?? rec.heartRateVariabilityMillis ?? rec.rate ?? rec.value ?? 0));
          recordedAt = String(rec.time ?? '');
        }

        if (!Number.isFinite(value) || !recordedAt) continue;

        if (insertVitalIfMissing(db, target.vitalType, value, target.unit, recordedAt, 'health_connect', valueSecondary)) {
          imported += 1;
        }

        if (recordedAt > newestAt) newestAt = recordedAt;
      }

      pageToken = result.pageToken;
    } while (pageToken);

    recordSyncEvent(db, dataType.key, 'read', imported, newestAt);
  } catch (error) {
    recordSyncEvent(db, dataType.key, 'read', 0, null, normalizeError(error));
  }

  return imported;
}

async function importSleep(
  db: DatabaseAdapter,
  healthConnect: typeof import('react-native-health-connect'),
): Promise<number> {
  const cursor = getSyncCursor(db, 'sleep');
  let imported = 0;
  let newestAt = cursor;

  try {
    const result = await healthConnect.readRecords('SleepSession', {
      timeRangeFilter: { operator: 'after', startTime: cursor },
      pageSize: 100,
    });

    for (const record of result.records) {
      const rec = record as Record<string, unknown>;
      const startTime = String(rec.startTime ?? '');
      const endTime = String(rec.endTime ?? '');
      if (!startTime || !endTime) continue;

      // Extract stage durations from stages array if present
      const stages = rec.stages as Array<{ stage: number; startTime: string; endTime: string }> | undefined;
      let deepMinutes: number | null = null;
      let remMinutes: number | null = null;
      let lightMinutes: number | null = null;
      let awakeMinutes: number | null = null;

      if (stages && stages.length > 0) {
        deepMinutes = 0;
        remMinutes = 0;
        lightMinutes = 0;
        awakeMinutes = 0;

        for (const stage of stages) {
          const mins = Math.round(
            (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / 60000,
          );
          // Health Connect sleep stages: 1=Awake, 2=Sleeping, 3=OutOfBed, 4=Light, 5=Deep, 6=REM
          switch (stage.stage) {
            case 1: awakeMinutes += mins; break;
            case 4: lightMinutes += mins; break;
            case 5: deepMinutes += mins; break;
            case 6: remMinutes += mins; break;
          }
        }
      }

      if (insertSleepIfMissing(db, startTime, endTime, deepMinutes, remMinutes, lightMinutes, awakeMinutes, 'health_connect')) {
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
  healthConnect: typeof import('react-native-health-connect'),
): Promise<number> {
  const cursor = getSyncCursor(db, 'weight');
  const preferredUnit = getWeightUnit(db);
  let imported = 0;
  let newestAt = cursor;

  let pageToken: string | undefined;

  do {
    const records = await healthConnect.readRecords('Weight', {
      timeRangeFilter: { operator: 'after', startTime: cursor },
      pageSize: 500,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const record of records.records) {
      const rec = record as Record<string, unknown>;
      const weight = rec.weight as Record<string, number> | undefined;
      const weightValue = preferredUnit === 'kg'
        ? (weight?.inKilograms ?? 0)
        : (weight?.inPounds ?? 0);

      const recordedAt = String(rec.time ?? '');

      if (Number.isFinite(weightValue) && insertWeightIfMissing(db, weightValue, preferredUnit, recordedAt)) {
        imported += 1;
      }

      if (recordedAt > newestAt) newestAt = recordedAt;
    }

    pageToken = records.pageToken;
  } while (pageToken);

  recordSyncEvent(db, 'weight', 'read', imported, newestAt);
  setLegacySetting(db, 'healthLastWeightImportAt', newestAt);

  return imported;
}

async function exportFasts(
  db: DatabaseAdapter,
  healthConnect: typeof import('react-native-health-connect'),
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

  if (fasts.length === 0) return 0;

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
  const exported = inserted.length;

  setLegacySetting(db, EXPORT_CURSOR_KEY, fasts[fasts.length - 1].ended_at);
  recordSyncEvent(db, 'fasts', 'write', exported, fasts[fasts.length - 1].ended_at);

  return exported;
}

export async function syncAndroidHealthConnect(
  db: DatabaseAdapter,
  options: { enabledTypes: HealthDataTypeConfig[]; writeFasts: boolean },
): Promise<HealthSyncResult> {
  const healthConnect = await import('react-native-health-connect');
  const sdkStatus = await healthConnect.getSdkStatus(HEALTH_CONNECT_PACKAGE);

  if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      importedWeightEntries: 0, exportedFasts: 0, importedVitals: 0, importedSleepSessions: 0,
      message: mapSdkStatusMessage(sdkStatus, healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE),
    };
  }

  const initialized = await healthConnect.initialize(HEALTH_CONNECT_PACKAGE);
  if (!initialized) {
    return {
      importedWeightEntries: 0, exportedFasts: 0, importedVitals: 0, importedSleepSessions: 0,
      message: 'Failed to initialize Health Connect.',
    };
  }

  const permissions = buildPermissions(options.enabledTypes, options.writeFasts);
  if (permissions.length > 0) {
    await healthConnect.requestPermission(permissions);
  }

  let importedVitals = 0;
  let importedSleepSessions = 0;
  let importedWeightEntries = 0;
  let exportedFasts = 0;

  // Import vitals
  const vitalTypes = options.enabledTypes.filter(
    (dt) => dt.target.table === 'hl_vitals' && dt.healthConnectRecordType,
  );
  for (const dt of vitalTypes) {
    importedVitals += await importVitals(db, healthConnect, dt);
  }

  // Import sleep
  if (options.enabledTypes.some((dt) => dt.key === 'sleep')) {
    importedSleepSessions = await importSleep(db, healthConnect);
  }

  // Import weight
  if (options.enabledTypes.some((dt) => dt.key === 'weight')) {
    importedWeightEntries = await importWeight(db, healthConnect);
  }

  // Export fasts
  if (options.writeFasts) {
    exportedFasts = await exportFasts(db, healthConnect);
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
