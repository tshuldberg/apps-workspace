import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Alert, Image, Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, LoadingState, ErrorState } from '@mylife/ui';
import { GlassCard } from '@mylife/books/ui';
import {
  BOOKS_TYPOGRAPHY,
  BOOKS_SURFACES,
  JAKARTA_FONTS,
  BOOKS_CTA_GRADIENT,
} from '@mylife/books';
import type { Book } from '@mylife/books';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from 'lucide-react-native';
import { useJournal } from '../../../hooks/books/use-journal';

const ACCENT = colors.modules.books;
const ShareIcon = icons.Share2;
const HeartIcon = icons.Heart;

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function parseAuthors(authors: string): string {
  try {
    const arr = JSON.parse(authors);
    return Array.isArray(arr) ? arr[0] ?? 'Unknown' : authors;
  } catch {
    return authors;
  }
}

function renderContent(text: string) {
  const blocks = text.split('\n\n');
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Block quote detection
    if (trimmed.startsWith('>') || trimmed.startsWith('\u201C')) {
      const quoteText = trimmed.replace(/^>\s*/gm, '').replace(/^\u201C|\u201D$/g, '');
      return (
        <View key={i} style={styles.blockQuote}>
          <Text style={styles.blockQuoteText}>{quoteText}</Text>
        </View>
      );
    }

    // Heading detection (## or bold **)
    if (trimmed.startsWith('## ') || trimmed.startsWith('**')) {
      const headingText = trimmed.replace(/^##\s*/, '').replace(/^\*\*|\*\*$/g, '');
      return (
        <Text key={i} style={styles.contentHeading}>{headingText}</Text>
      );
    }

    return (
      <Text key={i} style={styles.contentBody}>{trimmed}</Text>
    );
  });
}

