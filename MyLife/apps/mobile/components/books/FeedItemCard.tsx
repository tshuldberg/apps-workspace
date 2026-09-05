import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, BookCover, colors, spacing } from '@mylife/ui';
import type { FeedItem } from '@mylife/books';

interface FeedItemCardProps {
  item: FeedItem;
  onBookPress?: (bookId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const EVENT_LABELS: Record<string, string> = {
  book_finished: 'Finished',
  book_rating: 'Rated',
  book_review: 'Reviewed',
  book_started: 'Started reading',
  book_added: 'Added to library',
};

export function FeedItemCard({ item, onBookPress }: FeedItemCardProps) {
  const label = EVENT_LABELS[item.eventType] ?? item.eventType;

  return (
    <View style={styles.card}>
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.displayName ? item.displayName.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text variant="label">{item.displayName}</Text>
          <Text variant="caption" color={colors.textTertiary}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>

      <Pressable
        style={styles.contentRow}
        onPress={() => onBookPress?.(item.id)}
        disabled={!onBookPress}
      >
        {item.bookCoverUrl && (
          <BookCover coverUrl={item.bookCoverUrl} size="small" title={item.bookTitle} />
        )}
        <View style={styles.eventInfo}>
          <Text variant="body">
            {label} <Text variant="label">{item.bookTitle}</Text>
          </Text>
          <Text variant="caption" color={colors.textSecondary}>{item.bookAuthors}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  userInfo: {
    flex: 1,
  },
  contentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
});
