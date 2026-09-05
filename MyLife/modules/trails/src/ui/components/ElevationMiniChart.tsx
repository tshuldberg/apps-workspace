import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { TR_DIFFICULTY, TR_SURFACES } from '../tokens';

export interface ElevationPoint {
  distance: number;
  elevation: number;
}

export interface ElevationMiniChartProps {
  points: ElevationPoint[];
  height?: number;
  showGrade?: boolean;
}

export function getElevationGradeColor(gradePercent: number): string {
  if (gradePercent < 5) {
    return TR_DIFFICULTY.easy;
  }
  if (gradePercent < 10) {
    return TR_DIFFICULTY.moderate;
  }
  return TR_DIFFICULTY.hard;
}

export function ElevationMiniChart({
  points,
  height = 72,
  showGrade = true,
}: ElevationMiniChartProps) {
  const [width, setWidth] = useState(240);

  const normalized = useMemo(() => {
    if (points.length < 2) {
      return [];
    }

    const maxDistance = Math.max(...points.map((point) => point.distance), 1);
    const elevations = points.map((point) => point.elevation);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const spread = Math.max(maxElevation - minElevation, 1);

    return points.map((point) => ({
      ...point,
      x: (point.distance / maxDistance) * width,
      y: height - ((point.elevation - minElevation) / spread) * height,
    }));
  }, [height, points, width]);

  const peakIndices = useMemo(() => {
    if (normalized.length === 0) {
      return [];
    }

    const candidates = normalized
      .map((point, index) => ({ point, index }))
      .filter(({ point, index }) => {
        const previous = normalized[index - 1];
        const next = normalized[index + 1];
        return previous != null && next != null
          ? point.elevation >= previous.elevation && point.elevation >= next.elevation
          : false;
      })
      .sort((left, right) => right.point.elevation - left.point.elevation)
      .slice(0, 2)
      .map(({ index }) => index);

    if (candidates.length > 0) {
      return candidates;
    }

    const highestIndex = normalized.reduce((winner, point, index, all) => (
      point.elevation > all[winner].elevation ? index : winner
    ), 0);

    return [highestIndex];
  }, [normalized]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.max(120, Math.round(event.nativeEvent.layout.width));
    if (nextWidth !== width) {
      setWidth(nextWidth);
    }
  };

  return (
    <View
      style={[
        styles.chart,
        {
          height,
        },
      ]}
      onLayout={handleLayout}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {normalized.slice(1).map((point, index) => {
          const previous = normalized[index];
          const distanceDelta = Math.max(point.distance - previous.distance, 1);
          const gradePercent = Math.abs((point.elevation - previous.elevation) / distanceDelta) * 100;
          const stroke = showGrade
            ? getElevationGradeColor(gradePercent)
            : TR_DIFFICULTY.moderate;

          return (
            <Line
              key={`${point.distance}-${point.elevation}`}
              x1={previous.x}
              y1={previous.y}
              x2={point.x}
              y2={point.y}
              stroke={stroke}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}

        {peakIndices.map((index) => {
          const peak = normalized[index];
          return (
            <Circle
              key={`peak-${peak.distance}-${peak.elevation}`}
              cx={peak.x}
              cy={peak.y}
              r={4}
              fill={TR_DIFFICULTY.expert}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: TR_SURFACES.low,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
});
