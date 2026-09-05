import type { CSSProperties } from 'react';

export const PETS_ACCENT = 'var(--accent-pets)';

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  return value.length >= 10 ? value.slice(0, 10) : value;
}

export function formatCurrencyCents(value: number | null | undefined) {
  return `$${(((value ?? 0) as number) / 100).toFixed(0)}`;
}

export const shellStyles: Record<string, CSSProperties> = {
  page: {
    padding: '2rem',
    maxWidth: '1120px',
    margin: '0 auto',
    display: 'grid',
    gap: '1.25rem',
  },
  hero: {
    padding: '1.5rem',
    borderRadius: '24px',
    border: '1px solid rgba(249,115,22,0.25)',
    background:
      'linear-gradient(145deg, rgba(249,115,22,0.18), rgba(18,18,26,0.94) 58%)',
    display: 'grid',
    gap: '1rem',
  },
  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  eyebrow: {
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--accent-pets)',
  },
  title: {
    fontSize: '2.2rem',
    lineHeight: 1.1,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    maxWidth: '640px',
    lineHeight: 1.55,
  },
  nav: {
    display: 'flex',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  navLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '0.92rem',
    padding: '0.5rem 0.9rem',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'var(--glass)',
  },
  navLinkActive: {
    color: 'var(--background)',
    textDecoration: 'none',
    fontSize: '0.92rem',
    padding: '0.5rem 0.9rem',
    borderRadius: '999px',
    border: '1px solid var(--accent-pets)',
    background: 'var(--accent-pets)',
    fontWeight: 700,
  },
  metricGrid: {
    display: 'grid',
    gap: '0.9rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  },
  metricCard: {
    borderRadius: '20px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.04)',
    padding: '1rem 1.1rem',
    display: 'grid',
    gap: '0.35rem',
  },
  metricValue: {
    fontSize: '1.8rem',
    lineHeight: 1.1,
    fontWeight: 700,
    color: 'var(--accent-pets)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
  },
  split: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: '2fr 1.2fr',
  },
  section: {
    borderRadius: '22px',
    border: '1px solid var(--border)',
    background: 'var(--glass)',
    padding: '1.2rem',
    display: 'grid',
    gap: '1rem',
  },
  sectionTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  sectionSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  row: {
    display: 'grid',
    gap: '0.85rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  },
  list: {
    display: 'grid',
    gap: '0.85rem',
  },
  listCard: {
    borderRadius: '18px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.03)',
    padding: '1rem',
    display: 'grid',
    gap: '0.45rem',
  },
  line: {
    color: 'var(--text-secondary)',
    fontSize: '0.92rem',
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '0.8rem 0.95rem',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
  },
  textarea: {
    width: '100%',
    minHeight: '96px',
    padding: '0.8rem 0.95rem',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    resize: 'vertical',
  },
  button: {
    border: 'none',
    borderRadius: '14px',
    padding: '0.8rem 1rem',
    background: 'var(--accent-pets)',
    color: 'var(--background)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  buttonSecondary: {
    borderRadius: '14px',
    border: '1px solid var(--glass-border)',
    padding: '0.8rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  pillRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  pill: {
    padding: '0.4rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(249,115,22,0.12)',
    border: '1px solid rgba(249,115,22,0.26)',
    color: 'var(--accent-pets)',
    fontSize: '0.82rem',
  },
  empty: {
    padding: '2rem 1rem',
    borderRadius: '18px',
    border: '1px dashed var(--glass-border)',
    background: 'rgba(255,255,255,0.02)',
    textAlign: 'center',
    color: 'var(--text-secondary)',
  },
};
