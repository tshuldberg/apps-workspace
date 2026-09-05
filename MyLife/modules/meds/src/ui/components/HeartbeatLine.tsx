import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import {
  MD_ACCENT_LIGHT,
  MD_TEXT_SECONDARY,
  withAlpha,
} from '../tokens';

export interface HeartbeatPoint {
  date: string;
  value: number;
}

export interface HeartbeatLineProps {
  data: HeartbeatPoint[];
  range?: { min: number; max: number };
  chartHeight?: number;
  chartWidth?: number;
}

function buildPoints(
  data: HeartbeatPoint[],
  width: number,
  height: number,
): string {
  if (data.length === 0) {
    return `0,${height / 2} ${width},${height / 2}`;
  }

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const safeRange = max - min || 1;

  return data
    .map((point, index) => {
      const x = (width / Math.max(1, data.length - 1)) * index;
      const y = height - ((point.value - min) / safeRange) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

function getRangeOverlay({
  data,
  range,
  chartHeight,
}: {
  data: HeartbeatPoint[];
  range?: { min: number; max: number };
  chartHeight: number;
}) {
  if (!range || data.length === 0) {
    return null;
  }

  const values = data.map((point) => point.value);
  const min = Math.min(...values, range.min);
  const max = Math.max(...values, range.max);
  const safeRange = max - min || 1;
  const top = chartHeight - ((range.max - min) / safeRange) * chartHeight;
  const bottom = chartHeight - ((range.min - min) / safeRange) * chartHeight;

  return {
    y: top,
    height: Math.max(6, bottom - top),
  };
}

export function HeartbeatLine({
  data,
  range,
  chartHeight = 72,
  chartWidth = 280,
}: HeartbeatLineProps) {
  const points = buildPoints(data, chartWidth, chartHeight);
  const latest = points.split(' ').at(-1)?.split(',').map(Number);
  const overlay = getRangeOverlay({ data, range, chartHeight });

  return (
    <View style={styles.container}>
      <Svg height={chartHeight} width={chartWidth}>
        {overlay ? (
          <Rect
            fill={withAlpha('#30D158', 0.12)}
            height={overlay.height}
            rx={8}
            width={chartWidth}
            x={0}
            y={overlay.y}
          />
        ) : null}
        <Polyline
          fill="none"
          points={points}
          stroke={MD_ACCENT_LIGHT}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        {latest && latest.length === 2 ? (
          <>
            <Circle
              cx={latest[0]}
              cy={latest[1]}
              fill={withAlpha(MD_ACCENT_LIGHT, 0.25)}
              r={10}
            />
            <Circle
              cx={latest[0]}
              cy={latest[1]}
              fill={MD_ACCENT_LIGHT}
              r={4}
            />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
