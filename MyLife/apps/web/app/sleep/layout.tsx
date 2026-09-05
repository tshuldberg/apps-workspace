import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ensureModuleMigrations } from '@/lib/db';

const CURRENT_YEAR = new Date().getFullYear();

const NAV_ITEMS = [
  { href: '/sleep', label: 'Sleep Log' },
  { href: '/sleep/factors', label: 'Factors' },
  { href: '/sleep/dreams', label: 'Dreams' },
  { href: '/sleep/insights', label: 'Insights' },
  { href: '/sleep/goals', label: 'Goals' },
  { href: '/sleep/naps', label: 'Naps' },
  { href: '/sleep/hygiene', label: 'Hygiene' },
  { href: `/sleep/review/${CURRENT_YEAR}`, label: 'Review' },
  { href: '/sleep/science/chronotype', label: 'Chronotype' },
  { href: '/sleep/science/jet-lag', label: 'Jet Lag' },
  { href: '/sleep/science/shift-work', label: 'Shift Work' },
  { href: '/sleep/settings', label: 'Settings' },
];

export default function SleepLayout({ children }: { children: ReactNode }) {
  ensureModuleMigrations('sleep');

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <p style={styles.kicker}>MySleep Hidden Scaffold</p>
          <h1 style={styles.heading}>Manual sleep journaling is wired into the hub without being surfaced to users yet.</h1>
          <p style={styles.copy}>
            The route exists for build-out, schema validation, and direct inspection. Discover, sidebar, and
            bootstrap flows still respect the hidden release state.
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
          MySleep stays separate from MyHealth sleep tables. Any Health bridge must remain explicit and opt-in.
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
      'radial-gradient(circle at top, rgba(167, 139, 250, 0.18), transparent 28%), linear-gradient(180deg, #0E0E13 0%, #131318 100%)',
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
    color: '#C4B5FD',
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
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.12)',
    color: '#E9DDFF',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  note: {
    padding: '14px 16px',
    borderRadius: 16,
    border: '1px solid rgba(167,139,250,0.2)',
    background: 'rgba(167,139,250,0.08)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  content: {
    display: 'grid',
    gap: 16,
  },
};
