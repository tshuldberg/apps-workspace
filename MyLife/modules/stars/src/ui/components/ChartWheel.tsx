import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { Aspect, ZodiacSign } from '../../types';
import {
  ST_ACCENT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_TERTIARY,
  getStarsAspectColor,
  getStarsPlanetColor,
  getStarsZodiacColor,
  withAlpha,
} from '../tokens';
import { ASPECT_GLYPHS, ZODIAC_ORDER } from './astro-symbols';
import { PlanetGlyph } from './PlanetGlyph';
import { ZodiacSign as ZodiacSignGlyph } from './ZodiacSign';

export interface AstroPlanetPlacement {
  id?: string;
  body: string;
  sign: ZodiacSign;
  degree: number;
  house?: number;
  retrograde?: boolean;
  tone?: string;
  orbit?: number;
}

export interface AstroHousePlacement {
  house: number;
  sign: ZodiacSign;
  degree?: number;
}

export interface AstroAspectLine {
  fromBody: string;
  toBody: string;
  type: Aspect;
}

export interface AstroChart {
  planets: AstroPlanetPlacement[];
  houses?: AstroHousePlacement[];
  aspects?: AstroAspectLine[];
}

export interface ChartWheelProps {
  chart: AstroChart;
  size?: number;
  showAspectLines?: boolean;
  highlight?: string[];
  onSelect?: (type: 'sign' | 'house' | 'planet', value: string | number) => void;
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSegment(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function getPlacementAngle(sign: ZodiacSign, degree: number) {
  const signIndex = ZODIAC_ORDER.indexOf(sign);
  return signIndex * 30 + degree - 90;
}

export function ChartWheel({
  chart,
  size = 320,
  showAspectLines = true,
  highlight,
  onSelect,
}: ChartWheelProps) {
  const center = size / 2;
  const outerRadius = size * 0.47;
  const innerSignRadius = size * 0.37;
  const innerHouseRadius = size * 0.27;
  const planetRadius = size * 0.31;
  const highlightSet = new Set((highlight ?? []).map((value) => value.toLowerCase()));
  const housePlacements: AstroHousePlacement[] =
    chart.houses && chart.houses.length > 0
      ? chart.houses
      : ZODIAC_ORDER.map((sign, index) => ({
          house: index + 1,
          sign,
          degree: index * 30,
        }));

  const planetMap = new Map(
    chart.planets.map((planet) => [
      (planet.id ?? planet.body).toLowerCase(),
      planet,
    ]),
  );

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={outerRadius} fill={ST_SURFACES.lowest} />
        {ZODIAC_ORDER.map((sign, index) => {
          const startAngle = index * 30 - 90;
          const endAngle = startAngle + 30;
          const tone = getStarsZodiacColor(sign);
          const isHighlighted = highlightSet.has(sign);
          return (
            <Path
              key={sign}
              d={describeDonutSegment(
                center,
                center,
                outerRadius,
                innerSignRadius,
                startAngle,
                endAngle,
              )}
              fill={withAlpha(tone, isHighlighted ? 0.34 : 0.16)}
              stroke={withAlpha('#FFFFFF', 0.04)}
              strokeWidth={1}
            />
          );
        })}

        <Circle
          cx={center}
          cy={center}
          r={innerSignRadius}
          fill={withAlpha(ST_SURFACES.low, 0.92)}
        />
        <Circle
          cx={center}
          cy={center}
          r={innerHouseRadius}
          fill={withAlpha(ST_SURFACES.base, 0.94)}
        />

        {housePlacements.map((house, index) => {
          const lineAngle = index * 30 - 90;
          const outer = polarToCartesian(center, center, outerRadius, lineAngle);
          const inner = polarToCartesian(center, center, innerHouseRadius, lineAngle);
          return (
            <Line
              key={`house-line-${house.house}`}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={withAlpha('#FFFFFF', 0.08)}
              strokeWidth={1}
            />
          );
        })}

        {showAspectLines
          ? chart.aspects?.map((aspect) => {
              const fromPlanet = planetMap.get(aspect.fromBody.toLowerCase());
              const toPlanet = planetMap.get(aspect.toBody.toLowerCase());
              if (!fromPlanet || !toPlanet) {
                return null;
              }
              const fromPoint = polarToCartesian(
                center,
                center,
                Math.min(fromPlanet.orbit ?? innerHouseRadius - 10, innerHouseRadius - 10),
                getPlacementAngle(fromPlanet.sign, fromPlanet.degree),
              );
              const toPoint = polarToCartesian(
                center,
                center,
                Math.min(toPlanet.orbit ?? innerHouseRadius - 10, innerHouseRadius - 10),
                getPlacementAngle(toPlanet.sign, toPlanet.degree),
              );
              return (
                <Line
                  key={`${aspect.fromBody}-${aspect.toBody}-${aspect.type}`}
                  x1={fromPoint.x}
                  y1={fromPoint.y}
                  x2={toPoint.x}
                  y2={toPoint.y}
                  stroke={getStarsAspectColor(aspect.type)}
                  strokeWidth={aspect.type === 'trine' || aspect.type === 'sextile' ? 1.2 : 1.8}
                  strokeDasharray={
                    aspect.type === 'trine' || aspect.type === 'sextile'
                      ? '4 3'
                      : undefined
                  }
                  opacity={0.85}
                />
              );
            })
          : null}

        <Circle
          cx={center}
          cy={center}
          r={4}
          fill={ST_ACCENT}
        />
      </Svg>

      {ZODIAC_ORDER.map((sign, index) => {
        const angle = index * 30 - 75;
        const point = polarToCartesian(center, center, outerRadius - 18, angle);
        const signSize = 20;
        return (
          <Pressable
            key={`sign-${sign}`}
            onPress={() => onSelect?.('sign', sign)}
            disabled={!onSelect}
            style={[
              styles.absolute,
              {
                left: point.x - signSize,
                top: point.y - signSize,
              },
            ]}
          >
            <ZodiacSignGlyph sign={sign} size={18} />
          </Pressable>
        );
      })}

      {housePlacements.map((house, index) => {
        const angle = index * 30 - 75;
        const point = polarToCartesian(center, center, (innerSignRadius + innerHouseRadius) / 2, angle);
        return (
          <Pressable
            key={`house-${house.house}`}
            onPress={() => onSelect?.('house', house.house)}
            disabled={!onSelect}
            style={[
              styles.houseBadge,
              {
                left: point.x - 14,
                top: point.y - 14,
              },
            ]}
          >
            <Text style={styles.houseLabel}>{house.house}</Text>
          </Pressable>
        );
      })}

      {chart.planets.map((planet) => {
        const angle = getPlacementAngle(planet.sign, planet.degree);
        const normalizedBody = planet.body.toLowerCase();
        const planetKey = (planet.id ?? planet.body).toLowerCase();
        const point = polarToCartesian(center, center, planet.orbit ?? planetRadius, angle);
        const tone = planet.tone ?? getStarsPlanetColor(normalizedBody);
        const highlighted = highlightSet.has(normalizedBody) || highlightSet.has(planetKey);
        return (
          <Pressable
            key={`${planet.id ?? planet.body}-${planet.sign}-${planet.degree}`}
            onPress={() => onSelect?.('planet', planet.id ?? planet.body)}
            disabled={!onSelect}
            style={[
              styles.absolute,
              {
                left: point.x - 24,
                top: point.y - 24,
              },
            ]}
          >
            <View
              style={[
                highlighted
                  ? {
                      backgroundColor: withAlpha(tone, 0.18),
                      borderRadius: 999,
                      padding: 2,
                    }
                  : null,
              ]}
            >
              <PlanetGlyph
                planet={planet.body}
                retrograde={planet.retrograde}
                sign={planet.sign}
                size={highlighted ? 22 : 20}
                color={tone}
              />
            </View>
          </Pressable>
        );
      })}

      <View style={styles.legend}>
        <Text style={styles.legendCopy}>
          {chart.aspects?.length
            ? `${chart.aspects.length} active aspect${chart.aspects.length === 1 ? '' : 's'}`
            : 'Tap signs, houses, and planets'}
        </Text>
        {chart.aspects?.[0] ? (
          <Text
            style={[
              styles.legendGlyph,
              { color: getStarsAspectColor(chart.aspects[0].type) },
            ]}
          >
            {ASPECT_GLYPHS[chart.aspects[0].type]}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  absolute: {
    position: 'absolute',
  },
  houseBadge: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.78),
  },
  houseLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  legend: {
    position: 'absolute',
    bottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  legendCopy: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  legendGlyph: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
  },
});
