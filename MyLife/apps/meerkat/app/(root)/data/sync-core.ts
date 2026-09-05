// Meerkat sync wiring (MK-008): the pure, Node-testable core behind
// SyncProvider. Defines the synced demo entity (the "sync pad"), the module
// policy that scopes it, the relay rendezvous token derivation, and the
// sync-schema bootstrap on the app database.
//
// The pad is the bellwether: a single mp_pad row that, once two devices are
// paired, syncs over a relay session. mk_ tables (identity, settings, pinned)
// deliberately use a prefix OUTSIDE the sync map so they never replicate.

import type { DatabaseAdapter } from '@mylife/db';
import {
  createSignedIdentityBundle,
  createSyncTables,
  ensureBlobPolicy,
  migrateSyncSchema,
  sha512Hex,
  verifySignedIdentityBundle,
  type DeviceIdentity,
  type NativeSyncEngineOptions,
  type PairingData,
  type SignedIdentityBundle,
} from '@mylife/sync';
import {
  COMMUNITY_MODULE_ID,
  COMMUNITY_PREFIX,
  COMMUNITY_SYNC_POLICY,
  ensureCommunityTables,
} from './community-core';

type PolicyMap = NonNullable<NativeSyncEngineOptions['modulePolicies']>;
type ModuleSyncPolicy = PolicyMap extends Map<string, infer P> ? P : never;

export const MEERKAT_SYNC_MODULE_ID = 'meerkatpad';

// Community epoch key wraps (community feed P0). The wraps replicate over the
// engine as shared_workspace so a member who has not yet held the epoch key
// receives it; each wrap is already sealed to one member's DH key, so syncing it
// leaks nothing. The prefix is the full physical table name (it owns only that
// one sync_ table). Keep this literal identical across sync-core.ts,
// meerkat-data.ts, and the relay harness + config guard.
export const MEERKAT_KEYS_MODULE_ID = 'communitykeys';

export const KEYS_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'sync_workspace_keys', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
  ],
};

// Plan 52: the person-identity module. pi_person_group carries the mutually
// attested device-group doc + the group secret; pi_presentation_profile the
// person's one name + per-community overrides. BOTH are personal_replica-capped
// AND the module is non-shareable, so these rows replicate ONLY between this
// user's own paired devices and can never escalate to a shared workspace.
// Inbound rows are additionally gated by the person-group apply validators.
export const PERSON_IDENTITY_MODULE_ID = 'personidentity';

