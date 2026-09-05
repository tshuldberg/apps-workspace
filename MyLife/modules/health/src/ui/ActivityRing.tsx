import { StyleSheet, View } from 'react-native';
import { HEALTH_RING_COLORS } from './tokens';

interface RingData {
  current: number;
  goal: number;
}

interface ActivityRingProps {
  move: RingData;
  exercise: RingData;
  stand: RingData;
  size?: number;
}

function clampProgress(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(1, current / goal);
}

/**
 * Three concentric View-based activity rings.
 * Uses borderWidth for arcs (simplified approach without SVG).
 * Outer = move (red), Middle = exercise (green), Inner = stand (blue).
 */
export function ActivityRing({ move, exercise, stand, size = 120 }: ActivityRingProps) {
  const ringWidth = Math.round(size * 0.08);
  const gap = Math.round(size * 0.06);

  const outerSize = size;
  const middleSize = size - 2 * (ringWidth + gap);
  const innerSize = middleSize - 2 * (ringWidth + gap);

  const moveProgress = clampProgress(move.current, move.goal);
  const exerciseProgress = clampProgress(exercise.current, exercise.goal);
  const standProgress = clampProgress(stand.current, stand.goal);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer ring: Move */}
      <Ring
        size={outerSize}
        width={ringWidth}
        color={HEALTH_RING_COLORS.move}
        progress={moveProgress}
      />
      {/* Middle ring: Exercise */}
      <Ring
        size={middleSize}
        width={ringWidth}
        color={HEALTH_RING_COLORS.exercise}
        progress={exerciseProgress}
      />
      {/* Inner ring: Stand */}
      <Ring
        size={innerSize}
        width={ringWidth}
        color={HEALTH_RING_COLORS.stand}
        progress={standProgress}
      />
    </View>
  );
}

interface RingProps {
  size: number;
  width: number;
  color: string;
  progress: number;
}

function Ring({ size, width, color, progress }: RingProps) {
  // Background track (dim)
  const trackOpacity = 0.2;
  // Active portion shown via border opacity trick:
  // Full circle border with active color, clipped by rotation
  const activeOpacity = progress > 0 ? 1 : 0;

  return (
    <View style={[styles.ring, { width: size, height: size }]}>
      {/* Track */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: width,
            borderColor: color,
            opacity: trackOpacity,
          },
        ]}
      />
      {/* Active fill -- simple opacity approach */}
      <View
        style={[
          styles.circle,
          styles.absolute,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: width,
            borderColor: color,
            opacity: activeOpacity * progress,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
  },
  absolute: {
    position: 'absolute',
  },
});
