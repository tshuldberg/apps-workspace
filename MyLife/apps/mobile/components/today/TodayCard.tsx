import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { TodayCard as TodayCardModel } from '@mylife/module-registry';
import { Text, colors, glassBorders, glassFills, spacing } from '@mylife/ui';

export interface TodayCardProps {
  card: TodayCardModel;
  /** Long-press invokes dismiss. No-op if the card is not dismissible. */
  onDismiss?: (cardId: string) => void;
}

/** Priority threshold above which the card receives a hub-accent highlight. */
const HIGH_PRIORITY_THRESHOLD = 70;

/**
 * A single Today-surface card. Uses a glass-fill treatment (no runtime blur;
 * the jsdom test environment can't render `expo-blur`, and the rest of the
 * hub already relies on `glassFills.*` tokens for the same visual language).
 *
 * Tap -> navigates to `cta.route` (if present).
 * Long-press -> calls `onDismiss(card.id)` when the card is dismissible.
 */
export function TodayCard({ card, onDismiss }: TodayCardProps) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }, [scale]);

  const handlePress = useCallback(
    (_event: GestureResponderEvent) => {
      if (!card.cta?.route) return;
      router.push(card.cta.route as never);
    },
    [card.cta?.route, router],
  );

  const handleLongPress = useCallback(() => {
    if (!card.dismissible) return;
    onDismiss?.(card.id);
  }, [card.dismissible, card.id, onDismiss]);

  const isHighPriority = card.priority >= HIGH_PRIORITY_THRESHOLD;
  const hasCta = Boolean(card.cta?.route);

  return (
    <Pressable
      onPress={hasCta ? handlePress : undefined}
      onPressIn={hasCta ? handlePressIn : undefined}
      onPressOut={hasCta ? handlePressOut : undefined}
      onLongPress={card.dismissible ? handleLongPress : undefined}
      accessibilityRole={hasCta ? 'button' : undefined}
      accessibilityLabel={card.title}
      accessibilityHint={card.subtitle}
    >
      <Animated.View
        style={[
          styles.card,
          isHighPriority && styles.cardHighPriority,
          { transform: [{ scale }] },
        ]}
      >
        {isHighPriority ? <View style={styles.priorityAccent} /> : null}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          {card.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {card.subtitle}
            </Text>
          ) : null}
          {hasCta ? (
            <View style={styles.ctaRow}>
              <Text style={styles.ctaLabel}>
                {card.cta?.label ?? 'Open'}
              </Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: glassFills.subtle,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderRadius: 16,
    padding: spacing.md,
    minHeight: 72,
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHighPriority: {
    borderColor: `${colors.primaryContainer}66`,
  },
  priorityAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: colors.primaryContainer,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaRow: {
    marginTop: spacing.xs,
  },
  ctaLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
