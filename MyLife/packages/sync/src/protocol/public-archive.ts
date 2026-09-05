/**
 * Public archive jobs (Plan 19, Meerkat Public Social Layer -- P9 durable archive).
 *
 * An ArchiveJob is an owner-signed durable-pin request for a publication's PUBLIC
 * snapshot. It carries an explicit rights/consent block (license, rights-assertion,
 * provenance, consent timestamp). A host runs verifyArchiveJob BEFORE pinning; only
 * an 'ok' verdict proceeds, so a consent-less or rights-less publish never reaches
 * the durable archive (NC-8). The dedupe + index key is the content-addressed
 * contentId, identical to the host-registry id (deriveContentRegistryId), so two
 * publications of the same content resolve to ONE stored copy + ONE index entry
 * (dedupe is structural, never an estimate -- TC-11).
 *
 * Trust model (mirrors publication.ts):
 *  - jobId derives from the genesis canonical job (id field blanked), so it is
 *    stable + unforgeable; tampering any signed field breaks the id recompute.
 *  - rights are signed twice over: rightsSignature (the rights block alone) and as
 *    part of signature (the whole job), so neither rights nor consent can be
 *    stripped or swapped without breaking verification.
 *  - contentId + publicationId are taken from the signed PublicationDescriptor, so
 *    a job always references real content; the owner cross-check (verifyArchiveJob's
 *    optional `publication` arg) catches a job signed by a non-owner.
 *
 * Pure module: no new crypto. Signing reuses the device-identity Ed25519 path;
 * content addressing reuses the existing HKDF + sha512. RN-safe (no node:crypto,
 * no sockets), so it runs unchanged from index.native.
 *
 * Distinct signing domains: 'meerkat-archive-job-v1' / 'meerkat-archive-rights-v1'
 * (never collide with the publication / community / kill domains).
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha256Hex } from '../encryption/sha256';
import { hkdf, sha512Hex } from '../node/hkdf';
import type { SignedPublicationDescriptor } from './publication';

const encoder = new TextEncoder();

// Mirror host-registry.ts REGISTRY_ID_INFO exactly: deriveArchiveIndexKey MUST
// equal deriveContentRegistryId so the archive index + dedupe key is the same
// content-addressed id the host registry already uses. The equality is asserted by
// public-archive.test.ts (against the real deriveContentRegistryId), so this
// constant can never silently drift.
const ARCHIVE_INDEX_INFO = 'meerkat-host-registry-id-v1';

// ---------------------------------------------------------------------------
// Rights / license taxonomy (Plan 19 section 9A.4) -- self-declared CLAIMS, not
// platform verification. The reader surfaces them verbatim and states so.
// ---------------------------------------------------------------------------

export type ArchiveLicense =
  | 'all_rights_reserved'
  | 'cc_by'
  | 'cc_by_sa'
  | 'cc0'
  | 'public_domain'
  | 'other';

const ARCHIVE_LICENSES: readonly ArchiveLicense[] = [
  'all_rights_reserved', 'cc_by', 'cc_by_sa', 'cc0', 'public_domain', 'other',
];

export type RightsAssertion = 'i_own' | 'i_have_permission' | 'public_domain' | 'fair_use';
const RIGHTS_ASSERTIONS: readonly RightsAssertion[] = [
  'i_own', 'i_have_permission', 'public_domain', 'fair_use',
];

export type ArchiveTier = 'self_host' | 'managed';

export interface ArchiveObjectManifestEntry {
  /** Contiguous zero-based upload index. */
  index: number;
  /** SHA-256 of the exact quarantined object bytes. */
  hash: string;
  /** Exact byte length of this object. */
  size: number;
}

export interface PublicationRights {
  license: ArchiveLicense;
  rightsAssertion: RightsAssertion;
  /** Author-stated source/attribution. A self-declared CLAIM, not platform-verified. */
  provenance: string;
  /** Explicit publish-consent timestamp (ISO). Empty/absent -> no_consent. */
  consentAt: string;
}

// ---------------------------------------------------------------------------
// Archive job
// ---------------------------------------------------------------------------

