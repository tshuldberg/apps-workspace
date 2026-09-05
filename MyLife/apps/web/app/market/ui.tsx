import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import type { Listing, VerificationLevel } from '@mylife/market';
import {
  MK_ACCENT,
  MK_ACCENT_DARK,
  MK_ACCENT_LIGHT,
  MK_CONDITION,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TEXT_TERTIARY,
  getConditionMeta,
  getListingPriceLabel,
  getListingTypeMeta,
  getVerificationMeta,
  withAlpha,
} from '@mylife/market';
import type { SellerProfileRecord } from './data';
import { getListingVisual } from './data';

export const MARKET_FONT_STACK =
  "var(--font-market), 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export const MARKET_ROOT_VARS: CSSProperties = {
  ['--market-bg' as string]: MK_SURFACES.lowest,
  ['--market-surface' as string]: MK_SURFACES.base,
  ['--market-surface-low' as string]: MK_SURFACES.low,
  ['--market-surface-mid' as string]: MK_SURFACES.mid,
  ['--market-surface-high' as string]: MK_SURFACES.high,
  ['--market-surface-highest' as string]: MK_SURFACES.highest,
  ['--market-accent' as string]: MK_ACCENT,
  ['--market-accent-light' as string]: MK_ACCENT_LIGHT,
  ['--market-accent-dark' as string]: MK_ACCENT_DARK,
  ['--market-text' as string]: MK_TEXT,
  ['--market-text-secondary' as string]: MK_TEXT_SECONDARY,
  ['--market-text-tertiary' as string]: MK_TEXT_TERTIARY,
  ['--market-glass' as string]: 'rgba(255, 255, 255, 0.04)',
  ['--market-glass-strong' as string]: 'rgba(255, 255, 255, 0.08)',
  ['--market-border' as string]: 'rgba(255, 255, 255, 0.06)',
  fontFamily: MARKET_FONT_STACK,
  color: MK_TEXT,
};

export const MARKET_PRIMARY_NAV = [
  { href: '/market', label: 'Home', icon: 'home', exact: true },
  { href: '/market/browse', label: 'Browse', icon: 'explore' },
  { href: '/market/sell', label: 'Sell', icon: 'add_circle' },
  { href: '/market/messages', label: 'Messages', icon: 'chat' },
  { href: '/market/profile', label: 'Profile', icon: 'person' },
] as const;

export const MARKET_CATEGORY_NAV = [
  { href: '/market/browse?category=electronics', label: 'Electronics', icon: 'devices' },
  { href: '/market/browse?category=clothing', label: 'Clothing', icon: 'apparel' },
  { href: '/market/browse?category=home', label: 'Home', icon: 'chair' },
  { href: '/market/browse?category=sports', label: 'Sports', icon: 'sports_soccer' },
  { href: '/market/browse?category=books', label: 'Books', icon: 'menu_book' },
  { href: '/market/browse?category=auto', label: 'Auto', icon: 'directions_car' },
  { href: '/market/browse?category=services', label: 'Services', icon: 'build' },
] as const;

export const MARKET_TERTIARY_NAV = [
  { href: '/market/watchlist', label: 'Watchlist', icon: 'favorite' },
  { href: '/market/saved-searches', label: 'Saved Searches', icon: 'bookmark' },
  { href: '/market/reviews/00000000-0000-4000-8000-000000000001', label: 'Reviews', icon: 'reviews' },
  { href: '/market/offers', label: 'Offers', icon: 'swap_horiz' },
  { href: '/market/orders', label: 'Orders', icon: 'local_shipping' },
  { href: '/market/disputes', label: 'Disputes', icon: 'gavel' },
  { href: '/market/settings', label: 'Settings', icon: 'settings' },
] as const;

