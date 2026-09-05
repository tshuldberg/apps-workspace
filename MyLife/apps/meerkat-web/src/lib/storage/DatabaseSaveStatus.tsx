import { useState, useSyncExternalStore } from 'react';
import type { BrowserDatabaseAdapter } from './browser-database-adapter';

export function DatabaseSaveStatus({ db }: { db: BrowserDatabaseAdapter }) {
  const state = useSyncExternalStore(db.subscribePersistence, db.getPersistenceState);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  if (!state.pending) return null;
  const failed = state.status === 'retrying' || state.status === 'unsaved';
  const exportPending = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    let url: string | undefined;
    try {
      const bytes = await db.export();
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/x-sqlite3' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'meerkat-unsaved.sqlite';
      link.click();
    } catch {
      setExportError('Could not prepare the recovery download. Keep this tab open and try exporting again.');
    } finally {
      if (url) { const downloadUrl = url; setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
      setExporting(false);
    }
  };
  return (
    <aside role={failed ? 'alert' : 'status'} style={{ position: 'fixed', bottom: 72, left: 8, right: 8, zIndex: 1100, padding: 12, background: 'var(--mk-bg, #17221d)', color: 'var(--mk-text, #f1f5f2)', fontFamily: 'system-ui, sans-serif', border: '1px solid currentColor' }}>
      {failed
        ? 'Changes are not saved to this browser. Keep this tab open. Free browser storage, then retry.'
        : 'Saving changes to this browser. Keep this tab open until saving finishes.'}
      {state.status === 'retrying' && <p>Retrying with a delay. Automatic retries stop after four failed attempts.</p>}
      {state.status === 'unsaved' && <p>Automatic retries stopped. Pending changes remain in this tab.</p>}
      {failed && <>
        <button onClick={() => { void db.retryPersistence().catch(() => undefined); }}>Retry save</button>
        <p>Recovery export contains unencrypted local messages. Keep it private. It does not include keys or attachments and is not a complete backup.</p>
        <button disabled={exporting} onClick={() => { void exportPending(); }}>{exporting ? 'Preparing recovery download…' : 'Export pending database'}</button>
        {exportError && <p>{exportError}</p>}
      </>}
    </aside>
  );
}
