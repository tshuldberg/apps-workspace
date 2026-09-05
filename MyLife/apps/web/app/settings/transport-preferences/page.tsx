'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { SyncTransport, SyncTransportPreference } from '@mylife/sync/src/types';
import {
  getTransportPreferences,
  setTransportPreferences,
} from '@mylife/sync/src/db/queries';
import { useHubSync } from '@/components/HubSyncProvider';

// ---------------------------------------------------------------------------
// Transport layer definitions
// ---------------------------------------------------------------------------

interface TransportLayer {
  id: number;
  name: string;
  transport: SyncTransport;
  description: string;
  enabled: boolean;
}

const DEFAULT_LAYERS: TransportLayer[] = [
  {
    id: 1,
    name: 'LAN (Wi-Fi / Bonjour)',
    transport: 'lan',
    description: 'Direct sync over local network. Fastest and most private.',
    enabled: true,
  },
  {
    id: 2,
    name: 'Nearby Peer',
    transport: 'nearby',
    description: 'Apple Multipeer Connectivity or Android Wi-Fi Direct. Works without internet.',
    enabled: true,
  },
  {
    id: 3,
    name: 'BLE (Bluetooth Low Energy)',
    transport: 'ble',
    description: 'Wake-up pings only. Used to trigger sync over faster transports.',
    enabled: true,
  },
  {
    id: 4,
    name: 'WebRTC',
    transport: 'wan_webrtc',
    description: 'End-to-end encrypted peer connection over the internet via STUN/TURN.',
    enabled: true,
  },
  {
    id: 5,
    name: 'Encrypted Relay',
    transport: 'wan_relay',
    description: 'Relay server forwards ciphertext only. Fallback when direct connections fail.',
    enabled: false,
  },
];

// ---------------------------------------------------------------------------
// Real data layer (engine-backed: sync_transport_preferences, keyed by device)
// ---------------------------------------------------------------------------

// Canonical layer ids (mirror DEFAULT_TRANSPORT_LAYER_ORDER in
// transport-manager.ts): 1=LAN, 2=nearby, 3=BLE, 4=WebRTC, 5=relay.
const LAYER_BY_ID = new Map<number, TransportLayer>(
  DEFAULT_LAYERS.map((layer) => [layer.id, layer]),
);

/** Build the ordered layer list from persisted preference rows. */
function layersFromPrefs(prefs: SyncTransportPreference[]): TransportLayer[] {
  if (prefs.length === 0) return DEFAULT_LAYERS;
  const ordered = [...prefs]
    .sort((a, b) => a.rank - b.rank)
    .map((pref) => {
      const base = LAYER_BY_ID.get(pref.layerId);
      if (!base) return null;
      return { ...base, enabled: pref.enabled };
    })
    .filter((l): l is TransportLayer => l !== null);
  // Append any layers not present in storage (e.g. after a new layer is added).
  for (const layer of DEFAULT_LAYERS) {
    if (!ordered.some((l) => l.id === layer.id)) ordered.push(layer);
  }
  return ordered;
}

function useTransportPreferences() {
  const { ready, handle, error } = useHubSync();
  const [layers, setLayers] = useState<TransportLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (error) {
      setLayers(DEFAULT_LAYERS);
      setLoading(false);
      return;
    }
    if (!ready || !handle) return;
    const prefs = getTransportPreferences(handle.boot.db, handle.identity.publicKey);
    setLayers(layersFromPrefs(prefs));
    setLoading(false);
  }, [ready, handle, error]);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setDirty(true);
  }, []);

  const moveDown = useCallback((index: number) => {
    setLayers((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setDirty(true);
  }, []);

  const toggleEnabled = useCallback((index: number) => {
    setLayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
    setDirty(true);
  }, []);

  const resetToDefaults = useCallback(() => {
    setLayers(DEFAULT_LAYERS);
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!handle) {
      throw new Error('Sync engine is not ready yet.');
    }
    const now = new Date().toISOString();
    const prefs: SyncTransportPreference[] = layers.map((layer, index) => ({
      deviceId: handle.identity.publicKey,
      layerId: layer.id,
      rank: index + 1,
      enabled: layer.enabled,
      updatedAt: now,
    }));
    setTransportPreferences(handle.boot.db, handle.identity.publicKey, prefs);
    await handle.boot.db.flush();
    setDirty(false);
  }, [handle, layers]);

  return { layers, loading, dirty, error, moveUp, moveDown, toggleEnabled, resetToDefaults, save };
}

// ---------------------------------------------------------------------------
// Transport color map
// ---------------------------------------------------------------------------

