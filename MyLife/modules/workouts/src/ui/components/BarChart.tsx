import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import {
  WK_CATEGORY_COLORS,
  WK_TYPOGRAPHY,
} from '../tokens';
import { WK_FONTS } from '../typography';

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  maxValue?: number;
  height?: number;
  accent?: string;
}

function withAlpha(color: string, alphaHex: string): string {
  return color.startsWith('#') && color.length === 7
    ? `${color}${alphaHex}`
    : color;
}

export function getBarChartMaxValue(
  data: BarChartDatum[],
  maxValue?: number,
): number {
  if (typeof maxValue === 'number' && Number.isFinite(maxValue) && maxValue > 0) {
    return maxValue;
  }

  const largest = data.reduce((current, item) => {
    return Math.max(current, item.value);
  }, 0);

  return largest > 0 ? largest : 1;
}

export function BarChart({
  data,
  maxValue,
  height = 220,
  accent = WK_CATEGORY_COLORS.hypertrophy,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartMax = getBarChartMaxValue(data, maxValue);

  return (
    <View style={styles.chart}>
      <View style={[styles.row, { minHeight: height }]}>
        {data.map((item, index) => {
          const color = item.color ?? accent;
          const ratio = Math.max(item.value, 0) / chartMax;
          const fillHeight = Math.max(8, ratio * height);
          const barHeight = Math.max(height, 1);
          const isHovered = hoveredIndex === index;

          return (
            <Pressable
              key={`${item.label}-${index}`}
              style={styles.barSlot}
              onHoverIn={() => setHoveredIndex(index)}
              onHoverOut={() => setHoveredIndex((current) => {
                return current === index ? null : current;
              })}
            >
              <Svg
                width="100%"
                height={barHeight}
                viewBox={`0 0 32 ${barHeight}`}
                preserveAspectRatio="none"
              >
                <Rect
                  x={7}
                  y={0}
                  width={18}
                  height={barHeight}
                  rx={4}
                  fill={withAlpha(color, '33')}
                />
                <Rect
                  x={7}
                  y={barHeight - fillHeight}
                  width={18}
                  height={fillHeight}
                  rx={4}
                  fill={color}
                  fillOpacity={isHovered ? 1 : 0.92}
                />
              </Svg>
              <Text style={styles.label}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  label: {
    ...WK_TYPOGRAPHY.labelUpper,
    fontFamily: WK_FONTS.medium,
    color: 'rgba(214, 195, 181, 0.62)',
  },
});
