/**
 * Deduplication engine for multi-app aggregation.
 * Detects duplicates and conflicts when importing health data from external sources.
 */

import type { DedupResult, ImportSummary } from '../types';

const DEDUP_WINDOW_MS = 60_000; // 1 minute

export interface ExistingRecord {
  vital_type: string;
  recorded_at: string;
  value: number;
}

export interface IncomingRecord {
  vital_type: string;
  recorded_at: string;
  value: number;
}

/**
 * Check if an incoming record is a duplicate or conflict against existing records.
 * - Same type + timestamp within 1 min + same value = duplicate (skip)
 * - Same type + timestamp within 1 min + different value = conflict
 */
export function checkDuplicate(
  incoming: IncomingRecord,
  existing: ExistingRecord[],
): DedupResult {
  const incomingTime = new Date(incoming.recorded_at).getTime();

  for (const record of existing) {
    if (record.vital_type !== incoming.vital_type) continue;
    const existingTime = new Date(record.recorded_at).getTime();
    const timeDiff = Math.abs(incomingTime - existingTime);

    if (timeDiff <= DEDUP_WINDOW_MS) {
      if (record.value === incoming.value) {
        return { isDuplicate: true, isConflict: false };
      }
      return { isDuplicate: false, isConflict: true };
    }
  }

  return { isDuplicate: false, isConflict: false };
}

/**
 * Process a batch of incoming records against existing data.
 */
export function deduplicateBatch(
  incoming: IncomingRecord[],
  existing: ExistingRecord[],
): { toInsert: IncomingRecord[]; skipped: number; conflicted: number } {
  const toInsert: IncomingRecord[] = [];
  let skipped = 0;
  let conflicted = 0;

  for (const record of incoming) {
    const result = checkDuplicate(record, existing);
    if (result.isDuplicate) {
      skipped++;
    } else if (result.isConflict) {
      conflicted++;
      // For conflicts, default to preferring newest source (insert anyway)
      toInsert.push(record);
    } else {
      toInsert.push(record);
    }
  }

  return { toInsert, skipped, conflicted };
}

/**
 * Parse a simple CSV string into records.
 * Expected columns: vital_type, recorded_at, value
 */
export function parseCsvRecords(
  csv: string,
  columnMap?: { type: number; timestamp: number; value: number },
): IncomingRecord[] {
  const lines = csv.trim().split('\n');
  if (lines.length <= 1) return [];

  const map = columnMap ?? { type: 0, timestamp: 1, value: 2 };
  const records: IncomingRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const vitalType = cols[map.type];
    const recordedAt = cols[map.timestamp];
    const value = parseFloat(cols[map.value]);

    if (vitalType && recordedAt && !isNaN(value)) {
      records.push({ vital_type: vitalType, recorded_at: recordedAt, value });
    }
  }

  return records;
}

/**
 * Build an import summary from processed results.
 */
export function buildImportSummary(
  sourceName: string,
  imported: number,
  skipped: number,
  conflicted: number,
): ImportSummary {
  return { sourceName, imported, skipped, conflicted };
}
