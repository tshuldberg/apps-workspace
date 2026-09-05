import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  logVital,
  getVitalsByType,
  type VitalType,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

// ─── Vital type presets ─────────────────────────────────────────────────────

interface VitalPreset {
  type: VitalType;
  label: string;
  unit: string;
  icon: string;
  placeholder: string;
  placeholderSecondary?: string;
  isDualInput: boolean;
}

const VITAL_PRESETS: VitalPreset[] = [
  { type: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', icon: '\u{1FA7A}', placeholder: '120', placeholderSecondary: '80', isDualInput: true },
  { type: 'heart_rate', label: 'Heart Rate', unit: 'bpm', icon: '\u{2764}\uFE0F', placeholder: '72', isDualInput: false },
  { type: 'blood_oxygen', label: 'Blood Oxygen', unit: '%', icon: '\u{1FA78}', placeholder: '98', isDualInput: false },
  { type: 'body_temperature', label: 'Temperature', unit: '\u00B0F', icon: '\u{1F321}\uFE0F', placeholder: '98.6', isDualInput: false },
  { type: 'respiratory_rate', label: 'Respiratory Rate', unit: 'breaths/min', icon: '\u{1F32C}\uFE0F', placeholder: '16', isDualInput: false },
  { type: 'steps', label: 'Steps', unit: 'steps', icon: '\u{1F6B6}', placeholder: '10000', isDualInput: false },
  { type: 'active_energy', label: 'Active Energy', unit: 'kcal', icon: '\u{1F525}', placeholder: '350', isDualInput: false },
  { type: 'resting_heart_rate', label: 'Resting Heart Rate', unit: 'bpm', icon: '\u{1F49C}', placeholder: '65', isDualInput: false },
  { type: 'hrv', label: 'HRV', unit: 'ms', icon: '\u{1F4C8}', placeholder: '45', isDualInput: false },
  { type: 'vo2_max', label: 'VO2 Max', unit: 'mL/kg/min', icon: '\u{1F3C3}', placeholder: '42', isDualInput: false },
];

// ─── Feeling emoji data ─────────────────────────────────────────────────────

const FEELINGS = [
  { value: 1, emoji: '\u{1F629}', label: 'Terrible' },
  { value: 2, emoji: '\u{1F61F}', label: 'Bad' },
  { value: 3, emoji: '\u{1F610}', label: 'Okay' },
  { value: 4, emoji: '\u{1F60A}', label: 'Good' },
  { value: 5, emoji: '\u{1F604}', label: 'Great' },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(date: Date): { dateStr: string; timeStr: string } {
  return {
    dateStr: date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    timeStr: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

function formatRecentDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function MeasurementLogScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();

  const initialType = VITAL_PRESETS.find((p) => p.type === params.type)?.type ?? 'blood_pressure';
  const [selected, setSelected] = useState<VitalType>(initialType);
  const [value, setValue] = useState('');
  const [valueSecondary, setValueSecondary] = useState('');
  const [feeling, setFeeling] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [saveCount, setSaveCount] = useState(0);

  const preset = VITAL_PRESETS.find((p) => p.type === selected) ?? VITAL_PRESETS[0];
  const timestamp = useMemo(() => new Date(), []);
  const { dateStr, timeStr } = formatTimestamp(timestamp);

  const recentEntries = useMemo(() => {
    try {
      return getVitalsByType(db, selected, 5);
    } catch {
      return [];
    }
  }, [db, selected, saveCount]);

  const handleSave = useCallback(() => {
    const numVal = Number(value);
    if (!Number.isFinite(numVal) || numVal <= 0) {
      Alert.alert('Invalid value', 'Please enter a valid number.');
      return;
    }

    if (preset.isDualInput) {
      const secVal = Number(valueSecondary);
      if (!Number.isFinite(secVal) || secVal <= 0) {
        Alert.alert('Invalid value', 'Please enter both systolic and diastolic values.');
        return;
      }
    }

    try {
      logVital(db, {
        vital_type: selected,
        value: numVal,
        value_secondary: preset.isDualInput ? Number(valueSecondary) || undefined : undefined,
        unit: preset.unit,
        source: 'manual',
      });
      // Reset form
      setValue('');
      setValueSecondary('');
      setFeeling(null);
      setNotes('');
      setSaveCount((c) => c + 1);
      Alert.alert('Saved', `${preset.label} measurement recorded.`, [
        { text: 'Log Another', style: 'default' },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save measurement.');
    }
  }, [db, selected, value, valueSecondary, preset, router]);

  const selectType = (type: VitalType) => {
    setSelected(type);
    setValue('');
    setValueSecondary('');
    setShowTypePicker(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerLabel}>DAILY RECORDS</Text>
        <Text style={styles.headerTitle}>Log Measurement</Text>
        <Text style={styles.headerSubtitle}>
          Keep track of your vitals and physical metrics.
        </Text>
      </View>

      {/* Measurement Type Selector */}
      <GlassCard level={2} style={styles.formCard}>
        <Text style={styles.fieldLabel}>MEASUREMENT TYPE</Text>
        <Pressable
          style={styles.typeSelector}
          onPress={() => setShowTypePicker(!showTypePicker)}
        >
          <View style={styles.typeSelectorLeft}>
            <Text style={styles.typeSelectorIcon}>{preset.icon}</Text>
            <Text style={styles.typeSelectorText}>{preset.label}</Text>
          </View>
          <Text style={styles.chevron}>{showTypePicker ? '\u25B2' : '\u25BC'}</Text>
        </Pressable>

        {showTypePicker && (
          <View style={styles.typeList}>
            {VITAL_PRESETS.map((p) => (
              <Pressable
                key={p.type}
                style={[
                  styles.typeOption,
                  selected === p.type && styles.typeOptionActive,
                ]}
                onPress={() => selectType(p.type)}
              >
                <Text style={styles.typeOptionIcon}>{p.icon}</Text>
                <Text
                  style={[
                    styles.typeOptionText,
                    selected === p.type && styles.typeOptionTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </GlassCard>

      {/* Value Input */}
      <GlassCard level={2} style={styles.formCard}>
        {preset.isDualInput ? (
          <View style={styles.dualInputRow}>
            <View style={styles.dualInputCol}>
              <Text style={styles.fieldLabel}>SYSTOLIC</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={preset.placeholder}
                  placeholderTextColor={HEALTH_SURFACES.highest}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="numeric"
                />
                <Text style={styles.inputUnit}>{preset.unit}</Text>
              </View>
            </View>
            <View style={styles.dualDivider} />
            <View style={styles.dualInputCol}>
              <Text style={styles.fieldLabel}>DIASTOLIC</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={preset.placeholderSecondary ?? '80'}
                  placeholderTextColor={HEALTH_SURFACES.highest}
                  value={valueSecondary}
                  onChangeText={setValueSecondary}
                  keyboardType="numeric"
                />
                <Text style={styles.inputUnit}>{preset.unit}</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.fieldLabel}>VALUE</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={preset.placeholder}
                placeholderTextColor={HEALTH_SURFACES.highest}
                value={value}
                onChangeText={setValue}
                keyboardType="numeric"
              />
              <Text style={styles.inputUnit}>{preset.unit}</Text>
            </View>
          </>
        )}
      </GlassCard>

      {/* Timestamp */}
      <GlassCard level={2} style={styles.formCard}>
        <Text style={styles.fieldLabel}>TIMESTAMP</Text>
        <View style={styles.timestampRow}>
          <View style={styles.timestampBadge}>
            <Text style={styles.timestampIcon}>{'\u{1F4C5}'}</Text>
            <Text style={styles.timestampText}>{dateStr}</Text>
          </View>
          <View style={styles.timestampBadge}>
            <Text style={styles.timestampIcon}>{'\u{1F552}'}</Text>
            <Text style={styles.timestampText}>{timeStr}</Text>
          </View>
        </View>
      </GlassCard>

      {/* Feeling Selector */}
      <GlassCard level={2} style={styles.formCard}>
        <Text style={styles.fieldLabel}>FEELING</Text>
        <View style={styles.feelingRow}>
          {FEELINGS.map((f) => (
            <Pressable
              key={f.value}
              style={[
                styles.feelingButton,
                feeling === f.value && styles.feelingButtonActive,
              ]}
              onPress={() => setFeeling(feeling === f.value ? null : f.value)}
            >
              <Text style={styles.feelingEmoji}>{f.emoji}</Text>
              {feeling === f.value && (
                <Text style={styles.feelingLabel}>{f.label}</Text>
              )}
            </Pressable>
          ))}
        </View>
      </GlassCard>

      {/* Notes */}
      <GlassCard level={2} style={styles.formCard}>
        <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add any context about this reading..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </GlassCard>

      {/* Save Button */}
      <View style={styles.ctaWrapper}>
        <GradientButton title="Save Measurement" onPress={handleSave} />
      </View>

      {/* Recent Entries */}
      {recentEntries.length > 0 && (
        <>
          <SectionHeader label="RECENT ENTRIES" title="" />
          {recentEntries.map((entry) => {
            const entryPreset = VITAL_PRESETS.find((p) => p.type === entry.vital_type);
            const displayValue = entry.value_secondary != null
              ? `${Math.round(entry.value)}/${Math.round(entry.value_secondary)}`
              : entry.vital_type === 'body_temperature'
                ? entry.value.toFixed(1)
                : `${Math.round(entry.value)}`;
            return (
              <GlassCard key={entry.id} level={2} style={styles.recentRow}>
                <View style={styles.recentLeft}>
                  <Text style={styles.recentIcon}>
                    {entryPreset?.icon ?? '\u{1FA7A}'}
                  </Text>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentName}>
                      {entryPreset?.label ?? entry.vital_type}
                    </Text>
                    <Text style={styles.recentDate}>
                      {formatRecentDate(entry.recorded_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentValue}>{displayValue}</Text>
                  <Text style={styles.recentUnit}>
                    {entryPreset?.unit ?? entry.unit}
                  </Text>
                </View>
              </GlassCard>
            );
          })}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Header
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 4,
  },
  headerLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_ACCENT,
  },
  headerTitle: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Form cards
  formCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  fieldLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textTertiary,
  },

  // Type selector
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typeSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeSelectorIcon: {
    fontSize: 20,
  },
  typeSelectorText: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  chevron: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  typeList: {
    gap: 2,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  typeOptionActive: {
    backgroundColor: `${HEALTH_ACCENT}15`,
  },
  typeOptionIcon: {
    fontSize: 18,
  },
  typeOptionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  typeOptionTextActive: {
    color: HEALTH_ACCENT_LIGHT,
    fontWeight: '600',
  },

  // Input fields
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    ...HEALTH_TYPOGRAPHY.displayLg,
    fontSize: 28,
    color: colors.text,
    paddingVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  inputUnit: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.1 * 12,
    color: colors.textTertiary,
    marginLeft: 8,
  },
  dualInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
  },
  dualInputCol: {
    flex: 1,
    gap: 8,
  },
  dualDivider: {
    width: 12,
  },

  // Timestamp
  timestampRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timestampBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timestampIcon: {
    fontSize: 16,
  },
  timestampText: {
    fontSize: 13,
    color: colors.text,
  },

  // Feeling
  feelingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  feelingButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: HEALTH_SURFACES.focus,
    gap: 4,
  },
  feelingButtonActive: {
    backgroundColor: `${HEALTH_ACCENT}18`,
  },
  feelingEmoji: {
    fontSize: 26,
  },
  feelingLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.1 * 8,
    color: HEALTH_ACCENT_LIGHT,
  },

  // Notes
  notesInput: {
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    lineHeight: 22,
  },

  // CTA
  ctaWrapper: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 24,
  },

  // Recent entries
  recentRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentIcon: {
    fontSize: 22,
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentName: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  recentDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  recentRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  recentValue: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: HEALTH_ACCENT,
  },
  recentUnit: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textTertiary,
  },
});
