'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createPairingPayload,
  completePairing,
  derivePairingSharedSecret,
  type PairingData,
} from '@mylife/sync/src/identity/pairing';
import { extractDhPrivateKeyHex } from '@mylife/sync/src/identity/device-identity';
import { deriveSas, sasFingerprint, type SasResult } from '@mylife/sync/src/protocol/sas';
import { hexToBytes } from '@mylife/sync/src/encryption/keys';
import {
  insertPairedDevice,
  getPairedDevice,
  recordSasVerification,
} from '@mylife/sync/src/db/queries';
import { useHubSync } from '@/components/HubSyncProvider';
import { refreshPairedDevices } from '@/lib/sync/hub-sync-engine';

// ---------------------------------------------------------------------------
// Real pairing payload parsing
// ---------------------------------------------------------------------------

function parsePairingData(raw: string): PairingData | null {
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<PairingData>;
    if (
      typeof parsed.publicKey === 'string' &&
      typeof parsed.dhPublicKey === 'string' &&
      typeof parsed.displayName === 'string' &&
      typeof parsed.pairingNonce === 'string' &&
      // Validate the keys are real hex of the right length (32-byte X25519 / Ed25519).
      /^[0-9a-f]{64}$/i.test(parsed.publicKey) &&
      /^[0-9a-f]{64}$/i.test(parsed.dhPublicKey)
    ) {
      return parsed as PairingData;
    }
  } catch {
    // fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PairStep = 'show' | 'enter';

export default function PairDevicePage() {
  const { ready, handle, error } = useHubSync();
  const [activeStep, setActiveStep] = useState<PairStep>('show');
  const [remoteRaw, setRemoteRaw] = useState('');
  const [remote, setRemote] = useState<PairingData | null>(null);
  const [sas, setSas] = useState<SasResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // This device's REAL pairing payload (its real Ed25519 + X25519 public keys).
  // createPairingPayload reads only public material; nothing secret is shown.
  const myPayload = useMemo(() => {
    if (!handle) return null;
    return createPairingPayload(handle.identity);
  }, [handle]);

  const myPayloadJson = useMemo(
    () => (myPayload ? JSON.stringify(myPayload.pairingData) : ''),
    [myPayload],
  );

  // Derive the REAL short-authentication-string from the X25519 shared secret.
  // Both devices that hold the same shared secret render the SAME five emoji; a
  // man-in-the-middle holding a different key renders different emoji.
  const computeSas = useCallback(() => {
    setParseError(null);
    setSas(null);
    setConfirmed(false);
    if (!handle) {
      setParseError('Sync engine is not ready yet.');
      return;
    }
    const parsed = parsePairingData(remoteRaw);
    if (!parsed) {
      setParseError('That is not a valid device code. Copy the full code from the other device.');
      return;
    }
    if (parsed.publicKey === handle.identity.publicKey) {
      setParseError('That is this device’s own code. Paste the OTHER device’s code.');
      return;
    }
    const myDhPrivateKeyHex = extractDhPrivateKeyHex(handle.identity.privateKeyRef);
    if (!myDhPrivateKeyHex) {
      setParseError('This device is missing its private key; cannot pair.');
      return;
    }
    const sharedSecretHex = derivePairingSharedSecret(myDhPrivateKeyHex, parsed.dhPublicKey);
    const result = deriveSas(hexToBytes(sharedSecretHex));
    setRemote(parsed);
    setSas(result);
  }, [handle, remoteRaw]);

  // Finalize: store the derived shared secret, insert the paired device, record
  // the SAS verification. This is the real device-pairing record; moving data
  // between the two devices is a later milestone (see the honest note below).
  const handlePair = useCallback(() => {
    if (!handle || !remote || !sas) return;
    setMessage(null);
    try {
      if (getPairedDevice(handle.boot.db, remote.publicKey)) {
        setMessage('This device is already paired.');
        return;
      }
      const paired = completePairing(handle.identity, remote);
      insertPairedDevice(handle.boot.db, paired);
      recordSasVerification(handle.boot.db, {
        peerDeviceId: remote.publicKey,
        sasIndices: sasFingerprint(sas),
      });
      void handle.boot.db.flush();
      refreshPairedDevices();
      setMessage(
        `Paired with ${remote.displayName}. The shared key is derived and stored. ` +
          'Data transfer between devices is not enabled yet on web (see below).',
      );
      setRemote(null);
      setRemoteRaw('');
      setSas(null);
      setConfirmed(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Pairing failed.');
    }
  }, [handle, remote, sas]);

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Pair Device</h1>
        <p style={styles.subtitle}>
          Link another of your devices with a fingerprint-verified key exchange. Both devices
          exchange public keys and derive a shared secret via X25519 Diffie-Hellman; you compare
          a five-emoji fingerprint to rule out a man-in-the-middle.
        </p>
      </div>

      {/* Honest boundary banner: real crypto, transfer pending. */}
      <div style={styles.noticeBanner}>
        <p style={styles.noticeText}>
          The key exchange and fingerprint here are real. Actually moving your hub data between
          two devices needs a live relay and a second device, which is verified in a later
          milestone. Until then, the supported way to move everything to another device is{' '}
          <Link href="/settings/backup" style={styles.inlineLink}>
            Settings &rarr; Backup &amp; Restore
          </Link>
          .
        </p>
      </div>

      {error && (
        <div style={styles.noticeBanner}>
          <p style={styles.noticeText}>Sync engine unavailable on this device ({error}).</p>
        </div>
      )}

      {!ready && !error && (
        <div style={styles.card}>
          <p style={styles.helpText}>Starting the sync engine...</p>
        </div>
      )}

      {ready && handle && (
        <>
          {/* Step toggle */}
          <div style={styles.tabRow}>
            <button
              style={{ ...styles.tab, ...(activeStep === 'show' ? styles.tabActive : {}) }}
              onClick={() => setActiveStep('show')}
            >
              1. Show this device
            </button>
            <button
              style={{ ...styles.tab, ...(activeStep === 'enter' ? styles.tabActive : {}) }}
              onClick={() => setActiveStep('enter')}
            >
              2. Enter other device
            </button>
          </div>

          {/* Step 1: show this device's real payload */}
          {activeStep === 'show' && (
            <section style={styles.section}>
              <div style={styles.card}>
                <p style={styles.helpText}>
                  Copy this device&rsquo;s code and paste it into the Pair Device screen on your
                  other device. It contains this device&rsquo;s public keys only, never a secret.
                </p>
                <label style={styles.fieldLabel}>{handle.identity.displayName} &middot; code</label>
                <textarea style={styles.codeArea} value={myPayloadJson} readOnly rows={4} />
                <button
                  style={styles.copyButton}
                  onClick={() => {
                    void navigator.clipboard?.writeText(myPayloadJson);
                    setMessage('Code copied to clipboard.');
                    setTimeout(() => setMessage(null), 2000);
                  }}
                >
                  Copy code
                </button>
              </div>
            </section>
          )}

          {/* Step 2: enter the other device's payload, derive + compare SAS */}
          {activeStep === 'enter' && (
            <section style={styles.section}>
              <div style={styles.card}>
                <p style={styles.helpText}>
                  Paste the code shown on your other device, then compare the fingerprint.
                </p>
                <textarea
                  style={styles.codeArea}
                  value={remoteRaw}
                  onChange={(e) => setRemoteRaw(e.target.value)}
                  placeholder="Paste the other device's code"
                  rows={4}
                />
                {parseError && <p style={styles.errorText}>{parseError}</p>}
                <button
                  style={{ ...styles.submitButton, opacity: remoteRaw.trim() ? 1 : 0.4 }}
                  onClick={computeSas}
                  disabled={!remoteRaw.trim()}
                >
                  Derive fingerprint
                </button>

                {sas && remote && (
                  <div style={styles.sasBlock}>
                    <p style={styles.sasLabel}>
                      Compare these five emoji with the ones on {remote.displayName}. They must
                      match exactly.
                    </p>
                    <div style={styles.sasRow}>
                      {sas.emoji.map((emoji, i) => (
                        <span key={i} style={styles.sasEmoji}>
                          {emoji}
                        </span>
                      ))}
                    </div>
                    <label style={styles.confirmRow}>
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      <span style={styles.confirmText}>
                        The fingerprint matches on both devices.
                      </span>
                    </label>
                    <button
                      style={{ ...styles.submitButton, opacity: confirmed ? 1 : 0.4 }}
                      onClick={handlePair}
                      disabled={!confirmed}
                    >
                      Pair {remote.displayName}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* Message */}
      {message && (
        <div style={styles.messageBanner}>
          <p style={styles.messageText}>{message}</p>
          <button style={styles.dismissButton} onClick={() => setMessage(null)}>
            Dismiss
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
  header: { marginBottom: '24px' },
  title: { fontSize: '28px', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
    lineHeight: '1.5',
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
  inlineLink: { color: '#FFB877', textDecoration: 'underline' },
  section: { marginBottom: '24px' },
  fieldLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  tabRow: {
    display: 'flex',
    gap: '0',
    marginBottom: '24px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center' as const,
  },
  tabActive: { color: '#FFB877', backgroundColor: 'rgba(255,184,119,0.1)' },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '24px',
  },
  helpText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: '0 0 16px 0',
    lineHeight: '1.5',
  },
  codeArea: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '12px',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    wordBreak: 'break-all' as const,
  },
  copyButton: {
    marginTop: '12px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  submitButton: {
    display: 'block',
    width: '100%',
    padding: '12px',
    marginTop: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    backgroundColor: '#FFB877',
    color: '#131318',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--danger, #FFB4AB)',
    margin: '8px 0 0',
  },
  sasBlock: {
    marginTop: '20px',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
  },
  sasLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '0 0 12px',
    lineHeight: '1.5',
  },
  sasRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    padding: '8px 0 16px',
  },
  sasEmoji: { fontSize: '36px', lineHeight: 1 },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  confirmText: { fontSize: '13px', color: 'var(--text)' },
  messageBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '12px 16px',
    marginBottom: '24px',
  },
  messageText: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
  dismissButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
};
