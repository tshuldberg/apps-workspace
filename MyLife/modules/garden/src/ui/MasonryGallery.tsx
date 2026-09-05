import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_SURFACES, GARDEN_TYPOGRAPHY } from './tokens';

interface MasonryItem {
  uri: string;
  title?: string;
  date?: string;
  featured?: boolean;
  onPress?: () => void;
}

interface MasonryGalleryProps {
  items: MasonryItem[];
  columns?: number;
  gap?: number;
}

export function MasonryGallery({
  items,
  columns = 2,
  gap = 10,
}: MasonryGalleryProps) {
  // Distribute items into columns, featured items span both columns as full-width rows
  const rows: Array<{ kind: 'featured'; item: MasonryItem } | { kind: 'cols'; cols: MasonryItem[][] }> = [];
  let currentCols: MasonryItem[][] = Array.from({ length: columns }, () => []);
  let smallestCol = 0;

  const flushCols = () => {
    const hasAny = currentCols.some((c) => c.length > 0);
    if (hasAny) {
      rows.push({ kind: 'cols', cols: currentCols });
      currentCols = Array.from({ length: columns }, () => []);
      smallestCol = 0;
    }
  };

  for (const item of items) {
    if (item.featured === true) {
      flushCols();
      rows.push({ kind: 'featured', item });
      continue;
    }
    currentCols[smallestCol].push(item);
    smallestCol = (smallestCol + 1) % columns;
  }
  flushCols();

  return (
    <View style={{ gap }}>
      {rows.map((row, idx) => {
        if (row.kind === 'featured') {
          return <FeaturedCard key={`f-${idx}`} item={row.item} />;
        }
        return (
          <View key={`r-${idx}`} style={[styles.colsRow, { gap }]}>
            {row.cols.map((col, colIdx) => (
              <View key={colIdx} style={[styles.col, { gap }]}>
                {col.map((item, itemIdx) => (
                  <StandardCard key={`${colIdx}-${itemIdx}`} item={item} />
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function StandardCard({ item }: { item: MasonryItem }) {
  const inner = (
    <View style={styles.card}>
      <Image source={{ uri: item.uri }} style={styles.image} />
      {(item.title != null || item.date != null) && (
        <View style={styles.caption}>
          {item.title != null && (
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          )}
          {item.date != null && <Text style={styles.date}>{item.date}</Text>}
        </View>
      )}
    </View>
  );
  if (item.onPress == null) return inner;
  return <Pressable onPress={item.onPress}>{inner}</Pressable>;
}

function FeaturedCard({ item }: { item: MasonryItem }) {
  const inner = (
    <View style={styles.featuredCard}>
      <Image source={{ uri: item.uri }} style={styles.featuredImage} />
      {(item.title != null || item.date != null) && (
        <View style={styles.caption}>
          {item.title != null && (
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          )}
          {item.date != null && <Text style={styles.date}>{item.date}</Text>}
        </View>
      )}
    </View>
  );
  if (item.onPress == null) return inner;
  return <Pressable onPress={item.onPress}>{inner}</Pressable>;
}

const styles = StyleSheet.create({
  colsRow: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: GARDEN_SURFACES.lift,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  featuredCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: GARDEN_SURFACES.lift,
  },
  featuredImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  caption: {
    padding: 10,
    gap: 2,
  },
  title: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 13,
    color: colors.text,
  },
  date: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },
});
