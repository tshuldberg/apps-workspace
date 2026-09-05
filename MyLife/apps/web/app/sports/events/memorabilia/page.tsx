import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Memorabilia } from '@mylife/sports';
import {
  sportsGetCollectionValue,
  sportsListMemorabilia,
} from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';

export const dynamic = 'force-dynamic';

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

function signedCents(cents: number): string {
  const abs = `$${(Math.abs(cents) / 100).toFixed(2)}`;
  if (cents > 0) return `+${abs}`;
  if (cents < 0) return `−${abs}`;
  return '$0';
}

function subtitleFor(item: Memorabilia): string {
  return [item.sport, item.team, item.player]
    .filter((p): p is string => !!p && p.trim() !== '')
    .join(' · ');
}

export default async function SportsMemorabiliaPage() {
  const [listResult, valueResult] = await Promise.all([
    sportsListMemorabilia(),
    sportsGetCollectionValue(),
  ]);

  const rows: Memorabilia[] = listResult.ok ? listResult.rows : [];
  const value = valueResult.ok ? valueResult.value : null;
  const error = !listResult.ok ? listResult.error : null;

  const appreciationColor =
    value && value.appreciationCents > 0
      ? SPORTS_ACCENT
      : value && value.appreciationCents < 0
        ? '#F87171'
        : 'var(--text)';

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Collection</p>
      <h2 style={styles.title}>Memorabilia</h2>
      <p style={styles.subtitle}>
        Cards, jerseys, signed items, tickets. Private to this device.
      </p>

      <div style={styles.valueStrip}>
        <div style={styles.valueCell}>
          <span style={styles.valueLabel}>Items</span>
          <span style={styles.valueNumber}>{value?.itemCount ?? 0}</span>
        </div>
        <div style={styles.valueCell}>
          <span style={styles.valueLabel}>Paid</span>
          <span style={styles.valueNumber}>
            {formatCents(value?.purchaseTotalCents ?? 0)}
          </span>
        </div>
        <div style={styles.valueCell}>
          <span style={styles.valueLabel}>Est. value</span>
          <span style={styles.valueNumber}>
            {formatCents(value?.estimatedTotalCents ?? 0)}
          </span>
        </div>
        <div style={styles.valueCell}>
          <span style={styles.valueLabel}>Change</span>
          <span
            style={{ ...styles.valueNumber, color: appreciationColor }}
          >
            {signedCents(value?.appreciationCents ?? 0)}
          </span>
        </div>
      </div>

      <div style={styles.ctaRow}>
        <Link href="/sports/events/memorabilia/add" style={styles.primaryLink}>
          Add item
        </Link>
        <Link href="/sports/events" style={styles.secondaryLink}>
          Back to events
        </Link>
      </div>

      {error ? (
        <p style={styles.error}>Error: {error}</p>
      ) : rows.length === 0 ? (
        <div style={styles.emptyCard}>
          <p style={styles.emptyText}>
            No memorabilia yet. Tap Add item to start tracking your collection.
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {rows.map((item) => {
            const sub = subtitleFor(item);
            return (
              <Link
                key={item.id}
                href={`/sports/events/memorabilia/${encodeURIComponent(item.id)}`}
                style={styles.tile}
              >
                <span style={styles.tileTypeBadge}>
                  {item.item_type.toUpperCase()}
                </span>
                <span style={styles.tileTitle}>{item.description}</span>
                {sub ? <span style={styles.tileSub}>{sub}</span> : null}
                <span style={styles.tileValue}>
                  {formatCents(item.estimated_value_cents)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SPORTS_ACCENT,
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.15,
    color: 'var(--text)',
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 720,
  },
  valueStrip: {
    display: 'flex',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  valueCell: { flex: 1, display: 'grid', gap: 4 },
  valueLabel: {
    color: 'var(--text-secondary)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  valueNumber: { color: 'var(--text)', fontSize: 16, fontWeight: 800 },
  ctaRow: { display: 'flex', gap: 10 },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: 12,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
  },
  secondaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 12,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
    minHeight: 120,
  },
  tileTypeBadge: {
    alignSelf: 'flex-start',
    padding: '3px 8px',
    borderRadius: 6,
    border: `1px solid ${SPORTS_ACCENT}`,
    color: SPORTS_ACCENT,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
  },
  tileTitle: { color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  tileSub: { color: 'var(--text-secondary)', fontSize: 12 },
  tileValue: {
    marginTop: 'auto',
    color: SPORTS_ACCENT,
    fontSize: 14,
    fontWeight: 800,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  emptyText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
};
