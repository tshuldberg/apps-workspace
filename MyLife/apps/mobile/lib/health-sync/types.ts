import type { DatabaseAdapter } from '@mylife/db';

// --- Sync status & results ---

export interface HealthSyncStatus {
  available: boolean;
  platform: 'ios' | 'android' | 'unsupported';
  reason: string;
}

export interface HealthSyncResult {
  importedWeightEntries: number;
  exportedFasts: number;
  importedVitals: number;
  importedSleepSessions: number;
  message: string;
}

// --- Data type registry ---

export type SyncDirection = 'read' | 'write';

/**
 * Target table + column mapping for imported health data.
 * Most vitals go to hl_vitals; sleep goes to hl_sleep_sessions; weight to ft_weight_entries.
 */
export type SyncTarget =
  | { table: 'hl_vitals'; vitalType: string; unit: string }
  | { table: 'hl_sleep_sessions' }
  | { table: 'ft_weight_entries' };

export interface HealthDataTypeConfig {
  /** Unique key used in settings toggles and sync log (e.g., 'heartRate') */
  key: string;
  /** Human-readable label (e.g., 'Heart Rate') */
  label: string;
  /** Read or write */
  direction: SyncDirection;
  /** HealthKit type identifier (iOS). Null if not supported. */
  appleHealthType: string | null;
  /** Health Connect record type (Android). Null if not supported. */
  healthConnectRecordType: string | null;
  /** Where imported records are stored */
  target: SyncTarget;
  /** Default enabled state */
  defaultEnabled: boolean;
}

// --- Sync options ---

export interface SyncOptions {
  db: DatabaseAdapter;
  /** Override which data types to sync. If omitted, uses settings toggles. */
  dataTypeKeys?: string[];
  /** Override: also sync fast export regardless of settings */
  writeFasts?: boolean;
}

// --- Sync log ---

export interface SyncLogEntry {
  id: string;
  data_type: string;
  direction: string;
  synced_at: string;
  records_synced: number;
  cursor: string | null;
  error: string | null;
}

// --- Internal fast export types ---

export interface CompletedFastRow {
  id: string;
  protocol: string;
  target_hours: number;
  started_at: string;
  ended_at: string;
}
