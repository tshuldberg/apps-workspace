import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BG_GOAL_STATUS, BG_SURFACES, BG_TEXT, BG_TEXT_SECONDARY } from '../tokens';
import { BG_FONTS } from '../typography';

function getToneForProgress(progress: number): string {
  if (progress >= 1) return BG_GOAL_STATUS.ahead;
  if (progress >= 0.75) return BG_GOAL_STATUS.on_track;
  if (progress >= 0.45) return BG_GOAL_STATUS.behind;
  return BG_GOAL_STATUS.missed;
}

export interface GoalProgressRingProps {
  current: number;
  target: number;
  size?: number;
  colorByStatus?: boolean | keyof typeof BG_GOAL_STATUS;
}

export function GoalProgressRing({
  current,
  target,
  size = 84,
  colorByStatus = true,
}: GoalProgressRingProps) {
  const progress = target <= 0 ? 0 : Math.max(0, Math.min(current / target, 1));
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const strokeDashoffset = circumference - progress * circumference;
  const tone =
    typeof colorByStatus === 'string'
      ? BG_GOAL_STATUS[colorByStatus]
      : colorByStatus
        ? getToneForProgress(progress)
        : BG_GOAL_STATUS.on_track;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={BG_SURFACES.high}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={tone}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      <View style={styles.content}>
        <Text style={styles.percentText}>{Math.round(progress * 100)}%</Text>
        <Text style={styles.labelText}>Saved</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: BG_TEXT,
  },
  labelText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: BG_TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
});
