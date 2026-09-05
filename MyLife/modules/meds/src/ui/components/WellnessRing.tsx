import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  MD_ACCENT,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '../tokens';

export interface WellnessRingBreakdownItem {
  color: string;
  value: number;
}

export interface WellnessRingProps {
  score: number;
  size?: number;
  breakdown?: WellnessRingBreakdownItem[];
}

export function WellnessRing({
  score,
  size = 120,
  breakdown,
}: WellnessRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const strokeWidth = Math.max(10, Math.round(size * 0.1));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * clamped) / 100;
  const center = size / 2;

  let segmentOffset = 0;

  return (
    <View style={[styles.container, { height: size, width: size }]}>
      <Svg height={size} width={size}>
        <Circle
          cx={center}
          cy={center}
          fill="transparent"
          r={radius}
          stroke={withAlpha(MD_TEXT_SECONDARY, 0.14)}
          strokeWidth={strokeWidth}
        />
        {breakdown?.map((item, index) => {
          const fraction = Math.max(0, Math.min(1, item.value / 100));
          const segmentLength = circumference * fraction;
          const circle = (
            <Circle
              key={`segment-${index}`}
              cx={center}
              cy={center}
              fill="transparent"
              r={radius}
              rotation={-90}
              origin={`${center}, ${center}`}
              stroke={item.color}
              strokeDasharray={`${segmentLength} ${circumference}`}
              strokeDashoffset={-segmentOffset}
              strokeLinecap="round"
              strokeWidth={Math.max(4, strokeWidth - 6)}
            />
          );
          segmentOffset += segmentLength;
          return circle;
        })}
        <Circle
          cx={center}
          cy={center}
          fill="transparent"
          r={radius}
          rotation={-90}
          origin={`${center}, ${center}`}
          stroke={MD_ACCENT}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={styles.copy}>
        <Text style={styles.score}>{clamped}</Text>
        <Text style={styles.label}>Wellness</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  score: {
    ...MD_TYPOGRAPHY.vitalDisplay,
    color: MD_TEXT,
    fontSize: 32,
    lineHeight: 36,
  },
  label: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
});