const TRANSPORT_COLORS: Record<SyncTransport, string> = {
  lan: '#30D158',
  nearby: '#8BCFF0',
  ble: '#A78BFA',
  wan_webrtc: '#FFB877',
  wan_relay: '#F59E0B',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransportPreferencesPage() {
  const {
    layers,
    loading,
    dirty,
    error,
    moveUp,
    moveDown,
    toggleEnabled,
    resetToDefaults,
    save,
  } = useTransportPreferences();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await save();
      setMessage('Preferences saved.');
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Transport Preferences</h1>
        <p style={styles.subtitle}>
          Rank transport layers by preference. When two devices connect, the highest mutual
          match is selected. Your ranking is saved on this device.
        </p>
      </div>

      {/* Honest note: a browser cannot open LAN / nearby / BLE transports. */}
      <div style={styles.noticeBanner}>
        <p style={styles.noticeText}>
          In a browser, only WebRTC and Encrypted Relay can actually carry sync traffic.
          LAN, Nearby, and BLE are device-only transports; the native apps use them. Your
          full ranking is still saved here so it travels with your account.
        </p>
      </div>

      {error && (
        <div style={styles.noticeBanner}>
          <p style={styles.noticeText}>
            Sync engine unavailable on this device ({error}). Preferences below show defaults
            and cannot be saved until sync starts.
          </p>
        </div>
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

      {/* Loading */}
      {loading && (
        <div style={styles.card}>
          <p style={styles.emptyText}>Loading transport preferences...</p>
        </div>
      )}

      {/* Sortable list */}
      {!loading && (
        <section style={styles.section}>
          <div style={styles.layerList}>
            {layers.map((layer, index) => {
              const accent = TRANSPORT_COLORS[layer.transport];
              return (
                <div
                  key={layer.id}
                  style={{
                    ...styles.layerCard,
                    opacity: layer.enabled ? 1 : 0.5,
                    borderLeftColor: accent,
                  }}
                >
                  {/* Rank and reorder buttons */}
                  <div style={styles.rankColumn}>
                    <span style={styles.rankNumber}>{index + 1}</span>
                    <div style={styles.arrowColumn}>
                      <button
                        style={{ ...styles.arrowButton, opacity: index > 0 ? 1 : 0.2 }}
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        aria-label="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        style={{
                          ...styles.arrowButton,
                          opacity: index < layers.length - 1 ? 1 : 0.2,
                        }}
                        onClick={() => moveDown(index)}
                        disabled={index === layers.length - 1}
                        aria-label="Move down"
                      >
                        &#9660;
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div style={styles.layerInfo}>
                    <p style={styles.layerName}>{layer.name}</p>
                    <p style={styles.layerDesc}>{layer.description}</p>
                  </div>

                  {/* Toggle */}
                  <label style={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={layer.enabled}
                      onChange={() => toggleEnabled(index)}
                      style={styles.checkbox}
                    />
                    <span
                      style={{
                        ...styles.toggleTrack,
                        backgroundColor: layer.enabled
                          ? 'var(--success, #30D158)'
                          : 'var(--surface-elevated)',
                      }}
                    >
                      <span
                        style={{
                          ...styles.toggleThumb,
                          transform: layer.enabled ? 'translateX(18px)' : 'translateX(2px)',
                        }}
                      />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Actions */}
      {!loading && (
        <section style={styles.actionRow}>
          <button style={styles.resetButton} onClick={resetToDefaults}>
            Reset to Defaults
          </button>
          <button
            style={{ ...styles.saveButton, opacity: dirty && !saving && !error ? 1 : 0.4 }}
            onClick={() => void handleSave()}
            disabled={!dirty || saving || !!error}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </section>
      )}

      {/* Info card */}
      <section style={styles.section}>
        <div style={styles.glassCard}>
          <p style={styles.infoTitle}>How ranked-choice transport works</p>
          <p style={styles.infoText}>
            Each device ranks transport layers independently. When two peers connect, the system
            intersects both preference lists and picks the highest mutual match. If no mutual
            candidate works, it falls through to the default ladder order (LAN, Nearby, BLE,
            WebRTC, Relay).
          </p>
        </div>
      </section>
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
    lineHeight: '1.5',
  },
  section: { marginBottom: '24px' },
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
  messageText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
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
  dismissButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
  },

  // Layer list
  layerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  layerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: 'var(--surface)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--border)',
    padding: '16px 20px',
    transition: 'opacity 0.15s',
  },
  rankColumn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  rankNumber: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    width: '24px',
    textAlign: 'center' as const,
  },
  arrowColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  arrowButton: {
    width: '24px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'opacity 0.1s',
    padding: 0,
  },
  layerInfo: {
    flex: 1,
    minWidth: 0,
  },
  layerName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  layerDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
    lineHeight: '1.4',
  },

  // Toggle
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

  // Actions
  actionRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginBottom: '32px',
  },
  resetButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  saveButton: {
    padding: '8px 20px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    backgroundColor: '#FFB877',
    color: '#131318',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },

  // Glass info card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.10)',
    padding: '20px',
    backdropFilter: 'blur(60px) saturate(200%)',
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 8px 0',
  },
  infoText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
};
