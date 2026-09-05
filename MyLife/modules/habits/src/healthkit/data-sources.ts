/**
 * Supported HealthKit data sources catalog.
 * Each entry defines a metric that can be linked to a habit for auto-tracking.
 */

import type { HealthKitDataSource } from '../types';

export const HEALTHKIT_DATA_SOURCES: HealthKitDataSource[] = [
  {
    id: 'steps',
    label: 'Steps',
    healthKitIdentifier: 'stepCount',
    defaultThreshold: 10000,
    unit: 'steps',
    defaultComparison: 'gte',
  },
  {
    id: 'distance',
    label: 'Distance Walking/Running',
    healthKitIdentifier: 'distanceWalkingRunning',
    defaultThreshold: 5.0,
    unit: 'km',
    defaultComparison: 'gte',
  },
  {
    id: 'flights',
    label: 'Flights Climbed',
    healthKitIdentifier: 'flightsClimbed',
    defaultThreshold: 10,
    unit: 'flights',
    defaultComparison: 'gte',
  },
  {
    id: 'active_energy',
    label: 'Active Energy Burned',
    healthKitIdentifier: 'activeEnergyBurned',
    defaultThreshold: 500,
    unit: 'kcal',
    defaultComparison: 'gte',
  },
  {
    id: 'exercise_minutes',
    label: 'Exercise Minutes',
    healthKitIdentifier: 'appleExerciseTime',
    defaultThreshold: 30,
    unit: 'minutes',
    defaultComparison: 'gte',
  },
  {
    id: 'stand_hours',
    label: 'Stand Hours',
    healthKitIdentifier: 'appleStandHour',
    defaultThreshold: 12,
    unit: 'hours',
    defaultComparison: 'gte',
  },
  {
    id: 'mindful_minutes',
    label: 'Mindful Minutes',
    healthKitIdentifier: 'mindfulSession',
    defaultThreshold: 10,
    unit: 'minutes',
    defaultComparison: 'gte',
  },
  {
    id: 'sleep',
    label: 'Sleep Duration',
    healthKitIdentifier: 'sleepAnalysis',
    defaultThreshold: 7.0,
    unit: 'hours',
    defaultComparison: 'gte',
  },
  {
    id: 'water',
    label: 'Water Intake',
    healthKitIdentifier: 'dietaryWater',
    defaultThreshold: 2000,
    unit: 'ml',
    defaultComparison: 'gte',
  },
  {
    id: 'resting_hr',
    label: 'Resting Heart Rate',
    healthKitIdentifier: 'restingHeartRate',
    defaultThreshold: 70,
    unit: 'bpm',
    defaultComparison: 'lte',
  },
];

/** Find a data source by its ID. */
export function getDataSourceById(id: string): HealthKitDataSource | undefined {
  return HEALTHKIT_DATA_SOURCES.find((ds) => ds.id === id);
}
