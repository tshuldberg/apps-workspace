import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

export const SPORTS_ACCENT = '#16A34A';

export const sportsStyles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 12,
    padding: 24,
    borderRadius: 24,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#4ADE80',
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.15,
    color: 'var(--text)',
    fontWeight: 800,
  },
  body: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 720,
  },
  primaryLink: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: 12,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 14,
  },
};

type SportsPanelProps = {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
};

export function SportsPanel({ eyebrow, title, body, children }: SportsPanelProps) {
  return (
    <section style={sportsStyles.panel}>
      <p style={sportsStyles.eyebrow}>{eyebrow}</p>
      <h2 style={sportsStyles.title}>{title}</h2>
      <p style={sportsStyles.body}>{body}</p>
      {children}
    </section>
  );
}

export function SportsFollowTeamCta() {
  return (
    <Link href="/sports/teams" style={sportsStyles.primaryLink}>
      Follow your first team
    </Link>
  );
}
