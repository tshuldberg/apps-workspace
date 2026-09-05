/**
 * MK-041 -- Hosted Nodes service (codeable core). The ACs:
 *  - a rented node joins a community as host (pins + serves its catalog);
 *  - tenant isolation: one tenant's node cannot serve another's pieces;
 *  - we PROVABLY cannot decrypt hosted shards (test against captured tenant
 *    data: everything the node persisted is ciphertext only a key-holder opens);
 *  - a community can fire the hosted node via descriptor re-sign.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCommunityCatalog,
  createCommunity,
  reviseCommunity,
  communityDescriptorHash,
  generateDeviceIdentity,
  extractSigningPrivateKeyHex,
  deriveSas, // any HKDF-ish helper would do; we use a fixed key below
  encrypt,
  decrypt,
  type CommunityCatalog,
} from '@mylife/sync';
import {
  HostedNodeService,
  MEERKAT_STORAGE_TIER_CAPS_MB,
  MEERKAT_RETENTION_POLICIES,
  retentionPolicy,
  storageCapMbForTier,
} from '../hosted-node';

const PIECE = 1024;
void deriveSas;

/** A community catalog whose CONTENT is ciphertext (sealed under a group key). */
function encryptedCatalog(groupKey: Uint8Array, plaintext: Uint8Array): {
  catalog: CommunityCatalog;
  nonce: Uint8Array;
  plaintext: Uint8Array;
} {
  const { ciphertext, nonce } = encrypt(plaintext, groupKey);
  const owner = generateDeviceIdentity('Community Owner');
  const catalog = buildCommunityCatalog({
    communityName: 'Private Club',
    entries: [{ path: 'sealed.bin', data: ciphertext, mimeType: 'application/octet-stream' }],
    creatorPublicKey: owner.publicKey,
    creatorDisplayName: owner.displayName,
    creatorPrivateKey: extractSigningPrivateKeyHex(owner.privateKeyRef),
    pieceLength: PIECE,
  });
  return { catalog, nonce, plaintext };
}

function plainCatalog(name: string, sizeBytes = 4 * PIECE): CommunityCatalog {
  const owner = generateDeviceIdentity(`${name} Owner`);
  const data = new Uint8Array(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) data[i] = (i + name.length) % 251;
  return buildCommunityCatalog({
    communityName: name,
    entries: [{ path: 'c.bin', data, mimeType: 'application/octet-stream' }],
    creatorPublicKey: owner.publicKey,
    creatorDisplayName: owner.displayName,
    creatorPrivateKey: extractSigningPrivateKeyHex(owner.privateKeyRef),
    pieceLength: PIECE,
  });
}

describe('HostedNodeService (MK-041)', () => {
  it('provisions a tenant that pins + serves a community catalog (rented node joins as host)', async () => {
    const svc = new HostedNodeService();
    svc.provision({ tenantId: 'acme', storageCapMB: 64 });
    const cat = plainCatalog('Surf Club');

    expect((await svc.pinFor('acme', cat)).ok).toBe(true);
    for (let i = 0; i < cat.manifest.pieces.length; i++) {
      expect(await svc.serveFor('acme', cat.manifest.infoHash, i)).not.toBeNull();
    }
    const [stats] = await svc.stats();
    expect(stats.tenantId).toBe('acme');
    expect(stats.peersServed).toBe(cat.manifest.pieces.length);
  });

  it('isolates tenants: one tenant cannot serve another tenant content', async () => {
    const svc = new HostedNodeService();
    svc.provision({ tenantId: 'alpha', storageCapMB: 64 });
    svc.provision({ tenantId: 'beta', storageCapMB: 64 });
    const cat = plainCatalog('Alpha Only');
    await svc.pinFor('alpha', cat);

    // alpha serves its own content...
    expect(await svc.serveFor('alpha', cat.manifest.infoHash, 0)).not.toBeNull();
    // ...beta, which never pinned it, cannot serve it even by the same infoHash.
    expect(await svc.serveFor('beta', cat.manifest.infoHash, 0)).toBeNull();
    // ...and an unprovisioned tenant serves nothing.
    expect(await svc.serveFor('ghost', cat.manifest.infoHash, 0)).toBeNull();
  });

  it('per-tenant storage caps are independent', async () => {
    const svc = new HostedNodeService();
    svc.provision({ tenantId: 'tiny', storageCapMB: (3 * PIECE) / (1024 * 1024) });
    svc.provision({ tenantId: 'roomy', storageCapMB: 64 });

    const big = plainCatalog('Big', 8 * PIECE);
    expect((await svc.pinFor('tiny', big)).ok).toBe(false); // over the tiny cap
    expect((await svc.pinFor('roomy', big)).ok).toBe(true); // fits the roomy cap
  });

  it('ZERO-KNOWLEDGE: captured tenant data is ciphertext the operator cannot decrypt', async () => {
    // The community group key -- the operator NEVER has this.
    const groupKey = new Uint8Array(32).fill(42);
    const plaintext = new TextEncoder().encode('private community content, sealed before it ever left a member');
    const { catalog, nonce } = encryptedCatalog(groupKey, plaintext);

    const svc = new HostedNodeService();
    svc.provision({ tenantId: 'hosted', storageCapMB: 64 });
    await svc.pinFor('hosted', catalog);

    // "Capture" everything the hosted node serves -- this is all the operator has.
    const captured: Uint8Array[] = [];
    for (let i = 0; i < catalog.manifest.pieces.length; i++) {
      const piece = await svc.serveFor('hosted', catalog.manifest.infoHash, i);
      expect(piece).not.toBeNull();
      captured.push(piece!);
    }
    const capturedBytes = new Uint8Array(captured.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of captured) { capturedBytes.set(p, off); off += p.length; }

    // The captured data is the CIPHERTEXT -- not the plaintext -- and contains
    // no plaintext substring. The operator holds no key, so it cannot decrypt.
    const plainStr = new TextDecoder().decode(plaintext);
    expect(new TextDecoder('utf-8', { fatal: false }).decode(capturedBytes)).not.toContain(plainStr);

    // A MEMBER who holds the group key decrypts the very same captured bytes.
    const recovered = decrypt(capturedBytes, nonce, groupKey);
    expect(recovered).not.toBeNull();
    expect(new TextDecoder().decode(recovered!)).toBe(plainStr);

    // The wrong key (anything the operator might try) fails closed.
    expect(decrypt(capturedBytes, nonce, new Uint8Array(32).fill(7))).toBeNull();
  });

  it('a community fires its hosted node by re-signing its descriptor', async () => {
    const owner = generateDeviceIdentity('Owner');
    const hostedNodeUrl = 'wss://hosted.meerkat.app/tenant/acme';
    const v1 = createCommunity(owner, { name: 'Surf Club', hosts: [hostedNodeUrl, 'wss://relay-eu.meerkat.app'] });
    expect(v1.descriptor.hosts).toContain(hostedNodeUrl);

    // Fire the hosted node: re-sign without it. New members never select it; the
    // node keeps only ciphertext it cannot read.
    const v2 = reviseCommunity(owner, v1, { hosts: ['wss://relay-eu.meerkat.app'] });
    expect(v2.descriptor.hosts).not.toContain(hostedNodeUrl);
    expect(v2.descriptor.revision).toBe(2);
    expect(v2.descriptor.previousHash).toBe(communityDescriptorHash(v1));
  });

  it('deprovision drops the tenant and its content', async () => {
    const svc = new HostedNodeService();
    svc.provision({ tenantId: 'acme', storageCapMB: 64 });
    const cat = plainCatalog('Gone Soon');
    await svc.pinFor('acme', cat);

    await svc.deprovision('acme');
    expect(svc.hasTenant('acme')).toBe(false);
    expect(await svc.serveFor('acme', cat.manifest.infoHash, 0)).toBeNull();
  });
});

