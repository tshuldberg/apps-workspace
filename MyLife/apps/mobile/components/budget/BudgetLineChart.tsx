import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
} from '@mylife/budget';

type BudgetLineChartPoint = {
  label: string;
  value: number;
};

export interface BudgetLineChartProps {
  points: BudgetLineChartPoint[];
  height?: number;
  strokeColor?: string;
  fillFromColor?: string;
  fillToColor?: string;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

type ChartGeometry = {
  linePath: string;
  fillPath: string;
  lastX: number;
  lastY: number;
  maxValue: number;
  minValue: number;
};

function buildGeometry(points: BudgetLineChartPoint[], width: number, height: number): ChartGeometry {
  if (points.length === 0) {
    return {
      linePath: '',
      fillPath: '',
      lastX: width,
      lastY: height / 2,
      maxValue: 0,
      minValue: 0,
    };
  }

  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(maxValue - minValue, 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const chartPoints = points.map((point, index) => {
    const x = points.length > 1 ? index * stepX : width / 2;
    const normalized = (point.value - minValue) / range;
    const y = height - normalized * (height - 24) - 12;
    return { x, y };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const fillPath = [
    linePath,
    `L ${chartPoints[chartPoints.length - 1]?.x ?? width} ${height}`,
    `L ${chartPoints[0]?.x ?? 0} ${height}`,
    'Z',
  ].join(' ');

  const lastPoint = chartPoints[chartPoints.length - 1] ?? { x: width, y: height / 2 };

  return {
    linePath,
    fillPath,
    lastX: lastPoint.x,
    lastY: lastPoint.y,
    maxValue,
    minValue,
  };
}

export const BudgetLineChart = memo(function BudgetLineChart({
  points,
  height = 168,
  strokeColor = '#4ADE80',
  fillFromColor = 'rgba(74, 222, 128, 0.32)',
  fillToColor = 'rgba(74, 222, 128, 0.02)',
  emptyLabel = 'No history yet',
  formatValue,
}: BudgetLineChartProps) {
  const width = 320;
  const geometry = useMemo(
    () => buildGeometry(points, width, height),
    [height, points],
  );

  if (points.length === 0) {
    return (
      <View style={[styles.emptyState, { height }]}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  const maxLabel = formatValue
    ? formatValue(geometry.maxValue)
    : geometry.maxValue.toLocaleString();
  const minLabel = formatValue
    ? formatValue(geometry.minValue)
    : geometry.minValue.toLocaleString();

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartShell}>
        <Svg height={height} width="100%" viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="budgetLineFill" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={fillFromColor} />
              <Stop offset="1" stopColor={fillToColor} />
            </LinearGradient>
          </Defs>
          <Path d={geometry.fillPath} fill="url(#budgetLineFill)" />
          <Path
            d={geometry.linePath}
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={4}
          />
          <Circle cx={geometry.lastX} cy={geometry.lastY} fill={strokeColor} r={6} />
        </Svg>
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>{maxLabel}</Text>
          <Text style={styles.rangeLabel}>{minLabel}</Text>
        </View>
      </View>

      <View style={styles.labelRow}>
        {points.map((point, index) => (
          <Text
            key={`${point.label}-${index}`}
            numberOfLines={1}
            style={[
              styles.label,
              index === points.length - 1 ? styles.labelActive : null,
            ]}
          >
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  chartShell: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  rangeRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: BG_TEXT_TERTIARY,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  labelActive: {
    color: BG_TEXT_SECONDARY,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
  },
});
