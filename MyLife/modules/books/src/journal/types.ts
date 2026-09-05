/**
 * Journal engine types.
 */

export interface JournalStats {
  totalEntries: number;
  entriesThisMonth: number;
  longestStreak: number;
  currentStreak: number;
}

export interface CreateEntryOptions {
  title?: string;
  mood?: string;
  bookIds?: string[];
  passphrase?: string;
}

export interface ExportOptions {
  entryIds?: string[];
}
