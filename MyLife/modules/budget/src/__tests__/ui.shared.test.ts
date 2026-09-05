import React from 'react';
// react-dom 19 ships server.node.js without bundled types, and budget's
// tsconfig restricts ambient types to ["react-native"]. Suppress the TS7016
// to keep this test module-local without adding @types/react-dom workspace-wide.
// @ts-expect-error TS7016 untyped react-dom/server runtime
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvelopeCard } from '../ui/components/EnvelopeCard';
import { AmountDisplay } from '../ui/components/AmountDisplay';
import { BG_ENVELOPE_STATUS, BG_TX_TYPES } from '../ui/tokens';

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
    numberOfLines,
    ...props
  }: {
    children?: React.ReactNode;
    style?: unknown;
    numberOfLines?: unknown;
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
  Animated: {
    Value: class {
      constructor(public value: number) {}
    },
    View: primitive('div'),
    spring: () => ({ start: () => undefined }),
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

vi.mock('lucide-react-native', () => ({}));

describe('budget shared UI components', () => {
  it('renders amount display sign and semantic color', () => {
    const html = renderToStaticMarkup(
      React.createElement(AmountDisplay, {
        cents: 4250,
        type: 'income',
        showSign: true,
      }),
    );

    expect(html).toContain('+$42.50');
    expect(html).toContain(BG_TX_TYPES.income);
  });

  it('renders envelope status tone for close-to-limit progress', () => {
    const html = renderToStaticMarkup(
      React.createElement(EnvelopeCard, {
        envelope: {
          id: 'env-food',
          name: 'Food',
          icon: '🍜',
          color: null,
          monthly_budget: 12000,
          rollover_enabled: 1,
          archived: 0,
          sort_order: 0,
          created_at: '2026-04-06T00:00:00.000Z',
          updated_at: '2026-04-06T00:00:00.000Z',
        },
        allocated: 12000,
        spent: 10000,
      }),
    );

    expect(html).toContain('Food');
    expect(html).toContain(BG_ENVELOPE_STATUS.close);
  });
});
