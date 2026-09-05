'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { SyncWorkspace, WorkspaceType } from '@mylife/sync/src/types';
import {
  getWorkspaces,
  createWorkspace,
  addWorkspaceMember,
  getWorkspaceMembers,
  getRecentSyncSessions,
} from '@mylife/sync/src/db/queries';
import { useHubSync } from '@/components/HubSyncProvider';

// ---------------------------------------------------------------------------
// Real data layer (engine-backed: sync_workspaces + sync_workspace_members)
// ---------------------------------------------------------------------------

interface WorkspaceListItem extends SyncWorkspace {
  memberCount: number;
  lastSyncAt: string | null;
}

/** Build display rows from the engine DB: real members + real last-session time. */
function readWorkspaces(handle: ReturnType<typeof useHubSync>['handle']): WorkspaceListItem[] {
  if (!handle) return [];
  const db = handle.boot.db;
  const sessions = getRecentSyncSessions(db, 200);
  const lastByWorkspace = new Map<string, string>();
  for (const session of sessions) {
    const wsId = session.workspaceId ?? '';
    if (!wsId) continue;
    const at = session.completedAt || session.startedAt;
    const existing = lastByWorkspace.get(wsId);
    if (at && (!existing || at > existing)) lastByWorkspace.set(wsId, at);
  }
  return getWorkspaces(db).map((ws) => ({
    ...ws,
    memberCount: getWorkspaceMembers(db, ws.id).length,
    lastSyncAt: lastByWorkspace.get(ws.id) ?? null,
  }));
}

