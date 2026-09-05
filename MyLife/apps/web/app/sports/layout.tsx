import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ensureModuleMigrations } from '@/lib/db';

const NAV_ITEMS = [
  { href: '/sports', label: 'Scores' },
  { href: '/sports/teams', label: 'Teams' },
  { href: '/sports/betting', label: 'Betting' },
  { href: '/sports/fantasy', label: 'Fantasy' },
  { href: '/sports/play', label: 'Play' },
  { href: '/sports/settings', label: 'Settings' },
];

export default function SportsLayout({ children }: { children: ReactNode }) {
  ensureModuleMigrations('sports');

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <p style={styles.kicker}>MySports Hidden Scaffold</p>
          <h1 style={styles.heading}>Private sports memory is wired into the hub without being surfaced yet.</h1>
          <p style={styles.copy}>
            Follow the teams that matter to you, track bets and fantasy privately, and log your own pickup games.
            No ads, no sponsored picks, no dark-pattern gambling funnels. Feature work lands in P1.
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
          Zero analytics, zero telemetry. MySports keeps your sports life on your device.
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
      'radial-gradient(circle at top, rgba(22,163,74,0.18), transparent 28%), linear-gradient(180deg, #0E0E13 0%, #131318 100%)',
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
    color: '#4ADE80',
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
    border: '1px solid rgba(22,163,74,0.28)',
    background: 'rgba(22,163,74,0.12)',
    color: '#D1FAE5',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  note: {
    padding: '14px 16px',
    borderRadius: 16,
    border: '1px solid rgba(22,163,74,0.2)',
    background: 'rgba(22,163,74,0.08)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  content: {
    display: 'grid',
    gap: 16,
  },
};
