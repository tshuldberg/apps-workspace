/**
 * MK-034 -- abuse rails v1 (D10). The ACs:
 *  - a report reaches the T&S inbox with context (reporter authenticated);
 *  - a flagged publish is blocked client-side at the publish boundary;
 *  - a killed descriptor stops NEW joins without touching existing data;
 *  - private scopes are PROVABLY unscanned (the hash function never runs).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { sha512Hex } from '../node/hkdf';
import {
  createAbuseReport,
  createDescriptorKill,
  createPublicAbuseReport,
  createPublicReportFetchSignature,
  evaluatePublishBoundary,
  isDescriptorKilled,
  isPriorityPublicReport,
  openAbuseReport,
  verifyDescriptorKill,
  verifyPublicAbuseReport,
  verifyPublicReportFetchSignature,
  type PublicAbuseReport,
  type SignedPublicAbuseReport,
} from '../protocol/abuse-rails';
import {
  createCommunity,
  createCommunityInvite,
  getCommunity,
  joinCommunityFromLink,
  upsertCommunity,
} from '../protocol/community';

describe('reporter-side reports (MK-034 AC)', () => {
  it('a report reaches the T&S inbox with its context, reporter authenticated', () => {
    const reporter = generateDeviceIdentity('Reporter');
    const tns = generateDeviceIdentity('TnS Inbox');

    const envelope = createAbuseReport(reporter, { deviceId: tns.publicKey, dhPublicKey: tns.dhPublicKey }, {
      communityId: 'cm-123',
      contentId: 'cid-456',
      reason: 'harassment',
      context: 'the plaintext I can read and am quoting',
    });

    const opened = openAbuseReport(tns, envelope);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.senderDeviceId).toBe(reporter.publicKey); // authenticated
      expect(opened.payload.reason).toBe('harassment');
      expect(opened.payload.context).toBe('the plaintext I can read and am quoting');
      expect(opened.payload.communityId).toBe('cm-123');
    }

    // Anyone who is not the inbox (a relay, a community admin) cannot read it.
    const snoop = generateDeviceIdentity('Snoop');
    expect(openAbuseReport(snoop, envelope).ok).toBe(false);
  });
});

describe('publish-boundary hash matching (MK-034 AC)', () => {
  const flagged = new Uint8Array([9, 9, 9]);
  const clean = new Uint8Array([1, 2, 3]);
  const flaggedHashes = new Set([sha512Hex(flagged)]);

  it('blocks a flagged publish client-side; clean publishes pass', () => {
    expect(evaluatePublishBoundary('published_blob', flagged, flaggedHashes))
      .toEqual({ scanned: true, blocked: true, hash: sha512Hex(flagged) });
    expect(evaluatePublishBoundary('published_blob', clean, flaggedHashes))
      .toEqual({ scanned: true, blocked: false, hash: sha512Hex(clean) });
  });

  it('PRIVATE SCOPES ARE PROVABLY UNSCANNED: the hash function never runs', () => {
    const spy = vi.fn(sha512Hex);
    for (const scope of ['device_local', 'personal_replica', 'shared_workspace'] as const) {
      const verdict = evaluatePublishBoundary(scope, flagged, flaggedHashes, spy);
      expect(verdict).toEqual({ scanned: false, blocked: false });
    }
    expect(spy).not.toHaveBeenCalled(); // not once, for any private scope
    // And the same spy IS called exactly once for a public publish.
    evaluatePublishBoundary('published_blob', clean, flaggedHashes, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('descriptor kill switch (MK-034 AC)', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => { db = createInMemoryTestDatabase(); createSyncTables(db.adapter); });
  afterEach(() => { db.close(); });

  it('a killed descriptor stops NEW joins; existing local data is untouched', () => {
    const owner = generateDeviceIdentity('Owner');
    const memberA = generateDeviceIdentity('Existing Member');
    const memberB = generateDeviceIdentity('New Joiner');
    const authority = generateDeviceIdentity('TnS Authority');

    const signed = createCommunity(owner, { name: 'Killed Club' });
    const communityId = signed.descriptor.communityId;

    // Member A joined long before the kill: their copy exists locally.
    upsertCommunity(db.adapter, signed, memberA.publicKey);
    expect(getCommunity(db.adapter, communityId)).not.toBeNull();

    // T&S kills the descriptor.
    const kill = createDescriptorKill(authority, communityId, 'illegal content');
    expect(verifyDescriptorKill(kill, authority.publicKey)).toBe(true);

    // A NEW join is refused at the join boundary...
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-06-11T00:00:00.000Z'));
    const result = joinCommunityFromLink(
      db.adapter, memberB, link, new Date('2026-06-11T00:00:30.000Z'),
      { kills: [kill], trustedKillAuthorityDeviceId: authority.publicKey },
    );
    expect(result).toEqual({ ok: false, reason: 'killed' });

    // ...while the existing member's stored community (their "ciphertext") is
    // untouched: a kill is future-tense, never remote deletion.
    expect(getCommunity(db.adapter, communityId)).not.toBeNull();
  });

  it('a kill from an untrusted or forged authority never counts', () => {
    const authority = generateDeviceIdentity('Real Authority');
    const impostor = generateDeviceIdentity('Impostor');
    const kill = createDescriptorKill(impostor, 'cm-1', 'fake');

    // Signed by the impostor: not the authority this client trusts.
    expect(isDescriptorKilled('cm-1', [kill], authority.publicKey)).toBe(false);

    // Forged: claims the real authority but carries the impostor's signature.
    const forged = { ...kill, kill: { ...kill.kill, authorityDeviceId: authority.publicKey } };
    expect(isDescriptorKilled('cm-1', [forged], authority.publicKey)).toBe(false);
  });

  it('a join with no kill list behaves exactly as before (back-compat)', () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const signed = createCommunity(owner, { name: 'Open Club' });
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-06-11T00:00:00.000Z'));
    expect(joinCommunityFromLink(db.adapter, joiner, link, new Date('2026-06-11T00:00:30.000Z')).ok).toBe(true);
  });
});

describe('unsealed public report form (Plan 19 §9, P8a)', () => {
  it('a host with NO owner DH key verifies the report by the reporter Ed25519 alone', () => {
    const reporter = generateDeviceIdentity('Public Reader');
    const signed = createPublicAbuseReport(reporter, {
      publicationId: 'pub-abc',
      targetKind: 'post',
      targetId: 'evt-123',
      reason: 'spam',
    });
    // The report is SIGNED, not sealed: anyone (a host with no decryption key) can
    // verify it against the reporter's public Ed25519 key.
    expect(signed.report.reporterDeviceId).toBe(reporter.publicKey);
    expect(verifyPublicAbuseReport(signed)).toBe(true);
  });

  it('rejects a forged report (signature does not match the claimed reporter)', () => {
    const reporter = generateDeviceIdentity('Reporter');
    const signed = createPublicAbuseReport(reporter, {
      publicationId: 'pub-abc', targetKind: 'community', targetId: 'cm-1', reason: 'harassment',
    });
    // Flip a byte in the signature: fail-closed.
    const tampered: SignedPublicAbuseReport = {
      report: signed.report,
      signature: (signed.signature[0] === '0' ? 'f' : '0') + signed.signature.slice(1),
    };
    expect(verifyPublicAbuseReport(tampered)).toBe(false);

    // Re-attribute to a different reporter without re-signing: fail-closed.
    const impostor = generateDeviceIdentity('Impostor');
    const reattributed: SignedPublicAbuseReport = {
      report: { ...signed.report, reporterDeviceId: impostor.publicKey },
      signature: signed.signature,
    };
    expect(verifyPublicAbuseReport(reattributed)).toBe(false);
  });

  it('rejects an unknown reason code outside the fixed §9 taxonomy', () => {
    const reporter = generateDeviceIdentity('Reporter');
    const signed = createPublicAbuseReport(reporter, {
      publicationId: 'pub-abc', targetKind: 'file', targetId: 'f-1', reason: 'csam',
    });
    // Re-sign-free tamper of the reason to a non-taxonomy value: rejected.
    const bogus = {
      report: { ...signed.report, reason: 'totally-made-up' as PublicAbuseReport['reason'] },
      signature: signed.signature,
    };
    expect(verifyPublicAbuseReport(bogus)).toBe(false);
  });

  it('rejects OVERSIZE variable-length fields (DoS hardening) but accepts a normal report', () => {
    const reporter = generateDeviceIdentity('Reporter');
    const base = createPublicAbuseReport(reporter, {
      publicationId: 'pub-abc', targetKind: 'post', targetId: 'evt-1', reason: 'spam',
    });
    // A normal report still verifies (sanity).
    expect(verifyPublicAbuseReport(base)).toBe(true);

    // An oversize targetId (> 128 chars) is rejected even though the rest is well-formed.
    const hugeTarget = createPublicAbuseReport(reporter, {
      publicationId: 'pub-abc', targetKind: 'post', targetId: 'x'.repeat(5000), reason: 'spam',
    });
    expect(verifyPublicAbuseReport(hugeTarget)).toBe(false);

    // An oversize publicationId (> 128 chars) is rejected.
    const hugePub = createPublicAbuseReport(reporter, {
      publicationId: 'p'.repeat(200), targetKind: 'post', targetId: 'evt-1', reason: 'spam',
    });
    expect(verifyPublicAbuseReport(hugePub)).toBe(false);

    // A non-64-hex reporterDeviceId (re-attributed without re-signing) is rejected.
    const badDeviceId: SignedPublicAbuseReport = {
      report: { ...base.report, reporterDeviceId: 'not-a-hex-device-id' },
      signature: base.signature,
    };
    expect(verifyPublicAbuseReport(badDeviceId)).toBe(false);

    // An oversize reportedAt (> 40 chars) is rejected.
    const hugeTs = createPublicAbuseReport(reporter, {
      publicationId: 'pub-abc', targetKind: 'post', targetId: 'evt-1', reason: 'spam', reportedAt: 'z'.repeat(64),
    });
    expect(verifyPublicAbuseReport(hugeTs)).toBe(false);
  });

  it('flags csam + illegal as PRIORITY, everything else as non-priority', () => {
    const reporter = generateDeviceIdentity('Reporter');
    const make = (reason: PublicAbuseReport['reason']) =>
      createPublicAbuseReport(reporter, { publicationId: 'p', targetKind: 'post', targetId: 't', reason }).report;
    expect(isPriorityPublicReport(make('csam'))).toBe(true);
    expect(isPriorityPublicReport(make('illegal'))).toBe(true);
    expect(isPriorityPublicReport(make('spam'))).toBe(false);
    expect(isPriorityPublicReport(make('harassment'))).toBe(false);
    expect(isPriorityPublicReport(make('violence'))).toBe(false);
    expect(isPriorityPublicReport(make('other'))).toBe(false);
  });

  it('owner report-fetch signature: only the owner key verifies (non-owner rejected)', () => {
    const owner = generateDeviceIdentity('Owner');
    const other = generateDeviceIdentity('Stranger');
    const ts = '2026-06-29T00:00:00.000Z';
    const sig = createPublicReportFetchSignature(owner, 'pub-abc', ts);
    expect(verifyPublicReportFetchSignature(owner.publicKey, 'pub-abc', ts, sig)).toBe(true);
    // Wrong publicationId, wrong ts, or wrong key all fail closed.
    expect(verifyPublicReportFetchSignature(owner.publicKey, 'pub-XXX', ts, sig)).toBe(false);
    expect(verifyPublicReportFetchSignature(owner.publicKey, 'pub-abc', '2026-06-29T00:00:01.000Z', sig)).toBe(false);
    expect(verifyPublicReportFetchSignature(other.publicKey, 'pub-abc', ts, sig)).toBe(false);
    // A non-owner cannot mint a passing owner signature.
    const forged = createPublicReportFetchSignature(other, 'pub-abc', ts);
    expect(verifyPublicReportFetchSignature(owner.publicKey, 'pub-abc', ts, forged)).toBe(false);
  });
});
