import { useState, useRef, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createVoiceRecording,
  listVoiceRecordingsForEntry,
  createJournalEntry,
  listJournalNotebooks,
  DEFAULT_RECORDING_CONFIG,
} from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.journal;

export default function VoiceEntryScreen() {
  const db = useDatabase();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notebooks = useMemo(() => listJournalNotebooks(db), [db]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startRecording = () => {
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s * 1000 >= DEFAULT_RECORDING_CONFIG.maxDurationMs) {
          stopRecording();
          return s;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  };

  const handleSave = () => {
    const notebook = notebooks[0];
    if (!notebook || !transcription.trim()) return;
    const entryId = uuid();
    createJournalEntry(db, entryId, {
      journalId: notebook.id,
      entryDate: today,
      title: 'Voice Entry',
      body: transcription.trim(),
      tags: ['voice'],
      mood: null,
    });
    createVoiceRecording(db, {
      entryId,
      filePath: `/recordings/${entryId}.aac`,
      durationMs: elapsed * 1000,
      fileSizeBytes: 0,
      keepAudio: true,
    });
    setSaved(true);
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (saved) {
    return (
      <View style={styles.container}>
        <Card style={styles.doneCard}>
          <Text style={{ fontSize: 40 }}>✅</Text>
          <Text style={styles.doneTitle}>Voice Entry Saved</Text>
          <Text style={styles.doneText}>Your voice journal entry has been saved.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Voice Journal</Text>

      {/* Record Button */}
      <View style={styles.recorderContainer}>
        <Pressable
          style={[styles.recordButton, recording ? styles.recordActive : null]}
          onPress={recording ? stopRecording : startRecording}
        >
          <View style={[styles.recordDot, recording ? styles.recordDotActive : null]} />
        </Pressable>
        <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        <Text style={styles.hint}>
          {recording ? 'Recording... Tap to stop.' : 'Tap to start recording.'}
        </Text>
        <Text style={styles.maxDuration}>
          Max: {Math.floor(DEFAULT_RECORDING_CONFIG.maxDurationMs / 60000)} min
        </Text>
      </View>

      {/* Transcription */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Transcription</Text>
        <Text style={styles.transNote}>
          Speech-to-text will process your recording. Edit the result below before saving.
        </Text>
        <TextInput
          style={styles.transInput}
          value={transcription}
          onChangeText={setTranscription}
          placeholder="Transcription will appear here. You can also type directly..."
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </Card>

      {/* Save */}
      <Pressable
        style={[styles.saveBtn, !transcription.trim() ? styles.disabled : null]}
        onPress={handleSave}
        disabled={!transcription.trim()}
      >
        <Text style={styles.saveText}>Save as Entry</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  recorderContainer: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  recordButton: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  recordActive: { borderColor: colors.danger, backgroundColor: 'rgba(255,69,58,0.1)' },
  recordDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.danger },
  recordDotActive: { borderRadius: 4, width: 24, height: 24 },
  timer: { fontSize: 28, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 14, color: colors.textSecondary },
  maxDuration: { fontSize: 11, color: colors.textTertiary },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  transNote: { fontSize: 12, color: colors.textTertiary },
  transInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
    minHeight: 120,
  },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  disabled: { opacity: 0.4 },
  doneCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm, margin: spacing.md },
  doneTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  doneText: { fontSize: 14, color: colors.textSecondary },
});