export interface ArchiveJob {
  version: 2;
  /** Stable id derived from the genesis canonical job (id field blanked). */
  jobId: string;
  publicationId: string;
  /** Public snapshot infoHash; the dedupe + index key. */
  contentId: string;
  /** The signer (the publishing owner). */
  ownerDeviceId: string;
  tier: ArchiveTier;
  /** The durable serving host (real, probed). */
  hostUrl: string;
  /** Ordered, signed byte authority for every object accepted by archive intake. */
  objects: ArchiveObjectManifestEntry[];
  /** SHA-256 over the canonical ordered object manifest. */
  objectManifestRoot: string;
  rights: PublicationRights;
  createdAt: string;
}

export interface SignedArchiveJob {
  job: ArchiveJob;
  /** Ed25519 over the canonical rights block, by ownerDeviceId. */
  rightsSignature: string;
  /** Ed25519 over the canonical job, by ownerDeviceId. */
  signature: string;
}

export interface CreateArchiveJobOptions {
  tier: ArchiveTier;
  hostUrl: string;
  objects: readonly ArchiveObjectManifestEntry[];
  rights: PublicationRights;
  now?: string;
}

export type ArchiveJobVerdict = 'ok' | 'invalid' | 'not_owner' | 'no_consent' | 'no_rights';

function isArchiveLicense(value: unknown): value is ArchiveLicense {
  return typeof value === 'string' && (ARCHIVE_LICENSES as readonly string[]).includes(value);
}

function isRightsAssertion(value: unknown): value is RightsAssertion {
  return typeof value === 'string' && (RIGHTS_ASSERTIONS as readonly string[]).includes(value);
}

/** Canonical rights bytes -- field order fixed and explicit. */
function canonicalRights(r: PublicationRights): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-archive-rights-v1',
    r.license,
    r.rightsAssertion,
    r.provenance,
    r.consentAt,
  ]));
}

function canonicalObjectManifest(objects: readonly ArchiveObjectManifestEntry[]): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-archive-object-manifest-v1',
    objects.map((object) => [object.index, object.hash, object.size]),
  ]));
}

export function deriveArchiveObjectManifestRoot(
  objects: readonly ArchiveObjectManifestEntry[],
): string {
  return sha256Hex(canonicalObjectManifest(objects));
}

/** Canonical job bytes -- field order fixed; the rights ride as a nested tuple. */
function canonicalJob(j: ArchiveJob, jobIdOverride?: string): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-archive-job-v2',
    j.version,
    jobIdOverride ?? j.jobId,
    j.publicationId,
    j.contentId,
    j.ownerDeviceId,
    j.tier,
    j.hostUrl,
    j.objects.map((object) => [object.index, object.hash, object.size]),
    j.objectManifestRoot,
    [j.rights.license, j.rights.rightsAssertion, j.rights.provenance, j.rights.consentAt],
    j.createdAt,
  ]));
}

/** The id is the hash of the genesis content with the id field blanked. */
function deriveJobId(genesis: ArchiveJob): string {
  return sha512Hex(canonicalJob(genesis, '')).slice(0, 32);
}

/**
 * The DEDUPE + index key for a content-addressed public snapshot. Equal to
 * deriveContentRegistryId(contentId) by construction (same HKDF + sha512 + slice),
 * so two publications of the same contentId resolve to ONE host copy + index entry.
 */
export function deriveArchiveIndexKey(contentId: string): string {
  return sha512Hex(hkdf(encoder.encode(contentId), ARCHIVE_INDEX_INFO)).slice(0, 64);
}

/**
 * Build an owner-signed durable-pin request for a publication. contentId +
 * publicationId are taken from the signed publication (authoritative), so a job
 * always references the real content. createArchiveJob does NOT validate rights or
 * consent -- verifyArchiveJob is the fail-closed gate (NC-8), so a caller can build
 * a no_consent / no_rights job and the verify step (run by the host before pinning)
 * rejects it.
 */
