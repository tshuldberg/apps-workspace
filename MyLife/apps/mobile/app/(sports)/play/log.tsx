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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  METRICS_BY_SPORT,
  detectPersonalBest,
  getSession,
  listSessions,
  logSession,
  updateSession,
  type ActivityType,
  type ParticipationSession,
  type SessionStats,
  type StatMetric,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const SPORTS: Array<{ key: string; label: string }> = [
  { key: 'basketball', label: 'Basketball' },
  { key: 'soccer', label: 'Soccer' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'golf', label: 'Golf' },
  { key: 'running', label: 'Running' },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'other', label: 'Other' },
];

const ACTIVITIES: Array<{ key: ActivityType; label: string }> = [
  { key: 'game', label: 'Game' },
  { key: 'practice', label: 'Practice' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'training', label: 'Training' },
];

function formatMetricLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseNumeric(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function SportsPlayLogScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ editId?: string }>();
  const editId = typeof params.editId === 'string' ? params.editId : undefined;

  const existing = useMemo<ParticipationSession | null>(() => {
    if (!editId) return null;
    return getSession(db, editId);
  }, [db, editId]);

  const [sport, setSport] = useState<string>(existing?.sport ?? 'basketball');
  const [activity, setActivity] = useState<ActivityType>(
    existing?.activity ?? 'pickup',
  );
  const [playedAt, setPlayedAt] = useState<number>(
    existing?.started_at ?? Date.now(),
  );
  const [duration, setDuration] = useState<string>(
    existing?.duration_minutes != null ? String(existing.duration_minutes) : '',
  );
  const [statValues, setStatValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (existing) {
      for (const [k, v] of Object.entries(existing.stats)) {
        init[k] = String(v);
      }
    }
    return init;
  });
  const [customStats, setCustomStats] = useState<
    Array<{ key: string; value: string }>
  >(() => {
    if (!existing) return [{ key: '', value: '' }];
    const presetKeys = new Set(
      (METRICS_BY_SPORT[existing.sport] ?? []).map((m) => m.name),
    );
    const extras = Object.entries(existing.stats).filter(
      ([k]) => !presetKeys.has(k),
    );
    if (extras.length === 0) return [{ key: '', value: '' }];
    return extras.map(([k, v]) => ({ key: k, value: String(v) }));
  });
  const [notes, setNotes] = useState<string>(existing?.notes_md ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetMetrics = useMemo<readonly StatMetric[]>(
    () => METRICS_BY_SPORT[sport] ?? [],
    [sport],
  );

  const buildStats = useCallback((): SessionStats => {
    const result: SessionStats = {};
    for (const metric of presetMetrics) {
      const raw = statValues[metric.name];
      if (raw === undefined) continue;
      const n = parseNumeric(raw);
      if (n !== null) result[metric.name] = n;
    }
    for (const row of customStats) {
      const k = row.key.trim();
      if (!k) continue;
      const n = parseNumeric(row.value);
      if (n !== null) result[k] = n;
    }
    return result;
  }, [presetMetrics, statValues, customStats]);

  const handleSave = useCallback(() => {
    setError(null);
    setSaving(true);
    try {
      const stats = buildStats();
      const dur = parseNumeric(duration);

      if (editId && existing) {
        updateSession(db, editId, {
          sport,
          activity,
          started_at: playedAt,
          duration_minutes: dur,
          stats,
          notes_md: notes.trim() === '' ? null : notes.trim(),
        });
        router.replace(`/(sports)/play/${editId}` as never);
        return;
      }

      const prior = listSessions(db, { sport });
      const pb = detectPersonalBest(
        {
          id: 'draft',
          sport,
          activity,
          started_at: playedAt,
          duration_minutes: dur,
          location: null,
          teammates: [],
          stats,
          personal_best: false,
          mood_before: null,
          mood_after: null,
          injury_notes: null,
          notes_md: null,
          photo_ids: [],
          created_at: Date.now(),
        },
        prior,
        presetMetrics,
      );

      const saved = logSession(db, {
        sport,
        activity,
        started_at: playedAt,
        duration_minutes: dur,
        stats,
        personal_best: pb.isPB,
        notes_md: notes.trim() === '' ? null : notes.trim(),
      });

      if (pb.isPB) {
        Alert.alert('Session logged', 'New personal best!');
      }
      router.replace(`/(sports)/play/${saved.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save session');
    } finally {
      setSaving(false);
    }
  }, [
    activity,
    buildStats,
    db,
    duration,
    editId,
    existing,
    notes,
    playedAt,
    presetMetrics,
    router,
    sport,
  ]);

  const updateCustomRow = (
    idx: number,
    patch: Partial<{ key: string; value: string }>,
  ) => {
    setCustomStats((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );
  };

  const addCustomRow = () =>
    setCustomStats((prev) => [...prev, { key: '', value: '' }]);

  const removeCustomRow = (idx: number) =>
    setCustomStats((prev) => prev.filter((_, i) => i !== idx));

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
          {editId ? 'Edit session' : 'Log session'}
        </Text>
        <Text style={styles.title}>
          {editId ? 'Update details' : 'New session'}
        </Text>

        <Text style={styles.label}>Sport</Text>
        <View style={styles.wrapRow}>
          {SPORTS.map((s) => {
            const active = sport === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSport(s.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Activity</Text>
        <View style={styles.segmentRow}>
          {ACTIVITIES.map((a) => {
            const active = activity === a.key;
            return (
              <Pressable
                key={a.key}
                onPress={() => setActivity(a.key)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Played at</Text>
        <View style={styles.playedRow}>
          <Text style={styles.playedText}>
            {new Date(playedAt).toLocaleString()}
          </Text>
          <Pressable
            onPress={() => setPlayedAt(Date.now())}
            style={styles.nowBtn}
          >
            <Text style={styles.nowBtnText}>Now</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          placeholder="60"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        {presetMetrics.length > 0 ? (
          <>
            <Text style={styles.label}>Stats</Text>
            {presetMetrics.map((metric) => (
              <View key={metric.name} style={styles.statRow}>
                <Text style={styles.statLabel}>
                  {formatMetricLabel(metric.name)}
                </Text>
                <TextInput
                  value={statValues[metric.name] ?? ''}
                  onChangeText={(v) =>
                    setStatValues((prev) => ({ ...prev, [metric.name]: v }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, styles.statInput]}
                />
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.label}>Custom stats</Text>
        {customStats.map((row, idx) => (
          <View key={idx} style={styles.customRow}>
            <TextInput
              value={row.key}
              onChangeText={(v) => updateCustomRow(idx, { key: v })}
              placeholder="metric name"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="none"
            />
            <TextInput
              value={row.value}
              onChangeText={(v) => updateCustomRow(idx, { value: v })}
              keyboardType="decimal-pad"
              placeholder="value"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { width: 100 }]}
            />
            {customStats.length > 1 ? (
              <Pressable
                onPress={() => removeCustomRow(idx)}
                style={styles.removeBtn}
                accessibilityLabel="Remove stat"
              >
                <Text style={styles.removeBtnText}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable onPress={addCustomRow} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add custom stat</Text>
        </Pressable>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it go? Weather, teammates, takeaways…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
          multiline
          textAlignVertical="top"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Save session'}
            </Text>
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
    gap: 10,
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
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 8,
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
  notesInput: {
    minHeight: 90,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#0E0E13',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0E0E13',
  },
  playedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playedText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
    paddingVertical: 10,
  },
  nowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
  },
  nowBtnText: {
    color: SPORTS_ACCENT,
    fontWeight: '700',
    fontSize: 13,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  statInput: {
    width: 100,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.textSecondary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addBtnText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
