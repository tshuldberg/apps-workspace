import type { TrailDifficulty } from '../../types';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatDuration } from '../../engine/geo';
import {
  TR_ACCENT_GLOW,
  TR_ACCENT_LIGHT,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
} from '../tokens';
import { DifficultyChip } from './DifficultyChip';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export interface RecordingCardRecording {
  id: string;
  name: string;
  startedAt: string;
  distanceMeters: number;
  elevationGainMeters: number;
  durationSeconds: number;
  difficulty?: TrailDifficulty | null;
}

export interface RecordingCardProps {
  recording: RecordingCardRecording;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function formatRecordingDate(startedAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(startedAt));
}

export function RecordingCard({
  recording,
  onPress,
  style,
}: RecordingCardProps) {
  return (
    <GlassCard onPress={onPress} style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={styles.preview}>
          <Svg width="100%" height="100%" viewBox="0 0 92 68" preserveAspectRatio="none">
            <Path
              d="M6 56 C18 34, 32 14, 48 26 S74 54, 86 18"
              stroke={TR_ACCENT_GLOW}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M6 56 C18 34, 32 14, 48 26 S74 54, 86 18"
              stroke={TR_ACCENT_LIGHT}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <View style={styles.copy}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {recording.name}
            </Text>
            {recording.difficulty ? <DifficultyChip level={recording.difficulty} size="sm" /> : null}
          </View>
          <Text style={styles.subtitle}>{formatRecordingDate(recording.startedAt)}</Text>
          <View style={styles.statRow}>
            <RecordingStat icon="straighten" value={`${(recording.distanceMeters / 1000).toFixed(1)} km`} />
            <RecordingStat icon="schedule" value={formatDuration(recording.durationSeconds)} />
            <RecordingStat icon="terrain" value={`${Math.round(recording.elevationGainMeters)} m`} />
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

function RecordingStat({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <MaterialSymbol name={icon} size={12} color={TR_ACCENT_LIGHT} />
      <Text style={styles.statCopy}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
  },
  preview: {
    width: 92,
    height: 68,
    borderRadius: 14,
    backgroundColor: 'rgba(14, 14, 19, 0.9)',
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
    flex: 1,
  },
  subtitle: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
});
