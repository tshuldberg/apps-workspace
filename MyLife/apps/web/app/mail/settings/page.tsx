'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchAccountsAction, fetchNotificationPreferencesAction,
  upsertNotificationPreferencesAction, fetchEncryptionKeysAction,
  fetchSyncStatesAction,
} from '../actions';
import { getSyncStatusLabel, MAIL_COLORS as C } from '../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER } = C;

interface NotifPrefs {
  enabled: boolean; quietStart: string | null; quietEnd: string | null;
  vipOnly: boolean; showPreview: boolean; sound: string;
}
interface EncKey { id: string; keyType: string; fingerprint: string; isOwnKey: boolean; isRevoked: boolean }
interface SyncState { folder: string; status: string; lastSyncAt: string | null; errorMessage: string | null }
interface Account { id: string; email: string }

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [keys, setKeys] = useState<EncKey[]>([]);
  const [syncStates, setSyncStates] = useState<SyncState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accts = await fetchAccountsAction();
      setAccounts(accts as Account[]);
      if (accts.length === 0) return;
      const acctId = accts[0].id;
      const [notifPrefs, encKeys, syncs] = await Promise.all([
        fetchNotificationPreferencesAction(acctId),
        fetchEncryptionKeysAction(acctId),
        fetchSyncStatesAction(acctId),
      ]);
      setPrefs(notifPrefs as NotifPrefs | null);
      setKeys(encKeys as EncKey[]);
      setSyncStates(syncs as SyncState[]);
    } catch {
      setError('Could not load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const updatePref = useCallback(async (update: Partial<NotifPrefs>) => {
    if (accounts.length === 0) return;
    try {
      setSaving(true);
      await upsertNotificationPreferencesAction(accounts[0].id, update);
      setPrefs((prev) => prev ? { ...prev, ...update } : null);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }, [accounts]);

  if (loading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: TEXT, marginBottom: 24 }}>Mail Settings</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 80, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16, opacity: 0.6 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px 32px', textAlign: 'center' }}>
        <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
        <button type="button" onClick={() => void loadSettings()} style={{
          marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
          color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
        }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', height: '100vh', overflowY: 'auto', maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: TEXT }}>Mail Settings</h1>

      {/* Notifications */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, marginBottom: 12 }}>Notifications</h2>
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: TEXT }}>Notifications</span>
            <button type="button" onClick={() => void updatePref({ enabled: !(prefs?.enabled ?? true) })} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              backgroundColor: prefs?.enabled ? ACCENT : 'rgba(255,255,255,0.1)', position: 'relative',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: prefs?.enabled ? 23 : 3,
                width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 0.15s',
              }} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: TEXT }}>VIP Only</span>
            <button type="button" onClick={() => void updatePref({ vipOnly: !(prefs?.vipOnly ?? false) })} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              backgroundColor: prefs?.vipOnly ? ACCENT : 'rgba(255,255,255,0.1)', position: 'relative',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: prefs?.vipOnly ? 23 : 3,
                width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 0.15s',
              }} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: TEXT }}>Show Preview</span>
            <button type="button" onClick={() => void updatePref({ showPreview: !(prefs?.showPreview ?? true) })} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              backgroundColor: prefs?.showPreview !== false ? ACCENT : 'rgba(255,255,255,0.1)', position: 'relative',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: prefs?.showPreview !== false ? 23 : 3,
                width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 0.15s',
              }} />
            </button>
          </div>
        </div>
      </section>

      {/* Encryption */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, marginBottom: 12 }}>Encryption</h2>
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
          {keys.length === 0 ? (
            <p style={{ fontSize: 14, color: TEXT_SEC }}>No encryption keys configured</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {keys.map((k) => (
                <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 14, color: TEXT }}>{k.keyType.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: TEXT_TERT, marginLeft: 8 }}>{k.fingerprint.slice(0, 16)}...</span>
                  </div>
                  <span style={{ fontSize: 12, color: k.isRevoked ? '#FF453A' : k.isOwnKey ? ACCENT : TEXT_SEC }}>
                    {k.isRevoked ? 'Revoked' : k.isOwnKey ? 'Your Key' : 'Contact Key'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sync */}
      <section>
        <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, marginBottom: 12 }}>Sync Status</h2>
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
          {syncStates.length === 0 ? (
            <p style={{ fontSize: 14, color: TEXT_SEC }}>No sync data available</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {syncStates.map((s) => (
                <div key={s.folder} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: TEXT }}>{s.folder}</span>
                  <span style={{ fontSize: 12, color: s.status === 'error' ? '#FF453A' : TEXT_TERT }}>
                    {getSyncStatusLabel(s.status)}
                    {s.lastSyncAt ? `, last ${new Date(s.lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {saving && <p style={{ fontSize: 12, color: ACCENT, marginTop: 16 }}>Saving...</p>}
    </div>
  );
}
