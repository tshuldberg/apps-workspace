import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDeviceIdentitySecretRef,
  createSharedSecretRef,
} from '@mylife/sync';
import { SecretVaultUnreadableError, createBrowserSecretStore } from '../browser-secret-store';
import { STORE_SECRETS, idbGet, idbPut, idbDelete } from '../idb';
import { resetDurableLayer } from './helpers';

describe('BrowserSecretStore (IndexedDB + WebCrypto, sync-over-cache)', () => {
  beforeEach(async () => {
    await resetDurableLayer();
  });

  it('set/get/delete operate synchronously on the in-memory map', async () => {
    const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
    const ref = createDeviceIdentitySecretRef('a'.repeat(64));

    expect(store.getSecret(ref)).toBeNull();
    store.setSecret(ref, 'secret-value');
    expect(store.getSecret(ref)).toBe('secret-value');

    store.deleteSecret?.(ref);
    expect(store.getSecret(ref)).toBeNull();
    store.close();
  });

  it('persists across a reload cycle with real sync secret refs', async () => {
    const deviceRef = createDeviceIdentitySecretRef('b'.repeat(64));
    const sharedRef = createSharedSecretRef('local-device', 'remote-device');
    const deviceBundle = JSON.stringify({
      ed25519PrivateKeyHex: 'c'.repeat(128),
      x25519PrivateKeyHex: 'd'.repeat(64),
    });
    const sharedSecret = 'e'.repeat(64);

    const a = await createBrowserSecretStore({ persistDebounceMs: 0 });
    a.setSecret(deviceRef, deviceBundle);
    a.setSecret(sharedRef, sharedSecret);
    await a.flush();

    // A fresh store sharing the same IndexedDB + non-extractable CryptoKey
    // decrypts the vault byte-for-byte.
    const b = await createBrowserSecretStore({ persistDebounceMs: 0 });
    expect(b.getSecret(deviceRef)).toBe(deviceBundle);
    expect(b.getSecret(sharedRef)).toBe(sharedSecret);
  });

  it('stores ciphertext at rest (the plaintext is not present in the vault)', async () => {
    const ref = createDeviceIdentitySecretRef('f'.repeat(64));
    const plaintext = 'top-secret-passphrase-1234567890';

    const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
    store.setSecret(ref, plaintext);
    await store.flush();

    const raw = await idbGet<{ iv: Uint8Array; ciphertext: Uint8Array }>(
      STORE_SECRETS,
      'vault',
    );
    expect(raw).toBeDefined();
    const cipherBytes = raw!.ciphertext instanceof Uint8Array
      ? raw!.ciphertext
      : new Uint8Array(raw!.ciphertext);
    const cipherText = new TextDecoder().decode(cipherBytes);
    expect(cipherText).not.toContain(plaintext);
    expect(cipherText).not.toContain(ref);

    // And it still decrypts to the original on reload.
    const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
    expect(reopened.getSecret(ref)).toBe(plaintext);
  });

  // Multi-tab durability (found live 2026-08-30). The vault is ONE IndexedDB
  // record holding every secret and each tab holds its own in-memory map, so a
  // whole-map write silently destroyed keys a concurrent tab had written. The
  // observed symptom was an orphaned device identity: the SQLite identity row
  // survived while its signing key vanished, and the app could then sign nothing
  // ("Sync signing private key is unavailable in secure storage") with no
  // recovery except clearing site data. Persist must MERGE, not clobber.
  it('does not clobber a concurrent tab: two stores each keep their own key', async () => {
    const refA = createDeviceIdentitySecretRef('1'.repeat(64));
    const refB = createDeviceIdentitySecretRef('2'.repeat(64));

    // Both "tabs" open against the same (empty) vault, as two real tabs would.
    const tabA = await createBrowserSecretStore({ persistDebounceMs: 0 });
    const tabB = await createBrowserSecretStore({ persistDebounceMs: 0 });

    tabA.setSecret(refA, 'key-from-tab-a');
    await tabA.flush();

    // Tab B never saw refA in its in-memory map. Before the fix, this flush
    // wrote B's whole map over the vault and refA was gone forever.
    tabB.setSecret(refB, 'key-from-tab-b');
    await tabB.flush();

    const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
    expect(reopened.getSecret(refA)).toBe('key-from-tab-a');
    expect(reopened.getSecret(refB)).toBe('key-from-tab-b');
  });

  it('a delete still removes the key through the merge path', async () => {
    const ref = createDeviceIdentitySecretRef('3'.repeat(64));
    const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
    store.setSecret(ref, 'value');
    await store.flush();

    store.deleteSecret?.(ref);
    await store.flush();

    const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
    expect(reopened.getSecret(ref)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2026-08-30 hardening: key-vs-vault race (reproduced six times live).
  // -------------------------------------------------------------------------

  it('CONCURRENT first boots mint exactly ONE wrapping key (StrictMode / second tab)', async () => {
    const ref = createDeviceIdentitySecretRef('4'.repeat(64));

    // The pre-fix bug: both inits read "no key", both generate, the loser's
    // vault is forever undecryptable. The lock discipline (in-process mutex +
    // Web Lock) must serialize create-if-absent.
    const [a, b] = await Promise.all([
      createBrowserSecretStore({ persistDebounceMs: 0 }),
      createBrowserSecretStore({ persistDebounceMs: 0 }),
    ]);

    a.setSecret(ref, 'written-by-a');
    await a.flush();

    // B shares the same wrapping key, so it can read what A persisted after a
    // merge-persist of its own.
    b.setSecret(createDeviceIdentitySecretRef('5'.repeat(64)), 'written-by-b');
    await b.flush();

    const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
    expect(reopened.getSecret(ref)).toBe('written-by-a');

    const stored = await idbGet<{ id?: string }>(STORE_SECRETS, 'wrapping-key');
    expect(typeof stored?.id).toBe('string');
  });

  it('MANY concurrent boots agree on one key (property run)', async () => {
    const stores = await Promise.all(
      Array.from({ length: 8 }, () => createBrowserSecretStore({ persistDebounceMs: 0 })),
    );
    const ref = createDeviceIdentitySecretRef('6'.repeat(64));
    stores[0].setSecret(ref, 'v0');
    await stores[0].flush();
    // Every other instance persists too; none may re-key or clobber.
    for (const [i, store] of stores.entries()) {
      if (i === 0) continue;
      store.setSecret(createSharedSecretRef(`local-${i}`, `remote-${i}`), `v${i}`);
      await store.flush();
    }
    const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
    expect(reopened.getSecret(ref)).toBe('v0');
    for (let i = 1; i < stores.length; i += 1) {
      expect(reopened.getSecret(createSharedSecretRef(`local-${i}`, `remote-${i}`))).toBe(`v${i}`);
    }
  });

  it('boot DETECTS a key-vs-vault mismatch as a typed half-state, not a raw crypto error', async () => {
    const ref = createDeviceIdentitySecretRef('7'.repeat(64));
    const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
    store.setSecret(ref, 'sealed-under-key-1');
    await store.flush();

    // Simulate the wipe-raced-a-live-instance corruption: the wrapping key is
    // deleted while the (stamped) vault survives; the next boot mints a new key.
    await idbDelete(STORE_SECRETS, 'wrapping-key');

    await expect(createBrowserSecretStore({ persistDebounceMs: 0 }))
      .rejects.toBeInstanceOf(SecretVaultUnreadableError);
    await expect(createBrowserSecretStore({ persistDebounceMs: 0 }))
      .rejects.toMatchObject({ reason: 'key_mismatch' });
  });

  it('boot maps an undecryptable legacy vault (no keyId) to decrypt_failed', async () => {
    const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
    store.setSecret(createDeviceIdentitySecretRef('8'.repeat(64)), 'value');
    await store.flush();

    // Strip the keyId stamp (legacy vault shape) AND corrupt the ciphertext so
    // the mismatch can only be discovered by the decrypt attempt.
    const vault = await idbGet<{ iv: Uint8Array; ciphertext: Uint8Array; keyId?: string }>(STORE_SECRETS, 'vault');
    expect(vault).toBeDefined();
    const corrupted = {
      iv: vault!.iv,
      ciphertext: new Uint8Array(vault!.ciphertext.length).fill(7),
    };
    await idbPut(STORE_SECRETS, 'vault', corrupted);

    await expect(createBrowserSecretStore({ persistDebounceMs: 0 }))
      .rejects.toMatchObject({ reason: 'decrypt_failed' });
  });

  // Review find (2026-08-30, Set 6 review): the merge ADOPTION loop wrote the
  // stored base value over the in-memory map for every key not deleted, so a
  // setSecret that landed while a persist was in flight (for a key already in
  // the stored vault) was silently reverted to the STALE stored value, and the
  // next authority round then persisted the stale value: the newer write was
  // permanently lost. Adoption must never override a key this tab has a pending
  // write for.
  it('a write landing during an in-flight persist survives the merge adoption', async () => {
    const ref = createDeviceIdentitySecretRef('e5'.repeat(32));
    const other = createDeviceIdentitySecretRef('f6'.repeat(32));
    const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
    store.setSecret(ref, 'v1');
    await store.flush();

    // Gate the merge's decrypt so the persist round is provably in flight when
    // the newer write lands.
    const subtle = globalThis.crypto.subtle;
    const realDecrypt = subtle.decrypt.bind(subtle);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let gated = false;
    const decryptSpy = vi.spyOn(subtle, 'decrypt').mockImplementation(async (...args) => {
      if (!gated) {
        gated = true;
        await gate;
      }
      return realDecrypt(...(args as Parameters<typeof realDecrypt>));
    });
    try {
      store.setSecret(other, 'other-value');
      const flushing = store.flush();
      // The round is awaiting the gated decrypt; this write must win.
      store.setSecret(ref, 'v2');
      release();
      await flushing;
      expect(store.getSecret(ref)).toBe('v2');

      await store.flush();
      const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
      expect(reopened.getSecret(ref)).toBe('v2');
      expect(reopened.getSecret(other)).toBe('other-value');
    } finally {
      decryptSpy.mockRestore();
      store.close();
    }
  });

  describe('persist failure handling (no hot loop)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('a failing persist backs off instead of hot-looping, and surfaces after repeated failures', async () => {
      const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
      const ref = createDeviceIdentitySecretRef('9'.repeat(64));

      // Force every encrypt to fail: a permanent transient-style failure.
      const subtle = globalThis.crypto.subtle;
      const encryptSpy = vi.spyOn(subtle, 'encrypt').mockRejectedValue(new Error('quota exceeded'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        store.setSecret(ref, 'memory-only');
        await expect(store.flush()).rejects.toThrow('quota exceeded');

        // The pre-fix behavior retried in a tight tail-call loop (observed as
        // ~10,000 warnings in seconds). Now: exactly one failed attempt per
        // flush call, plus a SCHEDULED backoff retry, never an immediate spin.
        expect(warnSpy.mock.calls.length).toBe(1);

        await expect(store.flush()).rejects.toThrow();
        await expect(store.flush()).rejects.toThrow();
        // Three consecutive failures reach the honest surface threshold.
        expect(store.getPersistFailure()).toContain('cannot save');

        // Recovery: the write path works again, a flush succeeds, the failure
        // surface clears, and the data is durable.
        encryptSpy.mockRestore();
        await store.flush();
        expect(store.getPersistFailure()).toBeNull();
        const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
        expect(reopened.getSecret(ref)).toBe('memory-only');
      } finally {
        encryptSpy.mockRestore();
        warnSpy.mockRestore();
        store.close();
      }
    });

    it('subscribePersistFailure notifies on surface and clear', async () => {
      const store = await createBrowserSecretStore({ persistDebounceMs: 0 });
      const seen: Array<string | null> = [];
      const unsubscribe = store.subscribePersistFailure(() => {
        seen.push(store.getPersistFailure());
      });
      const encryptSpy = vi.spyOn(globalThis.crypto.subtle, 'encrypt')
        .mockRejectedValue(new Error('nope'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        store.setSecret(createDeviceIdentitySecretRef('a1'.repeat(32)), 'v');
        for (let i = 0; i < 3; i += 1) {
          await store.flush().catch(() => undefined);
        }
        expect(seen.some((s) => s !== null)).toBe(true);
        encryptSpy.mockRestore();
        await store.flush();
        expect(seen[seen.length - 1]).toBeNull();
      } finally {
        unsubscribe();
        encryptSpy.mockRestore();
        warnSpy.mockRestore();
        store.close();
      }
    });

    it('a mid-session re-key (wipe + new instance) is FATAL and surfaced, never retried forever', async () => {
      const a = await createBrowserSecretStore({ persistDebounceMs: 0 });
      a.setSecret(createDeviceIdentitySecretRef('b2'.repeat(32)), 'session-a');
      await a.flush();

      // Simulate a full wipe + a fresh session minting a NEW key and vault.
      await idbDelete(STORE_SECRETS, 'wrapping-key');
      await idbDelete(STORE_SECRETS, 'vault');
      const b = await createBrowserSecretStore({ persistDebounceMs: 0 });
      b.setSecret(createDeviceIdentitySecretRef('c3'.repeat(32)), 'session-b');
      await b.flush();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        // A's next persist sees a vault stamped with B's key: it must fail
        // honestly (fatal, surfaced) and must NOT overwrite B's vault.
        a.setSecret(createDeviceIdentitySecretRef('d4'.repeat(32)), 'late-write');
        await expect(a.flush()).rejects.toBeInstanceOf(SecretVaultUnreadableError);
        expect(a.getPersistFailure()).toContain('can no longer be saved');

        // B's vault is intact.
        const reopened = await createBrowserSecretStore({ persistDebounceMs: 0 });
        expect(reopened.getSecret(createDeviceIdentitySecretRef('c3'.repeat(32)))).toBe('session-b');
        expect(reopened.getSecret(createDeviceIdentitySecretRef('d4'.repeat(32)))).toBeNull();

        // And a further flush attempt stays fatal without another crypto probe
        // storm: one more rejection, no unbounded loop.
        await expect(a.flush()).rejects.toThrow();
      } finally {
        warnSpy.mockRestore();
        a.close();
        b.close();
      }
    });
  });
});

it('stops automatic secret-vault retries after four failures and recovers retained keys', async () => {
  await resetDurableLayer();
  const store = await createBrowserSecretStore({ persistDebounceMs: 60000 });
  const ref = createDeviceIdentitySecretRef('a1'.repeat(32));
  const real = globalThis.crypto.subtle.encrypt.bind(globalThis.crypto.subtle);
  const failure = vi.spyOn(globalThis.crypto.subtle, 'encrypt').mockRejectedValue(new Error('quota'));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    store.setSecret(ref, 'retained');
    await expect(store.flush()).rejects.toThrow('quota');
    await vi.waitFor(() => expect(failure).toHaveBeenCalledTimes(4), { timeout: 4500 });
    await new Promise((resolve) => setTimeout(resolve, 4200));
    expect(failure).toHaveBeenCalledTimes(4);
    failure.mockImplementation(real);
    await store.retryPersistence();
    const reopened = await createBrowserSecretStore();
    expect(reopened.getSecret(ref)).toBe('retained');
    reopened.close();
  } finally {
    store.close();
    failure.mockRestore();
    warn.mockRestore();
    vi.useRealTimers();
  }
}, 10000);
