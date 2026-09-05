import type { CSSProperties, ReactNode } from 'react';

export function SleepPanel({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section style={styles.panel}>
      <p style={styles.eyebrow}>{eyebrow}</p>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.body}>{body}</p>
      {children}
    </section>
  );
}

export function SleepBulletList({ items }: { items: string[] }) {
  return (
    <ul style={styles.list}>
      {items.map((item) => (
        <li key={item} style={styles.listItem}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 10,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#C4B5FD',
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
    color: 'var(--text)',
  },
  body: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    display: 'grid',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  listItem: {
    margin: 0,
  },
};
