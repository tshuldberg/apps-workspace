import React from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BookCover, Text, colors, spacing } from '@mybooks/ui';
import { currentlyReading, parseAuthors } from '@/data/mock';

export function CurrentlyReading() {
  const router = useRouter();
  const items = currentlyReading();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="body" color={colors.textTertiary}>
          Not reading anything yet. Search or scan to add your first book.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {items.map(({ book, session }) => {
        const progress = book.page_count
          ? Math.round((session.current_page / book.page_count) * 100)
          : 0;

        return (
          <Pressable
            key={book.id}
            style={styles.card}
            onPress={() => router.push(`/book/${book.id}`)}
          >
            <BookCover coverUrl={book.cover_url} size="large" title={book.title} />
            <Text variant="caption" numberOfLines={1} style={styles.title}>
              {book.title}
            </Text>
            <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {parseAuthors(book.authors)[0]}
            </Text>
            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text variant="caption" color={colors.textTertiary}>
              {session.current_page}{book.page_count ? ` / ${book.page_count}` : ''} - {progress}%
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  card: {
    width: 160,
    gap: spacing.xs,
  },
  title: {
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.reading,
    borderRadius: 2,
  },
});
