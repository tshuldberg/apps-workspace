/**
 * Abuse rails v1 (plan 14, MK-034; design D10).
 *
 * Three rails, each at the narrowest honest boundary:
 *
 *  1. REPORTS are reporter-side: the reporter quotes the plaintext THEY can
 *     already read and seals it to the Trust & Safety inbox (the MK-033
 *     mailbox envelope -- signed by the reporter, readable only by T&S). No
 *     scanning of anyone else's content is involved.
 *  2. HASH MATCHING runs client-side at the PUBLISH boundary only: content
 *     entering the public scope (`published_blob`) is hashed pre-encryption
 *     and blocked if flagged. Private scopes are PROVABLY unscanned -- the
 *     evaluator never even invokes the hash function for them, which the
 *     tests assert with a counting spy. Security lives in the payload; so
 *     does privacy.
 *  3. The KILL SWITCH stops NEW joins of a community whose descriptor T&S has
 *     killed (a signed kill record checked at the join boundary, the same
 *     place a rendezvous would refuse to serve it). Existing members'
 *     ciphertext is untouched: a kill is a future-tense action, never remote
 *     deletion.
 *
 * DMCA agent registration is a founder operation (legal), tracked in the plan.
 */

import type { DeviceIdentity, SyncScope } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import {
  sealMailboxDelta,
  openMailboxDelta,
  type MailboxEnvelope,
  type OpenMailboxResult,
} from './mailbox';

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Rail 1: reporter-side reports, sealed to the T&S inbox
// ---------------------------------------------------------------------------

export interface AbuseReport {
  version: 1;
  communityId?: string;
  contentId?: string;
  reason: string;
  /** The reporter's own plaintext view of the offending content. */
  context: string;
  reportedAt: string;
}

/** Seal a report to the T&S inbox. Signed by the reporter, readable by T&S only. */
export function createAbuseReport(
  reporter: DeviceIdentity,
  inbox: { deviceId: string; dhPublicKey: string },
  report: Omit<AbuseReport, 'version' | 'reportedAt'> & { reportedAt?: string },
): MailboxEnvelope {
  const full: AbuseReport = {
    version: 1,
    communityId: report.communityId,
    contentId: report.contentId,
    reason: report.reason,
    context: report.context,
    reportedAt: report.reportedAt ?? new Date().toISOString(),
  };
  return sealMailboxDelta(reporter, inbox, full);
}

/** T&S opens a report: reporter authenticated, context intact. */
export function openAbuseReport(
  inboxIdentity: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenMailboxResult<AbuseReport> {
  return openMailboxDelta<AbuseReport>(inboxIdentity, envelope);
}

// ---------------------------------------------------------------------------
// Rail 2: client-side hash match at the publish boundary ONLY
// ---------------------------------------------------------------------------

export interface PublishBoundaryVerdict {
  /** Whether the content was scanned at all (true only for public publishes). */
  scanned: boolean;
  /** True when the publish must be blocked (flagged hash). */
  blocked: boolean;
  /** The content hash, present only when a scan ran. */
  hash?: string;
}

/**
 * Evaluate content crossing a scope boundary. ONLY `published_blob` -- the
 * community-public scope -- is scanned, pre-encryption, on the publisher's own
 * device. Every private scope returns unscanned without the hash function ever
 * running (pass a spy hashFn to prove it).
 */
export function evaluatePublishBoundary(
  scope: SyncScope,
  content: Uint8Array,
  flaggedHashes: ReadonlySet<string>,
  hashFn: (bytes: Uint8Array) => string = sha512Hex,
): PublishBoundaryVerdict {
  if (scope !== 'published_blob') {
    return { scanned: false, blocked: false };
  }
  const hash = hashFn(content);
  return { scanned: true, blocked: flaggedHashes.has(hash), hash };
}

// ---------------------------------------------------------------------------
// Rail 3: descriptor kill switch (join boundary)
// ---------------------------------------------------------------------------

export interface DescriptorKill {
  version: 1;
  communityId: string;
  reason: string;
  killedAt: string;
  /** The T&S authority that signed this kill. */
  authorityDeviceId: string;
}

export interface SignedDescriptorKill {
  kill: DescriptorKill;
  signature: string;
}

function canonicalKill(kill: DescriptorKill): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-descriptor-kill-v1',
    kill.version,
    kill.communityId,
    kill.reason,
    kill.killedAt,
    kill.authorityDeviceId,
  ]));
}

