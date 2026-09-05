export type VitalType =
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'hrv'
  | 'blood_oxygen'
  | 'blood_pressure'
  | 'body_temperature'
  | 'steps'
  | 'active_energy'
  | 'respiratory_rate'
  | 'vo2_max';

export type VitalSource = 'manual' | 'apple_health' | 'health_connect' | 'imported';

export interface Vital {
  id: string;
  vital_type: VitalType;
  value: number;
  value_secondary: number | null;
  unit: string;
  source: VitalSource;
  recorded_at: string;
  created_at: string;
}

export interface LogVitalInput {
  vital_type: VitalType;
  value: number;
  /** Secondary value (e.g., diastolic for blood pressure) */
  value_secondary?: number;
  unit: string;
  source?: VitalSource;
  recorded_at?: string;
}

export interface VitalAggregate {
  vital_type: VitalType;
  date: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}
