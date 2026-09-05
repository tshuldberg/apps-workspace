import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import {
  deleteTranscription,
  deleteVoiceNote,
  getSetting,
  getTranscriptionStats,
  getTranscriptions,
  getVoiceNotes,
  setSetting,
  SUPPORTED_LANGUAGES,
} from '@mylife/voice';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.voice;

const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low', estimate: '18 MB / hour' },
  { value: 'medium', label: 'Medium', estimate: '42 MB / hour' },
  { value: 'high', label: 'High', estimate: '96 MB / hour' },
] as const;

export default function VoiceSettingsScreen() {
  const db = useDatabase();
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((current) => current + 1);
  const transcriptions = useMemo(() => getTranscriptions(db, { limit: 500 }), [db, refreshKey]);
  const notes = useMemo(() => getVoiceNotes(db, { limit: 500 }), [db, refreshKey]);
  const stats = useMemo(() => getTranscriptionStats(db), [db, refreshKey]);

  const defaultLanguage = getSetting(db, 'recording.default_language') ?? 'en-US';
  const quality = (getSetting(db, 'recording.quality') ?? 'medium') as 'low' | 'medium' | 'high';
  const autoTranscribe = getSetting(db, 'transcription.auto_enabled') !== 'false';
  const includeTimestamps = getSetting(db, 'transcription.include_timestamps') === 'true';

  const handleBoolean = (key: string, value: boolean) => {
    setSetting(db, key, value ? 'true' : 'false');
    refresh();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear all recordings',
      'Delete every memo, transcript, and note from MyVoice?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            for (const note of notes) deleteVoiceNote(db, note.id);
            for (const transcription of transcriptions) deleteTranscription(db, transcription.id);
            refresh();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.heroCard}>
        <Text style={styles.heroTitle}>Recording defaults</Text>
        <Text variant="body" color={colors.textSecondary}>
          Tune language, quality, and transcription behavior while keeping every capture on-device.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Language</Text>
        <Text variant="caption" color={colors.textSecondary} style={styles.sectionBody}>
          Default language for new recordings and manual capture saves.
        </Text>
        <View style={styles.optionGrid}>
          {SUPPORTED_LANGUAGES.slice(0, 6).map((language) => {
            const active = defaultLanguage === language.code;
            return (
              <Pressable
                key={language.code}
                style={[styles.choiceChip, active && styles.choiceChipActive]}
                onPress={() => {
                  setSetting(db, 'recording.default_language', language.code);
                  refresh();
                }}
              >
                <Text variant="caption" color={active ? '#0A0A0F' : colors.textSecondary}>
                  {language.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Recording quality</Text>
        <Text variant="caption" color={colors.textSecondary} style={styles.sectionBody}>
          Balance storage size against playback and transcription fidelity.
        </Text>
        <View style={styles.stack}>
          {QUALITY_OPTIONS.map((option) => {
            const active = quality === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.qualityRow, active && styles.qualityRowActive]}
                onPress={() => {
                  setSetting(db, 'recording.quality', option.value);
                  refresh();
                }}
              >
                <View>
                  <Text variant="label" color={colors.text}>
                    {option.label}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {option.estimate}
                  </Text>
                </View>
                {active ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Transcription</Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.text}>
              Auto-transcribe after save
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              New recordings store transcript text right away for search and export.
            </Text>
          </View>
          <Switch
            value={autoTranscribe}
            onValueChange={(value) => handleBoolean('transcription.auto_enabled', value)}
            trackColor={{ false: colors.surfaceElevated, true: ACCENT }}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.text}>
              Include timestamps
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Adds timing markers to exports and transcript detail views.
            </Text>
          </View>
          <Switch
            value={includeTimestamps}
            onValueChange={(value) => handleBoolean('transcription.include_timestamps', value)}
            trackColor={{ false: colors.surfaceElevated, true: ACCENT }}
          />
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Storage</Text>
        <View style={styles.metricsRow}>
          <MetricCard label="Recordings" value={String(transcriptions.length)} />
          <MetricCard label="Notes" value={String(notes.length)} />
          <MetricCard label="Duration" value={Math.round(stats.totalDurationSeconds / 60) + 'm'} />
        </View>
        <Text variant="caption" color={colors.textSecondary} style={styles.sectionBody}>
          Privacy notice: every memo, note, and transcript in MyVoice stays on this device.
        </Text>
        <Pressable style={styles.dangerButton} onPress={handleClearAll}>
          <Text variant="label" color="#FFE4E6">
            Clear all recordings
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="label" color={colors.text}>
        {value}
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
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: '#17171F',
    borderColor: 'rgba(239,68,68,0.22)',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  choiceChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  stack: {
    gap: spacing.sm,
  },
  qualityRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  qualityRowActive: {
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  dot: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    flex: 1,
    gap: 6,
    padding: spacing.sm,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(127,29,29,0.45)',
    borderColor: 'rgba(248,113,113,0.28)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 12,
  },
});
