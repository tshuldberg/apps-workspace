/**
 * Host Credits v0 (plan 14, MK-035; design D9).
 *
 * Hosts that keep communities alive earn CREDITS -- an entitlement, not a
 * currency. The ledger is local-first and verifiable: every entry is a signed
 * attestation from ANOTHER member who spot-checked the host (an uptime probe
 * answered, bytes actually served), so credits can be recomputed and re-checked
 * by anyone holding the ledger. Self-attestations never count. A healthy host's
 * perk is Pro-free plus a community quota multiplier; there is NO token and NO
 * cash-out by construction -- the output of this module is a boolean and a
 * multiplier, nothing transferable.
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';

const encoder = new TextEncoder();

export type HostAttestationKind = 'uptime_spot_check' | 'serve_receipt' | 'storage_spot_check';

export interface HostAttestation {
  version: 1;
  /** The host being attested. */
  hostDeviceId: string;
  /** The member who performed the spot check (never the host itself). */
  attestorDeviceId: string;
  kind: HostAttestationKind;
  /**
   * uptime_spot_check: 1 = answered, 0 = missed.
   * serve_receipt: bytes actually served to the attestor.
   * storage_spot_check: bytes verified held.
   */
  value: number;
  observedAt: string;
}

export interface SignedHostAttestation {
  attestation: HostAttestation;
  signature: string;
}

function canonicalAttestation(a: HostAttestation): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-host-attestation-v1',
    a.version,
    a.hostDeviceId,
    a.attestorDeviceId,
    a.kind,
    a.value,
    a.observedAt,
  ]));
}

/** A member signs what they observed about a host. */
export function createHostAttestation(
  attestor: DeviceIdentity,
  hostDeviceId: string,
  kind: HostAttestationKind,
  value: number,
  observedAt: string = new Date().toISOString(),
): SignedHostAttestation {
  const attestation: HostAttestation = {
    version: 1,
    hostDeviceId,
    attestorDeviceId: attestor.publicKey,
    kind,
    value,
    observedAt,
  };
  const signature = bytesToHex(
    signMessage(extractSigningPrivateKeyHex(attestor.privateKeyRef), canonicalAttestation(attestation)),
  );
  return { attestation, signature };
}

/** Verifiable = re-checkable: signature by the attestor, never the host itself. */
export function verifyHostAttestation(signed: SignedHostAttestation): boolean {
  const a = signed?.attestation;
  if (!a || a.version !== 1 || typeof signed.signature !== 'string') return false;
  if (a.attestorDeviceId === a.hostDeviceId) return false; // self-attestation
  if (typeof a.value !== 'number' || !Number.isFinite(a.value) || a.value < 0) return false;
  try {
    return verifySignature(a.attestorDeviceId, canonicalAttestation(a), hexToBytes(signed.signature));
  } catch {
    return false;
  }
}

export interface HostCreditSummary {
  hostDeviceId: string;
  credits: number;
  uptimeChecks: number;
  uptimePassRate: number;
  bytesServed: number;
  bytesStoredVerified: number;
  healthy: boolean;
}

export interface CreditOptions {
  /** Attestations older than this window are ignored. Default 30 days. */
  windowMs?: number;
  now?: Date;
  /** Healthy = at least this many uptime checks in the window... */
  minUptimeChecks?: number;
  /** ...with at least this pass rate. */
  minUptimePassRate?: number;
}

const CREDIT_PER_UPTIME_PASS = 10;
const CREDIT_PER_GIB_SERVED = 100;
const GIB = 1024 * 1024 * 1024;

/**
 * Recompute a host's credits from the ledger. Unverifiable entries are
 * skipped (the ledger stays honest even if someone appends garbage).
 */
export function computeHostCredits(
  hostDeviceId: string,
  ledger: readonly SignedHostAttestation[],
  options: CreditOptions = {},
): HostCreditSummary {
  const now = options.now ?? new Date();
  const windowMs = options.windowMs ?? 30 * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - windowMs;

  let uptimeChecks = 0;
  let uptimePasses = 0;
  let bytesServed = 0;
  let bytesStoredVerified = 0;

  for (const signed of ledger) {
    const a = signed.attestation;
    if (a.hostDeviceId !== hostDeviceId) continue;
    if (new Date(a.observedAt).getTime() < cutoff) continue;
    if (!verifyHostAttestation(signed)) continue;

    if (a.kind === 'uptime_spot_check') {
      uptimeChecks += 1;
      if (a.value >= 1) uptimePasses += 1;
    } else if (a.kind === 'serve_receipt') {
      bytesServed += a.value;
    } else if (a.kind === 'storage_spot_check') {
      bytesStoredVerified = Math.max(bytesStoredVerified, a.value);
    }
  }

  const uptimePassRate = uptimeChecks === 0 ? 0 : uptimePasses / uptimeChecks;
  const credits = uptimePasses * CREDIT_PER_UPTIME_PASS
    + Math.floor((bytesServed / GIB) * CREDIT_PER_GIB_SERVED);
  const healthy =
    uptimeChecks >= (options.minUptimeChecks ?? 10)
    && uptimePassRate >= (options.minUptimePassRate ?? 0.95);

  return { hostDeviceId, credits, uptimeChecks, uptimePassRate, bytesServed, bytesStoredVerified, healthy };
}

export interface HostPerk {
  /** Healthy hosts ride Pro for free (an entitlement toggle, nothing more). */
  proFree: boolean;
  /** Community storage quota multiplier (1 = baseline). */
  quotaMultiplier: number;
}

/** The perk is an entitlement: no token, no balance, nothing transferable. */
export function hostPerk(summary: HostCreditSummary): HostPerk {
  if (!summary.healthy) return { proFree: false, quotaMultiplier: 1 };
  // Quota grows gently with sustained contribution, capped at 4x.
  const quotaMultiplier = Math.min(4, 2 + Math.floor(summary.credits / 1_000));
  return { proFree: true, quotaMultiplier };
}

export interface HostRatioStat {
  hostDeviceId: string;
  bytesServed: number;
  bytesStoredVerified: number;
  /** served / stored; soft signal for admins, never an enforcement input. */
  ratio: number | null;
}

/** Soft per-host ratio stats for community admins (informational only). */
export function hostRatioStats(ledger: readonly SignedHostAttestation[]): HostRatioStat[] {
  const hosts = [...new Set(ledger.map((s) => s.attestation.hostDeviceId))];
  return hosts.map((hostDeviceId) => {
    const summary = computeHostCredits(hostDeviceId, ledger, { windowMs: Number.MAX_SAFE_INTEGER / 2 });
    return {
      hostDeviceId,
      bytesServed: summary.bytesServed,
      bytesStoredVerified: summary.bytesStoredVerified,
      ratio: summary.bytesStoredVerified > 0
        ? summary.bytesServed / summary.bytesStoredVerified
        : null,
    };
  });
}
