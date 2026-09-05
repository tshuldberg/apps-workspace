import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedItem } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { atHandle, relativeTime } from '../lib/format';
import { TierBadge } from './TierBadge';

export function ArticleCard({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  // Without an explicit label a screen reader reads every child in order,
  // including the two literal middle dots used as visual separators, which it
  // announces as "middle dot". The label says the same thing in prose.
  const label = [
    item.kind === 'preprint' ? 'Preprint' : null,
    item.headline,
    item.dek,
    `by ${item.authorDisplayName}`,
    relativeTime(item.publishedAt),
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the article"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {item.kind === 'preprint' ? (
        <View style={styles.kindRow}>
          <Text style={styles.kindTag}>PREPRINT</Text>
        </View>
      ) : null}
      <Text style={styles.headline}>{item.headline}</Text>
      {item.dek ? (
        <Text style={styles.dek} numberOfLines={2}>
          {item.dek}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.author} numberOfLines={1}>
          {item.authorDisplayName}
        </Text>
        <TierBadge tier={item.authorTier} />
        <Text style={styles.dot}>·</Text>
        <Text style={styles.handle} numberOfLines={1}>
          {atHandle(item.authorHandle)}
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{relativeTime(item.publishedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 6,
  },
  pressed: {
    opacity: 0.85,
  },
  kindRow: {
    flexDirection: 'row',
  },
  kindTag: {
    color: tokens.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headline: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  dek: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  author: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '48%',
  },
  handle: {
    color: tokens.textTertiary,
    fontSize: 13,
    maxWidth: '40%',
  },
  time: {
    color: tokens.textTertiary,
    fontSize: 13,
  },
  dot: {
    color: tokens.textTertiary,
    fontSize: 13,
  },
});
