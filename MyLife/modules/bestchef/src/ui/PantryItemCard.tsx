import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import {
  RECIPES_FRESHNESS_COLORS,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type RecipesFreshness,
} from './tokens';

type Freshness = 'fresh' | 'expiring' | 'expired';

interface PantryItemCardProps {
  name: string;
  quantity: string;
  emoji?: string;
  imageUri?: string;
  receiptThumbnailUri?: string;
  foodPhotoUri?: string;
  mediaLabel?: string;
  freshness: Freshness;
  expiryLabel?: string;
  onPress?: () => void;
  onShop?: () => void;
}

const FRESHNESS_TO_KEY: Record<Freshness, RecipesFreshness> = {
  fresh: 'fresh',
  expiring: 'expiringSoon',
  expired: 'expired',
};

const FRESHNESS_LABEL: Record<Freshness, string> = {
  fresh: 'Fresh',
  expiring: 'Expiring Soon',
  expired: 'Expired',
};

export function PantryItemCard({
  name,
  quantity,
  emoji,
  imageUri,
  receiptThumbnailUri,
  foodPhotoUri,
  mediaLabel,
  freshness,
  expiryLabel,
  onPress,
  onShop,
}: PantryItemCardProps) {
  const color = RECIPES_FRESHNESS_COLORS[FRESHNESS_TO_KEY[freshness]];
  const mediaUri = imageUri ?? receiptThumbnailUri ?? foodPhotoUri ?? null;
  const content = (
    <>
      <View style={styles.row}>
        <View style={styles.mediaSlot}>
          {mediaUri != null ? (
            <Image source={{ uri: mediaUri }} style={styles.mediaImage} resizeMode="cover" />
          ) : (
            <View style={styles.mediaFallback}>
              <Text numberOfLines={1} style={styles.mediaFallbackText}>
                {mediaLabel ?? emoji ?? 'Batch'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text numberOfLines={1} style={styles.quantity}>
            {quantity}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.badgeText, { color }]}>{FRESHNESS_LABEL[freshness]}</Text>
        </View>
      </View>
      {expiryLabel != null && (
        <Text style={styles.expiry}>{expiryLabel}</Text>
      )}
      {onShop != null && (
        <Pressable
          onPress={onShop}
          style={({ pressed }) => [
            styles.shopButton,
            pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Shop for ${name}`}
        >
          <Text style={styles.shopText}>Shop</Text>
        </Pressable>
      )}
      <View style={[styles.freshnessBar, { backgroundColor: color }]} />
    </>
  );

  if (onPress == null) {
    return <View style={styles.card}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.86, transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open pantry item ${name}`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  mediaSlot: {
    width: 58,
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  mediaFallbackText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    lineHeight: 1.4 * 15,
    color: colors.text,
  },
  quantity: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0,
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0,
  },
  expiry: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0,
    color: colors.textSecondary,
  },
  shopButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  shopText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0,
    color: '#22C55E',
  },
  freshnessBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
});