describe('Plan 22 S0.1: tier->cap map, free-tier provisioning, usageForSubject', () => {
  it('exposes a monotonic tier->storage-cap map (free is the smallest)', () => {
    expect(Object.keys(MEERKAT_STORAGE_TIER_CAPS_MB).sort()).toEqual(
      ['community', 'fleet', 'free', 'starter'],
    );
    expect(storageCapMbForTier('free')).toBe(MEERKAT_STORAGE_TIER_CAPS_MB.free);
    expect(storageCapMbForTier('free')).toBeLessThan(storageCapMbForTier('starter'));
    expect(storageCapMbForTier('starter')).toBeLessThan(storageCapMbForTier('community'));
    expect(storageCapMbForTier('community')).toBeLessThan(storageCapMbForTier('fleet'));
  });

  it('provisions a free-tier tenant at the free cap and reports it via usageForSubject', async () => {
    const svc = new HostedNodeService();
    svc.provisionForTier({ subjectId: 'subj-a', tier: 'free' });

    const usage = await svc.usageForSubject('subj-a');
    expect(usage).not.toBeNull();
    expect(usage!.tenantId).toBe('subj-a');
    expect(usage!.tier).toBe('free');
    expect(usage!.storageCapBytes).toBe(storageCapMbForTier('free') * 1024 * 1024);
    expect(usage!.storageBytes).toBe(0); // nothing pinned yet -- a REAL zero, not fabricated
  });

  it('usageForSubject returns the subject OWN stats only (structural isolation), null when unprovisioned', async () => {
    const svc = new HostedNodeService();
    svc.provisionForTier({ subjectId: 'subj-a', tier: 'free' });
    svc.provisionForTier({ subjectId: 'subj-b', tier: 'free' });
    await svc.pinFor('subj-a', plainCatalog('A Club'));

    const a = await svc.usageForSubject('subj-a');
    const b = await svc.usageForSubject('subj-b');
    expect(a!.tenantId).toBe('subj-a');
    expect(a!.storageBytes).toBeGreaterThan(0);
    expect(b!.tenantId).toBe('subj-b');
    expect(b!.storageBytes).toBe(0); // B's view never includes A's bytes
    expect(await svc.usageForSubject('nobody')).toBeNull();
  });
});

describe('Plan 22 S0.7: retention tier -> autoDeleteDays / isPinned', () => {
  it('maps rolling30 to a 30-day sweep and forever to pinned-forever', () => {
    expect(retentionPolicy('rolling30')).toEqual({ autoDeleteDays: 30, pinForever: false });
    const forever = retentionPolicy('forever');
    expect(forever.pinForever).toBe(true);
    expect(forever.autoDeleteDays).toBeGreaterThan(30);
    expect(MEERKAT_RETENTION_POLICIES.rolling30.pinForever).toBe(false);
  });

  it('records the retention tier on a provisioned tenant and reports it via usageForSubject', async () => {
    const svc = new HostedNodeService();
    svc.provisionForTier({ subjectId: 'keep-me', tier: 'free', retentionTier: 'forever' });
    expect((await svc.usageForSubject('keep-me'))!.retentionTier).toBe('forever');
  });

  it('defaults the retention tier to rolling30', async () => {
    const svc = new HostedNodeService();
    svc.provisionForTier({ subjectId: 'rolling', tier: 'free' });
    expect((await svc.usageForSubject('rolling'))!.retentionTier).toBe('rolling30');
  });
});
