import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  COGNITIVE_DISTORTIONS,
  createJournalEntry,
  listCompletedThoughtRecords,
  listJournalNotebooks,
  getDistortionFrequency,
} from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.journal;

export default function CbtScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const records = useMemo(() => listCompletedThoughtRecords(db, 50), [db, tick]);
  const distFreq = useMemo(() => getDistortionFrequency(db), [db, tick]);
  const notebooks = useMemo(() => listJournalNotebooks(db), [db]);

  // Step-by-step wizard state
  const [step, setStep] = useState(0);
  const [situation, setSituation] = useState('');
  const [thought, setThought] = useState('');
  const [emotion, setEmotion] = useState('');
  const [intensity, setIntensity] = useState(50);
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [response, setResponse] = useState('');

  const resetWizard = () => {
    setStep(0);
    setSituation('');
    setThought('');
    setEmotion('');
    setIntensity(50);
    setSelectedDistortions([]);
    setResponse('');
  };

  const handleSaveThoughtRecord = () => {
    const notebook = notebooks[0];
    if (!notebook) {
      Alert.alert('No notebook', 'Create a notebook first from the Notebooks tab.');
      return;
    }
    const parts = [
      situation ? `Situation: ${situation}` : '',
      thought ? `Automatic Thought: ${thought}` : '',
      emotion ? `Emotion: ${emotion} (${intensity}%)` : '',
      selectedDistortions.length > 0
        ? `Distortions: ${selectedDistortions.join(', ')}`
        : '',
      response ? `Balanced Response: ${response}` : '',
    ].filter(Boolean);
    const body = parts.join('\n\n');
    if (!body.trim()) {
      Alert.alert('Empty record', 'Fill out at least one step before saving.');
      return;
    }
    createJournalEntry(db, uuid(), {
      journalId: notebook.id,
      entryDate: new Date().toISOString().slice(0, 10),
      title: 'CBT Thought Record',
      body,
      tags: ['cbt', ...selectedDistortions.slice(0, 3)],
      mood: null,
    });
    resetWizard();
    setTick((value) => value + 1);
    Alert.alert('Saved', 'Thought record saved to your journal.');
  };

  const steps = [
    'Situation',
    'Automatic Thought',
    'Emotion',
    'Distortions',
    'Rational Response',
    'Review',
  ];

  const toggleDistortion = (type: string) => {
    setSelectedDistortions((prev) =>
      prev.includes(type) ? prev.filter((d) => d !== type) : [...prev, type],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>CBT Thought Records</Text>

      {/* Step Indicator */}
      <View style={styles.stepRow}>
        {steps.map((s, i) => (
          <Pressable key={s} onPress={() => setStep(i)}>
            <View style={[styles.stepDot, i <= step ? styles.stepDotActive : null]}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.stepLabel}>{steps[step]}</Text>

      {/* Step Content */}
      {step === 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>What happened?</Text>
          <TextInput style={styles.input} value={situation} onChangeText={setSituation}
            placeholder="Describe the situation..." placeholderTextColor={colors.textTertiary}
            multiline textAlignVertical="top" />
        </Card>
      )}

      {step === 1 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>What did you think?</Text>
          <TextInput style={styles.input} value={thought} onChangeText={setThought}
            placeholder="What went through your mind?" placeholderTextColor={colors.textTertiary}
            multiline textAlignVertical="top" />
        </Card>
      )}

      {step === 2 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>What did you feel?</Text>
          <TextInput style={[styles.input, { minHeight: 44 }]} value={emotion} onChangeText={setEmotion}
            placeholder="e.g., Anxious, Sad, Angry" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.intensityLabel}>Intensity: {intensity}%</Text>
          <View style={styles.intensityRow}>
            {[10, 25, 50, 75, 100].map((v) => (
              <Pressable key={v} style={[styles.intensityChip, intensity === v ? styles.intensityActive : null]}
                onPress={() => setIntensity(v)}>
                <Text style={[styles.intensityText, intensity === v ? { color: colors.background } : null]}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {step === 3 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Cognitive Distortions</Text>
          <Text style={styles.hint}>Select any that apply to your thought:</Text>
          <View style={styles.distGrid}>
            {COGNITIVE_DISTORTIONS.map((d) => {
              const selected = selectedDistortions.includes(d.type);
              return (
                <Pressable key={d.type} style={[styles.distChip, selected ? styles.distChipActive : null]}
                  onPress={() => toggleDistortion(d.type)}>
                  <Text style={[styles.distName, selected ? { color: colors.background } : null]}>{d.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      {step === 4 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Balanced Response</Text>
          <TextInput style={styles.input} value={response} onChangeText={setResponse}
            placeholder="Write a more balanced alternative thought..." placeholderTextColor={colors.textTertiary}
            multiline textAlignVertical="top" />
        </Card>
      )}

      {step === 5 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Review</Text>
          <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Situation</Text><Text style={styles.reviewValue}>{situation || 'N/A'}</Text></View>
          <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Thought</Text><Text style={styles.reviewValue}>{thought || 'N/A'}</Text></View>
          <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Emotion</Text><Text style={styles.reviewValue}>{emotion} ({intensity}%)</Text></View>
          <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Distortions</Text><Text style={styles.reviewValue}>{selectedDistortions.join(', ') || 'None'}</Text></View>
          <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Response</Text><Text style={styles.reviewValue}>{response || 'N/A'}</Text></View>
        </Card>
      )}

      {/* Navigation */}
      <View style={styles.navRow}>
        {step > 0 && (
          <Pressable style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        )}
        {step < 5 && (
          <Pressable style={styles.nextBtn} onPress={() => setStep((s) => s + 1)}>
            <Text style={styles.nextText}>Next</Text>
          </Pressable>
        )}
        {step === 5 && (
          <Pressable style={styles.nextBtn} onPress={handleSaveThoughtRecord}>
            <Text style={styles.nextText}>Save Record</Text>
          </Pressable>
        )}
      </View>

      {/* Distortion Frequency */}
      {distFreq.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Your Distortion Patterns</Text>
          {distFreq.slice(0, 5).map((d) => (
            <View key={d.distortionType} style={styles.freqRow}>
              <Text style={styles.freqName}>{d.distortionType.replace(/_/g, ' ')}</Text>
              <Text style={styles.freqCount}>{d.count}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* History */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Completed Records ({records.length})</Text>
        {records.slice(0, 5).map((r) => (
          <View key={r.id} style={styles.histRow}>
            <Text style={styles.histSituation} numberOfLines={1}>{r.situation ?? 'Untitled'}</Text>
            <Text style={styles.histDate}>{r.createdAt.slice(0, 10)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: ACCENT },
  stepNum: { fontSize: 12, fontWeight: '600', color: colors.text },
  stepLabel: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textTertiary },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated, minHeight: 80,
  },
  intensityLabel: { fontSize: 13, color: colors.textSecondary },
  intensityRow: { flexDirection: 'row', gap: spacing.sm },
  intensityChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  intensityActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  intensityText: { fontSize: 13, color: colors.textSecondary },
  distGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  distChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  distChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  distName: { fontSize: 11, color: colors.textSecondary },
  reviewRow: { gap: 2, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewLabel: { fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase', fontWeight: '600' },
  reviewValue: { fontSize: 14, color: colors.text },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  backBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
  backText: { fontSize: 14, color: colors.textSecondary },
  nextBtn: { flex: 1, backgroundColor: ACCENT, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
  nextText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  freqRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  freqName: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
  freqCount: { fontSize: 13, fontWeight: '600', color: colors.text },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  histSituation: { fontSize: 13, color: colors.text, flex: 1 },
  histDate: { fontSize: 12, color: colors.textTertiary },
});
