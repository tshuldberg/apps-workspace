'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAccountsAction, createFilterAction } from '../../actions';
import { MAIL_COLORS as C } from '../../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, surface: SURFACE, border: BORDER, glassStrong: GLASS_STRONG } = C;

const FIELDS = ['from', 'to', 'subject', 'body'] as const;
const ACTIONS = ['move', 'star', 'mark_read', 'delete'] as const;

export default function FilterEditPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [field, setField] = useState<string>('from');
  const [pattern, setPattern] = useState('');
  const [action, setAction] = useState<string>('move');
  const [actionValue, setActionValue] = useState('');
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !pattern.trim()) {
      setError('Name and pattern are required.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const accounts = await fetchAccountsAction();
      if (accounts.length === 0) { setError('No accounts configured.'); return; }
      await createFilterAction({
        accountId: accounts[0].id,
        name: name.trim(),
        field,
        pattern: pattern.trim(),
        action,
        actionValue: actionValue.trim() || undefined,
        priority,
      });
      router.push('/mail/filters');
    } catch {
      setError('Failed to save filter. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, field, pattern, action, actionValue, priority, router]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 600 }}>
      <button type="button" onClick={() => router.back()} style={{
        background: 'none', border: 'none', color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
      }}>Back to Filters</button>

      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: TEXT }}>New Filter</h1>

      {error && <p style={{ color: '#FF453A', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Filter Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Newsletter Mover" style={{
            padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
            color: TEXT, fontSize: 14, outline: 'none',
          }} />
        </label>

        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Field</span>
            <select value={field} onChange={(e) => setField(e.target.value)} style={{
              padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              color: TEXT, fontSize: 14,
            }}>
              {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Pattern</span>
            <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="*@newsletter.com" style={{
              padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              color: TEXT, fontSize: 14, outline: 'none', fontFamily: 'monospace',
            }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Action</span>
            <select value={action} onChange={(e) => setAction(e.target.value)} style={{
              padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              color: TEXT, fontSize: 14,
            }}>
              {ACTIONS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
            </select>
          </label>
          {action === 'move' && (
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Move to Folder</span>
              <input value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="Archive" style={{
                padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
                color: TEXT, fontSize: 14, outline: 'none',
              }} />
            </label>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>Priority (lower runs first)</span>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} min={0} max={99} style={{
            padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
            color: TEXT, fontSize: 14, outline: 'none', width: 100,
          }} />
        </label>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" onClick={() => void handleSave()} disabled={saving} style={{
            padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT,
            color: '#fff', fontWeight: 700, fontSize: 14, border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving...' : 'Save Filter'}</button>
          <button type="button" onClick={() => router.back()} style={{
            padding: '10px 20px', borderRadius: 8, backgroundColor: GLASS_STRONG,
            border: `1px solid ${BORDER}`, color: TEXT_SEC, fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
