import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MoonPhaseGlyph } from '../ui/components/MoonPhaseGlyph';
import { ZodiacSign } from '../ui/components/ZodiacSign';
import { ST_ELEMENTS, ST_MOON_PHASES } from '../ui/tokens';

function flattenStyle(style: unknown): Record<string, unknown> | undefined {
  if (style == null) {
    return undefined;
  }
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, entry) => {
      const value = flattenStyle(entry);
      return value ? { ...acc, ...value } : acc;
    }, {});
  }
  if (typeof style === 'object') {
    return style as Record<string, unknown>;
  }
  return undefined;
}

function primitive(name: string) {
  return function Primitive({
    children,
    style,
    ...props
  }: {
    children?: React.ReactNode;
    style?: unknown;
    [key: string]: unknown;
  }) {
    return React.createElement(
      name,
      {
        ...props,
        style: flattenStyle(style),
      },
      children,
    );
  };
}

vi.mock('react-native', () => ({
  View: primitive('div'),
  Text: primitive('span'),
  Pressable: primitive('button'),
  ScrollView: primitive('div'),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    absoluteFill: {},
    absoluteFillObject: {},
  },
}));

vi.mock('expo-blur', () => ({
  BlurView: primitive('div'),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: primitive('div'),
}));

vi.mock('@expo/vector-icons', () => ({
  MaterialIcons: primitive('i'),
}));

vi.mock('react-native-svg', () => {
  const Svg = primitive('svg');
  const Circle = primitive('circle');
  const Ellipse = primitive('ellipse');
  const G = primitive('g');
  const Line = primitive('line');
  const Path = primitive('path');
  const ClipPath = primitive('clipPath');
  const Defs = primitive('defs');

  return {
    default: Svg,
    Svg,
    Circle,
    Ellipse,
    G,
    Line,
    Path,
    ClipPath,
    Defs,
  };
});

describe('stars shared UI components', () => {
  it('maps zodiac signs to their elemental tone', () => {
    const html = renderToStaticMarkup(
      <ZodiacSign sign="aries" showName size={24} />,
    );

    expect(html).toContain('Aries');
    expect(html).toContain('♈');
    expect(html).toContain(ST_ELEMENTS.fire);
  });

  it('maps moon phases to the expected phase color token', () => {
    const html = renderToStaticMarkup(
      <MoonPhaseGlyph phase="full_moon" illumination={100} size={72} />,
    );

    expect(html).toContain('100%');
    expect(html).toContain(ST_MOON_PHASES.full_moon);
  });
});
