import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import {
  NU_NUTRIENT_CATEGORIES,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
} from '../tokens';

export interface NutrientGaugeProps {
  name: string;
  value: number;
  goal: number;
  unit: string;
  category: 'vitamin' | 'mineral' | 'macro';
}

function getPercent(value: number, goal: number): number {
  if (goal <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(value / goal, 1));
}

export function NutrientGauge({
  name,
  value,
  goal,
  unit,
  category,
}: NutrientGaugeProps) {
  const percent = getPercent(value, goal);
  const color = NU_NUTRIENT_CATEGORIES[category];
  const size = 64;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const dashOffset = circumference - circumference * percent;

  return (
    <View style={styles.card}>
      <View style={styles.ringHost}>
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
              stroke={color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </G>
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.percent, { color }]}>{Math.round(percent * 100)}%</Text>
        </View>
      </View>

      <Text style={styles.name}>{name}</Text>
      <Text style={styles.value}>
        {Math.round(value)}
        {unit} / {Math.round(goal)}
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    padding: 14,
    backgroundColor: NU_SURFACES.low,
  },
  ringHost: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    ...NU_TYPOGRAPHY.labelUpper,
  },
  name: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT,
    textAlign: 'center',
  },
  value: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
    textAlign: 'center',
  },
});
