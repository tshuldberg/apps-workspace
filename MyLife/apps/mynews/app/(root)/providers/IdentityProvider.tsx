import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { generateDeviceIdentity, extractSigningPrivateKeyHex } from '@mylife/sync';
import type { AuthorIdentity } from '@mylife/mynews';

// Custody model (contract C4, extended by plan 48 WP6). One signing identity per
// device. The Ed25519 keypair is generated once via @mylife/sync and the private
// key hex is held in expo-secure-store. Storing the raw hex here (rather than an
// opaque ref) is the current custody boundary; hardware-backed non-extractable
// key refs remain future work.
//
// What WP6 changed: losing this key is no longer terminal. The key chain
// (nw_profile_keys) lets a journalist rotate to a new key from a recovery kit or
// from another device that still holds an active key, so past work stays
// publishable by its actual author. The server still cannot forge a revision:
// every custody transition needs a signature from a key the server never holds.
const IDENTITY_KEY = 'mynews.identity.v1';

interface StoredIdentity {
  publicKey: string;
  privateKeyHex: string;
  createdAt: string;
}

/** A freshly minted keypair that is NOT yet the device identity. */
export interface CandidateIdentity {
  pubkeyHex: string;
  privateKeyHex: string;
  createdAt: string;
}

export interface IdentityActions {
  /**
   * Mint a keypair WITHOUT installing it. Rotation and recovery both need the new
   * key to exist and sign a possession proof before the server will accept it, and
   * before this device throws away the key it can still publish with.
   */
  generateCandidate(): CandidateIdentity;
  /**
   * Install a keypair as this device's identity, replacing whatever was there.
   * Called only AFTER the server has accepted the transition, so a failed
   * rotation never leaves the device holding a key the chain does not know.
   * Returns false if the write failed, in which case the old identity stands.
   */
  installIdentity(next: CandidateIdentity): Promise<boolean>;
}

const IdentityContext = createContext<AuthorIdentity | null>(null);
const IdentityCreatedAtContext = createContext<string | null>(null);
const IdentityActionsContext = createContext<IdentityActions | null>(null);

/** The device author identity, or null while it is still loading. */
export function useMyNewsIdentity(): AuthorIdentity | null {
  return useContext(IdentityContext);
}

/** ISO timestamp of when the device key was generated (Me identity card). */
export function useMyNewsIdentityCreatedAt(): string | null {
  return useContext(IdentityCreatedAtContext);
}

/**
 * Rotation and recovery actions. Null outside the provider, which is a real
 * state the caller must handle rather than assume away.
 */
export function useMyNewsIdentityActions(): IdentityActions | null {
  return useContext(IdentityActionsContext);
}

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<AuthorIdentity | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        let stored: StoredIdentity | null = null;
        const existing = await SecureStore.getItemAsync(IDENTITY_KEY);
        if (existing) {
          stored = JSON.parse(existing) as StoredIdentity;
        }
        if (!stored?.publicKey || !stored?.privateKeyHex) {
          const device = generateDeviceIdentity('MyNews Author');
          stored = {
            publicKey: device.publicKey,
            privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
            createdAt: device.createdAt,
          };
          await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(stored));
        }
        if (mounted) {
          setIdentity({ pubkeyHex: stored.publicKey, privateKeyHex: stored.privateKeyHex });
          setCreatedAt(stored.createdAt ?? null);
        }
      } catch (err) {
        // A failure here leaves identity null: the composer keeps Publish
        // disabled with honest copy rather than pretending a key exists.
        console.warn('[IdentityProvider] failed to load author identity', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const generateCandidate = useCallback((): CandidateIdentity => {
    const device = generateDeviceIdentity('MyNews Author');
    return {
      pubkeyHex: device.publicKey,
      privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
      createdAt: device.createdAt,
    };
  }, []);

  const installIdentity = useCallback(async (next: CandidateIdentity): Promise<boolean> => {
    const stored: StoredIdentity = {
      publicKey: next.pubkeyHex,
      privateKeyHex: next.privateKeyHex,
      createdAt: next.createdAt,
    };
    try {
      // Persist BEFORE swapping the in-memory identity: if the write fails the
      // device keeps signing with the key it can prove, which is the safe side.
      await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(stored));
    } catch (err) {
      console.warn('[IdentityProvider] failed to install a new author identity', err);
      return false;
    }
    setIdentity({ pubkeyHex: next.pubkeyHex, privateKeyHex: next.privateKeyHex });
    setCreatedAt(next.createdAt);
    return true;
  }, []);

  const actions = useMemo<IdentityActions>(
    () => ({ generateCandidate, installIdentity }),
    [generateCandidate, installIdentity],
  );

  return (
    <IdentityContext.Provider value={identity}>
      <IdentityCreatedAtContext.Provider value={createdAt}>
        <IdentityActionsContext.Provider value={actions}>
          {children}
        </IdentityActionsContext.Provider>
      </IdentityCreatedAtContext.Provider>
    </IdentityContext.Provider>
  );
}
