/** Held for the complete lifetime of a SQLite image, including its final flush. */
export const DATABASE_WRITER_LOCK = 'meerkat-web:sqlite:db:writer';

export class DatabaseOwnershipError extends Error {
  constructor(readonly reason: 'busy' | 'unsupported') {
    super(reason === 'busy'
      ? 'Meerkat is open in another tab. This tab cannot read or change your data. Wait for that tab to finish saving, close it, then choose Open here.'
      : 'This browser cannot safely coordinate Meerkat storage. Open Meerkat in a browser with Web Locks support over HTTPS. No database was opened.');
    this.name = 'DatabaseOwnershipError';
  }
}

export function acquireDatabaseWriter(lockName = DATABASE_WRITER_LOCK): Promise<() => Promise<void>> {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return Promise.reject(new DatabaseOwnershipError('unsupported'));
  return new Promise((resolve, reject) => {
    const request = locks.request(lockName, { ifAvailable: true }, async (lock) => {
      if (!lock) { reject(new DatabaseOwnershipError('busy')); return; }
      await new Promise<void>((release) => resolve(async () => {
        release();
        await request;
      }));
    }).catch(reject);
  });
}