function useWorkspaces() {
  const { ready, handle, error } = useHubSync();
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!handle) return;
    setWorkspaces(readWorkspaces(handle));
  }, [handle]);

  useEffect(() => {
    if (error) {
      setLoading(false);
      return;
    }
    if (!ready || !handle) return;
    setWorkspaces(readWorkspaces(handle));
    setLoading(false);
  }, [ready, handle, error]);

  const addWorkspace = useCallback(
    async (name: string, type: WorkspaceType) => {
      if (!handle) throw new Error('Sync engine is not ready yet.');
      const db = handle.boot.db;
      const now = new Date().toISOString();
      const id = `ws-${type}-${Date.now().toString(36)}`;
      createWorkspace(db, {
        id,
        displayName: name,
        workspaceType: type,
        createdByDeviceId: handle.identity.publicKey,
        createdAt: now,
        rotatedAt: null,
        currentKeyVersion: 1,
        archivedAt: null,
      });
      addWorkspaceMember(db, {
        workspaceId: id,
        deviceId: handle.identity.publicKey,
        role: 'owner',
        invitedByDeviceId: handle.identity.publicKey,
        invitedAt: now,
        removedAt: null,
      });
      await db.flush();
      reload();
    },
    [handle, reload],
  );

  return { workspaces, loading, error, addWorkspace };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_COLORS: Record<WorkspaceType, { text: string; bg: string }> = {
  personal: { text: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  group: { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  community: { text: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  dm_group: { text: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SyncWorkspacesPage() {
  const { workspaces, loading, error, addWorkspace } = useWorkspaces();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WorkspaceType>('group');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreateError(null);
    void addWorkspace(trimmed, newType)
      .then(() => {
        setNewName('');
        setNewType('group');
        setShowCreate(false);
      })
      .catch((err: unknown) => {
        setCreateError(err instanceof Error ? err.message : 'Could not create workspace.');
      });
  };

  // Sort: personal first, then alphabetical
  const sorted = [...workspaces].sort((a, b) => {
    if (a.workspaceType === 'personal' && b.workspaceType !== 'personal') return -1;
    if (b.workspaceType === 'personal' && a.workspaceType !== 'personal') return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Sync Workspaces</h1>
        <p style={styles.subtitle}>Manage your sync workspaces and their members</p>
      </div>

      {/* Honest note: a workspace created here is real and saved, but members
          only join after a real device-to-device pairing handoff. */}
      <div style={styles.noticeBanner}>
        <p style={styles.noticeText}>
          Workspaces you create here are real and stored on this device. New workspaces start
          with this device as the only member; other devices join after pairing
          (Settings &rarr; Pair Device) and a real sync session. To move your whole hub to
          another device today, use Settings &rarr; Backup &amp; Restore.
        </p>
      </div>

      {error && (
        <div style={styles.noticeBanner}>
          <p style={styles.noticeText}>Sync engine unavailable on this device ({error}).</p>
        </div>
      )}

      {createError && (
        <div style={styles.noticeBanner}>
          <p style={styles.noticeText}>{createError}</p>
        </div>
      )}

      {/* Actions */}
      <section style={styles.section}>
        <div style={styles.row}>
          <h2 style={styles.sectionTitle}>Workspaces ({workspaces.length})</h2>
          <button style={styles.primaryButton} onClick={() => setShowCreate(true)}>
            Create Workspace
          </button>
        </div>
      </section>

      {/* Create workspace inline form */}
      {showCreate && (
        <section style={styles.section}>
          <div style={styles.card}>
            <h3 style={styles.formTitle}>New Workspace</h3>
            <label style={styles.fieldLabel}>Name</label>
            <input
              style={styles.input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Family, Work Team"
              autoFocus
            />
            <label style={styles.fieldLabel}>Type</label>
            <div style={styles.typeRow}>
              {(['group', 'community'] as WorkspaceType[]).map((t) => (
                <button
                  key={t}
                  style={{
                    ...styles.typeChip,
                    borderColor: newType === t ? TYPE_COLORS[t].text : 'var(--border)',
                    backgroundColor: newType === t ? TYPE_COLORS[t].bg : 'transparent',
                    color: newType === t ? TYPE_COLORS[t].text : 'var(--text-secondary)',
                  }}
                  onClick={() => setNewType(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div style={styles.formActions}>
              <button
                style={styles.cancelButton}
                onClick={() => { setShowCreate(false); setNewName(''); }}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.primaryButton, opacity: newName.trim() ? 1 : 0.4 }}
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Loading */}
      {loading && (
        <div style={styles.card}>
          <p style={styles.emptyText}>Loading workspaces...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && workspaces.length === 0 && (
        <div style={styles.card}>
          <p style={styles.emptyText}>
            No workspaces yet. A personal workspace will be created automatically when you enable sync.
          </p>
        </div>
      )}

      {/* Workspace grid */}
      {!loading && sorted.length > 0 && (
        <section style={styles.grid}>
          {sorted.map((ws) => {
            const typeColor = TYPE_COLORS[ws.workspaceType];
            return (
              <Link
                key={ws.id}
                href={`/settings/sync-workspace/${ws.id}`}
                style={styles.wsCard}
              >
                <div style={styles.wsHeader}>
                  <span style={styles.wsName}>{ws.displayName}</span>
                  <span
                    style={{
                      ...styles.typeBadge,
                      color: typeColor.text,
                      backgroundColor: typeColor.bg,
                    }}
                  >
                    {ws.workspaceType}
                  </span>
                </div>
                <div style={styles.wsStats}>
                  <span style={styles.wsStat}>
                    {ws.memberCount} member{ws.memberCount !== 1 ? 's' : ''}
                  </span>
                  <span style={styles.wsDot}> / </span>
                  <span style={styles.wsStat}>
                    Last sync: {formatRelativeTime(ws.lastSyncAt)}
                  </span>
                </div>
                <div style={styles.wsFooter}>
                  <span style={styles.wsKey}>Key v{ws.currentKeyVersion}</span>
                  {ws.workspaceType === 'personal' && (
                    <span style={styles.pinnedBadge}>Pinned</span>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
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
  noticeBanner: {
    backgroundColor: 'rgba(255,184,119,0.08)',
    border: '1px solid rgba(255,184,119,0.25)',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  noticeText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: 0,
  },
  section: { marginBottom: '24px' },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '20px',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    backgroundColor: '#FFB877',
    color: '#131318',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  cancelButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  formTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 16px 0',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    marginTop: '12px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  typeRow: {
    display: 'flex',
    gap: '8px',
  },
  typeChip: {
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    background: 'none',
    transition: 'all 0.15s',
  },
  formActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '20px',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '12px',
  },
  wsCard: {
    display: 'block',
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '20px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
    cursor: 'pointer',
  },
  wsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  wsName: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  typeBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '999px',
    textTransform: 'capitalize' as const,
  },
  wsStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '10px',
  },
  wsStat: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  wsDot: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
  },
  wsFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wsKey: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  pinnedBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#FFB877',
    backgroundColor: 'rgba(255,184,119,0.12)',
    padding: '2px 8px',
    borderRadius: '999px',
  },
};
