import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Text, BookCover, StarRating, ShelfBadge, TagPill, Button, Card,
  colors, spacing,
} from '@mybooks/ui';
import { ProgressSlider } from '@/components/ProgressSlider';
import { mockBooks, mockTags, getSession, getReview, parseAuthors } from '@/data/mock';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const book = mockBooks.find((b) => b.id === id);
  const session = book ? getSession(book.id) : undefined;
  const review = book ? getReview(book.id) : undefined;

  const [rating, setRating] = useState(review?.rating ?? 0);
  const [reviewText, setReviewText] = useState(review?.review_text ?? '');

  if (!book) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color={colors.textTertiary}>Book not found.</Text>
      </View>
    );
  }

  const authors = parseAuthors(book.authors);
  const subjects = book.subjects ? JSON.parse(book.subjects) as string[] : [];
  const shelfLabel =
    session?.status === 'reading' ? 'Currently Reading' :
    session?.status === 'finished' ? 'Finished' :
    session?.status === 'dnf' ? 'Did Not Finish' :
    'Want to Read';
  const shelfColor =
    session?.status === 'reading' ? colors.reading :
    session?.status === 'finished' ? colors.finished :
    session?.status === 'dnf' ? colors.dnf :
    colors.tbr;

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Cover hero */}
        <View style={styles.coverHero}>
          <BookCover coverUrl={book.cover_url} size="detail" title={book.title} />
        </View>

        {/* Title & Author */}
        <View style={styles.titleSection}>
          <Text variant="bookTitle" style={styles.title}>{book.title}</Text>
          <Text variant="bookAuthor">{authors.join(', ')}</Text>
        </View>

        {/* Shelf badge */}
        <View style={styles.badgeRow}>
          <ShelfBadge name={shelfLabel} color={shelfColor} />
        </View>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text variant="label" color={colors.textTertiary}>Your Rating</Text>
          <StarRating rating={rating} onChange={setRating} size={32} />
        </View>

        {/* Reading progress */}
        {session?.status === 'reading' && book.page_count && (
          <Card style={styles.progressCard}>
            <Text variant="label" color={colors.textTertiary}>Reading Progress</Text>
            <ProgressSlider
              currentPage={session.current_page}
              totalPages={book.page_count}
              onPageChange={() => {}}
            />
          </Card>
        )}

        {/* Metadata */}
        <Card style={styles.metaCard}>
          <Text variant="label" color={colors.textTertiary}>Details</Text>
          {book.publisher && <MetaRow label="Publisher" value={book.publisher} />}
          {book.publish_year && <MetaRow label="Year" value={String(book.publish_year)} />}
          {book.page_count && <MetaRow label="Pages" value={String(book.page_count)} />}
          {book.isbn_13 && <MetaRow label="ISBN" value={book.isbn_13} />}
          <MetaRow label="Format" value={book.format} />
        </Card>

        {/* Review / Notes */}
        <Card style={styles.reviewCard}>
          <Text variant="label" color={colors.textTertiary}>Notes & Review</Text>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Write your thoughts..."
            placeholderTextColor={colors.textTertiary}
            multiline
            style={styles.reviewInput}
          />
        </Card>

        {/* Tags */}
        <View style={styles.tagSection}>
          <Text variant="label" color={colors.textTertiary}>Tags</Text>
          <View style={styles.tagRow}>
            {subjects.slice(0, 3).map((s) => (
              <TagPill key={s} name={s} color={colors.tagDefault} />
            ))}
            {mockTags.slice(0, 2).map((t) => (
              <TagPill key={t.id} name={t.name} color={t.color ?? undefined} onRemove={() => {}} />
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button variant="secondary" label="Move to Shelf" onPress={() => {}} />
          <Button variant="ghost" label="Delete from Library" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="caption" color={colors.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverHero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  badgeRow: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  ratingSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  progressCard: {
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  metaCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reviewCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  reviewInput: {
    color: colors.text,
    fontFamily: 'Literata',
    fontSize: 16,
    lineHeight: 28,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  tagSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actions: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
