import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import {
  PR_ACCENT_LIGHT,
  PR_ACCENT_GLOW,
  PR_CYAN_GLOW_STYLE,
  PR_SURFACES,
  PR_TEXT_MUTED,
  PR_TYPOGRAPHY,
} from '../tokens';

export interface TrendBarDatum {
  label: string;
  value: number;
  isToday?: boolean;
}

export interface TrendBarsProps {
  data: TrendBarDatum[];
  goalValue?: number;
  height?: number;
}

export function TrendBars({
  data,
  goalValue,
  height = 80,
}: TrendBarsProps) {
  if (data.length === 0) {
    return null;
  }

  const maxValue = Math.max(
    goalValue ?? 0,
    ...data.map((entry) => entry.value),
    1,
  );
  const barWidth = data.length > 14 ? 6 : 14;
  const gap = data.length > 14 ? 3 : 8;
  const width = data.length * barWidth + Math.max(0, data.length - 1) * gap;
  const goalY = goalValue == null
    ? null
    : height - (Math.max(goalValue, 0) / maxValue) * height;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {goalY != null && (
          <Line
            x1={0}
            x2={width}
            y1={goalY}
            y2={goalY}
            stroke="rgba(34, 211, 238, 0.2)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {data.map((entry, index) => {
          const x = index * (barWidth + gap);
          const clampedValue = Math.max(entry.value, 0);
          const barHeight = Math.max((clampedValue / maxValue) * height, 6);
          const y = height - barHeight;
          return (
            <Fragment key={entry.label}>
              {entry.isToday && (
                <Rect
                  x={x - 1}
                  y={Math.max(0, y - 4)}
                  width={barWidth + 2}
                  height={Math.min(height, barHeight + 4)}
                  rx={3}
                  fill={PR_ACCENT_GLOW}
                  opacity={0.65}
                />
              )}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={entry.isToday ? PR_ACCENT_LIGHT : PR_SURFACES.highest}
              />
            </Fragment>
          );
        })}
      </Svg>
      {data.length <= 7 && (
        <View style={[styles.labelRow, { width }]}>
          {data.map((entry) => (
            <Text
              key={`${entry.label}-label`}
              style={[
                styles.label,
                entry.isToday && styles.labelToday,
              ]}
            >
              {entry.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  labelRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_MUTED,
    flex: 1,
    textAlign: 'center',
  },
  labelToday: {
    color: PR_ACCENT_LIGHT,
    ...PR_CYAN_GLOW_STYLE,
  },
});
