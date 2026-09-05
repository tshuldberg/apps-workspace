'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

interface CounterItem {
  eventKey: string;
  bucketDate: string;
  count: number;
  updatedAt: string;
}

interface CountersResponse {
  items?: CounterItem[];
  error?: string;
}

function toQuery(params: { prefix?: string; bucketDate?: string; limit?: number }): string {
  const query = new URLSearchParams();
  if (params.prefix) query.set('prefix', params.prefix);
  if (params.bucketDate) query.set('bucketDate', params.bucketDate);
  if (params.limit && Number.isFinite(params.limit)) query.set('limit', String(params.limit));
  const value = query.toString();
  return value.length > 0 ? `?${value}` : '';
}

export default function OpsCountersPage() {
  const [readKey, setReadKey] = useState('');
  const [prefix, setPrefix] = useState('');
  const [bucketDate, setBucketDate] = useState('');
  const [limit, setLimit] = useState('200');
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<CounterItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => toQuery({
      prefix: prefix.trim() || undefined,
      bucketDate: bucketDate.trim() || undefined,
      limit: Number(limit) > 0 ? Number(limit) : undefined,
    }),
    [bucketDate, limit, prefix],
  );

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ops/counters${query}`, {
        method: 'GET',
        headers: readKey.trim().length > 0
          ? {
              'x-ops-read-key': readKey.trim(),
            }
          : undefined,
        cache: 'no-store',
      });

      const body = await response.json().catch(() => ({ error: 'Invalid JSON response.' })) as CountersResponse;
      if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Failed to load counters.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportCsv = async () => {
    setError(null);
    try {
      const response = await fetch(`/api/ops/counters/export${query}`, {
        method: 'GET',
        headers: readKey.trim().length > 0
          ? {
              'x-ops-read-key': readKey.trim(),
            }
          : undefined,
        cache: 'no-store',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as { error?: string };
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'mylife-ops-counters.csv';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export counters.');
    }
  };

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>Operational Counters</h1>
        <p style={styles.subtitle}>
          Privacy-safe aggregate metrics only. No per-user IDs and no content payloads are stored.
        </p>
      </header>

      <section style={styles.card}>
        <div style={styles.filters}>
          <label style={styles.field}>
            <span style={styles.label}>Ops Read Key</span>
            <input
              value={readKey}
              onChange={(event) => setReadKey(event.target.value)}
              type="password"
              placeholder="Optional if server key not configured"
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Event Prefix</span>
            <input
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="mode_selected:"
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Bucket Date</span>
            <input
              value={bucketDate}
              onChange={(event) => setBucketDate(event.target.value)}
              placeholder="YYYY-MM-DD"
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Limit</span>
            <input
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              type="number"
              min={1}
              max={2000}
              style={styles.input}
            />
          </label>
        </div>

        <div style={styles.buttonRow}>
          <button type="button" onClick={() => void load()} disabled={isLoading} style={styles.button}>
            {isLoading ? 'Loading...' : 'Load Counters'}
          </button>
          <button type="button" onClick={() => void exportCsv()} style={styles.button}>
            Export CSV
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Results ({items.length})</h2>
        {items.length === 0 ? (
          <p style={styles.empty}>No rows loaded yet.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Event Key</th>
                  <th style={styles.th}>Bucket Date</th>
                  <th style={styles.th}>Count</th>
                  <th style={styles.th}>Updated At</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.eventKey}:${item.bucketDate}`}>
                    <td style={styles.td}>{item.eventKey}</td>
                    <td style={styles.td}>{item.bucketDate}</td>
                    <td style={styles.td}>{item.count}</td>
                    <td style={styles.td}>{item.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    maxWidth: '1040px',
    margin: '0 auto',
    paddingBottom: '2rem',
    display: 'grid',
    gap: '1rem',
  },
  header: {
    display: 'grid',
    gap: '0.4rem',
  },
  title: {
    margin: 0,
    fontSize: '1.7rem',
    color: 'var(--text)',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface)',
    padding: '1rem',
    display: 'grid',
    gap: '0.8rem',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '1rem',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '0.6rem',
  },
  field: {
    display: 'grid',
    gap: '0.35rem',
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  input: {
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  button: {
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  error: {
    margin: 0,
    color: '#fca5a5',
    fontSize: '0.8rem',
  },
  empty: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '680px',
  },
  th: {
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    borderBottom: '1px solid var(--border)',
    padding: '0.45rem',
  },
  td: {
    color: 'var(--text)',
    fontSize: '0.8rem',
    borderBottom: '1px solid var(--border)',
    padding: '0.45rem',
    verticalAlign: 'top',
  },
};
