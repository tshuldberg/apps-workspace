'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchAccountsAction, fetchFoldersAction, fetchMailStatsAction, createFolderAction } from '../actions';
import { MAIL_COLORS as C } from '../ui';

const { accent: ACCENT, accentDim: ACCENT_DIM, accentBorder: ACCENT_BORDER, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS } = C;

const SYSTEM_ICONS: Record<string, string> = {
  Inbox: '📥', Sent: '📤', Drafts: '📝', Starred: '⭐', Trash: '🗑️', Spam: '⚠️',
};

interface Folder { id: string; name: string; icon: string | null; sortOrder: number; isSystem: boolean }
interface FolderStats { folder: string; total: number; unread: number }

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<FolderStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accounts = await fetchAccountsAction();
      if (accounts.length === 0) { setFolders([]); return; }
      const acctId = accounts[0].id;
      setAccountId(acctId);
      const [f, s] = await Promise.all([
        fetchFoldersAction(acctId),
        fetchMailStatsAction(acctId),
      ]);
      setFolders(f as Folder[]);
      setStats((s as { byFolder: FolderStats[] }).byFolder);
    } catch {
      setError('Could not load folders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFolders(); }, [loadFolders]);

  const handleCreate = useCallback(async () => {
    if (!newFolderName.trim() || !accountId) return;
    try {
      setCreating(true);
      await createFolderAction({ accountId, name: newFolderName.trim() });
      setNewFolderName('');
      void loadFolders();
    } catch { /* silent */ } finally {
      setCreating(false);
    }
  }, [newFolderName, accountId, loadFolders]);

  const getFolderStats = (name: string) => stats.find((s) => s.folder === name);

  return (
    <div style={{ padding: '24px 32px', height: '100vh', overflowY: 'auto' }}>
      <div style={{
        padding: 24, borderRadius: 16, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>Folders</h1>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>Organize your messages</p>
        </div>
      </div>

      {/* Create folder */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
          placeholder="New folder name..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8, backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`, color: TEXT, fontSize: 14, outline: 'none',
          }}
        />
        <button type="button" onClick={() => void handleCreate()} disabled={creating || !newFolderName.trim()} style={{
          padding: '10px 16px', borderRadius: 8, backgroundColor: ACCENT, color: '#fff',
          fontWeight: 700, fontSize: 14, border: 'none',
          cursor: creating || !newFolderName.trim() ? 'not-allowed' : 'pointer',
          opacity: creating || !newFolderName.trim() ? 0.5 : 1,
        }}>{creating ? 'Creating...' : '+ Create'}</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ height: 48, borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, opacity: 0.6 }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
          <button type="button" onClick={() => void loadFolders()} style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
            color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
          }}>Retry</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* System folders */}
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, margin: '8px 0 4px' }}>System Folders</div>
          {['Inbox', 'Sent', 'Drafts', 'Starred', 'Trash', 'Spam'].map((name) => {
            const folderStats = getFolderStats(name);
            return (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              }}>
                <span style={{ width: 24, textAlign: 'center', fontSize: 16 }}>{SYSTEM_ICONS[name] ?? '📁'}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: TEXT }}>{name}</span>
                {folderStats && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: TEXT_TERT }}>
                    <span>{folderStats.total} total</span>
                    {folderStats.unread > 0 && <span style={{ color: ACCENT, fontWeight: 600 }}>{folderStats.unread} unread</span>}
                  </div>
                )}
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: GLASS, color: TEXT_TERT }}>System</span>
              </div>
            );
          })}

          {/* Custom folders */}
          {folders.filter((f) => !f.isSystem).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, margin: '16px 0 4px' }}>Custom Folders</div>
              {folders.filter((f) => !f.isSystem).map((f) => {
                const folderStats = getFolderStats(f.name);
                return (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
                  }}>
                    <span style={{ width: 24, textAlign: 'center', fontSize: 16 }}>{f.icon ?? '📁'}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: TEXT }}>{f.name}</span>
                    {folderStats && (
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: TEXT_TERT }}>
                        <span>{folderStats.total} total</span>
                        {folderStats.unread > 0 && <span style={{ color: ACCENT, fontWeight: 600 }}>{folderStats.unread} unread</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
