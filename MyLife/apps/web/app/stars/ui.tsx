'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { ZodiacSign } from '@mylife/stars';

export const STARS_BG = '#0E0E13';
export const STARS_SURFACE = '#131318';
export const STARS_SURFACE_LOW = '#1B1B20';
export const STARS_SURFACE_MID = '#1F1F25';
export const STARS_SURFACE_HIGH = '#2A292F';
export const STARS_SURFACE_TOP = '#35343A';
export const STARS_TEXT = '#E4E1E9';
export const STARS_TEXT_SECONDARY = '#D6C3B5';
export const STARS_TEXT_TERTIARY = 'rgba(228,225,233,0.42)';
export const STARS_BORDER = 'rgba(255,255,255,0.08)';
export const STARS_GLASS = 'rgba(255,255,255,0.04)';
export const STARS_GLASS_STRONG = 'rgba(255,255,255,0.08)';
export const STARS_GLASS_BORDER = 'rgba(255,255,255,0.11)';
export const STARS_ACCENT = '#A78BFA';
export const STARS_ACCENT_LIGHT = '#C4B5FD';
export const STARS_ACCENT_DEEP = '#7C3AED';
export const STARS_ACCENT_GLOW = 'rgba(167,139,250,0.34)';
export const STARS_GOLD = '#FFB877';
export const STARS_FIRE = '#FFB4AB';
export const STARS_EARTH = '#84CC16';
export const STARS_AIR = '#8BCFF0';
export const STARS_WATER = '#A78BFA';
export const STARS_SUCCESS = '#30D158';
export const STARS_WARNING = '#FF9F0A';
export const STARS_DANGER = '#FF453A';
export const STARS_SIDEBAR_WIDTH = 280;
export const STARS_FONT_STACK = '"Plus Jakarta Sans", "Inter", system-ui, sans-serif';

export const STARS_PRIMARY_NAV = [
  { href: '/stars', label: 'Today', icon: 'auto_awesome', exact: true },
  { href: '/stars/moon', label: 'Sky', icon: 'dark_mode' },
  { href: '/stars/journal', label: 'Journal', icon: 'menu_book' },
  { href: '/stars/chart', label: 'Charts', icon: 'orbital' },
  { href: '/stars/compatibility', label: 'Compatibility', icon: 'favorite' },
  { href: '/stars/moon-calendar', label: 'Moon', icon: 'calendar_month' },
  { href: '/stars/tarot', label: 'Tarot', icon: 'style' },
  { href: '/stars/zodiac-events', label: 'Events', icon: 'flare' },
  { href: '/stars/settings', label: 'Settings', icon: 'settings' },
] as const;

export const STARS_SECONDARY_NAV = [
  { href: '/stars/retrograde', label: 'Retrogrades', icon: 'autorenew' },
  { href: '/stars/profile?panel=solar-return', label: 'Solar Return', icon: 'sunny' },
  { href: '/stars/profile?panel=progressions', label: 'Progressions', icon: 'timeline' },
  { href: '/stars/profile', label: 'Friends', icon: 'group' },
  { href: '/stars/readings', label: 'History', icon: 'history' },
] as const;

export const STARS_ZODIAC_LABELS: Record<ZodiacSign, string> = {
  aries: 'Aries',
  taurus: 'Taurus',
  gemini: 'Gemini',
  cancer: 'Cancer',
  leo: 'Leo',
  virgo: 'Virgo',
  libra: 'Libra',
  scorpio: 'Scorpio',
  sagittarius: 'Sagittarius',
  capricorn: 'Capricorn',
  aquarius: 'Aquarius',
  pisces: 'Pisces',
};

export const STARS_ZODIAC_COLORS: Record<ZodiacSign, string> = {
  aries: STARS_FIRE,
  taurus: '#A3E635',
  gemini: STARS_AIR,
  cancer: STARS_WATER,
  leo: STARS_GOLD,
  virgo: '#B7F26F',
  libra: '#B8E6FF',
  scorpio: '#D8A6FF',
  sagittarius: '#FFC6B8',
  capricorn: '#D0E86A',
  aquarius: '#9FDBFF',
  pisces: '#CBB9FF',
};

