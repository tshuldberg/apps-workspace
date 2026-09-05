import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import { listAttendance, type Attendance } from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

function isWatchParty(row: Attendance): boolean {
  return (
    row.section === null && row.row_label === null && row.seat === null
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCost(cents: number): string {
  if (cents <= 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

export default function WatchPartyScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [rows, setRows] = useState<Attendance[]>([]);

  const reload = useCallback(() => {
    const all = listAttendance(db, { limit: 200 });
    setRows(all.filter(isWatchParty));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const totalCost = useMemo(
    () => rows.reduce((sum, r) => sum + r.cost_cents, 0),
    [rows],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Watch parties</Text>
      <Text style={styles.title}>Games watched</Text>
      <Text style={styles.subtitle}>
        Home, bar, or a friend's place. Food, drinks, who came. No seats
        needed.
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Parties</Text>
          <Text style={styles.statValue}>{rows.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total spent</Text>
          <Text style={styles.statValue}>{formatCost(totalCost)}</Text>
        </View>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() =>
          router.push('/(sports)/events/log?mode=watch-party' as never)
        }
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>Log watch party</Text>
      </Pressable>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Recent</Text>
        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No watch parties yet. Log one to track the game, the venue, and
              who you watched with.
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.id}
              style={styles.row}
              onPress={() =>
                router.push(`/(sports)/events/${row.id}` as never)
              }
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{row.venue_name}</Text>
                <Text style={styles.rowMeta}>
                  {formatDate(row.attended_at)} · {formatCost(row.cost_cents)}
                  {row.companions.length > 0
                    ? ` · ${row.companions.length} with you`
                    : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 140, gap: 12 },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  primaryButton: {
    backgroundColor: SPORTS_ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  block: { gap: 10, marginTop: 6 },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