export const MARKET_GLOBAL_CSS = `
  .material-symbols-outlined.mk-icon {
    font-family: 'Material Symbols Outlined';
    font-weight: 400;
    font-style: normal;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24;
  }
  .material-symbols-outlined.mk-icon.mk-filled {
    font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
  }
  .mk-scroll-x {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 8px;
    scrollbar-width: none;
  }
  .mk-scroll-x::-webkit-scrollbar {
    display: none;
  }
  .mk-grid-2,
  .mk-grid-3,
  .mk-grid-4,
  .mk-grid-5 {
    display: grid;
    gap: 16px;
  }
  .mk-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mk-grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .mk-grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .mk-grid-5 {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .mk-split {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.86fr);
    gap: 24px;
    align-items: start;
  }
  .mk-detail-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
    gap: 24px;
    align-items: start;
  }
  .mk-sidebar-layout {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .mk-table {
    width: 100%;
    border-collapse: collapse;
  }
  .mk-table th,
  .mk-table td {
    padding: 14px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    text-align: left;
  }
  .mk-table th {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--market-text-tertiary);
  }
  .mk-table td {
    color: var(--market-text-secondary);
    font-size: 14px;
  }
  .mk-form-grid {
    display: grid;
    gap: 16px;
  }
  .mk-field-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mk-chip-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  .mk-hero-strip {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  @media (max-width: 1200px) {
    .mk-grid-4 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .mk-grid-5 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .mk-split,
    .mk-detail-grid,
    .mk-sidebar-layout {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 820px) {
    .mk-grid-3,
    .mk-grid-4,
    .mk-grid-5,
    .mk-field-grid,
    .mk-grid-2 {
      grid-template-columns: 1fr;
    }
  }
`;

