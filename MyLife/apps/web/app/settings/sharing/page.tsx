'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SharingPreferenceView, SharingConsent } from '@mylife/db';
import { SOCIAL_CAPABLE_MODULES } from '@mylife/social';
import {
  getSharingConsentAction,
  recordSharingConsentAction,
  revokeSharingConsentAction,
  getAllSharingPreferencesAction,
  getActiveSharingCountAction,
  updateSharingPreferenceAction,
  revokeAllSharingAction,
  deleteAllSharingAction,
} from '../../actions';

/** Data types available for sharing, per module. */
const MODULE_DATA_TYPES: Record<string, string[]> = {
  books: ['reading_activity', 'reviews', 'shelves'],
  budget: ['goals', 'streaks'],
  fast: ['completions', 'streaks'],
  forums: ['threads', 'replies'],
  habits: ['completions', 'streaks'],
  health: ['milestones'],
  market: ['listings', 'reviews'],
  meds: ['adherence_streaks'],
  recipes: ['cooked', 'created'],
  surf: ['sessions', 'spots'],
  words: ['learned', 'streaks'],
  workouts: ['completions', 'personal_bests', 'streaks'],
};

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SharingPage() {
  const [consent, setConsent] = useState<SharingConsent>({ consented: false, consentedAt: null });
  const [preferences, setPreferences] = useState<SharingPreferenceView[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  const refresh = useCallback(async () => {
    const [c, prefs, count] = await Promise.all([
      getSharingConsentAction(),
      getAllSharingPreferencesAction(),
      getActiveSharingCountAction(),
    ]);
    setConsent(c);
    setPreferences(prefs);
    setActiveCount(count);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConsent = async () => {
    await recordSharingConsentAction();
    await refresh();
  };

  const handleRevokeConsent = async () => {
    if (!window.confirm('Revoke sharing consent? This will disable all data sharing.')) return;
    await revokeSharingConsentAction();
    await refresh();
  };

  const handleToggle = async (moduleId: string, dataType: string, shared: boolean) => {
    await updateSharingPreferenceAction(moduleId, dataType, shared);
    await refresh();
  };

  const handleRevokeAll = async () => {
    if (!window.confirm('Disable all sharing across all modules?')) return;
    await revokeAllSharingAction();
    await refresh();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all sharing preferences and revoke consent? This cannot be undone.')) return;
    await deleteAllSharingAction();
    await refresh();
  };

  const isShared = (moduleId: string, dataType: string): boolean => {
    return preferences.some(
      (p) => p.moduleId === moduleId && p.dataType === dataType && p.shared,
    );
  };

  // Consent gate
  if (!consent.consented) {
    return (
      <div>
        <div style={styles.header}>
          <h1 style={styles.title}>Sharing Preferences</h1>
          <p style={styles.subtitle}>Control what data you share with the community</p>
        </div>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Data Sharing Consent</h2>
          <div style={styles.card}>
            <p style={styles.consentText}>
              MyLife social features let you share activity with friends and the community.
              Before any data is shared, review and accept these principles:
            </p>
            <ol style={styles.principleList}>
              <li style={styles.principle}>All sharing is opt-in. Nothing is shared without your explicit choice.</li>
              <li style={styles.principle}>You choose exactly which data types from which modules are shared.</li>
              <li style={styles.principle}>Shared data is anonymized by default.</li>
              <li style={styles.principle}>We never sell your data. Ever.</li>
              <li style={styles.principle}>You can delete all shared data at any time from this screen.</li>
            </ol>
            <button style={styles.consentButton} onClick={() => void handleConsent()}>
              I Understand, Enable Sharing Controls
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Sharing Preferences</h1>
        <p style={styles.subtitle}>Control what data you share with the community</p>
      </div>

      {/* Status */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Sharing Status</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.label}>Active sharing</span>
            <span style={{
              ...styles.statusValue,
              color: activeCount > 0 ? 'var(--success, #30D158)' : 'var(--text-secondary)',
            }}>
              {activeCount} data {activeCount === 1 ? 'type' : 'types'}
            </span>
          </div>
          <p style={styles.helpText}>
            All shared data is anonymized. You control every toggle below.
          </p>
        </div>
      </section>

      {/* Per-module toggles */}
      {SOCIAL_CAPABLE_MODULES.map((moduleId) => {
        const dataTypes = MODULE_DATA_TYPES[moduleId] ?? [];
        if (dataTypes.length === 0) return null;

        return (
          <section key={moduleId} style={styles.section}>
            <h2 style={styles.sectionTitle}>{humanize(moduleId)}</h2>
            <div style={styles.card}>
              {dataTypes.map((dataType, idx) => (
                <div
                  key={dataType}
                  style={{
                    ...styles.row,
                    ...(idx > 0 ? styles.rowBorder : {}),
                  }}
                >
                  <span style={styles.dataTypeLabel}>{humanize(dataType)}</span>
                  <label style={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={isShared(moduleId, dataType)}
                      onChange={(e) => void handleToggle(moduleId, dataType, e.target.checked)}
                      style={styles.checkbox}
                    />
                    <span style={{
                      ...styles.toggleTrack,
                      backgroundColor: isShared(moduleId, dataType)
                        ? 'var(--success, #30D158)'
                        : 'var(--surface-elevated)',
                    }}>
                      <span style={{
                        ...styles.toggleThumb,
                        transform: isShared(moduleId, dataType) ? 'translateX(18px)' : 'translateX(2px)',
                      }} />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Danger zone */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Data Controls</h2>
        <div style={styles.card}>
          <div style={styles.dangerRow}>
            <button style={styles.dangerButton} onClick={() => void handleRevokeAll()}>
              Disable All Sharing
            </button>
            <p style={styles.dangerHelp}>Turns off all toggles above</p>
          </div>
          <div style={{ ...styles.dangerRow, ...styles.rowBorder }}>
            <button style={styles.dangerButton} onClick={() => void handleRevokeConsent()}>
              Revoke Consent
            </button>
            <p style={styles.dangerHelp}>Disables sharing and resets consent</p>
          </div>
          <div style={{ ...styles.dangerRow, ...styles.rowBorder }}>
            <button style={styles.destructiveButton} onClick={() => void handleDeleteAll()}>
              Delete All Shared Data
            </button>
            <p style={{ ...styles.dangerHelp, color: 'var(--danger, #FF453A)' }}>
              Permanently removes all sharing data
            </p>
          </div>
        </div>
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
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
  },
  rowBorder: {
    borderTop: '1px solid var(--border)',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  statusValue: {
    fontSize: '14px',
    fontWeight: 600,
  },
  dataTypeLabel: {
    fontSize: '14px',
    color: 'var(--text)',
  },
  helpText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '8px 0 0 0',
    lineHeight: '1.5',
  },
  consentText: {
    fontSize: '14px',
    color: 'var(--text)',
    lineHeight: '1.6',
    margin: '0 0 16px 0',
  },
  principleList: {
    margin: '0 0 24px 0',
    paddingLeft: '20px',
  },
  principle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.8',
  },
  consentButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    backgroundColor: 'var(--success, #30D158)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
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
  dangerRow: {
    padding: '12px 0',
  },
  dangerButton: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  destructiveButton: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255,69,58,0.3)',
    backgroundColor: 'transparent',
    color: 'var(--danger, #FF453A)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerHelp: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  },
};
