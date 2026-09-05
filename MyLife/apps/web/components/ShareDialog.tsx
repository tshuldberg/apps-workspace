'use client';

import React, { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types (mirrors @mylife/sync but not yet exported from barrel)
// ---------------------------------------------------------------------------

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: string;
  tableName: string;
  rowId: string;
  itemTitle: string;
  itemPreview?: string;
}

type ShareStep = 'select_contact' | 'sending' | 'success' | 'error';

interface PairedContact {
  deviceId: string;
  displayName: string;
  isOnline: boolean;
  lastSeen: string;
  sharedWorkspaces: string[];
}

// ---------------------------------------------------------------------------
// Mock data -- replace with real paired-device queries once sync ships CRUD
// ---------------------------------------------------------------------------

function useMockContacts() {
  const [contacts, setContacts] = useState<PairedContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mock: PairedContact[] = [
      {
        deviceId: 'device-002',
        displayName: "Trey's MacBook Pro",
        isOnline: true,
        lastSeen: new Date().toISOString(),
        sharedWorkspaces: ['Personal'],
      },
      {
        deviceId: 'device-003',
        displayName: "Trey's iPhone",
        isOnline: true,
        lastSeen: new Date().toISOString(),
        sharedWorkspaces: ['Personal', 'Family'],
      },
      {
        deviceId: 'device-004',
        displayName: "Trey's iPad",
        isOnline: false,
        lastSeen: '2026-04-21T18:30:00Z',
        sharedWorkspaces: ['Personal'],
      },
    ];
    setContacts(mock);
    setLoading(false);
  }, []);

  return { contacts, loading };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENDING_STEPS = [
  'Finding best connection...',
  'Sending via LAN...',
  'Delivered!',
] as const;

