'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Memorabilia, MemorabiliaType } from '@mylife/sports';
import {
  sportsCreateMemorabilia,
  sportsUpdateMemorabilia,
} from '../../../actions';
import { SPORTS_ACCENT } from '../../../_ui';

const ITEM_TYPES: { id: MemorabiliaType; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'jersey', label: 'Jersey' },
  { id: 'signed', label: 'Signed' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'ball', label: 'Ball' },
  { id: 'hat', label: 'Hat' },
  { id: 'other', label: 'Other' },
];

type Props = {
  existing: Memorabilia | null;
};

function parseDollarsToCents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function toDateInput(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function AddMemorabiliaClient({ existing }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [itemType, setItemType] = useState<MemorabiliaType>(
    existing?.item_type ?? 'card',
  );
  const [description, setDescription] = useState(existing?.description ?? '');
  const [sport, setSport] = useState(existing?.sport ?? '');
  const [team, setTeam] = useState(existing?.team ?? '');
  const [player, setPlayer] = useState(existing?.player ?? '');
  const [acquiredAt, setAcquiredAt] = useState<number | null>(
    existing?.acquired_at ?? null,
  );
  const [purchase, setPurchase] = useState(
    existing && existing.purchase_price_cents > 0
      ? (existing.purchase_price_cents / 100).toFixed(2)
      : '',
  );
  const [estimated, setEstimated] = useState(
    existing && existing.estimated_value_cents > 0
      ? (existing.estimated_value_cents / 100).toFixed(2)
      : '',
  );
  const [notes, setNotes] = useState(existing?.notes_md ?? '');

  const canSave = description.trim() !== '';

  const handleSave = () => {
    if (!canSave) {
      setError('Description is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
        item_type: itemType,
        description: description.trim(),
        sport: sport.trim() === '' ? null : sport.trim(),
        team: team.trim() === '' ? null : team.trim(),
        player: player.trim() === '' ? null : player.trim(),
        acquired_at: acquiredAt,
        purchase_price_cents: parseDollarsToCents(purchase),
        estimated_value_cents: parseDollarsToCents(estimated),
        notes_md: notes.trim() === '' ? null : notes.trim(),
      };

      if (existing) {
        const res = await sportsUpdateMemorabilia(existing.id, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(
          `/sports/events/memorabilia/${encodeURIComponent(existing.id)}`,
        );
        router.refresh();
        return;
      }

      const res = await sportsCreateMemorabilia(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(
        `/sports/events/memorabilia/${encodeURIComponent(res.row.id)}`,
      );
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>
        {existing ? 'Edit item' : 'Add item'}
      </p>
      <h2 style={styles.title}>
        {existing ? 'Update memorabilia' : 'New memorabilia'}
      </h2>

      <Field label="Type">
        <div style={styles.chipRow}>
          {ITEM_TYPES.map((t) => {
            const active = itemType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setItemType(t.id)}
                style={{
                  ...styles.chip,
                  ...(active ? styles.chipActive : {}),
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Description *">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. 2023 Topps Chrome Mookie Betts"
          style={styles.input}
        />
      </Field>

      <Field label="Sport (optional)">
        <input
          type="text"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          placeholder="MLB, NFL, NBA…"
          style={styles.input}
        />
      </Field>

      <Field label="Team (optional)">
        <input
          type="text"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          placeholder="Dodgers, 49ers…"
          style={styles.input}
        />
      </Field>

      <Field label="Player (optional)">
        <input
          type="text"
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
          placeholder="Mookie Betts"
          style={styles.input}
        />
      </Field>

      <Field label="Acquired at (optional)">
        <input
          type="date"
          value={toDateInput(acquiredAt)}
          onChange={(e) => setAcquiredAt(parseDateInput(e.target.value))}
          style={styles.input}
        />
      </Field>

      <Field label="Purchase price (USD, optional)">
        <input
          type="text"
          inputMode="decimal"
          value={purchase}
          onChange={(e) => setPurchase(e.target.value)}
          placeholder="0.00"
          style={styles.input}
        />
      </Field>

      <Field label="Estimated value (USD, optional)">
        <input
          type="text"
          inputMode="decimal"
          value={estimated}
          onChange={(e) => setEstimated(e.target.value)}
          placeholder="0.00"
          style={styles.input}
        />
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Grade, serial number, story behind it…"
          style={styles.textarea}
        />
      </Field>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.actionRow}>
        <button
          type="button"
          onClick={() => router.back()}
          style={styles.secondaryBtn}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={styles.primaryBtn}
          disabled={isPending || !canSave}
        >
          {isPending ? 'Saving…' : existing ? 'Save changes' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
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
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--text)',
  },
  field: { display: 'grid', gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    background: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
  actionRow: { display: 'flex', gap: 10, marginTop: 6 },
  primaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
