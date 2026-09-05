import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createNap } from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SLEEP_ACCENT } from '../_ui';

type NapMode = 'just_napped' | 'about_to_nap';

const DURATION_PRESETS = [10, 20, 25, 30, 45, 90];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function timeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startFromNow(minutesAgo: number): { date: string; time: string } {
  const date = new Date(Date.now() - (minutesAgo * 60 * 1000));
  return {
    date: dateValue(date),
    time: timeValue(date),
  };
}

function parseDuration(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export default function SleepNapLogScreen() {
  const db = useDatabase();
  const router = useRouter();
  const justNappedStart = useMemo(() => startFromNow(25), []);
  const aboutToNapStart = useMemo(() => startFromNow(0), []);
  const [mode, setMode] = useState<NapMode>('just_napped');
  const [napDate, setNapDate] = useState(justNappedStart.date);
  const [startTime, setStartTime] = useState(justNappedStart.time);
  const [durationText, setDurationText] = useState('25');
  const [intentional, setIntentional] = useState(true);
  const [quality, setQuality] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const applyMode = useCallback(
    (nextMode: NapMode) => {
      setMode(nextMode);
      const nextStart =
        nextMode === 'about_to_nap' ? aboutToNapStart : justNappedStart;
      setNapDate(nextStart.date);
      setStartTime(nextStart.time);
      setDurationText(nextMode === 'about_to_nap' ? '20' : '25');
      setIntentional(nextMode === 'about_to_nap');
    },
    [aboutToNapStart, justNappedStart],
  );

  const handleSave = useCallback(() => {
    const duration = parseDuration(durationText);
    if (!duration) {
      Alert.alert('Check duration', 'Use a whole number of minutes.');
      return;
    }
    if (!isClockTime(startTime)) {
      Alert.alert('Check start time', 'Use 24-hour time like 14:30.');
      return;
    }

    try {
      createNap(db, {
        date: napDate,
        start_time: `${napDate}T${startTime}:00.000Z`,
        duration_minutes: duration,
        intentional,
        ...(quality ? { quality } : {}),
        notes: notes.trim() || undefined,
      });
      router.replace('/(sleep)/nap/history' as never);
    } catch (error) {
      Alert.alert(
        'Nap not saved',
        error instanceof Error ? error.message : 'Check the nap details.',
      );
    }
  }, [
    db,
    durationText,
    intentional,
    napDate,
    notes,
    quality,
    router,
    startTime,
  ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Nap Log</Text>
        <Text style={styles.heroTitle}>Log a nap in a few taps.</Text>
        <Text style={styles.heroCopy}>
          Use a preset, keep the intentional flag honest, and add quality only
          when it is useful.
        </Text>
      </View>

      <View style={styles.segment}>
        <SegmentButton
          active={mode === 'just_napped'}
          label="I just napped"
          onPress={() => applyMode('just_napped')}
        />
        <SegmentButton
          active={mode === 'about_to_nap'}
          label="I'm about to nap"
          onPress={() => applyMode('about_to_nap')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Duration</Text>
        <View style={styles.presetGrid}>
          {DURATION_PRESETS.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => setDurationText(String(minutes))}
              style={[
                styles.presetButton,
                durationText === String(minutes) && styles.presetButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  durationText === String(minutes) &&
                    styles.presetButtonTextActive,
                ]}
              >
                {minutes}m
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={durationText}
          onChangeText={setDurationText}
          keyboardType="number-pad"
          placeholder="Minutes"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Start time</Text>
        <View style={styles.inlineGrid}>
          <TextInput
            value={napDate}
            onChangeText={setNapDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={startTime}
            onChangeText={setStartTime}
            placeholder="14:30"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.cardTitle}>Intentional nap</Text>
            <Text style={styles.cardCopy}>
              Turn this off for couch naps, dozing in transit, or accidental
              naps.
            </Text>
          </View>
          <Switch
            value={intentional}
            onValueChange={setIntentional}
            thumbColor={intentional ? SLEEP_ACCENT : colors.textSecondary}
            trackColor={{
              false: 'rgba(255,255,255,0.12)',
              true: 'rgba(167,139,250,0.35)',
            }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quality</Text>
        <View style={styles.qualityRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => setQuality(value)}
              style={[
                styles.qualityButton,
                quality === value && styles.qualityButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.qualityButtonText,
                  quality === value && styles.qualityButtonTextActive,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Optional"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.replace('/(sleep)/nap/history' as never)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>History</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Save Nap</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text
        style={[
          styles.segmentButtonText,
          active && styles.segmentButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.26)',
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  segment: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.38)',
  },
  segmentButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentButtonTextActive: {
    color: colors.text,
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  cardCopy: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    minWidth: 64,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetButtonActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.38)',
  },
  presetButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  presetButtonTextActive: {
    color: colors.text,
  },
  inlineGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  switchCopy: {
    flex: 1,
    gap: 6,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qualityButtonActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.38)',
  },
  qualityButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '800',
  },
  qualityButtonTextActive: {
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