export const PERSON_IDENTITY_SYNC_POLICY: ModuleSyncPolicy = {
  // FAIL CLOSED, matching the community policy's wave-1 audit fix: a pi_ table
  // added later without an explicit rule replicates NOTHING rather than
  // inheriting personal_replica by accident.
  defaultScope: 'device_local',
  shareable: false,
  entityRules: [
    { tableName: 'pi_person_group', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
    { tableName: 'pi_presentation_profile', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
  ],
};

/** Only mp_ + cm_ + pi_ + the key-wrap table sync; mk_ tables stay device-local by omission. */
export const MEERKAT_SYNC_PREFIXES = new Map<string, string>([
  [MEERKAT_SYNC_MODULE_ID, 'mp_'],
  [COMMUNITY_MODULE_ID, COMMUNITY_PREFIX],
  [MEERKAT_KEYS_MODULE_ID, 'sync_workspace_keys'],
  [PERSON_IDENTITY_MODULE_ID, 'pi_'],
]);

export const MEERKAT_SYNC_POLICIES: PolicyMap = new Map([
  [
    MEERKAT_SYNC_MODULE_ID,
    {
      defaultScope: 'personal_replica',
      shareable: true,
      entityRules: [
        { tableName: 'mp_pad', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      ],
    },
  ],
  [COMMUNITY_MODULE_ID, COMMUNITY_SYNC_POLICY],
  [MEERKAT_KEYS_MODULE_ID, KEYS_SYNC_POLICY],
  [PERSON_IDENTITY_MODULE_ID, PERSON_IDENTITY_SYNC_POLICY],
]);

const CREATE_MP_PAD = `
CREATE TABLE IF NOT EXISTS mp_pad (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

// Plan 52: person-identity tables (see PERSON_IDENTITY_SYNC_POLICY above).
// One 'self' row each; the engine injects id=rowId on apply.
const CREATE_PI_PERSON_GROUP = `
CREATE TABLE IF NOT EXISTS pi_person_group (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  doc_json TEXT NOT NULL,
  secret_hex TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_PI_PRESENTATION_PROFILE = `
CREATE TABLE IF NOT EXISTS pi_presentation_profile (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

/** Create the sync_ tables + the synced pad table. Idempotent. */
export function ensureSyncSchema(db: DatabaseAdapter): void {
  createSyncTables(db);
  // Post-DDL upgrades CREATE TABLE IF NOT EXISTS cannot apply on existing installs
  // (e.g. the sync_workspaces workspace_type CHECK gaining 'dm_group', Plan 21 Ph6).
  migrateSyncSchema(db);
  db.execute(CREATE_MP_PAD);
  db.execute(CREATE_PI_PERSON_GROUP);
  db.execute(CREATE_PI_PRESENTATION_PROFILE);
  ensureCommunityTables(db);
  ensureBlobPolicy(db, COMMUNITY_MODULE_ID);
}

export const PAD_TABLE = 'mp_pad';
export const PAD_ROW_ID = 'pad';
export const RELAY_URL_SETTING_KEY = 'relay_url';
export const RELAY_PHRASE_SETTING_KEY = 'relay_phrase';

// Plan 19 (Public Social Layer): the configured public-directory host the
// Discover/Feed probe queries (public-directory-client.ts). EMPTY/unset by design
// until a real directory is deployed, mirroring DEFAULT_RELAY_URL honesty: while
// it is unset, probePublicDirectory returns { configured: false } and the Feed
// Public control stays hidden. The web client mirrors this key in
// apps/meerkat-web/src/lib/meerkat-data.ts.
export const PUBLIC_DIRECTORY_URL_SETTING = 'public_directory_url';

// The build-time default connection-server URL (Plan 20).
//
// Read at runtime from extra.defaultRelayUrl, which app.config.ts bakes from
// process.env.MEERKAT_DEFAULT_RELAY_URL. NEVER dialed directly: it is consulted
// only by effectiveRelayUrl(db) (data/effective-relay.ts), which HEALTH-GATES it
// (dialed only after a real /healthz probe passes) and honors the per-device
// default_relay_optout. Defaults to '' when the build is unconfigured, so an
// un-deployed build keeps today's honest behavior (every networked guard
// short-circuits on the empty string) and never implies connectivity it lacks.
//
// expo-constants is RN-only; under node/vitest the require throws (no native
// module) and we fall back to '' -- tests never depend on a build-time default.
// The web client mirrors this in apps/meerkat-web/src/lib/relay.ts via
// import.meta.env (App Isolation: sync-core.ts is not importable across the app
// boundary; a shared @mylife/meerkat-core extraction is a later consolidation).
function readDefaultRelayUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as {
      defaultRelayUrl?: unknown;
    };
    return typeof extra.defaultRelayUrl === 'string' ? extra.defaultRelayUrl.trim() : '';
  } catch {
    return '';
  }
}

export const DEFAULT_RELAY_URL: string = readDefaultRelayUrl();

export interface PadRow {
  id: string;
  body: string;
  updated_at: string;
}

export function getPadRow(db: DatabaseAdapter): PadRow | null {
  const rows = db.query<PadRow>(
    'SELECT id, body, updated_at FROM mp_pad WHERE id = ?',
    [PAD_ROW_ID],
  );
  return rows[0] ?? null;
}

/** Save the pad body with a fresh LWW timestamp and return the row. */
export function savePadRow(
  db: DatabaseAdapter,
  body: string,
  now: string = new Date().toISOString(),
): PadRow {
  const row: PadRow = { id: PAD_ROW_ID, body, updated_at: now };
  db.execute(
    'INSERT OR REPLACE INTO mp_pad (id, body, updated_at) VALUES (?, ?, ?)',
    [row.id, row.body, row.updated_at],
  );
  return row;
}

/**
 * Derive the relay rendezvous token from a human shared phrase (the relay
 * requires >= 16 chars; real tokens are 64 hex). The relay only ever sees
 * this hash, never the phrase.
 */
export function buildRendezvousToken(phrase: string): string {
  return sha512Hex(new TextEncoder().encode(phrase.trim())).slice(0, 64);
}

/** Parse a pairing payload pasted from the other device. Null if malformed. */
export function parsePairingPayloadJson(json: string): PairingData | null {
  try {
    const value = JSON.parse(json) as Partial<PairingData>;
    if (
      typeof value.publicKey === 'string' && value.publicKey.length >= 32
      && typeof value.dhPublicKey === 'string' && value.dhPublicKey.length >= 32
      && typeof value.displayName === 'string'
      && typeof value.pairingNonce === 'string'
    ) {
      return value as PairingData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Authenticated pairing payload (MK-015). The bundle is self-signed by the
 * device's Ed25519 key (deviceId IS that key), so a pasted payload can no
 * longer claim a key it does not control: a man-in-the-middle DH-key swap
 * fails signature verification, and a known device presenting a new DH key is
 * surfaced as a key change instead of silently trusted. The nonce stays for
 * replay parity with the legacy plain payload; it is not part of the signature.
 */
export interface SignedPairingPayload {
  v: 2;
  bundle: SignedIdentityBundle;
  pairingNonce: string;
}

/** Build this device's authenticated pairing payload. */
export function buildSignedPairingPayload(
  identity: DeviceIdentity,
  relayHints: string[] = [],
): SignedPairingPayload {
  return {
    v: 2,
    bundle: createSignedIdentityBundle(identity, relayHints),
    pairingNonce: sha512Hex(new TextEncoder().encode(`${identity.publicKey}:${identity.dhPublicKey}`)).slice(0, 32),
  };
}

/** Parse + verify a pasted authenticated payload. Null if malformed/unsigned. */
export function parseSignedPairingPayload(json: string): SignedPairingPayload | null {
  try {
    const value = JSON.parse(json) as Partial<SignedPairingPayload>;
    if (
      value.v === 2
      && value.bundle != null
      && typeof value.pairingNonce === 'string'
      && verifySignedIdentityBundle(value.bundle)
    ) {
      return value as SignedPairingPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** The PairingData completePairing needs, derived from a verified bundle. */
export function pairingDataFromBundle(signed: SignedIdentityBundle): PairingData {
  const { bundle } = signed;
  return {
    publicKey: bundle.deviceId,
    dhPublicKey: bundle.dhPublicKey,
    displayName: bundle.displayName,
    pairingNonce: sha512Hex(
      new TextEncoder().encode(`${bundle.deviceId}:${bundle.dhPublicKey}`),
    ).slice(0, 32),
  };
}

/** PairingData from a v2 envelope, preserving the envelope's transmitted nonce. */
export function pairingDataFromSignedPayload(payload: SignedPairingPayload): PairingData {
  return { ...pairingDataFromBundle(payload.bundle), pairingNonce: payload.pairingNonce };
}
