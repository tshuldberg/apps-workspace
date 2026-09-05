'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackupMetadata } from '@mylife/db';
import {
  createBackupAction,
  createAutoBackupAction,
  listBackupsAction,
  deleteBackupAction,
  restoreFromBackupAction,
  getBackupConfigAction,
  setBackupConfigAction,
  exportBackupFileAction,
  uploadAndRestoreAction,
} from '../../actions';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoBackupRanRef = useRef(false);

  const refresh = useCallback(async () => {
    const [bkList, config] = await Promise.all([
      listBackupsAction(),
      getBackupConfigAction(),
    ]);
    setBackups(bkList);
    setAutoEnabled(config.autoEnabled);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-backup on page visibility (once per page load, respects 24h interval)
  useEffect(() => {
    if (autoBackupRanRef.current) return;
    autoBackupRanRef.current = true;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void createAutoBackupAction();
      }
    };

    // Run immediately on mount
    void createAutoBackupAction();

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleToggleAuto = async (checked: boolean) => {
    setAutoEnabled(checked);
    await setBackupConfigAction({ autoEnabled: checked });
  };

  const handleBackupNow = async () => {
    setIsCreating(true);
    setMessage(null);
    try {
      await createBackupAction();
      setMessage('Backup created successfully.');
      await refresh();
    } catch (err) {
      setMessage(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (backup: BackupMetadata) => {
    const confirmed = window.confirm(
      `Restore from backup created ${formatDate(backup.createdAt)}? This will replace your current data. You will need to reload the page.`,
    );
    if (!confirmed) return;

    setRestoringId(backup.id);
    setMessage(null);
    try {
      const result = await restoreFromBackupAction(backup.id);
      setMessage(result.message);
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (backup: BackupMetadata) => {
    const confirmed = window.confirm(
      `Delete backup from ${formatDate(backup.createdAt)}? This cannot be undone.`,
    );
    if (!confirmed) return;

    await deleteBackupAction(backup.id);
    await refresh();
  };

  const handleExport = async (backup: BackupMetadata) => {
    setExportingId(backup.id);
    try {
      const result = await exportBackupFileAction(backup.id);
      if (!result.ok || !result.data || !result.filename) {
        setMessage(result.message ?? 'Export failed');
        return;
      }

      // Trigger browser download
      const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingId(null);
    }
  };

  const handleUploadRestore = async (file: File) => {
    setIsUploading(true);
    setMessage(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );
      const result = await uploadAndRestoreAction(base64);
      setMessage(result.message);
      if (result.ok) await refresh();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Backup & Restore</h1>
        <p style={styles.subtitle}>Protect your data with automatic and manual backups</p>
      </div>

      {message && (
        <div style={styles.messageBanner}>
          <p style={styles.messageText}>{message}</p>
          <button style={styles.dismissButton} onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Auto-backup toggle */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Automatic Backup</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <div>
              <p style={styles.label}>Daily Auto-Backup</p>
              <p style={styles.helpText}>
                Backs up your database once per day when you visit the app
              </p>
            </div>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => void handleToggleAuto(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={{
                ...styles.toggleTrack,
                backgroundColor: autoEnabled ? 'var(--success, #30D158)' : 'var(--surface-elevated)',
              }}>
                <span style={{
                  ...styles.toggleThumb,
                  transform: autoEnabled ? 'translateX(18px)' : 'translateX(2px)',
                }} />
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* Manual backup */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Manual Backup</h2>
        <div style={styles.card}>
          <p style={styles.helpText}>
            Create a backup before making major changes. Manual backups are never auto-deleted.
          </p>
          <div style={styles.buttonRow}>
            <button
              style={styles.actionButton}
              onClick={() => void handleBackupNow()}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Backup Now'}
            </button>
            <button
              style={styles.actionButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Restore from File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sqlite,.db"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadRestore(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </section>

      {/* Backup list */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          Recent Backups ({backups.length})
        </h2>
        {backups.length === 0 ? (
          <div style={styles.card}>
            <p style={styles.emptyText}>
              No backups yet. Enable auto-backup or create one manually.
            </p>
          </div>
        ) : (
          <div style={styles.backupList}>
            {backups.map((backup) => (
              <div key={backup.id} style={styles.card}>
                <div style={styles.backupHeader}>
                  <div>
                    <p style={styles.backupDate}>{formatDate(backup.createdAt)}</p>
                    <p style={styles.backupMeta}>
                      {formatBytes(backup.sizeBytes)} · {backup.moduleCount} modules · {backup.type}
                    </p>
                    {backup.label && (
                      <p style={styles.backupLabel}>{backup.label}</p>
                    )}
                  </div>
                </div>
                <div style={styles.buttonRow}>
                  <button
                    style={styles.smallButton}
                    onClick={() => void handleRestore(backup)}
                    disabled={restoringId === backup.id}
                  >
                    {restoringId === backup.id ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    style={styles.smallButton}
                    onClick={() => void handleExport(backup)}
                    disabled={exportingId === backup.id}
                  >
                    {exportingId === backup.id ? 'Exporting...' : 'Download'}
                  </button>
                  <button
                    style={styles.deleteButton}
                    onClick={() => void handleDelete(backup)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    marginBottom: '32px',
  },
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
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '12px',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '20px',
    marginBottom: '8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  helpText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
    marginBottom: '12px',
    lineHeight: '1.5',
  },
  toggleLabel: {
    position: 'relative' as const,
    display: 'inline-block',
    cursor: 'pointer',
    flexShrink: 0,
  },
  checkbox: {
    position: 'absolute' as const,
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleTrack: {
    display: 'block',
    width: '44px',
    height: '26px',
    borderRadius: '13px',
    border: '1px solid var(--border)',
    transition: 'background-color 0.2s',
    position: 'relative' as const,
  },
  toggleThumb: {
    display: 'block',
    width: '22px',
    height: '22px',
    borderRadius: '11px',
    backgroundColor: 'var(--text)',
    position: 'absolute' as const,
    top: '1px',
    transition: 'transform 0.2s',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  smallButton: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255,69,58,0.3)',
    backgroundColor: 'transparent',
    color: 'var(--danger, #FF453A)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  messageBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '12px 16px',
    marginBottom: '24px',
  },
  messageText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  backupList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
  },
  backupHeader: {
    marginBottom: '12px',
  },
  backupDate: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  backupMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  },
  backupLabel: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    margin: '2px 0 0 0',
    fontStyle: 'italic' as const,
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
};
