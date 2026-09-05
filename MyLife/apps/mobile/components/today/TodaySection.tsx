import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { TodayCard as TodayCardModel } from '@mylife/module-registry';
import { Text, colors, spacing } from '@mylife/ui';
import { TodayCard } from './TodayCard';

export interface TodaySectionProps {
  label: string;
  cards: readonly TodayCardModel[];
  onDismiss?: (cardId: string) => void;
}

/**
 * A labelled section of the Today surface. Renders a small-caps label plus
 * one `TodayCard` per entry. When `cards` is empty the whole section
 * renders nothing so parents can keep the prop wiring trivial.
 */
export function TodaySection({ label, cards, onDismiss }: TodaySectionProps) {
  if (cards.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.cardList}>
        {cards.map((card) => (
          <TodayCard key={card.id} card={card} onDismiss={onDismiss} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  cardList: {
    gap: spacing.sm,
  },
});