/** T&S signs a kill for a community descriptor. */
export function createDescriptorKill(
  authority: DeviceIdentity,
  communityId: string,
  reason: string,
  killedAt: string = new Date().toISOString(),
): SignedDescriptorKill {
  const kill: DescriptorKill = {
    version: 1,
    communityId,
    reason,
    killedAt,
    authorityDeviceId: authority.publicKey,
  };
  const signature = bytesToHex(
    signMessage(extractSigningPrivateKeyHex(authority.privateKeyRef), canonicalKill(kill)),
  );
  return { kill, signature };
}

/** Verify a kill record against the authority the client trusts. */
export function verifyDescriptorKill(
  signed: SignedDescriptorKill,
  trustedAuthorityDeviceId: string,
): boolean {
  if (!signed?.kill || signed.kill.version !== 1) return false;
  if (signed.kill.authorityDeviceId !== trustedAuthorityDeviceId) return false;
  try {
    return verifySignature(
      signed.kill.authorityDeviceId,
      canonicalKill(signed.kill),
      hexToBytes(signed.signature),
    );
  } catch {
    return false;
  }
}

/**
 * Is this community killed, per a list of kill records and the single
 * authority this client trusts? Unverifiable records never count.
 */
export function isDescriptorKilled(
  communityId: string,
  kills: readonly SignedDescriptorKill[],
  trustedAuthorityDeviceId: string,
): boolean {
  return kills.some(
    (signed) =>
      signed.kill.communityId === communityId
      && verifyDescriptorKill(signed, trustedAuthorityDeviceId),
  );
}

// ---------------------------------------------------------------------------
// Rail 4: UNSEALED public report (Plan 19 §9). The unpaired-reader-reachable path.
// ---------------------------------------------------------------------------
//
// Rail 1 (createAbuseReport) SEALS a report to a Trust & Safety mailbox, so the
// reporter needs the inbox's X25519 DH key. A HOST that serves a public
// publication has NO owner/inbox DH key -- the PublicationDescriptor never carries
// one. So a public reader cannot seal a report a host could store or an owner could
// fetch. This rail is the honest fix: a report that is SIGNED, not sealed, so a
// host (no decryption key) can verify the reporter's Ed25519 signature, store it,
// and later hand it to the publication owner (who proves ownership with their own
// Ed25519 key). The trade-off vs Rail 1 is no confidentiality from the host -- which
// is correct here, because the host is the intended intake, not an adversary.

/** The fixed §9 public-report taxonomy. An unknown reason is rejected fail-closed. */
export type PublicReportReason =
  | 'spam'
  | 'harassment'
  | 'illegal'
  | 'csam'
  | 'violence'
  | 'other';

const PUBLIC_REPORT_REASONS: readonly PublicReportReason[] = [
  'spam', 'harassment', 'illegal', 'csam', 'violence', 'other',
];

export type PublicReportTargetKind = 'post' | 'reply' | 'file' | 'community';
const PUBLIC_REPORT_TARGET_KINDS: readonly PublicReportTargetKind[] = ['post', 'reply', 'file', 'community'];

/** An UNSEALED public report: signed by the reporter, readable by any host. */
export interface PublicAbuseReport {
  version: 1;
  publicationId: string;
  targetKind: PublicReportTargetKind;
  targetId: string;
  reason: PublicReportReason;
  /** The reporter's Ed25519 device id; the signature verifies against it. */
  reporterDeviceId: string;
  reportedAt: string;
}

