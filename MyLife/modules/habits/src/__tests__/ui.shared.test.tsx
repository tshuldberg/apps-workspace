import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CheckCircle } from '../ui/components/CheckCircle';
import {
  HeatmapCalendar,
  getHeatmapCellColor,
  getHeatmapIntensity,
} from '../ui/components/HeatmapCalendar';
import {
  getStreakFlameColor,
  getStreakFlameTone,
} from '../ui/components/StreakFlame';
import {
  HB_ACCENT,
  HB_STREAK,
  HB_SURFACES,
} from '../ui/tokens';

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
    absoluteFillObject: {},
    absoluteFill: {},
  },
  Animated: {
    Value: class {
      constructor(public value: number) {}
      setValue(next: number) {
        this.value = next;
      }
      stopAnimation() {
        return undefined;
      }
    },
    View: primitive('div'),
    spring: () => ({ start: (cb?: () => void) => cb?.() }),
    timing: () => ({ start: (cb?: () => void) => cb?.() }),
    sequence: () => ({ start: (cb?: () => void) => cb?.() }),
    loop: () => ({ start: () => undefined, stop: () => undefined }),
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
  const G = primitive('g');
  const Rect = primitive('rect');
  const Text = primitive('text');
  const Circle = primitive('circle');

  return {
    default: Svg,
    Svg,
    G,
    Rect,
    Text,
    Circle,
  };
});

describe('habits shared UI components', () => {
  it('renders check circle states with the expected fill treatment', () => {
    const checkedHtml = renderToStaticMarkup(
      <CheckCircle checked color={HB_ACCENT} />,
    );
    const uncheckedHtml = renderToStaticMarkup(
      <CheckCircle checked={false} />,
    );

    expect(checkedHtml).toContain(HB_ACCENT);
    expect(checkedHtml).toContain('check');
    expect(uncheckedHtml).toContain(HB_SURFACES.high);
  });

  it('maps streak tiers to the expected fire, legendary, and frozen tones', () => {
    expect(getStreakFlameTone(12)).toBe('fire');
    expect(getStreakFlameTone(120)).toBe('legendary');
    expect(getStreakFlameTone(9, true)).toBe('frozen');

    expect(getStreakFlameColor(12)).toBe(HB_STREAK.fire);
    expect(getStreakFlameColor(120)).toBe(HB_STREAK.legendary);
    expect(getStreakFlameColor(9, true)).toBe(HB_STREAK.frozen);
  });

  it('scales heatmap cells by value intensity', () => {
    expect(getHeatmapIntensity(0, 5)).toBe(0);
    expect(getHeatmapIntensity(2, 5)).toBe(2);
    expect(getHeatmapIntensity(5, 5)).toBe(4);
    expect(getHeatmapCellColor(5, 5)).toBe(HB_ACCENT);

    const html = renderToStaticMarkup(
      <HeatmapCalendar
        data={[
          { date: '2026-01-01', value: 0 },
          { date: '2026-01-02', value: 3 },
          { date: '2026-01-03', value: 5 },
        ]}
      />,
    );

    expect(html).toContain('Jan');
    expect(html).toContain(HB_ACCENT);
  });
});
