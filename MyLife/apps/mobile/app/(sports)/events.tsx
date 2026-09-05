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
import {
  getAttendanceStats,
  listAttendance,
  type Attendance,
  type AttendanceStats,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

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

function stars(rating: number | null): string {
  if (rating === null) return '';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function seatLabel(row: Attendance): string {
  const parts: string[] = [];
  if (row.section) parts.push(`sec ${row.section}`);
  if (row.row_label) parts.push(`row ${row.row_label}`);
  if (row.seat) parts.push(`seat ${row.seat}`);
  return parts.join(' · ');
}

export default function SportsEventsScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [rows, setRows] = useState<Attendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const reload = useCallback(() => {
    setRows(listAttendance(db, { limit: 20 }));
    setStats(getAttendanceStats(db, { year: currentYear }));
  }, [db, currentYear]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Attendance</Text>
      <Text style={styles.title}>Games attended</Text>
      <Text style={styles.subtitle}>
        Track games you attend in person. Seats, cost, companions, ratings.
        Private to this device.
      </Text>

      <View style={styles.ctaRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(sports)/events/log' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Log attendance</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(sports)/events/venues' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Venues</Text>
        </Pressable>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Collections</Text>
        <View style={styles.ctaRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              router.push('/(sports)/events/memorabilia' as never)
            }
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Memorabilia</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              router.push('/(sports)/events/watch-party' as never)
            }
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Watch parties</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{currentYear} games</Text>
          <Text style={styles.statValue}>{stats?.gamesAttended ?? 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{currentYear} spent</Text>
          <Text style={styles.statValue}>
            {formatCost(stats?.totalSpentCents ?? 0)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Venues</Text>
          <Text style={styles.statValue}>{stats?.uniqueVenues ?? 0}</Text>
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Recent</Text>
        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No games attended yet. Tap Log Attendance to record your first.
            </Text>
          </View>
        ) : (
          rows.map((row) => {
            const seat = seatLabel(row);
            return (
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
                  {seat ? (
                    <Text style={styles.rowMeta}>{seat}</Text>
                  ) : null}
                  <Text style={styles.rowMeta}>
                    {formatDate(row.attended_at)} · {formatCost(row.cost_cents)}
                  </Text>
                </View>
                {row.rating !== null ? (
                  <Text style={styles.stars}>{stars(row.rating)}</Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 12,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: SPORTS_ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
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
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  block: {
    gap: 10,
    marginTop: 6,
  },
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
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  stars: {
    color: SPORTS_ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
