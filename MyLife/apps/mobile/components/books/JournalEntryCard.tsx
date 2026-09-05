import { View, Image, StyleSheet, Text } from 'react-native';
import { colors } from '@mylife/ui';
import { GlassCard } from '@mylife/books/ui';
import {
  BOOKS_TYPOGRAPHY,
  BOOKS_SURFACES,
  JAKARTA_FONTS,
} from '@mylife/books';
import type { JournalEntry, Book } from '@mylife/books';

const ACCENT = colors.modules.books;

const MOOD_EMOJI: Record<string, string> = {
  reflective: '\u{1F914}',
  excited: '\u{2728}',
  sad: '\u{1F622}',
  inspired: '\u{1F31F}',
  confused: '\u{1F615}',
  peaceful: '\u{1F54A}\u{FE0F}',
  contemplative: '\u{1F9D0}',
  intrigued: '\u{1F50D}',
  thoughtful: '\u{1F4AD}',
};

interface JournalEntryCardProps {
  entry: JournalEntry;
  linkedBooks?: Book[];
  onPress: () => void;
  onLongPress?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

function parseAuthors(authors: string): string {
  try {
    const arr = JSON.parse(authors);
    return Array.isArray(arr) ? arr[0] ?? 'Unknown' : authors;
  } catch {
    return authors;
  }
}

export function JournalEntryCard({ entry, linkedBooks, onPress }: JournalEntryCardProps) {
  const isEncrypted = entry.content_encrypted === 1;
  const preview = isEncrypted ? '' : entry.content.slice(0, 150) + (entry.content.length > 150 ? '\u2026' : '');
  const moodEmoji = entry.mood ? MOOD_EMOJI[entry.mood] ?? '\u{1F4DD}' : null;
  const firstBook = linkedBooks?.[0];

  return (
    <GlassCard level={2} onPress={onPress} style={styles.card}>
      <View style={styles.dateRow}>
        {moodEmoji && <Text style={styles.moodEmoji}>{moodEmoji}</Text>}
        <Text style={styles.dateText}>{formatDate(entry.created_at)}</Text>
        {isEncrypted && <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>}
      </View>

      {entry.title && (
        <Text style={styles.title} numberOfLines={2}>{entry.title}</Text>
      )}

      {!isEncrypted && preview.length > 0 && (
        <Text style={styles.preview} numberOfLines={3}>{preview}</Text>
      )}

      {isEncrypted && !entry.title && (
        <Text style={styles.encryptedLabel}>Encrypted entry</Text>
      )}

      {firstBook && (
        <View style={styles.linkedBook}>
          {firstBook.cover_url ? (
            <Image source={{ uri: firstBook.cover_url }} style={styles.bookCover} />
          ) : (
            <View style={[styles.bookCover, styles.bookCoverPlaceholder]}>
              <Text style={styles.bookCoverEmoji}>{'\u{1F4D6}'}</Text>
            </View>
          )}
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={1}>{firstBook.title}</Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>{parseAuthors(firstBook.authors)}</Text>
          </View>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moodEmoji: {
    fontSize: 20,
  },
  dateText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: ACCENT,
    flex: 1,
  },
  lockIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  title: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  preview: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
  },
  encryptedLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: 'rgba(228,225,233,0.35)',
    fontStyle: 'italic',
  },
  linkedBook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 12,
    padding: 8,
  },
  bookCover: {
    width: 36,
    height: 52,
    borderRadius: 6,
  },
  bookCoverPlaceholder: {
    backgroundColor: BOOKS_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCoverEmoji: {
    fontSize: 16,
  },
  bookInfo: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#E4E1E9',
  },
  bookAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },
});
