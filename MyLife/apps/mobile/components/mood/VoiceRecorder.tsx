import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  createAttachment,
  type Attachment,
} from '@mylife/mood';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../DatabaseProvider';

const accentColor = colors.modules.mood;
const MAX_RECORDING_SECONDS = 120;

interface VoiceRecorderProps {
  entryId: string;
  onAttach: (attachment: Attachment) => void;
}

export function VoiceRecorder({ entryId, onAttach }: VoiceRecorderProps) {
  const db = useDatabase();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clips, setClips] = useState<Attachment[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    // Note: expo-av is required for actual audio recording.
    // This records a simulated clip for session tracking purposes.
    setIsRecording(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= MAX_RECORDING_SECONDS) {
          stopRecording();
          return MAX_RECORDING_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (elapsed > 0) {
      const uri = `voice-memo-${Date.now()}.m4a`;
      const attachment = createAttachment(db, uuid(), {
        entryId,
        type: 'voice',
        filePath: uri,
        fileSizeBytes: 0,
        durationSeconds: elapsed,
        mimeType: 'audio/m4a',
      });
      setClips((prev) => [...prev, attachment]);
      onAttach(attachment);
      setElapsed(0);
    }
  }, [db, entryId, elapsed, onAttach]);

  const togglePlayback = useCallback((clipId: string) => {
    // Playback requires expo-av; toggling visual state only
    setPlayingId((prev) => (prev === clipId ? null : clipId));
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.recorderRow}>
        <Pressable
          style={[
            styles.recordBtn,
            isRecording && { backgroundColor: colors.danger },
          ]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? (
            <View style={styles.recordingInner}>
              <View style={styles.redDot} />
              <Text variant="caption" color="#FFFFFF">{formatTime(elapsed)}</Text>
            </View>
          ) : (
            <Text variant="caption" color={accentColor}>Record Voice</Text>
          )}
        </Pressable>
      </View>

      {clips.length > 0 && (
        <View style={styles.clipList}>
          {clips.map((clip) => (
            <Pressable
              key={clip.id}
              style={styles.clipCard}
              onPress={() => togglePlayback(clip.id)}
            >
              <Text variant="caption" color={playingId === clip.id ? accentColor : colors.text}>
                {playingId === clip.id ? '\u{23F8}' : '\u{25B6}'} {formatTime(clip.durationSeconds ?? 0)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  recorderRow: { flexDirection: 'row' },
  recordBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: accentColor,
    backgroundColor: colors.glass,
  },
  recordingInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  clipList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  clipCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
});
