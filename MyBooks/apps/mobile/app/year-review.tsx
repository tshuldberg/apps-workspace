import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, BookCover, Button, colors, spacing } from '@mybooks/ui';
import { mockGoal, mockBooks, mockReviews, finishedCount, mockSessions, parseAuthors } from '@/data/mock';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  'intro',
  'top-rated',
  'numbers',
  'monthly',
  'favorites',
  'export',
] as const;

type Slide = (typeof SLIDES)[number];

export default function YearReviewScreen() {
  const router = useRouter();
  const [slideIndex, setSlideIndex] = useState(0);
  const slide = SLIDES[slideIndex];
  const booksRead = finishedCount();
  const totalPages = mockSessions
    .filter((s) => s.status === 'finished')
    .reduce((sum, s) => sum + s.current_page, 0);

  const topRated = mockReviews
    .filter((r) => r.rating != null && r.rating >= 4.5)
    .map((r) => ({ review: r, book: mockBooks.find((b) => b.id === r.book_id)! }))
    .filter((item) => item.book != null);

  const goNext = () => setSlideIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  const goPrev = () => setSlideIndex((i) => Math.max(i - 1, 0));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable style={styles.container} onPress={goNext}>
        {slide === 'intro' && (
          <View style={styles.slide}>
            <Text variant="label" color={colors.accentLight}>YOUR YEAR IN BOOKS</Text>
            <Text variant="stat" style={styles.yearTitle}>{mockGoal.year}</Text>
            <Text variant="heading" color={colors.accent}>{booksRead} books read</Text>
          </View>
        )}

        {slide === 'top-rated' && (
          <View style={styles.slide}>
            <Text variant="label" color={colors.accentLight}>TOP RATED</Text>
            <View style={styles.coverRow}>
              {topRated.slice(0, 3).map(({ book }) => (
                <BookCover key={book.id} coverUrl={book.cover_url} size="medium" title={book.title} />
              ))}
            </View>
            {topRated.map(({ book, review }) => (
              <Text key={book.id} variant="caption" color={colors.textSecondary}>
                {book.title} - {review.rating} stars
              </Text>
            ))}
          </View>
        )}

        {slide === 'numbers' && (
          <View style={styles.slide}>
            <Text variant="label" color={colors.accentLight}>THE NUMBERS</Text>
            <View style={styles.numberGrid}>
              <View style={styles.numberItem}>
                <Text variant="stat" color={colors.accent}>{booksRead}</Text>
                <Text variant="caption" color={colors.textSecondary}>Books</Text>
              </View>
              <View style={styles.numberItem}>
                <Text variant="stat" color={colors.accent}>{totalPages.toLocaleString()}</Text>
                <Text variant="caption" color={colors.textSecondary}>Pages</Text>
              </View>
              <View style={styles.numberItem}>
                <Text variant="stat" color={colors.accent}>{new Set(mockBooks.map((b) => b.authors)).size}</Text>
                <Text variant="caption" color={colors.textSecondary}>Authors</Text>
              </View>
            </View>
          </View>
        )}

        {slide === 'monthly' && (
          <View style={styles.slide}>
            <Text variant="label" color={colors.accentLight}>MONTH BY MONTH</Text>
            <View style={styles.monthBars}>
              {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
                <View key={m + i} style={styles.monthCol}>
                  <View
                    style={[
                      styles.monthBar,
                      {
                        height: i < 2 ? 40 + Math.random() * 30 : 8,
                        backgroundColor: i < 2 ? colors.accent : colors.surfaceElevated,
                      },
                    ]}
                  />
                  <Text variant="caption" color={colors.textTertiary} style={{ fontSize: 10 }}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {slide === 'favorites' && (
          <View style={styles.slide}>
            <Text variant="label" color={colors.accentLight}>YOUR FAVORITES</Text>
            {mockReviews.filter((r) => r.is_favorite).map((r) => {
              const book = mockBooks.find((b) => b.id === r.book_id);
              return book ? (
                <View key={r.id} style={styles.favoriteRow}>
                  <BookCover coverUrl={book.cover_url} size="small" title={book.title} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bookTitle" style={{ fontSize: 16 }}>{book.title}</Text>
                    <Text variant="bookAuthor">{parseAuthors(book.authors).join(', ')}</Text>
                  </View>
                </View>
              ) : null;
            })}
          </View>
        )}

        {slide === 'export' && (
          <View style={styles.slide}>
            <Text variant="label" color={colors.accentLight}>SHARE YOUR YEAR</Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
              Save a summary image or export your full reading data.
            </Text>
            <Button variant="primary" label="Save as Image" onPress={() => {}} />
            <Button variant="secondary" label="Export Data (CSV)" onPress={() => {}} />
            <Button variant="ghost" label="Done" onPress={() => router.back()} />
          </View>
        )}

        {/* Slide indicators */}
        <View style={styles.indicators}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => setSlideIndex(i)}>
              <View
                style={[
                  styles.dot,
                  i === slideIndex && styles.dotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Navigation hint */}
        {slideIndex < SLIDES.length - 1 && (
          <Text variant="caption" color={colors.textTertiary} style={styles.tapHint}>
            Tap to continue
          </Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  yearTitle: {
    fontSize: 64,
  },
  coverRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  numberGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  numberItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  monthBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 80,
    marginTop: spacing.lg,
  },
  monthCol: {
    alignItems: 'center',
    gap: 2,
    width: (SCREEN_WIDTH - spacing.lg * 2 - 44) / 12,
  },
  monthBar: {
    width: '100%',
    borderRadius: 2,
  },
  favoriteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    width: '100%',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  tapHint: {
    textAlign: 'center',
    paddingBottom: spacing.lg,
  },
});
