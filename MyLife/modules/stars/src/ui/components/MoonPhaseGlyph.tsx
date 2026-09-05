import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G } from 'react-native-svg';
import type { MoonPhase } from '../../types';
import {
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT_SECONDARY,
  getStarsMoonPhaseColor,
  withAlpha,
} from '../tokens';

const DEFAULT_ILLUMINATION: Record<MoonPhase, number> = {
  new_moon: 0,
  waxing_crescent: 25,
  first_quarter: 50,
  waxing_gibbous: 75,
  full_moon: 100,
  waning_gibbous: 75,
  last_quarter: 50,
  waning_crescent: 25,
};

export interface MoonPhaseGlyphProps {
  phase: MoonPhase;
  illumination?: number;
  size?: number;
}

export function MoonPhaseGlyph({
  phase,
  illumination,
  size = 88,
}: MoonPhaseGlyphProps) {
  const phaseColor = getStarsMoonPhaseColor(phase);
  const safeIllumination = Math.max(
    0,
    Math.min(100, illumination ?? DEFAULT_ILLUMINATION[phase]),
  );
  const radius = size / 2 - 4;
  const center = size / 2;
  const offset = ((100 - safeIllumination) / 100) * radius * 1.85;
  const shadowOnRight =
    phase === 'waxing_crescent' ||
    phase === 'first_quarter' ||
    phase === 'waxing_gibbous';
  const clipId = `moon-phase-${phase}-${size}`;

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={center} cy={center} r={radius} />
          </ClipPath>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill={withAlpha(phaseColor, 0.16)}
        />
        <G clipPath={`url(#${clipId})`}>
          <Circle cx={center} cy={center} r={radius} fill={phaseColor} />
          {safeIllumination < 100 ? (
            <Ellipse
              cx={shadowOnRight ? center + offset : center - offset}
              cy={center}
              rx={radius}
              ry={radius}
              fill={ST_SURFACES.base}
            />
          ) : null}
        </G>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={withAlpha('#FFFFFF', 0.08)}
          strokeWidth={1}
        />
      </Svg>
      {illumination != null ? (
        <Text style={styles.label}>{`${Math.round(safeIllumination)}%`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
    letterSpacing: 0.4,
  },
});
