import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, colors, spacing } from '@mylife/ui';
import type { ReadingInsight } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;

const CATEGORY_ICONS: Record<string, string> = {
  speed: '\u23f1\ufe0f',
  timing: '\ud83d\udd70\ufe0f',
  diversity: '\ud83c\udfa8',
  consistency: '\ud83d\udd25',
  milestones: '\ud83c\udfc6',
};

interface InsightCardProps {
  insight: ReadingInsight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const icon = CATEGORY_ICONS[insight.category] ?? '\ud83d\udca1';

  return (
    <Card style={styles.card}>
      <View style={[styles.accentBorder, { backgroundColor: BOOKS_ACCENT }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>{icon}</Text>
          <Text variant="subheading" style={styles.title}>{insight.title}</Text>
        </View>
        <Text variant="body" color={colors.textSecondary}>{insight.description}</Text>

        {insight.comparisonValue !== undefined && (
          <View style={styles.comparisonBadge}>
            <Text variant="caption" color={BOOKS_ACCENT}>
              {insight.comparisonValue} {insight.comparisonLabel ?? ''}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 0,
  },
  accentBorder: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    flex: 1,
  },
  comparisonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${BOOKS_ACCENT}26`,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
});
