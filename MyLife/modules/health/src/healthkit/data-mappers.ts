/**
 * Pure transformation functions for HealthKit samples to MyHealth data models.
 *
 * Maps HKQuantitySample -> LogVitalInput and HKCategorySample (sleep) -> LogSleepInput.
 * All functions are side-effect-free and testable without a database.
 */

import type { LogVitalInput, VitalType } from '../vitals/types';
import type { LogSleepInput } from '../sleep/types';
import type { HealthKitSample, HealthKitSleepSample } from './types';
import { HK_TYPE_MAP, VITAL_UNIT_MAP } from './types';

/**
 * Map a raw HealthKit quantity sample to a LogVitalInput.
 * Returns null if the sample type is unsupported or the value is invalid.
 */
export function mapQuantitySampleToVital(sample: HealthKitSample): LogVitalInput | null {
  const vitalType = HK_TYPE_MAP[sample.type];
  if (!vitalType) return null;

  const value = Number(sample.value);
  if (!Number.isFinite(value)) return null;

  const unit = sample.unit || VITAL_UNIT_MAP[vitalType];

  return {
    vital_type: vitalType,
    value,
    value_secondary: sample.valueSecondary != null && Number.isFinite(sample.valueSecondary)
      ? sample.valueSecondary
      : undefined,
    unit,
    source: 'apple_health',
    recorded_at: sample.startDate,
  };
}

/**
 * Map a batch of HealthKit quantity samples to LogVitalInput[].
 * Filters out unsupported types and invalid values.
 */
export function mapQuantitySamplesToVitals(samples: HealthKitSample[]): LogVitalInput[] {
  const results: LogVitalInput[] = [];
  for (const sample of samples) {
    const vital = mapQuantitySampleToVital(sample);
    if (vital) results.push(vital);
  }
  return results;
}

/** HealthKit sleep analysis category values */
const SLEEP_STAGE = {
  IN_BED: 0,
  ASLEEP_UNSPECIFIED: 1,
  AWAKE: 2,
  ASLEEP_CORE: 3,  // Light sleep
  ASLEEP_DEEP: 4,
  ASLEEP_REM: 5,
} as const;

/**
 * Aggregate raw HealthKit sleep samples into a single LogSleepInput.
 *
 * HealthKit reports sleep as individual HKCategorySample entries, each
 * covering a time range with a sleep stage value. This function groups
 * overlapping samples into one session and computes stage durations.
 *
 * Returns null if no valid sleep samples are provided.
 */
export function mapSleepSamplesToSession(samples: HealthKitSleepSample[]): LogSleepInput | null {
  if (samples.length === 0) return null;

  // Filter out invalid samples
  const valid = samples.filter((s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
  });

  if (valid.length === 0) return null;

  // Sort by start time
  valid.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Find overall session bounds
  const sessionStart = valid[0].startDate;
  const sessionEnd = valid.reduce((latest, s) => {
    return new Date(s.endDate) > new Date(latest) ? s.endDate : latest;
  }, valid[0].endDate);

  // Accumulate stage durations
  let deepMinutes = 0;
  let lightMinutes = 0;
  let remMinutes = 0;
  let awakeMinutes = 0;
  let hasStageData = false;

  for (const sample of valid) {
    const minutes = Math.round(
      (new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime()) / 60000,
    );
    if (minutes <= 0) continue;

    switch (sample.value) {
      case SLEEP_STAGE.ASLEEP_DEEP:
        deepMinutes += minutes;
        hasStageData = true;
        break;
      case SLEEP_STAGE.ASLEEP_CORE:
        lightMinutes += minutes;
        hasStageData = true;
        break;
      case SLEEP_STAGE.ASLEEP_REM:
        remMinutes += minutes;
        hasStageData = true;
        break;
      case SLEEP_STAGE.AWAKE:
        awakeMinutes += minutes;
        hasStageData = true;
        break;
      case SLEEP_STAGE.ASLEEP_UNSPECIFIED:
        // Count as light sleep when no specific stage info
        lightMinutes += minutes;
        hasStageData = true;
        break;
      case SLEEP_STAGE.IN_BED:
        // InBed doesn't map to a specific sleep stage
        break;
    }
  }

  return {
    start_time: sessionStart,
    end_time: sessionEnd,
    deep_minutes: hasStageData ? deepMinutes : undefined,
    rem_minutes: hasStageData ? remMinutes : undefined,
    light_minutes: hasStageData ? lightMinutes : undefined,
    awake_minutes: hasStageData ? awakeMinutes : undefined,
    source: 'apple_health',
  };
}

/**
 * Map a HealthKit unit string to the canonical MyHealth unit.
 */
export function mapHKUnitToMyHealthUnit(hkUnit: string, vitalType: VitalType): string {
  // Prefer the canonical unit for this vital type
  return VITAL_UNIT_MAP[vitalType] ?? hkUnit;
}

/**
 * Validate that a HealthKit sample has the minimum required fields.
 */
export function isValidSample(sample: Partial<HealthKitSample>): sample is HealthKitSample {
  return (
    typeof sample.uuid === 'string' &&
    typeof sample.type === 'string' &&
    typeof sample.value === 'number' &&
    Number.isFinite(sample.value) &&
    typeof sample.startDate === 'string' &&
    typeof sample.endDate === 'string' &&
    !Number.isNaN(new Date(sample.startDate).getTime()) &&
    !Number.isNaN(new Date(sample.endDate).getTime())
  );
}
