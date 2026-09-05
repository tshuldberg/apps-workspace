'use client';

import React, { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types (mirrors @mylife/sync ShareRequest -- not yet exported from barrel)
// ---------------------------------------------------------------------------

type ShareStatus = 'pending' | 'sent' | 'delivered' | 'failed';
type Transport = 'lan' | 'nearby' | 'ble' | 'wan_webrtc' | 'wan_relay';

interface ShareRecord {
  id: string;
  direction: 'sent' | 'received';
  peerDisplayName: string;
  moduleId: string;
  tableName: string;
  rowId: string;
  transport: Transport | null;
  status: ShareStatus;
  createdAt: string;
  deliveredAt: string | null;
}

// ---------------------------------------------------------------------------
// Mock data -- replace with real DB queries once sync package ships CRUD
// ---------------------------------------------------------------------------

function useMockShareHistory() {
  const [records, setRecords] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mock: ShareRecord[] = [
      {
        id: 'share-001',
        direction: 'sent',
        peerDisplayName: "Trey's iPhone",
        moduleId: 'books',
        tableName: 'bk_books',
        rowId: 'row-abc-123',
        transport: 'lan',
        status: 'delivered',
        createdAt: '2026-04-22T10:14:00Z',
        deliveredAt: '2026-04-22T10:14:02Z',
      },
      {
        id: 'share-002',
        direction: 'received',
        peerDisplayName: "Trey's MacBook Pro",
        moduleId: 'recipes',
        tableName: 'rc_recipes',
        rowId: 'row-def-456',
        transport: 'wan_webrtc',
        status: 'delivered',
        createdAt: '2026-04-22T09:30:00Z',
        deliveredAt: '2026-04-22T09:30:03Z',
      },
      {
        id: 'share-003',
        direction: 'sent',
        peerDisplayName: "Trey's iPad",
        moduleId: 'budget',
        tableName: 'bg_budgets',
        rowId: 'row-ghi-789',
        transport: 'nearby',
        status: 'failed',
        createdAt: '2026-04-21T18:00:00Z',
        deliveredAt: null,
      },
      {
        id: 'share-004',
        direction: 'sent',
        peerDisplayName: "Trey's iPhone",
        moduleId: 'journal',
        tableName: 'jr_entries',
        rowId: 'row-jkl-012',
        transport: null,
        status: 'pending',
        createdAt: '2026-04-22T11:00:00Z',
        deliveredAt: null,
      },
      {
        id: 'share-005',
        direction: 'received',
        peerDisplayName: "Trey's MacBook Pro",
        moduleId: 'workouts',
        tableName: 'wk_workouts',
        rowId: 'row-mno-345',
        transport: 'lan',
        status: 'sent',
        createdAt: '2026-04-22T08:15:00Z',
        deliveredAt: null,
      },
    ];
    setRecords(mock);
    setLoading(false);
  }, []);

  return { records, loading, setRecords };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const TRANSPORT_LABELS: Record<Transport, { label: string; color: string; bg: string }> = {
  lan: { label: 'LAN', color: '#30D158', bg: 'rgba(48,209,88,0.15)' },
  nearby: { label: 'Nearby', color: '#8BCFF0', bg: 'rgba(139,207,240,0.15)' },
  ble: { label: 'BLE', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
  wan_webrtc: { label: 'WebRTC', color: '#FFB877', bg: 'rgba(255,184,119,0.15)' },
  wan_relay: { label: 'Relay', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
};

const STATUS_CONFIG: Record<ShareStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  sent: { label: 'Sent', color: '#8BCFF0', bg: 'rgba(139,207,240,0.15)' },
  delivered: { label: 'Delivered', color: '#30D158', bg: 'rgba(48,209,88,0.15)' },
  failed: { label: 'Failed', color: '#FF453A', bg: 'rgba(255,69,58,0.15)' },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShareHistoryPage() {
  const { records, loading, setRecords } = useMockShareHistory();
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [retrying, setRetrying] = useState<string | null>(null);

  const filtered = records.filter((r) => {
    if (moduleFilter !== 'all' && r.moduleId !== moduleFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Derive unique modules present in the data for the filter dropdown
  const presentModules = Array.from(new Set(records.map((r) => r.moduleId))).sort();

  const handleRetry = async (shareId: string) => {
    setRetrying(shareId);
    // Simulate retry -- replace with real retry logic
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRecords((prev) =>
      prev.map((r) =>
        r.id === shareId ? { ...r, status: 'pending' as ShareStatus } : r,
      ),
    );
    setRetrying(null);
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Share History</h1>
        <p style={styles.subtitle}>Log of all entities shared between paired devices</p>
      </div>

      {/* Filters */}
      <section style={styles.filterRow}>
        <label style={styles.filterLabel}>Module:</label>
        <select
          style={styles.select}
          value={moduleFilter}
          onChange={(e) => { setModuleFilter(e.target.value); setPage(0); }}
        >
          <option value="all">All modules</option>
          {presentModules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <label style={styles.filterLabel}>Status:</label>
        <select
          style={styles.select}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
      </section>

      {/* Loading */}
      {loading && (
        <div style={styles.card}>
          <p style={styles.emptyText}>Loading share history...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={styles.card}>
          <p style={styles.emptyText}>No share records found.</p>
        </div>
      )}

      {/* Table */}
      {!loading && paginated.length > 0 && (
        <div style={styles.table}>
          {/* Header */}
          <div style={styles.tHeaderRow}>
            <span style={{ ...styles.tHeader, flex: 1.2 }}>Date</span>
            <span style={{ ...styles.tHeader, flex: 0.6 }}>Dir</span>
            <span style={{ ...styles.tHeader, flex: 1.2 }}>Peer</span>
            <span style={{ ...styles.tHeader, flex: 1.4 }}>Item</span>
            <span style={{ ...styles.tHeader, flex: 0.7 }}>Transport</span>
            <span style={{ ...styles.tHeader, flex: 0.7, textAlign: 'right' as const }}>Status</span>
            <span style={{ ...styles.tHeader, flex: 0.6, textAlign: 'right' as const }}>Action</span>
          </div>

          {paginated.map((r) => {
            const statusCfg = STATUS_CONFIG[r.status];
            const transportCfg = r.transport ? TRANSPORT_LABELS[r.transport] : null;
            const isRetrying = retrying === r.id;

            return (
              <div key={r.id} style={styles.tRow}>
                <span style={{ ...styles.tCell, flex: 1.2 }}>
                  {formatTimestamp(r.createdAt)}
                </span>
                <span style={{ ...styles.tCell, flex: 0.6 }}>
                  <span style={{
                    ...styles.dirBadge,
                    color: r.direction === 'sent' ? '#FFB877' : '#8BCFF0',
                    backgroundColor: r.direction === 'sent'
                      ? 'rgba(255,184,119,0.15)'
                      : 'rgba(139,207,240,0.15)',
                  }}>
                    {r.direction === 'sent' ? '\u2191' : '\u2193'}
                  </span>
                </span>
                <span style={{ ...styles.tCell, flex: 1.2, color: 'var(--text-secondary)' }}>
                  {r.peerDisplayName}
                </span>
                <span style={{ ...styles.tCell, flex: 1.4 }}>
                  <span style={styles.itemModule}>{r.moduleId}</span>
                  <span style={styles.itemDetail}>{r.tableName}/{r.rowId.slice(0, 8)}</span>
                </span>
                <span style={{ flex: 0.7 }}>
                  {transportCfg ? (
                    <span
                      style={{
                        ...styles.badge,
                        color: transportCfg.color,
                        backgroundColor: transportCfg.bg,
                      }}
                    >
                      {transportCfg.label}
                    </span>
                  ) : (
                    <span style={styles.noBadge}>--</span>
                  )}
                </span>
                <span style={{ flex: 0.7, textAlign: 'right' as const }}>
                  <span
                    style={{
                      ...styles.badge,
                      color: statusCfg.color,
                      backgroundColor: statusCfg.bg,
                    }}
                  >
                    {statusCfg.label}
                  </span>
                </span>
                <span style={{ flex: 0.6, textAlign: 'right' as const }}>
                  {r.status === 'failed' && (
                    <button
                      style={styles.retryButton}
                      onClick={() => void handleRetry(r.id)}
                      disabled={isRetrying}
                    >
                      {isRetrying ? '...' : 'Retry'}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={styles.pagination}>
          <button
            style={{ ...styles.pageButton, opacity: page > 0 ? 1 : 0.4 }}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span style={styles.pageInfo}>
            Page {page + 1} of {pageCount}
          </span>
          <button
            style={{ ...styles.pageButton, opacity: page < pageCount - 1 ? 1 : 0.4 }}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '32px' },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '20px',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },

  // Filters
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  filterLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },

  // Table
  table: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  tHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tHeader: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
  },
  tCell: {
    fontSize: '13px',
    color: 'var(--text)',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '999px',
    display: 'inline-block',
  },
  dirBadge: {
    fontSize: '12px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '999px',
    display: 'inline-block',
  },
  noBadge: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },

  // Item column
  itemModule: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text)',
    display: 'block',
  },
  itemDetail: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: 'monospace',
    display: 'block',
    marginTop: '1px',
  },

  // Retry
  retryButton: {
    padding: '4px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Pagination
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '20px',
  },
  pageButton: {
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  pageInfo: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
};