export interface SignedPublicAbuseReport {
  report: PublicAbuseReport;
  /** Ed25519 signature (hex) over the canonical report, by reporterDeviceId. */
  signature: string;
}

const PUBLIC_REPORT_DOMAIN = 'meerkat-public-report-v1';

/** Canonical bytes the reporter signs -- field order fixed and explicit. */
function canonicalPublicReport(report: PublicAbuseReport): Uint8Array {
  return encoder.encode(JSON.stringify([
    PUBLIC_REPORT_DOMAIN,
    report.version,
    report.publicationId,
    report.targetKind,
    report.targetId,
    report.reason,
    report.reporterDeviceId,
    report.reportedAt,
  ]));
}

export interface CreatePublicAbuseReportInput {
  publicationId: string;
  targetKind: PublicReportTargetKind;
  targetId: string;
  reason: PublicReportReason;
  reportedAt?: string;
}

/**
 * Create an UNSEALED, signed public report. The reporter signs the canonical report
 * with their Ed25519 key over the fixed PUBLIC_REPORT_DOMAIN (mirrors
 * createDescriptorKill's canonical-sign pattern). No owner DH key is needed: any
 * reader who can see the public content can file this.
 */
export function createPublicAbuseReport(
  reporter: DeviceIdentity,
  input: CreatePublicAbuseReportInput,
): SignedPublicAbuseReport {
  const report: PublicAbuseReport = {
    version: 1,
    publicationId: input.publicationId,
    targetKind: input.targetKind,
    targetId: input.targetId,
    reason: input.reason,
    reporterDeviceId: reporter.publicKey,
    reportedAt: input.reportedAt ?? new Date().toISOString(),
  };
  const signature = bytesToHex(
    signMessage(extractSigningPrivateKeyHex(reporter.privateKeyRef), canonicalPublicReport(report)),
  );
  return { report, signature };
}

/**
 * Create an UNSEALED, signed public report from a RAW Ed25519 keypair (hex) rather than a
 * DeviceIdentity. This is the PUBLIC-TIER path (Plan 39 NC-P2): a public report is signed by
 * the reporter's PUBLIC PERSONA key, never the device key, so filing a report never leaks the
 * device identity into a public-tier request. The node verifies the signature against
 * reporterDeviceId (here, the persona pubkey) exactly as for the device-signed variant, so the
 * intake path is unchanged and the reporter stays a stable, abuse-auditable public identity.
 */
export function createPublicAbuseReportWithKey(
  reporter: { publicKeyHex: string; privateKeyHex: string },
  input: CreatePublicAbuseReportInput,
): SignedPublicAbuseReport {
  const report: PublicAbuseReport = {
    version: 1,
    publicationId: input.publicationId,
    targetKind: input.targetKind,
    targetId: input.targetId,
    reason: input.reason,
    reporterDeviceId: reporter.publicKeyHex,
    reportedAt: input.reportedAt ?? new Date().toISOString(),
  };
  const signature = bytesToHex(signMessage(reporter.privateKeyHex, canonicalPublicReport(report)));
  return { report, signature };
}

function isPublicReportReason(value: unknown): value is PublicReportReason {
  return typeof value === 'string' && (PUBLIC_REPORT_REASONS as readonly string[]).includes(value);
}

// Field-length caps (DoS hardening): a legit report is ~200 bytes. The open intake
// route is count-bounded per publication, so these field caps byte-bound each stored
// entry too -- a signature-passing attacker cannot inflate a report to amplify
// disk/heap by storing oversized variable-length fields.
const MAX_REPORT_ID_CHARS = 128;
const MAX_REPORT_TS_CHARS = 40;
/** Ed25519 device id = 32 bytes = 64 hex chars; detached signature = 64 bytes = 128 hex. */
const DEVICE_ID_RE = /^[0-9a-f]{64}$/i;
const ED25519_SIG_RE = /^[0-9a-f]{128}$/i;

