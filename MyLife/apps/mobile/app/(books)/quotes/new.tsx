import { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Text as RNText,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { BookCover, colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useQuotes } from '../../../hooks/books/use-quotes';
import { useBooks } from '../../../hooks/books/use-books';
import { useSessions } from '../../../hooks/books/use-sessions';
import { icons } from 'lucide-react-native';

const ChevronDownIcon = icons.ChevronDown;
const XIcon = icons.X;
const HeartIcon = icons.Heart;

const BOOKS_ACCENT = colors.modules.books;

function parseFirstAuthor(authors: string): string {
  try {
    const parsed = JSON.parse(authors) as string[];
    return parsed[0] ?? authors;
  } catch {
    return authors;
  }
}

export default function QuoteNewScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { create } = useQuotes();
  const { books } = useBooks();
  const { sessions } = useSessions();

  const [content, setContent] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'MyBooks' });
  }, [navigation]);

  // Auto-select currently reading book
  const currentlyReading = useMemo(() => {
    const reading = sessions
      .filter((s) => s.status === 'reading')
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
    return reading[0] ?? null;
  }, [sessions]);

  useEffect(() => {
    if (!selectedBookId && currentlyReading) {
      setSelectedBookId(currentlyReading.book_id);
    }
  }, [currentlyReading, selectedBookId]);

  const selectedBook = books.find((b) => b.id === selectedBookId);

  const filteredBooks = useMemo(() => {
    if (!bookSearch.trim()) return books.slice(0, 30);
    const q = bookSearch.toLowerCase();
    return books
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.authors.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [books, bookSearch]);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
    setShowTagInput(false);
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    if (!selectedBookId || !content.trim()) return;
    create({
      book_id: selectedBookId,
      content: content.trim(),
      page_number: pageNumber ? parseInt(pageNumber, 10) : undefined,
      note: tags.length > 0 ? tags.join(', ') : undefined,
      is_favorite: isFavorite ? 1 : 0,
      source: 'manual',
    });
    router.back();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <RNText style={styles.displayTitle}>Capture Wisdom</RNText>
      <RNText style={styles.subtitle}>
        Add a new fragment to your digital collection.
      </RNText>

      {/* Quote Input Card */}
      <GlassCard level={2} style={styles.quoteCard}>
        <RNText style={styles.quoteIcon}>{'\u201D\u201D'}</RNText>
        <TextInput
          style={styles.quoteInput}
          value={content}
          onChangeText={setContent}
          placeholder="Type the words that moved you..."
          placeholderTextColor="#9F8E81"
          multiline
          textAlignVertical="top"
        />
        <Pressable
          style={styles.favoriteRow}
          onPress={() => setIsFavorite(!isFavorite)}
        >
          <RNText style={styles.favoriteLabel}>FAVORITE QUOTE</RNText>
          <HeartIcon
            size={22}
            color={isFavorite ? BOOKS_ACCENT : '#9F8E81'}
            fill={isFavorite ? BOOKS_ACCENT : 'transparent'}
          />
        </Pressable>
      </GlassCard>

      {/* Source Book */}
      <RNText style={styles.fieldLabel}>SOURCE BOOK</RNText>
      <Pressable onPress={() => setShowBookPicker(!showBookPicker)}>
        <GlassCard level={3} style={styles.bookPickerCard}>
          {selectedBook ? (
            <View style={styles.bookPickerRow}>
              <BookCover
                coverUrl={selectedBook.cover_url}
                size="small"
                title={selectedBook.title}
              />
              <View style={styles.bookPickerInfo}>
                <RNText style={styles.bookPickerTitle} numberOfLines={1}>
                  {selectedBook.title}
                </RNText>
                <RNText style={styles.bookPickerAuthor} numberOfLines={1}>
                  {parseFirstAuthor(selectedBook.authors)}
                </RNText>
              </View>
              <ChevronDownIcon size={20} color="#9F8E81" />
            </View>
          ) : (
            <View style={styles.bookPickerRow}>
              <View style={styles.bookPickerPlaceholder}>
                <RNText style={styles.bookPickerPlaceholderIcon}>
                  {'\uD83D\uDCDA'}
                </RNText>
              </View>
              <RNText style={styles.bookPickerSelectText}>
                Select a book from your library
              </RNText>
              <ChevronDownIcon size={20} color="#9F8E81" />
            </View>
          )}
        </GlassCard>
      </Pressable>

      {/* Book Picker Dropdown */}
      {showBookPicker && (
        <GlassCard level={3} style={styles.bookDropdown}>
          <TextInput
            style={styles.bookSearchInput}
            value={bookSearch}
            onChangeText={setBookSearch}
            placeholder="Search your books..."
            placeholderTextColor="#9F8E81"
          />
          {filteredBooks.map((b) => (
            <Pressable
              key={b.id}
              style={styles.bookItem}
              onPress={() => {
                setSelectedBookId(b.id);
                setShowBookPicker(false);
                setBookSearch('');
              }}
            >
              <BookCover coverUrl={b.cover_url} size="small" title={b.title} />
              <View style={styles.bookItemInfo}>
                <RNText style={styles.bookItemTitle} numberOfLines={1}>
                  {b.title}
                </RNText>
                <RNText style={styles.bookItemAuthor} numberOfLines={1}>
                  {parseFirstAuthor(b.authors)}
                </RNText>
              </View>
            </Pressable>
          ))}
        </GlassCard>
      )}

      {/* Location */}
      <RNText style={styles.fieldLabel}>LOCATION</RNText>
      <GlassCard level={3} style={styles.locationCard}>
        <View style={styles.locationRow}>
          <RNText style={styles.locationPrefix}>PG.</RNText>
          <TextInput
            style={styles.locationInput}
            value={pageNumber}
            onChangeText={setPageNumber}
            placeholder="000"
            placeholderTextColor="#9F8E81"
            keyboardType="number-pad"
          />
        </View>
      </GlassCard>

      {/* Collection Tags */}
      <RNText style={styles.fieldLabel}>COLLECTION TAGS</RNText>
      <GlassCard level={3} style={styles.tagsCard}>
        <View style={styles.tagsWrap}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <RNText style={styles.tagChipText}>{tag}</RNText>
              <Pressable onPress={() => removeTag(tag)} hitSlop={6}>
                <XIcon size={14} color="#D6C3B5" />
              </Pressable>
            </View>
          ))}
          {showTagInput ? (
            <TextInput
              style={styles.tagInput}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              onBlur={addTag}
              placeholder="Tag name..."
              placeholderTextColor="#9F8E81"
              autoFocus
              returnKeyType="done"
            />
          ) : (
            <Pressable
              style={styles.addTagBtn}
              onPress={() => setShowTagInput(true)}
            >
              <RNText style={styles.addTagText}>+ Add Tag</RNText>
            </Pressable>
          )}
        </View>
      </GlassCard>

      {/* Submit */}
      <GradientButton
        label="Curate Fragment"
        onPress={handleSave}
        disabled={!selectedBookId || !content.trim()}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    marginBottom: 24,
  },

  // Quote Input
  quoteCard: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quoteIcon: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 32,
    color: '#9F8E81',
    lineHeight: 36,
    marginBottom: 8,
  },
  quoteInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#E4E1E9',
    minHeight: 160,
    padding: 0,
    lineHeight: 24,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  favoriteLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    fontSize: 11,
  },

  // Source Book
  fieldLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#C9894D',
    marginBottom: 8,
  },
  bookPickerCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  bookPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookPickerInfo: {
    flex: 1,
    gap: 2,
  },
  bookPickerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  bookPickerAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
  },
  bookPickerPlaceholder: {
    width: 36,
    height: 52,
    borderRadius: 4,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookPickerPlaceholderIcon: {
    fontSize: 20,
  },
  bookPickerSelectText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#9F8E81',
  },

  // Book Dropdown
  bookDropdown: {
    maxHeight: 280,
    marginTop: -12,
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bookSearchInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#E4E1E9',
    backgroundColor: BOOKS_SURFACES.depth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  bookItemInfo: {
    flex: 1,
    gap: 1,
  },
  bookItemTitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#E4E1E9',
  },
  bookItemAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },

  // Location
  locationCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationPrefix: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: '#9F8E81',
  },
  locationInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#E4E1E9',
    padding: 0,
    minWidth: 60,
  },

  // Tags
  tagsCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201, 137, 77, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagChipText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
  },
  tagInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#E4E1E9',
    backgroundColor: BOOKS_SURFACES.depth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 100,
  },
  addTagBtn: {
    borderWidth: 1,
    borderColor: 'rgba(159, 142, 129, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addTagText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#9F8E81',
  },

  // Submit
  submitBtn: {
    marginTop: 4,
  },
});
