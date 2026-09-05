import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Offer } from '../../types';
import {
  MK_ACCENT,
  MK_ACCENT_DARK,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TYPOGRAPHY,
} from '../tokens';
import { getOfferStatusMeta, withAlpha } from '../logic';
import { GlassCard } from './GlassCard';
import { PriceBadge } from './PriceBadge';

export type OfferCardOffer = Offer & {
  listingTitle?: string;
  listingThumbnailUrl?: string;
  title?: string;
};

export interface OfferCardProps {
  offer: OfferCardOffer;
  role: 'sender' | 'receiver';
  onAccept?: () => void;
  onDecline?: () => void;
  onCounter?: () => void;
}

function ActionButton({
  label,
  onPress,
  fill,
}: {
  label: string;
  onPress?: () => void;
  fill?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionButton,
        fill ? styles.actionButtonFilled : null,
      ]}
    >
      <Text
        style={[
          styles.actionLabel,
          fill ? styles.actionLabelFilled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function OfferCard({
  offer,
  role,
  onAccept,
  onDecline,
  onCounter,
}: OfferCardProps) {
  const status = getOfferStatusMeta(offer.status);
  const showActions = offer.status === 'pending' && role === 'receiver';
  const title = offer.listingTitle ?? offer.title ?? 'Offer';

  return (
    <GlassCard elevated>
      <View style={styles.row}>
        <View style={styles.thumbWrap}>
          {offer.listingThumbnailUrl ? (
            <Image
              source={{ uri: offer.listingThumbnailUrl }}
              style={styles.thumb}
              contentFit="cover"
            />
          ) : (
            <View style={styles.thumbPlaceholder} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: withAlpha(status.color, 0.18) },
              ]}
            >
              <Text style={[styles.statusLabel, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>

          <PriceBadge price={offer.amountCents / 100} currency={offer.currency} />

          {offer.message ? (
            <Text style={styles.message} numberOfLines={2}>
              {offer.message}
            </Text>
          ) : null}
        </View>
      </View>

      {showActions ? (
        <View style={styles.actions}>
          <ActionButton label="Decline" onPress={onDecline} />
          <ActionButton label="Counter" onPress={onCounter} />
          <ActionButton label="Accept" onPress={onAccept} fill />
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    backgroundColor: MK_SURFACES.high,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
  },
  message: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MK_SURFACES.low,
  },
  actionButtonFilled: {
    backgroundColor: MK_ACCENT,
  },
  actionLabel: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
    fontSize: 13,
    lineHeight: 16,
  },
  actionLabelFilled: {
    color: MK_ACCENT_DARK,
    fontWeight: '700',
  },
});
