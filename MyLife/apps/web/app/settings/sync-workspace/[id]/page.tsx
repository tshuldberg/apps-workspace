'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type {
  SyncWorkspace,
  SyncWorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceType,
} from '@mylife/sync';

// ---------------------------------------------------------------------------
// Mock data layer -- replace with real DB queries once sync package ships CRUD
// ---------------------------------------------------------------------------

interface MemberRow extends SyncWorkspaceMember {
  displayName: string;
  lastSeenAt: string | null;
}

function useMockWorkspaceDetail(id: string) {
  const [workspace, setWorkspace] = useState<SyncWorkspace | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with real queries from @mylife/sync
    const ws: SyncWorkspace = {
      id,
      displayName: id.includes('personal') ? 'Personal' : 'Family',
      workspaceType: (id.includes('personal') ? 'personal' : 'group') as WorkspaceType,
      createdByDeviceId: 'device-001',
      createdAt: '2026-04-20T08:00:00Z',
      rotatedAt: null,
      currentKeyVersion: 1,
      archivedAt: null,
    };
    const m: MemberRow[] = [
      {
        workspaceId: id,
        deviceId: 'device-001',
        role: 'owner',
        invitedByDeviceId: 'device-001',
        invitedAt: '2026-04-20T08:00:00Z',
        removedAt: null,
        displayName: 'This Device (MacBook Pro)',
        lastSeenAt: new Date().toISOString(),
      },
    ];
    setWorkspace(ws);
    setMembers(m);
    setLoading(false);
  }, [id]);

  const removeMember = (deviceId: string) => {
    setMembers((prev) => prev.filter((m) => m.deviceId !== deviceId));
  };

  const archiveWorkspace = () => {
    setWorkspace((prev) => prev ? { ...prev, archivedAt: new Date().toISOString() } : prev);
  };

  return { workspace, members, loading, removeMember, archiveWorkspace };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Online';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const ROLE_COLORS: Record<WorkspaceMemberRole, { text: string; bg: string }> = {
  owner: { text: '#FFB877', bg: 'rgba(255,184,119,0.15)' },
  admin: { text: '#8BCFF0', bg: 'rgba(139,207,240,0.15)' },
  member: { text: '#30D158', bg: 'rgba(48,209,88,0.15)' },
  viewer: { text: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SyncWorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const wsId = params.id;

  const { workspace, members, loading, removeMember, archiveWorkspace } =
    useMockWorkspaceDetail(wsId);

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const handleRemove = (deviceId: string) => {
    removeMember(deviceId);
    setConfirmRemove(null);
  };

  const handleArchive = () => {
    archiveWorkspace();
    setConfirmArchive(false);
    router.push('/settings/sync-workspaces');
  };

  if (loading) {
    return (
      <div>
        <div style={styles.header}>
          <h1 style={styles.title}>Loading...</h1>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div>
        <div style={styles.header}>
          <h1 style={styles.title}>Workspace Not Found</h1>
          <p style={styles.subtitle}>
            The workspace could not be loaded. It may have been archived or removed.
          </p>
        </div>
      </div>
    );
  }

  const isPersonal = workspace.workspaceType === 'personal';

  return (
    <div>
      {/* Back link */}
      <button style={styles.backLink} onClick={() => router.push('/settings/sync-workspaces')}>
        &larr; All Workspaces
      </button>

      <div style={styles.header}>
        <h1 style={styles.title}>{workspace.displayName}</h1>
        <p style={styles.subtitle}>
          {workspace.workspaceType.charAt(0).toUpperCase() + workspace.workspaceType.slice(1)} workspace
        </p>
      </div>

      {/* Workspace info */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Details</h2>
        <div style={styles.card}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Type</span>
            <span style={styles.detailValue}>
              {workspace.workspaceType.charAt(0).toUpperCase() + workspace.workspaceType.slice(1)}
            </span>
          </div>
          <div style={styles.separator} />
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Created</span>
            <span style={styles.detailValue}>{formatDate(workspace.createdAt)}</span>
          </div>
          <div style={styles.separator} />
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Key Version</span>
            <span style={styles.detailValue}>v{workspace.currentKeyVersion}</span>
          </div>
          {workspace.rotatedAt && (
            <>
              <div style={styles.separator} />
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Last Key Rotation</span>
                <span style={styles.detailValue}>{formatDate(workspace.rotatedAt)}</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Members */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Members ({members.length})</h2>
          <button style={styles.actionButton} onClick={() => router.push('/settings/pair-device')}>
            Invite Device
          </button>
        </div>
        {members.length === 0 ? (
          <div style={styles.card}>
            <p style={styles.emptyText}>No members in this workspace.</p>
          </div>
        ) : (
          <div style={styles.memberTable}>
            <div style={styles.tableHeaderRow}>
              <span style={{ ...styles.tableHeader, flex: 2 }}>Device</span>
              <span style={{ ...styles.tableHeader, flex: 1 }}>Role</span>
              <span style={{ ...styles.tableHeader, flex: 1 }}>Last Seen</span>
              <span style={{ ...styles.tableHeader, flex: 1 }}>Joined</span>
              <span style={{ ...styles.tableHeader, flex: 0.5, textAlign: 'right' as const }}>
                Actions
              </span>
            </div>
            {members.map((m) => {
              const roleStyle = ROLE_COLORS[m.role];
              return (
                <div key={m.deviceId} style={styles.tableRow}>
                  <span style={{ ...styles.tableCell, flex: 2, fontWeight: 500 }}>
                    {m.displayName}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span
                      style={{
                        ...styles.roleBadge,
                        color: roleStyle.text,
                        backgroundColor: roleStyle.bg,
                      }}
                    >
                      {m.role}
                    </span>
                  </span>
                  <span style={{ ...styles.tableCell, flex: 1, color: 'var(--text-secondary)' }}>
                    {formatRelativeTime(m.lastSeenAt)}
                  </span>
                  <span style={{ ...styles.tableCell, flex: 1, color: 'var(--text-secondary)' }}>
                    {formatDate(m.invitedAt)}
                  </span>
                  <span style={{ flex: 0.5, textAlign: 'right' as const }}>
                    {m.role !== 'owner' && (
                      <button
                        style={styles.removeButton}
                        onClick={() => setConfirmRemove(m.deviceId)}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Danger zone */}
      {!isPersonal && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Danger Zone</h2>
          <div style={styles.dangerCard}>
            <div style={styles.dangerRow}>
              <div>
                <p style={styles.dangerLabel}>Archive Workspace</p>
                <p style={styles.dangerHelp}>
                  Archiving preserves data but stops all sync. Members will be disconnected.
                </p>
              </div>
              <button style={styles.dangerButton} onClick={() => setConfirmArchive(true)}>
                Archive
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Remove member confirmation modal */}
      {confirmRemove && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Remove Member</h3>
            <p style={styles.modalText}>
              This device will lose access to the workspace. You can re-invite it later.
            </p>
            <div style={styles.modalButtons}>
              <button style={styles.cancelBtn} onClick={() => setConfirmRemove(null)}>
                Cancel
              </button>
              <button style={styles.confirmBtn} onClick={() => handleRemove(confirmRemove)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation modal */}
      {confirmArchive && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Archive Workspace</h3>
            <p style={styles.modalText}>
              This will stop all sync for this workspace. Existing data is preserved but no new
              changes will be propagated. All members will be disconnected.
            </p>
            <div style={styles.modalButtons}>
              <button style={styles.cancelBtn} onClick={() => setConfirmArchive(false)}>
                Cancel
              </button>
              <button style={styles.confirmBtn} onClick={handleArchive}>
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  backLink: {
    display: 'inline-block',
    background: 'none',
    border: 'none',
    color: '#FFB877',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '0',
    marginBottom: '16px',
  },
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
  section: { marginBottom: '32px' },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
    marginBottom: '12px',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '20px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
  },
  detailLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--border)',
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },

  // Member table
  memberTable: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tableHeader: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
  },
  tableCell: {
    fontSize: '14px',
    color: 'var(--text)',
  },
  roleBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '999px',
    textTransform: 'capitalize' as const,
  },
  removeButton: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(255,69,58,0.3)',
    backgroundColor: 'transparent',
    color: 'var(--danger, #FF453A)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Danger zone
  dangerCard: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid rgba(255,69,58,0.2)',
    padding: '20px',
  },
  dangerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  dangerLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  dangerHelp: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  },
  dangerButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,69,58,0.4)',
    backgroundColor: 'rgba(255,69,58,0.08)',
    color: 'var(--danger, #FF453A)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },

  // Modal
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'var(--surface-elevated, #1A1A24)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '24px',
    maxWidth: '420px',
    width: '90%',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--danger, #FF453A)',
    margin: '0 0 12px 0',
  },
  modalText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: '0 0 20px 0',
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--danger, #FF453A)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
