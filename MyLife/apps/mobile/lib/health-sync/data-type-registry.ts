import type { HealthDataTypeConfig } from './types';

/**
 * Registry of all health data types that can be synced.
 * Each entry maps a data type key to platform-specific identifiers and a target table.
 *
 * HealthKit types come from react-native-health.
 * Health Connect record types come from react-native-health-connect.
 */
export const HEALTH_DATA_TYPES: HealthDataTypeConfig[] = [
  // --- Vitals (read from wearable, write to hl_vitals) ---
  {
    key: 'heartRate',
    label: 'Heart Rate',
    direction: 'read',
    appleHealthType: 'HeartRate',
    healthConnectRecordType: 'HeartRate',
    target: { table: 'hl_vitals', vitalType: 'heart_rate', unit: 'bpm' },
    defaultEnabled: true,
  },
  {
    key: 'restingHeartRate',
    label: 'Resting Heart Rate',
    direction: 'read',
    appleHealthType: 'RestingHeartRate',
    healthConnectRecordType: 'RestingHeartRate',
    target: { table: 'hl_vitals', vitalType: 'resting_heart_rate', unit: 'bpm' },
    defaultEnabled: true,
  },
  {
    key: 'hrv',
    label: 'Heart Rate Variability',
    direction: 'read',
    appleHealthType: 'HeartRateVariabilitySDNN',
    healthConnectRecordType: 'HeartRateVariabilityRmssd',
    target: { table: 'hl_vitals', vitalType: 'hrv', unit: 'ms' },
    defaultEnabled: true,
  },
  {
    key: 'bloodOxygen',
    label: 'Blood Oxygen',
    direction: 'read',
    appleHealthType: 'OxygenSaturation',
    healthConnectRecordType: 'OxygenSaturation',
    target: { table: 'hl_vitals', vitalType: 'blood_oxygen', unit: '%' },
    defaultEnabled: true,
  },
  {
    key: 'bloodPressure',
    label: 'Blood Pressure',
    direction: 'read',
    appleHealthType: 'BloodPressureSystolic',
    healthConnectRecordType: 'BloodPressure',
    target: { table: 'hl_vitals', vitalType: 'blood_pressure', unit: 'mmHg' },
    defaultEnabled: true,
  },
  {
    key: 'bodyTemperature',
    label: 'Body Temperature',
    direction: 'read',
    appleHealthType: 'BodyTemperature',
    healthConnectRecordType: 'BodyTemperature',
    target: { table: 'hl_vitals', vitalType: 'body_temperature', unit: '°F' },
    defaultEnabled: false,
  },
  {
    key: 'respiratoryRate',
    label: 'Respiratory Rate',
    direction: 'read',
    appleHealthType: 'RespiratoryRate',
    healthConnectRecordType: 'RespiratoryRate',
    target: { table: 'hl_vitals', vitalType: 'respiratory_rate', unit: 'breaths/min' },
    defaultEnabled: false,
  },

  // --- Activity (read from wearable, write to hl_vitals) ---
  {
    key: 'steps',
    label: 'Steps',
    direction: 'read',
    appleHealthType: 'StepCount',
    healthConnectRecordType: 'Steps',
    target: { table: 'hl_vitals', vitalType: 'steps', unit: 'steps' },
    defaultEnabled: true,
  },
  {
    key: 'activeEnergy',
    label: 'Active Energy',
    direction: 'read',
    appleHealthType: 'ActiveEnergyBurned',
    healthConnectRecordType: 'ActiveCaloriesBurned',
    target: { table: 'hl_vitals', vitalType: 'active_energy', unit: 'kcal' },
    defaultEnabled: true,
  },

  // --- Sleep (read from wearable, write to hl_sleep_sessions) ---
  {
    key: 'sleep',
    label: 'Sleep',
    direction: 'read',
    appleHealthType: 'SleepAnalysis',
    healthConnectRecordType: 'SleepSession',
    target: { table: 'hl_sleep_sessions' },
    defaultEnabled: true,
  },

  // --- Weight (read from wearable, write to ft_weight_entries -- legacy) ---
  {
    key: 'weight',
    label: 'Weight',
    direction: 'read',
    appleHealthType: 'Weight',
    healthConnectRecordType: 'Weight',
    target: { table: 'ft_weight_entries' },
    defaultEnabled: true,
  },
];

/** Lookup a data type config by key. */
export function getDataTypeConfig(key: string): HealthDataTypeConfig | undefined {
  return HEALTH_DATA_TYPES.find((dt) => dt.key === key);
}

/** Get all data type configs that are readable (import from wearable). */
export function getReadableDataTypes(): HealthDataTypeConfig[] {
  return HEALTH_DATA_TYPES.filter((dt) => dt.direction === 'read');
}