export function createArchiveJob(
  owner: DeviceIdentity,
  publication: SignedPublicationDescriptor,
  options: CreateArchiveJobOptions,
): SignedArchiveJob {
  const now = options.now ?? new Date().toISOString();
  const objects = options.objects.map((object) => ({ ...object }));
  const job: ArchiveJob = {
    version: 2,
    jobId: '',
    publicationId: publication.descriptor.publicationId,
    contentId: publication.descriptor.contentId,
    ownerDeviceId: owner.publicKey,
    tier: options.tier,
    hostUrl: options.hostUrl,
    objects,
    objectManifestRoot: deriveArchiveObjectManifestRoot(objects),
    rights: {
      license: options.rights.license,
      rightsAssertion: options.rights.rightsAssertion,
      provenance: options.rights.provenance,
      consentAt: options.rights.consentAt,
    },
    createdAt: now,
  };
  job.jobId = deriveJobId(job);
  const privateKeyHex = extractSigningPrivateKeyHex(owner.privateKeyRef);
  const rightsSignature = bytesToHex(signMessage(privateKeyHex, canonicalRights(job.rights)));
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalJob(job)));
  return { job, rightsSignature, signature };
}

/**
 * Verify a signed archive job, fail-closed. Order: shape -> rights present ->
 * consent present -> id derivation -> rights signature -> job signature ->
 * (optional) owner cross-check against the publication.
 *
 *  - 'invalid'    = malformed shape; recomputed jobId mismatch (any tampered signed
 *                   field); a signature that fails to verify against ownerDeviceId.
 *  - 'no_rights'  = license or rights-assertion missing / not in the fixed taxonomy.
 *  - 'no_consent' = consent timestamp absent. Both gate the durable pin (NC-8).
 *  - 'not_owner'  = a publication was supplied and the job's owner / publicationId /
 *                   contentId does not match it (a job signed by a non-owner).
 *  - 'ok'         = otherwise.
 *
 * Mirrors verifyPublication(signed, previous=null): the optional `publication`
 * second arg is the authoritative owner attestation. A detached Ed25519 verify
 * cannot by itself distinguish a wrong-signer from tampered bytes, so the cross-
 * check needs the publication, exactly like the descriptor revision chain needs
 * `previous`.
 */
export function verifyArchiveJob(
  signed: SignedArchiveJob,
  publication: SignedPublicationDescriptor | null = null,
): ArchiveJobVerdict {
  const j = signed?.job;
  if (
    !j
    || typeof signed.signature !== 'string'
    || typeof signed.rightsSignature !== 'string'
    || j.version !== 2
    || typeof j.jobId !== 'string'
    || typeof j.publicationId !== 'string'
    || typeof j.contentId !== 'string'
    || typeof j.ownerDeviceId !== 'string'
    || (j.tier !== 'self_host' && j.tier !== 'managed')
    || typeof j.hostUrl !== 'string'
    || !Array.isArray(j.objects)
    || j.objects.length === 0
    || typeof j.objectManifestRoot !== 'string'
    || typeof j.createdAt !== 'string'
    || typeof j.rights !== 'object' || j.rights === null
    || typeof j.rights.provenance !== 'string'
    || typeof j.rights.consentAt !== 'string'
  ) {
    return 'invalid';
  }

  if (j.objects.some((object, index) => (
    typeof object !== 'object'
    || object === null
    || object.index !== index
    || typeof object.hash !== 'string'
    || !/^[0-9a-f]{64}$/u.test(object.hash)
    || !Number.isSafeInteger(object.size)
    || object.size < 0
  ))) return 'invalid';
  if (deriveArchiveObjectManifestRoot(j.objects) !== j.objectManifestRoot) return 'invalid';

  if (!isArchiveLicense(j.rights.license) || !isRightsAssertion(j.rights.rightsAssertion)) {
    return 'no_rights';
  }
  if (j.rights.consentAt.trim() === '') {
    return 'no_consent';
  }

  if (deriveJobId(j) !== j.jobId) return 'invalid';

  try {
    if (!verifySignature(j.ownerDeviceId, canonicalRights(j.rights), hexToBytes(signed.rightsSignature))) {
      return 'invalid';
    }
    if (!verifySignature(j.ownerDeviceId, canonicalJob(j), hexToBytes(signed.signature))) {
      return 'invalid';
    }
  } catch {
    return 'invalid';
  }

  if (publication) {
    if (
      j.publicationId !== publication.descriptor.publicationId
      || j.ownerDeviceId !== publication.descriptor.ownerDeviceId
      || j.contentId !== publication.descriptor.contentId
    ) {
      return 'not_owner';
    }
  }

  return 'ok';
}
