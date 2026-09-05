// Journal engine exports
export {
  createEntry,
  getDecryptedEntry,
  getReflectionsForBook,
  getJournalStats,
  exportJournalToMarkdown,
  countWords,
} from './journal-engine';

export {
  deriveKey,
  encryptContent,
  decryptContent,
} from './encryption';

export type {
  JournalStats,
  CreateEntryOptions,
  ExportOptions,
} from './types';
