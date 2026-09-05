'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@mylife/auth/provider';
import { useSyncStatus, useSetSyncTier, usePairedDevices } from '@mylife/sync/src/hooks';
import {
  tierRequiresAuth,
  isCloudTier,
  type SyncTier,
} from '@mylife/sync/src/types';
import { PRODUCTS } from '@mylife/billing-config';
import { usePayment } from '@/components/EntitlementsProvider';
import { useHubSync } from '@/components/HubSyncProvider';

const TIER_OPTIONS: Array<{
  tier: SyncTier;
  label: string;
  description: string;
  price: string | null;
}> = [
  {
    tier: 'local_only',
    label: 'Local Only',
    description: 'Data stays on this device. No sync, maximum privacy.',
    price: null,
  },
  {
    tier: 'p2p',
    label: 'Peer-to-Peer',
    description: 'Sync directly between your devices via WebRTC. No cloud, no account needed.',
    price: null,
  },
  {
    tier: 'free_cloud',
    label: 'Free Cloud',
    description: '1 GB cloud sync. Requires a free account.',
    price: 'Free',
  },
  {
    tier: 'starter_cloud',
    label: 'Starter Cloud',
    description: '5 GB cloud sync with priority support.',
    price: `$${PRODUCTS.storageTiers.starter.price.toFixed(2)}/mo`,
  },
  {
    tier: 'power_cloud',
    label: 'Power Cloud',
    description: '25 GB cloud sync with priority support.',
    price: `$${PRODUCTS.storageTiers.power.price.toFixed(2)}/mo`,
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatLimit(bytes: number): string {
  if (!isFinite(bytes)) return 'Unlimited';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(0)} GB`;
}

export default function DataSyncPage() {
  const syncStatus = useSyncStatus();
  const setSyncTier = useSetSyncTier();
  const { isAuthenticated, signIn, signUp } = useAuth();
  const { paymentService } = usePayment();

  const pairedDevices = usePairedDevices();
  const { ready: syncReady, error: syncError } = useHubSync();

  const [changingTier, setChangingTier] = useState<SyncTier | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const usedPercent =
    isFinite(syncStatus.storageLimitBytes) && syncStatus.storageLimitBytes > 0
      ? Math.min((syncStatus.storageUsedBytes / syncStatus.storageLimitBytes) * 100, 100)
      : 0;

  const handleTierChange = async (tier: SyncTier) => {
    setChangingTier(tier);
    setTierError(null);
    try {
      if (tier === 'starter_cloud' && paymentService) {
        await paymentService.upgradeStorage('starter');
      } else if (tier === 'power_cloud' && paymentService) {
        await paymentService.upgradeStorage('power');
      }
      await setSyncTier(tier);
    } catch (err) {
      // Honest surface: cloud tiers are refused by the device-to-device handler
      // until cloud sync ships. Show the real reason instead of a silent no-op.
      setTierError(err instanceof Error ? err.message : 'Could not change sync mode.');
    } finally {
      setChangingTier(null);
    }
  };

  const handleAuth = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const result = authMode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password);
      if (!result.success) {
        setAuthError(result.error ?? 'Authentication failed');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <div>
      <div style={styles.headerBlock}>
        <h1 style={styles.title}>Data & Sync</h1>
        <p style={styles.subtitle}>Manage how your data is stored and synced</p>
      </div>

      {/* Cross-device callout: Backup is the supported, verified way to move a
          whole hub to another device today. */}
      <section style={styles.section}>
        <div style={styles.backupCallout}>
          <p style={styles.backupTitle}>Moving to a new device?</p>
          <p style={styles.backupText}>
            The supported way to move your entire hub to another device today is an encrypted
            backup you download here and restore there. Device-to-device sync (below) is being
            rolled out.
          </p>
          <Link href="/settings/backup" style={styles.backupButton}>
            Open Backup &amp; Restore
          </Link>
        </div>
      </section>

      {syncError && (
        <div style={styles.errorBanner}>
          <p style={styles.caption}>Sync engine unavailable on this device ({syncError}).</p>
        </div>
      )}

      {tierError && (
        <div style={styles.errorBanner}>
          <p style={styles.caption}>{tierError}</p>
        </div>
      )}

      {/* Current mode display */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Current Sync Mode</h2>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.modeLabel}>
              {TIER_OPTIONS.find((t) => t.tier === syncStatus.tier)?.label ?? syncStatus.tier}
            </span>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor: syncStatus.connected ? 'var(--success)' : 'var(--text-tertiary)',
              }}
            />
          </div>
          {syncStatus.lastSyncedAt && (
            <p style={styles.caption}>
              Last synced: {syncStatus.lastSyncedAt.toLocaleString()}
            </p>
          )}
          {syncStatus.pendingChanges > 0 && (
            <p style={styles.caption}>
              {syncStatus.pendingChanges} pending change{syncStatus.pendingChanges !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </section>

      {/* Storage usage */}
      {isCloudTier(syncStatus.tier) && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Storage Usage</h2>
          <div style={styles.card}>
            <p style={styles.usageText}>
              {formatBytes(syncStatus.storageUsedBytes)} of {formatLimit(syncStatus.storageLimitBytes)} used
            </p>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${usedPercent}%`,
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* P2P pairing: real paired-device count from the engine + a link to the
          real fingerprint-verified pairing flow. No fabricated codes. */}
      {syncStatus.tier === 'p2p' && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Peer-to-Peer Pairing</h2>
          <div style={styles.card}>
            <div style={styles.row}>
              <span style={styles.modeLabel}>
                {pairedDevices.length} paired device{pairedDevices.length !== 1 ? 's' : ''}
              </span>
            </div>
            {pairedDevices.length > 0 && (
              <ul style={styles.deviceList}>
                {pairedDevices.map((device) => (
                  <li key={device.deviceId} style={styles.deviceItem}>
                    {device.displayName}
                    <span style={styles.deviceId}>
                      {device.deviceId.slice(0, 8)}&hellip;
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p style={styles.caption}>
              Pairing exchanges public keys and verifies a five-emoji fingerprint. Transfer
              between paired devices is being rolled out.
            </p>
            <Link href="/settings/pair-device" style={styles.pairLink}>
              {syncReady ? 'Pair a device' : 'Pair a device (starting sync...)'}
            </Link>
          </div>
        </section>
      )}

      {/* Auth section for cloud tiers */}
      {tierRequiresAuth(syncStatus.tier) && !isAuthenticated && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Sign In for Cloud Sync</h2>
          <div style={styles.card}>
            <p style={styles.caption}>A free account is required to enable cloud sync.</p>
            <input
              style={styles.authInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
            />
            <input
              style={styles.authInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
            />
            {authError && <p style={styles.authError}>{authError}</p>}
            <button
              style={{
                ...styles.authButton,
                opacity: authSubmitting ? 0.6 : 1,
              }}
              onClick={() => void handleAuth()}
              disabled={authSubmitting}
            >
              {authSubmitting ? 'Processing...' : authMode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
            <button
              style={styles.toggleAuth}
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
            >
              {authMode === 'signin'
                ? 'Need an account? Sign up'
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </section>
      )}

      {/* Mode selector */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Change Sync Mode</h2>
        {TIER_OPTIONS.map((option) => {
          const isActive = syncStatus.tier === option.tier;
          const isChanging = changingTier === option.tier;
          const needsAuth = tierRequiresAuth(option.tier) && !isAuthenticated;

          return (
            <button
              key={option.tier}
              style={{
                ...styles.tierCard,
                borderColor: isActive ? 'var(--success)' : 'var(--border)',
                opacity: changingTier !== null && !isChanging ? 0.6 : 1,
              }}
              onClick={() => void handleTierChange(option.tier)}
              disabled={isActive || changingTier !== null}
            >
              <div style={styles.tierHeader}>
                <span style={styles.tierLabel}>{option.label}</span>
                <div style={styles.tierRight}>
                  {option.price && (
                    <span style={styles.tierPrice}>{option.price}</span>
                  )}
                  {isChanging && <span style={styles.spinner}>...</span>}
                  {isActive && (
                    <span style={styles.activeDot} />
                  )}
                </div>
              </div>
              <p style={styles.tierDescription}>{option.description}</p>
              {needsAuth && (
                <p style={styles.authNote}>Requires sign-in</p>
              )}
            </button>
          );
        })}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerBlock: {
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
  },
  modeLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '4px',
    display: 'inline-block',
  },
  caption: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
  },
  usageText: {
    fontSize: '14px',
    color: 'var(--text)',
    margin: '0 0 8px',
  },
  progressTrack: {
    height: '6px',
    borderRadius: '3px',
    backgroundColor: 'var(--surface-elevated)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    backgroundColor: 'var(--success)',
    transition: 'width 0.3s ease',
  },
  backupCallout: {
    backgroundColor: 'rgba(255,184,119,0.08)',
    border: '1px solid rgba(255,184,119,0.25)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
  },
  backupTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 6px',
  },
  backupText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: '0 0 12px',
  },
  backupButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    backgroundColor: '#FFB877',
    color: '#131318',
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
  },
  errorBanner: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '24px',
  },
  deviceList: {
    listStyle: 'none',
    padding: 0,
    margin: '12px 0 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  deviceItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: 'var(--text)',
  },
  deviceId: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  pairLink: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: '12px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
  },
  authInput: {
    width: '100%',
    backgroundColor: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px',
    color: 'var(--text)',
    fontSize: '16px',
    marginTop: '8px',
    outline: 'none',
  },
  authError: {
    fontSize: '13px',
    color: 'var(--danger)',
    margin: '8px 0 0',
  },
  authButton: {
    width: '100%',
    backgroundColor: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px',
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'opacity 0.15s',
  },
  toggleAuth: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '8px 0',
    textAlign: 'center',
    marginTop: '4px',
  },
  tierCard: {
    width: '100%',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '16px',
    marginBottom: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
    transition: 'border-color 0.15s, opacity 0.15s',
    display: 'block',
  },
  tierHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  tierLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  tierRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tierPrice: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  tierDescription: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  activeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '4px',
    backgroundColor: 'var(--success)',
    display: 'inline-block',
  },
  authNote: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    margin: '4px 0 0',
    fontStyle: 'italic',
  },
  spinner: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: 700,
  },
};
