import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ensureModuleMigrations } from '@/lib/db';

const NAV_ITEMS = [
  { href: '/shop', label: 'Wishlist' },
  { href: '/shop/purchases', label: 'Purchases' },
  { href: '/shop/warranties', label: 'Warranties' },
  { href: '/shop/sizes', label: 'Sizes' },
  { href: '/shop/preferences', label: 'Preferences' },
  { href: '/shop/gifts', label: 'Gifts' },
  { href: '/shop/spending', label: 'Spending' },
  { href: '/shop/research', label: 'Research' },
  { href: '/shop/stores', label: 'Stores' },
  { href: '/shop/review', label: 'Review' },
  { href: '/shop/settings', label: 'Settings' },
];

export default function ShopLayout({ children }: { children: ReactNode }) {
  ensureModuleMigrations('shop');

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <p style={styles.kicker}>MyShop Hidden Scaffold</p>
          <h1 style={styles.heading}>Private shopping memory is wired into the hub without being surfaced yet.</h1>
          <p style={styles.copy}>
            The route exists for build-out, schema validation, and direct inspection. Discover, sidebar,
            and bootstrap flows still respect the hidden release state.
          </p>
        </header>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} style={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={styles.note}>
          Zero analytics, zero telemetry. MyShop never lets shopping intent data leave the device.
        </div>

        <div style={styles.content}>{children}</div>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '48px 24px 80px',
    background:
      'radial-gradient(circle at top, rgba(16,185,129,0.18), transparent 28%), linear-gradient(180deg, #0E0E13 0%, #131318 100%)',
    color: 'var(--text)',
  },
  shell: {
    width: 'min(1120px, 100%)',
    margin: '0 auto',
    display: 'grid',
    gap: 20,
  },
  hero: {
    display: 'grid',
    gap: 12,
  },
  kicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(2.3rem, 5vw, 4rem)',
    lineHeight: 1.02,
    letterSpacing: '-0.06em',
    maxWidth: 920,
  },
  copy: {
    margin: 0,
    maxWidth: 760,
    color: 'var(--text-secondary)',
    fontSize: 16,
    lineHeight: 1.65,
  },
  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  navLink: {
    borderRadius: 999,
    border: '1px solid rgba(16,185,129,0.28)',
    background: 'rgba(16,185,129,0.12)',
    color: '#D1FAE5',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  note: {
    padding: '14px 16px',
    borderRadius: 16,
    border: '1px solid rgba(16,185,129,0.2)',
    background: 'rgba(16,185,129,0.08)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  content: {
    display: 'grid',
    gap: 16,
  },
};
