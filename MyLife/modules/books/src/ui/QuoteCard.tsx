import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BOOKS_SURFACES, BOOKS_GHOST_BORDER } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface QuoteCardProps {
  text: string;
  author: string;
  source: string;
  coverUrl?: string;
  favorited?: boolean;
  onToggleFavorite?: () => void;
  style?: ViewStyle;
}

export function QuoteCard({
  text,
  author,
  source,
  coverUrl,
  favorited,
  onToggleFavorite,
  style,
}: QuoteCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.quote}>{`\u201C${text}\u201D`}</Text>

      <View style={styles.sourceRow}>
        {coverUrl != null && (
          <View style={styles.coverWrap}>
            <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
            <View style={styles.ghostBorder} />
          </View>
        )}
        <View style={styles.sourceText}>
          <Text style={styles.sourceTitle} numberOfLines={1}>{source}</Text>
          <Text style={styles.sourceAuthor} numberOfLines={1}>{author}</Text>
        </View>
        {onToggleFavorite != null && (
          <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.heart}>
            <Text style={styles.heartIcon}>{favorited ? '\u2764\uFE0F' : '\u2661'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    padding: 20,
  },
  quote: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 18,
    fontStyle: 'italic',
    color: '#FFB877',
    lineHeight: 28,
    marginBottom: 16,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coverWrap: {
    width: 36,
    height: 52,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cover: {
    width: 36,
    height: 52,
    borderRadius: 4,
  },
  ghostBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BOOKS_GHOST_BORDER,
  },
  sourceText: {
    flex: 1,
  },
  sourceTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  sourceAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
    marginTop: 2,
  },
  heart: {
    padding: 4,
  },
  heartIcon: {
    fontSize: 20,
  },
});
