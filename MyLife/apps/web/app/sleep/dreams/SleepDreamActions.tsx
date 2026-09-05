'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteDreamLog } from '../actions';

export function SleepDreamActions({
  dreamId,
  linkedEntryId,
}: {
  dreamId: string;
  linkedEntryId?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    if (!window.confirm('Delete this dream from the archive?')) {
      return;
    }

    startTransition(() => {
      void deleteDreamLog(dreamId)
        .then(() => {
          router.replace(linkedEntryId ? `/sleep/entry/${linkedEntryId}` : '/sleep/dreams');
        })
        .catch((reason) => {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not delete this dream.',
          );
        });
    });
  }

  return (
    <div style={styles.shell}>
      <Link href={`/sleep/dreams/log?dreamId=${dreamId}`} style={styles.secondaryLink}>
        Edit
      </Link>
      <button type="button" onClick={handleDelete} style={styles.dangerButton}>
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: 'grid',
    gap: 12,
  },
  secondaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '0 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: 16,
    border: '1px solid rgba(255,69,58,0.3)',
    background: 'rgba(255,69,58,0.12)',
    color: '#FCA5A5',
    padding: '0 16px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  errorText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.5,
  },
};
