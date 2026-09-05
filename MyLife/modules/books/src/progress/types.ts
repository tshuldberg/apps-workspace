/**
 * Types for the progress engine.
 */

export interface ReadingSpeed {
  averagePagesPerHour: number;
  totalReadingTimeMs: number;
  totalPagesRead: number;
}

export interface ProgressTimelineEntry {
  date: string;
  page: number;
  percent: number;
}
