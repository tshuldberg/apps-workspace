import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DifficultyChip, getDifficultyChipMeta } from '../ui/components/DifficultyChip';
import { StatDisplay, formatStatDisplayValue } from '../ui/components/StatDisplay';
import { TR_DIFFICULTY } from '../ui/tokens';

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
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    absoluteFillObject: {},
    absoluteFill: {},
  },
}));

vi.mock('@expo/vector-icons', () => ({
  MaterialIcons: primitive('i'),
}));

describe('trails shared UI helpers', () => {
  it('maps each difficulty chip to the expected label, icon, and color', () => {
    expect(getDifficultyChipMeta('easy')).toEqual({
      color: TR_DIFFICULTY.easy,
      icon: 'terrain',
      label: 'Easy',
    });

    expect(getDifficultyChipMeta('moderate')).toEqual({
      color: TR_DIFFICULTY.moderate,
      icon: 'trending_up',
      label: 'Moderate',
    });

    const html = renderToStaticMarkup(
      React.createElement(DifficultyChip, {
        level: 'expert',
      }),
    );

    expect(html).toContain('Expert');
    expect(html).toContain(TR_DIFFICULTY.expert);
  });

  it('formats stat display values and renders unit + label copy', () => {
    expect(formatStatDisplayValue(4200)).toBe('4,200');
    expect(formatStatDisplayValue(182.4)).toBe('182.4');
    expect(formatStatDisplayValue('5:42')).toBe('5:42');

    const html = renderToStaticMarkup(
      React.createElement(StatDisplay, {
        value: 182.4,
        unit: 'km',
        label: 'Distance',
      }),
    );

    expect(html).toContain('182.4');
    expect(html).toContain('km');
    expect(html).toContain('Distance');
  });
});
