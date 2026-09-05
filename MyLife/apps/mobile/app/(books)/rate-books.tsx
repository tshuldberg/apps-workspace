import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, BookCover, StarRating, Button, colors, spacing } from '@mylife/ui';
import { useBooks } from '../../hooks/books/use-books';
import { useReviews } from '../../hooks/books/use-reviews';
import { useDatabase } from '../../components/DatabaseProvider';
import { createReview as dbCreateReview } from '@mylife/books';
import { uuid } from '../../lib/uuid';

const BOOKS_ACCENT = colors.modules.books;

export default function RateBooksScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { books } = useBooks();
  const { reviews } = useReviews();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rated, setRated] = useState(0);

  const unratedBooks = useMemo(() => {
    const reviewedBookIds = new Set(reviews.map((r) => r.book_id));
    return books.filter((b) => !reviewedBookIds.has(b.id));
  }, [books, reviews]);

  const currentBook = unratedBooks[currentIndex];

  const handleRate = useCallback(
    (rating: number) => {
      if (!currentBook) return;
      dbCreateReview(db, uuid(), { book_id: currentBook.id, rating, review_text: null });
      setRated((prev) => prev + 1);
      setCurrentIndex((prev) => prev + 1);
    },
    [currentBook, db],
  );

  const handleSkip = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  if (unratedBooks.length === 0 || currentIndex >= unratedBooks.length) {
    return (
      <View style={styles.container}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneIcon}>✅</Text>
          <Text variant="heading" style={styles.doneTitle}>
            {rated > 0 ? `${rated} books rated!` : 'No unrated books'}
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.doneText}>
            {rated > 0
              ? 'Your recommendations will improve based on these ratings.'
              : 'Add more books to your library to rate them.'}
          </Text>
          <Button variant="primary" label="Done" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const remaining = unratedBooks.length - currentIndex;
  const coverUrl = currentBook.cover_url ?? null;

  function parseAuthors(authors: string): string {
    try {
      return (JSON.parse(authors) as string[]).join(', ') || 'Unknown Author';
    } catch {
      return authors || 'Unknown Author';
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="caption" color={colors.textSecondary}>
          {rated} rated · {remaining} remaining
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text variant="caption" color={BOOKS_ACCENT}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.cardContainer}>
        <BookCover coverUrl={coverUrl} size="detail" title={currentBook.title} />
        <Text variant="body" style={styles.bookTitle} numberOfLines={2}>
          {currentBook.title}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {parseAuthors(currentBook.authors)}
        </Text>

        <View style={styles.ratingContainer}>
          <Text variant="caption" color={colors.textSecondary}>Rate this book</Text>
          <StarRating
            rating={0}
            size={40}
            onChange={handleRate}
          />
        </View>

        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text variant="caption" color={colors.textSecondary}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  bookTitle: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  ratingContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  skipButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  doneIcon: { fontSize: 64 },
  doneTitle: { textAlign: 'center' },
  doneText: { textAlign: 'center', maxWidth: 280 },
});
