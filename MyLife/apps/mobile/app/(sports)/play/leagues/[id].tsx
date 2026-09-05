import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  addScheduleEntry,
  deleteRecLeague,
  getRecLeague,
  updateRecLeagueRecord,
  type RecLeague,
  type ScheduleEntry,
} from '@mylife/sports';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../../_ui';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function sportIcon(sport: string): string {
  const map: Record<string, string> = {
    basketball: '🏀',
    soccer: '⚽️',
    softball: '🥎',
    baseball: '⚾️',
    volleyball: '🏐',
    hockey: '🏒',
    tennis: '🎾',
  };
  return map[sport] ?? '🏟️';
}

function parseDateInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isFinite(ts) ? ts : null;
}

export default function SportsRecLeagueDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [league, setLeague] = useState<RecLeague | null>(null);
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [startsAtRaw, setStartsAtRaw] = useState('');
  const [gameError, setGameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    setLeague(getRecLeague(db, id));
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const { past, upcoming } = useMemo(() => {
    if (!league) return { past: [], upcoming: [] };
    const now = Date.now();
    const past: ScheduleEntry[] = [];
    const upcoming: ScheduleEntry[] = [];
    for (const entry of league.schedule) {
      if (entry.starts_at > now) upcoming.push(entry);
      else past.push(entry);
    }
    past.sort((a, b) => b.starts_at - a.starts_at);
    upcoming.sort((a, b) => a.starts_at - b.starts_at);
    return { past, upcoming };
  }, [league]);

  const bumpRecord = useCallback(
    (key: 'wins' | 'losses' | 'ties') => {
      if (!id || !league) return;
      updateRecLeagueRecord(db, id, {
        wins: league.record_wins + (key === 'wins' ? 1 : 0),
        losses: league.record_losses + (key === 'losses' ? 1 : 0),
        ties: league.record_ties + (key === 'ties' ? 1 : 0),
      });
      reload();
    },
    [db, id, league, reload],
  );

  const handleAddGame = useCallback(() => {
    if (!id || !league) return;
    const opp = opponent.trim();
    const ts = parseDateInput(startsAtRaw);
    if (!opp) {
      setGameError('Opponent is required');
      return;
    }
    if (ts === null) {
      setGameError('Start time must be a valid date (e.g. 2026-05-10 19:00)');
      return;
    }
    setGameError(null);
    setSaving(true);
    try {
      const entry: ScheduleEntry = {
        opponent: opp,
        starts_at: ts,
        location: location.trim() === '' ? null : location.trim(),
        result: null,
      };
      addScheduleEntry(db, id, entry);
      setOpponent('');
      setLocation('');
      setStartsAtRaw('');
      reload();
    } catch (err) {
      setGameError(err instanceof Error ? err.message : 'Could not add game');
    } finally {
      setSaving(false);
    }
  }, [db, id, league, location, opponent, reload, startsAtRaw]);

  const handleDelete = useCallback(() => {
    if (!id || !league) return;
    Alert.alert(
      'Delete league?',
      'This removes the league and its schedule. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRecLeague(db, id);
            router.back();
          },
        },
      ],
    );
  }, [db, id, league, router]);

  if (!league) {
    return (
      <View style={[styles.screen, styles.emptyWrap]}>
        <Text style={styles.missingText}>League not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>
          {sportIcon(league.sport)} {league.sport}
        </Text>
        <Text style={styles.title}>{league.league_name}</Text>
        <Text style={styles.subtitle}>
          {league.team_name} · {league.season}
        </Text>

        <View style={styles.recordCard}>
          <View style={styles.recordCol}>
            <Text style={styles.recordLabel}>Wins</Text>
            <Text style={styles.recordValue}>{league.record_wins}</Text>
            <Pressable
              onPress={() => bumpRecord('wins')}
              style={styles.bumpBtn}
              accessibilityLabel="Add win"
            >
              <Text style={styles.bumpBtnText}>+1</Text>
            </Pressable>
          </View>
          <View style={styles.recordCol}>
            <Text style={styles.recordLabel}>Losses</Text>
            <Text style={styles.recordValue}>{league.record_losses}</Text>
            <Pressable
              onPress={() => bumpRecord('losses')}
              style={styles.bumpBtn}
              accessibilityLabel="Add loss"
            >
              <Text style={styles.bumpBtnText}>+1</Text>
            </Pressable>
          </View>
          <View style={styles.recordCol}>
            <Text style={styles.recordLabel}>Ties</Text>
            <Text style={styles.recordValue}>{league.record_ties}</Text>
            <Pressable
              onPress={() => bumpRecord('ties')}
              style={styles.bumpBtn}
              accessibilityLabel="Add tie"
            >
              <Text style={styles.bumpBtnText}>+1</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>Upcoming</Text>
          {upcoming.length > 0 ? (
            upcoming.map((entry, idx) => (
              <View key={`up-${idx}`} style={styles.scheduleRow}>
                <Text style={styles.scheduleOpp}>vs {entry.opponent}</Text>
                <Text style={styles.scheduleMeta}>
                  {formatDate(entry.starts_at)}
                  {entry.location ? ` · ${entry.location}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>No upcoming games.</Text>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>Past</Text>
          {past.length > 0 ? (
            past.map((entry, idx) => (
              <View key={`pa-${idx}`} style={styles.scheduleRow}>
                <Text style={styles.scheduleOpp}>vs {entry.opponent}</Text>
                <Text style={styles.scheduleMeta}>
                  {formatDate(entry.starts_at)}
                  {entry.location ? ` · ${entry.location}` : ''}
                  {entry.result ? ` · ${entry.result}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>No past games logged.</Text>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>Add game</Text>
          <TextInput
            value={opponent}
            onChangeText={setOpponent}
            placeholder="Opponent"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={startsAtRaw}
            onChangeText={setStartsAtRaw}
            placeholder="Start (YYYY-MM-DD HH:MM)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Location (optional)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          {gameError ? (
            <Text style={styles.errorText}>{gameError}</Text>
          ) : null}
          <Pressable
            onPress={handleAddGame}
            style={[styles.primaryBtn, saving && styles.disabled]}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : 'Add to schedule'}
            </Text>
          </Pressable>
        </View>

        {league.notes_md ? (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{league.notes_md}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={handleDelete}
            style={styles.destructiveBtn}
            accessibilityRole="button"
          >
            <Text style={styles.destructiveBtnText}>Delete league</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 180,
    gap: 12,
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
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  recordCard: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  recordCol: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 6,
  },
  recordLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  recordValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  bumpBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
    marginTop: 4,
  },
  bumpBtnText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '800',
  },
  block: {
    gap: 8,
    marginTop: 8,
  },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  scheduleRow: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  scheduleOpp: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  mutedText: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: 4,
  },
  input: {
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  primaryBtn: {
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
  disabled: {
    opacity: 0.5,
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
    marginTop: 16,
  },
  destructiveBtn: {
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
