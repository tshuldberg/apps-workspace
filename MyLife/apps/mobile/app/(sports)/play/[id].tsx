import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  METRICS_BY_SPORT,
  deleteSession,
  detectPersonalBest,
  getSession,
  listSessions,
  type DetectPersonalBestResult,
  type ParticipationSession,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

function formatMetricLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(mins: number | null): string {
  if (mins === null || mins <= 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatValue(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

export default function SportsPlaySessionDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [session, setSession] = useState<ParticipationSession | null>(null);
  const [pb, setPb] = useState<DetectPersonalBestResult | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    const row = getSession(db, id);
    setSession(row);
    if (!row) {
      setPb(null);
      return;
    }
    const allForSport = listSessions(db, { sport: row.sport });
    const siblings = allForSport.filter((s) => s.id !== row.id);
    setPb(
      detectPersonalBest(row, siblings, METRICS_BY_SPORT[row.sport] ?? []),
    );
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const presetLookup = useMemo(() => {
    if (!session) return new Map<string, boolean>();
    const lookup = new Map<string, boolean>();
    for (const m of METRICS_BY_SPORT[session.sport] ?? []) {
      lookup.set(m.name, m.higherIsBetter);
    }
    return lookup;
  }, [session]);

  const handleDelete = useCallback(() => {
    if (!id || !session) return;
    Alert.alert(
      'Delete session?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSession(db, id);
            router.back();
          },
        },
      ],
    );
  }, [db, id, router, session]);

  const handleEdit = useCallback(() => {
    if (!id) return;
    router.push(`/(sports)/play/log?editId=${id}` as never);
  }, [id, router]);

  if (!session) {
    return (
      <View style={[styles.screen, styles.emptyWrap]}>
        <Text style={styles.missingText}>Session not found.</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const statEntries = Object.entries(session.stats);
  const pbBreakdownByMetric = new Map(
    (pb?.breakdowns ?? []).map((b) => [b.metric, b]),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>{session.activity}</Text>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{session.sport}</Text>
        {pb?.isPB ? (
          <View style={styles.pbBadge}>
            <Text style={styles.pbBadgeText}>PB</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Played at</Text>
          <Text style={styles.metaValue}>
            {formatDateTime(session.started_at)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Duration</Text>
          <Text style={styles.metaValue}>
            {formatDuration(session.duration_minutes)}
          </Text>
        </View>
      </View>

      {statEntries.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Stats</Text>
          {statEntries.map(([key, value]) => {
            const breakdown = pbBreakdownByMetric.get(key);
            const isPreset = presetLookup.has(key);
            const improved = breakdown?.improved ?? false;
            return (
              <View key={key} style={styles.statRow}>
                <Text style={styles.statLabel}>{formatMetricLabel(key)}</Text>
                <View style={styles.statValueWrap}>
                  <Text style={styles.statValue}>
                    {formatValue(Number(value))}
                  </Text>
                  {isPreset && improved ? (
                    <View style={styles.newBestBadge}>
                      <Text style={styles.newBestText}>new best</Text>
                    </View>
                  ) : null}
                  {isPreset &&
                  !improved &&
                  breakdown?.previousBest !== null &&
                  breakdown?.previousBest !== undefined ? (
                    <Text style={styles.prevBestText}>
                      prev {formatValue(breakdown.previousBest)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {session.notes_md ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{session.notes_md}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          onPress={handleDelete}
          style={styles.destructiveBtn}
          accessibilityRole="button"
        >
          <Text style={styles.destructiveBtnText}>Delete</Text>
        </Pressable>
        <Pressable
          onPress={handleEdit}
          style={styles.primaryBtn}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Edit</Text>
        </Pressable>
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
    gap: 14,
  },
  emptyWrap: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missingText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  pbBadge: {
    backgroundColor: SPORTS_ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pbBadgeText: {
    color: '#0E0E13',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metaCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
  },
  block: {
    gap: 10,
  },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    color: colors.text,
    fontSize: 14,
  },
  statValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  newBestBadge: {
    backgroundColor: SPORTS_ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBestText: {
    color: '#0E0E13',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  prevBestText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  notesCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  destructiveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: '#F87171',
    alignItems: 'center',
  },
  destructiveBtnText: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
