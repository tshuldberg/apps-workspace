'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GA_MODULE_IDS,
  PUBLIC_BETA_MODULE_IDS,
  HEALTH_DATA_MODULE_IDS,
  MODULE_METADATA,
  isGeneralAvailabilityModule,
} from '@mylife/module-registry';
import { LOCKABLE_MODULE_IDS } from '../../../../packages/auth/src/module-lock';
import type { ModuleLockRow } from '../../../../packages/auth/src/types';
import { useModuleRegistry } from '@mylife/module-registry/hooks';
import type { Entitlements, PlanMode } from '@mylife/entitlements';
import {
  getModeConfigAction,
  getStoredEntitlementAction,
  refreshStoredEntitlementAction,
  listAllHealthConsentsAction,
  withdrawHealthConsentAction,
  getAllModuleLocksAction,
  enableModuleLockAction,
  disableModuleLockAction,
  exportAllModulesAction,
} from '../actions';
import type { HealthConsent } from '@mylife/db';
import { isWebSupportedModuleId } from '@/lib/modules';
import { useEntitlements, usePayment } from '@/components/EntitlementsProvider';
import { useWebLocalAuth } from '@/components/WebLocalAuthProvider';

export default function SettingsPage() {
  const registry = useModuleRegistry();
  const enabled = registry
    .getEnabled()
    .filter((mod) => isWebSupportedModuleId(mod.id));
  const enabledGaCount = enabled.filter((mod) => isGeneralAvailabilityModule(mod.id)).length;
  const [mode, setMode] = useState<PlanMode>('local_only');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlements | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subAction, setSubAction] = useState<string | null>(null);
  const [healthConsents, setHealthConsents] = useState<HealthConsent[]>([]);
  const [moduleLocks, setModuleLocks] = useState<ModuleLockRow[]>([]);
  const [lockSetup, setLockSetup] = useState<{ moduleId: string; step: 'enter' | 'confirm'; pin?: string } | null>(null);
  const [lockPin, setLockPin] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const entitlementState = useEntitlements();
  const { paymentService, refreshEntitlements } = usePayment();
  const { user, isAuthenticated, signOut } = useWebLocalAuth();

  const loadModeAndEntitlement = async () => {
    const [modeConfig, storedEntitlement, consents, locks] = await Promise.all([
      getModeConfigAction(),
      getStoredEntitlementAction(),
      listAllHealthConsentsAction(),
      getAllModuleLocksAction(),
    ]);
    setMode(modeConfig.mode);
    setServerUrl(modeConfig.serverUrl);
    setEntitlement(storedEntitlement);
    setHealthConsents(consents);
    setModuleLocks(locks);
  };

  useEffect(() => {
    void loadModeAndEntitlement();
  }, []);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const exportData = await exportAllModulesAction();
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mylife-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefreshEntitlement = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshStoredEntitlementAction();
      setRefreshMessage(result.message);
      if (result.ok) {
        await loadModeAndEntitlement();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Manage your MyLife hub</p>
      </div>

      {/* Account */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Account</h2>
        <div style={styles.card}>
          {isAuthenticated && user ? (
            <>
              <div style={styles.row}>
                <span style={styles.planLabel}>Signed in as</span>
                <span style={styles.accountValue}>{user.displayName}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.planLabel}>Email</span>
                <span style={styles.accountValue}>{user.email}</span>
              </div>
              <button
                style={styles.dangerButton}
                onClick={() => void signOut()}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <p style={styles.planNote}>
                Create an account to back up your data and sync across devices.
              </p>
              <div style={styles.authButtons}>
                <Link href="/auth/sign-in" style={styles.linkButton}>
                  Sign In
                </Link>
                <Link href="/auth/sign-up" style={styles.linkButton}>
                  Create Account
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Subscription status */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Subscription</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <div>
              <p style={styles.planLabel}>Current Plan</p>
              <p style={styles.planValue}>
                {entitlementState.hubUnlocked ? 'MyLife Pro' : 'Free Tier'}
              </p>
            </div>
            {entitlementState.hubUnlocked ? (
              <span style={styles.proBadge}>PRO</span>
            ) : (
              <Link href="/discover" style={styles.upgradeButton}>
                Upgrade
              </Link>
            )}
          </div>

          {entitlementState.hubUnlocked ? (
            <>
              <p style={styles.planNote}>
                All {GA_MODULE_IDS.length} modules unlocked.
                {entitlementState.updateEntitled ? ' Updates active.' : ' Update pack expired.'}
              </p>
              {entitlementState.purchaseDate && (
                <div style={{ ...styles.row, marginTop: '12px' }}>
                  <span style={styles.planLabel}>Purchased</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {entitlementState.purchaseDate.toLocaleDateString()}
                  </span>
                </div>
              )}
              <div style={{ ...styles.row, marginTop: '8px' }}>
                <span style={styles.planLabel}>Storage Tier</span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {entitlementState.storageTier.toUpperCase()}
                </span>
              </div>
              <button
                style={styles.refreshButton}
                onClick={async () => {
                  setSubAction('restore');
                  try {
                    await paymentService?.restore();
                    await refreshEntitlements();
                  } finally {
                    setSubAction(null);
                  }
                }}
                disabled={subAction !== null}
              >
                {subAction === 'restore' ? 'Restoring...' : 'Restore Purchases'}
              </button>
            </>
          ) : (
            <>
              <p style={styles.planNote}>
                MyLife Pro guarantees {GA_MODULE_IDS.length} suite GA modules. {enabledGaCount} of your
                currently enabled web modules are part of that launch promise, and {PUBLIC_BETA_MODULE_IDS.length}{' '}
                more modules are available in public beta.
              </p>
              <button
                style={{ ...styles.refreshButton, marginTop: '12px' }}
                onClick={async () => {
                  setSubAction('restore');
                  try {
                    await paymentService?.restore();
                    await refreshEntitlements();
                  } finally {
                    setSubAction(null);
                  }
                }}
                disabled={subAction !== null}
              >
                {subAction === 'restore' ? 'Restoring...' : 'Restore Purchases'}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Active modules summary */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Active Modules</h2>
        <div style={styles.card}>
          {enabled.length > 0 ? (
            <div style={styles.moduleList}>
              {enabled.map((mod) => (
                <div key={mod.id} style={styles.moduleRow}>
                  <span style={styles.moduleIcon}>{mod.icon}</span>
                  <span style={styles.moduleName}>{mod.name}</span>
                  <span style={styles.moduleVersion}>v{mod.version}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>No modules enabled</p>
          )}
        </div>
      </section>

      {/* Privacy & Legal */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Privacy &amp; Legal</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.planLabel}>Privacy Dashboard</span>
            <Link href="/settings/privacy" style={styles.linkButton}>
              Open Privacy
            </Link>
          </div>
          <p style={styles.planNote}>
            Real-time compliance status, per-module data summary, and the Anti-Enshittification Pledge.
          </p>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Sharing Preferences</span>
            <Link href="/settings/sharing" style={styles.linkButton}>
              Open Sharing
            </Link>
          </div>
          <p style={styles.planNote}>
            Control which data is shared socially. All sharing is opt-in and anonymized.
          </p>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Privacy Policy</span>
            <Link href="/legal/privacy" style={styles.linkButton}>
              View
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '8px' }}>
            <span style={styles.planLabel}>Terms of Service</span>
            <Link href="/legal/terms" style={styles.linkButton}>
              View
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '8px' }}>
            <span style={styles.planLabel}>Health Data Details</span>
            <Link href="/legal/health-data" style={styles.linkButton}>
              View
            </Link>
          </div>
        </div>
      </section>

      {/* Health Data Consent */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Health Data Consent</h2>
        <div style={styles.card}>
          <p style={styles.planNote}>
            Modules that collect consumer health data require your consent.
            You can withdraw consent at any time.
          </p>
          {HEALTH_DATA_MODULE_IDS.map((moduleId) => {
            const meta = MODULE_METADATA[moduleId];
            const consent = healthConsents.find((c) => c.moduleId === moduleId);
            const isActive = consent !== undefined && consent.withdrawnAt === null;
            return (
              <div key={moduleId} style={{ ...styles.row, marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <div>
                  <span style={styles.planLabel}>
                    {meta.icon} {meta.name}
                  </span>
                  {isActive && consent?.consentedAt && (
                    <p style={{ ...styles.planNote, marginTop: 2 }}>
                      Consented {new Date(consent.consentedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {isActive ? (
                  <button
                    style={styles.dangerButton}
                    onClick={async () => {
                      if (confirm(`Withdraw health data consent for ${meta.name}? Existing data will be preserved.`)) {
                        await withdrawHealthConsentAction(moduleId);
                        setHealthConsents(await listAllHealthConsentsAction());
                      }
                    }}
                  >
                    Withdraw
                  </button>
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    {consent?.withdrawnAt ? 'Withdrawn' : 'Not consented'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Module Locks */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Module Locks</h2>
        <div style={styles.card}>
          <p style={styles.planNote}>
            Protect sensitive modules with a PIN lock. Enter your PIN before viewing locked module content.
          </p>
          {LOCKABLE_MODULE_IDS.map((moduleId) => {
            const meta = MODULE_METADATA[moduleId];
            const lock = moduleLocks.find((l) => l.moduleId === moduleId);
            const isSettingUp = lockSetup?.moduleId === moduleId;
            return (
              <div key={moduleId} style={{ ...styles.row, marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={styles.planLabel}>{meta.icon} {meta.name}</span>
                {!isSettingUp && (
                  lock ? (
                    <button
                      style={styles.dangerButton}
                      onClick={() => {
                        setLockSetup({ moduleId, step: 'enter' });
                        setLockPin('');
                        setLockError(null);
                      }}
                    >
                      Remove Lock
                    </button>
                  ) : (
                    <button
                      style={styles.linkButton}
                      onClick={() => {
                        setLockSetup({ moduleId, step: 'enter' });
                        setLockPin('');
                        setLockError(null);
                      }}
                    >
                      Set Up Lock
                    </button>
                  )
                )}
                {isSettingUp && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {lock ? 'Enter PIN to remove lock' : lockSetup.step === 'confirm' ? 'Confirm your PIN' : 'Enter a 4-6 digit PIN'}
                    </span>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={lockPin}
                      onChange={(e) => setLockPin(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && lockPin.length >= 4) {
                          if (lock) {
                            const result = await disableModuleLockAction(moduleId, lockPin);
                            if (result.ok) {
                              setModuleLocks(await getAllModuleLocksAction());
                              setLockSetup(null);
                            } else {
                              setLockError(result.error ?? 'Incorrect PIN.');
                              setLockPin('');
                            }
                          } else if (lockSetup.step === 'enter') {
                            setLockSetup({ moduleId, step: 'confirm', pin: lockPin });
                            setLockPin('');
                            setLockError(null);
                          } else if (lockSetup.step === 'confirm') {
                            if (lockPin !== lockSetup.pin) {
                              setLockError('PINs do not match.');
                              setLockPin('');
                            } else {
                              await enableModuleLockAction(moduleId, lockPin);
                              setModuleLocks(await getAllModuleLocksAction());
                              setLockSetup(null);
                            }
                          }
                        }
                      }}
                      placeholder="PIN"
                      autoFocus
                      style={{
                        width: '120px',
                        padding: '6px 10px',
                        fontSize: '16px',
                        fontFamily: 'monospace',
                        letterSpacing: '4px',
                        textAlign: 'center',
                        backgroundColor: 'var(--surface-elevated, #1A1A24)',
                        border: `1px solid ${lockError ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: '8px',
                        color: 'var(--text)',
                        outline: 'none',
                      }}
                    />
                    {lockError && <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{lockError}</span>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={styles.linkButton} onClick={() => setLockSetup(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Data & Sync */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Data &amp; Sync</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.planLabel}>Replace My Apps</span>
            <Link href="/settings/import" style={styles.linkButton}>
              Import Data
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Sync Settings</span>
            <Link href="/settings/data-sync" style={styles.linkButton}>
              Open Data &amp; Sync
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Backup & Restore (move to a new device)</span>
            <Link href="/settings/backup" style={styles.linkButton}>
              Open Backups
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Pair Device</span>
            <Link href="/settings/pair-device" style={styles.linkButton}>
              Open Pairing
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Sync Workspaces</span>
            <Link href="/settings/sync-workspaces" style={styles.linkButton}>
              Open Workspaces
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Transport Preferences</span>
            <Link href="/settings/transport-preferences" style={styles.linkButton}>
              Open Transports
            </Link>
          </div>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Export My Data</span>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              style={styles.linkButton}
            >
              {isExporting ? 'Exporting...' : 'Download JSON'}
            </button>
          </div>
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.planLabel}>Delete All Data</span>
            <Link href="/settings/privacy" style={{ ...styles.linkButton, borderColor: 'var(--danger, #FF453A)', color: 'var(--danger, #FF453A)' }}>
              Privacy Dashboard
            </Link>
          </div>
          <p style={styles.privacyText}>
            All your data is stored locally on this device. MyLife does not
            collect analytics, telemetry, or crash reports. Modules using cloud
            storage (Supabase) sync only with your authenticated account.
          </p>
        </div>
      </section>

      {/* Runtime Mode */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Mode</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.planLabel}>Current Mode</span>
            <span style={styles.modeBadge}>{mode.replace('_', ' ').toUpperCase()}</span>
          </div>
          {serverUrl && (
            <p style={styles.planNote}>
              Server: {serverUrl}
            </p>
          )}
          <a href="/settings/self-host" style={styles.linkButton}>
            Open Self-Host Setup
          </a>
        </div>
      </section>

      {/* Entitlements */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Entitlements</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.planLabel}>Sync</span>
            <button
              style={styles.refreshButton}
              onClick={() => void handleRefreshEntitlement()}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {refreshMessage && (
            <p style={styles.planNote}>{refreshMessage}</p>
          )}
          {entitlement ? (
            <>
              <div style={styles.row}>
                <span style={styles.planLabel}>Hosted</span>
                <span style={styles.planValue}>{entitlement.hostedActive ? 'ACTIVE' : 'INACTIVE'}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.planLabel}>Self-host</span>
                <span style={styles.planValue}>{entitlement.selfHostLicense ? 'LICENSED' : 'NO LICENSE'}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.planLabel}>Update Pack</span>
                <span style={styles.planValue}>{entitlement.updatePackYear ?? 'None'}</span>
              </div>
            </>
          ) : (
            <p style={styles.emptyText}>No entitlement cached</p>
          )}
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
    marginBottom: '12px',
  },
  planLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: 0,
  },
  planValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
    marginTop: '4px',
  },
  upgradeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 20px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--accent-books)',
    backgroundColor: 'transparent',
    color: 'var(--accent-books)',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.15s',
  },
  planNote: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  proBadge: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--success, #30D158)',
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    letterSpacing: '0.5px',
  },
  modeBadge: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text)',
    backgroundColor: 'var(--surface-elevated)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
  },
  refreshButton: {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  linkButton: {
    display: 'inline-block',
    marginTop: '12px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 10px',
    fontWeight: 600,
    fontSize: '13px',
    textDecoration: 'none',
  },
  moduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  moduleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  moduleIcon: {
    fontSize: '20px',
  },
  moduleName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
    flex: 1,
  },
  moduleVersion: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  privacyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  accountValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
  },
  dangerButton: {
    border: '1px solid var(--danger, #FF453A)',
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    color: 'var(--danger, #FF453A)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  authButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px',
  },
};
