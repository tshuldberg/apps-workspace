/**
 * Journal engine -- higher-level operations for journal entries (hub variant with bk_ prefix).
 *
 * NOTE: Voice-to-journal (Whisper) is DEFERRED. On-device Whisper likely
 * requires native code beyond Expo capabilities. Do not implement voice
 * features in this module.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { JournalEntry } from '../models/schemas';
import {
  createJournalEntry,
  getJournalEntry,
  getJournalEntryCount,
} from '../db/journal-entries';
import {
  linkJournalToBook,
  getJournalEntriesForBook,
  getLinkedBooks,
} from '../db/journal-book-links';
import { encryptContent, decryptContent } from './encryption';
import type { JournalStats, CreateEntryOptions } from './types';

export function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function createEntry(
  db: DatabaseAdapter,
  content: string,
  options?: CreateEntryOptions,
): Promise<JournalEntry> {
  const id = crypto.randomUUID();
  const wordCount = countWords(content);

  let finalContent = content;
  let contentEncrypted = 0;
  let encryptionSalt: string | null = null;
  let encryptionIv: string | null = null;

  if (options?.passphrase) {
    const result = await encryptContent(content, options.passphrase);
    finalContent = result.encrypted;
    contentEncrypted = 1;
    encryptionSalt = result.salt;
    encryptionIv = result.iv;
  }

  const entry = createJournalEntry(db, id, {
    content: finalContent,
    title: options?.title,
    mood: options?.mood,
    word_count: wordCount,
    content_encrypted: contentEncrypted,
    encryption_salt: encryptionSalt,
    encryption_iv: encryptionIv,
  });

  if (options?.bookIds) {
    for (const bookId of options.bookIds) {
      linkJournalToBook(db, id, bookId);
    }
  }

  return entry;
}

export async function getDecryptedEntry(
  db: DatabaseAdapter,
  entryId: string,
  passphrase?: string,
): Promise<(JournalEntry & { decryptedContent?: string }) | null> {
  const entry = getJournalEntry(db, entryId);
  if (!entry) return null;

  if (
    entry.content_encrypted === 1 &&
    passphrase &&
    entry.encryption_salt &&
    entry.encryption_iv
  ) {
    const decrypted = await decryptContent(
      entry.content,
      passphrase,
      entry.encryption_salt,
      entry.encryption_iv,
    );
    return { ...entry, decryptedContent: decrypted };
  }

  return entry;
}

export function getReflectionsForBook(
  db: DatabaseAdapter,
  bookId: string,
): JournalEntry[] {
  return getJournalEntriesForBook(db, bookId);
}

export function getJournalStats(db: DatabaseAdapter): JournalStats {
  const totalEntries = getJournalEntryCount(db);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_journal_entries WHERE created_at >= ?`,
    [monthStart],
  );
  const entriesThisMonth = monthRows[0]?.count ?? 0;

  const dateRows = db.query<{ entry_date: string }>(
    `SELECT DISTINCT date(created_at) as entry_date FROM bk_journal_entries ORDER BY entry_date ASC`,
  );

  const { longestStreak, currentStreak } = calculateStreaks(
    dateRows.map((r) => r.entry_date),
  );

  return { totalEntries, entriesThisMonth, longestStreak, currentStreak };
}

function calculateStreaks(
  sortedDates: string[],
): { longestStreak: number; currentStreak: number } {
  if (sortedDates.length === 0) {
    return { longestStreak: 0, currentStreak: 0 };
  }

  let longestStreak = 1;
  let runStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      runStreak++;
    } else {
      runStreak = 1;
    }

    if (runStreak > longestStreak) {
      longestStreak = runStreak;
    }
  }

  // Current streak: count backwards from today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let currentStreak: number;
  const lastDate = sortedDates[sortedDates.length - 1];
  if (lastDate !== todayStr && lastDate !== yesterdayStr) {
    currentStreak = 0;
  } else {
    currentStreak = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const curr = new Date(sortedDates[i + 1]);
      const prev = new Date(sortedDates[i]);
      const diffMs = curr.getTime() - prev.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { longestStreak, currentStreak };
}

export function exportJournalToMarkdown(
  db: DatabaseAdapter,
  entryIds?: string[],
): string {
  let entries: JournalEntry[];

  if (entryIds && entryIds.length > 0) {
    const placeholders = entryIds.map(() => '?').join(', ');
    entries = db.query<JournalEntry>(
      `SELECT * FROM bk_journal_entries WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
      entryIds,
    );
  } else {
    entries = db.query<JournalEntry>(
      `SELECT * FROM bk_journal_entries ORDER BY created_at DESC`,
    );
  }

  const parts: string[] = [];

  for (const entry of entries) {
    const linkedBooks = getLinkedBooks(db, entry.id);
    const bookTitles = linkedBooks.map((b) => b.title);

    const frontmatter: string[] = ['---'];
    frontmatter.push(`date: ${entry.created_at}`);
    if (entry.mood) frontmatter.push(`mood: ${entry.mood}`);
    if (bookTitles.length > 0) {
      frontmatter.push(`books:`);
      for (const title of bookTitles) {
        frontmatter.push(`  - "${title}"`);
      }
    }
    if (entry.word_count > 0) frontmatter.push(`word_count: ${entry.word_count}`);
    if (entry.is_favorite) frontmatter.push(`favorite: true`);
    frontmatter.push('---');
    frontmatter.push('');

    if (entry.title) {
      parts.push(frontmatter.join('\n') + `# ${entry.title}\n\n${entry.content}`);
    } else {
      parts.push(frontmatter.join('\n') + entry.content);
    }
  }

  return parts.join('\n\n---\n\n');
}
