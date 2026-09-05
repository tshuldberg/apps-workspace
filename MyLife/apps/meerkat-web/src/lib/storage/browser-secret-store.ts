// BrowserSecretStore: a SYNCHRONOUS SyncSecretStore backed by IndexedDB +
// WebCrypto, the web analog of the native expo-secure-store wiring in
// apps/meerkat/app/(root)/data/meerkat-db.ts (ensureNativeSyncSecretStore).
//
// SyncSecretStore is synchronous (getSecret/setSecret/deleteSecret) but
// persistence is async, so we resolve it the same way the native app does: at
// boot, async-load + decrypt the whole secret map into an in-memory Map; serve
// the sync interface from the Map; persist (encrypt) back to IndexedDB in the
// background (debounced).
//
// Key management (chosen tradeoff, documented per the brief): on first boot we
// generate a NON-EXTRACTABLE AES-GCM-256 CryptoKey and store the CryptoKey
// OBJECT itself in IndexedDB (structured clone preserves non-extractable keys;
// the raw bytes never leave the browser and cannot be exported). On later boots
// we read it back. This avoids any passphrase UX prompt, binds the key to the
// origin, and keeps it non-extractable. The alternative (PBKDF2 from a user
// passphrase) is heavier and adds a prompt; it is the right move only once we
// need cross-device key portability, which Phase 1A does not.
//
// Concurrency invariants (hardened 2026-08-30 after six reproductions of the
// key-vs-vault race):
//  1. Key create-if-absent runs under the SAME lock discipline as vault writes
//     (in-process mutex + origin-scoped Web Lock), so concurrent first boots
//     (StrictMode double-mount, a second tab) can never mint two wrapping keys.
//  2. Every vault record is stamped with the id of the key that encrypted it,
//     so a key-vs-vault mismatch (a site-data wipe racing a live instance) is
//     DETECTED deterministically instead of surfacing as a raw OperationError.
//  3. A failed background persist retries with exponential backoff and surfaces
//     an honest persist-failure state; it never hot-loops. A mismatch found at
//     persist time is FATAL (the base vault belongs to another key; overwriting
//     it would destroy that session's secrets) and is surfaced, not retried.

import {
  type SyncSecretStore,
} from '@mylife/sync';
import { STORE_SECRETS, idbGet, idbPutMany } from './idb';

const VAULT_KEY = 'vault';
/** Web Lock name serializing every vault/key read-modify-write across tabs. */
const VAULT_LOCK = 'meerkat-secret-vault';
const CRYPTO_KEY_KEY = 'wrapping-key';
const AES_GCM = 'AES-GCM';
const IV_BYTES = 12;
/** Base delay for the persist retry backoff (doubles per consecutive failure). */
const PERSIST_RETRY_BASE_MS = 500;
/** Ceiling for the persist retry backoff. */
const PERSIST_RETRY_MAX_MS = 30_000;
/** Consecutive transient failures before the honest persist-failure surface shows. */
const PERSIST_FAILURE_SURFACE_AFTER = 1;
const MAX_PERSIST_ATTEMPTS = 4;

interface EncryptedVault {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  /** Id of the wrapping key that encrypted this vault (absent on legacy vaults). */
  keyId?: string;
}

/** Stored wrapping-key record. Legacy installs stored the bare CryptoKey. */
interface WrappingKeyRecord {
  key: CryptoKey;
  id: string;
}

/**
 * The vault exists but cannot be read by this browser's wrapping key, or an
 * identity row survived while its signing key did not. Boot surfaces this as an
 * honest recovery screen instead of a raw OperationError or a silent wall.
 */
export class SecretVaultUnreadableError extends Error {
  readonly reason: 'key_mismatch' | 'decrypt_failed' | 'signing_key_missing';

  constructor(reason: 'key_mismatch' | 'decrypt_failed' | 'signing_key_missing', message: string) {
    super(message);
    this.name = 'SecretVaultUnreadableError';
    this.reason = reason;
  }
}

/**
 * Copy any typed array into a fresh Uint8Array backed by a plain ArrayBuffer.
 * Structured-cloned arrays read back from IndexedDB can be typed as
 * Uint8Array<ArrayBufferLike>, which the DOM BufferSource type rejects under
 * the TS 5.7 typed-array generics; this normalizes them.
 */
function toBufferSource(view: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(view.length);
  copy.set(view);
  return copy;
}

