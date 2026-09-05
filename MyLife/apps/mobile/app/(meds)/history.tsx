import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMedications } from '@mylife/meds';
import {
  DoseCard,
  GlassCard,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import {
  EmptyGlassState,
  FilterChip,
  MetricBadge,
  ScreenTitleBlock,
  SectionStack,
  createDoseTone,
  formatMedsDate,
} from '../../components/meds/phase1';
import { useDatabase } from '../../components/DatabaseProvider';

type PeriodKey = 'today' | '7d' | '30d' | '90d';

type HistoryRow = {
  actualTime: string | null;
  createdAt: string;
  dose: string | null;
  id: string;
  medicationId: string;
  medicationName: string;
  notes: string | null;
  scheduledTime: string;
  status: string;
};

const PERIODS: Record<PeriodKey, number> = {
  today: 0,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function rangeStart(period: PeriodKey) {
  if (period === 'today') {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  const now = new Date();
  now.setDate(now.getDate() - PERIODS[period]);
  return now.toISOString();
}

function groupHistory(rows: HistoryRow[]) {
  const groups = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const key = row.scheduledTime.slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    items: items.sort((left, right) => right.scheduledTime.localeCompare(left.scheduledTime)),
  }));
}

export default function HistoryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ medicationId?: string }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [selectedMedicationId, setSelectedMedicationId] = useState(params.medicationId ?? 'all');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const medications = useMemo(() => {
    try {
      return getMedications(db, { isActive: true });
    } catch (error) {
      console.error('HistoryScreen medication load failed', error);
      return [];
    }
  }, [db, refreshKey]);

  const historyState = useMemo(() => {
    try {
      const from = rangeStart(period);
      const rows = db.query<{
        actual_time: string | null;
        created_at: string;
        dosage: string | null;
        id: string;
        medication_id: string;
        medication_name: string;
        notes: string | null;
        scheduled_time: string;
        status: string;
      }>(
        `SELECT l.id,
                l.medication_id,
                m.name as medication_name,
                m.dosage,
                l.scheduled_time,
                l.actual_time,
                l.status,
                l.notes,
                l.created_at
         FROM md_dose_logs l
         JOIN md_medications m ON m.id = l.medication_id
         WHERE l.scheduled_time >= ?
           AND (? = 'all' OR l.medication_id = ?)
         ORDER BY l.scheduled_time DESC
         LIMIT 500`,
        [from, selectedMedicationId, selectedMedicationId],
      );

      const mapped: HistoryRow[] = rows.map((row) => ({
        actualTime: row.actual_time,
        createdAt: row.created_at,
        dose: row.dosage,
        id: row.id,
        medicationId: row.medication_id,
        medicationName: row.medication_name,
        notes: row.notes,
        scheduledTime: row.scheduled_time,
        status: row.status,
      }));

      const countable = mapped.filter((row) => row.status !== 'snoozed');
      const taken = countable.filter((row) => row.status === 'taken' || row.status === 'late').length;
      const skipped = countable.filter((row) => row.status === 'skipped').length;
      const adherence = countable.length > 0 ? Math.round((taken / countable.length) * 100) : 0;

      return {
        adherence,
        error: null,
        groups: groupHistory(mapped),
        rows: mapped,
        skipped,
        taken,
        total: countable.length,
      };
    } catch (error) {
      console.error('HistoryScreen load failed', error);
      return {
        adherence: 0,
        error: 'Unable to load dose history.',
        groups: [] as Array<{ date: string; items: HistoryRow[] }>,
        rows: [] as HistoryRow[],
        skipped: 0,
        taken: 0,
        total: 0,
      };
    }
  }, [db, period, refreshKey, selectedMedicationId]);

  if (historyState.error) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Retry"
          message={historyState.error}
          onPress={onRefresh}
          title="Dose history unavailable"
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
          action={(
            <Pressable onPress={() => router.push('/(meds)/export')} style={styles.exportButton}>
              <MaterialSymbol color={MD_SURFACES.lowest} filled name="share" size={16} />
              <Text style={styles.exportButtonText}>Export</Text>
            </Pressable>
          )}
          subtitle="Zoom from today to 90 days and inspect every logged dose."
          title="History"
        />

        <View style={styles.metricsRow}>
          <MetricBadge label="Adherence" value={`${historyState.adherence}%`} />
          <MetricBadge label="Taken" value={`${historyState.taken}`} />
          <MetricBadge label="Skipped" tone={MD_CHROME_GOLD} value={`${historyState.skipped}`} />
        </View>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Period" />
          <View style={styles.chipRail}>
            {(['today', '7d', '30d', '90d'] as PeriodKey[]).map((item) => (
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
          <SectionHeader title="Medication filter" />
          <View style={styles.chipRail}>
            <FilterChip
              label="All"
              onPress={() => setSelectedMedicationId('all')}
              selected={selectedMedicationId === 'all'}
            />
            {medications.map((medication) => (
              <FilterChip
                key={medication.id}
                label={medication.name}
                onPress={() => setSelectedMedicationId(medication.id)}
                selected={selectedMedicationId === medication.id}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.summaryCard}>
          <SectionHeader title="Adherence summary" />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{historyState.adherence}%</Text>
            <Text style={styles.summaryBody}>
              {historyState.taken} taken · {historyState.skipped} skipped · {historyState.total} tracked doses
            </Text>
          </View>
        </GlassCard>

        {historyState.groups.length === 0 ? (
          <EmptyGlassState
            actionLabel="Log a dose"
            message="Nothing has been logged in this date range yet."
            onPress={() => router.push('/(meds)/(tabs)/index')}
            title="No history in this range"
          />
        ) : (
          historyState.groups.map((group) => (
            <GlassCard key={group.date} padding={18} style={styles.panel}>
              <SectionHeader
                action={<Text style={styles.groupCount}>{group.items.length} entries</Text>}
                title={formatMedsDate(`${group.date}T00:00:00.000Z`, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              />
              <View style={styles.groupStack}>
                {group.items.map((item) => (
                  <View key={item.id} style={styles.historyRow}>
                    <DoseCard
                      dose={item.dose ?? '1 dose'}
                      medication={item.medicationName}
                      onPress={() => setSelectedMedicationId(item.medicationId)}
                      scheduledTime={item.actualTime ?? item.scheduledTime}
                      status={createDoseTone(item.status, item.scheduledTime, new Date())}
                    />
                    {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
                  </View>
                ))}
              </View>
            </GlassCard>
          ))
        )}
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
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  exportButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  exportButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_SURFACES.lowest,
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
  summaryCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  summaryRow: {
    gap: 6,
  },
  summaryValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
  },
  summaryBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  groupCount: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  groupStack: {
    gap: 12,
  },
  historyRow: {
    gap: 6,
  },
  notes: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    paddingHorizontal: 4,
  },
});
