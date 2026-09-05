'use client';

import React, { useEffect, useState } from 'react';
import type {
  SyncSession,
  SyncSessionModuleStats,
  SyncTransport,
  SyncDirection,
  SyncSessionStatus,
} from '@mylife/sync';

// ---------------------------------------------------------------------------
// Mock data layer -- replace with real DB queries once sync package ships CRUD
// ---------------------------------------------------------------------------

interface SessionWithModuleStats extends SyncSession {
  moduleStats: SyncSessionModuleStats[];
}

function useMockSyncActivity() {
  const [sessions, setSessions] = useState<SessionWithModuleStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with real query from @mylife/sync
    const mock: SessionWithModuleStats[] = [
      {
        id: 'session-001',
        workspaceId: 'ws-personal-001',
        peerDeviceId: 'device-002',
        transport: 'lan',
        direction: 'bidirectional',
        modulesSynced: ['books', 'budget', 'habits'],
        changesSent: 42,
        changesReceived: 18,
        bytesSent: 24576,
        bytesReceived: 12288,
        blobsSent: 0,
        blobsReceived: 0,
        durationMs: 1230,
        status: 'completed',
        error: null,
        startedAt: '2026-04-22T10:14:00Z',
        completedAt: '2026-04-22T10:14:01Z',
        moduleStats: [
          { sessionId: 'session-001', moduleId: 'books', changesSent: 20, changesReceived: 8, bytesSent: 12000, bytesReceived: 5000 },
          { sessionId: 'session-001', moduleId: 'budget', changesSent: 15, changesReceived: 7, bytesSent: 8000, bytesReceived: 4200 },
          { sessionId: 'session-001', moduleId: 'habits', changesSent: 7, changesReceived: 3, bytesSent: 4576, bytesReceived: 3088 },
        ],
      },
      {
        id: 'session-002',
        workspaceId: 'ws-personal-001',
        peerDeviceId: 'device-003',
        transport: 'wan_webrtc',
        direction: 'push',
        modulesSynced: ['journal'],
        changesSent: 5,
        changesReceived: 0,
        bytesSent: 2048,
        bytesReceived: 0,
        blobsSent: 0,
        blobsReceived: 0,
        durationMs: 890,
        status: 'completed',
        error: null,
        startedAt: '2026-04-22T09:30:00Z',
        completedAt: '2026-04-22T09:30:01Z',
        moduleStats: [
          { sessionId: 'session-002', moduleId: 'journal', changesSent: 5, changesReceived: 0, bytesSent: 2048, bytesReceived: 0 },
        ],
      },
      {
        id: 'session-003',
        workspaceId: null,
        peerDeviceId: 'device-002',
        transport: 'nearby',
        direction: 'pull',
        modulesSynced: ['mood'],
        changesSent: 0,
        changesReceived: 12,
        bytesSent: 128,
        bytesReceived: 6144,
        blobsSent: 0,
        blobsReceived: 0,
        durationMs: 2100,
        status: 'partial',
        error: 'Connection interrupted',
        startedAt: '2026-04-21T18:00:00Z',
        completedAt: '2026-04-21T18:00:02Z',
        moduleStats: [
          { sessionId: 'session-003', moduleId: 'mood', changesSent: 0, changesReceived: 12, bytesSent: 128, bytesReceived: 6144 },
        ],
      },
    ];
    setSessions(mock);
    setLoading(false);
  }, []);

  return { sessions, loading };
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
    second: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const TRANSPORT_LABELS: Record<SyncTransport, { label: string; color: string; bg: string }> = {
  lan: { label: 'LAN', color: '#30D158', bg: 'rgba(48,209,88,0.15)' },
  nearby: { label: 'Nearby', color: '#8BCFF0', bg: 'rgba(139,207,240,0.15)' },
  ble: { label: 'BLE', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
  wan_webrtc: { label: 'WebRTC', color: '#FFB877', bg: 'rgba(255,184,119,0.15)' },
  wan_relay: { label: 'Relay', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
};

const DIRECTION_LABELS: Record<SyncDirection, string> = {
  push: 'Push',
  pull: 'Pull',
  bidirectional: 'Bi-dir',
};

const STATUS_STYLES: Record<SyncSessionStatus, { color: string; bg: string }> = {
  completed: { color: '#30D158', bg: 'rgba(48,209,88,0.15)' },
  partial: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  failed: { color: '#FF453A', bg: 'rgba(255,69,58,0.15)' },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SyncActivityPage() {
  const { sessions, loading } = useMockSyncActivity();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  // Derive unique workspace IDs
  const workspaceIds = Array.from(
    new Set(sessions.map((s) => s.workspaceId).filter(Boolean) as string[]),
  );

  const filtered = workspaceFilter === 'all'
    ? sessions
    : sessions.filter((s) => s.workspaceId === workspaceFilter);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Sync Activity</h1>
        <p style={styles.subtitle}>History of sync sessions across all workspaces</p>
      </div>

      {/* Filters */}
      <section style={styles.filterRow}>
        <label style={styles.filterLabel}>Workspace:</label>
        <select
          style={styles.select}
          value={workspaceFilter}
          onChange={(e) => { setWorkspaceFilter(e.target.value); setPage(0); }}
        >
          <option value="all">All workspaces</option>
          {workspaceIds.map((wid) => (
            <option key={wid} value={wid}>{wid}</option>
          ))}
        </select>
      </section>

      {/* Loading */}
      {loading && (
        <div style={styles.card}>
          <p style={styles.emptyText}>Loading sync activity...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={styles.card}>
          <p style={styles.emptyText}>No sync sessions recorded yet.</p>
        </div>
      )}

      {/* Session table */}
      {!loading && paginated.length > 0 && (
        <div style={styles.table}>
          {/* Header */}
          <div style={styles.tHeaderRow}>
            <span style={{ ...styles.tHeader, flex: 1.5 }}>Timestamp</span>
            <span style={{ ...styles.tHeader, flex: 1 }}>Peer</span>
            <span style={{ ...styles.tHeader, flex: 0.8 }}>Transport</span>
            <span style={{ ...styles.tHeader, flex: 0.6 }}>Dir</span>
            <span style={{ ...styles.tHeader, flex: 1.2 }}>Modules</span>
            <span style={{ ...styles.tHeader, flex: 0.8, textAlign: 'right' as const }}>Bytes</span>
            <span style={{ ...styles.tHeader, flex: 0.6, textAlign: 'right' as const }}>Time</span>
            <span style={{ ...styles.tHeader, flex: 0.7, textAlign: 'right' as const }}>Status</span>
          </div>

          {paginated.map((s) => {
            const transportInfo = TRANSPORT_LABELS[s.transport];
            const statusStyle = STATUS_STYLES[s.status];
            const isExpanded = expandedId === s.id;
            const totalBytes = s.bytesSent + s.bytesReceived;

            return (
              <React.Fragment key={s.id}>
                <button
                  style={styles.tRow}
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  <span style={{ ...styles.tCell, flex: 1.5 }}>
                    {formatTimestamp(s.startedAt)}
                  </span>
                  <span style={{ ...styles.tCell, flex: 1, color: 'var(--text-secondary)' }}>
                    {s.peerDeviceId.slice(0, 12)}...
                  </span>
                  <span style={{ flex: 0.8 }}>
                    <span
                      style={{
                        ...styles.badge,
                        color: transportInfo.color,
                        backgroundColor: transportInfo.bg,
                      }}
                    >
                      {transportInfo.label}
                    </span>
                  </span>
                  <span style={{ ...styles.tCell, flex: 0.6, color: 'var(--text-secondary)' }}>
                    {DIRECTION_LABELS[s.direction]}
                  </span>
                  <span style={{ ...styles.tCell, flex: 1.2, color: 'var(--text-secondary)' }}>
                    {s.modulesSynced.join(', ')}
                  </span>
                  <span style={{ ...styles.tCell, flex: 0.8, textAlign: 'right' as const, color: 'var(--text-secondary)' }}>
                    {formatBytes(totalBytes)}
                  </span>
                  <span style={{ ...styles.tCell, flex: 0.6, textAlign: 'right' as const, color: 'var(--text-secondary)' }}>
                    {formatDuration(s.durationMs)}
                  </span>
                  <span style={{ flex: 0.7, textAlign: 'right' as const }}>
                    <span
                      style={{
                        ...styles.badge,
                        color: statusStyle.color,
                        backgroundColor: statusStyle.bg,
                      }}
                    >
                      {s.status}
                    </span>
                  </span>
                </button>

                {/* Expanded module stats */}
                {isExpanded && (
                  <div style={styles.expandedRow}>
                    {s.error && (
                      <p style={styles.errorText}>Error: {s.error}</p>
                    )}
                    <div style={styles.moduleStatsHeader}>
                      <span style={{ ...styles.msHeader, flex: 1 }}>Module</span>
                      <span style={{ ...styles.msHeader, flex: 1, textAlign: 'right' as const }}>Sent</span>
                      <span style={{ ...styles.msHeader, flex: 1, textAlign: 'right' as const }}>Received</span>
                      <span style={{ ...styles.msHeader, flex: 1, textAlign: 'right' as const }}>Bytes Sent</span>
                      <span style={{ ...styles.msHeader, flex: 1, textAlign: 'right' as const }}>Bytes Recv</span>
                    </div>
                    {s.moduleStats.map((ms) => (
                      <div key={ms.moduleId} style={styles.moduleStatsRow}>
                        <span style={{ ...styles.msCell, flex: 1, fontWeight: 500 }}>{ms.moduleId}</span>
                        <span style={{ ...styles.msCell, flex: 1, textAlign: 'right' as const }}>{ms.changesSent}</span>
                        <span style={{ ...styles.msCell, flex: 1, textAlign: 'right' as const }}>{ms.changesReceived}</span>
                        <span style={{ ...styles.msCell, flex: 1, textAlign: 'right' as const }}>{formatBytes(ms.bytesSent)}</span>
                        <span style={{ ...styles.msCell, flex: 1, textAlign: 'right' as const }}>{formatBytes(ms.bytesReceived)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
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
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
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
    width: '100%',
    background: 'none',
    border: 'none',
    borderBottomStyle: 'solid' as const,
    borderBottomWidth: '1px',
    borderBottomColor: 'var(--border)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    color: 'inherit',
    font: 'inherit',
    transition: 'background-color 0.1s',
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

  // Expanded
  expandedRow: {
    padding: '12px 20px 16px 40px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--danger, #FF453A)',
    margin: '0 0 8px 0',
  },
  moduleStatsHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid var(--border)',
    marginBottom: '4px',
  },
  msHeader: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  moduleStatsRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0',
  },
  msCell: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
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
