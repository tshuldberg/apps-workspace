import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { HERO_GRADIENT } from '@mylife/bestchef';

export interface SparklineEntry {
  week: string;
  rank: number;
}

interface RankSparklineProps {
  entries: SparklineEntry[];
  height?: number;
  /** Horizontal padding subtracted from full width (matches card padding). */
  horizontalPadding?: number;
}

export function RankSparkline({ entries, height = 50, horizontalPadding = 32 }: RankSparklineProps) {
  const { width } = useWindowDimensions();
  const svgWidth = width - horizontalPadding * 2;

  const paths = useMemo(() => {
    if (entries.length < 2) return null;

    const ranks = entries.map((e) => e.rank);
    const minR = Math.min(...ranks);
    const maxR = Math.max(...ranks);
    const range = Math.max(maxR - minR, 1);
    const n = entries.length;
    const pad = 4;

    function xAt(i: number) {
      return (i / (n - 1)) * svgWidth;
    }
    function yAt(rank: number) {
      // Lower rank = higher on chart (inverted)
      return pad + ((rank - minR) / range) * (height - pad * 2);
    }

    const pts = entries.map((e, i) => ({ x: xAt(i), y: yAt(e.rank) }));

    let linePath = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      linePath += ` L ${pts[i]!.x} ${pts[i]!.y}`;
    }

    const fillPath =
      `M 0 ${height} ` +
      `L ${pts[0]!.x} ${pts[0]!.y} ` +
      pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${svgWidth} ${height} Z`;

    const lastPt = pts[pts.length - 1]!;

    return { linePath, fillPath, lastPt };
  }, [entries, svgWidth, height]);

  if (!paths) return null;

  return (
    <Svg width={svgWidth} height={height}>
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={HERO_GRADIENT.from} stopOpacity={0.25} />
          <Stop offset="1" stopColor={HERO_GRADIENT.from} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={paths.fillPath} fill="url(#sparkFill)" />
      <Path
        d={paths.linePath}
        stroke={HERO_GRADIENT.from}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle
        cx={paths.lastPt.x}
        cy={paths.lastPt.y}
        r={4}
        fill={HERO_GRADIENT.from}
      />
    </Svg>
  );
}
