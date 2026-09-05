import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { Listing } from '../../types';
import {
  MK_OFFER_STATUS,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TYPOGRAPHY,
} from '../tokens';
import { getListingPriceLabel, withAlpha } from '../logic';
import { ConditionPill } from './ConditionPill';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';
import { PriceBadge } from './PriceBadge';

export type ListingCardListing = Listing & {
  photoUrl?: string | null;
  coverPhotoUrl?: string | null;
  imageUrl?: string | null;
  isFavorite?: boolean;
  photos?: Array<{ url?: string | null }>;
};

export interface ListingCardProps {
  listing: ListingCardListing;
  variant?: 'carousel' | 'grid' | 'row';
  onPress: () => void;
}

function getListingImageUri(listing: ListingCardListing) {
  return (
    listing.coverPhotoUrl ??
    listing.photoUrl ??
    listing.imageUrl ??
    listing.photos?.find((photo) => typeof photo.url === 'string')?.url ??
    null
  );
}

function FavoriteChip({ active }: { active: boolean }) {
  return (
    <View style={styles.favoriteChip}>
      <MaterialSymbol
        name={active ? 'favorite' : 'favorite_border'}
        size={16}
        color={active ? MK_OFFER_STATUS.declined : MK_TEXT}
        filled={active}
      />
    </View>
  );
}

function PriceContent({ listing }: { listing: ListingCardListing }) {
  if (listing.pricingType !== 'free' && listing.priceCents != null) {
    return (
      <PriceBadge
        price={listing.priceCents / 100}
        currency={listing.currency}
        glass
      />
    );
  }

  return (
    <View style={styles.fallbackPriceChip}>
      <Text style={styles.fallbackPriceText}>{getListingPriceLabel(listing)}</Text>
    </View>
  );
}

export function ListingCard({
  listing,
  variant = 'carousel',
  onPress,
}: ListingCardProps) {
  const imageUri = getListingImageUri(listing);
  const isRow = variant === 'row';

  if (isRow) {
    return (
      <GlassCard onPress={onPress} padding={0}>
        <View style={styles.rowCard}>
          <View style={styles.rowImageWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.rowImage} contentFit="cover" />
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {listing.title}
            </Text>
            <Text style={styles.rowPrice}>{getListingPriceLabel(listing)}</Text>
            <View style={styles.rowMeta}>
              {listing.condition ? (
                <ConditionPill condition={listing.condition} size="sm" />
              ) : null}
              {listing.locationName ? (
                <Text style={styles.rowLocation} numberOfLines={1}>
                  {listing.locationName}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </GlassCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.card,
          variant === 'carousel' ? styles.carouselCard : styles.gridCard,
        ]}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <View style={styles.placeholder} />
        )}
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.05)']}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.topRow}>
          {listing.condition ? <ConditionPill condition={listing.condition} size="sm" /> : <View />}
          <FavoriteChip active={Boolean(listing.isFavorite)} />
        </View>
        <View style={styles.bottomContent}>
          <PriceContent listing={listing} />
          <Text style={styles.cardTitle} numberOfLines={2}>
            {listing.title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
    backgroundColor: MK_SURFACES.low,
  },
  carouselCard: {
    width: 288,
    aspectRatio: 4 / 5,
    padding: 16,
  },
  gridCard: {
    width: '100%',
    aspectRatio: 1,
    padding: 14,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MK_SURFACES.high,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  favoriteChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_SURFACES.lowest, 0.34),
  },
  bottomContent: {
    zIndex: 1,
    gap: 10,
  },
  cardTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  fallbackPriceChip: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fallbackPriceText: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  rowCard: {
    minHeight: 96,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  rowImageWrap: {
    width: 96,
    height: 96,
    backgroundColor: MK_SURFACES.high,
  },
  rowImage: {
    width: '100%',
    height: '100%',
  },
  rowContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    justifyContent: 'center',
  },
  rowTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  rowPrice: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
    fontWeight: '700',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowLocation: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    flexShrink: 1,
  },
});
