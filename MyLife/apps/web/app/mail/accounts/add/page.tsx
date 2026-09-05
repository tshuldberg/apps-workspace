'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createAccountAction, autoDiscoverConfigAction } from '../../actions';
import { MAIL_COLORS as C } from '../../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, surface: SURFACE, border: BORDER, glassStrong: GLASS_STRONG } = C;
const ACCOUNT_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function AddAccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState(993);
  const [selectedColor, setSelectedColor] = useState(ACCOUNT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);

  const handleDiscover = useCallback(async () => {
    if (!email.includes('@')) { setError('Enter a valid email address first.'); return; }
    try {
      setDiscovering(true);
      setError(null);
      const config = await autoDiscoverConfigAction(email);
      if (config) {
        const c = config as { imapHost?: string; imapPort?: number };
        if (c.imapHost) setServerHost(c.imapHost);
        if (c.imapPort) setServerPort(c.imapPort);
      }
    } catch {
      setError('Auto-discover failed. Enter settings manually.');
    } finally {
      setDiscovering(false);
    }
  }, [email]);

  const handleSave = useCallback(async () => {
    if (!email.includes('@') || !displayName.trim() || !serverHost.trim()) {
      setError('Email, display name, and server host are required.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await createAccountAction({
        email,
        displayName: displayName.trim(),
        serverHost: serverHost.trim(),
        serverPort,
      });
      router.push('/mail/accounts');
    } catch {
      setError('Failed to create account. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [email, displayName, serverHost, serverPort, router]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 560 }}>
      <button type="button" onClick={() => router.back()} style={{
        background: 'none', border: 'none', color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
      }}>Back to Accounts</button>

      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: TEXT }}>Add Email Account</h1>

      {error && <p style={{ color: '#FF453A', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Email Address</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              color: TEXT, fontSize: 14, outline: 'none',
            }} />
            <button type="button" onClick={() => void handleDiscover()} disabled={discovering} style={{
              padding: '10px 14px', borderRadius: 8, backgroundColor: GLASS_STRONG, border: `1px solid ${BORDER}`,
              color: TEXT_SEC, fontSize: 13, fontWeight: 600, cursor: discovering ? 'not-allowed' : 'pointer',
            }}>{discovering ? 'Detecting...' : 'Auto-Discover'}</button>
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Display Name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your Name" style={{
            padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
            color: TEXT, fontSize: 14, outline: 'none',
          }} />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Account Color</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {ACCOUNT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setSelectedColor(c)} style={{
                width: 28, height: 28, borderRadius: 999, backgroundColor: c, border: selectedColor === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>IMAP Server Host</span>
            <input value={serverHost} onChange={(e) => setServerHost(e.target.value)} placeholder="imap.example.com" style={{
              padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              color: TEXT, fontSize: 14, outline: 'none',
            }} />
          </label>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Port</span>
            <input type="number" value={serverPort} onChange={(e) => setServerPort(Number(e.target.value))} style={{
              padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              color: TEXT, fontSize: 14, outline: 'none',
            }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" onClick={() => void handleSave()} disabled={saving} style={{
            padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT,
            color: '#fff', fontWeight: 700, fontSize: 14, border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving...' : 'Save Account'}</button>
          <button type="button" onClick={() => router.back()} style={{
            padding: '10px 20px', borderRadius: 8, backgroundColor: GLASS_STRONG,
            border: `1px solid ${BORDER}`, color: TEXT_SEC, fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