function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareDialog({
  isOpen,
  onClose,
  moduleId,
  tableName,
  rowId,
  itemTitle,
  itemPreview,
}: ShareDialogProps) {
  const { contacts, loading } = useMockContacts();
  const [step, setStep] = useState<ShareStep>('select_contact');
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<PairedContact | null>(null);
  const [sendingStepIdx, setSendingStepIdx] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('select_contact');
      setSearch('');
      setSelectedContact(null);
      setSendingStepIdx(0);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'sending') onClose();
    },
    [onClose, step],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Simulate sending progress
  const handleSend = useCallback((contact: PairedContact) => {
    setSelectedContact(contact);
    setStep('sending');
    setSendingStepIdx(0);

    // Simulate progress through sending steps
    const timer1 = setTimeout(() => setSendingStepIdx(1), 800);
    const timer2 = setTimeout(() => setSendingStepIdx(2), 1800);
    const timer3 = setTimeout(() => {
      // Simulate occasional failure for offline devices
      if (!contact.isOnline) {
        setErrorMessage(`${contact.displayName} is offline. Could not establish a connection.`);
        setStep('error');
      } else {
        setStep('success');
      }
    }, 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleRetry = useCallback(() => {
    if (selectedContact) {
      handleSend(selectedContact);
    }
  }, [selectedContact, handleSend]);

  if (!isOpen) return null;

  const filtered = contacts.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={styles.overlay} onClick={step !== 'sending' ? onClose : undefined}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Share Item</h2>
          <button
            style={styles.closeButton}
            onClick={onClose}
            disabled={step === 'sending'}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Item preview */}
        <div style={styles.itemCard}>
          <div style={styles.itemInfo}>
            <span style={styles.itemTitle}>{itemTitle}</span>
            <span style={styles.itemMeta}>
              {moduleId} / {tableName} / {rowId}
            </span>
          </div>
          {itemPreview && (
            <p style={styles.itemPreview}>{itemPreview}</p>
          )}
        </div>

        {/* Step: Select Contact */}
        {step === 'select_contact' && (
          <>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search paired devices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            <div style={styles.contactList}>
              {loading && (
                <p style={styles.emptyText}>Loading contacts...</p>
              )}
              {!loading && filtered.length === 0 && (
                <p style={styles.emptyText}>
                  {search ? 'No matching devices' : 'No paired devices found'}
                </p>
              )}
              {filtered.map((contact) => (
                <button
                  key={contact.deviceId}
                  style={styles.contactRow}
                  onClick={() => handleSend(contact)}
                >
                  <div style={styles.contactLeft}>
                    <div style={styles.contactNameRow}>
                      <span
                        style={{
                          ...styles.onlineDot,
                          backgroundColor: contact.isOnline
                            ? '#30D158'
                            : 'var(--text-tertiary)',
                        }}
                      />
                      <span style={styles.contactName}>{contact.displayName}</span>
                    </div>
                    <span style={styles.contactMeta}>
                      {contact.isOnline ? 'Online' : formatLastSeen(contact.lastSeen)}
                      {contact.sharedWorkspaces.length > 0 && (
                        <> &middot; {contact.sharedWorkspaces.join(', ')}</>
                      )}
                    </span>
                  </div>
                  <span style={styles.sendArrow}>&#8594;</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step: Sending */}
        {step === 'sending' && (
          <div style={styles.progressContainer}>
            {SENDING_STEPS.map((label, i) => (
              <div key={label} style={styles.progressStep}>
                <span
                  style={{
                    ...styles.progressDot,
                    backgroundColor:
                      i <= sendingStepIdx ? '#30D158' : 'var(--surface-elevated)',
                    borderColor:
                      i <= sendingStepIdx ? '#30D158' : 'var(--border)',
                  }}
                />
                <span
                  style={{
                    ...styles.progressLabel,
                    color: i <= sendingStepIdx ? 'var(--text)' : 'var(--text-tertiary)',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
            <p style={styles.progressTarget}>
              To: {selectedContact?.displayName}
            </p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div style={styles.resultContainer}>
            <div style={styles.successIcon}>&#10003;</div>
            <p style={styles.resultTitle}>Delivered!</p>
            <p style={styles.resultSubtitle}>
              Sent to {selectedContact?.displayName} via LAN
            </p>
            <button style={styles.primaryButton} onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div style={styles.resultContainer}>
            <div style={styles.errorIcon}>!</div>
            <p style={styles.resultTitle}>Share Failed</p>
            <p style={styles.resultSubtitle}>{errorMessage}</p>
            <div style={styles.errorActions}>
              <button style={styles.retryButton} onClick={handleRetry}>
                Retry
              </button>
              <button style={styles.secondaryButton} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    width: '100%',
    maxWidth: '480px',
    maxHeight: '80vh',
    backgroundColor: '#1B1B20',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
  },

  // Item preview
  itemCard: {
    margin: '0 24px 16px',
    padding: '12px 16px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  itemTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  itemMeta: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: 'monospace',
  },
  itemPreview: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '8px 0 0',
    lineHeight: '1.5',
  },

  // Search
  searchInput: {
    margin: '0 24px 12px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },

  // Contact list
  contactList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 12px 16px',
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px',
    margin: '0 0 2px',
    borderRadius: '10px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    color: 'inherit',
    font: 'inherit',
    transition: 'background-color 0.1s',
  },
  contactLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  contactNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  onlineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '4px',
    flexShrink: 0,
  },
  contactName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
  },
  contactMeta: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    paddingLeft: '16px',
  },
  sendArrow: {
    fontSize: '16px',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    padding: '24px 0',
  },

  // Sending progress
  progressContainer: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
  },
  progressStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    maxWidth: '280px',
  },
  progressDot: {
    width: '12px',
    height: '12px',
    borderRadius: '6px',
    border: '2px solid',
    flexShrink: 0,
    transition: 'all 0.3s',
  },
  progressLabel: {
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.3s',
  },
  progressTarget: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '8px 0 0',
  },

  // Result (success / error)
  resultContainer: {
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  successIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    backgroundColor: 'rgba(48,209,88,0.15)',
    color: '#30D158',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '8px',
  },
  errorIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    backgroundColor: 'rgba(255,69,58,0.15)',
    color: '#FF453A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '8px',
  },
  resultTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  resultSubtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
    textAlign: 'center' as const,
  },
  primaryButton: {
    marginTop: '16px',
    padding: '10px 32px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#30D158',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  retryButton: {
    padding: '10px 24px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 24px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  errorActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
};
