'use client';

import Link from 'next/link';

interface SocialStateCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function SocialStateCard({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: SocialStateCardProps) {
  return (
    <div style={styles.card}>
      <div style={styles.badge}>{'\u{1F91D}'}</div>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.description}>{description}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} style={styles.primaryLink}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button onClick={onAction} style={styles.primaryButton} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    maxWidth: '520px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
  },
  badge: {
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C4DFF1A',
    fontSize: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  description: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  primaryButton: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    backgroundColor: 'var(--accent-social)',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-social)',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
