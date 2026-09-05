import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  JAKARTA_FONTS,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  BOOKS_GHOST_BORDER,
} from '@mylife/books/ui';
import { useOpenLibrarySearch } from '../../../hooks/books/use-search';
import { useBooks } from '../../../hooks/books/use-books';
import { useShelves } from '../../../hooks/books/use-shelves';
import { olSearchDocToBook, addBookToShelf, type OLSearchDoc } from '@mylife/books';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getBooksSettings, resolvePreferredShelf } from '../../../lib/books/settings';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const SearchIcon = icons.Search;
const CameraIcon = icons.Camera;
const BookOpenIcon = icons.BookOpen;

function parseAuthors(doc: OLSearchDoc): string {
  return (doc.author_name ?? []).join(', ') || 'Unknown Author';
}

function parseYear(doc: OLSearchDoc): string {
  return doc.first_publish_year ? `${doc.first_publish_year}` : '';
}

function getDescription(doc: OLSearchDoc): string {
  return doc.subtitle ?? '';
}

export default function AddBookScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [query, setQuery] = useState('');
  const [addingKeys, setAddingKeys] = useState<Record<string, boolean>>({});

  const { results, loading } = useOpenLibrarySearch(query);
  const { create } = useBooks();
  const { shelves } = useShelves();
  const getCoverUrl = useCallback(
    (doc: OLSearchDoc): string | null => {
      if (doc.cover_edition_key) {
        return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
      }
      if (doc.isbn?.[0]) {
        return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
      }
      return null;
    },
    [],
  );

  const handleAddFromSearch = useCallback(
    (doc: OLSearchDoc) => {
      if (addingKeys[doc.key]) return;
      setAddingKeys((current) => ({ ...current, [doc.key]: true }));
      try {
        const bookInsert = olSearchDocToBook(doc);
        const book = create(bookInsert);
        const settings = getBooksSettings(db);
        const preferredShelf = resolvePreferredShelf(shelves, settings.defaultShelfSlug);
        if (preferredShelf) {
          addBookToShelf(db, book.id, preferredShelf.id);
        }
        router.push(`/(books)/book/${book.id}`);
      } finally {
        setAddingKeys((current) => {
          const next = { ...current };
          delete next[doc.key];
          return next;
        });
      }
    },
    [addingKeys, create, shelves, db, router],
  );

  const hasResults = results.length > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>{'\uD83D\uDCDA'}</Text>
            </View>
            <Text style={styles.headerTitle}>The Curator</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => router.push('/(books)/settings' as any)}>
            <BookOpenIcon size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Display Title */}
          <Text style={styles.displayTitle}>
            Expand your{'\n'}collection
          </Text>
          <Text style={styles.subtitle}>
            Search the Open Library archives or scan a physical copy to add to your personal digital sanctuary.
          </Text>

          {/* Search Bar */}
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <SearchIcon size={18} color="#9F8E81" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Title, author or ISBN"
                placeholderTextColor="#9F8E81"
                style={styles.searchInput}
              />
            </View>
          </View>

          {/* Scan Cover Button */}
          <Pressable
            style={styles.scanButton}
            onPress={() => router.push('/(books)/scan')}
          >
            <CameraIcon size={16} color="#D6C3B5" />
            <Text style={styles.scanButtonText}>Scan Cover</Text>
          </Pressable>

          {/* Loading */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BOOKS_ACCENT} />
              <Text style={styles.loadingText}>Searching archives...</Text>
            </View>
          )}

          {/* Results Header */}
          {hasResults && !loading && (
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsLabel}>
                FOUND IN ARCHIVES
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{results.length}</Text>
              </View>
              <View style={styles.libraryBadge}>
                <Text style={styles.libraryBadgeText}>PARALLELLIBRARY</Text>
              </View>
            </View>
          )}

          {/* Result Cards */}
          {hasResults && !loading && results.map((doc) => {
            const coverUrl = getCoverUrl(doc);
            const authorText = parseAuthors(doc);
            const yearText = parseYear(doc);
            const description = getDescription(doc);

            return (
              <GlassCard key={doc.key} level={1} style={styles.resultCard}>
                {/* Large Cover */}
                {coverUrl && (
                  <View style={styles.coverContainer}>
                    <Image
                      source={{ uri: coverUrl }}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                    <View style={styles.coverGhostBorder} />
                  </View>
                )}

                {/* Book Info */}
                <Text style={styles.bookTitle} numberOfLines={2}>
                  {doc.title}
                </Text>
                <Text style={styles.bookAuthor} numberOfLines={1}>
                  {authorText}
                  {yearText ? ` \u2022 ${yearText}` : ''}
                </Text>

                {description ? (
                  <Text style={styles.bookDescription} numberOfLines={3}>
                    {description}
                  </Text>
                ) : null}

                <GradientButton
                  label={addingKeys[doc.key] ? 'Adding...' : 'Add to Library'}
                  onPress={() => handleAddFromSearch(doc)}
                  disabled={addingKeys[doc.key]}
                  style={styles.addButton}
                />
              </GlassCard>
            );
          })}

          {/* Empty state before search */}
          {!loading && !hasResults && query.length < 2 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{'\uD83D\uDD0D'}</Text>
              <Text style={styles.emptyText}>
                Enter a title, author, or ISBN to search the archives.
              </Text>
            </View>
          )}

          {/* No results */}
          {!loading && !hasResults && query.length >= 2 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{'\uD83D\uDCED'}</Text>
              <Text style={styles.emptyText}>
                No results for "{query}".
              </Text>
            </View>
          )}

          {/* Discover more */}
          {hasResults && !loading && (
            <Pressable style={styles.discoverMore}>
              <Text style={styles.discoverMoreText}>DISCOVER MORE ARCHIVES</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 18,
    color: '#E4E1E9',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.02 * 36,
    color: '#E4E1E9',
    marginTop: 16,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#9F8E81',
    marginBottom: 24,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
  },
  searchInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#E4E1E9',
    flex: 1,
    padding: 0,
    margin: 0,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 28,
  },
  scanButtonText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#9F8E81',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  resultsLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
  },
  countBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: '#E4E1E9',
  },
  libraryBadge: {
    marginLeft: 'auto',
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  libraryBadgeText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: '#C9894D',
    textTransform: 'uppercase',
  },
  resultCard: {
    marginBottom: 20,
    padding: 0,
    overflow: 'hidden',
    borderRadius: 16,
  },
  coverContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGhostBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: BOOKS_GHOST_BORDER,
  },
  bookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  bookAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  bookDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#9F8E81',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  addButton: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#9F8E81',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  discoverMore: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  discoverMoreText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
  },
});
