'use client';

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { deleteJournalMemoryAction } from '../../actions';

export function DeleteMemoryButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteJournalMemoryAction(id);
      if (res.ok) {
        router.push('/travel/memories');
        router.refresh();
      } else {
        setError(res.error ?? 'Could not delete memory.');
        setConfirming(false);
      }
    });
  };

  if (!confirming) {
    return (
      <div style={styles.container}>
        <button
          type="button"
          style={styles.dangerBtn}
          onClick={() => setConfirming(true)}
        >
          Delete memory
        </button>
        {error ? <p style={styles.error}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div style={styles.confirmPanel}>
      <p style={styles.confirmText}>Delete this memory? This cannot be undone.</p>
      <div style={styles.row}>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="button"
          style={styles.dangerBtn}
          onClick={handleDelete}
          disabled={pending}
        >
          {pending ? 'Deleting...' : 'Delete'}
        </button>
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { display: 'grid', gap: 8 },
  dangerBtn: {
    padding: '10px 18px',
    borderRadius: 12,
    border: '1px solid #93000A',
    background: 'rgba(147,0,10,0.24)',
    color: '#FFB4AB',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 18px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  confirmPanel: {
    display: 'grid',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: '1px solid #93000A',
    background: 'rgba(147,0,10,0.12)',
  },
  confirmText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
  },
  row: { display: 'flex', gap: 8 },
  error: { margin: 0, color: '#FFB4AB', fontSize: 13 },
};
