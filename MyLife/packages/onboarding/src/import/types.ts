/**
 * Import adapter interface and shared types for the "Replace My Apps" system.
 *
 * Each competitor export format gets an ImportAdapter that knows how to
 * detect, parse, validate, transform, and import data from that format
 * into a MyLife module.
 */

import type { ModuleId } from '@mylife/module-registry';

/** Phases of the import pipeline, in order. */
export type ImportPhase =
  | 'detecting'
  | 'parsing'
  | 'validating'
  | 'transforming'
  | 'importing'
  | 'complete'
  | 'failed';

/** Real-time progress updates emitted during import. */
export interface ImportProgress {
  phase: ImportPhase;
  current: number;
  total: number;
  message: string;
}

/** A single validation error for a row in the import file. */
export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

/** Result returned after an import completes (successfully or with partial failures). */
export interface ImportResult {
  /** Name of the adapter that performed the import. */
  adapterName: string;
  /** Target module the data was imported into. */
  targetModule: ModuleId;
  /** Total rows found in the source file. */
  totalRows: number;
  /** Number of rows successfully imported. */
  imported: number;
  /** Number of rows that were skipped (e.g., duplicates). */
  skipped: number;
  /** Number of rows that failed to import. */
  failed: number;
  /** Per-row error details for failures. */
  errors: ImportValidationError[];
  /** Total wall-clock duration of the import in milliseconds. */
  durationMs: number;
}

/**
 * Format detection result. An adapter returns this from detectFormat()
 * to indicate whether it can handle the given file.
 */
export interface FormatDetection {
  /** Whether this adapter can handle the file. */
  detected: boolean;
  /** Confidence level (0.0 to 1.0). Higher wins when multiple adapters detect. */
  confidence: number;
  /** Human-readable explanation of why this format was detected (or not). */
  reason: string;
}

/**
 * A generic parsed record from a source file. Each adapter defines its own
 * shape via the TRecord generic, but all records share these metadata fields.
 */
export interface ParsedRecord<T = Record<string, unknown>> {
  /** 1-indexed row number from the source file. */
  rowNumber: number;
  /** The parsed data for this row. */
  data: T;
  /** Whether this record has validation warnings (non-fatal). */
  warnings: string[];
}

/**
 * The core import adapter interface. Each competitor export format implements this.
 *
 * The pipeline runs in order: detectFormat -> parse -> validate -> transform -> import.
 * Each step can be called independently for preview/dry-run workflows.
 *
 * TSource is the shape of records after parsing the source file.
 * TTarget is the shape of records ready for database insertion.
 */
export interface ImportAdapter<
  TSource = Record<string, unknown>,
  TTarget = Record<string, unknown>,
> {
  /** Unique identifier for this adapter (e.g., "goodreads-csv", "ynab-csv"). */
  name: string;

  /** Human-readable name of the source app (e.g., "Goodreads", "YNAB"). */
  sourceApp: string;

  /** Which MyLife module this adapter imports into. */
  targetModule: ModuleId;

  /** File extensions this adapter supports (e.g., [".csv", ".tsv"]). */
  supportedExtensions: string[];

  /**
   * Detect whether this adapter can handle the given file content.
   * Should be fast (examine headers/first few lines only).
   */
  detectFormat(content: string, fileName?: string): FormatDetection;

  /**
   * Parse raw file content into structured records.
   * Does NOT validate or transform -- just extracts rows.
   */
  parse(content: string): ParsedRecord<TSource>[];

  /**
   * Validate parsed records. Returns only the records that pass validation,
   * plus an array of errors for records that don't.
   */
  validate(records: ParsedRecord<TSource>[]): {
    valid: ParsedRecord<TSource>[];
    errors: ImportValidationError[];
  };

  /**
   * Transform validated source records into the target module's insert format.
   */
  transform(records: ParsedRecord<TSource>[]): ParsedRecord<TTarget>[];

  /**
   * Import transformed records into the database.
   * The db parameter is typed as unknown to avoid coupling to a specific driver.
   */
  import(
    db: unknown,
    records: ParsedRecord<TTarget>[],
    onProgress?: (progress: ImportProgress) => void,
  ): ImportResult;
}
