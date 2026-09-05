/**
 * Phase 4a Insights — Discoveries panel.
 *
 * Renders the output of `discoverInsights` from @mylife/intelligence as
 * read-only cards. No interactions, no apply/dismiss — this is a cross-module
 * scan that surfaces interesting correlations above the engine's threshold.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import type { ModuleDefinition } from '@mylife/module-registry';
import { discoverInsights, type InsightCard } from '@mylife/intelligence';
import type { DatabaseAdapter } from '@mylife/db';

interface Props {
  db: DatabaseAdapter;
  modules: ModuleDefinition[];
}

export function DiscoveriesPanel({ db, modules }: Props) {
  const insights = useMemo<InsightCard[]>(() => {
    try {
      return discoverInsights(db, modules);
    } catch {
      return [];
    }
  }, [db, modules]);

  if (insights.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nothing interesting yet</Text>
        <Text style={styles.emptyBody}>
          MyLife scans every permitted module for strong correlations. Keep
          logging and check back in a week or two.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {insights.map((insight, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.rowHeader}>
            <Text style={styles.confidence}>{insight.confidence}</Text>
            <Text style={styles.strength}>{insight.correlation.strength}</Text>
          </View>
          <Text style={styles.title}>{insight.title}</Text>
          <Text style={styles.body}>{insight.description}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  confidence: {
    color: colors.hubAccent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  strength: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    padding: spacing.md,
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
