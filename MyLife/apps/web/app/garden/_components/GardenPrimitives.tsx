'use client';

import type { CSSProperties, ReactNode } from 'react';
import { GARDEN_CHROME, GARDEN_FONT, alpha, getPlantInitials } from '../_lib/design';

export function GardenPanel({
  children,
  style,
  tone = 'lift',
}: {
  children: ReactNode;
  style?: CSSProperties;
  tone?: 'base' | 'lift' | 'focus' | 'highest';
}) {
  const background = tone === 'focus'
    ? GARDEN_CHROME.surfaceFocus
    : tone === 'highest'
      ? GARDEN_CHROME.surfaceHighest
      : tone === 'base'
        ? GARDEN_CHROME.surfaceBase
        : GARDEN_CHROME.surfaceLift;

  return (
    <div
      style={{
        borderRadius: 28,
        background,
        boxShadow: `inset 0 0 0 1px ${alpha('#FFFFFF', 0.03)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function GardenActionButton({
  children,
  style,
  tone = 'accent',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  style?: CSSProperties;
  tone?: 'accent' | 'gold';
}) {
  const background = tone === 'gold'
    ? `linear-gradient(135deg, ${GARDEN_CHROME.gold}, ${GARDEN_CHROME.goldDeep})`
    : `linear-gradient(135deg, ${GARDEN_CHROME.accentLight}, ${GARDEN_CHROME.accent})`;
  const color = tone === 'gold' ? '#2E1600' : '#081105';

  return (
    <button
      type="button"
      {...rest}
      style={{
        border: 'none',
        cursor: 'pointer',
        minHeight: 46,
        padding: '0 18px',
        borderRadius: 999,
        background,
        color,
        fontFamily: GARDEN_FONT,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        boxShadow: `0 16px 28px ${alpha(tone === 'gold' ? GARDEN_CHROME.gold : GARDEN_CHROME.accent, 0.24)}`,
        transition: 'transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GardenGhostButton({
  children,
  style,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        border: `1px solid ${alpha('#FFFFFF', 0.08)}`,
        cursor: 'pointer',
        minHeight: 44,
        padding: '0 16px',
        borderRadius: 999,
        background: alpha('#FFFFFF', 0.04),
        color: GARDEN_CHROME.text,
        fontFamily: GARDEN_FONT,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        transition: 'transform 180ms ease, background-color 180ms ease, border-color 180ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GardenBadge({
  text,
  color = GARDEN_CHROME.accent,
  background,
  style,
}: {
  text: string;
  color?: string;
  background?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 26,
        padding: '0 10px',
        borderRadius: 999,
        background: background ?? alpha(color, 0.14),
        color,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {text}
    </span>
  );
}

export function GardenKicker({ children, color = GARDEN_CHROME.accent, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function GardenImage({
  src,
  alt,
  title,
  style,
  overlay,
}: {
  src?: string | null;
  alt: string;
  title: string;
  style?: CSSProperties;
  overlay?: ReactNode;
}) {
  if (src) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {overlay}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(circle at top left, ${alpha(GARDEN_CHROME.accent, 0.38)}, ${GARDEN_CHROME.surfaceHighest})`,
        color: '#E8F8D8',
        ...style,
      }}
    >
      <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1.2 }}>{getPlantInitials(title)}</span>
      {overlay}
    </div>
  );
}

export function GardenEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <GardenPanel
      tone="base"
      style={{
        minHeight: 320,
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'grid', gap: 14, maxWidth: 440 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            margin: '0 auto',
            display: 'grid',
            placeItems: 'center',
            background: alpha(GARDEN_CHROME.accent, 0.14),
            color: GARDEN_CHROME.accent,
            fontSize: 32,
            fontWeight: 800,
          }}
        >
          MG
        </div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.9 }}>{title}</h2>
        <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>{description}</p>
        {action ? <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>{action}</div> : null}
      </div>
    </GardenPanel>
  );
}

export function GardenMetricCard({
  label,
  value,
  detail,
  accent = GARDEN_CHROME.accent,
  style,
}: {
  label: string;
  value: string | number;
  detail?: string;
  accent?: string;
  style?: CSSProperties;
}) {
  return (
    <GardenPanel tone="lift" style={{ padding: 22, ...style }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <GardenKicker color={accent}>{label}</GardenKicker>
        <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.4, color: accent }}>{value}</div>
        {detail ? <div style={{ color: GARDEN_CHROME.textDim, fontSize: 13 }}>{detail}</div> : null}
      </div>
    </GardenPanel>
  );
}
