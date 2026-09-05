import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  buildCaffeineSummary,
  getCaffeineLogsForDate,
  getSetting,
  remainingFromDose,
} from '@mylife/fast';
import type { CaffeineSummary, CaffeineSnapshot } from '@mylife/fast';
import { Card, EmptyState, LoadingState, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.fast;

const STATUS_COLORS: Record<string, string> = {
  empty: colors.textTertiary,
  normal: colors.success,
  high: colors.warning,
  late: colors.danger,
  critical: colors.danger,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] ?? colors.textTertiary }]}>
      <Text variant="caption" color={colors.background} style={{ fontWeight: '700', textTransform: 'capitalize' }}>
        {status}
      </Text>
    </View>
  );
}

function DecayBar({ drink, now }: { drink: CaffeineSnapshot; now: Date }) {
  const remaining = remainingFromDose(drink.caffeineMg, new Date(drink.loggedAt).getTime(), now.getTime());
  const pct = drink.caffeineMg > 0 ? Math.max(0, Math.min(100, (remaining / drink.caffeineMg) * 100)) : 0;
  return (
    <View style={styles.drinkRow}>
      <View style={styles.drinkInfo}>
        <Text variant="body">{drink.beverageName}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {new Date(drink.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -- {drink.caffeineMg}mg
        </Text>
      </View>
      <View style={styles.decayTrack}>
        <View style={[styles.decayFill, { width: `${pct}%` }]} />
      </View>
      <Text variant="caption" color={colors.textSecondary} style={styles.remainLabel}>
        {Math.round(remaining)}mg left
      </Text>
    </View>
  );
}

export default function CaffeineDashboardScreen() {
  const db = useDatabase();
  const [summary, setSummary] = useState<CaffeineSummary | null>(null);
  const [dailyLimit, setDailyLimit] = useState(400);

  const load = useCallback(() => {
    try {
      const limitStr = getSetting(db, 'caffeineDailyLimitMg');
      const limit = limitStr ? Number(limitStr) : 400;
      setDailyLimit(limit);

      const cutoffStr = getSetting(db, 'caffeineCutoffTime') ?? '14:00';
      const logs = getCaffeineLogsForDate(db, new Date());
      const result = buildCaffeineSummary(logs, limit, cutoffStr);
      setSummary(result);
    } catch (err) {
      console.warn('Failed to load caffeine summary', err);
      setSummary({ drinks: [], totalMg: 0, remainingMg: 0, status: 'empty', clearByTime: null });
    }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();

  if (!summary) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={3} />
      </View>
    );
  }

  if (summary.drinks.length === 0 && summary.totalMg === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="☕"
          title="No caffeine logged"
          message="Log your first caffeinated drink to track intake and metabolization."
          accentColor={ACCENT}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.headerCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text variant="subheading">Daily Caffeine</Text>
            <Text style={styles.totalText}>
              {Math.round(summary.totalMg)} / {dailyLimit} mg
            </Text>
          </View>
          <StatusBadge status={summary.status} />
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, (summary.totalMg / Math.max(1, dailyLimit)) * 100)}%`,
                backgroundColor: STATUS_COLORS[summary.status] ?? ACCENT,
              },
            ]}
          />
        </View>
      </Card>

      {summary.status === 'late' || summary.status === 'critical' ? (
        <Card style={styles.warningCard}>
          <Text variant="label" color={colors.danger}>
            Late caffeine detected
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Caffeine consumed after your cutoff time may disrupt sleep quality and fasting goals.
          </Text>
        </Card>
      ) : null}

      {summary.clearByTime ? (
        <Card>
          <Text variant="subheading">Clear By</Text>
          <Text style={styles.clearByTime}>
            {new Date(summary.clearByTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Estimated time when all caffeine will be metabolized
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="subheading">Metabolization Timeline</Text>
        {summary.drinks.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
            No caffeinated drinks logged today
          </Text>
        ) : (
          <View style={styles.drinkList}>
            {summary.drinks.map((drink, i) => (
              <DecayBar key={`${drink.loggedAt}-${i}`} drink={drink} now={now} />
            ))}
          </View>
        )}
      </Card>

      <Pressable style={styles.refreshButton} onPress={load}>
        <Text variant="label" color={colors.background}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerCard: {
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  totalText: {
    color: ACCENT,
    fontSize: 24,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  warningCard: {
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.xs,
  },
  clearByTime: {
    color: ACCENT,
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  drinkList: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  drinkRow: {
    gap: spacing.xs,
  },
  drinkInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  decayTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  decayFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  remainLabel: {
    textAlign: 'right',
  },
  refreshButton: {
    borderRadius: 8,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