export interface BrowserSecretStore extends SyncSecretStore {
  /**
   * Force a synchronous-state -> encrypted IndexedDB flush now. Rejects when
   * the flush attempt failed, so durability-critical callers (MK-001 identity
   * creation) fail loudly instead of pretending the keys are on disk.
   */
  flush(): Promise<void>;
  retryPersistence(): Promise<void>;
  /** Cancel any pending background persist (used on teardown / node reset). */
  close(): void;
  /** Honest persist health: null when persistence is working, else a user-readable failure line. */
  getPersistFailure(): string | null;
  /** Subscribe to persist-failure changes; returns unsubscribe. */
  subscribePersistFailure(listener: () => void): () => void;
}

export interface BrowserSecretStoreOptions {
  /** Debounce window for background persistence in ms (default 250). */
  persistDebounceMs?: number;
  /** Override the WebCrypto SubtleCrypto (defaults to globalThis.crypto.subtle). */
  subtle?: SubtleCrypto;
}

function getSubtle(override?: SubtleCrypto): SubtleCrypto {
  const subtle = override ?? globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto SubtleCrypto is not available in this environment');
  }
  return subtle;
}

/**
 * Serialize the tail of every vault/key read-modify-write within this JS realm.
 * Web Locks cover cross-tab exclusion, but are unavailable in some engines and
 * in the Node test environment; this in-process chain guarantees the
 * single-wrapping-key property for same-realm concurrency (StrictMode double
 * mount) even without them.
 */
let vaultMutexTail: Promise<unknown> = Promise.resolve();

function withVaultLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const locks = (globalThis.navigator as { locks?: LockManager } | undefined)?.locks;
    if (!locks?.request) return fn();
    return locks.request(VAULT_LOCK, fn) as Promise<T>;
  };
  const next = vaultMutexTail.then(run, run);
  vaultMutexTail = next.catch(() => undefined);
  return next;
}

function randomKeyId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Load or create the wrapping key UNDER the vault lock (invariant 1). Legacy
 * records (a bare CryptoKey) are upgraded in place with a fresh id so mismatch
 * detection works from the next persist on.
 */
function isWrappingKeyRecord(value: unknown): value is WrappingKeyRecord {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { id?: unknown }).id === 'string'
    && 'key' in value
  );
}

async function loadOrCreateKeyLocked(subtle: SubtleCrypto): Promise<WrappingKeyRecord> {
  const existing = await idbGet<CryptoKey | WrappingKeyRecord>(STORE_SECRETS, CRYPTO_KEY_KEY);
  if (existing) {
    if (isWrappingKeyRecord(existing)) return existing;
    // Legacy record: the bare CryptoKey. Upgrade in place with a fresh id.
    const upgraded: WrappingKeyRecord = { key: existing, id: randomKeyId() };
    await idbPutMany(STORE_SECRETS, [[CRYPTO_KEY_KEY, upgraded]]);
    return upgraded;
  }
  const key = await subtle.generateKey(
    { name: AES_GCM, length: 256 },
    false, // non-extractable: the raw key can never leave the browser
    ['encrypt', 'decrypt'],
  );
  const record: WrappingKeyRecord = { key, id: randomKeyId() };
  await idbPutMany(STORE_SECRETS, [[CRYPTO_KEY_KEY, record]]);
  return record;
}

async function decryptVault(
  subtle: SubtleCrypto,
  key: CryptoKey,
  vault: EncryptedVault | undefined,
): Promise<Map<string, string>> {
  if (!vault) return new Map();
  const iv = toBufferSource(
    vault.iv instanceof Uint8Array ? vault.iv : new Uint8Array(vault.iv),
  );
  const ciphertext = toBufferSource(
    vault.ciphertext instanceof Uint8Array ? vault.ciphertext : new Uint8Array(vault.ciphertext),
  );
  const plaintext = await subtle.decrypt({ name: AES_GCM, iv }, key, ciphertext);
  const json = new TextDecoder().decode(plaintext);
  const parsed = JSON.parse(json) as Record<string, string>;
  return new Map(Object.entries(parsed));
}

/** True when the stored vault provably belongs to a different wrapping key. */
function vaultKeyMismatch(vault: EncryptedVault | undefined, keyId: string): boolean {
  return Boolean(vault && typeof vault.keyId === 'string' && vault.keyId !== keyId);
}

