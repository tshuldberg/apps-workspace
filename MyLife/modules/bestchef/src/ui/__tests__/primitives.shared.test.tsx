import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

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
    const safeProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'function') continue;
      if (value !== null && typeof value === 'object') continue;
      safeProps[key] = value;
    }
    return React.createElement(
      name,
      {
        ...safeProps,
        style: flattenStyle(style),
      },
      children,
    );
  };
}

vi.mock('react-native', () => {
  const View = primitive('div');
  const Text = primitive('span');
  const Pressable = primitive('button');
  const ScrollView = primitive('div');
  const StyleSheet = {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    absoluteFillObject: {},
    absoluteFill: {},
    hairlineWidth: 1,
    flatten: (s: unknown) => flattenStyle(s),
  };
  const Easing = {
    out: () => () => 0,
    in: () => () => 0,
    inOut: () => () => 0,
    quad: () => 0,
  };
  const Platform = {
    OS: 'ios' as const,
    select: <T,>(specifics: { ios?: T; default?: T }) => specifics.ios ?? specifics.default,
  };
  const Animated = {
    Value: class {
      private _value: number;
      constructor(value: number) {
        this._value = value;
      }
      setValue(v: number) {
        this._value = v;
      }
      interpolate() {
        return new Animated.Value(0);
      }
    },
    View: primitive('div'),
    spring: () => ({ start: () => undefined, stop: () => undefined }),
    timing: () => ({ start: () => undefined, stop: () => undefined }),
    parallel: () => ({ start: () => undefined, stop: () => undefined }),
    sequence: () => ({ start: () => undefined, stop: () => undefined }),
    loop: () => ({ start: () => undefined, stop: () => undefined }),
  };
  return {
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
    Easing,
    Platform,
    Animated,
  };
});

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: primitive('div'),
}));

vi.mock('expo-blur', () => ({
  BlurView: primitive('div'),
}));

vi.mock('@mylife/ui', () => {
  const colors = {
    text: '#F8F2E8',
    textSecondary: '#A88F79',
  };
  const theme = {
    glass: {
      cardFill: 'rgba(255,255,255,0.08)',
      cardBorder: 'rgba(255,255,255,0.16)',
      strongFill: 'rgba(255,255,255,0.14)',
    },
  };
  return {
    useTheme: () => theme,
    useThemeColors: () => colors,
  };
});

vi.mock('react-native-svg', () => {
  const Svg = primitive('svg');
  const Circle = primitive('circle');
  const Defs = primitive('defs');
  const LinearGradient = primitive('lineargradient');
  const Stop = primitive('stop');
  return {
    default: Svg,
    Svg,
    Circle,
    Defs,
    LinearGradient,
    Stop,
  };
});

import { AddedToast } from '../primitives/AddedToast';
import { BCSectionHeader } from '../primitives/BCSectionHeader';
import { Card } from '../primitives/Card';
import { CategoryScrollPicker } from '../primitives/CategoryScrollPicker';
import { CircleIconButton } from '../primitives/CircleIconButton';
import { CountIndicator } from '../primitives/CountIndicator';
import { FilterChips } from '../primitives/FilterChips';
import { FlowChips } from '../primitives/FlowChips';
import { HeaderStat } from '../primitives/HeaderStat';
import { HintBubble } from '../primitives/HintBubble';
import { InfoCard } from '../primitives/InfoCard';
import { LiveBadge } from '../primitives/LiveBadge';
import { MedalBadge } from '../primitives/MedalBadge';
import { RankBadge } from '../primitives/RankBadge';
import { StatBox } from '../primitives/StatBox';
import { StatPill } from '../primitives/StatPill';
import { StepHeader } from '../primitives/StepHeader';
import { VerdictRing } from '../primitives/VerdictRing';
import { springs } from '../primitives/springs';