/**
 * Verify an unsealed public report. Recomputes the canonical bytes and verifies the
 * reporter's Ed25519 signature, FAIL-CLOSED: a malformed shape, an unknown reason
 * outside the fixed §9 taxonomy, an OVERSIZE variable-length field (publicationId /
 * targetId / reportedAt / reporterDeviceId / signature beyond their sane caps), or a
 * signature that does not match the claimed reporterDeviceId all return false. A host
 * needs only this (no decryption key) -- and the caps bound the bytes it will store.
 */
export function verifyPublicAbuseReport(signed: SignedPublicAbuseReport): boolean {
  const r = signed?.report;
  if (!r || r.version !== 1) return false;
  if (typeof r.publicationId !== 'string' || r.publicationId.length === 0 || r.publicationId.length > MAX_REPORT_ID_CHARS) return false;
  if (!(PUBLIC_REPORT_TARGET_KINDS as readonly string[]).includes(r.targetKind)) return false;
  if (typeof r.targetId !== 'string' || r.targetId.length > MAX_REPORT_ID_CHARS) return false;
  if (!isPublicReportReason(r.reason)) return false;
  if (typeof r.reporterDeviceId !== 'string' || !DEVICE_ID_RE.test(r.reporterDeviceId)) return false;
  if (typeof r.reportedAt !== 'string' || r.reportedAt.length === 0 || r.reportedAt.length > MAX_REPORT_TS_CHARS) return false;
  if (typeof signed.signature !== 'string' || !ED25519_SIG_RE.test(signed.signature)) return false;
  try {
    return verifySignature(r.reporterDeviceId, canonicalPublicReport(r), hexToBytes(signed.signature));
  } catch {
    return false;
  }
}

/** csam + illegal are PRIORITY reports for host triage; everything else is not. */
export function isPriorityPublicReport(report: PublicAbuseReport): boolean {
  return report.reason === 'csam' || report.reason === 'illegal';
}

// ---------------------------------------------------------------------------
// Owner report-fetch authentication (Plan 19 §9 / §10 P8a).
// ---------------------------------------------------------------------------
//
// A publication owner proves ownership to pull the host-stored reports for their OWN
// publication. They sign a canonical (publicationId, ts) with their Ed25519 key; the
// host verifies it against the stored publication's ownerDeviceId. This mirrors how
// registerPublication proves the owner via the descriptor's own Ed25519 signature --
// no shared secret, no DH key, just the owner's signing key.

const PUBLIC_REPORT_FETCH_DOMAIN = 'meerkat-public-report-fetch-v1';

function canonicalReportFetch(publicationId: string, ts: string): Uint8Array {
  return encoder.encode(JSON.stringify([PUBLIC_REPORT_FETCH_DOMAIN, publicationId, ts]));
}

/** Owner-side: sign a (publicationId, ts) report-fetch challenge with the owner key. */
export function createPublicReportFetchSignature(
  owner: DeviceIdentity,
  publicationId: string,
  ts: string,
): string {
  return bytesToHex(
    signMessage(extractSigningPrivateKeyHex(owner.privateKeyRef), canonicalReportFetch(publicationId, ts)),
  );
}

/** Host-side: verify a report-fetch signature against the publication's ownerDeviceId. */
export function verifyPublicReportFetchSignature(
  ownerDeviceId: string,
  publicationId: string,
  ts: string,
  signature: string,
): boolean {
  if (typeof ownerDeviceId !== 'string' || ownerDeviceId.length === 0) return false;
  if (typeof signature !== 'string' || signature.length === 0) return false;
  try {
    return verifySignature(ownerDeviceId, canonicalReportFetch(publicationId, ts), hexToBytes(signature));
  } catch {
    return false;
  }
}
