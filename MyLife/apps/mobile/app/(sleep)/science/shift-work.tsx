import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ExpectedSleepWindow, SleepEntryRecord } from '@mylife/sleep';
import {
  evaluateShiftSleep,
  getExpectedSleepWindow,
  listEntries,
  setShiftPattern,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SLEEP_ACCENT } from '../_ui';

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildWindow(
  selectedDate: string,
  startTime: string,
  endTime: string,
  daysOfWeek: readonly number[],
): { window: ExpectedSleepWindow | null; error: string | null } {
  try {
    const pattern = setShiftPattern([
      {
        startTime,
        endTime,
        daysOfWeek,
      },
    ]);
    return {
      window: getExpectedSleepWindow(selectedDate, pattern),
      error: null,
    };
  } catch (error) {
    return {
      window: null,
      error: error instanceof Error ? error.message : 'Unable to build shift window.',
    };
  }
}

export default function SleepShiftWorkScreen() {
  const db = useDatabase();
  const [entries, setEntries] = useState<SleepEntryRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('06:00');
  const [daysOfWeek, setDaysOfWeek] = useState([1, 2, 3, 4, 5]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadEntries = useCallback(() => {
    setEntries(listEntries(db, { limit: 30 }));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries]),
  );

  const windowResult = useMemo(
    () => buildWindow(selectedDate, startTime, endTime, daysOfWeek),
    [daysOfWeek, endTime, selectedDate, startTime],
  );
  const latestEntry = entries[0] ?? null;
  const evaluation =
    latestEntry && windowResult.window
      ? evaluateShiftSleep(latestEntry, windowResult.window)
      : null;

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadEntries();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEntries]);

  const toggleDay = useCallback((day: number) => {
    setDaysOfWeek((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={SLEEP_ACCENT}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Sleep Science</Text>
        <Text style={styles.title}>Shift work mode</Text>
        <Text style={styles.body}>
          Define a shift block and MySleep estimates when the recovery sleep window should land.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Shift pattern</Text>
        <View style={styles.fieldRow}>
          <Field label="Date" value={selectedDate} onChangeText={setSelectedDate} />
          <Field label="Start" value={startTime} onChangeText={setStartTime} />
          <Field label="End" value={endTime} onChangeText={setEndTime} />
        </View>
        <View style={styles.dayRow}>
          {DAY_OPTIONS.map((day) => {
            const selected = daysOfWeek.includes(day.value);
            return (
              <Pressable
                key={day.value}
                onPress={() => toggleDay(day.value)}
                style={[styles.dayPill, selected ? styles.dayPillActive : null]}
              >
                <Text
                  style={[
                    styles.dayPillText,
                    selected ? styles.dayPillTextActive : null,
                  ]}
                >
                  {day.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {windowResult.error ? (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>Check pattern</Text>
          <Text style={styles.body}>{windowResult.error}</Text>
        </View>
      ) : windowResult.window ? (
        <>
          <View style={styles.resultCard}>
            <Text style={styles.cardEyebrow}>Expected sleep</Text>
            <Text style={styles.resultTitle}>
              {windowResult.window.sleepStartTime} - {windowResult.window.sleepEndTime}
            </Text>
            <Text style={styles.body}>
              After a {startTime} to {endTime} shift on {selectedDate}.
            </Text>
          </View>

          <View style={styles.metricGrid}>
            <Metric label="Shift start" value={startTime} />
            <Metric label="Shift end" value={endTime} />
            <Metric
              label="Sleep duration"
              value={`${windowResult.window.sleepDurationMinutes / 60}h`}
            />
            <Metric label="Recent logs" value={String(entries.length)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Latest match</Text>
            {evaluation ? (
              <>
                <Text style={styles.cardTitle}>{evaluation.score}% aligned</Text>
                <Text style={styles.body}>
                  {evaluation.rating.replace('_', ' ')} with {evaluation.overlapMinutes} minutes overlapping the expected window.
                </Text>
              </>
            ) : (
              <Text style={styles.body}>
                Log sleep after this shift to score alignment.
              </Text>
            )}
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>No shift today</Text>
          <Text style={styles.body}>
            The selected date does not match the active shift days.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultCard: {
    gap: 10,
    padding: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
  },
  cardEyebrow: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  resultTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flex: 1,
    minWidth: 96,
    gap: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayPillActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.40)',
  },
  dayPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  dayPillTextActive: {
    color: '#E9DDFF',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    minWidth: 150,
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
});