export function formatCurrencyCents(value: number | null | undefined) {
  if (value == null) return 'Contact';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function formatLongDate(value: string | null | undefined) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function readFirstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function initialForName(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function MarketGlobalStyles() {
  return <style>{MARKET_GLOBAL_CSS}</style>;
}

export function MarketIcon({
  name,
  filled = false,
  size = 20,
  color = MK_TEXT,
}: {
  name: string;
  filled?: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined mk-icon${filled ? ' mk-filled' : ''}`}
      style={{ fontSize: size, color, lineHeight: 1 }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function marketPanelStyle(
  tone: 'surface' | 'low' | 'mid' | 'high' | 'glass' = 'low',
  padding = 24,
): CSSProperties {
  const background =
    tone === 'surface'
      ? MK_SURFACES.base
      : tone === 'mid'
        ? MK_SURFACES.mid
        : tone === 'high'
          ? MK_SURFACES.high
          : tone === 'glass'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))'
            : MK_SURFACES.low;

  return {
    background,
    padding,
    borderRadius: 28,
    boxShadow: tone === 'glass'
      ? '0 24px 60px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255,255,255,0.04)'
      : '0 24px 60px rgba(0, 0, 0, 0.18)',
    backdropFilter: tone === 'glass' ? 'blur(20px)' : undefined,
    WebkitBackdropFilter: tone === 'glass' ? 'blur(20px)' : undefined,
  };
}

export function MarketPanel({
  children,
  tone = 'low',
  padding = 24,
  style,
}: {
  children: ReactNode;
  tone?: 'surface' | 'low' | 'mid' | 'high' | 'glass';
  padding?: number;
  style?: CSSProperties;
}) {
  return <section style={{ ...marketPanelStyle(tone, padding), ...style }}>{children}</section>;
}

export function MarketButton({
  children,
  href,
  secondary = false,
}: {
  children: ReactNode;
  href: string;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 44,
        padding: secondary ? '11px 16px' : '12px 18px',
        borderRadius: 999,
        background: secondary
          ? 'rgba(255, 255, 255, 0.06)'
          : `linear-gradient(135deg, ${MK_ACCENT_LIGHT}, ${MK_ACCENT})`,
        color: secondary ? MK_TEXT_SECONDARY : MK_ACCENT_DARK,
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: secondary ? '0.02em' : '0.05em',
        textTransform: secondary ? 'none' : 'uppercase',
        boxShadow: secondary ? 'none' : '0 16px 34px rgba(20, 184, 166, 0.24)',
      }}
    >
      {children}
    </Link>
  );
}

export function MarketPill({
  label,
  icon,
  color = MK_ACCENT_LIGHT,
  filled = false,
}: {
  label: string;
  icon?: string;
  color?: string;
  filled?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 32,
        padding: '6px 12px',
        borderRadius: 999,
        background: filled ? color : withAlpha(color, 0.16),
        color: filled ? MK_ACCENT_DARK : MK_TEXT,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {icon ? <MarketIcon name={icon} size={14} color={filled ? MK_ACCENT_DARK : color} filled={filled} /> : null}
      {label}
    </span>
  );
}

export function MarketConditionPill({ condition }: { condition: NonNullable<Listing['condition']> }) {
  const meta = getConditionMeta(condition);
  const toneMap: Record<string, string> = {
    new: MK_CONDITION.new,
    likeNew: MK_CONDITION.likeNew,
    good: MK_CONDITION.good,
    fair: MK_CONDITION.fair,
    poor: MK_CONDITION.poor,
  };
  const color = toneMap[meta.tone];
  return <MarketPill label={meta.label} color={color} />;
}

export function MarketVerificationPill({ level }: { level: VerificationLevel }) {
  const meta = getVerificationMeta(level);
  return <MarketPill label={meta.label} icon={meta.icon} color={meta.color} />;
}

export function MarketSectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {eyebrow ? (
          <span
            style={{
              color: MK_ACCENT_LIGHT,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
        ) : null}
        <div style={{ display: 'grid', gap: 6 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 26,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              fontWeight: 800,
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p style={{ margin: 0, color: MK_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.6 }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function MarketStatTile({
  label,
  value,
  note,
  accent = MK_ACCENT_LIGHT,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
}) {
  return (
    <MarketPanel tone="mid" padding={18}>
      <div style={{ display: 'grid', gap: 8 }}>
        <span
          style={{
            color: MK_TEXT_TERTIARY,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <strong style={{ fontSize: 28, lineHeight: 1, color: accent }}>{value}</strong>
        {note ? <span style={{ color: MK_TEXT_SECONDARY, fontSize: 13 }}>{note}</span> : null}
      </div>
    </MarketPanel>
  );
}

export function MarketCategoryCard({
  title,
  count,
  icon,
  href,
}: {
  title: string;
  count: string;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        ...marketPanelStyle('mid', 18),
        display: 'grid',
        gap: 14,
        alignContent: 'space-between',
        minHeight: 140,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 18,
          background: withAlpha(MK_ACCENT_LIGHT, 0.14),
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <MarketIcon name={icon} color={MK_ACCENT_LIGHT} size={26} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <strong style={{ fontSize: 17, lineHeight: 1.15 }}>{title}</strong>
        <span style={{ color: MK_TEXT_SECONDARY, fontSize: 13 }}>{count}</span>
      </div>
    </Link>
  );
}

export function MarketSellerCard({
  seller,
  href,
}: {
  seller: SellerProfileRecord;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        ...marketPanelStyle('mid', 18),
        display: 'grid',
        gap: 14,
        minWidth: 280,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${withAlpha(MK_ACCENT_LIGHT, 0.36)}, ${withAlpha(MK_ACCENT, 0.72)})`,
            display: 'grid',
            placeItems: 'center',
            color: MK_ACCENT_DARK,
            fontSize: 16,
            fontWeight: 900,
          }}
        >
          {initialForName(seller.name)}
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: 16 }}>{seller.name}</strong>
          <span style={{ color: MK_TEXT_SECONDARY, fontSize: 13 }}>{seller.headline}</span>
        </div>
      </div>
      <div className="mk-chip-row">
        <MarketVerificationPill level={seller.tier} />
        <MarketPill label={`${seller.averageRating.toFixed(1)} Stars`} color={withAlpha('#8BCFF0', 0.9)} />
      </div>
      <p style={{ margin: 0, color: MK_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.6 }}>{seller.bio}</p>
    </Link>
  );
}