function smoke(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe('bestchef are-blaze primitives smoke', () => {
  it('Card renders all variants without crashing', () => {
    expect(smoke(React.createElement(Card, { variant: 'default' }))).toContain('<div');
    expect(smoke(React.createElement(Card, { variant: 'subtle' }))).toContain('<div');
    expect(smoke(React.createElement(Card, { variant: 'glass' }))).toContain('<div');
  });

  it('BCSectionHeader renders title, subtitle, and action label', () => {
    const html = smoke(
      React.createElement(BCSectionHeader, {
        title: 'Top This Week',
        subtitle: 'Hottest dishes right now',
        action: { text: 'See all', onPress: () => undefined },
      }),
    );
    expect(html).toContain('Top This Week');
    expect(html).toContain('HOTTEST DISHES RIGHT NOW');
    expect(html).toContain('See all');
  });

  it('StatPill renders value and uppercased caption', () => {
    const html = smoke(
      React.createElement(StatPill, { value: '1,243', caption: 'votes cast' }),
    );
    expect(html).toContain('1,243');
    expect(html).toContain('VOTES CAST');
  });

  it('StatBox renders value and caption with smaller frame', () => {
    const html = smoke(
      React.createElement(StatBox, { value: '4.7', caption: 'avg score' }),
    );
    expect(html).toContain('4.7');
    expect(html).toContain('AVG SCORE');
  });

  it('HeaderStat renders compact pill with value and label', () => {
    const html = smoke(
      React.createElement(HeaderStat, { value: '12', label: 'votes' }),
    );
    expect(html).toContain('12');
    expect(html).toContain('votes');
  });

  it('FilterChips renders selected chip via gradient and unselected chip', () => {
    const html = smoke(
      React.createElement(FilterChips, {
        options: [
          { id: 'all', label: 'All' },
          { id: 'pasta', label: 'Pasta' },
        ],
        selected: 'all',
        onChange: () => undefined,
      }),
    );
    expect(html).toContain('All');
    expect(html).toContain('Pasta');
  });

  it('FlowChips renders wrapped chips', () => {
    const html = smoke(
      React.createElement(FlowChips, {
        options: [
          { id: 'pho', label: 'Pho' },
          { id: 'tacos', label: 'Tacos' },
        ],
        selected: 'pho',
        onChange: () => undefined,
      }),
    );
    expect(html).toContain('Pho');
    expect(html).toContain('Tacos');
  });

  it('CategoryScrollPicker renders selected and unselected capsules', () => {
    const html = smoke(
      React.createElement(CategoryScrollPicker, {
        options: [
          { id: 'all-time', label: 'All-Time' },
          { id: 'weekly', label: 'Weekly' },
        ],
        selected: 'all-time',
        onChange: () => undefined,
      }),
    );
    expect(html).toContain('All-Time');
    expect(html).toContain('Weekly');
  });

  it('CircleIconButton renders accessible button frame', () => {
    const html = smoke(
      React.createElement(CircleIconButton, {
        icon: React.createElement('span', null, 'icn'),
        onPress: () => undefined,
        accessibilityLabel: 'Back',
      }),
    );
    expect(html).toContain('icn');
    expect(html).toContain('Back');
  });

  it('StepHeader renders title, subtitle, and required pill', () => {
    const html = smoke(
      React.createElement(StepHeader, {
        title: 'Add final photos',
        subtitle: 'At least 1 finished plate',
        required: true,
        requiredLabel: 'REQUIRED',
      }),
    );
    expect(html).toContain('Add final photos');
    expect(html).toContain('At least 1 finished plate');
    expect(html).toContain('REQUIRED');
  });

  it('InfoCard renders title and message body', () => {
    const html = smoke(
      React.createElement(InfoCard, {
        title: 'Tip',
        message: 'Reviewed votes count for more.',
      }),
    );
    expect(html).toContain('Tip');
    expect(html).toContain('Reviewed votes count for more.');
  });

  it('CountIndicator renders progress text', () => {
    const html = smoke(
      React.createElement(CountIndicator, { count: 2, target: 1, unit: 'photos' }),
    );
    expect(html).toContain('2 of 1 photos');
  });

  it('AddedToast renders message capsule', () => {
    const html = smoke(
      React.createElement(AddedToast, { message: 'Added to grocery' }),
    );
    expect(html).toContain('Added to grocery');
  });

  it('VerdictRing renders gradient ring with auto label', () => {
    const html = smoke(React.createElement(VerdictRing, { progress: 0.42 }));
    expect(html).toContain('42%');
    expect(html).toContain('<svg');
  });

  it('VerdictRing accepts explicit label override', () => {
    const html = smoke(
      React.createElement(VerdictRing, { progress: 1, label: 'BEST' }),
    );
    expect(html).toContain('BEST');
  });

  it('RankBadge renders #N for each variant', () => {
    expect(smoke(React.createElement(RankBadge, { rank: 1, variant: 'gold' }))).toContain('#1');
    expect(smoke(React.createElement(RankBadge, { rank: 2, variant: 'silver' }))).toContain('#2');
    expect(smoke(React.createElement(RankBadge, { rank: 3, variant: 'bronze' }))).toContain('#3');
    expect(smoke(React.createElement(RankBadge, { rank: 27 }))).toContain('#27');
  });

  it('MedalBadge renders glyph fallback when no icon is provided', () => {
    const html = smoke(React.createElement(MedalBadge, { rank: 'gold' }));
    expect(html).toContain('★');
  });

  it('LiveBadge renders uppercased label', () => {
    const html = smoke(React.createElement(LiveBadge, { label: 'live' }));
    expect(html).toContain('LIVE');
  });

  it('HintBubble renders tip text', () => {
    const html = smoke(
      React.createElement(HintBubble, { text: 'Swipe up to review' }),
    );
    expect(html).toContain('Swipe up to review');
  });

  it('springs presets stay stable across phases', () => {
    expect(springs.tap).toEqual({ damping: 18, mass: 0.6, stiffness: 280 });
    expect(springs.gentle).toEqual({ damping: 22, mass: 0.8, stiffness: 220 });
    expect(springs.fly).toEqual({ damping: 26, mass: 1.0, stiffness: 320 });
  });
});
