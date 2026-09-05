import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import type { ProgressTimelineEntry } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;

interface ProgressTimelineProps {
  timeline: ProgressTimelineEntry[];
  accentColor?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function ProgressTimeline({ timeline, accentColor }: ProgressTimelineProps) {
  const accent = accentColor ?? BOOKS_ACCENT;

  if (timeline.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color={colors.textTertiary}>
          Start logging progress to see your reading journey.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} nestedScrollEnabled>
      {timeline.map((entry, i) => (
        <View key={`${entry.date}-${i}`} style={styles.row}>
          <Text variant="caption" color={colors.textSecondary} style={styles.dateLabel}>
            {formatDate(entry.date)}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.max(entry.percent, 2)}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
          <Text variant="caption" color={colors.textTertiary} style={styles.percentLabel}>
            {Math.round(entry.percent)}%
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 200,
  },
  emptyContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 3,
  },
  dateLabel: {
    width: 50,
    fontSize: 11,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  percentLabel: {
    width: 36,
    textAlign: 'right',
    fontSize: 11,
  },
});
