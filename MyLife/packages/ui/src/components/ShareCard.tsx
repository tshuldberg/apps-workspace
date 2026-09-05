import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../tokens/colors';
import { borderRadius, spacing } from '../tokens/spacing';

interface ShareCardProps {
  title: string;
  subtitle: string;
  moduleIcon: string;
  moduleAccentColor: string;
  stat?: string;
  statLabel?: string;
}

/**
 * Generates a styled shareable card for achievements, streaks, and milestones.
 * Module-branded with accent colors. Used by the social share flow.
 */
export function ShareCard({
  title,
  subtitle,
  moduleIcon,
  moduleAccentColor,
  stat,
  statLabel,
}: ShareCardProps) {
  return (
    <View style={[styles.card, { borderColor: moduleAccentColor }]}>
      <View style={styles.inner}>
        {/* Header: module icon + brand */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: `${moduleAccentColor}1A` },
            ]}
          >
            <Text style={styles.iconText}>{moduleIcon}</Text>
          </View>
          <View style={styles.brand}>
            <View style={styles.brandLogo}>
              <Text style={styles.brandLogoText}>M</Text>
            </View>
            <Text style={styles.brandName}>MyLife</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* Optional stat */}
        {stat && (
          <View
            style={[
              styles.statContainer,
              { backgroundColor: `${moduleAccentColor}1A` },
            ]}
          >
            <Text style={[styles.statValue, { color: moduleAccentColor }]}>
              {stat}
            </Text>
            {statLabel && <Text style={styles.statLabel}>{statLabel}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 300,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  inner: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C9894D',
  },
  brandLogoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E0C09',
  },
  brandName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  body: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
