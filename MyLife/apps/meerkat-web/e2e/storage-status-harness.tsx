import { createRoot } from 'react-dom/client';
import { DatabaseSaveStatus } from '../src/lib/storage/DatabaseSaveStatus';
import type { BrowserDatabaseAdapter } from '../src/lib/storage/browser-database-adapter';

export function showDatabaseStatus(db: BrowserDatabaseAdapter): void {
  const root = document.createElement('div');
  document.body.append(root);
  createRoot(root).render(<DatabaseSaveStatus db={db} />);
}
