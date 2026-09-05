import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

function flattenStyle(style: unknown): Record<string, unknown> | undefined {
  if (style == null) return undefined;
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, entry) => {
      const value = flattenStyle(entry);
      return value ? { ...acc, ...value } : acc;
    }, {});
  }
  if (typeof style === 'object') return style as Record<string, unknown>;
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
      { ...props, style: flattenStyle(style) },
      children,
    );
  };
}

function imagePrimitive() {
  return function Image({
    source,
    style,
    ...props
  }: {
    source?: { uri?: string } | unknown;
    style?: unknown;
    [key: string]: unknown;
  }) {
    const uri =
      source && typeof source === 'object' && 'uri' in source
        ? String((source as { uri?: string }).uri ?? '')
        : '';
    return React.createElement('img', {
      ...props,
      src: uri,
      style: flattenStyle(style),
    });
  };
}

vi.mock('react-native', () => ({
  View: primitive('div'),
  Text: primitive('span'),
  Image: imagePrimitive(),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({
    colors,
    children,
    style,
  }: {
    colors: readonly string[];
    children?: React.ReactNode;
    style?: unknown;
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'linear-gradient',
        'data-colors': colors.join(','),
        style: flattenStyle(style),
      },
      children,
    ),
}));

import { DishVisual } from '../primitives/DishVisual';

describe('DishVisual smoke render', () => {
  it('renders Italian gradient and emoji', () => {
    const html = renderToStaticMarkup(
      React.createElement(DishVisual, {
        dish: { name: 'Margherita', cuisine: 'Italian' },
        size: 120,
      }),
    );
    expect(html).toContain('#F27333,#A63326');
    expect(html).toContain('\u{1F37D}\u{FE0F}');
  });

  it('renders Japanese gradient with ramen emoji', () => {
    const html = renderToStaticMarkup(
      React.createElement(DishVisual, {
        dish: {
          name: 'Tonkotsu Ramen',
          cuisine: 'Japanese',
          gradientFrom: '#EBC766',
          gradientTo: '#B37333',
          emoji: '\u{1F35C}',
        },
        size: 96,
        radius: 24,
      }),
    );
    expect(html).toContain('#EBC766,#B37333');
    expect(html).toContain('\u{1F35C}');
  });

  it('renders Mexican gradient and overlays photo when photoUrl is set', () => {
    const html = renderToStaticMarkup(
      React.createElement(DishVisual, {
        dish: {
          name: 'Tacos al Pastor',
          cuisine: 'Mexican',
          photoUrl: 'https://example.test/taco.jpg',
        },
        size: 80,
      }),
    );
    expect(html).toContain('#F2662E,#A6401F');
    expect(html).toContain('\u{1F32E}');
    expect(html).toContain('https://example.test/taco.jpg');
  });
});
