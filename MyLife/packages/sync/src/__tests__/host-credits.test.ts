/**
 * MK-035 -- Host Credits v0 (D9). The ACs: the ledger is local-first and
 * VERIFIABLE (signed spot-check attestations, recomputable by anyone); the
 * healthy-host perk toggles an entitlement; there is no token and no cash-out.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  computeHostCredits,
  createHostAttestation,
  hostPerk,
  hostRatioStats,
  verifyHostAttestation,
  type SignedHostAttestation,
} from '../protocol/host-credits';

const NOW = new Date('2026-06-11T12:00:00.000Z');
const GIB = 1024 * 1024 * 1024;

function ledgerFor(hostId: string, attestors: ReturnType<typeof generateDeviceIdentity>[]) {
  const ledger: SignedHostAttestation[] = [];
  // 12 uptime checks, all passed, spread across attestors.
  for (let i = 0; i < 12; i++) {
    const attestor = attestors[i % attestors.length]!;
    ledger.push(createHostAttestation(
      attestor, hostId, 'uptime_spot_check', 1,
      new Date(NOW.getTime() - i * 60 * 60 * 1000).toISOString(),
    ));
  }
  // 2 GiB actually served, receipted by a member who fetched.
  ledger.push(createHostAttestation(attestors[0]!, hostId, 'serve_receipt', 2 * GIB, NOW.toISOString()));
  // Storage spot check: 5 GiB verified held.
  ledger.push(createHostAttestation(attestors[1]!, hostId, 'storage_spot_check', 5 * GIB, NOW.toISOString()));
  return ledger;
}

describe('attestations (MK-035)', () => {
  it('sign/verify round-trips; forged and self attestations never count', () => {
    const host = generateDeviceIdentity('Host');
    const member = generateDeviceIdentity('Member');
    const good = createHostAttestation(member, host.publicKey, 'uptime_spot_check', 1);
    expect(verifyHostAttestation(good)).toBe(true);

    // Forged attestor.
    const evil = generateDeviceIdentity('Evil');
    const forged = { ...good, attestation: { ...good.attestation, attestorDeviceId: evil.publicKey } };
    expect(verifyHostAttestation(forged)).toBe(false);

    // A host vouching for itself is structurally rejected.
    const selfSigned = createHostAttestation(host, host.publicKey, 'uptime_spot_check', 1);
    expect(verifyHostAttestation(selfSigned)).toBe(false);
  });
});

describe('credit ledger (MK-035 AC)', () => {
  it('is recomputable and skips unverifiable entries (verifiable ledger)', () => {
    const host = generateDeviceIdentity('Host');
    const members = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const ledger = ledgerFor(host.publicKey, members);

    // Someone appends garbage + a self-attestation: the recompute ignores both.
    ledger.push({ ...ledger[0]!, signature: 'ff'.repeat(64) });
    ledger.push(createHostAttestation(host, host.publicKey, 'serve_receipt', 100 * GIB));

    const summary = computeHostCredits(host.publicKey, ledger, { now: NOW });
    expect(summary.uptimeChecks).toBe(12);
    expect(summary.uptimePassRate).toBe(1);
    expect(summary.bytesServed).toBe(2 * GIB); // the 100 GiB self-claim never counted
    expect(summary.credits).toBe(12 * 10 + 200); // 12 passes + 2 GiB served
    expect(summary.healthy).toBe(true);
  });

  it('ages attestations out of the window', () => {
    const host = generateDeviceIdentity('Host');
    const member = generateDeviceIdentity('Member');
    const stale = createHostAttestation(
      member, host.publicKey, 'uptime_spot_check', 1,
      new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days old
    );
    const summary = computeHostCredits(host.publicKey, [stale], { now: NOW });
    expect(summary.uptimeChecks).toBe(0);
    expect(summary.credits).toBe(0);
  });

  it('an unhealthy host (missed checks) earns credits but no perk', () => {
    const host = generateDeviceIdentity('Host');
    const member = generateDeviceIdentity('Member');
    const ledger: SignedHostAttestation[] = [];
    for (let i = 0; i < 12; i++) {
      ledger.push(createHostAttestation(
        member, host.publicKey, 'uptime_spot_check', i < 6 ? 1 : 0, // 50% pass rate
        new Date(NOW.getTime() - i * 60 * 60 * 1000).toISOString(),
      ));
    }
    const summary = computeHostCredits(host.publicKey, ledger, { now: NOW });
    expect(summary.healthy).toBe(false);
    expect(hostPerk(summary)).toEqual({ proFree: false, quotaMultiplier: 1 });
  });
});

describe('perk + ratio stats (MK-035 AC)', () => {
  it('a healthy host gets the entitlement: Pro free + quota multiplier; nothing transferable', () => {
    const host = generateDeviceIdentity('Host');
    const members = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const summary = computeHostCredits(host.publicKey, ledgerFor(host.publicKey, members), { now: NOW });

    const perk = hostPerk(summary);
    expect(perk.proFree).toBe(true);
    expect(perk.quotaMultiplier).toBeGreaterThanOrEqual(2);
    // No token, no cash-out: the perk carries ONLY entitlement fields.
    expect(Object.keys(perk).sort()).toEqual(['proFree', 'quotaMultiplier']);
  });

  it('soft ratio stats for admins: served vs stored, informational only', () => {
    const host = generateDeviceIdentity('Host');
    const members = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const stats = hostRatioStats(ledgerFor(host.publicKey, members));
    expect(stats).toHaveLength(1);
    expect(stats[0]!.hostDeviceId).toBe(host.publicKey);
    expect(stats[0]!.bytesServed).toBe(2 * GIB);
    expect(stats[0]!.bytesStoredVerified).toBe(5 * GIB);
    expect(stats[0]!.ratio).toBeCloseTo(0.4);
  });
});
