'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS_ACCENT } from '../../_ui';
import { sportsDeleteAttendance } from '../../actions';

type Props = {
  id: string;
};

export function AttendanceActionsClient({ id }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (!window.confirm('Delete this attendance? This cannot be undone.'))
      return;
    setError(null);
    startTransition(async () => {
      const res = await sportsDeleteAttendance(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/sports/events');
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={handleDelete}
        style={styles.destructiveBtn}
        disabled={isPending}
      >
        {isPending ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  destructiveBtn: {
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
