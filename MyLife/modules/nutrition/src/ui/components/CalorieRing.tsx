import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import {
  NU_CALORIE,
  NU_GOAL_STATUS,
  NU_SURFACES,
  NU_TEXT_SECONDARY,
  NU_TYPOGRAPHY,
} from '../tokens';

export interface CalorieRingProps {
  consumed: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
}

export function getCalorieRingProgress(consumed: number, goal: number): number {
  if (goal <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(consumed / goal, 1));
}

export function getCalorieRingProgressColor(
  consumed: number,
  goal: number,
): string {
  return consumed > goal ? NU_GOAL_STATUS.over : NU_CALORIE;
}

export function CalorieRing({
  consumed,
  goal,
  size = 256,
  strokeWidth = 12,
}: CalorieRingProps) {
  const progress = getCalorieRingProgress(consumed, goal);
  const progressColor = getCalorieRingProgressColor(consumed, goal);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const dashOffset = circumference - circumference * progress;

  return (
    <View style={[styles.host, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90, ${center}, ${center})`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={NU_SURFACES.highest}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </G>
      </Svg>

      <View style={styles.center}>
        <Text style={[styles.value, { color: progressColor }]}>{Math.round(consumed)}</Text>
        <Text style={styles.goalLabel}>/ {Math.round(goal)} kcal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  value: {
    ...NU_TYPOGRAPHY.displayLg,
  },
  goalLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
});