export async function createBrowserSecretStore(
  options: BrowserSecretStoreOptions = {},
): Promise<BrowserSecretStore> {
  const subtle = getSubtle(options.subtle);
  const debounceMs = options.persistDebounceMs ?? 250;

  // Boot read: key load/create, vault read, and decrypt all under ONE lock
  // acquisition so a concurrent instance's persist cannot interleave.
  const { key, keyId, map } = await withVaultLock(async () => {
    const keyRecord = await loadOrCreateKeyLocked(subtle);
    const storedVault = await idbGet<EncryptedVault>(STORE_SECRETS, VAULT_KEY);
    if (vaultKeyMismatch(storedVault, keyRecord.id)) {
      throw new SecretVaultUnreadableError(
        'key_mismatch',
        'The encrypted key vault in this browser was written by a different encryption key than the one stored here, so it cannot be read.',
      );
    }
    try {
      const decrypted = await decryptVault(subtle, keyRecord.key, storedVault);
      return { key: keyRecord.key, keyId: keyRecord.id, map: decrypted };
    } catch (error) {
      if (error instanceof SecretVaultUnreadableError) throw error;
      throw new SecretVaultUnreadableError(
        'decrypt_failed',
        'The encrypted key vault in this browser could not be decrypted with the key stored here.',
      );
    }
  });

  let closed = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let consecutiveFailures = 0;
  let persistFailure: string | null = null;
  /** Set when the stored vault no longer belongs to our key: retrying can never succeed. */
  let fatal = false;
  let lastPersistError: Error | null = null;
  const failureListeners = new Set<() => void>();
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (!dirty && !inFlight) return;
    event.preventDefault();
    event.returnValue = '';
  };
  globalThis.addEventListener?.('beforeunload', beforeUnload);

  /** Keys this tab has explicitly written or deleted; the merge authority set. */
  const localWrites = new Set<string>();
  const localDeletes = new Set<string>();

  function setPersistFailure(next: string | null): void {
    if (persistFailure === next) return;
    persistFailure = next;
    for (const listener of failureListeners) listener();
  }

  function scheduleRetry(): void {
    if (timer || fatal || closed || consecutiveFailures >= MAX_PERSIST_ATTEMPTS) return;
    const exponent = Math.min(consecutiveFailures - 1, 6);
    const delay = Math.min(PERSIST_RETRY_MAX_MS, PERSIST_RETRY_BASE_MS * 2 ** exponent);
    timer = setTimeout(() => {
      timer = null;
      void persistNow().catch(() => undefined);
    }, delay);
  }

  async function persistNow(): Promise<void> {
    // Bounded loop: re-runs only for NEW writes that landed during a successful
    // persist. A failure schedules a backed-off retry and returns instead.
    for (;;) {
      if (inFlight) await inFlight;
      if (!dirty || fatal || closed) return;
      if (consecutiveFailures >= MAX_PERSIST_ATTEMPTS) return;
      dirty = false;
      let failed = false;
      // Snapshot THIS round's write authority and clear the live sets, so
      // writes landing during the async persist keep their own authority for
      // the next round. On failure the snapshot is restored (minus anything
      // the session re-touched since), so a failed persist can never silently
      // drop this tab's pending writes.
      const writesSnapshot = new Set(localWrites);
      const deletesSnapshot = new Set(localDeletes);
      localWrites.clear();
      localDeletes.clear();
      inFlight = withVaultLock(async () => {
        // MERGE, never clobber (multi-tab durability fix, 2026-08-30). The vault is
        // ONE IndexedDB record holding every secret, and each tab holds its own
        // in-memory map. Writing our whole map wholesale silently destroys keys a
        // CONCURRENT TAB wrote, which orphans a device identity: the SQLite
        // identity row survives while its signing key vanishes, and the app can
        // then sign nothing ("Sync signing private key is unavailable in secure
        // storage") with no way back. So: re-read under the lock, take the stored
        // value as the base, and apply only THIS tab's explicit writes/deletes on
        // top. A key another tab added that we never touched is preserved.
        const storedVault = await idbGet<EncryptedVault>(STORE_SECRETS, VAULT_KEY);
        if (vaultKeyMismatch(storedVault, keyId)) {
          // Another session re-keyed the vault (a wipe raced this instance).
          // Overwriting it would destroy THAT session's secrets, and we can
          // never merge into ciphertext we cannot read: fatal, surface honestly.
          fatal = true;
          throw new SecretVaultUnreadableError(
            'key_mismatch',
            'Browser storage was reset while Meerkat was running, so keys made in this session can no longer be saved.',
          );
        }
        let base: Map<string, string>;
        try {
          base = await decryptVault(subtle, key, storedVault);
        } catch {
          fatal = true;
          throw new SecretVaultUnreadableError(
            'decrypt_failed',
            'The stored key vault became unreadable while Meerkat was running, so keys made in this session can no longer be saved.',
          );
        }
        for (const ref of writesSnapshot) {
          const value = map.get(ref);
          if (value !== undefined) base.set(ref, value);
        }
        for (const ref of deletesSnapshot) base.delete(ref);
        // Adopt the merged view so this tab sees the other tab's keys too.
        // Never override a key this session deleted since the snapshot, or one
        // it has a PENDING write for (a setSecret that landed while this round
        // was in flight): the newer in-memory value must win and will persist
        // on the next authority round, not be reverted to the stale base.
        for (const [k, v] of base) {
          if (deletesSnapshot.has(k) || localDeletes.has(k) || localWrites.has(k)) continue;
          map.set(k, v);
        }

        const json = JSON.stringify(Object.fromEntries(base));
        const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
        const ciphertext = new Uint8Array(
          await subtle.encrypt({ name: AES_GCM, iv }, key, new TextEncoder().encode(json)),
        );
        const vault: EncryptedVault = { iv, ciphertext, keyId };
        // Write the vault AND re-assert the wrapping-key record in one
        // transaction, so a wipe that raced us leaves key + vault consistent
        // (both restored together) rather than a vault no stored key can open.
        await idbPutMany(STORE_SECRETS, [
          [VAULT_KEY, vault],
          [CRYPTO_KEY_KEY, { key, id: keyId } satisfies WrappingKeyRecord],
        ]);
      })
        .catch((err) => {
          failed = true;
          dirty = true;
          // Restore this round's write authority (unless the session re-touched
          // the ref since, in which case the newer intent wins).
          for (const ref of writesSnapshot) {
            if (!localDeletes.has(ref)) localWrites.add(ref);
          }
          for (const ref of deletesSnapshot) {
            if (!localWrites.has(ref)) localDeletes.add(ref);
          }
          lastPersistError = err instanceof Error ? err : new Error(String(err));
          console.warn('[BrowserSecretStore] persist failed', err);
        })
        .finally(() => {
          inFlight = null;
        });
      await inFlight;
      if (failed) {
        if (fatal) {
          setPersistFailure(
            lastPersistError instanceof SecretVaultUnreadableError
              ? lastPersistError.message
              : 'Keys made in this session can no longer be saved to browser storage.',
          );
          return;
        }
        consecutiveFailures += 1;
        if (consecutiveFailures >= PERSIST_FAILURE_SURFACE_AFTER) {
          setPersistFailure(
            'Meerkat cannot save its encrypted keys to browser storage right now. Automatic retries stop after four failures. Keep this tab open and retry saving after freeing browser storage; unsaved keys and pairings exist only in memory.',
          );
        }
        scheduleRetry();
        return;
      }
      consecutiveFailures = 0;
      lastPersistError = null;
      setPersistFailure(null);
      if (!dirty) return;
      // dirty was re-set by writes that landed during the persist: loop again.
    }
  }

  function schedulePersist(): void {
    dirty = true;
    if (timer || fatal || closed || consecutiveFailures >= MAX_PERSIST_ATTEMPTS) return;
    timer = setTimeout(() => {
      timer = null;
      void persistNow().catch(() => undefined);
    }, debounceMs);
  }

  return {
    getSecret(ref: string): string | null {
      return map.get(ref) ?? null;
    },
    setSecret(ref: string, value: string): void {
      if (closed) throw new Error('Secret store is closed');
      map.set(ref, value);
      localWrites.add(ref);
      localDeletes.delete(ref);
      schedulePersist();
    },
    deleteSecret(ref: string): void {
      if (closed) throw new Error('Secret store is closed');
      map.delete(ref);
      localDeletes.add(ref);
      localWrites.delete(ref);
      schedulePersist();
    },
    async flush(): Promise<void> {
      if (closed) throw new Error('Secret store is closed');
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      dirty = true;
      await persistNow();
      if (dirty && lastPersistError) {
        // The flush attempt failed: durability-critical callers must know.
        throw lastPersistError;
      }
    },
    async retryPersistence(): Promise<void> {
      if (closed) throw new Error('Secret store is closed');
      if (fatal) throw lastPersistError ?? new Error('Secret vault cannot be recovered by retrying');
      if (inFlight) await inFlight;
      consecutiveFailures = 0;
      if (timer) { clearTimeout(timer); timer = null; }
      await persistNow();
      if (dirty && lastPersistError) throw lastPersistError;
    },
    close(): void {
      closed = true;
      globalThis.removeEventListener?.('beforeunload', beforeUnload);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      dirty = false;
    },
    getPersistFailure(): string | null {
      return persistFailure;
    },
    subscribePersistFailure(listener: () => void): () => void {
      failureListeners.add(listener);
      return () => {
        failureListeners.delete(listener);
      };
    },
  };
}
