import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getAdherenceStats, getMedications } from '@mylife/meds';
import {
  GlassCard,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import {
  EmptyGlassState,
  FilterChip,
  ProgressBar,
  ScreenTitleBlock,
  SectionStack,
  daysAgoIso,
} from '../../components/meds/phase1';
import { useDatabase } from '../../components/DatabaseProvider';

type PeriodKey = '7d' | '30d' | '90d';

const PERIOD_TO_DAYS: Record<PeriodKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function buildHeatmapLevel(value: number) {
  if (value >= 100) {
    return withAlpha(MD_ACCENT_LIGHT, 0.9);
  }
  if (value >= 80) {
    return withAlpha(MD_ACCENT_LIGHT, 0.65);
  }
  if (value >= 50) {
    return withAlpha(MD_CHROME_GOLD, 0.65);
  }
  if (value > 0) {
    return withAlpha('#FFB4AB', 0.7);
  }
  return withAlpha('#FFFFFF', 0.06);
}

function dayLabel(index: number) {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][index] ?? '';
}

export default function AdherenceScreen() {
  const db = useDatabase();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const screenState = useMemo(() => {
    try {
      const days = PERIOD_TO_DAYS[period];
      const from = daysAgoIso(days);
      const medications = getMedications(db, { isActive: true });

      const perMedication = medications.map((medication) => {
        const stats = getAdherenceStats(db, medication.id, days);
        return {
          medication,
          stats,
        };
      });

      const dailyRows = db.query<{ day: string; total: number; taken: number }>(
        `SELECT DATE(scheduled_time) as day,
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
         FROM md_dose_logs
         WHERE scheduled_time >= ?
         GROUP BY DATE(scheduled_time)
         ORDER BY day ASC`,
        [from],
      );

      const dayMap = new Map(
        dailyRows.map((row) => [
          row.day,
          row.total > 0 ? Math.round((row.taken / row.total) * 100) : 0,
        ]),
      );

      const heatmap = Array.from({ length: days }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - index - 1));
        const key = date.toISOString().slice(0, 10);
        return {
          date: key,
          percentage: dayMap.get(key) ?? 0,
          weekday: date.getDay(),
        };
      });

      let streak = 0;
      for (let index = heatmap.length - 1; index >= 0; index -= 1) {
        if (heatmap[index].percentage === 100) {
          streak += 1;
        } else {
          break;
        }
      }

      const overall = perMedication.length > 0
        ? Math.round(
            perMedication.reduce((sum, item) => sum + item.stats.rate, 0) / perMedication.length,
          )
        : 0;

      const missedRows = db.query<{ scheduled_time: string }>(
        `SELECT scheduled_time
         FROM md_dose_logs
         WHERE scheduled_time >= ? AND status = 'skipped'`,
        [from],
      );

      const byTime = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      const byWeekday = Array.from({ length: 7 }, () => 0);

      for (const row of missedRows) {
        const date = new Date(row.scheduled_time);
        const hour = date.getHours();
        if (hour < 12) {
          byTime.morning += 1;
        } else if (hour < 17) {
          byTime.afternoon += 1;
        } else if (hour < 21) {
          byTime.evening += 1;
        } else {
          byTime.night += 1;
        }
        byWeekday[date.getDay()] += 1;
      }

      const worstTime = Object.entries(byTime).sort((left, right) => right[1] - left[1])[0];
      const worstDayIndex = byWeekday
        .map((value, index) => ({ index, value }))
        .sort((left, right) => right.value - left.value)[0];

      return {
        error: null,
        heatmap,
        overall,
        perMedication: perMedication.sort((left, right) => right.stats.rate - left.stats.rate),
        streak,
        totalMissed: missedRows.length,
        worstDay: worstDayIndex ? dayLabel(worstDayIndex.index) : 'N/A',
        worstTime: worstTime ? `${worstTime[0]} (${worstTime[1]})` : 'N/A',
      };
    } catch (error) {
      console.error('AdherenceScreen load failed', error);
      return {
        error: 'Unable to load adherence analytics.',
        heatmap: [] as Array<{ date: string; percentage: number; weekday: number }>,
        overall: 0,
        perMedication: [] as Array<{ medication: ReturnType<typeof getMedications>[number]; stats: ReturnType<typeof getAdherenceStats> }>,
        streak: 0,
        totalMissed: 0,
        worstDay: 'N/A',
        worstTime: 'N/A',
      };
    }
  }, [db, period, refreshKey]);

  if (screenState.error) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Retry"
          message={screenState.error}
          onPress={onRefresh}
          title="Adherence analytics unavailable"
        />
      </View>
    );
  }

  if (screenState.perMedication.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          message="Add active medications and log doses to build adherence analytics."
          title="No adherence data yet"
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[MD_ACCENT_LIGHT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={MD_ACCENT_LIGHT}
        />
      }
      style={styles.screen}
    >
      <SectionStack>
        <ScreenTitleBlock
          subtitle="See adherence by day, by medication, and by missed-dose pattern."
          title="Adherence"
        />

        <GlassCard padding={22} style={styles.heroCard}>
          <Text style={styles.heroValue}>{screenState.overall}%</Text>
          <Text style={styles.heroLabel}>Average adherence in the selected period</Text>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Period" />
          <View style={styles.chipRail}>
            {(['7d', '30d', '90d'] as PeriodKey[]).map((item) => (
              <FilterChip
                key={item}
                label={item}
                onPress={() => setPeriod(item)}
                selected={period === item}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Calendar heatmap" />
          <View style={styles.weekdayRow}>
            {Array.from({ length: 7 }, (_, index) => (
              <Text key={index} style={styles.weekdayLabel}>
                {dayLabel(index)}
              </Text>
            ))}
          </View>
          <View style={styles.heatmapGrid}>
            {screenState.heatmap.map((day) => (
              <View key={day.date} style={styles.heatmapCellWrap}>
                <View
                  style={[
                    styles.heatmapCell,
                    { backgroundColor: buildHeatmapLevel(day.percentage) },
                  ]}
                />
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Per-medication adherence" />
          <View style={styles.medicationStack}>
            {screenState.perMedication.map((item) => (
              <View key={item.medication.id} style={styles.medicationRow}>
                <View style={styles.medicationCopy}>
                  <Text style={styles.medicationName}>{item.medication.name}</Text>
                  <Text style={styles.medicationMeta}>
                    {item.stats.totalTaken} taken · {item.stats.totalMissed} skipped · streak {item.stats.streak}d
                  </Text>
                </View>
                <Text style={styles.medicationValue}>{Math.round(item.stats.rate)}%</Text>
                <ProgressBar
                  tone={item.stats.rate >= 80 ? MD_ACCENT_LIGHT : MD_CHROME_GOLD}
                  value={item.stats.rate}
                />
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Missed dose patterns" />
          <View style={styles.patternStack}>
            <View style={styles.patternRow}>
              <Text style={styles.patternLabel}>Most-missed time of day</Text>
              <Text style={styles.patternValue}>{screenState.worstTime}</Text>
            </View>
            <View style={styles.patternRow}>
              <Text style={styles.patternLabel}>Most-missed weekday</Text>
              <Text style={styles.patternValue}>{screenState.worstDay}</Text>
            </View>
            <View style={styles.patternRow}>
              <Text style={styles.patternLabel}>Total skipped doses</Text>
              <Text style={styles.patternValue}>{screenState.totalMissed}</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Streak card" />
          <Text style={styles.streakValue}>{screenState.streak} days</Text>
          <Text style={styles.streakBody}>
            Consecutive days at 100% adherence inside the current period window.
          </Text>
        </GlassCard>
      </SectionStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_SURFACES.low, 0.92),
    gap: 8,
  },
  heroValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
  },
  heroLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  chipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekdayLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heatmapCellWrap: {
    width: 18,
  },
  heatmapCell: {
    borderRadius: 6,
    height: 18,
    width: 18,
  },
  medicationStack: {
    gap: 12,
  },
  medicationRow: {
    gap: 8,
  },
  medicationCopy: {
    gap: 4,
  },
  medicationName: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  medicationMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  medicationValue: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
  patternStack: {
    gap: 10,
  },
  patternRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  patternLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  patternValue: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
  },
  streakValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
  },
  streakBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
});
