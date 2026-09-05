import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { encodeBase64 } from 'tweetnacl-util';
import {
  generateDeviceIdentity,
  generateFriendCode,
  getPublicKeyFingerprint,
  isValidCustomFriendCode,
  makeVanityFriendCode,
  normalizeFriendCodeInput,
  openAndRestore,
  parseRecoveryKey,
  rendezvousIdFromCustomCode,
  type DeviceIdentity,
} from '@mylife/sync';
import { useMeerkatDatabase } from './DatabaseProvider';
import {
  FRIEND_CODE_IS_CUSTOM_KEY,
  FRIEND_CODE_KEY,
  ONBOARDING_COMPLETE_KEY,
  RENDEZVOUS_ID_KEY,
  deleteIdentityRow,
  deleteSetting,
  getIdentityRow,
  getSetting,
  saveIdentityRow,
  setSetting,
  updateDisplayName as updateDisplayNameRow,
} from '../data/db';

const DEFAULT_DISPLAY_NAME = 'My Meerkat';

/** The smallest vanity word Meerkat will accept before adding random characters. */
export const VANITY_MIN_LENGTH = 4;

/** Outcome of trying to set a custom (vanity) friend code. */
export type CustomFriendCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'too_short' | 'invalid_chars' };

/** Outcome of restoring an identity from a recovery key + encrypted backup. */
export type RestoreIdentityResult =
  | { ok: true }
  | { ok: false; reason: 'bad_key' | 'bad_backup' };

interface IdentityContextValue {
  identity: DeviceIdentity;
  fingerprint: string;
  displayName: string;
  friendCode: string;
  /** Whether the current friend code is a user-chosen vanity code. */
  isCustomFriendCode: boolean;
  setDisplayName: (name: string) => void;
  regenerateFriendCode: () => void;
  /** Build a vanity code from a typed word, persist it, and store its rid. */
  setCustomFriendCode: (vanity: string) => CustomFriendCodeResult;
  /**
   * Restore this device's identity from a recovery key + its encrypted backup
   * (Plan 23 / AM8). The FULL flow: decrypt + verify the export, write the
   * private keys to the secure store (openAndRestore), persist mk_identity,
   * mint a fresh friend-code rendezvous handle, mark onboarding complete, then
   * swap the identity in (which reboots the engine on the restored deviceId).
   * Fail-closed: a wrong key or a tampered/corrupt/inconsistent backup returns
   * an honest reason and changes nothing.
   */
  restoreIdentity: (recoveryKey: string, sealedBackup: string) => RestoreIdentityResult;
  resetIdentity: () => void;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used within IdentityProvider');
  return ctx;
}

