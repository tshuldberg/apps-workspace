import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  createJournalEntry,
  getJournalStreak,
  listDestinations,
  listJournalEntriesByMonth,
  listTrips,
  type DestinationRecord,
  type JournalEntryInput,
  type JournalEntryRow,
  type TripRow,
} from '@mylife/travel';
import { useDatabase } from '../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from './_ui';

const MOOD_ICONS: Record<number, string> = {
  1: '\u{1F614}',
  2: '\u{1F615}',
  3: '\u{1F610}',
  4: '\u{1F642}',
  5: '\u{1F604}',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMonth(key: string): string {
  const [yStr, mStr] = key.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (Number.isNaN(y) || Number.isNaN(m)) return key;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function previewBody(body: string): string {
  if (!body) return '';
  const lines = body.split('\n').filter((l) => l.trim().length > 0);
  return lines.slice(0, 2).join(' ');
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function TravelJournalScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [status, setStatus] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [grouped, setGrouped] = useState<Record<string, JournalEntryRow[]>>({});
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [destinations, setDestinations] = useState<DestinationRecord[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fTripId, setFTripId] = useState<string | null>(null);
  const [fDestId, setFDestId] = useState<string | null>(null);
  const [fDate, setFDate] = useState(todayIso());
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [fMood, setFMood] = useState<number | null>(null);
  const [fWeather, setFWeather] = useState('');
  const [fLocation, setFLocation] = useState('');

  const load = useCallback(() => {
    setStatus('loading');
    try {
      setGrouped(listJournalEntriesByMonth(db, year));
      setStreak(getJournalStreak(db));
      setTrips(listTrips(db));
      setDestinations(listDestinations(db));
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load journal');
      setStatus('error');
    }
  }, [db, year]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const monthKeys = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
  }, [grouped]);

  const hasEntries = monthKeys.length > 0;

  const resetForm = () => {
    setFTripId(null);
    setFDestId(null);
    setFDate(todayIso());
    setFTitle('');
    setFBody('');
    setFMood(null);
    setFWeather('');
    setFLocation('');
  };

  const submit = async () => {
    const date = fDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
      return;
    }
    const input: JournalEntryInput = {
      trip_id: fTripId ?? undefined,
      destination_id: fDestId ?? undefined,
      entry_date: date,
      title: fTitle.trim() || undefined,
      body_md: fBody,
      mood: fMood ?? undefined,
      weather: fWeather.trim() || undefined,
      location_label: fLocation.trim() || undefined,
    };
    setSaving(true);
    try {
      createJournalEntry(db, input);
      setShowForm(false);
      resetForm();
      load();
    } catch (e) {
      Alert.alert(
        'Could not save entry',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Journal</Text>
        <Text style={styles.title}>Travel stories</Text>
        <Text style={styles.subtitle}>
          Daily notes from the road, tied to trips, destinations, and mood.
        </Text>
      </View>

      <View style={styles.streakCard}>
        <View style={styles.streakCol}>
          <Text style={styles.streakLabel}>Current streak</Text>
          <Text style={styles.streakValue}>
            {streak.current} {streak.current === 1 ? 'day' : 'days'}
          </Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakCol}>
          <Text style={styles.streakLabel}>Longest</Text>
          <Text style={styles.streakValue}>
            {streak.longest} {streak.longest === 1 ? 'day' : 'days'}
          </Text>
        </View>
      </View>

      <View style={styles.yearRow}>
        <Pressable
          style={styles.yearBtn}
          onPress={() => setYear((y) => y - 1)}
          accessibilityLabel="Previous year"
        >
          <Text style={styles.yearBtnText}>{'\u2039'}</Text>
        </Pressable>
        <Text style={styles.yearText}>{year}</Text>
        <Pressable
          style={styles.yearBtn}
          onPress={() => setYear((y) => y + 1)}
          accessibilityLabel="Next year"
        >
          <Text style={styles.yearBtnText}>{'\u203A'}</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.newBtn}
          onPress={() => setShowForm((v) => !v)}
          accessibilityRole="button"
        >
          <Text style={styles.newBtnText}>
            {showForm ? 'Cancel' : '+ New entry'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.memoriesBtn}
          onPress={() => router.push('/(travel)/memories' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.memoriesBtnText}>Memories</Text>
        </Pressable>
      </View>

      {showForm ? (
        <View style={styles.formPanel}>
          <Text style={styles.sectionTitle}>New entry</Text>

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            value={fDate}
            onChangeText={setFDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Title (optional)</Text>
          <TextInput
            value={fTitle}
            onChangeText={setFTitle}
            placeholder="A day in Kyoto..."
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Body</Text>
          <TextInput
            value={fBody}
            onChangeText={setFBody}
            placeholder="What happened today..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.inputMultiline]}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Mood</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((m) => (
              <Pressable
                key={m}
                style={[
                  styles.moodChip,
                  fMood === m ? styles.moodChipActive : null,
                ]}
                onPress={() => setFMood(fMood === m ? null : m)}
              >
                <Text style={styles.moodChipText}>{MOOD_ICONS[m]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Trip (optional)</Text>
          <View style={styles.pickerRow}>
            <Pressable
              style={[
                styles.pickChip,
                fTripId === null ? styles.pickChipActive : null,
              ]}
              onPress={() => setFTripId(null)}
            >
              <Text style={styles.pickChipText}>None</Text>
            </Pressable>
            {trips.slice(0, 12).map((t) => (
              <Pressable
                key={t.id}
                style={[
                  styles.pickChip,
                  fTripId === t.id ? styles.pickChipActive : null,
                ]}
                onPress={() => setFTripId(t.id)}
              >
                <Text style={styles.pickChipText} numberOfLines={1}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Destination (optional)</Text>
          <View style={styles.pickerRow}>
            <Pressable
              style={[
                styles.pickChip,
                fDestId === null ? styles.pickChipActive : null,
              ]}
              onPress={() => setFDestId(null)}
            >
              <Text style={styles.pickChipText}>None</Text>
            </Pressable>
            {destinations.slice(0, 12).map((d) => (
              <Pressable
                key={d.id}
                style={[
                  styles.pickChip,
                  fDestId === d.id ? styles.pickChipActive : null,
                ]}
                onPress={() => setFDestId(d.id)}
              >
                <Text style={styles.pickChipText} numberOfLines={1}>
                  {d.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Weather (optional)</Text>
          <TextInput
            value={fWeather}
            onChangeText={setFWeather}
            placeholder="Sunny, 72F"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Location label (optional)</Text>
          <TextInput
            value={fLocation}
            onChangeText={setFLocation}
            placeholder="Café de Flore, Paris"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          <Pressable
            style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
            onPress={submit}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Save entry'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'loading' ? (
        <View style={styles.panel}>
          <ActivityIndicator color={TRAVEL_ACCENT} />
          <Text style={styles.muted}>Loading journal...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.panel, styles.errorPanel]}>
          <Text style={styles.errorText}>
            {error ?? 'Something went wrong.'}
          </Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' && !hasEntries ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>No entries yet</Text>
          <Text style={styles.muted}>
            Your travel stories start here. Add your first entry.
          </Text>
        </View>
      ) : null}

      {status === 'ready' && hasEntries
        ? monthKeys.map((key) => {
            const rows = grouped[key] ?? [];
            return (
              <View key={key} style={styles.monthGroup}>
                <Text style={styles.monthLabel}>{formatMonth(key)}</Text>
                <View style={styles.entryList}>
                  {rows.map((row) => (
                    <Pressable
                      key={row.id}
                      style={styles.entryRow}
                      onPress={() =>
                        router.push(`/(travel)/journal/${row.id}` as never)
                      }
                    >
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryDate}>{row.entry_date}</Text>
                        {row.mood != null ? (
                          <Text style={styles.entryMood}>
                            {MOOD_ICONS[row.mood] ?? ''}
                          </Text>
                        ) : null}
                      </View>
                      {row.title ? (
                        <Text style={styles.entryTitle} numberOfLines={1}>
                          {row.title}
                        </Text>
                      ) : null}
                      <Text style={styles.entryBody} numberOfLines={2}>
                        {previewBody(row.body_md)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  hero: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  streakCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  streakCol: { flex: 1, gap: 4, alignItems: 'center' },
  streakDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  streakLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  streakValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  yearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBtnText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  yearText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 64,
    textAlign: 'center',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  newBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TRAVEL_ACCENT,
    alignItems: 'center',
  },
  newBtnText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  memoriesBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoriesBtnText: { color: TRAVEL_ACCENT, fontSize: 14, fontWeight: '700' },
  formPanel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 4,
  },
  input: {
    backgroundColor: surfaceTiers.container,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 100 },
  moodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  moodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodChipActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: TRAVEL_ACCENT,
  },
  moodChipText: { fontSize: 18 },
  pickerRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  pickChipActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: TRAVEL_ACCENT,
  },
  pickChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: TRAVEL_ACCENT,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorPanel: {
    borderColor: '#93000A',
    backgroundColor: 'rgba(147,0,10,0.12)',
  },
  errorText: { color: '#FFB4AB', fontSize: 14, lineHeight: 20 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  monthGroup: { gap: 8 },
  monthLabel: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  entryList: { gap: 8 },
  entryRow: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDate: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  entryMood: { fontSize: 18 },
  entryTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  entryBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
