'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { formatDuration, type Fast } from '@mylife/fast';
import { fetchFasts, fetchFastCount, doDeleteFast } from '../actions';

const ACCENT = 'var(--accent-fast)';
const PAGE_SIZE = 20;

const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: 16,
};

function formatStarted(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export default function FastHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [fasts, setFasts] = useState<Fast[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    try {
      const [rows, count] = await Promise.all([
        fetchFasts({ limit: PAGE_SIZE, offset: nextOffset }),
        fetchFastCount(),
      ]);
      setFasts(rows as Fast[]);
      setTotal(count as number);
      setOffset(nextOffset);
    } catch (err) {
      console.error('Failed to load fast history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  async function handleDelete(id: string) {
    try {
      await doDeleteFast(id);
      await load(offset);
    } catch (err) {
      console.error('Failed to delete fast:', err);
    }
  }

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 900 }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: ACCENT }}>History</h1>
      <p style={{ margin: '4px 0 24px', color: 'var(--text-secondary)', fontSize: 14 }}>
        Your completed fasts ({total} total)
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : fasts.length === 0 ? (
        <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            No fasts logged yet. Start your first fast from the Fast tab.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {fasts.map((f) => (
            <div
              key={f.id}
              style={{
                ...GLASS_CARD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {f.protocol} - {f.durationSeconds != null ? formatDuration(f.durationSeconds) : 'In progress'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {formatStarted(f.startedAt)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                {f.hitTarget != null && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: f.hitTarget ? 'var(--success)' : 'var(--text-secondary)',
                    }}
                  >
                    {f.hitTarget ? 'Target met' : 'Below target'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  aria-label="Delete fast"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--glass)',
                    color: 'var(--danger)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-lg)' }}>
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--glass)',
              color: offset === 0 ? 'var(--text-secondary)' : 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: offset === 0 ? 'default' : 'pointer',
              opacity: offset === 0 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => load(offset + PAGE_SIZE)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--glass)',
              color: offset + PAGE_SIZE >= total ? 'var(--text-secondary)' : 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: offset + PAGE_SIZE >= total ? 'default' : 'pointer',
              opacity: offset + PAGE_SIZE >= total ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