export function MarketListingCard({
  listing,
  sellerName,
  categoryName,
  href,
  eyebrow,
  overlay,
  footer,
}: {
  listing: Listing;
  sellerName: string;
  categoryName: string;
  href: string;
  eyebrow?: ReactNode;
  overlay?: ReactNode;
  footer?: ReactNode;
}) {
  const visual = getListingVisual(listing.id);
  const listingType = getListingTypeMeta(listing.listingType);

  return (
    <div
      style={{
        ...marketPanelStyle('mid', 0),
        position: 'relative',
        overflow: 'hidden',
        minHeight: 312,
      }}
    >
      {overlay ? (
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>{overlay}</div>
      ) : null}
      <Link
        href={href}
        style={{
          display: 'grid',
          height: '100%',
          gridTemplateRows: '176px auto',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'grid',
            alignItems: 'space-between',
            background: `linear-gradient(135deg, ${visual.gradient[0]}, ${visual.gradient[1]})`,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            {listing.condition ? <MarketConditionPill condition={listing.condition} /> : <span />}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <MarketIcon name={visual.icon} color="#F8FAFC" size={30} />
            </div>
          </div>
          <div style={{ alignSelf: 'end' }}>
            <MarketPill label={listingType.label} color={listingType.color} />
          </div>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {eyebrow ? <div>{eyebrow}</div> : null}
            <strong style={{ fontSize: 18, lineHeight: 1.2 }}>{listing.title}</strong>
            <p style={{ margin: 0, color: MK_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.6 }}>
              {listing.description}
            </p>
          </div>
          <div className="mk-chip-row">
            <span style={{ color: MK_ACCENT_LIGHT, fontSize: 18, fontWeight: 800 }}>
              {getListingPriceLabel(listing)}
            </span>
            <span style={{ color: MK_TEXT_TERTIARY, fontSize: 13 }}>
              {categoryName} / {listing.locationName ?? 'Remote'}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ color: MK_TEXT_TERTIARY, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Seller
              </span>
              <span style={{ color: MK_TEXT_SECONDARY, fontSize: 14 }}>{sellerName}</span>
            </div>
            {footer}
          </div>
        </div>
      </Link>
    </div>
  );
}

export function MarketEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <MarketPanel tone="mid" padding={28} style={{ textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 20,
            background: withAlpha(MK_ACCENT_LIGHT, 0.14),
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <MarketIcon name="inventory_2" color={MK_ACCENT_LIGHT} size={28} />
        </div>
        <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <strong style={{ fontSize: 18 }}>{title}</strong>
          <p style={{ margin: 0, color: MK_TEXT_SECONDARY, lineHeight: 1.6 }}>{body}</p>
        </div>
        {action}
      </div>
    </MarketPanel>
  );
}

export function MarketTimeline({
  items,
}: {
  items: Array<{ title: string; subtitle: string; date: string; accent?: string }>;
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {items.map((item) => (
        <div key={`${item.title}-${item.date}`} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: 14 }}>
          <div style={{ display: 'grid', justifyItems: 'center' }}>
            <span
              style={{
                width: 12,
                height: 12,
                marginTop: 6,
                borderRadius: 999,
                background: item.accent ?? MK_ACCENT_LIGHT,
                boxShadow: `0 0 0 6px ${withAlpha(item.accent ?? MK_ACCENT_LIGHT, 0.12)}`,
              }}
            />
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ fontSize: 15 }}>{item.title}</strong>
            <span style={{ color: MK_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.6 }}>{item.subtitle}</span>
            <span style={{ color: MK_TEXT_TERTIARY, fontSize: 12 }}>{formatLongDate(item.date)} / {formatTime(item.date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function renderStars(value: number) {
  const full = Math.round(value);
  return '★'.repeat(Math.max(0, Math.min(5, full))) + '☆'.repeat(Math.max(0, 5 - full));
}
