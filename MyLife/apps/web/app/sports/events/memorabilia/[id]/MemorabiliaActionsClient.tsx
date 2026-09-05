'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS_ACCENT } from '../../../_ui';
import { sportsDeleteMemorabilia } from '../../../actions';

type Props = {
  id: string;
};

export function MemorabiliaActionsClient({ id }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (!window.confirm('Delete this memorabilia item? This cannot be undone.'))
      return;
    setError(null);
    startTransition(async () => {
      const res = await sportsDeleteMemorabilia(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/sports/events/memorabilia');
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.row}>
        <a
          href={`/sports/events/memorabilia/add?editId=${encodeURIComponent(id)}`}
          style={styles.editBtn}
        >
          Edit
        </a>
        <button
          type="button"
          onClick={handleDelete}
          style={styles.destructiveBtn}
          disabled={isPending}
        >
          {isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', gap: 10 },
  editBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
  },
  destructiveBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid #F87171',
    background: 'var(--surface)',
    color: '#F87171',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
  accent: { color: SPORTS_ACCENT },
};
