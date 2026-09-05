import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  createTranscription,
  createVoiceNote,
  deleteTranscription,
  deleteVoiceNote,
  formatDuration,
  getTranscriptionStats,
  getTranscriptions,
  getVoiceNotes,
  type Transcription,
  type VoiceNote,
} from '@mylife/voice';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.voice;
const QUALITY_STORAGE_MB_PER_HOUR: Record<'low' | 'medium' | 'high', number> = {
  low: 18,
  medium: 42,
  high: 96,
};

type RecordingRow = {
  id: string;
  transcriptionId: string | null;
  noteId: string | null;
  title: string;
  preview: string;
  durationSeconds: number;
  wordCount: number;
  language: string | null;
  tags: string[];
  createdAt: string;
  status: 'Transcribed' | 'Audio Only' | 'Note Only';
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(text: string, fallback: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 40);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function splitTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildRecordingRows(transcriptions: Transcription[], notes: VoiceNote[]): RecordingRow[] {
  const notesByTranscriptionId = new Map<string, VoiceNote>();
  const orphanNotes: RecordingRow[] = [];

  for (const note of notes) {
    if (note.transcriptionId) {
      notesByTranscriptionId.set(note.transcriptionId, note);
      continue;
    }

    orphanNotes.push({
      id: note.id,
      transcriptionId: null,
      noteId: note.id,
      title: note.title,
      preview: 'Standalone voice note',
      durationSeconds: 0,
      wordCount: 0,
      language: null,
      tags: splitTags(note.tags),
      createdAt: note.createdAt,
      status: 'Note Only',
    });
  }

  const recordingRows = transcriptions.map((transcription) => {
    const linkedNote = notesByTranscriptionId.get(transcription.id);
    return {
      id: transcription.id,
      transcriptionId: transcription.id,
      noteId: linkedNote?.id ?? null,
      title: linkedNote?.title ?? deriveTitle(transcription.text, 'Untitled recording'),
      preview: transcription.text.trim() || 'No transcript text yet',
      durationSeconds: transcription.durationSeconds,
      wordCount: countWords(transcription.text),
      language: transcription.language,
      tags: splitTags(linkedNote?.tags ?? null),
      createdAt: transcription.createdAt,
      status: transcription.text.trim() ? 'Transcribed' : 'Audio Only',
    } satisfies RecordingRow;
  });

  return [...recordingRows, ...orphanNotes].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export default function VoiceHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [composerVisible, setComposerVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftLanguage, setDraftLanguage] = useState<'en-US' | 'es-ES'>('en-US');
  const [selectedRecording, setSelectedRecording] = useState<RecordingRow | null>(null);

  useEffect(() => {
    if (!isRecording) return undefined;
    const interval = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const transcriptions = useMemo(
    () => getTranscriptions(db, { limit: 200 }),
    [db, refreshKey],
  );
  const notes = useMemo(
    () => getVoiceNotes(db, { limit: 200 }),
    [db, refreshKey],
  );
  const stats = useMemo(() => getTranscriptionStats(db), [db, refreshKey]);
  const rows = useMemo(() => buildRecordingRows(transcriptions, notes), [transcriptions, notes]);

  const totalWords = rows.reduce((sum, row) => sum + row.wordCount, 0);
  const defaultQuality = 'medium';
  const estimatedStorageMb = Math.round(
    ((stats.totalDurationSeconds / 3600) * QUALITY_STORAGE_MB_PER_HOUR[defaultQuality]) * 10,
  ) / 10;

  const resetComposer = () => {
    setDraftTitle('');
    setDraftText('');
    setDraftTags('');
    setDraftLanguage('en-US');
    setComposerVisible(false);
  };

  const refresh = () => {
    setRefreshKey((current) => current + 1);
  };

  const handleFabPress = () => {
    if (isRecording) {
      setIsRecording(false);
      setComposerVisible(true);
      return;
    }

    setElapsedSeconds(0);
    setIsRecording(true);
  };

  const handleSaveRecording = () => {
    const normalizedText = draftText.trim();
    const normalizedTitle = draftTitle.trim() || deriveTitle(normalizedText, 'Voice memo');

    const transcriptionId = generateId('transcription');
    createTranscription(db, transcriptionId, {
      text: normalizedText || normalizedTitle,
      durationSeconds: Math.max(elapsedSeconds, 1),
      language: draftLanguage,
      confidence: normalizedText ? 0.94 : null,
      audioUri: null,
    });

    createVoiceNote(db, generateId('note'), {
      title: normalizedTitle,
      transcriptionId,
      tags: draftTags.trim() || null,
      isFavorite: false,
    });

    resetComposer();
    setElapsedSeconds(0);
    refresh();
  };

  const handleDelete = (row: RecordingRow) => {
    Alert.alert(
      'Delete recording',
      `Remove "${row.title}" from MyVoice?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (row.noteId) deleteVoiceNote(db, row.noteId);
            if (row.transcriptionId) deleteTranscription(db, row.transcriptionId);
            if (selectedRecording?.id === row.id) {
              setDetailVisible(false);
              setSelectedRecording(null);
            }
            refresh();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={colors.textSecondary}>
              Capture every word, privately
            </Text>
            <Text style={styles.title}>MyVoice</Text>
          </View>
          <Pressable style={styles.ghostButton} onPress={() => router.push('/(voice)/settings')}>
            <Text variant="label" color={colors.text}>
              Settings
            </Text>
          </Pressable>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Voice memos that stay with you</Text>
              <Text variant="body" color={colors.textSecondary} style={styles.heroBody}>
                Start a timed capture, then save the transcript as a private note with tags and language metadata.
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Text variant="caption" color="#FFE4E6">
                On-device only
              </Text>
            </View>
          </View>
          <View style={styles.pillRow}>
            <MetricPill label="Recordings" value={String(rows.length)} />
            <MetricPill label="Duration" value={formatDuration(stats.totalDurationSeconds)} />
            <MetricPill label="Words" value={totalWords.toLocaleString()} />
          </View>
          <View style={styles.heroFooter}>
            <Text variant="caption" color={colors.textSecondary}>
              Estimated storage
            </Text>
            <Text variant="label" color={colors.text}>
              {estimatedStorageMb} MB
            </Text>
          </View>
        </Card>

        {rows.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyBadge}>
              <Text style={styles.emptyIcon}>🎙️</Text>
            </View>
            <Text style={styles.emptyTitle}>Tap the red button to capture your first memo</Text>
            <Text variant="body" color={colors.textSecondary} style={styles.emptyBody}>
              Each saved capture keeps its title, tags, language, duration, and transcript preview in one private timeline.
            </Text>
          </Card>
        ) : (
          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text variant="subheading">Recent recordings</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {rows.length} total
              </Text>
            </View>
            {rows.map((row) => (
              <Pressable
                key={row.id}
                style={styles.recordingCard}
                onPress={() => {
                  setSelectedRecording(row);
                  setDetailVisible(true);
                }}
              >
                <View style={styles.recordingTopRow}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.recordingTitle}>{row.title}</Text>
                    <View style={styles.metaRow}>
                      <Text variant="caption" color={colors.textSecondary}>
                        {formatDuration(row.durationSeconds)}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {new Date(row.createdAt).toLocaleDateString()}
                      </Text>
                      <StatusChip status={row.status} />
                    </View>
                  </View>
                  <Pressable
                    hitSlop={10}
                    style={styles.deleteButton}
                    onPress={() => handleDelete(row)}
                  >
                    <Text variant="caption" color={colors.textSecondary}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
                <Text variant="body" color={colors.textSecondary} numberOfLines={2}>
                  {row.preview}
                </Text>
                <View style={styles.footerRow}>
                  <View style={styles.tagRow}>
                    {(row.tags.length > 0 ? row.tags : ['untagged']).slice(0, 3).map((tag) => (
                      <View key={`${row.id}-${tag}`} style={styles.tagChip}>
                        <Text variant="caption" color={colors.textSecondary}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text variant="caption" color={colors.textSecondary}>
                    {row.wordCount} words
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {isRecording ? (
        <View style={styles.recordingRail}>
          <View style={styles.waveform}>
            {[10, 18, 28, 18, 10, 22, 32, 16, 12].map((height, index) => (
              <View key={`${height}-${index}`} style={[styles.waveBar, { height }]} />
            ))}
          </View>
          <Text style={styles.elapsedText}>{formatDuration(elapsedSeconds)}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.fab, isRecording && styles.fabActive]}
        onPress={handleFabPress}
      >
        <Text style={styles.fabIcon}>{isRecording ? '■' : '🎙️'}</Text>
      </Pressable>

      <Modal
        visible={composerVisible}
        transparent
        animationType="slide"
        onRequestClose={resetComposer}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save this capture</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {formatDuration(Math.max(elapsedSeconds, 1))}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={colors.textTertiary}
              value={draftTitle}
              onChangeText={setDraftTitle}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Transcript or summary"
              placeholderTextColor={colors.textTertiary}
              value={draftText}
              onChangeText={setDraftText}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              placeholder="Tags, comma separated"
              placeholderTextColor={colors.textTertiary}
              value={draftTags}
              onChangeText={setDraftTags}
            />
            <View style={styles.languageRow}>
              {[
                { value: 'en-US' as const, label: 'English' },
                { value: 'es-ES' as const, label: 'Spanish' },
              ].map((language) => {
                const active = draftLanguage === language.value;
                return (
                  <Pressable
                    key={language.value}
                    style={[styles.languageChip, active && styles.languageChipActive]}
                    onPress={() => setDraftLanguage(language.value)}
                  >
                    <Text variant="caption" color={active ? '#0A0A0F' : colors.textSecondary}>
                      {language.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryAction} onPress={resetComposer}>
                <Text variant="label" color={colors.textSecondary}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable style={styles.primaryAction} onPress={handleSaveRecording}>
                <Text variant="label" color="#0A0A0F">
                  Save memo
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            {selectedRecording ? (
              <>
                <Text style={styles.modalTitle}>{selectedRecording.title}</Text>
                <View style={styles.metaRow}>
                  <StatusChip status={selectedRecording.status} />
                  <Text variant="caption" color={colors.textSecondary}>
                    {formatDuration(selectedRecording.durationSeconds)}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {selectedRecording.wordCount} words
                  </Text>
                </View>
                <Text variant="body" color={colors.textSecondary} style={styles.detailBody}>
                  {selectedRecording.preview}
                </Text>
                <View style={styles.tagRow}>
                  {selectedRecording.tags.map((tag) => (
                    <View key={`${selectedRecording.id}-${tag}-detail`} style={styles.tagChip}>
                      <Text variant="caption" color={colors.textSecondary}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.secondaryAction}
                    onPress={() => setDetailVisible(false)}
                  >
                    <Text variant="label" color={colors.textSecondary}>
                      Close
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryAction}
                    onPress={() => handleDelete(selectedRecording)}
                  >
                    <Text variant="label" color="#0A0A0F">
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="label" color={colors.text}>
        {value}
      </Text>
    </View>
  );
}

function StatusChip({ status }: { status: RecordingRow['status'] }) {
  const palette = {
    Transcribed: { bg: 'rgba(48, 209, 88, 0.18)', fg: '#8EF6B1' },
    'Audio Only': { bg: 'rgba(255, 255, 255, 0.08)', fg: colors.textSecondary },
    'Note Only': { bg: 'rgba(239, 68, 68, 0.14)', fg: '#FCA5A5' },
  }[status];

  return (
    <View style={[styles.statusChip, { backgroundColor: palette.bg }]}>
      <Text variant="caption" color={palette.fg}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: 140,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
    marginTop: 4,
  },
  ghostButton: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroCard: {
    backgroundColor: '#17171F',
    borderColor: 'rgba(239,68,68,0.22)',
    overflow: 'hidden',
  },
  heroGlow: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderRadius: 140,
    height: 140,
    position: 'absolute',
    right: -28,
    top: -36,
    width: 140,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  heroBody: {
    marginTop: spacing.sm,
  },
  statusBadge: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.glassBorder,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#14141D',
    borderColor: 'rgba(239,68,68,0.18)',
    borderStyle: 'dashed',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 999,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  emptyIcon: {
    fontSize: 30,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 280,
    textAlign: 'center',
  },
  listSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  recordingTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  recordingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteButton: {
    paddingVertical: 2,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recordingRail: {
    alignItems: 'center',
    backgroundColor: '#14141D',
    borderColor: 'rgba(239,68,68,0.25)',
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'absolute',
    right: 0,
  },
  waveform: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  waveBar: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    width: 6,
  },
  elapsedText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 999,
    bottom: 86,
    elevation: 8,
    height: 68,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    width: 68,
  },
  fabActive: {
    backgroundColor: '#F87171',
  },
  fabIcon: {
    color: '#0A0A0F',
    fontSize: 28,
    fontWeight: '700',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#13131C',
    borderColor: colors.glassBorder,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    width: '100%',
  },
  detailCard: {
    backgroundColor: '#13131C',
    borderColor: colors.glassBorder,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.lg,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 120,
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageChip: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  languageChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 108,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 14,
    justifyContent: 'center',
    minWidth: 108,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailBody: {
    lineHeight: 24,
  },
});
