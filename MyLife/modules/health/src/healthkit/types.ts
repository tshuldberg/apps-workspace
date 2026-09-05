import type { VitalType } from '../vitals/types';

/**
 * Mapping from Apple HealthKit HKQuantityType identifiers to MyHealth VitalType.
 * This is the canonical list of supported HealthKit data types.
 */
export const HK_TYPE_MAP: Record<string, VitalType> = {
  'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
  'HKQuantityTypeIdentifierRestingHeartRate': 'resting_heart_rate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
  'HKQuantityTypeIdentifierOxygenSaturation': 'blood_oxygen',
  'HKQuantityTypeIdentifierBloodPressureSystolic': 'blood_pressure',
  'HKQuantityTypeIdentifierBodyTemperature': 'body_temperature',
  'HKQuantityTypeIdentifierStepCount': 'steps',
  'HKQuantityTypeIdentifierActiveEnergyBurned': 'active_energy',
  'HKQuantityTypeIdentifierRespiratoryRate': 'respiratory_rate',
  'HKQuantityTypeIdentifierVO2Max': 'vo2_max',
};

/**
 * Reverse map: VitalType -> HKQuantityType identifier.
 */
export const VITAL_TO_HK_MAP: Record<VitalType, string> = {
  heart_rate: 'HKQuantityTypeIdentifierHeartRate',
  resting_heart_rate: 'HKQuantityTypeIdentifierRestingHeartRate',
  hrv: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  blood_oxygen: 'HKQuantityTypeIdentifierOxygenSaturation',
  blood_pressure: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  body_temperature: 'HKQuantityTypeIdentifierBodyTemperature',
  steps: 'HKQuantityTypeIdentifierStepCount',
  active_energy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  respiratory_rate: 'HKQuantityTypeIdentifierRespiratoryRate',
  vo2_max: 'HKQuantityTypeIdentifierVO2Max',
};

/** Default unit per VitalType for HealthKit imports. */
export const VITAL_UNIT_MAP: Record<VitalType, string> = {
  heart_rate: 'bpm',
  resting_heart_rate: 'bpm',
  hrv: 'ms',
  blood_oxygen: '%',
  blood_pressure: 'mmHg',
  body_temperature: 'F',
  steps: 'count',
  active_energy: 'kcal',
  respiratory_rate: 'breaths/min',
  vo2_max: 'mL/kg/min',
};

/** All supported sync data type keys (used in hl_settings toggles). */
export const SYNC_DATA_TYPES = [
  'heartRate',
  'restingHeartRate',
  'hrv',
  'bloodOxygen',
  'bloodPressure',
  'bodyTemperature',
  'steps',
  'activeEnergy',
  'sleep',
  'respiratoryRate',
  'weight',
] as const;

export type SyncDataType = typeof SYNC_DATA_TYPES[number];

/** Map sync data type key -> VitalType. Sleep is handled separately. */
export const SYNC_KEY_TO_VITAL_TYPE: Record<string, VitalType | 'sleep'> = {
  heartRate: 'heart_rate',
  restingHeartRate: 'resting_heart_rate',
  hrv: 'hrv',
  bloodOxygen: 'blood_oxygen',
  bloodPressure: 'blood_pressure',
  bodyTemperature: 'body_temperature',
  steps: 'steps',
  activeEnergy: 'active_energy',
  sleep: 'sleep' as unknown as VitalType, // special-cased
  respiratoryRate: 'respiratory_rate',
  weight: 'steps', // weight stored as vital with unit conversion
};

/** User-friendly labels for each sync data type. */
export const SYNC_TYPE_LABELS: Record<SyncDataType, string> = {
  heartRate: 'Heart Rate',
  restingHeartRate: 'Resting Heart Rate',
  hrv: 'HRV',
  bloodOxygen: 'Blood Oxygen',
  bloodPressure: 'Blood Pressure',
  bodyTemperature: 'Body Temperature',
  steps: 'Steps',
  activeEnergy: 'Active Energy',
  sleep: 'Sleep',
  respiratoryRate: 'Respiratory Rate',
  weight: 'Weight',
};

/**
 * A raw HealthKit sample to be imported.
 */
export interface HealthKitSample {
  uuid: string;
  type: string; // HK identifier
  value: number;
  valueSecondary?: number;
  unit: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  sourceName?: string;
}

/**
 * A raw HealthKit sleep sample.
 */
export interface HealthKitSleepSample {
  uuid: string;
  startDate: string;
  endDate: string;
  value: number; // sleep analysis value
  sourceName?: string;
}

/** Sync log entry stored in hl_sync_log. */
export interface SyncLogEntry {
  data_type: string;
  last_sync_at: string;
  last_anchor: string | null;
  records_synced: number;
  error_message: string | null;
  updated_at: string;
}

/** Max records per sync batch to avoid blocking. */
export const SYNC_BATCH_SIZE = 500;

/** Default initial sync lookback in days. */
export const INITIAL_SYNC_DAYS = 90;

/** Max initial sync days cap. */
export const MAX_INITIAL_SYNC_DAYS = 90;
