import Link from 'next/link';
import {
  listPreferences,
  type Preference,
  type PreferenceCategory,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const CATEGORIES: Array<{
  key: PreferenceCategory;
  label: string;
  color: string;
}> = [
  { key: 'tech', label: 'Tech', color: '#8BCFF0' },
  { key: 'household', label: 'Household', color: '#A78BFA' },
  { key: 'color', label: 'Color', color: '#FFB877' },
  { key: 'brand', label: 'Brand', color: '#34D399' },
  { key: 'material', label: 'Material', color: '#FBBF24' },
  { key: 'allergy', label: 'Allergy', color: '#EF4444' },
];

export default async function ShopPreferencesPage() {
  const db = getAdapter();
  const all = listPreferences(db);

  const grouped = new Map<PreferenceCategory, Preference[]>();
  for (const c of CATEGORIES) grouped.set(c.key, []);
  for (const p of all) grouped.get(p.category)!.push(p);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Preferences</p>
        <h2 style={styles.title}>
          {all.length === 0 ? 'Remember what you like' : 'Your shopping profile'}
        </h2>
        <p style={styles.subtitle}>
          Tech, household staples, colors, allergies, and favorite brands -
          stored locally, never synced.
        </p>
      </header>

      <div style={styles.grid}>
        {CATEGORIES.map((cat) => {
          const list = grouped.get(cat.key) ?? [];
          return (
            <Link
              key={cat.key}
              href={`/shop/preferences/${cat.key}`}
              style={styles.cell}
            >
              <span
                style={{ ...styles.dot, background: cat.color }}
                aria-hidden
              />
              <div style={styles.cellTitle}>{cat.label}</div>
              <div style={styles.cellCount}>
                {list.length} {list.length === 1 ? 'entry' : 'entries'}
              </div>
              {list.slice(0, 2).map((p) => (
                <div key={p.id} style={styles.cellPreview}>
                  {p.key}: {p.value}
                </div>
              ))}
              {list.length === 0 ? (
                <div style={styles.cellEmpty}>Click to add</div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  header: { display: 'grid', gap: 6 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.75rem' },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
  },
  cell: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text)',
    textDecoration: 'none',
    minHeight: 140,
    alignContent: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    display: 'inline-block',
  },
  cellTitle: {
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 800,
  },
  cellCount: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  cellPreview: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  cellEmpty: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontStyle: 'italic',
  },
};
