import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BarChart, getBarChartMaxValue } from '../src/ui/components/BarChart';
import { StatCard } from '../src/ui/components/StatCard';

function primitive(name: string) {
  return function Primitive({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) {
    return React.createElement(name, props, children);
  };
}

vi.mock('react-native', () => ({
  View: primitive('div'),
  Text: primitive('span'),
  Pressable: primitive('button'),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    absoluteFillObject: {},
  },
  Dimensions: {
    get: () => ({ width: 390, height: 844 }),
  },
}));

vi.mock('react-native-svg', () => {
  const Svg = primitive('svg');
  const Rect = primitive('rect');

  return {
    default: Svg,
    Svg,
    Rect,
  };
});

describe('workouts shared UI components', () => {
  it('renders the stat card label and value copy', () => {
    const html = renderToStaticMarkup(
      <StatCard label="This Week Sessions" value={5} suffix="/ 6" />,
    );

    expect(html).toContain('This Week Sessions');
    expect(html).toContain('5');
    expect(html).toContain('/ 6');
  });

  it('renders chart labels and calculates a safe max value', () => {
    const html = renderToStaticMarkup(
      <BarChart
        data={[
          { label: 'W1', value: 120 },
          { label: 'W2', value: 240 },
          { label: 'W3', value: 180 },
        ]}
      />,
    );

    expect(html).toContain('W1');
    expect(html).toContain('W2');
    expect(getBarChartMaxValue([{ label: 'W1', value: 120 }])).toBe(120);
    expect(getBarChartMaxValue([], undefined)).toBe(1);
    expect(
      getBarChartMaxValue([{ label: 'W1', value: 120 }], 400),
    ).toBe(400);
  });
});
