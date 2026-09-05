import type { DatabaseAdapter } from '@mylife/db';
import { getSetting } from './db';
import { APP_UNLOCK_RECEIPT_KEY } from './app-unlock-keys';

const listeners = new Set<() => void>();

export function isMobileAppUnlocked(db: DatabaseAdapter): boolean {
  return getSetting(db, APP_UNLOCK_RECEIPT_KEY) === 'unlocked';
}

export function notifyMobileAppUnlockChanged(): void {
  for (const listener of listeners) listener();
}

export function subscribeMobileAppUnlockChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
