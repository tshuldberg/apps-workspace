'use client';

import { useActionState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  visitDestinationAction,
  type MutationResult,
} from '../../actions';
import { TRAVEL_ACCENT } from '../../destinations/_components/dest-helpers';

export function BucketVisitButton({ id }: { id: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    const res = await visitDestinationAction(data);
    if (res.ok) router.refresh();
    return res;
  }, null);

  return (
    <form action={action} style={styles.row}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={styles.btn} disabled={pending}>
        {pending ? 'Saving...' : 'Mark visited'}
      </button>
      {state?.error ? <span style={styles.err}>{state.error}</span> : null}
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  btn: {
    borderRadius: 999,
    border: `1px solid ${TRAVEL_ACCENT}`,
    background: 'rgba(14,165,233,0.14)',
    color: TRAVEL_ACCENT,
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  err: { color: '#FFB4AB', fontSize: 12 },
};
