'use client';

import { useMemo } from 'react';
import type { Aspect, ZodiacSign } from '@mylife/stars';
import {
  STARS_ACCENT,
  STARS_ACCENT_LIGHT,
  STARS_BG,
  STARS_GLASS_BORDER,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  STARS_ZODIAC_COLORS,
  STARS_ZODIAC_LABELS,
  withAlpha,
} from './ui';
import type { WebAstroChart } from './view-models';

const PLANET_SHORT_LABELS: Record<string, string> = {
  sun: 'Su',
  moon: 'Mo',
  mercury: 'Me',
  venus: 'Ve',
  mars: 'Ma',
  jupiter: 'Ju',
  saturn: 'Sa',
  uranus: 'Ur',
  neptune: 'Ne',
  pluto: 'Pl',
};

const ASPECT_COLORS: Record<Aspect, string> = {
  conjunction: '#FFB877',
  sextile: '#8BCFF0',
  square: '#FF6B6B',
  trine: '#84CC16',
  opposition: '#C4B5FD',
};

const ZODIAC_ORDER: ZodiacSign[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
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
  return ZODIAC_ORDER.indexOf(sign) * 30 + degree - 90;
}

function shortSign(sign: ZodiacSign) {
  return STARS_ZODIAC_LABELS[sign].slice(0, 3).toUpperCase();
}