export default function JournalEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { decrypt, remove, exportMarkdown, linkedBooks } = useJournal();
  const [entry, setEntry] = useState<{
    title: string | null;
    content: string;
    mood: string | null;
    decryptedContent?: string;
    content_encrypted: number;
    created_at: string;
    word_count: number;
    is_favorite: number;
  } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const result = await decrypt(id);
      if (result) {
        if (result.content_encrypted === 1 && !result.decryptedContent) {
          setNeedsPassphrase(true);
          setEntry(result);
        } else {
          setEntry(result);
          setNeedsPassphrase(false);
        }
        setBooks(linkedBooks(id));
      }
      setLoading(false);
    })();
  }, [id, decrypt, linkedBooks]);

  const handleUnlock = async () => {
    if (!id || !passphrase) return;
    const result = await decrypt(id, passphrase);
    if (result) {
      setEntry(result);
      setNeedsPassphrase(!result.decryptedContent && result.content_encrypted === 1);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove(id);
          router.back();
        },
      },
    ]);
  };

  const handleExport = () => {
    if (!id) return;
    exportMarkdown([id]);
    Alert.alert('Exported', 'Journal entry exported to markdown.');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState rows={3} />
      </View>
    );
  }

  if (needsPassphrase) {
    return (
      <View style={styles.passphraseContainer}>
        <View style={styles.lockBadge}>
          <Text style={styles.lockEmoji}>{'\u{1F512}'}</Text>
        </View>
        <Text style={styles.passphraseTitle}>Encrypted Entry</Text>
        <Text style={styles.passphraseSubtitle}>
          Enter your passphrase to decrypt this entry
        </Text>
        <TextInput
          style={styles.passphraseInput}
          value={passphrase}
          onChangeText={setPassphrase}
          placeholder="Passphrase"
          placeholderTextColor="rgba(228,225,233,0.35)"
          secureTextEntry
        />
        <Pressable onPress={handleUnlock} style={styles.unlockButton}>
          <LinearGradient
            colors={[BOOKS_CTA_GRADIENT.from, BOOKS_CTA_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.unlockGradient}
          >
            <Text style={styles.unlockText}>Unlock</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.loadingContainer}>
        <ErrorState message="Entry not found." />
      </View>
    );
  }

  const displayContent = entry.decryptedContent ?? entry.content;
  const isDecrypted = entry.content_encrypted === 1 && !!entry.decryptedContent;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status badges */}
        <View style={styles.badgeRow}>
          {entry.mood && (
            <View style={styles.moodBadge}>
              <Text style={styles.moodText}>
                {MOOD_EMOJI[entry.mood] ?? ''} {entry.mood.toUpperCase()}
              </Text>
            </View>
          )}
          {isDecrypted && (
            <View style={styles.decryptedBadge}>
              <Text style={styles.decryptedBadgeIcon}>{'\u{1F512}'}</Text>
              <Text style={styles.decryptedText}>DECRYPTED</Text>
            </View>
          )}
        </View>

        {/* Date */}
        <Text style={styles.dateText}>{formatDate(entry.created_at)}</Text>

        {/* Title */}
        {entry.title && (
          <Text style={styles.entryTitle}>{entry.title}</Text>
        )}

        {/* Author / Curator line */}
        <View style={styles.curatorRow}>
          <View style={styles.curatorAvatar}>
            <Text style={styles.curatorAvatarText}>{'\u{1F4DA}'}</Text>
          </View>
          <View>
            <Text style={styles.curatorName}>MyBooks</Text>
            <Text style={styles.curatorMeta}>
              {entry.content_encrypted === 1 ? 'Encrypted' : 'Personal'} Thought #{entry.word_count}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentSection}>
          {renderContent(displayContent)}
        </View>

        {/* Linked Books */}
        {books.length > 0 && (
          <View style={styles.linkedBooksSection}>
            <Text style={styles.linkedBooksLabel}>LINKED FROM LIBRARY</Text>
            {books.map((book, idx) => {
              const statusLabels = ['CURRENTLY READING', 'REFERENCE', 'ARCHIVED'];
              const statusLabel = statusLabels[idx % statusLabels.length];
              return (
                <GlassCard key={book.id} level={2} style={styles.linkedBookCard}>
                  <View style={styles.linkedBookRow}>
                    {book.cover_url ? (
                      <Image source={{ uri: book.cover_url }} style={styles.linkedBookCover} />
                    ) : (
                      <View style={[styles.linkedBookCover, styles.linkedBookCoverPlaceholder]}>
                        <Text style={styles.linkedBookEmoji}>{'\u{1F4D6}'}</Text>
                      </View>
                    )}
                    <View style={styles.linkedBookInfo}>
                      <Text style={styles.linkedBookStatus}>{statusLabel}</Text>
                      <Text style={styles.linkedBookTitle} numberOfLines={1}>{book.title}</Text>
                      <Text style={styles.linkedBookAuthor} numberOfLines={1}>{parseAuthors(book.authors)}</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <Pressable style={styles.actionButton} hitSlop={8}>
            <HeartIcon size={18} color="#D6C3B5" />
            <Text style={styles.actionCount}>{entry.is_favorite ? '1' : '0'}</Text>
          </Pressable>
          <Pressable style={styles.actionButton} hitSlop={8} onPress={handleExport}>
            <ShareIcon size={18} color="#D6C3B5" />
            <Text style={styles.actionLabel}>Export</Text>
          </Pressable>
        </View>
        <Pressable onPress={handleDelete}>
          <LinearGradient
            colors={[BOOKS_CTA_GRADIENT.from, BOOKS_CTA_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit Entry</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Passphrase unlock screen
  passphraseContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockEmoji: {
    fontSize: 28,
  },
  passphraseTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  passphraseSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    textAlign: 'center',
  },
  passphraseInput: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 12,
    padding: 14,
    color: '#E4E1E9',
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    width: '100%',
  },
  unlockButton: {
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  unlockGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 999,
  },
  unlockText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#1a1008',
  },
  // Badge row
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  moodBadge: {
    backgroundColor: `${ACCENT}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  moodText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: ACCENT,
    fontSize: 10,
  },
  decryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  decryptedBadgeIcon: {
    fontSize: 10,
  },
  decryptedText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 10,
  },
  // Date & title
  dateText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    marginBottom: 8,
  },
  entryTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginBottom: 16,
  },
  // Curator row
  curatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  curatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curatorAvatarText: {
    fontSize: 18,
  },
  curatorName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  curatorMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },
  // Content
  contentSection: {
    gap: 16,
    marginBottom: 32,
  },
  contentBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    lineHeight: 26,
    color: '#E4E1E9',
  },
  contentHeading: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    color: ACCENT,
    marginTop: 8,
  },
  blockQuote: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingLeft: 16,
    paddingVertical: 8,
    marginVertical: 4,
  },
  blockQuoteText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    lineHeight: 26,
    color: '#D6C3B5',
    fontStyle: 'italic',
  },
  // Linked books
  linkedBooksSection: {
    gap: 10,
    marginTop: 8,
  },
  linkedBooksLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    marginBottom: 4,
  },
  linkedBookCard: {
    padding: 12,
  },
  linkedBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkedBookCover: {
    width: 44,
    height: 64,
    borderRadius: 6,
  },
  linkedBookCoverPlaceholder: {
    backgroundColor: BOOKS_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedBookEmoji: {
    fontSize: 18,
  },
  linkedBookInfo: {
    flex: 1,
    gap: 2,
  },
  linkedBookStatus: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: ACCENT,
    fontSize: 9,
    marginBottom: 2,
  },
  linkedBookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  linkedBookAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },
  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BOOKS_SURFACES.depth,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 28,
    borderTopWidth: 0,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },
  actionLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },
  editButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  editButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#1a1008',
  },
});
