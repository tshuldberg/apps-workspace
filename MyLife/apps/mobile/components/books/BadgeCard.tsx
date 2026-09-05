import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import type { BadgeProgress } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

interface BadgeCardProps {
  progress: BadgeProgress;
}

export function BadgeCard({ progress }: BadgeCardProps) {
  const { badge, currentValue, isEarned, progressText } = progress;
  const tierColor = TIER_COLORS[badge.tier] ?? colors.textTertiary;
  const fillPct = isEarned ? 100 : Math.min(100, (currentValue / badge.threshold) * 100);

  return (
    <View style={[styles.card, !isEarned && styles.unearned]}>
      <Text style={styles.icon}>{badge.icon}</Text>
      <Text variant="label" numberOfLines={1}>{badge.name}</Text>
      <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={styles.description}>
        {badge.description}
      </Text>

      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${fillPct}%`,
              backgroundColor: isEarned ? '#FFD700' : BOOKS_ACCENT,
            },
          ]}
        />
      </View>

      <Text variant="caption" color={colors.textTertiary}>{progressText}</Text>

      {isEarned && badge.earned_at && (
        <Text variant="caption" color={colors.textTertiary} style={styles.earnedDate}>
          Earned {new Date(badge.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      )}

      <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%' as unknown as number,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4,
    alignItems: 'center',
  },
  unearned: {
    opacity: 0.7,
  },
  icon: {
    fontSize: 36,
  },
  description: {
    textAlign: 'center',
    fontSize: 11,
  },
  barTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    marginTop: 4,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  earnedDate: {
    fontSize: 10,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
});
