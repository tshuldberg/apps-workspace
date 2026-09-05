import { StyleSheet, Text, View } from 'react-native';
import type { Envelope } from '../../types';
import {
  BG_CARD_RADIUS,
  BG_ENVELOPE_STATUS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TYPOGRAPHY,
  getBudgetEnvelopeStatusColor,
} from '../tokens';
import { BG_FONTS } from '../typography';
import { AmountDisplay } from './AmountDisplay';
import { CategoryChip } from './CategoryChip';
import { GlassCard } from './GlassCard';

function formatRemainingText(remaining: number): string {
  const absolute = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(remaining) / 100);

  if (remaining < 0) {
    return `${absolute} over`;
  }
  return `${absolute} remaining`;
}

export interface EnvelopeCardProps {
  envelope: Envelope;
  allocated: number;
  spent: number;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function EnvelopeCard({
  envelope,
  allocated,
  spent,
  onPress,
  onLongPress,
}: EnvelopeCardProps) {
  const remaining = allocated - spent;
  const tone = getBudgetEnvelopeStatusColor(spent, allocated);
  const progress = allocated > 0 ? Math.min(spent / allocated, 1) : 0;

  return (
    <GlassCard onLongPress={onLongPress} onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: `${tone}22` }]}>
            <Text style={styles.iconLabel}>{envelope.icon ?? '💰'}</Text>
          </View>
          <View style={styles.titleCopy}>
            <Text numberOfLines={1} style={styles.title}>
              {envelope.name}
            </Text>
            <CategoryChip
              category={{
                name: envelope.rollover_enabled === 1 ? 'Rollover' : 'Monthly',
                icon: envelope.icon,
                color: envelope.color,
              }}
              size="sm"
            />
          </View>
        </View>
        {envelope.rollover_enabled === 1 ? (
          <View style={styles.rolloverPill}>
            <Text style={styles.rolloverText}>Rollover</Text>
          </View>
        ) : null}
      </View>

      <AmountDisplay cents={allocated} size="lg" type="neutral" />

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(progress * 100, 6)}%`,
              backgroundColor: tone,
            },
          ]}
        />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{formatRemainingText(remaining)}</Text>
        <Text style={[styles.metaText, { color: tone }]}>
          {spent > 0 ? `${Math.round(progress * 100)}% spent` : 'No spend yet'}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    fontSize: 18,
  },
  titleCopy: {
    gap: 6,
    flex: 1,
  },
  title: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  rolloverPill: {
    alignSelf: 'flex-start',
    backgroundColor: BG_SURFACES.high,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BG_CARD_RADIUS,
  },
  rolloverText: {
    ...BG_TYPOGRAPHY.labelUpper,
    color: BG_ENVELOPE_STATUS.on_track,
  },
  progressTrack: {
    height: 10,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.high,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    minWidth: 6,
    borderRadius: BG_CARD_RADIUS,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
});
