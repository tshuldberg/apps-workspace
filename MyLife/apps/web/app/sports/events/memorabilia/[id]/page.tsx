import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { sportsGetMemorabilia } from '../../../actions';
import { SPORTS_ACCENT } from '../../../_ui';
import { MemorabiliaActionsClient } from './MemorabiliaActionsClient';

export const dynamic = 'force-dynamic';

function formatDate(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCents(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function signedCents(cents: number): string {
  if (!cents) return '—';
  const abs = `$${(Math.abs(cents) / 100).toFixed(2)}`;
  return cents > 0 ? `+${abs}` : `−${abs}`;
}

export default async function SportsMemorabiliaDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const result = await sportsGetMemorabilia(id);
  if (!result.ok) notFound();
  const row = result.row;

  const appreciation = row.estimated_value_cents - row.purchase_price_cents;
  const appreciationColor =
    appreciation > 0
      ? SPORTS_ACCENT
      : appreciation < 0
        ? '#F87171'
        : 'var(--text)';

  const meta = [row.sport, row.team, row.player]
    .filter((p): p is string => !!p && p.trim() !== '')
    .join(' · ');

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>{row.item_type.toUpperCase()}</p>
      <h2 style={styles.title}>{row.description}</h2>
      {meta ? <p style={styles.subtitle}>{meta}</p> : null}

      <section style={styles.metaCard}>
        <MetaRow label="Acquired" value={formatDate(row.acquired_at)} />
        <MetaRow label="Paid" value={formatCents(row.purchase_price_cents)} />
        <MetaRow
          label="Est. value"
          value={formatCents(row.estimated_value_cents)}
        />
        <MetaRow
          label="Change"
          value={signedCents(appreciation)}
          color={appreciationColor}
        />
      </section>

      {row.notes_md ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Notes</p>
          <div style={styles.flatCard}>
            <p style={styles.bodyText}>{row.notes_md}</p>
          </div>
        </section>
      ) : null}

      <MemorabiliaActionsClient id={row.id} />
    </div>
  );
}

function MetaRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={styles.metaRow}>
      <span style={styles.metaLabel}>{label}</span>
      <span
        style={{
          ...styles.metaValue,
          ...(color ? { color, fontWeight: 700 } : {}),
        }}
      >
        {value}
      </span>
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
    fontSize: 14,
  },
  metaCard: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  metaValue: { color: 'var(--text)', fontSize: 14 },
  block: { display: 'grid', gap: 10 },
  blockLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  flatCard: {
    padding: 14,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  bodyText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.5,
  },
};