export const STARS_MOON_PHASE_LABELS: Record<string, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

export const STARS_MOON_PHASE_EMOJIS: Record<string, string> = {
  new_moon: '\u{1F311}',
  waxing_crescent: '\u{1F312}',
  first_quarter: '\u{1F313}',
  waxing_gibbous: '\u{1F314}',
  full_moon: '\u{1F315}',
  waning_gibbous: '\u{1F316}',
  last_quarter: '\u{1F317}',
  waning_crescent: '\u{1F318}',
};

export const STARS_GLOBAL_CSS = `
  .stars-symbol {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: 'Material Symbols Outlined';
    line-height: 1;
    letter-spacing: normal;
    white-space: nowrap;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }

  .stars-shell {
    display: grid;
    grid-template-columns: ${STARS_SIDEBAR_WIDTH}px minmax(0, 1fr);
    min-height: 100vh;
  }

  .stars-sidebar {
    position: sticky;
    top: 0;
    align-self: start;
    min-height: 100vh;
  }

  .stars-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .stars-scroll::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .stars-scroll::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(196,181,253,0.22);
  }

  .stars-markdown > * + * {
    margin-top: 0.9rem;
  }

  .stars-markdown p,
  .stars-markdown li {
    color: ${STARS_TEXT_SECONDARY};
    line-height: 1.75;
  }

  .stars-markdown ul,
  .stars-markdown ol {
    padding-left: 1.25rem;
  }

  .stars-markdown strong {
    color: ${STARS_TEXT};
  }

  .stars-card-glow {
    position: relative;
    overflow: hidden;
  }

  .stars-card-glow::after {
    content: '';
    position: absolute;
    inset: auto -10% -44% auto;
    width: 220px;
    height: 220px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(167,139,250,0.22), transparent 70%);
    pointer-events: none;
  }

  @media (max-width: 1100px) {
    .stars-shell {
      grid-template-columns: 1fr;
    }

    .stars-sidebar {
      position: static;
      min-height: auto;
    }
  }

  @media (max-width: 780px) {
    .stars-topbar {
      position: static;
    }
  }
`;

