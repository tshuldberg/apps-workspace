import type { DatabaseAdapter } from '@mylife/db';

const listeners = new Set<() => void>();
export function subscribeInvitationIntent(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const PENDING_INVITATION_KEY = 'pending_community_invitation';
export const INVITATION_SAVED_COPY = 'Your invitation is saved on this device. After setup and unlock, return here to preview it. Joining still requires your confirmation.';

/** Device-local intent only. This does not verify, join, contact a server or grant access. */
export function saveInvitationIntent(db: DatabaseAdapter, link: string): boolean {
  const value = link.trim();
  if (value.length > 256 * 1024 || !value.startsWith('meerkat://community/join#')) return false;
  db.execute('INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)', [PENDING_INVITATION_KEY, value]);
  for (const listener of listeners) listener();
  return true;
}

export function getInvitationIntent(db: DatabaseAdapter): string | null {
  const value = db.query<{ value: string }>('SELECT value FROM mk_settings WHERE key = ?', [PENDING_INVITATION_KEY])[0]?.value;
  return value && value.length <= 256 * 1024 && value.startsWith('meerkat://community/join#') ? value : null;
}

/** Compare before clearing: finishing an older sheet must not discard a newer invitation. */
export function clearInvitationIntent(db: DatabaseAdapter, link: string): void {
  db.execute('DELETE FROM mk_settings WHERE key = ? AND value = ?', [PENDING_INVITATION_KEY, link]);
  for (const listener of listeners) listener();
}