function loadOrCreateFriendCode(
  db: ReturnType<typeof useMeerkatDatabase>,
): string {
  const existing = getSetting(db, FRIEND_CODE_KEY);
  if (existing) return existing;
  const { code, rendezvousId } = generateFriendCode();
  setSetting(db, FRIEND_CODE_KEY, code);
  setSetting(db, RENDEZVOUS_ID_KEY, encodeBase64(rendezvousId));
  return code;
}

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const db = useMeerkatDatabase();
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [displayName, setDisplayNameState] = useState(DEFAULT_DISPLAY_NAME);
  const [friendCode, setFriendCode] = useState('');
  const [isCustomFriendCode, setIsCustomFriendCode] = useState(false);

  useEffect(() => {
    const row = getIdentityRow(db);
    if (row) {
      setIdentity({
        publicKey: row.public_key,
        privateKeyRef: row.private_key_ref,
        dhPublicKey: row.dh_public_key,
        displayName: row.display_name,
        createdAt: row.created_at,
      });
      setDisplayNameState(row.display_name);
    } else {
      // First launch: mint a device identity. Private keys are persisted by the
      // configured secure-store; only the public fields land in SQLite.
      const created = generateDeviceIdentity(DEFAULT_DISPLAY_NAME);
      saveIdentityRow(db, {
        public_key: created.publicKey,
        dh_public_key: created.dhPublicKey,
        private_key_ref: created.privateKeyRef,
        display_name: created.displayName,
        created_at: created.createdAt,
      });
      setIdentity(created);
      setDisplayNameState(created.displayName);
    }
    setFriendCode(loadOrCreateFriendCode(db));
    setIsCustomFriendCode(getSetting(db, FRIEND_CODE_IS_CUSTOM_KEY) === '1');
  }, [db]);

  const setDisplayName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      updateDisplayNameRow(db, trimmed);
      setDisplayNameState(trimmed);
      setIdentity((prev) => (prev ? { ...prev, displayName: trimmed } : prev));
    },
    [db],
  );

  const regenerateFriendCode = useCallback(() => {
    const { code, rendezvousId } = generateFriendCode();
    setSetting(db, FRIEND_CODE_KEY, code);
    setSetting(db, RENDEZVOUS_ID_KEY, encodeBase64(rendezvousId));
    setSetting(db, FRIEND_CODE_IS_CUSTOM_KEY, '0');
    setFriendCode(code);
    setIsCustomFriendCode(false);
  }, [db]);

  // Build a vanity friend code from a typed word. @mylife/sync owns the crypto:
  // makeVanityFriendCode normalizes the word, appends a random Crockford suffix
  // (so a low-entropy word still carries baseline entropy), and never produces
  // the standard 16-char checksummed shape. We then derive the rid the same way
  // resolve does, so publish and pair agree. Validation here is pre-flight only;
  // the real minimum and charset rules live in the sync package.
  const setCustomFriendCode = useCallback(
    (vanity: string): CustomFriendCodeResult => {
      const normalized = normalizeFriendCodeInput(vanity);
      // normalizeFriendCodeInput returns '' if any char is outside Crockford
      // base32 after aliasing: that is a bad-character problem, not a length one.
      if (normalized === '' && vanity.trim().length > 0) {
        return { ok: false, reason: 'invalid_chars' };
      }
      if (normalized.length < VANITY_MIN_LENGTH) {
        return { ok: false, reason: 'too_short' };
      }
      const code = makeVanityFriendCode(normalized);
      const rid = rendezvousIdFromCustomCode(code);
      if (!rid || !isValidCustomFriendCode(code)) {
        // Defensive: makeVanityFriendCode guarantees a valid >= 12 code, so this
        // only trips on an unexpected primitive change. Fail closed, never fake.
        return { ok: false, reason: 'invalid_chars' };
      }
      setSetting(db, FRIEND_CODE_KEY, code);
      setSetting(db, RENDEZVOUS_ID_KEY, encodeBase64(rid));
      setSetting(db, FRIEND_CODE_IS_CUSTOM_KEY, '1');
      setFriendCode(code);
      setIsCustomFriendCode(true);
      return { ok: true, code };
    },
    [db],
  );

  // Plan 23 / AM8: restore a wiped identity from its recovery key + backup. The
  // engine reboot is implicit: SyncProvider's engine is keyed on identity.publicKey,
  // so swapping the identity in tears down the old engine and boots the restored
  // one. All persistence (secure store, mk_identity, friend code, onboarding flag)
  // happens BEFORE setIdentity so the reboot never races a half-written identity.
  const restoreIdentity = useCallback(
    (recoveryKey: string, sealedBackup: string): RestoreIdentityResult => {
      const bytes = parseRecoveryKey(recoveryKey.trim());
      if (!bytes) return { ok: false, reason: 'bad_key' };
      // openAndRestore decrypts + verifies keypair consistency and writes the
      // restored private keys into the configured secure store, or returns null
      // on a wrong key / tampered blob / inconsistent export (fail-closed).
      const restored = openAndRestore(sealedBackup.trim(), bytes);
      if (!restored) return { ok: false, reason: 'bad_backup' };
      // Overwrite any freshly-minted first-launch identity with the restored one.
      deleteIdentityRow(db);
      saveIdentityRow(db, {
        public_key: restored.publicKey,
        dh_public_key: restored.dhPublicKey,
        private_key_ref: restored.privateKeyRef,
        display_name: restored.displayName,
        created_at: restored.createdAt,
      });
      // The recovery blob carries no friend code (a rendezvous handle, not
      // identity): mint a fresh one for the restored device.
      const { code, rendezvousId } = generateFriendCode();
      setSetting(db, FRIEND_CODE_KEY, code);
      setSetting(db, RENDEZVOUS_ID_KEY, encodeBase64(rendezvousId));
      setSetting(db, FRIEND_CODE_IS_CUSTOM_KEY, '0');
      // A restored device is already set up: skip first-run onboarding.
      setSetting(db, ONBOARDING_COMPLETE_KEY, '1');
      setIdentity(restored);
      setDisplayNameState(restored.displayName);
      setFriendCode(code);
      setIsCustomFriendCode(false);
      return { ok: true };
    },
    [db],
  );

  const resetIdentity = useCallback(() => {
    deleteIdentityRow(db);
    deleteSetting(db, ONBOARDING_COMPLETE_KEY);
    const created = generateDeviceIdentity(DEFAULT_DISPLAY_NAME);
    saveIdentityRow(db, {
      public_key: created.publicKey,
      dh_public_key: created.dhPublicKey,
      private_key_ref: created.privateKeyRef,
      display_name: created.displayName,
      created_at: created.createdAt,
    });
    setIdentity(created);
    setDisplayNameState(created.displayName);
    regenerateFriendCode();
  }, [db, regenerateFriendCode]);

  const value = useMemo<IdentityContextValue | null>(() => {
    if (!identity) return null;
    return {
      identity,
      fingerprint: getPublicKeyFingerprint(identity.publicKey),
      displayName,
      friendCode,
      isCustomFriendCode,
      setDisplayName,
      regenerateFriendCode,
      setCustomFriendCode,
      restoreIdentity,
      resetIdentity,
    };
  }, [
    identity, displayName, friendCode, isCustomFriendCode,
    setDisplayName, regenerateFriendCode, setCustomFriendCode, restoreIdentity, resetIdentity,
  ]);

  if (!value) return null;

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
