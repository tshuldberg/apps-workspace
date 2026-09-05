import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MD_PILL_RADIUS,
  MD_TEXT,
  MD_TYPOGRAPHY,
  resolveMoodColor,
  withAlpha,
} from '../tokens';

type MoodChipSize = 'sm' | 'md' | 'lg';

const MOOD_EMOJI: Record<string, string> = {
  great: '😁',
  good: '🙂',
  neutral: '😐',
  bad: '🙁',
  terrible: '😣',
};

const PADDING_MAP = {
  sm: 8,
  md: 10,
  lg: 12,
} as const;

export interface MoodChipProps {
  mood: string;
  size?: MoodChipSize;
  onPress?: () => void;
}

export function MoodChip({
  mood,
  size = 'md',
  onPress,
}: MoodChipProps) {
  const normalized = mood.trim().toLowerCase();
  const color = resolveMoodColor(normalized);
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: withAlpha(color, 0.14),
          paddingHorizontal: PADDING_MAP[size] + 2,
          paddingVertical: PADDING_MAP[size],
        },
      ]}
    >
      <Text style={styles.emoji}>{MOOD_EMOJI[normalized] ?? '😐'}</Text>
      <Text style={[styles.label, { color }]}>
        {normalized.charAt(0).toUpperCase()}
        {normalized.slice(1)}
      </Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: MD_PILL_RADIUS,
    flexDirection: 'row',
    gap: 8,
  },
  emoji: {
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT,
  },
});
