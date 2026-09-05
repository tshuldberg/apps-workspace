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
  getPersonalBests,
  listSessions,
  type ParticipationSession,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

type PBEntry = {
  sport: string;
  count: number;
  latest: ParticipationSession;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(mins: number | null): string {
  if (mins === null || mins <= 0) return '';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function sportIcon(sport: string): string {
  const map: Record<string, string> = {
    basketball: '🏀',
    soccer: '⚽️',
    tennis: '🎾',
    golf: '⛳️',
    running: '🏃',
    volleyball: '🏐',
  };
  return map[sport] ?? '🏟️';
}

export default function SportsPlayScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [sessions, setSessions] = useState<ParticipationSession[]>([]);
  const [pbs, setPbs] = useState<PBEntry[]>([]);

  const reload = useCallback(() => {
    const recent = listSessions(db, { limit: 20 });
    setSessions(recent);

    const broad = listSessions(db, { limit: 500 });
    const sports = Array.from(new Set(broad.map((s) => s.sport)));
    const entries: PBEntry[] = [];
    for (const sport of sports) {
      const rows = getPersonalBests(db, sport);
      if (rows.length === 0) continue;
      entries.push({ sport, count: rows.length, latest: rows[0] });
    }
    entries.sort((a, b) => b.latest.started_at - a.latest.started_at);
    setPbs(entries);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const hasSessions = sessions.length > 0;
  const hasPbs = pbs.length > 0;

  const heroCount = useMemo(() => sessions.length, [sessions.length]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Play</Text>
      <Text style={styles.title}>Your sports life</Text>
      <Text style={styles.subtitle}>
        Log pickup games, practice, and personal records. Stats stay on-device.
      </Text>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(sports)/play/log')}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>Log session</Text>
      </Pressable>

      <Pressable
        style={styles.leaguesLink}
        onPress={() => router.push('/(sports)/play/leagues' as never)}
        accessibilityRole="button"
      >
        <Text style={styles.leaguesLinkText}>Rec leagues</Text>
        <Text style={styles.leaguesLinkChev}>›</Text>
      </Pressable>

      {hasPbs ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Personal bests</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pbRow}
          >
            {pbs.map((entry) => (
              <Pressable
                key={entry.sport}
                style={styles.pbCard}
                onPress={() =>
                  router.push(`/(sports)/play/${entry.latest.id}` as never)
                }
              >
                <Text style={styles.pbIcon}>{sportIcon(entry.sport)}</Text>
                <Text style={styles.pbSport}>{entry.sport}</Text>
                <Text style={styles.pbCount}>
                  {entry.count} PB{entry.count === 1 ? '' : 's'}
                </Text>
                <Text style={styles.pbDate}>
                  {formatDate(entry.latest.started_at)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.blockLabel}>
          Recent sessions {heroCount > 0 ? `(${heroCount})` : ''}
        </Text>
        {hasSessions ? (
          sessions.map((s) => (
            <Pressable
              key={s.id}
              style={styles.sessionRow}
              onPress={() =>
                router.push(`/(sports)/play/${s.id}` as never)
              }
              accessibilityRole="button"
            >
              <Text style={styles.sessionIcon}>{sportIcon(s.sport)}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.sessionHead}>
                  <Text style={styles.sessionSport}>{s.sport}</Text>
                  <Text style={styles.sessionActivity}>{s.activity}</Text>
                  {s.personal_best ? (
                    <View style={styles.pbBadge}>
                      <Text style={styles.pbBadgeText}>PB</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.sessionMeta}>
                  {formatDate(s.started_at)}
                  {s.duration_minutes
                    ? ` · ${formatDuration(s.duration_minutes)}`
                    : ''}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No sessions yet. Tap Log Session to record your first pickup
              game.
            </Text>
          </View>
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
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: SPORTS_ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  leaguesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaguesLinkText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  leaguesLinkChev: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 22,
  },
  block: {
    gap: 10,
    marginTop: 8,
  },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  pbRow: {
    gap: 10,
    paddingRight: 4,
  },
  pbCard: {
    width: 140,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  pbIcon: {
    fontSize: 22,
  },
  pbSport: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pbCount: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  pbDate: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionIcon: {
    fontSize: 22,
  },
  sessionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sessionSport: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sessionActivity: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  pbBadge: {
    backgroundColor: SPORTS_ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pbBadgeText: {
    color: '#0E0E13',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
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
