import { StyleSheet, Text, View } from 'react-native';
import { MOOD_SCORE_COLORS, MOOD_TYPOGRAPHY, type MoodScore } from './tokens';
import { colors } from '@mylife/ui';

const EMOJI_MAP: Record<number, string> = {
  1: '\uD83D\uDE29', // weary
  2: '\uD83D\uDE1E', // disappointed
  3: '\uD83D\uDE15', // confused
  4: '\uD83D\uDE14', // pensive
  5: '\uD83D\uDE10', // neutral
  6: '\uD83D\uDE42', // slightly smiling
  7: '\uD83D\uDE0A', // blush
  8: '\uD83D\uDE04', // grinning
  9: '\uD83D\uDE01', // beaming
  10: '\uD83E\uDD29', // star-struck
};

interface MoodScoreIndicatorProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showEmoji?: boolean;
}

export function MoodScoreIndicator({
  score,
  size = 'md',
  showEmoji = true,
}: MoodScoreIndicatorProps) {
  const clamped = Math.max(1, Math.min(10, Math.round(score))) as MoodScore;
  const scoreColor = MOOD_SCORE_COLORS[clamped];
  const emoji = EMOJI_MAP[clamped] ?? '\uD83D\uDE10';

  if (size === 'sm') {
    return (
      <View style={styles.smContainer}>
        <Text style={[styles.smScore, { color: scoreColor }]}>
          {score.toFixed(1)}
        </Text>
        {showEmoji && <Text style={styles.smEmoji}>{emoji}</Text>}
      </View>
    );
  }

  if (size === 'lg') {
    return (
      <View style={styles.lgContainer}>
        {showEmoji && <Text style={styles.lgEmoji}>{emoji}</Text>}
        <Text style={[styles.lgScore, { color: scoreColor }]}>
          {score.toFixed(1)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.mdContainer}>
      {showEmoji && <Text style={styles.mdEmoji}>{emoji}</Text>}
      <Text style={[styles.mdScore, { color: scoreColor }]}>
        {score.toFixed(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  smContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smScore: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 14,
    fontWeight: '700',
  },
  smEmoji: {
    fontSize: 14,
  },

  mdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mdEmoji: {
    fontSize: 28,
  },
  mdScore: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontWeight: '700',
  },

  lgContainer: {
    alignItems: 'flex-start',
    gap: 4,
  },
  lgEmoji: {
    fontSize: 40,
    lineHeight: 52,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  lgScore: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 48,
    lineHeight: 60,
    letterSpacing: -0.02 * 48,
  },
});