export function withAlpha(color: string, alpha: number): string {
  const value = color.trim();
  if (value.startsWith('rgba(')) {
    return value;
  }
  if (value.startsWith('rgb(')) {
    return value.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  const normalized = value.replace('#', '');
  if (normalized.length !== 6) {
    return color;
  }
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function getBreadcrumb(pathname: string): string {
  if (pathname === '/stars') return 'Today';
  if (pathname.startsWith('/stars/chart')) return 'Birth Chart';
  if (pathname.startsWith('/stars/moon-calendar')) return 'Moon Calendar';
  if (pathname.startsWith('/stars/moon')) return 'Moon Portal';
  if (pathname.startsWith('/stars/journal/compose')) return 'Compose Reflection';
  if (pathname.startsWith('/stars/journal/')) return 'Journal Entry';
  if (pathname.startsWith('/stars/journal')) return 'Cosmic Journal';
  if (pathname.startsWith('/stars/tarot')) return 'Tarot Sanctuary';
  if (pathname.startsWith('/stars/compatibility')) return 'Compatibility';
  if (pathname.startsWith('/stars/transit-timeline')) return 'Transit Timeline';
  if (pathname.startsWith('/stars/zodiac-events')) return 'Zodiac Events';
  if (pathname.startsWith('/stars/retrograde')) return 'Retrogrades';
  if (pathname.startsWith('/stars/profile/')) return 'Profile Detail';
  if (pathname.startsWith('/stars/profile')) return 'Profiles';
  if (pathname.startsWith('/stars/readings')) return 'Reading Archive';
  if (pathname.startsWith('/stars/settings')) return 'Settings';
  return 'MyStars';
}

export function getTimezoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetMinutes = new Date().getTimezoneOffset() * -1;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return `${zone} · UTC${sign}${hours}:${minutes}`;
}

export function isNavActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  const baseHref = href.split('?')[0];
  if (exact) {
    return pathname === baseHref;
  }
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

export function StarsSymbol({
  name,
  size = 20,
  color = STARS_TEXT,
  filled = false,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className="material-symbols-outlined stars-symbol"
      style={{
        fontSize: size,
        color,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${Math.max(
          20,
          Math.min(48, Math.round(size)),
        )}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export function panelStyle(options?: {
  padding?: number;
  tone?: string;
  glow?: boolean;
  minHeight?: number;
}): CSSProperties {
  const padding = options?.padding ?? 24;
  const tone = options?.tone ?? STARS_SURFACE_LOW;
  return {
    position: 'relative',
    padding,
    borderRadius: 28,
    background: `linear-gradient(180deg, ${withAlpha(tone, 0.92)}, ${withAlpha(
      STARS_SURFACE,
      0.98,
    )})`,
    boxShadow: [
      `inset 0 0 0 1.5px ${STARS_GLASS_BORDER}`,
      options?.glow ? `0 0 42px ${withAlpha(STARS_ACCENT, 0.18)}` : 'none',
    ].join(', '),
    minHeight: options?.minHeight,
  };
}

export function ghostButtonStyle(active?: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    border: 'none',
    cursor: 'pointer',
    fontFamily: STARS_FONT_STACK,
    fontSize: 13,
    fontWeight: 700,
    padding: '11px 16px',
    borderRadius: 999,
    color: active ? STARS_BG : STARS_TEXT_SECONDARY,
    background: active
      ? `linear-gradient(135deg, ${STARS_ACCENT_LIGHT}, ${STARS_GOLD})`
      : withAlpha(STARS_GLASS_STRONG, 0.85),
    boxShadow: active ? `0 18px 34px ${withAlpha(STARS_ACCENT, 0.28)}` : `inset 0 0 0 1.5px ${STARS_GLASS_BORDER}`,
  };
}

export function secondaryButtonStyle(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    border: 'none',
    cursor: 'pointer',
    fontFamily: STARS_FONT_STACK,
    fontSize: 13,
    fontWeight: 700,
    padding: '11px 16px',
    borderRadius: 999,
    color: STARS_TEXT,
    background: withAlpha(STARS_GLASS_STRONG, 0.92),
    boxShadow: `inset 0 0 0 1.5px ${STARS_GLASS_BORDER}`,
  };
}

export function SectionTitle({
  eyebrow,
  title,
  detail,
  actions,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {eyebrow ? (
          <span
            style={{
              color: STARS_ACCENT_LIGHT,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2rem, 4vw, 3.7rem)',
            lineHeight: 1,
            color: STARS_TEXT,
            letterSpacing: '-0.05em',
          }}
        >
          {title}
        </h1>
        {detail ? (
          <p style={{ margin: 0, maxWidth: 720, color: STARS_TEXT_SECONDARY, fontSize: 15, lineHeight: 1.75 }}>
            {detail}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  );
}

export function InlineBadge({
  label,
  tone,
  textColor,
  icon,
}: {
  label: string;
  tone?: string;
  textColor?: string;
  icon?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 999,
        background: tone ?? withAlpha(STARS_GLASS_STRONG, 0.86),
        boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.1)}`,
        color: textColor ?? STARS_TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {icon ? <StarsSymbol name={icon} size={16} color={textColor ?? STARS_ACCENT_LIGHT} /> : null}
      {label}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        ...panelStyle({ padding: 18, tone: STARS_SURFACE_MID }),
        minWidth: 0,
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ color: STARS_TEXT_TERTIARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
          {label}
        </span>
        <strong style={{ fontSize: 28, color: accent ?? STARS_TEXT, letterSpacing: '-0.04em' }}>{value}</strong>
        {detail ? <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.6 }}>{detail}</span> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        ...panelStyle({ padding: 32, tone: STARS_SURFACE_LOW }),
        display: 'grid',
        gap: 14,
        justifyItems: 'start',
      }}
    >
      <h2 style={{ margin: 0, color: STARS_TEXT, fontSize: 26, letterSpacing: '-0.04em' }}>{title}</h2>
      <p style={{ margin: 0, maxWidth: 520, color: STARS_TEXT_SECONDARY, fontSize: 15, lineHeight: 1.75 }}>{detail}</p>
      {action}
    </div>
  );
}
