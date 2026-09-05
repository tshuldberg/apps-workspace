import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS,
  CREATE_MAINTENANCE_SCHEDULES, CREATE_SCHEDULE_INDEXES,
  CREATE_TRIPS, CREATE_TRIP_INDEXES,
  CREATE_INSURANCE_POLICIES, CREATE_INSURANCE_DOCUMENTS, CREATE_INSURANCE_INDEXES,
  CREATE_REGISTRATIONS, CREATE_REGISTRATION_DOCUMENTS, CREATE_REGISTRATION_INDEXES,
  CREATE_GPS_TRIPS, CREATE_GPS_TRIP_INDEXES,
  CREATE_TIRE_SETS, CREATE_TIRE_MEASUREMENTS, CREATE_TIRE_ROTATIONS, CREATE_TIRE_INDEXES,
  CREATE_PARKING_LOCATIONS, CREATE_PARKING_INDEXES,
  CREATE_RECALLS, CREATE_RECALL_INDEXES,
  CREATE_DIAGNOSTIC_SNAPSHOTS, CREATE_DIAGNOSTIC_CODES, CREATE_LIVE_DATA_LOGS, CREATE_DIAGNOSTIC_INDEXES,
} from './db/schema';

const CAR_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial car schema - vehicles, maintenance, fuel_logs, settings + indexes + seeds',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_fuel_logs',
    'DROP TABLE IF EXISTS cr_maintenance',
    'DROP TABLE IF EXISTS cr_settings',
    'DROP TABLE IF EXISTS cr_vehicles',
  ],
};

const CAR_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add maintenance schedules table for reminder tracking',
  up: [
    CREATE_MAINTENANCE_SCHEDULES,
    ...CREATE_SCHEDULE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_maintenance_schedules',
  ],
};

const CAR_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add trips table for trip logging with purpose categories',
  up: [
    CREATE_TRIPS,
    ...CREATE_TRIP_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_trips',
  ],
};

const CAR_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Add insurance policies and documents tables',
  up: [
    CREATE_INSURANCE_POLICIES,
    CREATE_INSURANCE_DOCUMENTS,
    ...CREATE_INSURANCE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_insurance_documents',
    'DROP TABLE IF EXISTS cr_insurance_policies',
  ],
};

const CAR_MIGRATION_V5: Migration = {
  version: 5,
  description: 'Add registrations and registration documents tables',
  up: [
    CREATE_REGISTRATIONS,
    CREATE_REGISTRATION_DOCUMENTS,
    ...CREATE_REGISTRATION_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_registration_documents',
    'DROP TABLE IF EXISTS cr_registrations',
  ],
};

const CAR_MIGRATION_V6: Migration = {
  version: 6,
  description: 'Add GPS trips table for mileage tracking',
  up: [
    CREATE_GPS_TRIPS,
    ...CREATE_GPS_TRIP_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_gps_trips',
  ],
};

const CAR_MIGRATION_V7: Migration = {
  version: 7,
  description: 'Add tire sets, measurements, and rotations tables',
  up: [
    CREATE_TIRE_SETS,
    CREATE_TIRE_MEASUREMENTS,
    CREATE_TIRE_ROTATIONS,
    ...CREATE_TIRE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_tire_rotations',
    'DROP TABLE IF EXISTS cr_tire_measurements',
    'DROP TABLE IF EXISTS cr_tire_sets',
  ],
};

const CAR_MIGRATION_V8: Migration = {
  version: 8,
  description: 'Add parking locations table',
  up: [
    CREATE_PARKING_LOCATIONS,
    ...CREATE_PARKING_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_parking_locations',
  ],
};

const CAR_MIGRATION_V9: Migration = {
  version: 9,
  description: 'Add recalls table for VIN decoder recall tracking',
  up: [
    CREATE_RECALLS,
    ...CREATE_RECALL_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_recalls',
  ],
};

const CAR_MIGRATION_V10: Migration = {
  version: 10,
  description: 'Add diagnostic snapshots, codes, and live data tables for OBD-II',
  up: [
    CREATE_DIAGNOSTIC_SNAPSHOTS,
    CREATE_DIAGNOSTIC_CODES,
    CREATE_LIVE_DATA_LOGS,
    ...CREATE_DIAGNOSTIC_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS cr_live_data_logs',
    'DROP TABLE IF EXISTS cr_diagnostic_codes',
    'DROP TABLE IF EXISTS cr_diagnostic_snapshots',
  ],
};

const CAR_MIGRATION_V11: Migration = {
  version: 11,
  description: 'Add composite index on live_data_logs(vehicle_id, logged_at) for query performance',
  up: [
    `CREATE INDEX IF NOT EXISTS cr_live_data_vehicle_logged_idx ON cr_live_data_logs(vehicle_id, logged_at DESC)`,
  ],
  down: [
    'DROP INDEX IF EXISTS cr_live_data_vehicle_logged_idx',
  ],
};

export const CAR_MODULE: ModuleDefinition = {
  id: 'car',
  name: 'MyCar',
  tagline: 'Your complete vehicle companion',
  icon: '\u{1F697}',
  accentColor: '#6366F1',
  tier: 'premium',
  storageType: 'sqlite',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'vehicles',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'maintenance',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'fuel_logs',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'maintenance_schedules',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'trips',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'insurance_policies',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    CAR_MIGRATION_V1, CAR_MIGRATION_V2, CAR_MIGRATION_V3, CAR_MIGRATION_V4,
    CAR_MIGRATION_V5, CAR_MIGRATION_V6, CAR_MIGRATION_V7, CAR_MIGRATION_V8,
    CAR_MIGRATION_V9, CAR_MIGRATION_V10, CAR_MIGRATION_V11,
  ],
  schemaVersion: 11,
  tablePrefix: 'cr_',
  navigation: {
    tabs: [
      { key: 'dashboard', label: 'Dashboard', icon: 'gauge' },
      { key: 'maintenance', label: 'Maintenance', icon: 'wrench' },
      { key: 'fuel', label: 'Fuel', icon: 'droplet' },
      { key: 'trips', label: 'Trips', icon: 'map-pin' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'vehicle-detail', title: 'Vehicle' },
      { name: 'add-record', title: 'Add Record' },
      { name: 'service-history', title: 'Service History' },
      { name: 'insurance', title: 'Insurance' },
      { name: 'registration', title: 'Registration' },
      { name: 'tires', title: 'Tires' },
      { name: 'parking', title: 'Parking' },
      { name: 'diagnostics', title: 'Diagnostics' },
      { name: 'cost-analysis', title: 'Cost Analysis' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.2.0',
};