export function StarsChartWheel({
  chart,
  size = 420,
  showAspectLines = true,
  highlight,
  onSelect,
}: {
  chart: WebAstroChart;
  size?: number;
  showAspectLines?: boolean;
  highlight?: string[];
  onSelect?: (type: 'sign' | 'house' | 'planet', value: string | number) => void;
}) {
  const housePlacements = chart.houses.length
    ? chart.houses
    : ZODIAC_ORDER.map((sign, index) => ({
        house: index + 1,
        sign,
        degree: index * 30,
        rulingPlanet: '',
        interpretation: '',
      }));

  const highlightSet = useMemo(
    () => new Set((highlight ?? []).map((value) => value.toLowerCase())),
    [highlight],
  );

  const center = size / 2;
  const outerRadius = size * 0.47;
  const innerSignRadius = size * 0.36;
  const innerHouseRadius = size * 0.24;
  const defaultPlanetRadius = size * 0.3;
  const labelRadius = size * 0.42;
  const innerFocusRadius = size * 0.12;

  const planetMap = new Map(
    chart.planets.map((planet) => [((planet.id ?? planet.body) || '').toLowerCase(), planet]),
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Astrology chart wheel"
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <defs>
        <radialGradient id="stars-wheel-core" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={withAlpha(STARS_ACCENT, 0.18)} />
          <stop offset="52%" stopColor={withAlpha(STARS_BG, 0.12)} />
          <stop offset="100%" stopColor={STARS_BG} />
        </radialGradient>
      </defs>

      <circle cx={center} cy={center} r={outerRadius} fill={STARS_BG} />

      {ZODIAC_ORDER.map((sign, index) => {
        const startAngle = index * 30 - 90;
        const endAngle = startAngle + 30;
        const isHighlighted = highlightSet.has(sign);
        return (
          <path
            key={sign}
            d={describeDonutSegment(center, center, outerRadius, innerSignRadius, startAngle, endAngle)}
            fill={withAlpha(STARS_ZODIAC_COLORS[sign], isHighlighted ? 0.3 : 0.15)}
            stroke={withAlpha(STARS_GLASS_BORDER, 0.5)}
            strokeWidth={isHighlighted ? 2.4 : 1.6}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect?.('sign', sign)}
          />
        );
      })}

      <circle cx={center} cy={center} r={innerSignRadius} fill={withAlpha('#12121A', 0.92)} />
      <circle cx={center} cy={center} r={innerHouseRadius} fill="url(#stars-wheel-core)" />
      <circle cx={center} cy={center} r={innerFocusRadius} fill={withAlpha(STARS_ACCENT, 0.3)} />
      <circle cx={center} cy={center} r={5} fill={STARS_ACCENT_LIGHT} />

      {housePlacements.map((house, index) => {
        const lineAngle = index * 30 - 90;
        const outer = polarToCartesian(center, center, outerRadius, lineAngle);
        const inner = polarToCartesian(center, center, innerHouseRadius, lineAngle);
        return (
          <line
            key={`house-line-${house.house}`}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={withAlpha(STARS_TEXT, 0.08)}
            strokeWidth={1.6}
          />
        );
      })}

      {showAspectLines
        ? chart.aspects.map((aspect) => {
            const fromPlanet = planetMap.get(aspect.fromBody.toLowerCase());
            const toPlanet = planetMap.get(aspect.toBody.toLowerCase());
            if (!fromPlanet || !toPlanet) {
              return null;
            }
            const fromPoint = polarToCartesian(
              center,
              center,
              Math.min(fromPlanet.orbit ?? defaultPlanetRadius, innerHouseRadius - 8),
              getPlacementAngle(fromPlanet.sign, fromPlanet.degree),
            );
            const toPoint = polarToCartesian(
              center,
              center,
              Math.min(toPlanet.orbit ?? defaultPlanetRadius, innerHouseRadius - 8),
              getPlacementAngle(toPlanet.sign, toPlanet.degree),
            );
            return (
              <line
                key={`${aspect.fromBody}-${aspect.toBody}-${aspect.type}`}
                x1={fromPoint.x}
                y1={fromPoint.y}
                x2={toPoint.x}
                y2={toPoint.y}
                stroke={ASPECT_COLORS[aspect.type]}
                strokeWidth={aspect.type === 'square' || aspect.type === 'opposition' ? 1.9 : 1.5}
                strokeDasharray={aspect.type === 'trine' || aspect.type === 'sextile' ? '5 4' : undefined}
                opacity={0.86}
              />
            );
          })
        : null}

      {ZODIAC_ORDER.map((sign, index) => {
        const point = polarToCartesian(center, center, labelRadius, index * 30 - 75);
        return (
          <text
            key={`sign-label-${sign}`}
            x={point.x}
            y={point.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={highlightSet.has(sign) ? STARS_TEXT : STARS_TEXT_SECONDARY}
            fontSize={size * 0.028}
            fontWeight={800}
            style={{ cursor: onSelect ? 'pointer' : 'default', letterSpacing: 1.4 }}
            onClick={() => onSelect?.('sign', sign)}
          >
            {shortSign(sign)}
          </text>
        );
      })}

      {housePlacements.map((house, index) => {
        const point = polarToCartesian(center, center, (innerSignRadius + innerHouseRadius) / 2, index * 30 - 75);
        const active = highlightSet.has(`house-${house.house}`) || highlightSet.has(String(house.house));
        return (
          <g
            key={`house-${house.house}`}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect?.('house', house.house)}
          >
            <circle cx={point.x} cy={point.y} r={size * 0.028} fill={active ? withAlpha(STARS_ACCENT, 0.34) : withAlpha(STARS_TEXT, 0.05)} />
            <text
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={active ? STARS_ACCENT_LIGHT : STARS_TEXT_SECONDARY}
              fontSize={size * 0.024}
              fontWeight={700}
            >
              {house.house}
            </text>
          </g>
        );
      })}

      {chart.planets.map((planet) => {
        const radius = planet.orbit ?? defaultPlanetRadius;
        const point = polarToCartesian(center, center, radius, getPlacementAngle(planet.sign, planet.degree));
        const key = (planet.id ?? planet.body).toLowerCase();
        const active = highlightSet.has(key) || highlightSet.has(planet.body.toLowerCase());
        return (
          <g
            key={key}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect?.('planet', planet.body)}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={size * 0.042}
              fill={withAlpha(planet.tone ?? STARS_ACCENT, active ? 0.34 : 0.24)}
              stroke={active ? STARS_ACCENT_LIGHT : withAlpha(STARS_TEXT, 0.2)}
              strokeWidth={active ? 2.4 : 1.4}
            />
            <text
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={STARS_TEXT}
              fontSize={size * 0.026}
              fontWeight={800}
              style={{ letterSpacing: 0.8 }}
            >
              {PLANET_SHORT_LABELS[planet.body] ?? planet.body.slice(0, 2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
