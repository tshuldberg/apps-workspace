import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArticleView } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { absoluteDate, atHandle } from '../lib/format';
import { TierBadge } from './TierBadge';

/** Author line for the article header. The handle is tappable into the journalist page. */
export function Byline({
  article,
  onPressAuthor,
}: {
  article: ArticleView;
  onPressAuthor: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.nameRow}>
        <Text style={styles.name}>{article.authorDisplayName}</Text>
        <TierBadge tier={article.authorTier} size="md" />
      </View>
      <Pressable
        onPress={onPressAuthor}
        accessibilityRole="link"
        accessibilityLabel={`${article.authorDisplayName}, ${atHandle(article.authorHandle)}`}
        accessibilityHint="Opens this journalist's profile"
      >
        <Text style={styles.handle}>{atHandle(article.authorHandle)}</Text>
      </Pressable>
      <Text style={styles.meta}>
        Revision {article.rev} · Published {absoluteDate(article.publishedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    paddingVertical: 12,
    borderTopColor: tokens.border,
    borderBottomColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  handle: {
    color: tokens.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    color: tokens.textTertiary,
    fontSize: 13,
  },
});
