import { useCallback, useEffect, useMemo, useState } from 'react';
import { uuid } from '../../../lib/uuid';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  generateSuggestions,
  getRecentSuggestionKeys,
  getActivityCorrelations,
  getMoodEntryCount,
  createSuggestionHistory,
  updateSuggestionAction,
  type GeneratedSuggestion,
} from '@mylife/mood';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const accentColor = colors.modules.mood;

const SOURCE_COLORS: Record<string, string> = {
  data_driven: colors.success,
  catalog: accentColor,
  cross_module: colors.warning,
};

interface SuggestionsCardProps {
  lastScore: number | null;
}

export function SuggestionsCard({ lastScore }: SuggestionsCardProps) {
  const db = useDatabase();
  const [suggestions, setSuggestions] = useState<(GeneratedSuggestion & { historyId: string })[]>([]);

  const loadSuggestions = useCallback(() => {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const recentKeys = getRecentSuggestionKeys(db, twentyFourHoursAgo);
      const correlations = getActivityCorrelations(db, 30);
      const entryCount = getMoodEntryCount(db);

      const generated = generateSuggestions({
        currentScore: lastScore ?? 5,
        activityCorrelations: correlations,
        recentSuggestionKeys: recentKeys,
        enabledModules: [],
        entryCount,
      });

      // Track each suggestion shown
      const tracked = generated.map((s) => {
        const historyId = uuid();
        createSuggestionHistory(db, historyId, {
          suggestionKey: s.key,
          category: s.category,
          source: s.source,
        });
        return { ...s, historyId };
      });

      setSuggestions(tracked);
    } catch {
      // noop
    }
  }, [db, lastScore]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleAction = useCallback((historyId: string, action: 'completed' | 'dismissed') => {
    updateSuggestionAction(db, historyId, action);
    setSuggestions((prev) => prev.filter((s) => s.historyId !== historyId));
  }, [db]);

  if (suggestions.length === 0) return null;

  return (
    <Card>
      <Text variant="subheading">Suggestions</Text>
      <View style={styles.list}>
        {suggestions.map((s) => (
          <View key={s.historyId} style={styles.suggestionCard}>
            <View style={styles.suggestionHeader}>
              <Text variant="body" style={styles.suggestionTitle}>{s.title}</Text>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: (SOURCE_COLORS[s.source] ?? accentColor) + '30' }]}>
                  <Text variant="caption" style={{ color: SOURCE_COLORS[s.source] ?? accentColor, fontSize: 10 }}>
                    {s.source.replace('_', ' ')}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
                  <Text variant="caption" style={{ color: accentColor, fontSize: 10 }}>
                    {s.category}
                  </Text>
                </View>
              </View>
            </View>
            <Text variant="caption" color={colors.textSecondary}>{s.description}</Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { borderColor: colors.success }]}
                onPress={() => handleAction(s.historyId, 'completed')}
              >
                <Text variant="caption" color={colors.success}>Did it</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { borderColor: colors.textTertiary }]}
                onPress={() => handleAction(s.historyId, 'dismissed')}
              >
                <Text variant="caption" color={colors.textTertiary}>Skip</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing.sm, gap: spacing.sm },
  suggestionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionTitle: { fontWeight: '600', flex: 1 },
  badges: { flexDirection: 'row', gap: spacing.xs },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
});
