import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, ReadingGoalRing, BookCover, StarRating, colors, spacing } from '@mybooks/ui';
import { CurrentlyReading } from '@/components/CurrentlyReading';
import { mockGoal, recentlyFinished, finishedCount, parseAuthors } from '@/data/mock';

export default function HomeScreen() {
  const router = useRouter();
  const finished = recentlyFinished();
  const booksRead = finishedCount();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Reading Goal */}
      <View style={styles.goalSection}>
        <ReadingGoalRing
          current={booksRead}
          target={mockGoal.target_books}
          size={140}
          label={`of ${mockGoal.target_books} books`}
        />
        <Text variant="subheading" style={styles.goalLabel}>
          {mockGoal.year} Reading Goal
        </Text>
      </View>

      {/* Currently Reading */}
      <View style={styles.section}>
        <Text variant="subheading">Currently Reading</Text>
        <CurrentlyReading />
      </View>

      {/* Recently Finished */}
      <View style={styles.section}>
        <Text variant="subheading">Recently Finished</Text>
        {finished.map(({ book, review }) => (
          <Pressable
            key={book.id}
            style={styles.finishedRow}
            onPress={() => router.push(`/book/${book.id}`)}
          >
            <BookCover coverUrl={book.cover_url} size="small" title={book.title} />
            <View style={styles.finishedInfo}>
              <Text variant="bookTitle" numberOfLines={1} style={{ fontSize: 16 }}>
                {book.title}
              </Text>
              <Text variant="bookAuthor" numberOfLines={1}>
                {parseAuthors(book.authors).join(', ')}
              </Text>
              {review?.rating != null && (
                <StarRating rating={review.rating} size={14} readonly />
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  goalSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  goalLabel: {
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  finishedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  finishedInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
});
