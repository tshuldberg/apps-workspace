import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MOOD_SCORE_COLORS, MOOD_SURFACES, MOOD_TYPOGRAPHY, type MoodScore } from './tokens';
import { colors } from '@mylife/ui';

interface TimelineEntryProps {
  emotion: string;
  emoji: string;
  time: string;
  score: number;
  onPress?: () => void;
}

export function TimelineEntry({
  emotion,
  emoji,
  time,
  score,
  onPress,
}: TimelineEntryProps) {
  const clamped = Math.max(1, Math.min(10, Math.round(score))) as MoodScore;
  const scoreColor = MOOD_SCORE_COLORS[clamped];

  const content = (
    <View style={styles.row}>
      <View style={styles.emojiCircle}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.emotion}>{emotion}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      <View style={styles.scoreContainer}>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
        <Text style={styles.scoreLabel}>MOODSCORE</Text>
      </View>
    </View>
  );

  if (onPress == null) return content;

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  emotion: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  time: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 24,
    fontWeight: '700',
  },
  scoreLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.05 * 8,
    color: colors.textSecondary,
  },
});
