import { StyleSheet, Text, View } from 'react-native';
import {
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
  resolvePainLevel,
  withAlpha,
} from '../tokens';

type PainScaleSize = 'sm' | 'md' | 'lg';

const EMOJI_MAP = ['😌', '🙂', '🙂', '😐', '😕', '😕', '😣', '😣', '😖', '😫', '🤯'];
const DOT_SIZE_MAP = {
  sm: 12,
  md: 16,
  lg: 20,
} as const;

export interface PainScaleProps {
  level: number;
  size?: PainScaleSize;
}

export function getPainLevelMeta(level: number) {
  return resolvePainLevel(level);
}

export function PainScale({
  level,
  size = 'md',
}: PainScaleProps) {
  const meta = resolvePainLevel(level);
  const dotSize = DOT_SIZE_MAP[size];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.emoji, { color: meta.color }]}>{EMOJI_MAP[meta.value]}</Text>
        <Text style={[styles.title, { color: meta.color }]}>
          {meta.label} · {meta.value}/10
        </Text>
      </View>
      <View style={styles.row}>
        {Array.from({ length: 11 }, (_, index) => {
          const tone = resolvePainLevel(index);
          const active = index <= meta.value;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: active
                    ? tone.color
                    : withAlpha(tone.color, 0.16),
                  height: dotSize,
                  width: dotSize,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.labels}>
        <Text style={styles.rangeText}>0</Text>
        <Text style={styles.rangeText}>10</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  title: {
    ...MD_TYPOGRAPHY.titleMd,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    borderRadius: 999,
    flex: 1,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
});
